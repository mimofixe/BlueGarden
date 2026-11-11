# Resultados da componente de IA

Classificação de ficheiros em 7 categorias (Académico, Faturas e finanças, Documentos pessoais, Fotografias, Capturas de ecrã, Código e Por rever). As regras tratam código, capturas, fotografias e faturas com sinais claros; o modelo TF-IDF trata o resto. Abaixo de 0,6 de confiança, o ficheiro vai para «Por rever».

## Dados de treino

| Versão | Exemplos | Notas |
| --- | --- | --- |
| Sementes iniciais | 53 | cerca de 8 por categoria |
| Sementes v1 | 248 | |
| Sementes v2 | 320 | Faturas 116, Académico 96, Documentos pessoais 67, Código 15, Fotografias 14, Capturas 12; inclui CSVs de despesas, extratos e texto que imita OCR |

Os exemplos foram escritos pelo grupo (dados inventados, sem dados pessoais reais).

## 1.º teste na aplicação (53 sementes, 50 ficheiros)

- Regras: 100% certas em Fotografias (8/8), Capturas de ecrã (6/6), Código (7/7) e Faturas com sinais (6/6).
- Modelo: pôs quase tudo em «Por rever» (confiança entre 0,21 e 0,60). Faltavam dados.

## Validação cruzada (sobre os dados de treino)

| Dados | Algoritmo | Accuracy |
| --- | --- | --- |
| 53 sementes | Regressão Logística | 0,68 (recall Académico 0,12; Documentos pessoais 0,50) |
| 53 sementes + 19 correções | Regressão Logística | 0,83 (Académico 0,83; Documentos pessoais 0,87; F1 Faturas 0,91) |
| 53 sementes | Naive Bayes | 0,77 |
| 320 sementes | Naive Bayes | 0,96 |
| 320 sementes | Regressão Logística | 0,97 |

Com as 320 sementes os valores são otimistas, porque os exemplos são parecidos entre si. A matriz de confusão do Naive Bayes está em `02_Imagens/img_14.png`. Os dois valores com 320 sementes foram calculados com o código do repositório (validação cruzada estratificada em 5 partes): 0,963 (Naive Bayes) e 0,969 (Regressão Logística).

## Ficheiros que o modelo nunca viu

Só ficheiros que dependem do modelo (sem regra forte).

| Dados de treino | Teste 1 (23 ficheiros) | Teste 2 (25 ficheiros) |
| --- | --- | --- |
| 53 sementes | RL 5 · NB 8 | 4 |
| Sementes v1 | RL 20 · NB 22 | RL 15 · NB 17 |
| Sementes v2 | RL 22 · NB 21 | RL 18 · NB 19 |

RL = Regressão Logística · NB = Naive Bayes. Com as sementes v1, juntar n-gramas de letras à RL deu 21 no teste 1.

## Teste completo na aplicação (sementes v2 + Naive Bayes, 26 ficheiros novos)

20 certos (77%). Dos 6 erros, 5 foram para «Por rever» com o palpite certo e só 1 ficou numa categoria errada:

| Ficheiro | Resultado | Confiança |
| --- | --- | --- |
| aula7_threads | Por rever (palpite certo) | 59% |
| Boletim_Inscricao_Ginasio | Por rever (palpite certo) | 59% |
| Proposta_Tese | Por rever (palpite certo) | 48% |
| recibo_vencimento_set | Por rever (palpite certo) | 45% |
| lecture_summary.md (em inglês) | Por rever (palpite certo) | 25% |
| lista.txt | Académico (errado) | 62% |

## Conclusões

- Mais dados foi o que fez mais diferença.
- Com as sementes v2, Naive Bayes e Regressão Logística ficam praticamente empatados.
- Os erros são quase sempre falta de confiança, não troca de categoria.

## Limitações

- Dataset pequeno e escrito pelo grupo; pouco texto em inglês; recibos de vencimento fracos.
- PDFs digitalizados não têm texto (não fazemos OCR em PDFs).
- As correções ficam na base de dados de cada instalação e perdem-se se o ficheiro for eliminado de vez.
