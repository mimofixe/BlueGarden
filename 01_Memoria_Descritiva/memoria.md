# Memória Descritiva

# Blue Garden

**Repositório de Ficheiros Distribuído On-Line**

1.ª entrega

---

Francisco Lourinho - 202301001
David Bação - 20230331
Lucas Nicolau - 20241526

---

**Grupo 3**

Projeto de Desenvolvimento de Software · Licenciatura em Engenharia Informática
3.º ano · 5.º semestre · 2026/2027 · IADE - Universidade Europeia
Docente: Rui Pascoal
Outubro de 2026

---

## Resumo

O Blue Garden é um repositório de ficheiros on-line, semelhante ao Google Drive, que guarda os ficheiros de forma distribuída e os organiza automaticamente por categoria com Inteligência Artificial. Corresponde ao Trabalho 3 do briefing e junta as unidades curriculares do 5.º semestre: Engenharia de Software, Sistemas Distribuídos, Inteligência Artificial, Segurança Informática e Projeto de Desenvolvimento de Software.

A ideia partiu de uma necessidade do grupo. Acumulamos PDFs das aulas, trabalhos, faturas, fotografias e capturas de ecrã, tudo no mesmo sítio e com nomes que não dizem nada. Os serviços que existem guardam bem os ficheiros, mas a organização continua a ser feita à mão e a maioria das pessoas acaba por desistir.

No Blue Garden, o utilizador carrega os ficheiros e encontra-os já arrumados em sete categorias: Académico, Faturas e finanças, Documentos pessoais, Fotografias, Capturas de ecrã, Código e Por rever. Cada decisão tem um grau de confiança e, quando é baixo, o ficheiro vai para «Por rever». O utilizador pode sempre corrigir a categoria.

A IA usa regras simples para fotografias, capturas de ecrã e código, e um classificador (TF-IDF com Regressão Logística, comparada com Naive Bayes) para os documentos. As correções do utilizador ficam guardadas para melhorar o modelo. Toda a análise é feita nos nossos servidores, sem serviços externos.

O sistema foi pensado para continuar a funcionar quando um componente falha. Um Nginx distribui os pedidos por três backends em Python (FastAPI), os metadados ficam num replica set de MongoDB com três nós e os ficheiros, cifrados, num cluster MinIO com quatro nós. Tudo corre em Docker.

Nesta primeira fase definimos o problema, os requisitos, os diagramas UML, os mockups, a arquitetura, o modelo de faltas, a componente de IA e a segurança. As próximas fases são dedicadas à implementação, aos testes de falhas e à versão final.

---

## 1. Contexto / Introdução

### 1.1. Problema abordado

Os ficheiros acumulam-se sem ordem, com nomes como «Documento1.docx» ou «trabalho final v3 (2).pdf». A extensão também não ajuda: um PDF tanto pode ser uma fatura como uns apontamentos.

Organizar à mão demora e acaba por ser abandonado. Além disso, um serviço de armazenamento tem de estar sempre disponível e não pode perder ficheiros quando uma parte do sistema falha.

### 1.2. Motivação

Todos no grupo já perdemos tempo à procura de um ficheiro que sabíamos que existia. O Google Drive, o Dropbox e o OneDrive guardam bem os ficheiros, mas nenhum arruma os documentos pelo conteúdo.

**Público-alvo:** estudantes do ensino superior (18 a 27 anos) e adultos que precisam de manter faturas e documentos pessoais organizados, sem tempo para os arrumar à mão.

### 1.3. Objetivos

- Guardar, organizar e pesquisar ficheiros on-line, com reciclagem.
- Categorizar cada ficheiro automaticamente, com um grau de confiança.
- Continuar a funcionar se falhar um backend, um nó de armazenamento ou um nó da base de dados.
- Proteger os dados com HTTPS, hash nas passwords e ficheiros cifrados.

---

## 2. Processo

### 2.1. Metodologia utilizada

