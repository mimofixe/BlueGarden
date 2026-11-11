# API do backend

Todas as rotas começam por `/api` e passam pelo Nginx (HTTPS). Com a aplicação a correr, a documentação interativa está em `https://localhost/api/docs`. Todas as rotas, exceto registo, login, categorias e saúde, precisam do cabeçalho `Authorization: Bearer <JWT>`.

| Método | Rota | O que faz |
| --- | --- | --- |
| POST | `/api/auth/registar` | Cria conta (nome, email, password) e devolve o JWT |
| POST | `/api/auth/login` | Inicia sessão e devolve o JWT |
| GET | `/api/ficheiros?pasta=&categoria=&q=` | Lista uma pasta; com `categoria` ou `q` procura em todas as pastas |
| POST | `/api/pastas` | Cria uma pasta |
| POST | `/api/ficheiros` | Upload (multipart): cifra, guarda no MinIO e põe na fila da IA |
| GET | `/api/ficheiros/{id}/download` | Download (decifrado no backend) |
| PATCH | `/api/ficheiros/{id}` | Muda o nome ou a pasta de um ficheiro |
| DELETE | `/api/ficheiros/{id}` | Manda para a reciclagem |
| GET | `/api/reciclagem` | Lista a reciclagem |
| POST | `/api/ficheiros/{id}/restaurar` | Recupera da reciclagem |
| DELETE | `/api/ficheiros/{id}/definitivo` | Elimina de vez (MinIO e MongoDB) |
| GET | `/api/categorias` | Lista as 7 categorias |
| GET | `/api/resumo` | Quantos ficheiros há em cada categoria |
| PUT | `/api/ficheiros/{id}/categoria` | Corrige a categoria e guarda a correção |
| GET | `/api/perfil` | Nome, email, tema e foto |
| PUT | `/api/perfil/preferencias` | Guarda o tema (claro ou escuro) |
| PUT / GET / DELETE | `/api/perfil/foto` | Foto de perfil (cifrada como os ficheiros) |
| GET | `/api/saude` | Diz que instância do backend respondeu (usado na demo) |
| GET | `/api/saude/detalhe` | Estado do MongoDB (primário e membros) e do MinIO visto por essa instância |
