"""Regras determinísticas — tratam os casos óbvios antes do modelo.

Cada regra devolve (categoria, confiança, motivo) ou None.
O motivo fica guardado no MongoDB para explicar a decisão ao utilizador.
"""
import re
import unicodedata

EXT_CODIGO = {
    ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".c", ".h", ".cpp", ".hpp", ".cs",
    ".go", ".rs", ".rb", ".php", ".kt", ".swift", ".sql", ".sh", ".bat", ".ps1",
    ".css", ".scss", ".ipynb", ".yml", ".yaml", ".toml", ".gradle", ".r", ".m",
}

PADROES_CAPTURA = re.compile(
    r"(captura de ecr[aã]|captura de pantalla|screenshot|screen shot|screen_shot|"
    r"ecr[aã]_|snip|^scr_|^ss_)",
    re.IGNORECASE,
)

# Resoluções típicas de ecrãs (computador e telemóvel), em qualquer orientação
RESOLUCOES_ECRA = {
    (1920, 1080), (2560, 1440), (1366, 768), (1440, 900), (1536, 864), (2880, 1800),
    (3024, 1964), (3456, 2234), (1280, 720), (1170, 2532), (1179, 2556), (1290, 2796),
    (1080, 2400), (1080, 2340), (1080, 1920), (1440, 3200), (750, 1334), (828, 1792),
}


def _sem_acentos(t: str) -> str:
    return unicodedata.normalize("NFKD", t).encode("ascii", "ignore").decode().lower()


def regra_codigo(info):
    if info["extensao"] in EXT_CODIGO:
        return "Código", 0.97, f"extensão {info['extensao']}"
    return None


def regra_captura(info):
    if not info["e_imagem"]:
        return None
    if PADROES_CAPTURA.search(info["nome"]):
        return "Capturas de ecrã", 0.95, "nome típico de captura de ecrã"
    dims = (info.get("largura"), info.get("altura"))
    if info["extensao"] == ".png" and not info["exif"].get("Make") and (
        dims in RESOLUCOES_ECRA or dims[::-1] in RESOLUCOES_ECRA
    ):
        return "Capturas de ecrã", 0.8, f"PNG sem câmara com resolução de ecrã {dims[0]}x{dims[1]}"
    return None


def regra_fotografia(info):
    if not info["e_imagem"]:
        return None
    exif = info["exif"]
    if exif.get("Make") or exif.get("Model"):
        camara = f"{exif.get('Make', '')} {exif.get('Model', '')}".strip()
        return "Fotografias", 0.92, f"EXIF de câmara ({camara})"
    if re.match(r"^(img|dsc|pxl|photo|foto|wp)[_-]?\d", info["nome"], re.IGNORECASE):
        return "Fotografias", 0.8, "nome típico de câmara"
    return None


def regra_fatura(info):
    t = _sem_acentos(info["texto"])
    if not t:
        return None
    sinais = sum(bool(re.search(p, t)) for p in (
        r"\bfatura\b|\bfactura\b|\binvoice\b|\brecibo\b",
        r"\bnif\b|\bnipc\b|contribuinte|\bvat\b",
        r"\biva\b|\btax\b",
        r"total a pagar|total \(eur\)|\btotal\b.{0,20}\d+[.,]\d{2}",
        r"\batcud\b|codigo qr|\bseries?\b.{0,10}\bft\b",
        r"\biban\b|extrato|\bsaldo\b|movimentos|\birs\b|autoridade tributaria|\btaeg\b|prestacao",
    ))
    if sinais >= 3:
        return "Faturas e finanças", 0.9, f"{sinais} indicadores financeiros no texto"
    return None


REGRAS = [regra_codigo, regra_captura, regra_fotografia, regra_fatura]


def aplicar(info: dict):
    """Devolve a primeira regra que dispara, ou None."""
    for regra in REGRAS:
        r = regra(info)
        if r:
            return r
    return None


def recurso_imagem(info: dict):
    """Imagem sem EXIF nem texto útil: palpite fraco pela extensão."""
    if info["e_imagem"] and len(info["texto"].strip()) < 20:
        if info["extensao"] == ".png":
            return "Capturas de ecrã", 0.6, "PNG sem metadados de câmara"
        return "Fotografias", 0.6, "imagem sem texto"
    return None
