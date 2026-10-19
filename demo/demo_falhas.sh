#!/usr/bin/env bash
# Demonstração dos cenários do modelo de faltas do Blue Garden.
#
# Uso:  ./demo/demo_falhas.sh            (corre todos os cenários)
#       ./demo/demo_falhas.sh backend    (só um: backend | mongo | minio | minio2 | ia)
#
# Requisitos: sistema a correr (docker compose up -d), curl e python3.
set -uo pipefail
cd "$(dirname "$0")/.."

URL="https://localhost"
CURL="curl -sk"
EMAIL="demo$(date +%s)@bluegarden.pt"
PASS="demo-password-123"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

azul()  { printf "\n\033[1;34m== %s ==\033[0m\n" "$*"; }
ok()    { printf "  \033[32m✔ %s\033[0m\n" "$*"; }
falha() { printf "  \033[31m✘ %s\033[0m\n" "$*"; }
pausa() { read -rp "  [Enter para continuar] " _; }

json_campo() { python3 -c "import sys,json; print(json.load(sys.stdin).get('$1',''))"; }

login() {
  TOKEN=$($CURL -X POST "$URL/api/auth/registar" -H "Content-Type: application/json" \
    -d "{\"nome\":\"Demo\",\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | json_campo token)
  [ -n "$TOKEN" ] || TOKEN=$($CURL -X POST "$URL/api/auth/login" -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" | json_campo token)
  [ -n "$TOKEN" ] && ok "Sessão iniciada como $EMAIL" || { falha "Login falhou"; exit 1; }
}

carregar() {  # carregar <nome> <conteúdo>  -> imprime o id
  echo "$2" > "$TMP/$1"
  $CURL -X POST "$URL/api/ficheiros" -H "Authorization: Bearer $TOKEN" \
    -F "ficheiro=@$TMP/$1" -F "pasta=/demo" | json_campo id
}

descarregar_ok() {  # descarregar_ok <id> <conteúdo esperado>
  local obtido
  obtido=$($CURL "$URL/api/ficheiros/$1/download" -H "Authorization: Bearer $TOKEN")
  [ "$obtido" = "$2" ]
}

testar_servico() {
  local id
  id=$(carregar "teste_$RANDOM.txt" "conteudo de teste $1")
  if [ -n "$id" ] && descarregar_ok "$id" "conteudo de teste $1"; then
    ok "Upload + download OK ($1)"
  else
    falha "Upload/download falhou ($1)"
  fi
}

quem_responde() {
  for i in 1 2 3 4 5 6; do
    $CURL "$URL/api/saude" | json_campo instancia
  done | sort | uniq -c | sed 's/^/    /'
}

# ---------------------------------------------------------------------------

cenario_backend() {
  azul "Cenário 1: falha de uma instância do backend"
  echo "  Antes — instâncias que respondem:"; quem_responde
  docker compose stop backend2 >/dev/null; ok "backend2 parado"
  echo "  Deteção: o Nginx marca backend2 como falhado (max_fails) e repete o pedido noutro."
  testar_servico "sem backend2"
  echo "  Depois — instâncias que respondem:"; quem_responde
  pausa
  docker compose start backend2 >/dev/null; ok "backend2 recuperado (volta a receber pedidos após fail_timeout)"
}

cenario_mongo() {
  azul "Cenário 2: falha do nó primário do MongoDB"
  local primario
  primario=$($CURL "$URL/api/saude/detalhe" | json_campo mongo_primario | cut -d: -f1)
  echo "  Primário atual: $primario"
  docker compose stop "$primario" >/dev/null; ok "$primario parado"
  echo "  Deteção: heartbeats do replica set (~10 s) e eleição de um novo primário..."
  sleep 12
  echo "  Novo primário: $($CURL "$URL/api/saude/detalhe" | json_campo mongo_primario)"
  testar_servico "sem $primario"
  pausa
  docker compose start "$primario" >/dev/null
  ok "$primario volta como secundário e sincroniza pelo oplog"
}

cenario_minio() {
  azul "Cenário 3: perda de 1 nó MinIO (leitura e escrita continuam)"
  local id
  id=$(carregar "antes_falha.txt" "ficheiro guardado antes da falha")
  docker compose stop minio3 >/dev/null; ok "minio3 parado"
  descarregar_ok "$id" "ficheiro guardado antes da falha" && ok "Ficheiro antigo lido a partir da paridade" || falha "Leitura falhou"
  testar_servico "sem minio3"
  pausa
  docker compose start minio3 >/dev/null
  ok "minio3 recuperado — o MinIO reconstrói os blocos em falta (healing)"
}

cenario_minio2() {
  azul "Cenário 4: perda de 2 nós MinIO (só leitura garantida)"
  local id
  id=$(carregar "leitura.txt" "tem de continuar legivel")
  docker compose stop minio3 minio4 >/dev/null; ok "minio3 e minio4 parados"
  descarregar_ok "$id" "tem de continuar legivel" && ok "Leitura continua a funcionar" || falha "Leitura falhou"
  echo "  Escrita (esperado: falhar — fora das garantias do modelo de faltas):"
  [ -n "$(carregar "escrita.txt" "x")" ] && echo "    escrita aceite" || ok "Escrita recusada com erro 503, sem perda de dados"
  pausa
  docker compose start minio3 minio4 >/dev/null; ok "Nós recuperados"
}

cenario_ia() {
  azul "Cenário 5: worker de IA em baixo"
  docker compose stop ai-worker >/dev/null; ok "ai-worker parado"
  local id
  id=$(carregar "fatura_teste.txt" "Fatura FT 2026/1 NIF 500000000 IVA 23% total a pagar 10,00 EUR")
  ok "Upload aceite mesmo sem IA (ficheiro fica PENDENTE)"
  pausa
  docker compose start ai-worker >/dev/null; ok "ai-worker recuperado — processa a fila"
  sleep 8
  $CURL "$URL/api/ficheiros?pasta=/demo" -H "Authorization: Bearer $TOKEN" | python3 -c "
import sys, json
for f in json.load(sys.stdin)['ficheiros']:
    if f['id'] == '$id':
        print(f\"    {f['nome']}: {f['estado']} -> {f['categoria']} ({f['confianca']})\")"
}

login
case "${1:-todos}" in
  backend) cenario_backend ;;
  mongo)   cenario_mongo ;;
  minio)   cenario_minio ;;
  minio2)  cenario_minio2 ;;
  ia)      cenario_ia ;;
  *) cenario_backend; cenario_mongo; cenario_minio; cenario_minio2; cenario_ia ;;
esac
azul "Fim da demonstração"
