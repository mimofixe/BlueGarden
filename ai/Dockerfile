FROM python:3.12-slim
# Tesseract para OCR de imagens com texto (português e inglês)
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-por tesseract-ocr-eng \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN useradd -m app && mkdir -p /app/modelo && chown -R app /app
USER app
CMD ["python", "-u", "worker.py"]
