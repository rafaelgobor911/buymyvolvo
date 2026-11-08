# Avaliação da extração

- Data: 2026-11-08T16:38:42.792Z
- Modelo: claude-haiku-5-5
- Versão do prompt: 2026-11-08.6
- Casos: 35 (conjunto em `evals/extraction/dataset-real.ts`)

## Resumo

| Métrica                                     | Resultado      |
| ------------------------------------------- | -------------- |
| Pré-filtro correto                          | 100.0% (35/35) |
| "É anúncio de Volvo?" correto               | 100.0% (35/35) |
| Campos corretos (geral)                     | 100.0%         |
| Sinais de alerta encontrados                | n/a            |
| Resumos que copiam a legenda                | 0              |
| Resumos que falam do vendedor ou do negócio | 0              |
| Erros de extração                           | 0              |
| Custo desta rodada                          | US$ 0.0064     |
| Custo por 1.000 posts (com pré-filtro)      | US$ 0.1819     |
| Custo por 1.000 extrações                   | US$ 0.2893     |
| Latência média por extração                 | 1724 ms        |

## Acurácia por campo

| Campo            | Acurácia       |
| ---------------- | -------------- |
| Modelo           | 100.0% (20/20) |
| Motor            | 100.0% (20/20) |
| Versão           | 100.0% (20/20) |
| Ano fabricação   | 100.0% (6/6)   |
| Ano modelo       | 100.0% (20/20) |
| Km               | 100.0% (20/20) |
| Preço            | 100.0% (20/20) |
| Cidade           | 100.0% (13/13) |
| UF               | 100.0% (19/19) |
| Câmbio           | 100.0% (13/13) |
| Combustível      | 100.0% (19/19) |
| Tipo de vendedor | 100.0% (18/18) |
| Telefone         | 100.0% (20/20) |

## Tokens

Entrada 12481 · saída 7664 · gravação em cache 0 · leitura de cache 128480. Custos de cache estimados com os multiplicadores padrão (ver `src/lib/extraction/cost.ts`).

## Pré-filtro

- Deveriam passar e foram barrados: nenhum
- Deveriam ser barrados e passaram: nenhum

## Divergências

Nenhuma.