Metodologia ágil, com sprints de uma semana, um quadro de tarefas (a fazer, em curso, feito) e uma reunião semanal curta. O código fica no GitHub e passa por pull request antes de entrar no projeto.

- **Fase 1** (entrega a 11/10/2026): requisitos, UML, mockups, arquitetura e modelo de faltas.
- **Fase 2** (entrega a 15/11/2026): infraestrutura, funcionalidades base e primeira versão do classificador.
- **Fase 3** (entrega a 20/12/2026): integração, testes de falhas e versão final.

### 2.2. Ferramentas utilizadas

- **GitHub:** controlo de versões e pull requests.
- **Quadro de tarefas:** organização dos sprints.
- **Chat de grupo:** comunicação do dia a dia.
- **Docker Compose:** arranque de todos os serviços com um só comando.
- **Ferramentas de diagramas e mockups:** UML, arquitetura e interfaces.

### 2.3. Tecnologias utilizadas

- **Frontend:** HTML e JavaScript.
- **Nginx:** HTTPS e distribuição dos pedidos.
- **Backend:** Python com FastAPI (três instâncias).
- **MongoDB:** replica set de três nós para os metadados e a fila da IA.
- **MinIO:** quatro nós com erasure coding para os ficheiros.
- **IA:** scikit-learn (TF-IDF, Regressão Logística e Naive Bayes).
- **Segurança:** Fernet (AES), bcrypt e JWT.

### 2.4. Estrutura da equipa

Três elementos: Francisco Lourinho, David Bação e Lucas Nicolau. As tarefas são distribuídas em cada sprint e o código de cada um é revisto por outro elemento.

---

## 3. Resultados

### 3.1. Descrição da solução desenvolvida

O utilizador entra no site, carrega os ficheiros e encontra-os já arrumados por categoria (Figura 7).

Os pedidos passam pelo Nginx, que os distribui por três backends stateless. Os metadados ficam no MongoDB (três nós) e os ficheiros, cifrados, no MinIO (quatro nós). Assim, a falha de um componente não faz perder ficheiros (Figura 1).

Cada ficheiro novo entra numa fila. O worker de IA aplica as regras ou o classificador e guarda a categoria com o grau de confiança. Abaixo de 0,6, o ficheiro vai para «Por rever». Como corre em segundo plano, o upload não fica à espera da IA.

### 3.2. Funcionalidades principais

- Conta e login.
- Upload e download de ficheiros.
- Pastas: criar, renomear, apagar e mover ficheiros.
- Reciclagem com recuperação.
- Pesquisa por nome.
- Categoria automática com grau de confiança.
- Correção manual e filtro por categoria.

Lista completa de requisitos nos Anexos A e B.

### 3.3. Contributos relevantes

- Organização pelo conteúdo, sem o utilizador criar regras ou pastas.
- Armazenamento tolerante a faltas, com ficheiros cifrados e análise feita nos nossos servidores.
- Uma IA honesta: quando não tem certeza, diz isso em vez de arrumar mal o ficheiro.

---

## 4. Reflexão / Conclusões

### 4.1. Lições aprendidas

- Pensar no modelo de faltas cedo mudou o desenho, por exemplo ao pôr a fila da IA na base de dados.
- Nem tudo precisa de machine learning: regras simples resolvem fotografias, capturas e código.
- A segurança tem custos: cifrar afeta o desempenho e obriga a cuidar bem da chave.

### 4.2. Limitações

- O Nginx é um ponto único de falha.
- Só consideramos falhas por paragem (crash).
- Há uma só chave de cifra: se se perder, os ficheiros ficam ilegíveis.
- O dataset é pequeno e feito pelo grupo.
- Ficheiros sem texto nem metadados são difíceis de classificar.

### 4.3. Trabalho futuro

Na próxima fase vamos implementar a infraestrutura, as funcionalidades base e o primeiro classificador. Mais à frente, queremos:

- Dois Nginx com keepalived, para eliminar o ponto único de falha.
- Várias categorias por ficheiro.
- Deteção de ficheiros duplicados.
- Partilha de ficheiros entre utilizadores.

