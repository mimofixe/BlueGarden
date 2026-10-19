"""Ligação ao MongoDB (replica set rs0).

O driver descobre sozinho qual é o primário. Se o primário cair, o replica set
elege outro em ~10 s e o driver volta a encaminhar as escritas (retryWrites).
"""
import os
from functools import lru_cache

from pymongo import ASCENDING, MongoClient
from pymongo.write_concern import WriteConcern

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/?replicaSet=rs0")
NOME_BD = os.getenv("MONGO_BD", "bluegarden")


@lru_cache
def cliente() -> MongoClient:
    return MongoClient(
        MONGO_URI,
        serverSelectionTimeoutMS=15000,  # tempo para aguentar uma eleição
        retryWrites=True,
        retryReads=True,
        # w=majority: a escrita só é confirmada quando 2 dos 3 nós a têm,
        # por isso não se perde se o primário cair logo a seguir.
        w="majority",
    )


def bd():
    return cliente()[NOME_BD]


def utilizadores():
    return bd()["utilizadores"]


def ficheiros():
    return bd()["ficheiros"]


def correcoes():
    return bd()["correcoes"]


def criar_indices() -> None:
    """Idempotente — pode correr em todos os backends ao arrancar."""
    utilizadores().create_index("email", unique=True)
    ficheiros().create_index(
        [("utilizador_id", ASCENDING), ("apagado", ASCENDING), ("pasta", ASCENDING)]
    )
    ficheiros().create_index([("estado", ASCENDING), ("criado_em", ASCENDING)])
    correcoes().create_index("ficheiro_id")
