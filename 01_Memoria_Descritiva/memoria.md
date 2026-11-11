# Memória Descritiva

# Blue Garden

**Repositório de Ficheiros Distribuído On-Line**

2.ª entrega

---

Francisco Lourinho - 202301001
David Bação - 20230331
Lucas Nicolau - 20241526

---

**Grupo 3**

Licenciatura em Engenharia Informática · 3.º ano · 5.º semestre · 2026/2027 · IADE - Universidade Europeia
Novembro de 2026

## Identificação

| | |
| --- | --- |
| **Nome do projeto** | Blue Garden — Repositório de Ficheiros Distribuído On-Line |
| **Ano letivo** | 2026/2027 |
| **Semestre** | 5.º semestre |
| **Unidades curriculares** | Projeto de Desenvolvimento de Software; Engenharia de Software; Sistemas Distribuídos; Inteligência Artificial; Segurança Informática |
| **Docentes** | Rui Pascoal e Miguel Boavida; Rui Ramos; Pedro Rosa; Samuel Gomes; Sérgio Nunes e Pedro Brandão |

---

## Resumo

O Blue Garden é um repositório de ficheiros on-line, semelhante ao Google Drive, que guarda os ficheiros de forma distribuída e os organiza automaticamente por categoria com Inteligência Artificial. Corresponde ao Trabalho 3 do briefing e junta as unidades curriculares do 5.º semestre: Engenharia de Software, Sistemas Distribuídos, Inteligência Artificial, Segurança Informática e Projeto de Desenvolvimento de Software.

A ideia partiu de uma necessidade do grupo, que confirmámos em entrevistas a cinco estudantes: os ficheiros acumulam-se nas Transferências e noutros sítios, com nomes que não dizem nada, e quase ninguém os consegue manter arrumados. Os serviços que existem guardam bem os ficheiros, mas a organização continua a ser feita à mão.

No Blue Garden, o utilizador carrega os ficheiros e encontra-os arrumados em sete categorias: Académico, Faturas e finanças, Documentos pessoais, Fotografias, Capturas de ecrã, Código e Por rever. Cada decisão tem um grau de confiança e, quando fica abaixo de 0,6, o ficheiro vai para «Por rever». O utilizador pode sempre corrigir a categoria, e as correções ficam guardadas para voltar a treinar o modelo.

A IA corre num worker separado, em segundo plano. Usa regras simples para código, fotografias, capturas de ecrã e faturas, e um classificador TF-IDF (Naive Bayes ou Regressão Logística) para os restantes documentos. Toda a análise é feita nos nossos servidores, sem serviços externos. Num teste com 26 ficheiros novos, acertou em 20; em 5 dos erros o palpite estava certo, mas a confiança ficou abaixo do limiar.

O sistema continua a funcionar quando um componente falha. Um Nginx com HTTPS distribui os pedidos por três backends em Python (FastAPI), os metadados ficam num replica set de MongoDB com três nós e os ficheiros, cifrados com Fernet, num cluster MinIO com quatro nós. Tudo corre em Docker Compose. Nos testes, parámos ao mesmo tempo um backend, um nó do MongoDB e um nó do MinIO, e o serviço continuou disponível.

Nesta segunda fase implementámos o protótipo: contas, upload e download cifrados, pastas, pesquisa, reciclagem, categorização automática com correção, filtro por categoria e um script que demonstra os cenários de falha. Para a versão final falta sugerir nomes mais claros para os ficheiros, uma vista de administração e testar a IA com mais ficheiros reais.

---

## 1. Contexto / Introdução

### 1.1. Problema abordado

Os ficheiros acumulam-se sem ordem, com nomes como «Documento1.docx» ou «trabalho final v3 (2).pdf». A extensão também não ajuda: um PDF tanto pode ser uma fatura como uns apontamentos.

Organizar à mão demora e acaba por ser abandonado. Além disso, um serviço de armazenamento tem de estar sempre disponível e não pode perder ficheiros quando uma parte do sistema falha.

### 1.2. Motivação

Todos no grupo já perdemos tempo à procura de um ficheiro que sabíamos que existia. O Google Drive, o Dropbox e o OneDrive guardam bem os ficheiros, mas nenhum arruma os documentos pelo conteúdo.

Para confirmar que o problema não era só nosso, entrevistámos cinco estudantes. Três já tiveram de pedir ou descarregar outra vez um ficheiro que tinham, para três a maior confusão está na pasta Transferências e só um consegue manter os ficheiros organizados. As entrevistas também mostraram que a confiança é o maior risco: duas pessoas não querem que o conteúdo seja lido e duas só aceitam se a análise for feita localmente. Por isso, a análise sem serviços externos e a possibilidade de corrigir passaram a ser pontos centrais do projeto.

