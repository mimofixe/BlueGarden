"""Treino do classificador.

Fontes de dados (juntam-se todas):
  1. ai/dataset/sementes.csv            — exemplos iniciais escritos à mão
  2. ai/dataset/<Categoria>/<ficheiros> — ficheiros reais do grupo, anonimizados
  3. coleção "correcoes" do MongoDB     — correções feitas pelos utilizadores (--correcoes)

Uso:
  python train.py                 # sementes + pasta dataset
  python train.py --correcoes     # inclui as correções dos utilizadores
  python train.py --avaliar       # mostra validação cruzada antes de gravar
"""
import argparse
import csv
import os
import sys
import tempfile
from collections import Counter

import joblib

from classifier import CAMINHO_MODELO, novo_pipeline, preparar_texto
from extract import extrair

PASTA_DATASET = os.path.join(os.path.dirname(__file__), "dataset")
CATEGORIAS = ["Académico", "Fotografias", "Capturas de ecrã", "Código", "Faturas e finanças", "Documentos pessoais"]


def carregar_sementes():
    X, y = [], []
    with open(os.path.join(PASTA_DATASET, "sementes.csv"), encoding="utf-8") as f:
        for linha in csv.DictReader(f, delimiter=";"):
            ext = os.path.splitext(linha["nome"])[1].lower()
            X.append(preparar_texto(linha["nome"], ext, linha["texto"] or ""))
            y.append(linha["categoria"])
    return X, y


def carregar_pastas():
    X, y = [], []
    for categoria in CATEGORIAS:
        pasta = os.path.join(PASTA_DATASET, categoria)
        if not os.path.isdir(pasta):
            continue
        for nome in os.listdir(pasta):
            caminho = os.path.join(pasta, nome)
            if os.path.isfile(caminho):
                with open(caminho, "rb") as f:
                    info = extrair(nome, None, f.read())
                X.append(preparar_texto(info["nome"], info["extensao"], info["texto"]))
                y.append(categoria)
    return X, y


def carregar_correcoes():
    """Usa a última correção de cada ficheiro (descarrega e decifra o ficheiro)."""
    import armazenamento
    from pymongo import MongoClient

    bd = MongoClient(os.environ["MONGO_URI"])[os.getenv("MONGO_BD", "bluegarden")]
    ultima = {}
    for c in bd.correcoes.find().sort("criado_em", 1):
        ultima[c["ficheiro_id"]] = c["categoria_nova"]

    X, y = [], []
    for fid, categoria in ultima.items():
        if categoria == "Por rever":
            continue
        f = bd.ficheiros.find_one({"_id": fid})
        if not f:
            continue
        try:
            info = extrair(f["nome"], f.get("tipo_mime"), armazenamento.ler(f["chave_minio"]))
        except Exception as e:
            print(f"  aviso: não consegui ler {f['nome']}: {e}")
            continue
        X.append(preparar_texto(info["nome"], info["extensao"], info["texto"]))
        y.append(categoria)
    return X, y


def treinar(com_correcoes=False, avaliar=False, algoritmo="logreg", destino=CAMINHO_MODELO):
    X, y = carregar_sementes()
    fontes = {"sementes": len(X)}
    Xp, yp = carregar_pastas()
    X += Xp; y += yp; fontes["pastas"] = len(Xp)
    if com_correcoes:
        Xc, yc = carregar_correcoes()
        X += Xc; y += yc; fontes["correcoes"] = len(Xc)

    print(f"Exemplos: {len(X)} {fontes}")
    print("Por categoria:", dict(Counter(y)))

    modelo = novo_pipeline(algoritmo)

    if avaliar:
        from sklearn.model_selection import cross_val_predict, StratifiedKFold
        from sklearn.metrics import classification_report
        k = min(5, min(Counter(y).values()))
        if k >= 2:
            prev = cross_val_predict(modelo, X, y, cv=StratifiedKFold(k, shuffle=True, random_state=1))
            print(classification_report(y, prev, zero_division=0))

    modelo.fit(X, y)
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    # Gravar num ficheiro temporário e mudar o nome: o worker nunca lê um modelo a meio
    fd, tmp = tempfile.mkstemp(dir=os.path.dirname(destino), suffix=".tmp")
    os.close(fd)
    joblib.dump(modelo, tmp)
    os.replace(tmp, destino)
    print(f"Modelo gravado em {destino}")


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--correcoes", action="store_true")
    p.add_argument("--avaliar", action="store_true")
    p.add_argument("--algoritmo", choices=["logreg", "nb"], default="logreg")
    a = p.parse_args()
    treinar(a.correcoes, a.avaliar, a.algoritmo)
    sys.exit(0)
