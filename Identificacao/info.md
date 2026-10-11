# Blue Garden

**Repositório de Ficheiros Distribuído On-Line** · 1.ª entrega · Grupo 3

## Equipa

| Nome | Número |
| --- | --- |
| Francisco Lourinho | 202301001 |
| David Bação | 20230331 |
| Lucas Nicolau | 20241526 |

- **Unidade curricular:** Projeto de Desenvolvimento de Software
- **Curso:** Licenciatura em Engenharia Informática, 3.º ano, 5.º semestre, 2026/2027
- **Instituição:** IADE - Universidade Europeia
- **Docente:** Rui Pascoal
- **Data:** Outubro de 2026

## Mini explicação do projeto

O Blue Garden é um repositório de ficheiros on-line, semelhante ao Google Drive, que guarda os ficheiros de forma distribuída e os organiza automaticamente por categoria com Inteligência Artificial.

O utilizador carrega os ficheiros e encontra-os já arrumados em sete categorias: Académico, Faturas e finanças, Documentos pessoais, Fotografias, Capturas de ecrã, Código e Por rever. Cada decisão da IA tem um grau de confiança; quando é baixo (abaixo de 0,6), o ficheiro vai para «Por rever», e o utilizador pode sempre corrigir a categoria.

A IA usa regras simples para fotografias, capturas de ecrã e código, e um classificador (TF-IDF com Regressão Logística, comparada com Naive Bayes) para os documentos. Toda a análise é feita nos servidores do projeto, sem serviços externos.

O sistema continua a funcionar quando um componente falha: um Nginx distribui os pedidos por três backends em Python (FastAPI), os metadados ficam num replica set de MongoDB com três nós e os ficheiros, cifrados, num cluster MinIO com quatro nós. Tudo corre em Docker.

## Links

- **Repositório GitHub:** https://github.com/mimofixe/BlueGarden