**Público-alvo:** estudantes do ensino superior (18 a 27 anos), incluindo quem estuda e trabalha, e adultos que precisam de manter faturas e documentos pessoais organizados, sem tempo para os arrumar à mão.

### 1.3. Objetivos

- Guardar, organizar e pesquisar ficheiros on-line, com reciclagem.
- Categorizar cada ficheiro automaticamente, com um grau de confiança.
- Continuar a funcionar se falhar um backend, um nó de armazenamento ou um nó da base de dados.
- Proteger os dados com HTTPS, hash nas passwords e ficheiros cifrados.

---

## 2. Processo

### 2.1. Metodologia utilizada

Metodologia ágil, com sprints de uma semana, um quadro de tarefas (a fazer, em curso, feito) e uma reunião semanal curta. O trabalho está dividido em ciclos (Figura 16). O código fica no GitHub: o ramo `codigo` tem o protótipo e o ramo principal tem este arquivo.

- **Fase 1** (entrega a 11/10/2026): requisitos, UML, mockups, arquitetura e modelo de faltas.
- **Fase 2** (entrega a 15/11/2026): infraestrutura, funcionalidades base, primeira versão da IA e testes de falhas.
- **Fase 3** (entrega a 20/12/2026): versão final, mais testes, demonstração e documentação.

### 2.2. Ferramentas utilizadas

- **GitHub:** controlo de versões e acompanhamento do projeto.
- **Docker Desktop e Docker Compose:** arranque de todos os serviços com um só comando.
- **Git Bash:** comandos e scripts no Windows.
- **FigCraft:** protótipos clicáveis do MVP, usados nos testes com utilizadores.
- **Ferramentas de diagramas e mockups:** UML, arquitetura e interfaces.
- **Quadro de tarefas e chat de grupo:** organização dos sprints e comunicação do dia a dia.

### 2.3. Tecnologias utilizadas

- **Frontend:** HTML, CSS e JavaScript, servido pelo Nginx.
- **Nginx 1.27:** HTTPS (TLS 1.2 e 1.3) e distribuição dos pedidos pelos backends.
- **Backend:** Python 3.12 com FastAPI (três instâncias sem estado).
- **MongoDB 7:** replica set de três nós para contas, metadados e a fila da IA.
- **MinIO:** quatro nós com erasure coding para os ficheiros. A imagem oficial deixou de estar disponível em setembro de 2026 e passámos a usar a da Chainguard.
- **IA:** scikit-learn (TF-IDF, Naive Bayes e Regressão Logística), pypdf, python-docx e Tesseract (OCR em imagens).
- **Segurança:** Fernet (AES), bcrypt e JWT.

### 2.4. Estrutura da equipa

Três elementos: Francisco Lourinho, David Bação e Lucas Nicolau. As tarefas são distribuídas em cada sprint. Nesta fase, o Lucas ficou com o backend, o frontend, a infraestrutura em Docker e a demonstração de falhas; o David com a componente de IA (dados, treino e avaliação), a Engenharia de Software e o relatório; e o Francisco com a memória descritiva e o arquivo documental.

---

## 3. Resultados

### 3.1. Descrição da solução desenvolvida

O utilizador entra no site, carrega os ficheiros e encontra-os arrumados por categoria, com o grau de confiança em cada ficheiro (Figura 17). Pode navegar por pastas, pesquisar pelo nome, filtrar por categoria e recuperar ficheiros da reciclagem (Figuras 18 a 21).

Os pedidos passam pelo Nginx, que os distribui por três backends sem estado. Os metadados ficam no MongoDB (três nós) e os ficheiros, cifrados no backend antes de serem guardados, no MinIO (quatro nós). Assim, a falha de um componente não faz perder ficheiros (Figuras 1 e 9).

Cada ficheiro novo fica com o estado PENDENTE, que funciona como fila. O worker de IA aplica as regras ou o classificador e guarda a categoria com o grau de confiança (Figuras 10 e 11). Abaixo de 0,6, o ficheiro vai para «Por rever». Como corre em segundo plano, o upload não fica à espera da IA e, se o worker parar, os ficheiros esperam na fila até ele voltar.

### 3.2. Funcionalidades principais

- Criar conta e iniciar sessão.
- Upload e download de ficheiros, cifrados no armazenamento.
- Criar pastas e mover ficheiros entre pastas (arrastando).
- Reciclagem: apagar, recuperar e eliminar de vez.
- Pesquisa por nome.
- Categoria automática com grau de confiança e contagem por categoria.
- Correção manual da categoria e filtro por categoria.
- Perfil com foto (também cifrada) e modo escuro.

