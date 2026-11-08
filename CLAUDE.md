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
- **Supabase** (Postgres, Auth, Storage). Migrations SQL versionadas em `supabase/migrations/`. **RLS em todas as tabelas.**
- **Busca:** Postgres full-text (`portuguese`) + `unaccent` + `pg_trgm`. Só proponha Meilisearch/Typesense se o Postgres se mostrar insuficiente.
- **IA:** Anthropic API, modelo de extração configurável (`ANTHROPIC_MODEL_EXTRACTION`, padrão `claude-haiku-5-5`), **structured outputs** (`output_config.format` com o schema Zod) e nova validação Zod com 1 retry. O Haiku 5.5 **rejeita `temperature`**: a previsibilidade vem de `thinking: disabled` + `effort: "low"`. O prompt de sistema é gerado da taxonomia, fica byte-estável e vai em cache (`cache_control`); dados do post só na mensagem do usuário, entre aspas, como dado (nunca como instrução). Antes de mexer no código da API, carregue a skill `claude-api`.
- **Testes:** Vitest (unidade, `*.test.ts` ao lado do código) e Playwright (e2e em `tests/e2e/`, projetos `desktop` e `mobile`).
- **Deploy:** Vercel + Supabase. Crons protegidos por `CRON_SECRET`, idempotentes e com lock.

## Comandos

