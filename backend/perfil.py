"""Perfil do utilizador: dados básicos, foto de perfil e preferência de tema.

A foto é guardada como os restantes ficheiros: cifrada no MinIO distribuído,
com a chave registada no documento do utilizador. O tema fica no MongoDB para
acompanhar o utilizador em qualquer computador.
"""
from datetime import datetime, timezone
from typing import Literal

from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

import db
import storage
from auth import utilizador_atual

router = APIRouter(prefix="/api/perfil", tags=["perfil"])

TAMANHO_MAXIMO_FOTO = 2 * 1024 * 1024  # 2 MB (o frontend já reduz para 256x256)

# Assinaturas dos formatos aceites (verificadas no conteúdo, não só no nome)
ASSINATURAS = {
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/gif": (b"GIF87a", b"GIF89a"),
}


def _tipo_imagem(dados: bytes) -> str | None:
    for tipo, assinaturas in ASSINATURAS.items():
        if dados.startswith(assinaturas):
            return tipo
    if dados[:4] == b"RIFF" and dados[8:12] == b"WEBP":
        return "image/webp"
    return None


def _chave_foto(uid: ObjectId) -> str:
    return f"{uid}/perfil/foto"


def _utilizador(uid: ObjectId) -> dict:
    u = db.utilizadores().find_one({"_id": uid})
    if not u:
        raise HTTPException(404, "Utilizador não encontrado")
    return u


@router.get("")
def obter_perfil(uid: ObjectId = Depends(utilizador_atual)):
    u = _utilizador(uid)
    foto = u.get("foto")
    return {
        "nome": u["nome"],
        "email": u["email"],
        "tema": u.get("tema", "claro"),
        "tem_foto": bool(foto),
        # Muda sempre que a foto muda, para o browser não mostrar a antiga
        "foto_versao": int(foto["atualizada_em"].timestamp()) if foto else None,
    }


class Preferencias(BaseModel):
    tema: Literal["claro", "escuro"]


@router.put("/preferencias")
def guardar_preferencias(dados: Preferencias, uid: ObjectId = Depends(utilizador_atual)):
    db.utilizadores().update_one({"_id": uid}, {"$set": {"tema": dados.tema}})
    return {"tema": dados.tema}


@router.put("/foto")
async def carregar_foto(foto: UploadFile = File(...), uid: ObjectId = Depends(utilizador_atual)):
    dados = await foto.read(TAMANHO_MAXIMO_FOTO + 1)
    if len(dados) > TAMANHO_MAXIMO_FOTO:
        raise HTTPException(413, "A foto não pode ter mais de 2 MB")
    tipo = _tipo_imagem(dados)
    if not tipo:
        raise HTTPException(400, "Formato não suportado (usa PNG, JPEG, WebP ou GIF)")
    try:
        storage.guardar(_chave_foto(uid), dados)
    except storage.ArmazenamentoIndisponivel:
        raise HTTPException(503, "Armazenamento indisponível, tenta novamente")
    agora = datetime.now(timezone.utc)
    db.utilizadores().update_one(
        {"_id": uid}, {"$set": {"foto": {"tipo": tipo, "tamanho": len(dados), "atualizada_em": agora}}}
    )
    return {"tem_foto": True, "foto_versao": int(agora.timestamp())}


@router.get("/foto")
def obter_foto(uid: ObjectId = Depends(utilizador_atual)):
    foto = _utilizador(uid).get("foto")
    if not foto:
        raise HTTPException(404, "Sem foto de perfil")
    try:
        dados = storage.ler(_chave_foto(uid))
    except storage.ArmazenamentoIndisponivel:
        raise HTTPException(503, "Armazenamento indisponível, tenta novamente")
    return Response(content=dados, media_type=foto["tipo"], headers={"Cache-Control": "private, no-store"})


@router.delete("/foto")
def remover_foto(uid: ObjectId = Depends(utilizador_atual)):
    if not _utilizador(uid).get("foto"):
        return {"tem_foto": False}
    try:
        storage.apagar(_chave_foto(uid))
    except storage.ArmazenamentoIndisponivel:
        raise HTTPException(503, "Armazenamento indisponível, tenta novamente")
    db.utilizadores().update_one({"_id": uid}, {"$unset": {"foto": ""}})
    return {"tem_foto": False}