---

## 5. Imagens

Conceitos, modelação e mockups produzidos na primeira fase.

### Figura 1. Arquitetura distribuída do Blue Garden

*Todos os serviços correm em contentores Docker (Docker Compose). Linhas tracejadas = replicação entre nós.*

- **Cliente web** (browser · HTML + JavaScript) → HTTPS → **Nginx** (load balancer, único ponto de falha assumido).
- O Nginx distribui os pedidos por **Backend 1**, **Backend 2** e **Backend 3** (Python · FastAPI, stateless). Existe também um **Worker de IA** (scikit-learn · lê a fila na BD).
- **MongoDB - replica set rs0** (metadados + fila): mongo1 (primário), mongo2 (secundário), mongo3 (secundário). Guarda os metadados e a fila da IA. Se o primário cair, os outros 2 elegem um novo primário.
- **MinIO - modo distribuído com erasure coding** (ficheiros cifrados): minio1, minio2, minio3, minio4. Os ficheiros são cifrados no backend (Fernet) antes de chegarem ao MinIO. Aguenta perder 1 nó na escrita e 2 na leitura.

### Figura 2. Diagrama de casos de uso

*Linha contínua = associação ator–caso de uso · seta tracejada = «include».*

Sistema Blue Garden:

- **Utilizador:** Registar / iniciar sessão; Carregar ficheiro; Descarregar ficheiro; Criar e organizar pastas; Consultar / pesquisar ficheiros; Apagar ficheiro; Recuperar ficheiro apagado; Corrigir categoria.
- **Carregar ficheiro** «include» **Categorizar ficheiro (IA)** (ator: Worker de IA «sistema») e «include» **Cifrar e guardar com redundância**.
- **Administrador:** Gerir utilizadores; Monitorizar estado dos nós; Treinar modelo de IA.

### Figura 3. Diagrama de classes (estrutura dos dados no MongoDB)

*Modelo de dados guardado no MongoDB (cada classe de domínio é uma coleção). Linha contínua = associação · seta tracejada = dependência.*

**Utilizador**
- `_id: ObjectId`, `nome: String`, `email: String`, `password_hash: String`, `papel: String`, `criado_em: DateTime`
- `registar()`, `iniciarSessao(): JWT`

**Ficheiro**
- `_id: ObjectId`, `nome: String`, `tamanho: int`, `tipo_mime: String`, `pasta: String`, `chave_minio: String`, `estado: EstadoFicheiro`, `categoria: Categoria [0..1]`, `confianca: float [0..1]`, `apagado: bool`, `apagado_em: DateTime [0..1]`, `criado_em: DateTime`
- `carregar()`, `descarregar(): bytes`, `apagar()`, `recuperar()`

**Correcao**
- `_id: ObjectId`, `categoria_anterior: Categoria`, `categoria_nova: Categoria`, `criado_em: DateTime`

**WorkerIA** «serviço» (classifica Ficheiro)
- `limiar_confianca: float = 0.6`
- `procurarPendentes(): Ficheiro[*]`, `extrairTexto(f): String`, `aplicarRegras(f): Categoria`, `classificar(texto): Categoria`

**Categoria** «enumeration»: ACADEMICO, FOTOGRAFIAS, CAPTURAS_DE_ECRA, CODIGO, FATURAS, DOCUMENTOS_PESSOAIS, POR_REVER

**EstadoFicheiro** «enumeration»: PENDENTE, EM_ANALISE, CATEGORIZADO

**Relações:** Utilizador 1 — 0..* Ficheiro («é dono de»); Ficheiro 1 — 0..* Correcao («recebe»); Utilizador 1 — 0..* Correcao («faz»).

*Nota: as pastas não são uma coleção: cada ficheiro guarda o caminho no atributo `pasta`. Os ficheiros em si ficam no MinIO (`chave_minio`).*

### Figura 4. Diagrama de sequência do carregamento de um ficheiro

