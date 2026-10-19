"""Extração de metadados e conteúdo de um ficheiro, para as regras e o modelo."""
import io
import os
import re

MAX_TEXTO = 20000  # caracteres — chega para classificar e mantém o worker rápido

EXT_TEXTO = {".txt", ".md", ".csv", ".json", ".xml", ".html", ".htm", ".log", ".tex"}
EXT_IMAGEM = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp", ".tif", ".tiff", ".heic"}


def _texto_pdf(dados: bytes) -> str:
    from pypdf import PdfReader
    leitor = PdfReader(io.BytesIO(dados))
    partes = []
    for pagina in leitor.pages[:5]:
        partes.append(pagina.extract_text() or "")
    return "\n".join(partes)


def _texto_docx(dados: bytes) -> str:
    import docx
    d = docx.Document(io.BytesIO(dados))
    return "\n".join(p.text for p in d.paragraphs)


def _info_imagem(dados: bytes) -> dict:
    from PIL import Image, ExifTags
    img = Image.open(io.BytesIO(dados))
    info = {"largura": img.width, "altura": img.height, "exif": {}}
    try:
        exif = img.getexif()
        nomes = {v: k for k, v in ExifTags.TAGS.items()}
        for campo in ("Make", "Model", "DateTime", "Software"):
            valor = exif.get(nomes[campo])
            if valor:
                info["exif"][campo] = str(valor).strip("\x00 ")
    except Exception:
        pass
    # OCR (opcional): só se o tesseract estiver instalado
    try:
        import pytesseract
        img.thumbnail((2000, 2000))
        info["texto"] = pytesseract.image_to_string(img.convert("L"), lang="por+eng", timeout=20)
    except Exception:
        info["texto"] = ""
    return info


def extrair(nome: str, tipo_mime: str | None, dados: bytes) -> dict:
    extensao = os.path.splitext(nome)[1].lower()
    info = {
        "nome": nome,
        "extensao": extensao,
        "tipo_mime": tipo_mime or "",
        "tamanho": len(dados),
        "texto": "",
        "exif": {},
        "e_imagem": extensao in EXT_IMAGEM or (tipo_mime or "").startswith("image/"),
    }
    try:
        if extensao == ".pdf":
            info["texto"] = _texto_pdf(dados)
        elif extensao == ".docx":
            info["texto"] = _texto_docx(dados)
        elif info["e_imagem"]:
            info.update(_info_imagem(dados))
        else:
            # Texto simples e código: tentar decodificar como UTF-8
            amostra = dados[:MAX_TEXTO * 2]
            if b"\x00" not in amostra[:4096]:
                info["texto"] = amostra.decode("utf-8", errors="ignore")
    except Exception as e:
        info["erro_extracao"] = str(e)

    info["texto"] = re.sub(r"\s+", " ", info.get("texto") or "")[:MAX_TEXTO]
    return info
