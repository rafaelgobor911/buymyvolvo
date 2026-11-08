# [NOME_DO_SITE]: Volvo seminovos e usados

Buscador de anúncios de Volvo à venda no Brasil. Reúne posts de venda publicados no Instagram, coletados **exclusivamente pela API oficial da Meta**, e anúncios cadastrados direto pelos vendedores. O comprador busca em texto livre (`xc60 t8 sp até 250 mil`) e fala com o vendedor pelo WhatsApp, com um código de referência que registra o lead.

> Não afiliado à Volvo Car Corporation. "Volvo" e os nomes de modelos são usados apenas de forma descritiva.

## Status

| Fase | Escopo                                      | Situação                   |
| ---- | ------------------------------------------- | -------------------------- |
| 0    | Setup, convenções, guia da Meta             | ✅ aprovada                |
| 1    | Taxonomia, banco, busca com dados fictícios | ✅ aprovada                |
| 2    | Extração com IA                             | ✅ aprovada                |
| 3    | Conectores do Instagram                     | ✅ aprovada                |
| 4    | Leads e WhatsApp                            | ✅ aprovada                |
| 5    | Admin e moderação                           | ✅ aprovada                |
| 6    | Vendedor                                    | 🔄 6a aguardando aprovação |
| 7    | Produção                                    | ⏳                         |

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

Para o banco local você precisa de um Postgres 16 com as extensões `unaccent` e `pg_trgm` (vêm no pacote `postgresql-contrib`). Com Docker, por exemplo:

```bash
docker run -d --name buymyvolvo-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
```

Preencha `DATABASE_URL` (e `TEST_DATABASE_URL`, um banco separado para os testes) no `.env.local` e rode:

```bash
npm run db:setup
```

Isso aplica as migrations e carrega ~60 anúncios **fictícios**. Abra http://localhost:3000.

## Scripts

| Comando                                   | O que faz                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                             | Servidor de desenvolvimento                                                                                              |
| `npm run build` / `npm start`             | Build e servidor de produção                                                                                             |
| `npm run lint` / `npm run lint:fix`       | ESLint                                                                                                                   |
| `npm run format` / `npm run format:check` | Prettier (com ordenação de classes Tailwind)                                                                             |
| `npm run typecheck`                       | Checagem de tipos                                                                                                        |
| `npm test`                                | Testes de unidade (Vitest)                                                                                               |
| `npm run test:e2e`                        | Testes e2e (Playwright, desktop + mobile). Na primeira vez: `npx playwright install chromium`                            |
| `npm run check`                           | Tudo acima, menos e2e (critério de fim de fase)                                                                          |
| `npm run db:setup` / `db:reset`           | Migrations + dados fictícios (`db:reset` apaga tudo; só funciona em banco local)                                         |
| `npm run db:generate`                     | Regera a migration da taxonomia e o `supabase/seed.sql`                                                                  |
| `npm run extract:eval`                    | Avalia a extração com IA: 40 legendas fictícias ou `-- --set=real` (35 reais); `--offline` avalia só o pré-filtro        |
| `npm run job -- <job\|all>`               | Roda os jobs de coleta e manutenção (`--dry-run`, `--fixtures`, `--force`, `--only=@loja`, `--limit=N`); ver `CLAUDE.md` |
| `npm run sources -- <comando>`            | Contas e hashtags monitoradas: `list`, `add @loja`, `add-hashtag tag`, `pause`, `resume`, `add-fixtures`                 |

## Documentação

- [`CLAUDE.md`](CLAUDE.md): convenções, comandos e **regras de compliance** (leitura obrigatória)
- [`docs/PROMPT.md`](docs/PROMPT.md): especificação completa do produto
- [`docs/plano.md`](docs/plano.md): plano revisado, decisões e riscos
- [`docs/meta-setup.md`](docs/meta-setup.md): passo a passo do app da Meta, tokens e App Review

## Segredos

Nunca commite `.env*` (só o `.env.example`). Em produção, as variáveis ficam na Vercel.
