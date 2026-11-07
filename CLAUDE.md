@AGENTS.md

# CLAUDE.md: convenções do projeto

Agregador e buscador de anúncios de **Volvo seminovos e usados no Brasil**. Fontes: posts do Instagram coletados **só pela API oficial da Meta** e anúncios cadastrados direto no site. O nome do site ainda é provisório (`NEXT_PUBLIC_SITE_NAME`, padrão `[NOME_DO_SITE]`). O site terá domínio próprio, com links cruzados para a comunidade Made by Sweden (madebysweden.com.br).

A especificação completa está em `docs/PROMPT.md`. O plano revisado e as decisões em aberto estão em `docs/plano.md`.

## Forma de trabalho

- O projeto anda **por fases** (`docs/PROMPT.md`, seção 13). Antes de cada fase, apresente um plano curto. Ao fim de cada fase: `npm run check`, `npm run test:e2e`, preview visual (screenshots), lista de pendências. **Pare e espere a aprovação do usuário** antes de seguir.
- Quando a decisão for ambígua ou de negócio, **pergunte**. Não invente credenciais, domínios, preços de planos ou textos jurídicos definitivos.
- **Idiomas:** converse em **português do Brasil**. Código, identificadores, tabelas, colunas e mensagens de commit em **inglês**. Toda a interface em **PT-BR**.
- Commits pequenos e descritivos ao fim de cada etapa relevante.
- Não adicione dependências pesadas sem justificar.

## Stack

- **Next.js 16** (App Router, TypeScript estrito, Server Components). `cacheComponents` e `partialPrefetching` estão ligados em `next.config.ts`: os dados são dinâmicos por padrão e o cache é opt-in com `"use cache"`. Antes de usar uma API do Next, **leia o guia em `node_modules/next/dist/docs/`**, porque esta versão difere do que você conhece. `middleware` agora se chama `proxy`.
- **Tailwind CSS v4** + **shadcn/ui** (estilo `base-nova`, primitivas **Base UI**, não Radix). Para adicionar componentes: `npx shadcn@latest add <nome>`. Os tokens de cor ficam em `src/app/globals.css` (neutros escandinavos + acento azul-aço; claro e escuro via `next-themes`, classe `.dark`).
- **Supabase** (Postgres, Auth, Storage). Migrations SQL versionadas em `supabase/migrations/` (a partir da Fase 1). **RLS em todas as tabelas.**
- **Busca:** Postgres full-text (`portuguese`) + `unaccent` + `pg_trgm`. Só proponha Meilisearch/Typesense se o Postgres se mostrar insuficiente.
- **IA:** Anthropic API, modelo de extração configurável (`ANTHROPIC_MODEL_EXTRACTION`, padrão `claude-haiku-5-5`), tool use com JSON schema e validação **Zod**.
- **Testes:** Vitest (unidade, `*.test.ts` ao lado do código) e Playwright (e2e em `tests/e2e/`, projetos `desktop` e `mobile`).
- **Deploy:** Vercel + Supabase. Crons protegidos por `CRON_SECRET`, idempotentes e com lock.

## Comandos

