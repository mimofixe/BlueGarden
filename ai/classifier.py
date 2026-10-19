"""Modelo de Machine Learning: TF-IDF + Regressão Logística (scikit-learn).

Entrada do modelo = nome do ficheiro + extensão + conteúdo extraído.
Saída = categoria + probabilidade (usada como confiança).
"""
import os
import re

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import Pipeline

PASTA_MODELO = os.getenv("PASTA_MODELO", os.path.join(os.path.dirname(__file__), "modelo"))
CAMINHO_MODELO = os.path.join(PASTA_MODELO, "modelo.joblib")


def preparar_texto(nome: str, extensao: str, texto: str) -> str:
    """Junta o nome (separado em palavras), a extensão e o conteúdo num só texto."""
    palavras_nome = " ".join(re.split(r"[\s_\-.()\[\]]+", os.path.splitext(nome)[0]))
    marca_ext = f"ext_{extensao.lstrip('.')}" if extensao else "ext_nenhuma"
    # O nome e a extensão repetem-se para pesarem mais que uma palavra solta do texto
    return f"{palavras_nome} {palavras_nome} {marca_ext} {marca_ext} {texto}"


def novo_pipeline(algoritmo: str = "logreg") -> Pipeline:
    if algoritmo == "nb":
        clf = ComplementNB(alpha=0.3)
    else:
        clf = LogisticRegression(max_iter=2000, C=5.0, class_weight="balanced")
    return Pipeline([
        ("tfidf", TfidfVectorizer(
            lowercase=True,
            strip_accents="unicode",
            ngram_range=(1, 2),
            sublinear_tf=True,
            min_df=1,
            max_features=50000,
        )),
        ("clf", clf),
    ])


class Classificador:
    """Carrega o modelo do disco e recarrega-o sozinho quando é retreinado."""

    def __init__(self, caminho: str = CAMINHO_MODELO):
        self.caminho = caminho
        self._modelo = None
        self._mtime = None

    def _carregar_se_mudou(self):
        mtime = os.path.getmtime(self.caminho)
        if mtime != self._mtime:
            self._modelo = joblib.load(self.caminho)
            self._mtime = mtime

    def prever(self, info: dict) -> tuple[str, float]:
        self._carregar_se_mudou()
        x = preparar_texto(info["nome"], info["extensao"], info["texto"])
        probs = self._modelo.predict_proba([x])[0]
        i = probs.argmax()
        return self._modelo.classes_[i], float(probs[i])
