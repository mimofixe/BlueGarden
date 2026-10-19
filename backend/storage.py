"""Armazenamento dos ficheiros no MinIO distribuído, cifrados com Fernet.

O MinIO corre em 4 nós com erasure coding: qualquer nó aceita pedidos e o
cluster aguenta perder 1 nó para escrita e 2 para leitura. O backend conhece
os 4 endereços e, se um não responder, tenta o seguinte.
"""
import io
import os
import random
from functools import lru_cache

from cryptography.fernet import Fernet
from minio import Minio
from minio.error import S3Error

ENDPOINTS = os.getenv("MINIO_ENDPOINTS", "localhost:9000").split(",")
BUCKET = os.getenv("MINIO_BUCKET", "ficheiros")
UTILIZADOR = os.getenv("MINIO_ROOT_USER", "bluegarden")
PASSWORD = os.getenv("MINIO_ROOT_PASSWORD", "")


class ArmazenamentoIndisponivel(Exception):
    pass


@lru_cache
def _fernet() -> Fernet:
    chave = os.getenv("FERNET_CHAVE")
    if not chave:
        raise RuntimeError("FERNET_CHAVE não definida no .env")
    return Fernet(chave.encode())


@lru_cache
def _clientes() -> list[Minio]:
    return [
        Minio(e.strip(), access_key=UTILIZADOR, secret_key=PASSWORD, secure=False)
        for e in ENDPOINTS
    ]


def _com_failover(operacao):
    """Executa a operação no primeiro nó MinIO que responder."""
    clientes = _clientes()[:]
    random.shuffle(clientes)  # espalha a carga pelos nós
    ultimo_erro = None
    for c in clientes:
        try:
            return operacao(c)
        except S3Error:
            raise  # erro do próprio pedido (ex.: objeto não existe), não do nó
        except Exception as e:  # nó em baixo / rede
            ultimo_erro = e
    raise ArmazenamentoIndisponivel(str(ultimo_erro))


def garantir_bucket() -> None:
    def op(c: Minio):
        if not c.bucket_exists(BUCKET):
            c.make_bucket(BUCKET)
    _com_failover(op)


def cifrar(dados: bytes) -> bytes:
    return _fernet().encrypt(dados)


def decifrar(dados: bytes) -> bytes:
    return _fernet().decrypt(dados)


def guardar(chave: str, dados: bytes) -> None:
    cifrado = cifrar(dados)

    def op(c: Minio):
        c.put_object(BUCKET, chave, io.BytesIO(cifrado), len(cifrado),
                     content_type="application/octet-stream")
    _com_failover(op)


def ler(chave: str) -> bytes:
    def op(c: Minio):
        r = c.get_object(BUCKET, chave)
        try:
            return r.read()
        finally:
            r.close()
            r.release_conn()
    return decifrar(_com_failover(op))


def apagar(chave: str) -> None:
    _com_failover(lambda c: c.remove_object(BUCKET, chave))
