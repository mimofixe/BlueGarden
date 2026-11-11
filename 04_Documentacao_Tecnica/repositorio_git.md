# Repositório Git

**GitHub:** https://github.com/mimofixe/BlueGarden

| Ramo | Conteúdo |
| --- | --- |
| `codigo` | Protótipo: backend, frontend, worker de IA, Docker Compose e script de demonstração de falhas |
| `main` | Este arquivo documental |

## Estrutura do ramo `codigo`

| Pasta | Conteúdo |
| --- | --- |
| `backend/` | API FastAPI: contas, ficheiros, pastas, reciclagem, correções e perfil |
| `frontend/` | Páginas web (HTML, CSS e JavaScript) |
| `ai/` | Worker de IA: extração, regras, classificador, treino e dados (`ai/dataset/sementes.csv`) |
| `nginx/` | Configuração do Nginx (HTTPS e balanceamento) |
| `mongo/` | Script que inicia o replica set |
| `scripts/` | `gerar_env.sh`: cria o `.env` com segredos aleatórios e o certificado |
| `demo/` | `demo_falhas.sh`: cenários do modelo de faltas |

## Como correr

Requisitos: Docker Desktop e Git Bash (Windows) ou um terminal (Linux/macOS).

```bash
git clone -b codigo https://github.com/mimofixe/BlueGarden.git
cd BlueGarden
MSYS_NO_PATHCONV=1 ./scripts/gerar_env.sh   # só da primeira vez
docker compose up -d --build
```

A aplicação fica em https://localhost (o certificado é autoassinado, por isso o browser mostra um aviso).

## Comandos úteis

| Para quê | Comando |
| --- | --- |
| Ver o estado dos contentores | `docker compose ps` |
| Demonstrar os cenários de falha | `./demo/demo_falhas.sh` |
| Treinar a IA com as correções | `docker compose exec ai-worker python train.py --correcoes --avaliar --algoritmo nb` |
| Atualizar depois de um `git pull` | `docker compose up -d --build` |
