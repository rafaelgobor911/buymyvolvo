# Avaliação da extração

- Data: 2026-11-08T16:52:32.379Z
- Modelo: claude-haiku-5-5
- Versão do prompt: 2026-11-09.1
- Casos: 40 (conjunto em `evals/extraction/dataset.ts`)

## Resumo

| Métrica                                     | Resultado      |
| ------------------------------------------- | -------------- |
| Pré-filtro correto                          | 100.0% (40/40) |
| "É anúncio de Volvo?" correto               | 100.0% (40/40) |
| Campos corretos (geral)                     | 100.0%         |
| Sinais de alerta encontrados                | 100.0% (6/6)   |
| Resumos que copiam a legenda                | 0              |
| Resumos que falam do vendedor ou do negócio | 1 (c20)        |
| Erros de extração                           | 0              |
| Custo desta rodada                          | US$ 0.0071     |
| Custo por 1.000 posts (com pré-filtro)      | US$ 0.1778     |
| Custo por 1.000 extrações                   | US$ 0.2155     |
| Latência média por extração                 | 1404 ms        |

## Acurácia por campo

| Campo            | Acurácia       |
| ---------------- | -------------- |
| Modelo           | 100.0% (29/29) |
| Motor            | 100.0% (26/26) |
| Versão           | 100.0% (20/20) |
| Ano fabricação   | 100.0% (7/7)   |
| Ano modelo       | 100.0% (29/29) |
| Km               | 100.0% (29/29) |
| Preço            | 100.0% (29/29) |
| Cidade           | 100.0% (15/15) |
| UF               | 100.0% (18/18) |
| Câmbio           | 100.0% (5/5)   |
| Combustível      | 100.0% (7/7)   |
| Tipo de vendedor | 100.0% (8/8)   |
| Telefone         | 100.0% (29/29) |

## Tokens

Entrada 3199 · saída 8308 · gravação em cache 5926 · leitura de cache 189632. Custos de cache estimados com os multiplicadores padrão (ver `src/lib/extraction/cost.ts`).

## Pré-filtro

- Deveriam passar e foram barrados: nenhum
- Deveriam ser barrados e passaram: nenhum

## Divergências

Nenhuma.
