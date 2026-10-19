"""Ficheiros e pastas: upload, download, listagem, reciclagem e correções da IA.

Regras importantes:
- Cada utilizador só vê os seus ficheiros (todas as queries filtram por utilizador_id).
- Upload: primeiro grava no MinIO, só depois cria o documento no MongoDB.
  Assim nunca há metadados a apontar para um ficheiro que não existe.
- Eliminar = apagado: true (reciclagem). Só "eliminar definitivamente" remove do MinIO.
- O novo ficheiro fica com estado PENDENTE: é a fila do worker de IA.
"""
import os
import re
import uuid
from datetime import datetime, timezone
from urllib.parse import quote

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, Field

import db
import storage
from auth import utilizador_atual

router = APIRouter(prefix="/api", tags=["ficheiros"])

TAMANHO_MAXIMO = int(os.getenv("TAMANHO_MAXIMO_MB", "50")) * 1024 * 1024

CATEGORIAS = [
    "Académico",
    "Fotografias",
    "Capturas de ecrã",
    "Código",
    "Faturas e finanças",
    "Documentos pessoais",
    "Por rever",
]


# ---------- utilitários ----------

def _agora():
    return datetime.now(timezone.utc)


def _oid(id_: str) -> ObjectId:
    try:
        return ObjectId(id_)
    except InvalidId:
        raise HTTPException(404, "Ficheiro não encontrado")


def normalizar_pasta(pasta: str | None) -> str:
    """'a//b/' -> '/a/b'; raiz = '/'. Rejeita '..'."""
    partes = [p.strip() for p in (pasta or "/").split("/") if p.strip()]
    if any(p in (".", "..") for p in partes):
        raise HTTPException(400, "Nome de pasta inválido")
    return "/" + "/".join(partes)


def _nome_seguro(nome: str) -> str:
    nome = os.path.basename(nome or "").strip()
    nome = re.sub(r"[\x00-\x1f/\\]", "_", nome)
    return nome[:200] or "sem_nome"


def _publico(f: dict) -> dict:
    """Converte o documento MongoDB no formato enviado ao frontend."""
    return {
        "id": str(f["_id"]),
        "nome": f["nome"],
        "tamanho": f["tamanho"],
        "tipo_mime": f.get("tipo_mime"),
        "pasta": f["pasta"],
        "estado": f["estado"],
        "categoria": f.get("categoria"),
        "confianca": f.get("confianca"),
        "corrigido": f.get("corrigido", False),
        "criado_em": f["criado_em"].isoformat(),
        "apagado_em": f["apagado_em"].isoformat() if f.get("apagado_em") else None,
    }


def _obter(id_: str, uid: ObjectId, apagado: bool | None = False) -> dict:
    filtro = {"_id": _oid(id_), "utilizador_id": uid}
    if apagado is not None:
        filtro["apagado"] = apagado
    f = db.ficheiros().find_one(filtro)
    if not f:
        raise HTTPException(404, "Ficheiro não encontrado")
    return f


# ---------- listagem e pastas ----------

@router.get("/ficheiros")
def listar(
    pasta: str = "/",
    categoria: str | None = None,
    q: str | None = Query(None, max_length=100),
    uid: ObjectId = Depends(utilizador_atual),
):
    """Lista o conteúdo de uma pasta. Com 'categoria' ou 'q' pesquisa em todas as pastas."""
    pasta = normalizar_pasta(pasta)
    filtro: dict = {"utilizador_id": uid, "apagado": False}
    pesquisa = bool(categoria or q)
    if categoria:
        filtro["categoria"] = categoria
    if q:
        filtro["nome"] = {"$regex": re.escape(q), "$options": "i"}
    if not pesquisa:
        filtro["pasta"] = pasta

    ficheiros = [_publico(f) for f in db.ficheiros().find(filtro).sort("criado_em", -1).limit(500)]

    subpastas: list[str] = []
    if not pesquisa:
        # Pastas = caminhos dos ficheiros + pastas vazias criadas pelo utilizador
        prefixo = "" if pasta == "/" else pasta
        caminhos = set(db.ficheiros().distinct("pasta", {"utilizador_id": uid, "apagado": False}))
        u = db.utilizadores().find_one({"_id": uid}, {"pastas": 1}) or {}
        caminhos.update(u.get("pastas", []))
        nomes = set()
        for c in caminhos:
            if c.startswith(prefixo + "/") and c != pasta:
                nomes.add(c[len(prefixo) + 1:].split("/")[0])
        subpastas = sorted(nomes, key=str.lower)

    return {"pasta": pasta, "subpastas": subpastas, "ficheiros": ficheiros}


class NovaPasta(BaseModel):
    caminho: str = Field(min_length=1, max_length=300)


@router.post("/pastas", status_code=201)
def criar_pasta(dados: NovaPasta, uid: ObjectId = Depends(utilizador_atual)):
    caminho = normalizar_pasta(dados.caminho)
    if caminho == "/":
        raise HTTPException(400, "Nome de pasta inválido")
    db.utilizadores().update_one({"_id": uid}, {"$addToSet": {"pastas": caminho}})
    return {"caminho": caminho}


# ---------- upload / download ----------

