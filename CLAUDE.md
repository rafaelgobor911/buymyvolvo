@AGENTS.md

# CLAUDE.md: convenções do projeto

Agregador e buscador de anúncios de **Volvo seminovos e usados no Brasil**, com **intermediação** desde a Fase 8a: o anúncio só vai ao ar com a autorização do vendedor, e o comprador fala com o WhatsApp do Buy My Volvo. Fontes: posts do Instagram coletados **só pela API oficial da Meta** e anúncios cadastrados direto no site. Nome: **Buy My Volvo** (`NEXT_PUBLIC_SITE_NAME`), domínio **buymyvolvo.com.br**, com links cruzados para a comunidade Made by Sweden (madebysweden.com.br). Operação em produção: [`RUNBOOK.md`](RUNBOOK.md).

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
- **Deploy:** Vercel (plano Hobby por enquanto: só uso não comercial) + Supabase. Crons protegidos por `CRON_SECRET`, idempotentes e com lock, chamados pelo GitHub Actions (`.github/workflows/jobs.yml`). Migrations de produção pelo workflow manual `db-migrate.yml` (nunca o seed).

## Comandos

| Comando                     | O que faz                                                                                                  |
| --------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `npm run dev`               | Servidor de desenvolvimento (http://localhost:3000)                                                        |
| `npm run build`             | Build de produção                                                                                          |
| `npm run lint`              | ESLint (`lint:fix` para corrigir)                                                                          |
| `npm run format`            | Prettier, com ordenação de classes Tailwind (`format:check` só verifica)                                   |
| `npm run typecheck`         | Gera os tipos de rota e roda `tsc --noEmit`                                                                |
| `npm test`                  | Vitest (`test:watch` em modo watch)                                                                        |
| `npm run test:e2e`          | Playwright. Em sandbox sem browser, use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`                              |
| `npm run check`             | format:check + lint + typecheck + test + build (critério de fim de fase)                                   |
| `npm run db:setup`          | Aplica migrations pendentes e carrega os anúncios fictícios (só banco local)                               |
| `npm run db:status`         | Lista as migrations pendentes sem aplicar (`db:migrate` aplica só as migrations)                           |
| `npm run db:reset`          | **Só local:** apaga tudo, migra e popula de novo                                                           |
| `npm run db:generate`       | Gera a migration da taxonomia e o `supabase/seed.sql` a partir do TypeScript                               |
| `npm run extract:eval`      | Avalia a extração: 40 legendas fictícias ou `--set=real` (35 reais); `--offline`: só pré-filtro, sem custo |
| `npm run job -- <job\|all>` | Jobs de coleta e manutenção (`--dry-run`, `--fixtures`, `--force`, `--only=@loja`, `--limit=N`)            |
| `npm run sources -- <cmd>`  | Contas e hashtags monitoradas: `list`, `add @loja`, `add-hashtag tag`, `pause`, `resume`, `add-fixtures`   |
| `npm run leads`             | Leads recentes (`--days=7`, `--limit=50`) até o admin da Fase 5                                            |

## Estrutura

```
src/
  app/                   rotas: / , /busca , /volvo (+ /[modelo]/[versão|uf]/[uf]), /anuncio/[slug] (+ /remover, /reivindicar), /anunciar (+ /enviado, /fotos), /autorizar/[código], /r/[código], /a/[código], /admin, /vendedor (+ /anuncios/[id]), /termos, /privacidade, /termos-do-anunciante, /auth/callback, /fotos/[...] (só local), /api/cron/[job], sitemap.xml, robots.txt
  components/            componentes do site; ui/ = shadcn; search/ = busca e filtros; admin/ = telas do admin; analytics/ = banner de cookies e eventos
  content/               textos editoriais (checklists por modelo, buscas populares, textos das páginas de modelo) e jurídicos (legal.ts, seller-terms.ts)
  lib/
    env/                 validação de env (schema.ts, public.ts, server.ts)
    taxonomy/            modelos, gerações, motores, versões (data.ts = fonte única)
    search/              parseQuery, places (UF/cidades), filters (URL ⇄ filtros, chips)
    listings/            queries (server-only), format (pt-BR)
    db/                  pool Postgres + asAnon()
    extraction/          pré-filtro, schema, prompt, extract (Claude), normalize, dedupe, pipeline
    instagram/           cliente da Graph API (graph.ts), recursos (api.ts) e Instagram fictício (fixtures.ts)
    jobs/                executor (trava + job_runs + dry-run), coleta, manutenção e registro dos jobs
    leads/               código do lead, mensagem (message.ts), links (contact.ts), hash/robôs (request.ts), recordClick (record.ts)
    admin/               acesso (auth, access), formulário, anúncios, anúncio colado (manual.ts), configurações e painel inicial do admin
    authorization/       convite assinado, mensagens e números do WhatsApp, autorização do vendedor (Fase 8a)
    submissions/         formulário público "Anuncie" (opções, validação, criação, token das fotos)
    sellers/             acesso e sessão do vendedor, perfil, termos, reivindicação e painel
    removals/            pedido de remoção sem login
    photos/              fotos do vendedor: processamento (sharp), armazenamento (Supabase ou local) e banco
    billing/             planos (só estrutura) e a interface BillingProvider
    seo/                 páginas por modelo/versão/UF (landing.ts, puro), contagens (queries.ts) e JSON-LD
    analytics/           consentimento (LGPD), Google tag (GA4/Ads) e itens dos eventos
    auth/                login por link no e-mail (Supabase) e retorno das sessões
scripts/db/              CLI de banco (migrate, seed, reset, generate) + fixtures fictícias
scripts/extract-eval.ts  avaliação da extração (relatórios em evals/extraction/reports/)
scripts/job.ts           roda jobs localmente · scripts/sources.ts: fontes monitoradas
evals/extraction/        gabaritos: 40 legendas fictícias e 35 reais anonimizadas (dataset-real.ts) + placar
supabase/
  migrations/            SQL versionado (formato Supabase CLI)
  local/bootstrap.sql    recria roles/schemas do Supabase num Postgres comum (só local)
  seed.sql               GERADO: anúncios fictícios (nunca em produção)
tests/
  integration/           Vitest contra TEST_DATABASE_URL (RLS, buscas de aceitação)
  unit/                  Vitest sem banco
  e2e/                   Playwright (desktop + mobile)
docs/                    PROMPT.md, plano.md, meta-setup.md, login-google.md, login-email.md, fontes.md (outras fontes de anúncios)
RUNBOOK.md               colocar no ar, rotina e incidentes
.github/workflows/       ci.yml, jobs.yml (agendamento), db-migrate.yml (manual)
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
- URL: `q` é o texto; parâmetros explícitos do painel (`modelo`, `motor`, `versao`, `combustivel`, `cambio`, `vendedor`, `ano_min`, `ano_max`, `preco_min`, `preco_max`, `km_max`, `uf`, `cidade`, `repasse`, `carroceria`, `texto`, `ordem`, `pagina`) **sobrescrevem** o que veio do texto, inclusive quando vazios (= "qualquer").
- **Carroceria (Fase 11):** "suv", "sedã"/"sedan", "perua"/"station"/"sw", "hatch", "cupê"/"coupé" e "conversível"/"cabriolet" viram filtro (`carroceria=suv|sedan|perua|hatch|cupe|conversivel`). Quem diz a carroceria é a taxonomia (`bodyTypes` do modelo; da geração quando o modelo teve mais de uma: V40 1ª perua, 2ª hatch), por `bodyTypeMatches()`, sem migration. Modelo digitado que nunca teve aquela carroceria gera aviso ("S60 é sedã, não perua."). A home agrupa os modelos pela carroceria da geração mais recente (`primaryBodyType`). O texto que a busca não reconhece aparece como "Também buscamos o texto:", nunca como "Entendemos".
- **Repasse:** "repasse" no texto filtra só repasses e "sem repasse" os exclui (`repasse=so|sem` na URL). Cards mostram o selo "Repasse" e a página do anúncio, o quadro de cuidados (repasse ou ágio) e a linha "O anúncio menciona: …". Os alertas públicos saem de `red_flags` (`PUBLIC_ALERTS` em `listings/queries.ts`; `sem_contato` é interno) e dizem só o que o próprio post declara.

## Extração (Fase 2)

- Ordem do pipeline (`src/lib/extraction/pipeline.ts`): blocklist → pré-filtro (regex, sem IA) → Claude → normalização e coerência → blocklist do telefone → deduplicação → publica (`confidence ≥ publish_confidence_threshold` e campos mínimos) ou manda para moderação. Cada `raw_post` sai de `pending` uma única vez; a exceção é o reprocessamento explícito dos que deram **erro** na extração (`requeueFailedRawPosts`: `?retry_errors=1` na rota, `--retry-errors` no CLI ou a opção do workflow), depois de corrigir a causa. O alerta do `process-posts` mostra as mensagens de erro (sem chaves).
- A normalização é a fonte da verdade: re-lê preço/km dos trechos originais (`price_text`, `km_text`), casa a taxonomia, valida telefone (E.164, DDD válido) e **reduz a confiança** em combinações impossíveis ou não vendidas no Brasil.
- O resumo precisa ser em palavras próprias: se repetir 8 palavras seguidas da legenda, a confiança cai e o anúncio vai para moderação.
- O resumo é público (página e meta description) e o telefone não: frases que só dizem como contatar saem; telefone, @ ou link no resumo mandam para moderação; preço no resumo reduz a confiança.
- **Pré-filtro por origem** (`prefilter(caption, { origin })`): post de loja cadastrada (Business Discovery) pula a checagem de Brasil; post de hashtag precisa de R$, +55 ou telefone com DDD. Sigla de UF só conta em maiúsculas.
- Preço em moeda estrangeira (€, US$, £, Kz) não vira preço em reais: fica vazio e o anúncio vai para moderação.
- "Único dono" descreve o histórico do carro, não o vendedor (lojas também usam): não define `seller_type`.
- O resumo fala só do carro (estado, histórico, equipamentos): nada de vendedor, loja, financiamento, troca, propostas, sinal, pressa ou entrega. A bio da conta serve só de reserva para cidade, UF e tipo de vendedor.
- **Motor só quando escrito:** a normalização descarta o motor que a legenda não nomeia, e o motor escrito na versão vale mais que o campo do modelo. P6 = Single Motor, P8 = Twin Motor.
- O par de anos escrito na legenda ("20/20", "2023/2024") vale mais que a leitura do modelo; telefone da legenda vem antes do da bio.
- Mudou o prompt ou a normalização? Rode os dois gabaritos (`npm run extract:eval` e `-- --set=real`) e compare. O gabarito real nunca é editado para "passar".
- **Repasse e ágio vêm do texto:** `writtenSaleType()` (normalize.ts) decide os alertas `repasse` e `agio` pelas palavras da legenda, ignorando negações ("não é repasse"); o que o modelo sugerir sem apoio no texto sai. Repasse ou ágio com `pedido_de_sinal` vai para moderação.
- Um anúncio `removed` nunca volta: uma repostagem do mesmo carro é ignorada.
- **Local quando o post não diz** (`extraction/location.ts`, aplicado no pipeline depois da normalização): post/bio > **local padrão da loja** (`sources.default_city/default_uf`, definido em Fontes) > **estado pelo DDD** do telefone (`UF_BY_DDD`, nunca a cidade; `listings.uf_from_ddd`, e a página diz "estado pelo DDD do telefone"). A função SQL `public.uf_from_phone()` espelha o mapa (há teste). Salvar o local da loja preenche os anúncios dela sem local (ou só com o estado do DDD), com `audit_log` (`listing.location_fill`); edição manual de cidade/UF tira a marca de estimativa.

## Coleta do Instagram (Fase 3)

- Jobs em `src/lib/jobs/` (registro em `index.ts`), disparados por `npm run job` ou por `GET/POST /api/cron/<job>` com `Authorization: Bearer <CRON_SECRET>` (`?dry_run=1` para ensaio): `collect-business-discovery` (2–3h), `collect-hashtags` (1h), `process-posts`, `token-health` e `expire-listings` (diários).
- Todo job roda por `runJob()`: trava com prazo em `job_locks` (rodada concorrente vira `skipped`), registro em `job_runs` (estatísticas, tokens, custo de IA, alertas). Escritas só via `ctx.write()`, que no `--dry-run` desfaz a transação no final.
- Jobs recebem `sql` e `JobDeps` por parâmetro e não importam `server-only`: o mesmo código roda no CLI, nos testes e no Next. Credenciais são exigidas só quando o job usa (`requireKeys` dentro de `createJobDeps`).
- Cliente da Graph (`instagram/graph.ts`): token **no header**, nunca na URL; `appsecret_proof` quando há `META_APP_SECRET`; erros classificados (`rate_limit`, `auth`, `permission`, `not_found`, `transient`). Não peça `media_url` nem métricas.
- **Fixtures:** `--fixtures` usa o Instagram fictício de `instagram/fixtures.ts` e só toca fontes terminadas em `.demo`/`_demo`; sem a flag, essas fontes são ignoradas. Novos casos de API entram primeiro nas fixtures, com o formato observado na API real.
- **Orçamento de hashtags:** qualquer consulta a uma hashtag nova gasta uma das 30 vagas por 7 dias da conta (`ig_hashtag_search` já conta). Não teste hashtags reais à toa; o dry-run com a API real não consulta hashtags que gastariam vaga nova.
- **Hashtags rodam 1 vez por dia** (decisão do dono do produto; `add-hashtag` usa 1440 min). Cada leitura de hashtag leva 7–20 s na API real: os jobs de coleta têm orçamento de tempo (`maxSeconds`; 240 s nas rotas de cron) e as fontes não lidas ficam para a chamada seguinte.
- Ciclo de vida: legenda editada para "vendido" → `sold`; post que sumiu do trecho lido → `expired`; anúncio só de hashtag mostra "pode não estar mais disponível" após `hashtag_stale_after_days` e expira após `hashtag_expire_after_days`.
- Nesta sandbox, o `fetch` do Node precisa de `NODE_USE_ENV_PROXY=1` para chegar à API; `ANTHROPIC_API_KEY` vem de `BUYMYVOLVO_ANTHROPIC_API_KEY` (ver `docs/plano.md`).

## Leads e WhatsApp (Fase 4)

- O botão do anúncio é um `<a href="/r/<short_id>">` simples (sem `next/link`, para nada pré-carregar o clique). `short_id` é a última parte do slug (coluna gerada, única). O telefone **nunca** vai para o HTML: só aparece no redirect de `/r`; a página só sabe `has_phone`.
- `/r/[código]` (`recordClick` em `leads/record.ts`, com `sql` por parâmetro como os jobs): grava o lead (código `VX-XXXXX`, canal, HMAC de IP e user agent com `HASH_SALT`, página de origem e UTMs) e responde 302 para `wa.me/<número>?text=<mensagem>`. Sem telefone: `ig.me/m/<@>` ou o post, com canal `instagram`.
- **Não é clique:** prefetch (`Sec-Purpose`) e `HEAD` → 204; robôs e pré-visualizações de link → página do anúncio, sem lead e sem telefone. Anúncio vendido/expirado/sem contato → página do anúncio; em moderação, removido ou inexistente → `/busca`.
- **Dedupe:** mesmo anúncio + mesmo hash de IP e UA dentro de `lead_dedupe_hours` (24) reaproveita o código e soma `click_count`; uma trava (`pg_advisory_xact_lock`) impede leads duplicados em cliques simultâneos.
- **Auditoria:** um trigger impede apagar leads e só deixa mudar `seller_id`, `outcome`, `outcome_reported_at` e os contadores. Testes limpam com `set local buymyvolvo.allow_lead_delete = 'on'` (só em bancos descartáveis).
- Mensagem: `app_settings.whatsapp_message_template` com `{modelo} {versao} {ano} {site} {url} {ref}` (aceita `{versão}`, `{nome_do_site}`, `{url_curta}`); `{url}` é o link curto `/a/<short_id>`.
- Anúncios fictícios (DDD 20) não abrem WhatsApp: o clique mostra `/r/previa/<código>` com a mensagem. Essa página só existe para eles.
- `HASH_SALT` é obrigatório em `/r`; o Playwright e a CI usam um salt descartável de teste.

## Admin (Fase 5)

- `/admin` (grupo `(painel)`): Início (contagens e alertas), Moderação, Anúncios e Configurações. Login com **Google via Supabase Auth**; o e-mail precisa estar em `ADMIN_EMAILS`. A sessão é validada no servidor com `getUser()`; `src/proxy.ts` (só `/admin`) renova o cookie e marca `noindex`.
- **Toda página e Server Action do admin chama `requireAdmin()`** (`lib/admin/auth.ts`), dentro de `<Suspense>`. Nunca confie só no layout. `currentAdmin()` chama `connection()` (a checagem lê o relógio).
- **Login de teste:** `ADMIN_TEST_LOGIN_EMAIL` entra sem Google, só com `NEXT_PUBLIC_DEMO_MODE` ligado e fora de `VERCEL_ENV=production`; cookie assinado com `HASH_SALT` (12 h). Playwright e CI usam `admin.teste@example.com`. **Nunca defina num ambiente publicado.**
- Dados do admin em `src/lib/admin/` com `sql` por parâmetro (como os jobs). Toda escrita grava `audit_log` (append-only: ator, ação, antes e depois). Correções feitas na moderação vão para `extraction_corrections` (material para o gabarito).
- **`rejected`** some do site, mas uma repostagem volta para `pending_review` (o pipeline grava `listing.reopen`). **`removed`** é o pedido do vendedor e nunca volta.
- Aprovar exige ano-modelo e preço ou contato (a mesma regra do banco). Anúncio ainda em moderação ganha slug novo com os dados corrigidos (mesmo `short_id`); anúncio publicado mantém o slug.
- Formulários: `useActionState` com envio por `startTransition` (o React não limpa os campos quando o servidor devolve erro). Telefone já gravado é mantido mesmo com DDD fictício; telefone novo precisa ser válido.
- Atalhos da moderação: A aprova, S salva, R vai ao motivo da rejeição, J/K próximo/anterior, Ctrl+Enter aprova de dentro de um campo.
- **Operação (5b):** Fontes (contas e hashtags, com o local padrão de cada loja; fontes `.demo`/`_demo` só rodam com `--fixtures`; hashtag nova gasta uma vaga na primeira leitura), Leads, Jobs ("rodar agora" com ensaio e 45 s de orçamento), Remoções, Blocklist e Vendedores (só leitura até a Fase 6).
- **Visitas:** a página do anúncio soma `listing_views_daily` com `after()` (só contador por dia, sem dado do visitante; robôs e prefetch fora). Taxa de contato = leads ÷ visitas. O CSV de leads usa `;` + BOM (Excel em PT-BR), não traz hash de IP/UA e a exportação vai para o `audit_log`.
- **Remoção:** confirmar o pedido põe telefone, @ e posts do anúncio na blocklist (`blockListingContacts`); recusar devolve o anúncio ao ar. Mudar o status para "removido" no admin oferece o mesmo bloqueio.
- **Legenda editada:** o `process-posts` re-extrai uma vez cada legenda editada (`raw_posts.reprocessed_at`) de anúncios não reivindicados no ar ou em moderação, e atualiza preço e km; os valores anteriores ficam no `audit_log` (`listing.caption_update`).
- O e2e reaplica o `seed.sql` antes da suíte (`tests/e2e/global-setup.ts`), porque os testes do admin aprovam e rejeitam anúncios fictícios. Capturas de tela do admin usam o banco de teste (só dados fictícios).

## Vendedor (Fase 6)

- **Remoção sem login** (`/anuncio/[slug]/remover`, `lib/removals/create.ts`): o anúncio sai do ar na hora (`removed`) e o pedido espera o admin (48 h). Contra abuso: campo armadilha e limite de pedidos por aparelho (`removal_requests_per_day`, por hash de IP). O contato de quem pede é opcional.
- **Login do vendedor:** Google via Supabase Auth (`/auth/callback?next=…`) ou login de teste (`SELLER_TEST_LOGIN_EMAIL`, mesmas travas do admin; cookie `bmv_seller_test` assinado com escopo próprio). `requireSellerUser(next)` em toda página e ação do vendedor. O passo a passo do Google está em `docs/login-google.md`.
- **Reivindicação manual:** o vendedor preenche o perfil, aceita os Termos do Anunciante (versão em `content/seller-terms.ts`, aceite em `terms_acceptances`) e recebe um código `RV-XXXXXX` para mandar pelo Direct do Instagram do anúncio para `@buymyvolvo` (`site.instagramHandle`). O admin aprova em Reivindicações: o anúncio passa a ser do vendedor (`seller_id`, `is_claimed`, selo verificado) com os leads antigos; as outras reivindicações pendentes do mesmo anúncio são recusadas.
- **Painel** (`/vendedor`): anúncios do vendedor com visitas (30 dias), contatos (data, canal e código, sem dado do comprador) e "Marcar como vendido" com a pergunta "Vendeu para alguém que chegou pelo site?" (`listings.sold_via_site`; com o código do contato, `leads.outcome`).
- O `audit_log` aceita os atores `seller:<id>` e `public:<origem>`. O e2e limpa o vendedor de teste, as fotos e os pedidos de remoção que criou antes de reaplicar o seed.
- **Edição pelo vendedor (6b)** (`/vendedor/anuncios/[id]`): preço, km, cor, câmbio, combustível, cidade/UF, WhatsApp, Instagram, itens e a descrição própria (`listings.seller_description`, pública, no lugar do resumo automático). Modelo, motor, versão e ano ficam com o admin. Tudo vai para o `audit_log` (`listing.seller_update`).
- **Fotos** (só de anúncio reivindicado, com a licença aceita em `terms_acceptances`/`photo_license`): até 15 por anúncio, 10 MB por arquivo. O navegador reduz a foto antes de enviar (cada pedido fica pequeno) e a rota `POST /vendedor/anuncios/[id]/fotos` confere sessão, dono, licença e limite, depois o `sharp` gira, reduz e grava em WebP (1600 e 640 px) **sem metadados** (EXIF/GPS saem). A primeira foto é a capa (galeria na página e capa no card).
- **Armazenamento:** Supabase Storage (bucket público `listing-photos`, criado no primeiro envio) quando `SUPABASE_SERVICE_ROLE_KEY` existe; sem a chave, só em modo de prévia fora de produção, a pasta local `.data/photos` servida por `/fotos/...`. Sem nenhum dos dois, o envio fica indisponível.
- Consultas públicas de fotos só usam as colunas liberadas ao `anon` (ordem por `position, id`; `created_at` não é público).
- **Planos:** só a estrutura (`lib/billing/plans.ts`: Gratuito, Destaque, Loja Pro; preços "[a definir]") e `BillingProvider` sem implementação. O admin define o plano à mão em Vendedores.

## Produção (Fase 7)

- **SEO:** `/volvo/<modelo>[/<motor|versão|uf>][/<uf>]` (`lib/seo/landing.ts`, puro: as mesmas regras servem página, sitemap e links). Ids de motor, versão e UF não colidem. É a forma indexável dos filtros da busca; `/busca` continua `noindex, follow`. O `proxy.ts` responde 308 (maiúsculas) e 404 (caminho inválido) antes da página começar o streaming. Página com menos de 1 anúncio (modelo) ou 2 (versão/UF) aparece, mas fica `noindex` e fora do sitemap.
- **Preço nas páginas de modelo:** só a faixa dos preços **pedidos** nos nossos anúncios ativos, sem repasses, com o aviso de que não é tabela de referência. Nada de FIPE ou média de mercado sem fonte.
- **Texto das páginas de modelo:** gerado da taxonomia (anos-modelo no Brasil, gerações, combustível); parágrafo editorial opcional em `content/landing-texts.ts` (REVISAR).
- **JSON-LD:** `Car` + `Offer` só em anúncio ativo (sem telefone; imagem só das fotos licenciadas), `BreadcrumbList` nas páginas de modelo, `WebSite` na home. Use `<JsonLd>` (escapa `<`).
- **Metadados para robôs:** o Googlebot entra na lista `htmlLimitedBots` (`next.config.ts`), então canonical, descrição e `noindex` chegam no primeiro `<head>`. Navegadores recebem metadados por streaming.
- **Páginas jurídicas** (`/termos`, `/privacidade`, `/termos-do-anunciante`): rascunhos, `noindex` e fora do sitemap até a revisão do advogado. Descrevem o que o sistema faz hoje; mudou o tratamento de dados, mude o texto.
- **Analytics:** só com `NEXT_PUBLIC_GA_MEASUREMENT_ID` (e/ou `NEXT_PUBLIC_GOOGLE_ADS_ID`). Sem eles, nem banner nem script. Consent Mode **básico**: o Google tag só carrega depois do consentimento; categorias medição e publicidade (a de publicidade só aparece com o Ads configurado, e ligar o Ads pede o consentimento de novo). Eventos: `view_item` (anúncio), `generate_lead` (clique de contato, + conversão do Ads com `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL`) e `search` (sem e-mail/telefone no termo). Clique rastreado = `data-track="<evento>"` + `data-track-params` (JSON). Nunca mande dado pessoal ou do vendedor para o Google.
- **Login por link no e-mail** (`lib/auth/login-link.ts`): admin só para `ADMIN_EMAILS` (resposta igual para qualquer e-mail); vendedor, qualquer e-mail. As rotas de retorno aceitam `token_hash` (modelo de e-mail de `docs/login-email.md`) e `code` (PKCE).
- **Build de produção** (`VERCEL_ENV=production`) falha se faltar `NEXT_PUBLIC_SITE_URL` https, `DATABASE_URL`, `HASH_SALT`, `CRON_SECRET` ou `ADMIN_EMAILS`, ou se houver modo de prévia, login de teste ou salt de teste (`lib/env/production.ts`).
- **Esqueletos de carregamento** têm pelo menos a altura da tela (`min-h-svh`): sem isso o rodapé aparece e pula quando a página chega (CLS no celular).
- **Testes:** `tests/e2e/a11y.spec.ts` (axe, WCAG 2.1 AA, claro e escuro) e `tests/e2e/seo.spec.ts`. O Playwright usa um GA4 falso (`G-E2ETEST000`) e começa com os cookies já "recusados"; `analytics.spec.ts` testa o banner sem isso e nunca carrega o script real.

## Intermediação (Fase 8a)

- **Nada é publicado sem autorização:** o banco exige `listings.authorized_at` para `status = 'active'` (constraint `listings_active_requires_authorization`) e a política pública só mostra anúncios autorizados (vendidos e expirados também). O pipeline nunca publica: `ready` (dados bons, pronto para convidar) ou `moderation` (revisar dados). A migration da 8a devolveu à moderação os anúncios que estavam no ar.
- **Moderação por etapas** (`listing_outreach`; sem linha = "A contatar"): A contatar → Convite enviado → Autorizado → aprovar. Recusa (no link ou registrada pelo admin) rejeita o anúncio; uma repostagem volta para a fila com o aviso. Aprovar exige `authorized_at` (`NEEDS_AUTHORIZATION`).
- **Convite** (`lib/authorization/`): link `/autorizar/<short_id>.<assinatura>`, HMAC com `HASH_SALT` sobre o anúncio e o `invited_at` (nada secreto guardado; "Gerar novo link" invalida o anterior; vale 30 dias). O painel "Autorização do vendedor" mostra a mensagem (`authorization_invite_template`, com `{link}`) para copiar, abrir no WhatsApp do vendedor ou no Direct.
- **Página do convite** (`/autorizar/[codigo]`, `noindex`, sem Google tag): resumo do anúncio, condições (comissão fixa, sem exclusividade, sem a marca/contato do vendedor, fotos do post, dados só para a negociação), formulário (nome, loja/particular, WhatsApp, e-mail opcional, aceite) e os outros anúncios do mesmo vendedor em moderação (mesmo telefone ou mesma conta de loja). O aceite cria ou reaproveita o vendedor pelo WhatsApp (`verified_via = 'invite_link'`), grava `seller_terms` + `photo_license` e a comissão aceita (`listing_outreach.commission_cents`), com `audit_log` (`public:authorization`).
- **Comissão:** `app_settings.seller_commission_brl` (reais inteiros); 0 = não definida, e aí convite e página do convite ficam bloqueados (o vendedor precisa ver o valor). Valor de negócio: **não invente**, o dono do produto define em Configurações.
- **Contato pelo WhatsApp do site:** `/r` grava o lead e redireciona para `app_settings.bmv_whatsapp_numbers` (um número compartilhado pelos sócios em aparelhos conectados, ou vários com revezamento: `leads.routed_to`; clique repetido mantém o número). Sem número configurado, o botão some e `/r` volta ao anúncio. O seed usa um número fictício (DDD 20) e o clique mostra `/r/previa`.
- Termos do Anunciante v2 (`content/seller-terms.ts`, versão `2026-11-19-rascunho`), Termos de Uso e Privacidade descrevem a intermediação. Rascunhos para o advogado.
- **Identidade do vendedor:** quem autoriza (convite) ou cadastra (formulário) informa o **CPF**, obrigatório (de loja, o do responsável), e o **CNPJ**, opcional para loja. Os dois são conferidos pelos dígitos verificadores (`lib/identity/document.ts`, com o CNPJ alfanumérico de 2026), no navegador ao sair do campo e de novo no servidor. Ficam em `sellers.cpf`/`sellers.cnpj` (privados; um vendedor por CPF), aparecem só no painel do admin e nunca no site. O vendedor é encontrado primeiro pelo CPF, depois pelo WhatsApp.

## Fontes legítimas (Fase 9)

- **Anúncio a partir de texto colado (9a)** (`/admin/anuncios/novo`, `lib/admin/manual.ts`): o admin cola o texto que o vendedor mandou ou que **copiou à mão** de um anúncio dele em outro site (WhatsApp, OLX, Webmotors, Marketplace…), com a origem, o link (opcional, só para consulta) e o WhatsApp (opcional, vale mais que o do texto). A mesma extração e normalização dos posts lê o texto; bloqueio e deduplicação valem igual ("criar mesmo assim" para outro carro; anúncio `removed` nunca volta). Cria um anúncio `origin = 'admin'` em moderação ("A contatar"), que segue o fluxo de autorização da 8a.
- O texto fica em `manual_sources` (privada, como a legenda; nunca publicado). **Nada é buscado automaticamente** em outros sites: nem scraping, nem leitura do link.
- Anúncios do admin não expiram sozinhos (não há post para reler): o admin marca vendido/expirado.
- **Formulário público "Anuncie seu Volvo" (9b)** (`/anunciar`, `lib/submissions/`): o vendedor preenche o carro (modelo e, por modelo, só motores e versões vendidos no Brasil), o local, as fotos e os dados dele, vê a comissão e aceita os Termos do Anunciante. O anúncio entra em moderação **já autorizado** (`origin = 'direct'`, `authorized_at`, `listing_outreach` autorizado com a comissão; aba "Autorizados"). O WhatsApp digitado não é comprovado (`verified_via` nulo): o admin confirma com o vendedor antes de aprovar.
- Descrição do formulário é pública (`seller_description`): telefone, e-mail, @ ou link nela são recusados (o comprador fala com o site). Fechado enquanto a comissão não estiver definida.
- **Fotos do formulário:** o navegador manda uma por pedido para `POST /anunciar/fotos` com um token assinado (HMAC com `HASH_SALT`, 2 h, `lib/submissions/photo-token.ts`), só para anúncio do formulário ainda em moderação; mesmo processamento da Fase 6 (sharp, sem metadados, até 15). A licença é a seção 5 dos Termos do Anunciante. O admin vê as fotos na moderação e pode excluí-las.
- Contra abuso: campo armadilha, limite por aparelho (`public_listings_per_day`, hash do IP em `listing_submissions`) e blocklist; anúncio parecido com um existente entra com a nota em `review_note`.

## Design (Fase 10)

- **Fonte da verdade visual:** `DESIGN.md` (tokens no frontmatter, regras na prosa) e `PRODUCT.md` (público, posicionamento, princípios); o espelho `.impeccable/design.json` acompanha o DESIGN.md. Mudou cor, tipo ou componente? Atualize os dois.
- **Skill `impeccable`** (`.claude/skills/impeccable`; o binário vem de impeccable.style e fica fora do git): depois de mexer em interface, `impeccable detect --json <arquivos>`. Avaliações locais em `.impeccable/critique/` (fora do git e do Prettier).
- **Placa do modelo** (`model-plate.tsx`): Gelo Azul, nome em Azul Fiorde a 70% (60% no escuro, para manter 3:1 como todo texto grande) e linha de ficha de `lib/listings/plate.ts` (só taxonomia).
- **Termos Volvo explicados** (`lib/taxonomy/explain.ts`): "Entenda o nome" no anúncio, motores com o combustível na página de modelo e agrupados por combustível nos filtros, "V40 (inclui Cross Country)" nos filtros e nos chips. Os textos saem só da taxonomia e do significado geral do termo; o mesmo termo usa sempre as mesmas palavras.
- **Formulários públicos:** `PUBLIC_FIELDS` no `<form>` (campos de 44px em Papel, 16px no celular), `CHOICE_ROW`/`CHOICE_BOX` para rádios e caixas, `SellerTypeChoice` (o CNPJ só aparece para loja) e `PhotoPicker` (nenhuma foto sai em silêncio: acima de 10 MB, além do limite ou que não seja imagem, aparece um aviso). O `Field` liga a dica ou o erro ao campo (`aria-describedby`) sozinho.
- **Alvos de toque:** no celular, tudo o que se toca tem pelo menos 44px (links soltos ganham área com `-my-3 py-3`, sem mudar o layout). Títulos equilibram as linhas e parágrafos evitam palavra sozinha (base do `globals.css`).
- O aviso "did not produce a static shell" no servidor de desenvolvimento já existia antes da Fase 10 (só em dev; o build passa).

## Variáveis de ambiente

- Segredos **só** em variáveis de ambiente. **Nunca** commite `.env*` (o `.gitignore` já bloqueia). Mantenha `.env.example` atualizado a cada variável nova.
- Variáveis públicas (`NEXT_PUBLIC_*`) passam por `src/lib/env/public.ts`, com referência literal para o Next conseguir inlinar. Segredos passam por `serverEnv()` em `src/lib/env/server.ts`, que importa `server-only`.
- Cada módulo exige o que usa com `requireKeys(serverEnv(), ["ANTHROPIC_API_KEY"])`, que gera um erro claro listando o que falta.

## Regras inegociáveis (compliance)

1. **Proibido scraping do Instagram.** Nada de navegador headless, login automatizado, bibliotecas não oficiais (instaloader, instagrapi etc.), proxies ou engenharia reversa. Somente a **API oficial da Meta** (Graph API em `graph.facebook.com`). Vale também "só para testar".
2. **Imagens de terceiros:** nada vai ao ar sem a **autorização do vendedor** (Termos do Anunciante com a licença das fotos, `terms_acceptances`). Fotos no nosso storage só de anúncio autorizado ou reivindicado, com a licença aceita. Sem autorização, nenhuma foto é copiada nem reprocessada.
3. **Legenda original:** a página mostra dados estruturados + um resumo escrito com palavras próprias (IA) ou a descrição do vendedor; nunca a legenda completa. A página pública não mostra o nome, o telefone, o @ nem o post do vendedor (modelo intermediado).
4. **LGPD:** do vendedor, guarde o que o anúncio publicou e o que ele informou ao autorizar (nome, tipo, WhatsApp, CPF, CNPJ opcional, e-mail opcional), só para a intermediação. CPF e CNPJ nunca vão para o site nem para o Google. Toda página de anúncio tem **"Este anúncio é seu? Remover | Reivindicar"**. Remoção processada em até 48h, com **blocklist** que impede reimportar. **O clique no botão de contato não coleta dado pessoal do comprador**: IP e user agent só em **hash com salt** (`HASH_SALT`). Dados que o comprador passar na conversa do WhatsApp servem só para a negociação (registro no CRM da Fase 8b).
5. **Transparência:** todo anúncio exibe "Anúncio intermediado pelo {site}…", diz que o {site} não recebe pagamento pelo carro e mostra o bloco de dicas de segurança. A comissão é paga pelo vendedor e aparece na página de autorização antes do aceite.
6. **Marca Volvo:** uso apenas descritivo. **Sem logotipo, sem "iron mark", sem elementos visuais oficiais.** O rodapé sempre mostra "Não afiliado à Volvo Car Corporation." (`site.brandDisclaimer`).
7. **Segredos** só em env; `.env.example` sempre atualizado.
8. Textos jurídicos (termos, privacidade, termos do anunciante) são **rascunhos marcados para revisão por advogado**.

Também não faça:

- Não invente dados de mercado (preço médio, FIPE) sem fonte; proponha a integração antes.
- Não armazene dados pessoais do comprador fora da negociação (nada no clique; o CRM da Fase 8b guarda só o necessário, com a finalidade escrita).
- Não pule fases.

## Fatos da API da Meta (conferidos em nov/2026; detalhes em `docs/meta-setup.md`)

- **Conta:** @buymyvolvo, app "Buy My Volvo" em modo de desenvolvimento, token de usuário de 60 dias (vence 07/01/2027). Página no Business Suite ⇒ o token precisa também de `business_management` e `ads_read`.
- **Confirmado em 08/11/2026:** Business Discovery funciona com _Standard Access_ (sem App Review, sem CNPJ). Hashtag Search também respondeu em modo de desenvolvimento (contrariando a doc); tratar como bônus. Conta inexistente, pessoal ou com restrição de idade responde `110`/`2207013`.

- Graph API vigente: **v27.0** (`META_GRAPH_VERSION`).
- **Business Discovery:** `GET /{IG_USER_ID}?fields=business_discovery.username(x){...}`. Permissões: `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`. Paginação por `before`/`after` montados à mão. Contas age-gated e pessoais não retornam. `GET` direto num media retornado falha.
- **Hashtag Search:** exige App Review do recurso **Instagram Public Content Access** + `instagram_basic`. Limite de **30 hashtags únicas por 7 dias (janela móvel)**. `recent_media` **e** `top_media` contam no limite. `recent_media` traz só as últimas 24h, até 50 por página, só cursor `after` (sempre igual), **sem `username`** e sem posts impulsionados. `GET /{ig-user-id}/recently_searched_hashtags` mostra o que já contou na janela.
- Business Discovery e Hashtag Search seguem o **Platform Rate Limiting** (header `X-App-Usage`), não o BUC. Leia os dois headers (`X-App-Usage` e `X-Business-Use-Case-Usage`).
- O endpoint de oEmbed exige App Review de **Meta oEmbed Read**. Os metadados servem **só para exibição**; nunca extraia nem persista nada deles.
