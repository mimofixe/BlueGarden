#!/usr/bin/env bash
# Versão "ao vivo" da demonstração de faltas: desliga os contentores de cada
# cenário e espera, SEM fazer testes automáticos. A ideia é mostrar o efeito
# no browser (https://localhost) enquanto o componente está em baixo.
#
# Uso:  ./demo/falhas_ao_vivo.sh              (todos os cenários, um a seguir ao outro)
#       ./demo/falhas_ao_vivo.sh minio2       (só um: backend | mongo | minio | minio2 | ia)
#       ./demo/falhas_ao_vivo.sh estado       (mostra que contentores estão a correr)
#       ./demo/falhas_ao_vivo.sh restaurar    (volta a ligar tudo, se algo ficou em baixo)
#
# Requisitos: sistema a correr (docker compose up -d).
# Para a versão com testes automáticos, usar ./demo/demo_falhas.sh
set -uo pipefail
cd "$(dirname "$0")/.."

azul()  { printf "\n\033[1;34m== %s ==\033[0m\n" "$*"; }
ok()    { printf "  \033[32m✔ %s\033[0m\n" "$*"; }
aviso() { printf "  \033[33m➜ %s\033[0m\n" "$*"; }
pausa() { read -rp "  [Enter para $1] " _; }

estado() {
  docker compose ps --format "table {{.Service}}\t{{.State}}\t{{.Status}}" 2>/dev/null \
    | sed 's/^/    /'
}

parar()  { docker compose stop "$@" >/dev/null 2>&1; ok "Parado: $*"; }
ligar()  { docker compose start "$@" >/dev/null 2>&1; ok "Ligado: $*"; }

# Pergunta a um nó Mongo que esteja vivo qual é o primário (não testa a aplicação)
primario_mongo() {
  local no p
  for no in mongo1 mongo2 mongo3; do
    p=$(docker compose exec -T "$no" mongosh --quiet --eval "db.hello().primary" 2>/dev/null | tr -d '\r')
    if [ -n "$p" ]; then echo "${p%%:*}"; return; fi
  done
}

# ---------------------------------------------------------------------------

cenario_backend() {
  azul "Cenário 1: falha de uma instância do backend"
  parar backend2
  aviso "No browser: carregar, descarregar e navegar continuam a funcionar."
  aviso "O Nginx tira o backend2 da rotação (max_fails) e usa o backend1 e o backend3."
  pausa "voltar a ligar o backend2"
  ligar backend2
}

cenario_mongo() {
  azul "Cenário 2: falha do nó primário do MongoDB"
  local p
  p=$(primario_mongo)
  if [ -z "$p" ]; then
    aviso "Não consegui descobrir o primário; vou parar o mongo1."
    p=mongo1
  fi
  echo "  Primário atual: $p"
  parar "$p"
  aviso "Durante ~10 s há uma eleição: os pedidos podem demorar ou dar erro."
  aviso "Depois disso, um secundário passa a primário e tudo volta a funcionar."
  pausa "voltar a ligar o $p"
  ligar "$p"
  aviso "O $p volta como secundário e sincroniza pelo oplog."
}

cenario_minio() {
  azul "Cenário 3: perda de 1 nó MinIO"
  parar minio3
  aviso "No browser: descarregar ficheiros antigos e carregar novos continua a funcionar."
  aviso "Ficam 3 de 4 nós: chega para ler (2) e para escrever (3)."
  pausa "voltar a ligar o minio3"
  ligar minio3
  aviso "O MinIO reconstrói os blocos em falta (healing)."
}

cenario_minio2() {
  azul "Cenário 4: perda de 2 nós MinIO"
  parar minio3 minio4
  aviso "No browser: descarregar ainda funciona (2 nós chegam para ler)."
  aviso "Carregar um ficheiro novo FALHA com 503: a escrita precisa de 3 nós."
  aviso "Nenhum ficheiro guardado se perde."
  pausa "voltar a ligar o minio3 e o minio4"
  ligar minio3 minio4
}

cenario_ia() {
  azul "Cenário 5: worker de IA em baixo"
  parar ai-worker
  aviso "No browser: carregar continua a funcionar, mas o ficheiro fica em \"Na fila da IA\"."
  aviso "Carrega agora um ficheiro (ex.: uma fatura) para mostrar que fica pendente."
  pausa "voltar a ligar o worker de IA"
  ligar ai-worker
  aviso "O worker processa a fila: em poucos segundos o ficheiro ganha categoria."
}

case "${1:-todos}" in
  backend)   cenario_backend ;;
  mongo)     cenario_mongo ;;
  minio)     cenario_minio ;;
  minio2)    cenario_minio2 ;;
  ia)        cenario_ia ;;
  estado)    azul "Estado dos contentores"; estado; exit 0 ;;
  restaurar) azul "A voltar a ligar todos os contentores"
             docker compose start >/dev/null 2>&1; ok "Tudo ligado"; estado; exit 0 ;;
  todos)
    cenario_backend; pausa "passar ao cenário seguinte"
    cenario_mongo;   pausa "passar ao cenário seguinte"
    cenario_minio;   pausa "passar ao cenário seguinte"
    cenario_minio2;  pausa "passar ao cenário seguinte"
    cenario_ia ;;
  *) echo "Uso: $0 [backend|mongo|minio|minio2|ia|estado|restaurar]"; exit 1 ;;
esac
azul "Fim da demonstração"
estado