O estado de cada requisito está no Anexo C.

### 3.3. Contributos relevantes

- Organização pelo conteúdo, sem o utilizador criar regras ou pastas.
- Armazenamento tolerante a faltas, com ficheiros cifrados e análise feita nos nossos servidores.
- Uma IA honesta: quando não tem certeza, diz isso em vez de arrumar mal o ficheiro. No teste na aplicação, 5 dos 6 erros foram para «Por rever» com o palpite certo e só 1 ficou numa categoria errada (Figura 15).

---

## 4. Reflexão / Conclusões

### 4.1. Lições aprendidas

- Pensar no modelo de faltas cedo mudou o desenho, por exemplo ao pôr a fila da IA na base de dados.
- Nem tudo precisa de machine learning: regras simples resolvem fotografias, capturas, código e boa parte das faturas.
- Na IA, ter mais dados fez muito mais diferença do que trocar de algoritmo (Figura 13).
- A segurança tem custos: cifrar afeta o desempenho e obriga a cuidar bem da chave.
- Depender de imagens de terceiros é um risco: a imagem do MinIO deixou de estar disponível a meio do projeto.

### 4.2. Limitações

- O Nginx é um ponto único de falha.
- Só consideramos falhas por paragem (crash).
- Há uma só chave de cifra: se se perder, os ficheiros ficam ilegíveis.
- O dataset é pequeno e foi escrito pelo grupo, por isso a validação cruzada dá resultados otimistas (Figura 14).
- Os PDFs digitalizados não têm texto e não fazemos OCR neles: o modelo só vê o nome e a extensão.
- As correções perdem-se se o ficheiro for eliminado de vez.
- Ainda não é possível mudar o nome nem apagar pastas, e não há sugestão de nomes nem vista de administração.

### 4.3. Trabalho futuro

- Sugerir um nome mais claro para cada ficheiro (RNF11).
- Mudar o nome e apagar pastas.
- Vista de administração com o estado dos nós.
- OCR em PDFs digitalizados e mais ficheiros reais (anonimizados) no treino.
- Dois Nginx com keepalived, para eliminar o ponto único de falha.
- Deteção de duplicados e partilha de ficheiros entre utilizadores.

---

## 5. Imagens

Todas as imagens estão em `02_Imagens`. As figuras 1 a 8 são da primeira fase; as figuras 9 a 23 são desta fase.

### Figura 1. Arquitetura distribuída do Blue Garden

*Ficheiro: `02_Imagens/img_01.jpg`. Todos os serviços correm em contentores Docker (Docker Compose). Linhas tracejadas = replicação entre nós.*

- **Cliente web** (browser · HTML + JavaScript) → HTTPS → **Nginx** (load balancer, único ponto de falha assumido).
- O Nginx distribui os pedidos por **Backend 1**, **Backend 2** e **Backend 3** (Python · FastAPI, stateless). Existe também um **Worker de IA** (scikit-learn · lê a fila na BD).
- **MongoDB - replica set rs0** (metadados + fila): mongo1 (primário), mongo2 (secundário), mongo3 (secundário). Guarda os metadados e a fila da IA. Se o primário cair, os outros 2 elegem um novo primário.
- **MinIO - modo distribuído com erasure coding** (ficheiros cifrados): minio1, minio2, minio3, minio4. Os ficheiros são cifrados no backend (Fernet) antes de chegarem ao MinIO. Aguenta perder 1 nó na escrita e 2 na leitura.

### Figura 2. Diagrama de casos de uso

*Ficheiro: `02_Imagens/img_02.jpg`. Linha contínua = associação ator–caso de uso · seta tracejada = «include».*

Sistema Blue Garden:

- **Utilizador:** Registar / iniciar sessão; Carregar ficheiro; Descarregar ficheiro; Criar e organizar pastas; Consultar / pesquisar ficheiros; Apagar ficheiro; Recuperar ficheiro apagado; Corrigir categoria.
- **Carregar ficheiro** «include» **Categorizar ficheiro (IA)** (ator: Worker de IA «sistema») e «include» **Cifrar e guardar com redundância**.
- **Administrador:** Gerir utilizadores; Monitorizar estado dos nós; Treinar modelo de IA.

### Figura 3. Diagrama de classes (estrutura dos dados no MongoDB)

*Ficheiro: `02_Imagens/img_03.jpg`. Modelo de dados guardado no MongoDB (cada classe de domínio é uma coleção). Linha contínua = associação · seta tracejada = dependência.*

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

