"""Blue Garden — API (FastAPI).

Corre em 3 instâncias iguais atrás do Nginx. Não guarda estado em memória:
utilizadores e ficheiros vivem no MongoDB/MinIO e a sessão vai no JWT.
"""
import logging
import os
import time

from fastapi import FastAPI
from fastapi.responses import JSONResponse

import auth
import db
import files
import storage

INSTANCIA = os.getenv("INSTANCIA", "local")
logging.basicConfig(level=logging.INFO, format=f"[{INSTANCIA}] %(levelname)s %(message)s")
log = logging.getLogger("bluegarden")

app = FastAPI(title="Blue Garden API", version="0.1.0", docs_url="/api/docs", openapi_url="/api/openapi.json")
app.include_router(auth.router)
app.include_router(files.router)


@app.on_event("startup")
def arranque():
    # Os outros serviços podem ainda estar a arrancar: tentar durante ~60 s
    for tentativa in range(30):
        try:
            db.criar_indices()
            storage.garantir_bucket()
            log.info("Ligado ao MongoDB e ao MinIO")
            return
        except Exception as e:
            log.warning("À espera das dependências (%s/30): %s", tentativa + 1, e)
            time.sleep(2)
    log.error("Dependências indisponíveis; a API arranca na mesma e tenta em cada pedido")


@app.get("/api/saude")
def saude():
    """Usado pelo healthcheck do Docker e pela demo para ver que instância respondeu."""
    return {"estado": "ok", "instancia": INSTANCIA}


@app.get("/api/saude/detalhe")
def saude_detalhe():
    """Estado das dependências vistas por esta instância."""
    resultado = {"instancia": INSTANCIA}
    try:
        hello = db.bd().command("hello")
        resultado["mongo_primario"] = hello.get("primary")
        resultado["mongo_membros"] = hello.get("hosts")
    except Exception as e:
        resultado["mongo_erro"] = str(e)
    try:
        storage.garantir_bucket()
        resultado["minio"] = "ok"
    except Exception as e:
        resultado["minio_erro"] = str(e)
    codigo = 200 if "mongo_erro" not in resultado and "minio_erro" not in resultado else 503
    return JSONResponse(resultado, status_code=codigo)