*Seta a cheio = pedido · seta tracejada = resposta. A categorização é assíncrona: o utilizador não espera pela IA.*

Participantes: Utilizador, Frontend (browser), Nginx, Backend (FastAPI), MinIO, MongoDB, Worker de IA.

1. Utilizador escolhe ficheiro (Frontend).
2. Frontend → Nginx: `POST /ficheiros + JWT`.
3. Nginx → Backend: encaminha pedido.
4. Backend: valida JWT; cifra com Fernet.
5. Backend → MinIO: `put_object (cifrado)`; MinIO responde OK.
6. Backend → MongoDB: insere metadados (estado: "pendente"); MongoDB devolve o `_id` do ficheiro.
7. Backend → Nginx → Frontend: `201 Created`; o Frontend mostra «IA a analisar...».

*Mais tarde, em segundo plano* (loop a cada X s):

1. Worker de IA → MongoDB: procura pendentes; recebe ficheiro pendente.
2. Worker de IA → MinIO: `get_object(chave_minio)`; recebe dados cifrados.
3. Worker de IA: decifra, extrai texto, aplica regras + modelo.
4. Worker de IA → MongoDB: grava categoria e confiança (< 0.6 → Por rever).

### Figura 5. Modelo de faltas

*Pressupostos: só consideramos falhas por paragem (crash), sem nós maliciosos. Falhas simultâneas suportadas: 1 backend, 1 nó MongoDB e 1 nó MinIO na escrita (2 na leitura). Nenhum ficheiro já confirmado se perde.*

| Falha (tipo) | Deteção | Recuperação |
| --- | --- | --- |
| Um backend vai abaixo (paragem/crash) | O Nginx deixa de receber resposta (health check falha) | O Nginx envia os pedidos para os outros 2 backends. Como são stateless, o utilizador não nota. |
| Um nó MinIO vai abaixo (paragem/crash) | O MinIO e o `storage.py` deixam de obter resposta do nó | O erasure coding reconstrói os dados com os nós restantes; o `storage.py` tenta o nó seguinte. |
| Um nó MongoDB vai abaixo (paragem/crash) | Os heartbeats do replica set falham | Se era o primário, os 2 restantes elegem um novo primário; o driver muda de nó sozinho. |
| O worker de IA vai abaixo (paragem/crash) | Os ficheiros acumulam-se com estado "pendente" na fila | Upload e download continuam; a categorização é feita quando o worker voltar. Nada se perde. |
| O Nginx vai abaixo (paragem · ponto único de falha) | O sistema fica inacessível para os clientes | O Docker reinicia o contentor (`restart: unless-stopped`). Trabalho futuro: 2 Nginx com keepalived. |
| Ficheiro apagado por engano (erro humano) | Reportado pelo próprio utilizador | O ficheiro só fica marcado como apagado (`apagado: true`) e pode ser recuperado da reciclagem. |

### Figura 6. Mockup da página de início de sessão

Ecrã dividido em dois: à esquerda, fundo azul com o logótipo Blue Garden, uma grelha de blocos e o texto «Os teus ficheiros, guardados em vários nós e organizados automaticamente.»; à direita, o formulário «Iniciar sessão» com os campos Email (`nome@universidade.pt`) e Palavra-passe, o botão «Entrar» e as ligações «Criar conta» e «Esqueceste-te da palavra-passe?».

### Figura 7. Mockup da página principal, com as categorias atribuídas pela IA

- **Barra superior:** logótipo Blue Garden, pesquisa («Pesquisar ficheiros, pastas ou categorias...»), botões «Nova pasta» e «Carregar».
- **Menu lateral:** Os meus ficheiros, Recentes, Reciclagem.
- **Categorias (IA):** Académico (42), Fotografias (118), Capturas de ecrã (15), Código (27), Faturas (9), Documentos pessoais (12), Por rever (3).
- **Armazenamento:** 6,2 GB de 10 GB usados · 4 de 4 nós de armazenamento online.
- **Conteúdo** (Os meus ficheiros / 5.º semestre): pastas Projeto T3, Inteligência Artificial, Fotos, Apontamentos; ficheiros Relatorio_T3.pdf (Académico), arquitetura.png (Capturas de ecrã), main.py (Código), fatura_luz.pdf (Faturas), foto_grupo.jpg (Fotografias), contrato_casa.pdf (Documentos pessoais), documento_3.pdf (Por rever), scan_0012.pdf (IA a analisar...).

