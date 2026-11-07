# [NOME_DO_SITE]: Volvo seminovos e usados

Buscador de anúncios de Volvo à venda no Brasil. Reúne posts de venda publicados no Instagram, coletados **exclusivamente pela API oficial da Meta**, e anúncios cadastrados direto pelos vendedores. O comprador busca em texto livre (`xc60 t8 sp até 250 mil`) e fala com o vendedor pelo WhatsApp, com um código de referência que registra o lead.

> Não afiliado à Volvo Car Corporation. "Volvo" e os nomes de modelos são usados apenas de forma descritiva.

## Status

| Fase | Escopo                                      | Situação                |
| ---- | ------------------------------------------- | ----------------------- |
| 0    | Setup, convenções, guia da Meta             | ✅ aguardando aprovação |
| 1    | Taxonomia, banco, busca com dados fictícios | ⏳                      |
| 2    | Extração com IA                             | ⏳                      |
| 3    | Conectores do Instagram                     | ⏳                      |
| 4    | Leads e WhatsApp                            | ⏳                      |
| 5    | Admin e moderação                           | ⏳                      |
| 6    | Vendedor                                    | ⏳                      |
| 7    | Produção                                    | ⏳                      |

## Stack

Next.js 16 (App Router, TypeScript estrito), Tailwind CSS v4, shadcn/ui, Supabase (Postgres + Auth + Storage), Anthropic API (extração), Vitest, Playwright, Vercel.

## Rodando localmente

Requisitos: Node.js 22+ e npm.

```bash
npm install
```

```bash
cp .env.example .env.local
```

```bash
npm run dev
```

Abra http://localhost:3000. Na Fase 0 nenhuma variável de ambiente é obrigatória.

## Scripts

| Comando                                   | O que faz                                                                                     |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- |
| `npm run dev`                             | Servidor de desenvolvimento                                                                   |
| `npm run build` / `npm start`             | Build e servidor de produção                                                                  |
| `npm run lint` / `npm run lint:fix`       | ESLint                                                                                        |
| `npm run format` / `npm run format:check` | Prettier (com ordenação de classes Tailwind)                                                  |
| `npm run typecheck`                       | Checagem de tipos                                                                             |
| `npm test`                                | Testes de unidade (Vitest)                                                                    |
| `npm run test:e2e`                        | Testes e2e (Playwright, desktop + mobile). Na primeira vez: `npx playwright install chromium` |
| `npm run check`                           | Tudo acima, menos e2e (critério de fim de fase)                                               |

## Documentação

- [`CLAUDE.md`](CLAUDE.md): convenções, comandos e **regras de compliance** (leitura obrigatória)
- [`docs/PROMPT.md`](docs/PROMPT.md): especificação completa do produto
- [`docs/plano.md`](docs/plano.md): plano revisado, decisões e riscos
- [`docs/meta-setup.md`](docs/meta-setup.md): passo a passo do app da Meta, tokens e App Review

## Segredos

Nunca commite `.env*` (só o `.env.example`). Em produção, as variáveis ficam na Vercel.
