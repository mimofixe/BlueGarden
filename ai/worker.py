"""Worker de IA: categoriza os ficheiros com estado PENDENTE.

A fila é a própria coleção "ficheiros" no MongoDB:
  PENDENTE -> EM_ANALISE -> CATEGORIZADO

Tolerância a faltas:
- Se o worker estiver em baixo, os uploads continuam; os ficheiros ficam PENDENTE.
- Se o worker morrer a meio, o ficheiro fica EM_ANALISE; ao fim de 5 minutos
  volta a PENDENTE e é processado de novo (ver recuperar_presos).
- A passagem PENDENTE -> EM_ANALISE é atómica (find_one_and_update), por isso
  mesmo com vários workers cada ficheiro só é analisado por um.
"""
import logging
import os
import time
from datetime import datetime, timedelta, timezone

from pymongo import MongoClient, ReturnDocument

import armazenamento
import rules
from classifier import CAMINHO_MODELO, Classificador
from extract import extrair

logging.basicConfig(level=logging.INFO, format="[ia] %(levelname)s %(message)s")
log = logging.getLogger("ia")

LIMIAR = float(os.getenv("LIMIAR_CONFIANCA", "0.6"))
TEMPO_MAX_ANALISE = timedelta(minutes=5)
MAX_TENTATIVAS = 3


def agora():
    return datetime.now(timezone.utc)


def colecao():
    c = MongoClient(os.environ["MONGO_URI"], serverSelectionTimeoutMS=15000, w="majority")
    return c[os.getenv("MONGO_BD", "bluegarden")]["ficheiros"]


def decidir(info: dict, modelo: Classificador) -> tuple[str, float, str]:
    """Combina regras e modelo. Devolve (categoria, confiança, motivo)."""
    regra = rules.aplicar(info)
    if regra and regra[1] >= 0.9:
        return regra  # regra forte ganha sempre

    categoria, conf = modelo.prever(info)
    escolha = (categoria, conf, "modelo TF-IDF + regressão logística")

    if regra and regra[1] > conf:
        escolha = regra
    elif not regra and conf < LIMIAR:
        recurso = rules.recurso_imagem(info)
        if recurso and recurso[1] > conf:
            escolha = recurso

    if escolha[1] < LIMIAR:
        return "Por rever", escolha[1], f"confiança baixa (palpite: {escolha[0]})"
    return escolha


def recuperar_presos(ficheiros):
    limite = agora() - TEMPO_MAX_ANALISE
    r = ficheiros.update_many(
        {"estado": "EM_ANALISE", "em_analise_desde": {"$lt": limite}},
        {"$set": {"estado": "PENDENTE"}},
    )
    if r.modified_count:
        log.warning("%d ficheiro(s) presos em EM_ANALISE voltaram para a fila", r.modified_count)


def proximo(ficheiros):
    return ficheiros.find_one_and_update(
        {"estado": "PENDENTE", "apagado": False, "corrigido": {"$ne": True}},
        {"$set": {"estado": "EM_ANALISE", "em_analise_desde": agora()}, "$inc": {"tentativas": 1}},
        sort=[("criado_em", 1)],
        return_document=ReturnDocument.AFTER,
    )


def processar(ficheiros, f, modelo):
    dados = armazenamento.ler(f["chave_minio"])
    info = extrair(f["nome"], f.get("tipo_mime"), dados)
    categoria, conf, motivo = decidir(info, modelo)
    # Só grava se ainda estiver EM_ANALISE e o utilizador não tiver corrigido entretanto
    ficheiros.update_one(
        {"_id": f["_id"], "estado": "EM_ANALISE", "corrigido": {"$ne": True}},
        {"$set": {
            "estado": "CATEGORIZADO",
            "categoria": categoria,
            "confianca": round(conf, 3),
            "motivo_ia": motivo,
            "categorizado_em": agora(),
        }, "$unset": {"em_analise_desde": ""}},
    )
    log.info("%s -> %s (%.2f) [%s]", f["nome"], categoria, conf, motivo)


def falhou(ficheiros, f, erro):
    if f.get("tentativas", 1) >= MAX_TENTATIVAS:
        alteracao = {"estado": "CATEGORIZADO", "categoria": "Por rever", "confianca": 0.0,
                     "motivo_ia": f"erro na análise: {erro}"[:300]}
    else:
        alteracao = {"estado": "PENDENTE"}
    ficheiros.update_one({"_id": f["_id"]}, {"$set": alteracao})


def main():
    if not os.path.exists(CAMINHO_MODELO):
        log.info("Ainda não há modelo — a treinar com o dataset inicial")
        from train import treinar
        treinar()

    modelo = Classificador()
    ficheiros = None
    ultima_recuperacao = 0.0

    while True:
        try:
            if ficheiros is None:
                ficheiros = colecao()
                log.info("Ligado ao MongoDB; à espera de ficheiros PENDENTE")
            if time.time() - ultima_recuperacao > 30:
                recuperar_presos(ficheiros)
                ultima_recuperacao = time.time()

            f = proximo(ficheiros)
            if not f:
                time.sleep(2)
                continue
            try:
                processar(ficheiros, f, modelo)
            except Exception as e:
                log.error("Falha a analisar %s: %s", f.get("nome"), e)
                falhou(ficheiros, f, e)
        except Exception as e:
            # MongoDB em eleição / rede: espera e tenta outra vez
            log.warning("Sem ligação às dependências: %s", e)
            time.sleep(3)


if __name__ == "__main__":
    main()