| Comando                | O que faz                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------- |
| `npm run dev`          | Servidor de desenvolvimento (http://localhost:3000)                                          |
| `npm run build`        | Build de produção                                                                            |
| `npm run lint`         | ESLint (`lint:fix` para corrigir)                                                            |
| `npm run format`       | Prettier, com ordenação de classes Tailwind (`format:check` só verifica)                     |
| `npm run typecheck`    | Gera os tipos de rota e roda `tsc --noEmit`                                                  |
| `npm test`             | Vitest (`test:watch` em modo watch)                                                          |
| `npm run test:e2e`     | Playwright. Em sandbox sem browser, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`                |
| `npm run check`        | format:check + lint + typecheck + test + build (critério de fim de fase)                     |
| `npm run db:setup`     | Aplica migrations pendentes e carrega os anúncios fictícios                                  |
| `npm run db:reset`     | **Só local:** apaga tudo, migra e popula de novo                                             |
| `npm run db:generate`  | Gera a migration da taxonomia e o `supabase/seed.sql` a partir do TypeScript                 |
| `npm run extract:eval` | Avalia a extração com IA nas 40 legendas de teste (`-- --offline`: só pré-filtro, sem custo) |

## Estrutura

```
src/
  app/                   rotas: / , /busca , /anuncio/[slug] (+ /remover, /reivindicar)
  components/            componentes do site; ui/ = shadcn; search/ = busca e filtros
  content/               textos editoriais (checklists por modelo, buscas populares)
  lib/
    env/                 validação de env (schema.ts, public.ts, server.ts)
    taxonomy/            modelos, gerações, motores, versões (data.ts = fonte única)
    search/              parseQuery, places (UF/cidades), filters (URL ⇄ filtros, chips)
    listings/            queries (server-only), format (pt-BR)
    db/                  pool Postgres + asAnon()
    extraction/          pré-filtro, schema, prompt, extract (Claude), normalize, dedupe, pipeline
    instagram/           (Fase 3) · leads/ (Fase 4)
scripts/db/              CLI de banco (migrate, seed, reset, generate) + fixtures fictícias
scripts/extract-eval.ts  avaliação da extração (relatórios em evals/extraction/reports/)
evals/extraction/        40 legendas fictícias com gabarito + cálculo do placar
supabase/
  migrations/            SQL versionado (formato Supabase CLI)
  local/bootstrap.sql    recria roles/schemas do Supabase num Postgres comum (só local)
  seed.sql               GERADO: anúncios fictícios (nunca em produção)
tests/
  integration/           Vitest contra TEST_DATABASE_URL (RLS, buscas de aceitação)
  unit/                  Vitest sem banco
  e2e/                   Playwright (desktop + mobile)
docs/                    PROMPT.md, plano.md, meta-setup.md
```

## Banco de dados

- **Postgres direto** (driver `postgres`, sem ORM) via `DATABASE_URL`. No Supabase, use a URL do pooler (modo transaction); o pool já usa `prepare: false`.
- **Migrations** em `supabase/migrations/AAAAMMDDHHMMSS_nome.sql`. Nunca edite uma migration já aplicada em produção; crie outra. O runner (`scripts/db/lib.ts`) registra em `supabase_migrations.schema_migrations`, a mesma tabela do Supabase CLI.
- **Taxonomia:** edite `src/lib/taxonomy/data.ts` e rode `npm run db:generate`. Revisada pelo dono do produto em 07/11/2026; o que ainda é dúvida leva `review`. Um teste falha se o SQL gerado estiver desatualizado. Itens duvidosos levam `review: "..."`, que vira `-- REVISAR:` no SQL.
- **RLS em toda tabela nova**: `enable row level security`, `revoke all ... from anon, authenticated`, e só então `grant select (colunas)` + policy para o que for público. Um teste de integração falha se alguma tabela de `public` estiver sem RLS.
- **Leituras públicas** passam por `asAnon()` (`set local role anon`), então a RLS vale também no servidor. Liste as colunas explicitamente: `anon` tem grants por coluna (telefone, legenda e campos internos ficam de fora).
- **Escritas** só no servidor, com o papel dono das tabelas. O navegador nunca fala com o banco.
- Dados fictícios: telefones com DDD 20 (inexistente), sem fotos, sem links para posts reais. `NEXT_PUBLIC_DEMO_MODE=true` mostra o aviso de prévia.

## Busca

- `parseQuery(texto)` é determinístico e sem IA: regex para km/ano/preço, depois um dicionário de aliases (taxonomia + lugares) com n-gramas de até 5 palavras e segmentação de tokens colados ("s60t5"). O que sobra vai para full-text (`pt_unaccent`) com fallback por trigram (erros de digitação).
- Regras de produto: "v40" inclui o V40 Cross Country; "ultimate"/"ultra" incluem as versões Dark ("ultimate dark" restringe); "xc40 elétrico" inclui o EX40; "c40" ⇄ "ec40"; "polestar" = Polestar Engineered (a série Polestar 2014–2018 não veio ao Brasil); "São Paulo"/"Rio de Janeiro" sozinhos = estado, com atalho para a cidade; "cidade de…", "capital" e "sampa" = cidade.
- **Mercado brasileiro:** `brazil: false` na taxonomia marca o que nunca foi vendido oficialmente aqui (V90, S60/V60 Cross Country, B4/B5/B6, D3/D4, T2, Summum, Polestar 2014–2018, V70 3ª geração). A busca continua reconhecendo esses termos e mostra um aviso, mas eles saem das opções do painel de filtros. Motores com `brazil: [...]` (T3, T4, D5) só valem nos modelos/anos listados. Os anúncios fictícios só usam combinações vendidas no Brasil (há teste para isso).
- URL: `q` é o texto; parâmetros explícitos do painel (`modelo`, `motor`, `versao`, `combustivel`, `cambio`, `vendedor`, `ano_min`, `ano_max`, `preco_min`, `preco_max`, `km_max`, `uf`, `cidade`, `texto`, `ordem`, `pagina`) **sobrescrevem** o que veio do texto, inclusive quando vazios (= "qualquer").

## Extração (Fase 2)

- Ordem do pipeline (`src/lib/extraction/pipeline.ts`): blocklist → pré-filtro (regex, sem IA) → Claude → normalização e coerência → blocklist do telefone → deduplicação → publica (`confidence ≥ publish_confidence_threshold` e campos mínimos) ou manda para moderação. Cada `raw_post` sai de `pending` uma única vez.
- A normalização é a fonte da verdade: re-lê preço/km dos trechos originais (`price_text`, `km_text`), casa a taxonomia, valida telefone (E.164, DDD válido) e **reduz a confiança** em combinações impossíveis ou não vendidas no Brasil.
- O resumo precisa ser em palavras próprias: se repetir 8 palavras seguidas da legenda, a confiança cai e o anúncio vai para moderação.
- O resumo é público (página e meta description) e o telefone não: frases que só dizem como contatar saem; telefone, @ ou link no resumo mandam para moderação; preço no resumo reduz a confiança.
- Um anúncio `removed` nunca volta: uma repostagem do mesmo carro é ignorada.

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