*Ficheiro: `02_Imagens/img_04.jpg`. Seta a cheio = pedido · seta tracejada = resposta. A categorização é assíncrona: o utilizador não espera pela IA.*

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

*Ficheiro: `02_Imagens/img_05.jpg`. Pressupostos: só consideramos falhas por paragem (crash), sem nós maliciosos. Falhas simultâneas suportadas: 1 backend, 1 nó MongoDB e 1 nó MinIO na escrita (2 na leitura). Nenhum ficheiro já confirmado se perde.*

| Falha (tipo) | Deteção | Recuperação |
| --- | --- | --- |
| Um backend vai abaixo (paragem/crash) | O Nginx deixa de receber resposta (health check falha) | O Nginx envia os pedidos para os outros 2 backends. Como são stateless, o utilizador não nota. |
| Um nó MinIO vai abaixo (paragem/crash) | O MinIO e o `storage.py` deixam de obter resposta do nó | O erasure coding reconstrói os dados com os nós restantes; o `storage.py` tenta o nó seguinte. |
| Um nó MongoDB vai abaixo (paragem/crash) | Os heartbeats do replica set falham | Se era o primário, os 2 restantes elegem um novo primário; o driver muda de nó sozinho. |
| O worker de IA vai abaixo (paragem/crash) | Os ficheiros acumulam-se com estado "pendente" na fila | Upload e download continuam; a categorização é feita quando o worker voltar. Nada se perde. |
| O Nginx vai abaixo (paragem · ponto único de falha) | O sistema fica inacessível para os clientes | O Docker reinicia o contentor (`restart: unless-stopped`). Trabalho futuro: 2 Nginx com keepalived. |
| Ficheiro apagado por engano (erro humano) | Reportado pelo próprio utilizador | O ficheiro só fica marcado como apagado (`apagado: true`) e pode ser recuperado da reciclagem. |

### Figura 6. Mockup da página de início de sessão

*Ficheiro: `02_Imagens/img_06.jpg`.*

Ecrã dividido em dois: à esquerda, fundo azul com o logótipo Blue Garden, uma grelha de blocos e o texto «Os teus ficheiros, guardados em vários nós e organizados automaticamente.»; à direita, o formulário «Iniciar sessão» com os campos Email (`nome@universidade.pt`) e Palavra-passe, o botão «Entrar» e as ligações «Criar conta» e «Esqueceste-te da palavra-passe?».

### Figura 7. Mockup da página principal, com as categorias atribuídas pela IA

*Ficheiro: `02_Imagens/img_07.jpg`.*

- **Barra superior:** logótipo Blue Garden, pesquisa («Pesquisar ficheiros, pastas ou categorias...»), botões «Nova pasta» e «Carregar».
- **Menu lateral:** Os meus ficheiros, Recentes, Reciclagem.
- **Categorias (IA):** Académico (42), Fotografias (118), Capturas de ecrã (15), Código (27), Faturas (9), Documentos pessoais (12), Por rever (3).
- **Armazenamento:** 6,2 GB de 10 GB usados · 4 de 4 nós de armazenamento online.
- **Conteúdo** (Os meus ficheiros / 5.º semestre): pastas Projeto T3, Inteligência Artificial, Fotos, Apontamentos; ficheiros Relatorio_T3.pdf (Académico), arquitetura.png (Capturas de ecrã), main.py (Código), fatura_luz.pdf (Faturas), foto_grupo.jpg (Fotografias), contrato_casa.pdf (Documentos pessoais), documento_3.pdf (Por rever), scan_0012.pdf (IA a analisar...).

### Figura 8. Mockup da reciclagem

*Ficheiro: `02_Imagens/img_08.jpg`.*

Página «Reciclagem»: os ficheiros apagados ficam aqui durante [30] dias e podem ser recuperados. Botão «Esvaziar reciclagem».

| Nome | Pasta original | Apagado | |
| --- | --- | --- | --- |
| Relatorio_T3_v1.pdf | Projeto T3 | há 2 dias | Recuperar |
| IMG_2041.jpg | Fotos | há 5 dias | Recuperar |
| main_antigo.py | Projeto T3 / backend | há 12 dias | Recuperar |
| notas_aula3.docx | Apontamentos | há 27 dias | Recuperar |

Mensagem: «Os ficheiros recuperados voltam à pasta original e mantêm a categoria.»

### Figura 9. Vista de implementação (contentores Docker)

