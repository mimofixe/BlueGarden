"""Leitura dos ficheiros cifrados no MinIO (versão mínima do backend/storage.py)."""
import os
import random
from functools import lru_cache

from cryptography.fernet import Fernet
from minio import Minio
from minio.error import S3Error

ENDPOINTS = os.getenv("MINIO_ENDPOINTS", "localhost:9000").split(",")
BUCKET = os.getenv("MINIO_BUCKET", "ficheiros")


@lru_cache
def _clientes():
    return [
        Minio(e.strip(), access_key=os.getenv("MINIO_ROOT_USER", ""),
              secret_key=os.getenv("MINIO_ROOT_PASSWORD", ""), secure=False)
        for e in ENDPOINTS
    ]


def ler(chave: str) -> bytes:
    clientes = _clientes()[:]
    random.shuffle(clientes)
    ultimo = None
    for c in clientes:
        try:
            r = c.get_object(BUCKET, chave)
            try:
                cifrado = r.read()
            finally:
                r.close()
                r.release_conn()
            return Fernet(os.environ["FERNET_CHAVE"].encode()).decrypt(cifrado)
        except S3Error:
            raise
        except Exception as e:
            ultimo = e
    raise ConnectionError(f"MinIO indisponível: {ultimo}")