### Figura 8. Mockup da reciclagem

Página «Reciclagem»: os ficheiros apagados ficam aqui durante [30] dias e podem ser recuperados. Botão «Esvaziar reciclagem».

| Nome | Pasta original | Apagado | |
| --- | --- | --- | --- |
| Relatorio_T3_v1.pdf | Projeto T3 | há 2 dias | Recuperar |
| IMG_2041.jpg | Fotos | há 5 dias | Recuperar |
| main_antigo.py | Projeto T3 / backend | há 12 dias | Recuperar |
| notas_aula3.docx | Apontamentos | há 27 dias | Recuperar |

Mensagem: «Os ficheiros recuperados voltam à pasta original e mantêm a categoria.»

### Ficheiros técnicos

- **Arquitetura do sistema:** Figura 1.
- **Diagramas UML:** Figuras 2, 3 e 4.
- **Estrutura da base de dados:** Figura 3 (cada classe é uma coleção no MongoDB).
- **Capturas da aplicação:** mockups nas Figuras 6 a 8; capturas reais nas próximas fases.
- **Repositório GitHub:** https://github.com/mimofixe/BlueGarden

---

## Anexos

### Anexo A. Requisitos funcionais

| ID | Descrição |
| --- | --- |
| RF01 | O utilizador pode criar conta e fazer login |
| RF02 | O utilizador pode fazer upload e download de ficheiros |
| RF03 | O utilizador pode criar, renomear e apagar pastas |
| RF04 | O utilizador pode mover ficheiros entre pastas |
| RF05 | O utilizador pode apagar ficheiros e recuperá-los da reciclagem |
| RF06 | O utilizador pode pesquisar ficheiros por nome |
| RF07 | O sistema categoriza automaticamente cada ficheiro novo |
| RF08 | O sistema mostra a categoria e o grau de confiança de cada ficheiro |
| RF09 | O utilizador pode corrigir manualmente a categoria |
| RF10 | O utilizador pode filtrar os ficheiros por categoria |

### Anexo B. Requisitos não funcionais

| Requisito | Descrição |
| --- | --- |
| RNF01 Disponibilidade | O sistema continua a funcionar se cair um backend, um nó de armazenamento ou um nó da base de dados. |
| RNF02 Durabilidade | Nenhum ficheiro já confirmado se perde quando um nó de armazenamento falha. |
| RNF03 Tolerância a falhas da IA | Se o serviço de IA falhar, os uploads continuam e os ficheiros ficam em fila até ele voltar. |
| RNF04 Segurança | Comunicação por HTTPS, passwords guardadas em hash e ficheiros cifrados antes de serem armazenados. |
| RNF05 Privacidade | Cada utilizador só acede aos seus ficheiros. A análise da IA corre nos nossos servidores, sem serviços externos. |
| RNF06 Desempenho | A categorização acontece em segundo plano, sem atrasar o upload. |
| RNF07 Usabilidade | Interface web simples, que funciona em qualquer browser moderno e em qualquer dispositivo. |
| RNF08 Escalabilidade | É possível acrescentar instâncias do backend ou nós de armazenamento sem alterar o sistema. |
| RNF09 Fiabilidade da IA | Cada decisão tem um grau de confiança. Abaixo do limiar, o ficheiro vai para «Por rever». |
| RNF10 Manutenibilidade | Código versionado no GitHub. O sistema arranca com um único comando (Docker Compose). |
| RNF11 Nomes dos ficheiros | O sistema sugere um nome mais claro para cada ficheiro, com base no conteúdo. |
