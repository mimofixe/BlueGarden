# Estrutura da base de dados

Base de dados `bluegarden` no MongoDB (replica set `rs0`, 3 nós). Os ficheiros em si não ficam aqui: ficam cifrados no MinIO, e o MongoDB guarda só a chave (`chave_minio`).

## Coleção `utilizadores`

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | ObjectId | |
| `nome` | String | |
| `email` | String | índice único |
| `password_hash` | String | bcrypt, nunca a password |
| `papel` | String | `utilizador` |
| `criado_em` | Date | |
| `pastas` | String[] | pastas vazias criadas pelo utilizador (ex.: `/Universidade`) |
| `tema` | String | `claro` ou `escuro` |
| `foto` | Objeto | `tipo`, `tamanho`, `atualizada_em`; a imagem fica cifrada no MinIO |

## Coleção `ficheiros`

Também funciona como fila do worker de IA (campo `estado`).

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | ObjectId | |
| `utilizador_id` | ObjectId | dono; todas as consultas filtram por este campo |
| `nome` | String | |
| `tamanho` | int | bytes |
| `tipo_mime` | String | |
| `pasta` | String | caminho, ex.: `/Universidade/Sistemas Distribuídos` (as pastas não são uma coleção) |
| `chave_minio` | String | `<utilizador_id>/<uuid>` |
| `estado` | String | `PENDENTE`, `EM_ANALISE` ou `CATEGORIZADO` |
| `categoria` | String | uma das 7 categorias, ou vazio enquanto está na fila |
| `confianca` | float | 0 a 1 (1,0 quando o utilizador corrige) |
| `motivo_ia` | String | regra ou modelo que decidiu |
| `tentativas` | int | tentativas de análise (máximo 3) |
| `em_analise_desde` | Date | para devolver à fila se o worker cair |
| `categorizado_em` | Date | |
| `corrigido` | bool | `true` depois de uma correção; o worker deixa de mexer no ficheiro |
| `apagado` | bool | `true` = está na reciclagem |
| `apagado_em` | Date | |
| `criado_em` | Date | |

Índices: (`utilizador_id`, `apagado`, `pasta`) e (`estado`, `criado_em`).

## Coleção `correcoes`

Cada correção feita pelo utilizador. Serve para voltar a treinar o modelo (`train.py --correcoes`).

| Campo | Tipo | Notas |
| --- | --- | --- |
| `_id` | ObjectId | |
| `utilizador_id` | ObjectId | |
| `ficheiro_id` | ObjectId | índice |
| `categoria_anterior` | String | o que a IA tinha decidido |
| `categoria_nova` | String | o que o utilizador escolheu |
| `criado_em` | Date | |

## Garantias

- As escritas usam `w: majority`: só são confirmadas quando 2 dos 3 nós as têm.
- O upload grava primeiro no MinIO e só depois no MongoDB, para nunca haver metadados a apontar para um ficheiro que não existe.
- A passagem de `PENDENTE` para `EM_ANALISE` é atómica (`find_one_and_update`), por isso cada ficheiro só é analisado por um worker.
