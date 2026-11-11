# Blue Garden

**Repositório de Ficheiros Distribuído On-Line** · Grupo 3 · 2.ª entrega (novembro de 2026)

## Identificação dos estudantes

| Nome completo | N.º de estudante | Curso | Ano curricular |
| --- | --- | --- | --- |
| Francisco Miguel Barbosa Lourinho | 202301001 | Licenciatura em Engenharia Informática | 3.º ano |
| David Miguel Martins Cebolinho de Almeida Bação | 20230331 | Licenciatura em Engenharia Informática | 3.º ano |
| Lucas Nicolau | 20241526 | Licenciatura em Engenharia Informática | 3.º ano |

## Metadados do projeto

1. **Título do projeto:** Blue Garden — Repositório de Ficheiros Distribuído On-Line
2. **Ano letivo:** 2026/2027
3. **Semestre:** 5.º semestre
4. **Curso envolvido:** Licenciatura em Engenharia Informática (L-EI), IADE – Universidade Europeia
5. **Unidades curriculares:** Projeto de Desenvolvimento de Software; Engenharia de Software; Sistemas Distribuídos; Inteligência Artificial; Segurança Informática
6. **Docentes:** Rui Pascoal e Miguel Boavida (Projeto de Desenvolvimento de Software); Rui Ramos (Engenharia de Software); Pedro Rosa (Sistemas Distribuídos); Samuel Gomes (Inteligência Artificial); Sérgio Nunes e Pedro Brandão (Segurança Informática)
7. **Estudantes participantes:** Francisco Lourinho, David Bação e Lucas Nicolau (Grupo 3)
8. **Palavras-chave:** sistemas distribuídos; tolerância a faltas; armazenamento de ficheiros; replicação; erasure coding; aprendizagem automática; classificação de documentos; TF-IDF; Naive Bayes; cifra de ficheiros; Docker
9. **Tecnologias utilizadas:** HTML, CSS e JavaScript; Nginx; Python 3.12 com FastAPI; MongoDB 7 (replica set); MinIO (erasure coding); scikit-learn; pypdf, python-docx e Tesseract OCR; Fernet (cryptography), bcrypt e JWT; Docker e Docker Compose; Git e GitHub
10. **Resumo curto:**

O Blue Garden é um repositório de ficheiros on-line, parecido com o Google Drive, que guarda os ficheiros de forma distribuída e os arruma sozinho por categoria. Cada ficheiro carregado é analisado por um worker de Inteligência Artificial, que junta regras simples (código, fotografias, capturas de ecrã e faturas) com um modelo de aprendizagem automática (TF-IDF com Naive Bayes ou Regressão Logística). Cada decisão tem um grau de confiança e, abaixo de 0,6, o ficheiro vai para «Por rever»; o utilizador pode sempre corrigir. O sistema corre em Docker: um Nginx com HTTPS distribui os pedidos por três backends FastAPI, os metadados ficam num replica set de MongoDB com três nós e os ficheiros, cifrados, num cluster MinIO com quatro nós. O serviço continua disponível com um backend, um nó da base de dados e um nó de armazenamento em baixo.

## Links

- **Repositório GitHub:** https://github.com/mimofixe/BlueGarden