@router.post("/ficheiros", status_code=201)
async def carregar(
    ficheiro: UploadFile = File(...),
    pasta: str = Form("/"),
    uid: ObjectId = Depends(utilizador_atual),
):
    pasta = normalizar_pasta(pasta)
    dados = await ficheiro.read(TAMANHO_MAXIMO + 1)
    if len(dados) > TAMANHO_MAXIMO:
        raise HTTPException(413, "Ficheiro demasiado grande")

    chave = f"{uid}/{uuid.uuid4().hex}"
    try:
        storage.guardar(chave, dados)  # cifra + MinIO (com failover entre nós)
    except storage.ArmazenamentoIndisponivel:
        raise HTTPException(503, "Armazenamento indisponível, tenta novamente")

    doc = {
        "utilizador_id": uid,
        "nome": _nome_seguro(ficheiro.filename),
        "tamanho": len(dados),
        "tipo_mime": ficheiro.content_type or "application/octet-stream",
        "pasta": pasta,
        "chave_minio": chave,
        "estado": "PENDENTE",       # fica na fila da IA
        "categoria": None,
        "confianca": None,
        "apagado": False,
        "apagado_em": None,
        "criado_em": _agora(),
    }
    try:
        doc["_id"] = db.ficheiros().insert_one(doc).inserted_id
    except Exception:
        # Não deixar lixo no MinIO se os metadados falharem
        try:
            storage.apagar(chave)
        finally:
            raise HTTPException(503, "Base de dados indisponível, tenta novamente")
    return _publico(doc)


@router.get("/ficheiros/{id_}/download")
def descarregar(id_: str, uid: ObjectId = Depends(utilizador_atual)):
    f = _obter(id_, uid)
    try:
        dados = storage.ler(f["chave_minio"])
    except storage.ArmazenamentoIndisponivel:
        raise HTTPException(503, "Armazenamento indisponível, tenta novamente")
    return Response(
        content=dados,
        media_type=f.get("tipo_mime") or "application/octet-stream",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{quote(f['nome'])}"},
    )


# ---------- mover / renomear ----------

class Alteracao(BaseModel):
    nome: str | None = Field(None, min_length=1, max_length=200)
    pasta: str | None = Field(None, max_length=300)


@router.patch("/ficheiros/{id_}")
def alterar(id_: str, dados: Alteracao, uid: ObjectId = Depends(utilizador_atual)):
    f = _obter(id_, uid)
    mudancas = {}
    if dados.nome is not None:
        mudancas["nome"] = _nome_seguro(dados.nome)
    if dados.pasta is not None:
        mudancas["pasta"] = normalizar_pasta(dados.pasta)
    if mudancas:
        db.ficheiros().update_one({"_id": f["_id"]}, {"$set": mudancas})
        f.update(mudancas)
    return _publico(f)


# ---------- reciclagem ----------

@router.delete("/ficheiros/{id_}")
def eliminar(id_: str, uid: ObjectId = Depends(utilizador_atual)):
    f = _obter(id_, uid)
    db.ficheiros().update_one({"_id": f["_id"]}, {"$set": {"apagado": True, "apagado_em": _agora()}})
    return {"ok": True}


@router.get("/reciclagem")
def reciclagem(uid: ObjectId = Depends(utilizador_atual)):
    docs = db.ficheiros().find({"utilizador_id": uid, "apagado": True}).sort("apagado_em", -1)
    return {"ficheiros": [_publico(f) for f in docs]}


@router.post("/ficheiros/{id_}/restaurar")
def restaurar(id_: str, uid: ObjectId = Depends(utilizador_atual)):
    f = _obter(id_, uid, apagado=True)
    db.ficheiros().update_one({"_id": f["_id"]}, {"$set": {"apagado": False, "apagado_em": None}})
    return {"ok": True}


@router.delete("/ficheiros/{id_}/definitivo")
def eliminar_definitivo(id_: str, uid: ObjectId = Depends(utilizador_atual)):
    """Só funciona para ficheiros que já estão na reciclagem."""
    f = _obter(id_, uid, apagado=True)
    try:
        storage.apagar(f["chave_minio"])
    except storage.ArmazenamentoIndisponivel:
        raise HTTPException(503, "Armazenamento indisponível, tenta novamente")
    db.ficheiros().delete_one({"_id": f["_id"]})
    return {"ok": True}


# ---------- categorias e correções (alimentam o retreino da IA) ----------

@router.get("/categorias")
def categorias():
    return {"categorias": CATEGORIAS}


class NovaCategoria(BaseModel):
    categoria: str


@router.put("/ficheiros/{id_}/categoria")
def corrigir_categoria(id_: str, dados: NovaCategoria, uid: ObjectId = Depends(utilizador_atual)):
    if dados.categoria not in CATEGORIAS:
        raise HTTPException(400, "Categoria inválida")
    f = _obter(id_, uid)
    if f.get("categoria") == dados.categoria:
        return _publico(f)

    db.correcoes().insert_one({
        "utilizador_id": uid,
        "ficheiro_id": f["_id"],
        "categoria_anterior": f.get("categoria"),
        "categoria_nova": dados.categoria,
        "criado_em": _agora(),
    })
    mudancas = {
        "categoria": dados.categoria,
        "confianca": 1.0,
        "estado": "CATEGORIZADO",
        "corrigido": True,  # o worker não volta a mexer neste ficheiro
    }
    db.ficheiros().update_one({"_id": f["_id"]}, {"$set": mudancas})
    f.update(mudancas)
    return _publico(f)
