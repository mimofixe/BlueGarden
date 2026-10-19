"""Autenticação: registo, login, passwords bcrypt e tokens JWT.

Os tokens são assinados com um segredo partilhado pelos 3 backends, por isso
qualquer instância valida um token emitido por outra (backends stateless).
"""
import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field
from pymongo.errors import DuplicateKeyError

import db

SEGREDO = os.getenv("JWT_SEGREDO", "")
VALIDADE = int(os.getenv("JWT_VALIDADE_MINUTOS", "120"))
ALGORITMO = "HS256"

router = APIRouter(prefix="/api/auth", tags=["autenticação"])
_bearer = HTTPBearer(auto_error=False)


class Registo(BaseModel):
    nome: str = Field(min_length=1, max_length=80)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class Login(BaseModel):
    email: EmailStr
    password: str


def _hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verificar(password: str, password_hash: str) -> bool:
    return bcrypt.checkpw(password.encode(), password_hash.encode())


def _token(utilizador: dict) -> str:
    agora = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(utilizador["_id"]),
            "nome": utilizador["nome"],
            "papel": utilizador.get("papel", "utilizador"),
            "iat": agora,
            "exp": agora + timedelta(minutes=VALIDADE),
        },
        SEGREDO,
        algorithm=ALGORITMO,
    )


@router.post("/registar", status_code=201)
def registar(dados: Registo):
    doc = {
        "nome": dados.nome.strip(),
        "email": dados.email.lower(),
        "password_hash": _hash(dados.password),
        "papel": "utilizador",
        "criado_em": datetime.now(timezone.utc),
    }
    try:
        doc["_id"] = db.utilizadores().insert_one(doc).inserted_id
    except DuplicateKeyError:
        raise HTTPException(409, "Já existe uma conta com esse email")
    return {"token": _token(doc), "nome": doc["nome"]}


@router.post("/login")
def login(dados: Login):
    u = db.utilizadores().find_one({"email": dados.email.lower()})
    # Mesma mensagem nos dois casos para não revelar se o email existe
    if not u or not _verificar(dados.password, u["password_hash"]):
        raise HTTPException(401, "Email ou password incorretos")
    return {"token": _token(u), "nome": u["nome"]}


def utilizador_atual(cred: HTTPAuthorizationCredentials | None = Depends(_bearer)) -> ObjectId:
    """Dependência FastAPI: devolve o _id do utilizador autenticado."""
    if cred is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão em falta")
    try:
        dados = jwt.decode(cred.credentials, SEGREDO, algorithms=[ALGORITMO])
        return ObjectId(dados["sub"])
    except Exception:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Sessão inválida ou expirada")