| Comando             | O que faz                                                                     |
| ------------------- | ----------------------------------------------------------------------------- |
| `npm run dev`       | Servidor de desenvolvimento (http://localhost:3000)                           |
| `npm run build`     | Build de produção                                                             |
| `npm run lint`      | ESLint (`lint:fix` para corrigir)                                             |
| `npm run format`    | Prettier, com ordenação de classes Tailwind (`format:check` só verifica)      |
| `npm run typecheck` | Gera os tipos de rota e roda `tsc --noEmit`                                   |
| `npm test`          | Vitest (`test:watch` em modo watch)                                           |
| `npm run test:e2e`  | Playwright. Em sandbox sem browser, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` |
| `npm run check`     | format:check + lint + typecheck + test + build (critério de fim de fase)      |

## Estrutura

```
src/
  app/                 rotas (App Router)
  components/          componentes do site; ui/ = shadcn
  lib/
    env/               validação de env (schema.ts, public.ts, server.ts)
    site.ts            nome, URL e aviso de marca
    taxonomy/          (Fase 1) modelos, versões, aliases
    search/            (Fase 1) parseQuery + consulta
    extraction/        (Fase 2) pré-filtro, Claude, normalização, dedupe
    instagram/         (Fase 3) cliente Graph API, jobs, fixtures
    leads/             (Fase 4) ref codes, redirect, dedupe de cliques
supabase/migrations/   (Fase 1) SQL versionado
tests/e2e/             Playwright
docs/                  PROMPT.md, plano.md, meta-setup.md
```

## Variáveis de ambiente

- Segredos **só** em variáveis de ambiente. **Nunca** commite `.env*` (o `.gitignore` já bloqueia). Mantenha `.env.example` atualizado a cada variável nova.
- Variáveis públicas (`NEXT_PUBLIC_*`) passam por `src/lib/env/public.ts`, com referência literal para o Next conseguir inlinar. Segredos passam por `serverEnv()` em `src/lib/env/server.ts`, que importa `server-only`.
- Cada módulo exige o que usa com `requireKeys(serverEnv(), ["ANTHROPIC_API_KEY"])`, que gera um erro claro listando o que falta.

## Regras inegociáveis (compliance)

1. **Proibido scraping do Instagram.** Nada de navegador headless, login automatizado, bibliotecas não oficiais (instaloader, instagrapi etc.), proxies ou engenharia reversa. Somente a **API oficial da Meta** (Graph API em `graph.facebook.com`). Vale também "só para testar".
2. **Imagens de terceiros:** fotos de anúncios **não reivindicados** nunca são copiadas para o nosso storage nem reprocessadas. Exiba pelo embed oficial do Instagram ou por um card com link para o post e crédito ao autor. Fotos no nosso storage só de vendedores que aceitaram os termos e concederam licença, ou que cadastraram direto.
3. **Legenda original:** em anúncio não reivindicado, mostre dados estruturados + um resumo escrito com palavras próprias (IA). A legenda completa fica no embed ou no link.
4. **LGPD:** guarde o mínimo do vendedor (telefone e @ publicados no próprio anúncio). Toda página de anúncio tem **"Este anúncio é seu? Remover | Reivindicar"**. Remoção processada em até 48h, com **blocklist** que impede reimportar. **Não colete dados pessoais do comprador** no clique do WhatsApp; IP e user agent só em **hash com salt** (`HASH_SALT`).
5. **Transparência:** todo anúncio exibe "Anúncio de terceiro. O {site} não participa da negociação." e o bloco de dicas de segurança.
6. **Marca Volvo:** uso apenas descritivo. **Sem logotipo, sem "iron mark", sem elementos visuais oficiais.** O rodapé sempre mostra "Não afiliado à Volvo Car Corporation." (`site.brandDisclaimer`).
7. **Segredos** só em env; `.env.example` sempre atualizado.
8. Textos jurídicos (termos, privacidade, termos do anunciante) são **rascunhos marcados para revisão por advogado**.

Também não faça:

- Não invente dados de mercado (preço médio, FIPE) sem fonte; proponha a integração antes.
- Não armazene dados pessoais do comprador.
- Não pule fases.

## Fatos da API da Meta (conferidos em nov/2026; detalhes em `docs/meta-setup.md`)

- Graph API vigente: **v27.0** (`META_GRAPH_VERSION`).
- **Business Discovery:** `GET /{IG_USER_ID}?fields=business_discovery.username(x){...}`. Permissões: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`. Paginação por `before`/`after` montados à mão. Contas age-gated e pessoais não retornam. `GET` direto num media retornado falha.
- **Hashtag Search:** exige App Review do recurso **Instagram Public Content Access** + `instagram_basic`. Limite de **30 hashtags únicas por 7 dias (janela móvel)**. `recent_media` **e** `top_media` contam no limite. `recent_media` traz só as últimas 24h, até 50 por página, só cursor `after` (sempre igual), **sem `username`** e sem posts impulsionados. `GET /{ig-user-id}/recently_searched_hashtags` mostra o que já contou na janela.
- Business Discovery e Hashtag Search seguem o **Platform Rate Limiting** (header `X-App-Usage`), não o BUC. Leia os dois headers (`X-App-Usage` e `X-Business-Use-Case-Usage`).
- O endpoint de oEmbed exige App Review de **Meta oEmbed Read**. Os metadados servem **só para exibição**; nunca extraia nem persista nada deles.