*Ficheiro: `02_Imagens/img_09.png`.* Os 13 contentores do Docker Compose: Nginx, três backends, três nós MongoDB, quatro nós MinIO, o worker de IA e o `mongo-init` (que só inicia o replica set e termina), todos na mesma rede interna. Só o Nginx tem portas abertas para fora (a consola do MinIO, na porta 9001, fica aberta só para a demonstração).

### Figura 10. Como a IA categoriza um ficheiro

*Ficheiro: `02_Imagens/img_10.png`.* Extração do texto e dos metadados, regras, modelo TF-IDF, combinação das duas decisões e limiar de 0,6. As correções do utilizador servem para treinar o modelo outra vez.

### Figura 11. Estados de um ficheiro

*Ficheiro: `02_Imagens/img_11.png`.* A fila da IA (PENDENTE, EM_ANALISE, CATEGORIZADO) e a reciclagem. Se o worker cair a meio de uma análise, o ficheiro volta à fila ao fim de 5 minutos.

### Figura 12. Segurança

*Ficheiro: `02_Imagens/img_12.png`.* HTTPS no Nginx, passwords com bcrypt, sessões com JWT, autorização por utilizador e ficheiros cifrados com Fernet antes de chegarem ao MinIO.

### Figura 13. Resultados da IA em ficheiros novos

*Ficheiro: `02_Imagens/img_13.png`.* Acertos em dois conjuntos de teste que o modelo nunca viu, para três versões dos dados de treino e para os dois algoritmos.

### Figura 14. Matriz de confusão (validação cruzada)

*Ficheiro: `02_Imagens/img_14.png`.* Naive Bayes com as 320 sementes, validação cruzada estratificada em 5 partes. É um resultado otimista, porque as sementes são parecidas entre si.

### Figura 15. Teste na aplicação

*Ficheiro: `02_Imagens/img_15.png`.* 26 ficheiros novos carregados na aplicação: 20 certos, 5 em «Por rever» com o palpite certo e 1 errado.

### Figura 16. Planeamento por ciclos

*Ficheiro: `02_Imagens/img_16.png`.* Os quatro ciclos do projeto e as três entregas.

### Figura 17. Página principal do protótipo

*Ficheiro: `02_Imagens/img_17.png`.* Pastas, ficheiros com a categoria e a confiança, e a contagem por categoria na barra lateral. Os ficheiros são de teste.

### Figura 18. Navegação por pastas

*Ficheiro: `02_Imagens/img_18.png`.* Conteúdo da pasta «Universidade», com o caminho no topo.

### Figura 19. Filtro «Por rever»

*Ficheiro: `02_Imagens/img_19.png`.* Ficheiros em que a IA não teve confiança suficiente, com a percentagem do palpite.

### Figura 20. Pesquisa por nome

*Ficheiro: `02_Imagens/img_20.png`.* A pesquisa procura em todas as pastas e mostra onde está cada ficheiro.

### Figura 21. Reciclagem

*Ficheiro: `02_Imagens/img_21.png`.* Ficheiros apagados, com a pasta original e a opção de recuperar.

### Figura 22. Modo escuro

*Ficheiro: `02_Imagens/img_22.png`.* A preferência fica guardada na conta.

### Figura 23. Criar conta

*Ficheiro: `02_Imagens/img_23.png`.* Página de entrada, no separador «Criar conta».

### Ficheiros técnicos

Em `04_Documentacao_Tecnica`:

- **Arquitetura do sistema:** Figuras 1 e 9 (versões vetoriais em `diagramas/`).
- **Diagramas UML:** Figuras 2, 3 e 4.
- **Estrutura da base de dados:** `estrutura_base_dados.md` e Figura 3.
- **Capturas da aplicação:** Figuras 17 a 23.
- **Repositório Git:** `repositorio_git.md` e https://github.com/mimofixe/BlueGarden

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

### Anexo C. Estado dos requisitos na 2.ª entrega

| Requisito | Estado |
| --- | --- |
| RF01 Conta e login | Implementado |
| RF02 Upload e download | Implementado (ficheiros cifrados no MinIO) |
| RF03 Pastas | Parcial: dá para criar pastas; mudar o nome e apagar pastas ainda não |
| RF04 Mover entre pastas | Implementado (arrastar o ficheiro para a pasta) |
| RF05 Reciclagem | Implementado (apagar, recuperar e eliminar de vez) |
| RF06 Pesquisa por nome | Implementado |
| RF07 Categorização automática | Implementado (worker de IA) |
| RF08 Categoria e confiança | Implementado |
| RF09 Correção da categoria | Implementado |
| RF10 Filtro por categoria | Implementado (barra lateral) |
| RNF11 Nomes dos ficheiros | Não implementado (trabalho futuro) |
