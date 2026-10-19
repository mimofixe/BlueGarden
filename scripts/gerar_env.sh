#!/usr/bin/env bash
# Gera o ficheiro .env com segredos aleatórios e o certificado HTTPS autoassinado.
# Uso: ./scripts/gerar_env.sh
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -f .env ]; then
  echo ".env já existe — não foi alterado (apaga-o se quiseres gerar outro)."
else
  aleatorio() { openssl rand -hex "$1"; }
  # Chave Fernet = 32 bytes em base64 url-safe
  fernet=$(openssl rand -base64 32 | tr '+/' '-_')
  sed -e "s/^MINIO_ROOT_PASSWORD=.*/MINIO_ROOT_PASSWORD=$(aleatorio 16)/" \
      -e "s/^JWT_SEGREDO=.*/JWT_SEGREDO=$(aleatorio 32)/" \
      -e "s|^FERNET_CHAVE=.*|FERNET_CHAVE=${fernet}|" \
      .env.example > .env
  echo ".env criado."
fi

mkdir -p nginx/certs
if [ -f nginx/certs/bluegarden.crt ]; then
  echo "Certificado já existe."
else
  openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
    -keyout nginx/certs/bluegarden.key -out nginx/certs/bluegarden.crt \
    -subj "/C=PT/O=Blue Garden/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" 2>/dev/null
  echo "Certificado autoassinado criado em nginx/certs/."
fi
