# Prompt para o Claude Code: Marketplace de Volvo seminovos e usados (Brasil)

> **Como usar:** crie uma pasta vazia para o projeto, salve este arquivo nela como `PROMPT.md`, abra o Claude Code nessa pasta e diga:
> *"Leia o PROMPT.md inteiro e comece pela Fase 0. Pare ao fim de cada fase, me mostre o resultado e espere minha aprovação antes de seguir."*

---

## 1. Seu papel e forma de trabalho

Você é um engenheiro full-stack sênior e vai construir comigo, do zero, um agregador e buscador de anúncios de Volvo seminovos e usados no Brasil.

Regras de trabalho:

- **Trabalhe em fases** (seção 13). Antes de cada fase, apresente um plano curto (o que vai fazer, arquivos principais, decisões em aberto). Ao final de cada fase: rode o build, rode os testes, me mostre um **preview visual** (servidor local, screenshots ou URL de preview), liste pendências e **espere minha aprovação**.
- Quando houver decisão ambígua ou de negócio, **pergunte**. Não invente credenciais, nomes de domínio, preços de planos ou textos jurídicos definitivos.
- Converse comigo em **português do Brasil**. Código, nomes de tabelas e variáveis em inglês. Toda a interface em PT-BR.
- Ao terminar a Fase 0, crie um `CLAUDE.md` na raiz com as convenções do projeto (stack, comandos, regras de compliance da seção 3) para que sessões futuras mantenham o padrão.
- Commits pequenos e descritivos ao fim de cada etapa relevante.

---

## 2. O produto

**[NOME_DO_SITE]** (placeholder; pergunte o nome e o domínio na Fase 0) é um buscador de anúncios de Volvo à venda no Brasil.

**Fontes de anúncios:**
1. Posts de venda publicados no Instagram por lojas e particulares, coletados **exclusivamente pela API oficial da Meta** (seção 7).
2. Anúncios cadastrados diretamente por vendedores no site.

**Jornada do comprador:**
1. Busca em texto livre, ex.: `s60 t5`, `xc60 t8 polestar sp`, `xc40 elétrico até 200 mil`.
2. Vê resultados com dados estruturados (modelo, versão, ano, km, preço, cidade/UF).
3. Abre o anúncio e clica em **"Falar com o vendedor no WhatsApp"**.
4. O WhatsApp abre com uma mensagem pré-preenchida que identifica que o contato veio do [NOME_DO_SITE], com um código de referência único.

**Modelo de receita (orienta o design do banco e das telas):**
- **Anúncios reivindicados:** o vendedor (principalmente lojistas) prova que é dono do anúncio, aceita os Termos do Anunciante e ganha anúncio completo (fotos, destaque, painel de leads). A cobrança vem daqui: comissão de sucesso contratada, plano mensal ou destaque pago.
- **Anúncios não reivindicados:** exibidos de forma resumida, com link para o post original. Geram tráfego e servem de argumento comercial ("seu anúncio recebeu 14 contatos pelo nosso site este mês, quer o painel completo?").
- **Futuro:** parcerias de financiamento, seguro, vistoria cautelar e oficinas especializadas em Volvo.
- **Todo lead precisa ser registrado de forma auditável**, porque é a base de qualquer cobrança.

**Integração possível:** já existe a comunidade Made by Sweden (madebysweden.com.br, em WordPress, com seção de classificados e o Instagram @madebysweden.br). Na Fase 0, pergunte se o marketplace vai viver em subdomínio da comunidade, em domínio próprio, ou se deve haver links cruzados.

---

## 3. Regras inegociáveis (compliance)

1. **Proibido scraping do Instagram.** Nada de navegador headless, login automatizado, bibliotecas não oficiais (instaloader, instagrapi e similares), proxies ou engenharia reversa de endpoints. Somente a **Instagram API with Facebook Login** (Graph API oficial).
2. **Imagens de terceiros:** fotos de anúncios **não reivindicados não são copiadas** para o nosso storage nem reprocessadas. Exibir pelo embed oficial do Instagram (oEmbed) ou por um card com link para o post e crédito ao autor. Fotos hospedadas por nós só de vendedores que aceitaram os termos e concederam licença, ou que cadastraram direto.
3. **Legenda original:** em anúncio não reivindicado, mostrar dados estruturados + um resumo escrito por nós (gerado pela IA com palavras próprias). A legenda completa fica no embed ou no link para o post.
4. **LGPD:** armazenar o mínimo necessário do vendedor (telefone e @ publicados no próprio anúncio). Toda página de anúncio tem **"Este anúncio é seu? Remover | Reivindicar"**. Remoção processada em até 48h, com **blocklist** para não reimportar. Política de Privacidade e Termos de Uso publicados. **Não coletar dados pessoais do comprador** para o clique no WhatsApp; IP e user agent apenas em hash com salt.
5. **Transparência:** aviso em todo anúncio: "Anúncio de terceiro. O [NOME_DO_SITE] não participa da negociação." Bloco de dicas de segurança (nunca pagar sinal antes de ver o carro, desconfiar de preço muito abaixo da tabela, conferir documento e fazer vistoria cautelar).
6. **Marca Volvo:** usar o nome apenas de forma descritiva. Não usar o logotipo, o "iron mark" nem elementos visuais oficiais da Volvo, e exibir no rodapé "Não afiliado à Volvo Car Corporation".
7. **Segredos** só em variáveis de ambiente. Nunca commitar `.env`. Manter `.env.example` atualizado.
8. Textos jurídicos (termos, privacidade, termos do anunciante com cláusula de comissão) são **rascunhos marcados para revisão por advogado**.

---

## 4. Stack

- **Next.js** (App Router, TypeScript estrito, Server Components), **Tailwind CSS** + **shadcn/ui**.
- **Supabase**: Postgres, Auth, Storage, migrations SQL versionadas no repositório, Row Level Security em todas as tabelas.
- **Busca:** Postgres full-text (configuração `portuguese`) + extensões `unaccent` e `pg_trgm`. Só propor Meilisearch/Typesense se a busca em Postgres se mostrar insuficiente.
- **Jobs agendados:** rotas de cron protegidas por `CRON_SECRET` (Vercel Cron) ou Supabase scheduled functions. Todo job idempotente, com lock para não rodar em paralelo consigo mesmo.
- **IA:** Anthropic API, modelo Haiku mais recente para extração (ex.: `claude-haiku-5-5`; confirme o nome na documentação e deixe configurável por env), com saída estruturada via tool use / JSON schema e validação com **Zod**.
- **Testes:** Vitest (unidade) e Playwright (e2e das jornadas principais).
- **Deploy:** Vercel + Supabase. Analytics leve (Plausible ou Vercel Analytics).

Se tiver um motivo forte para trocar alguma peça, proponha antes de implementar.

---

## 5. Taxonomia Volvo (o coração da busca)

Crie tabelas `vehicle_models` e `vehicle_trims` com **aliases** e **faixas de ano válidas**. Faça o seed inicial abaixo, corrija e complete com seu conhecimento, e **marque com `-- REVISAR` o que tiver dúvida** para eu validar.

**Modelos (com gerações quando fizer sentido):**
240, 740, 760, 850 (incl. T-5R e R), 940, 960, S40, V40 (1ª e 2ª geração), V40 Cross Country, V50, C30, C70, S60 (1ª, 2ª e 3ª geração), S60 Cross Country, V60, V60 Cross Country, S70, V70, XC70, S80, S90, V90, V90 Cross Country, XC40, EX40 (ex-XC40 Recharge Pure Electric), C40, EC40 (ex-C40 Recharge), XC60 (1ª e 2ª geração), XC90 (1ª e 2ª geração), EX30, EX90, ES90.

**Motorizações e versões:**
T2, T3, T4, T5, T6, T8, D3, D4, D5, B4, B5, B6, Recharge, Pure Electric, Single Motor, Twin Motor, Polestar, Polestar Engineered, R, R-Design, Inscription, Momentum, Kinetic, Dynamic, Summum, Ultimate, Plus, Core, Ultra.

**Atributos derivados:** combustível (gasolina, diesel, híbrido leve, híbrido plug-in, elétrico), plataforma (P80, P1, P2, P3, SPA, CMA, SEA) e geração por faixa de ano.

**Aliases de exemplo:** `s60t5`, `s-60`, `s 60`, `xc 60`, `xc60t8`, `t8 polestar`, `rdesign`, `r design`, `r-desing` (erro comum de digitação), `recharge`, `elétrico`/`eletrico`.

**Parser de busca:** implemente uma função determinística `parseQuery(text)` que transforma texto livre em filtros (`model`, `trim`, `yearMin`, `yearMax`, `priceMax`, `kmMax`, `uf`, `fuel`, `sellerType`) usando os aliases. O que sobrar vai para o full-text. Precisa ter testes cobrindo, no mínimo:

| Entrada | Esperado |
|---|---|
| `s60 t5` | modelo S60 + motor T5 (e **não** retornar S60 T4, V60 T5 etc.) |
| `S60T5 2019` | S60, T5, ano 2019 |
| `xc60 t8 polestar` | XC60, T8, versão Polestar Engineered |
| `xc40 elétrico até 200 mil` | XC40/EX40 elétrico, preço ≤ 200.000 |
| `v40 r-design sp` | V40, R-Design, UF = SP |
| `xc90 t8 2020 a 2022 até 60 mil km` | XC90, T8, ano 2020–2022, km ≤ 60.000 |
| `850 t5r` | 850 T-5R |
| `c30 t5 manual` | C30, T5, câmbio manual |
| `volvo de loja em curitiba` | sellerType = loja, cidade Curitiba |

---

## 6. Modelo de dados (ponto de partida)

Proponha o schema final na Fase 1. Mínimo esperado:

- **`sources`**: id, type (`ig_business_account` | `ig_hashtag` | `manual`), handle, active, poll_interval_minutes, last_polled_at, notes.
- **`raw_posts`**: id, ig_media_id (unique), source_id, permalink, caption, media_type, ig_username (nullable), posted_at, fetched_at, processing_status (`pending` | `not_listing` | `extracted` | `error`), extraction_json, extraction_model, tokens_in, tokens_out.
- **`listings`**: id, slug, status (`pending_review` | `active` | `sold` | `expired` | `removed`), model_id, trim_id, engine, year_fab, year_model, km, price_cents, city, uf, color, transmission, fuel, options (text[]), summary_ptbr, seller_type (`loja` | `particular` | `desconhecido`), seller_id (nullable), contact_phone_e164, contact_ig_username, confidence, red_flags (text[]), is_claimed, first_seen_at, last_seen_at, expires_at, dedupe_key.
- **`listing_sources`**: liga um listing a um ou mais raw_posts (o mesmo carro anunciado em vários lugares).
- **`listing_photos`**: apenas para anúncios reivindicados ou cadastrados direto (storage próprio, com licença registrada).
- **`sellers`**: id, display_name, type, phone_e164, ig_username, email, verified_via (`instagram_login` | `whatsapp_code` | `manual`), terms_version_accepted, terms_accepted_at, plan, commission_rate (nullable).
- **`leads`**: id, listing_id, seller_id (nullable), ref_code (unique, curto e legível, ex.: `VX-7K3P`), channel (`whatsapp` | `instagram`), created_at, ip_hash, ua_hash, referrer, utm_source/medium/campaign, outcome (`unknown` | `sold_via_site` | `not_sold`), outcome_reported_at.
- **`removal_requests`** e **`blocklist`** (por ig_media_id, telefone ou @).
- **`hashtag_budget`**: controla as hashtags consultadas na janela móvel de 7 dias.
- **`job_runs`**: logs de cada execução (coletados, descartados, publicados, enviados à moderação, erros, custo estimado de IA).
- **`saved_searches`** (fase opcional): alertas por e-mail.

Índices: GIN para full-text e trigram, índices compostos para os filtros mais usados (model_id, trim_id, year_model, price_cents, uf, status).

---

## 7. Pipeline de coleta (Instagram API oficial)

### 7.1 Pré-requisitos (me dê um passo a passo na Fase 0 para eu fazer no painel da Meta)
- Conta **profissional** do Instagram (Business ou Creator), por exemplo a do próprio site ou a @madebysweden.br, vinculada a uma **Página do Facebook**.
- App no Meta for Developers, do tipo Business, com **Business Verification**.
- **App Review** para as permissões `instagram_basic`, `pages_read_engagement`, `instagram_manage_insights` (Business Discovery) e para a feature **Instagram Public Content Access** (Hashtag Search). Prepare os textos de caso de uso e o roteiro do screencast que a Meta pede.
- Token de longa duração com **rotina automática de renovação** e alerta antes de expirar.
- Enquanto o App Review não sai: desenvolver com **respostas mockadas da API** (fixtures JSON) e testar o que for possível em modo desenvolvimento.

### 7.2 Fonte A: Business Discovery (fonte principal)
- Lista curada de @ de lojas e vendedores com conta profissional, gerenciada no admin.
- Job a cada 2–3h por conta:
  `GET /{IG_USER_ID}?fields=business_discovery.username({username}){username,name,biography,website,media.limit(25){id,caption,media_type,media_url,permalink,timestamp}}`
- Paginação por cursores `before`/`after` montados manualmente (a resposta não traz `next`/`previous`).
- Contas pessoais e contas com restrição de idade não retornam dados: registrar e seguir.
- `GET` direto num media retornado falha por permissão; toda leitura passa pelo Business Discovery.
- A bio costuma trazer telefone/WhatsApp e cidade: usar como fallback de contato e localização.

### 7.3 Fonte B: Hashtag Search (fonte complementar)
- Limite de **30 hashtags únicas por 7 dias (janela móvel)** por conta. Configurar no máximo ~25 para ter margem; a tabela `hashtag_budget` impede estourar o limite.
- `recent_media` só traz posts das **últimas 24 horas** → job **a cada 1h**. Máximo de 50 itens por página. Não retorna posts impulsionados.
- **Não retorna o username**: o contato vem da legenda (telefone). Sem telefone, o botão principal vira "Ver no Instagram" (permalink).
- Hashtags genéricas trazem posts do mundo todo: descartar o que não for do Brasil (sem R$, sem DDD/+55, legenda em outro idioma).
- Sugestões iniciais (validar comigo): #volvoavenda #volvoseminovo #volvousado #volvoxc60 #volvoxc40 #volvoxc90 #volvos60 #volvov40 #volvoc40 #volvoex30 #volvot8 #volvoxc60t8 #volvobrasil.

### 7.4 Fonte C: cadastro direto
Formulário para o vendedor anunciar no site, com upload de fotos (licença concedida no aceite) e validação do WhatsApp. Já nasce reivindicado.

### 7.5 Processamento (para cada raw_post)
1. **Ingestão** com upsert por `ig_media_id` (idempotente). Checar blocklist antes de qualquer coisa.
2. **Pré-filtro barato (regex, sem IA):** precisa mencionar Volvo ou um modelo da taxonomia **e** ter sinais de venda (R$, "vendo", "à venda", "km", "aceito troca", "financio", "repasse", "particular", "loja"). Se não passar → `not_listing`.
3. **Extração com Claude** (tool use + JSON schema), retornando: `is_vehicle_for_sale`, `confidence`, `model`, `trim`, `engine`, `year_fab`, `year_model`, `km`, `price`, `city`, `uf`, `color`, `transmission`, `fuel`, `options[]`, `seller_type`, `phones[]`, `summary_ptbr` (2–3 frases com palavras próprias, sem copiar a legenda), `red_flags[]` (preço muito abaixo do mercado, "repasse", pedido de sinal, "documento atrasado", leilão, sinistro). System prompt com a taxonomia e exemplos few-shot. Temperatura baixa. Validar com Zod; 1 retry se inválido.
4. **Normalização pós-IA:** casar modelo/versão com a taxonomia (aliases + trigram); telefone para E.164 (+55 + DDD); preço em centavos (entender "189k", "189 mil", "R$ 189.900,00"); km inteiro ("58mil", "58.000 km"); anos válidos. **Checar coerência** modelo × motor × ano pela tabela de faixas (ex.: EX30 só a partir de 2024; T8 só nas plataformas SPA) e reduzir a confiança quando houver incoerência.
5. **Deduplicação:** `dedupe_key` = hash(modelo, versão, ano_modelo, km arredondado, telefone) + similaridade de texto. O mesmo carro vindo de várias fontes vira um único listing com várias `listing_sources`.
6. **Publicação:** `confidence ≥ 0.85` + campos mínimos (modelo, ano e preço ou contato) → `active`. Caso contrário → fila de moderação.
7. **Ciclo de vida:** atualizar `last_seen_at` quando o post reaparece. Para Business Discovery, reler a legenda: se aparecer "vendido" → `sold`; se o post sumir → `expired`. Posts de hashtag não podem ser reconsultados: aviso "pode não estar mais disponível" após 14 dias e expiração em 30 dias (ambos configuráveis).
8. **Resiliência e observabilidade:** backoff exponencial em erros de rate limit (ex.: códigos 4, 17, 32, 613, 80002) e leitura do header `X-Business-Use-Case-Usage`; log em `job_runs`; alerta de token expirando; estimativa de custo de tokens por execução.

---

## 8. Experiência do comprador (frontend)

**Direção visual:** mobile-first, estética escandinava (muito respiro, tipografia limpa, tons neutros com um acento azul-aço), tema claro e escuro, acessível (contraste AA, navegação por teclado), rápido (LCP < 2,5s). Sem logotipo da Volvo.

**Páginas:**
- **Home:** campo de busca em destaque, chips de modelos populares, anúncios recentes, "como funciona" em 3 passos, dicas de segurança.
- **Resultados (`/busca?q=...`):** filtros (lateral no desktop, bottom sheet no mobile): modelo, versão, ano, km, preço, UF, combustível, câmbio, loja/particular. Ordenação: mais recentes, menor preço, menor km. Cards com modelo + versão, ano, km, preço, cidade/UF, origem, selo "Vendedor verificado" quando reivindicado e "publicado há X dias". Paginação numerada (melhor para SEO). Estado vazio útil (sugerir buscas próximas e "me avise quando aparecer").
- **Anúncio (`/anuncio/[slug]`):** dados estruturados, resumo, embed do post (não reivindicado) ou galeria (reivindicado), CTA do WhatsApp fixo no rodapé no mobile, botão secundário "Ver no Instagram", aviso de terceiro, dicas de segurança, bloco "o que checar neste modelo" por modelo/motorização (ex.: T8 → histórico de manutenção do sistema híbrido e do ERAD; pode linkar para conteúdo da comunidade Made by Sweden), e o link "Este anúncio é seu?".

**Contato via WhatsApp:**
- O botão aponta para `/r/[ref]`, que **registra o lead** e responde com redirect 302 para `https://wa.me/{telefone E.164 sem o +}?text={encodeURIComponent(mensagem)}`.
- Mensagem padrão (editável no admin, com variáveis):
  `Olá! Vi seu Volvo {modelo} {versão} {ano} anunciado no {NOME_DO_SITE} ({url_curta}). Ainda está disponível? (ref. {REF})`
- Sem telefone: botão leva ao permalink do post ou a `https://ig.me/m/{username}` e registra o lead com `channel = instagram`.
- Proteção contra inflar leads: deduplicar cliques do mesmo hash de IP+UA no mesmo anúncio em 24h e ignorar bots conhecidos.

---

## 9. Lado do vendedor

- **Reivindicar anúncio**, provando posse por: (a) Login com Instagram (contas profissionais), (b) código enviado ao WhatsApp do anúncio (fase posterior, via WhatsApp Business Platform) ou (c) verificação manual pelo admin.
- Ao reivindicar: aceita os **Termos do Anunciante** (versão registrada, com cláusula de comissão de sucesso ou plano, rascunho para revisão jurídica) e ganha um **painel** com seus anúncios, leads por anúncio (data, canal, ref), edição de dados, upload de fotos e o botão **"Marcar como vendido"**, que pergunta: *"Vendeu para alguém que chegou pelo [NOME_DO_SITE]?"*, alimentando `leads.outcome`.
- **Planos:** só a estrutura na v1 (Gratuito, Destaque, Loja Pro) e uma interface `BillingProvider` para plugar Mercado Pago, Asaas ou Stripe depois. Sem cobrança real na v1.
- **Remoção** sem login: formulário simples → `removal_requests` → blocklist. O anúncio sai do ar imediatamente (status `removed`) e o admin só confirma.

---

## 10. Painel administrativo (`/admin`)

Acesso restrito a e-mails em `ADMIN_EMAILS` (role admin via Supabase Auth). Telas:
- **Moderação:** fila com o post original (embed) lado a lado com os campos extraídos editáveis; aprovar/rejeitar/corrigir com atalhos de teclado; correções salvas para melhorar o few-shot depois.
- **Fontes:** contas monitoradas (adicionar/pausar), hashtags e orçamento da janela de 7 dias.
- **Anúncios:** busca e mudança de status.
- **Leads:** por dia, anúncio e vendedor; taxa de clique por anúncio; export CSV.
- **Vendedores, remoções, blocklist.**
- **Jobs:** histórico de execuções, erros e custo de IA.
- **Configurações:** template da mensagem do WhatsApp, limiares de confiança, prazos de expiração.

---

## 11. SEO

- Páginas de modelo/versão/UF: `/volvo/[modelo]`, `/volvo/[modelo]/[versao]`, `/volvo/[modelo]/[versao]/[uf]`, com contagem de anúncios ativos, faixa de preço observada e um texto curto revisável.
- Dados estruturados schema.org `Car` + `Offer` só para anúncios ativos.
- Sitemap dinâmico, metadata e Open Graph por página, canonical nas combinações de filtros, `noindex` em páginas vazias.

---

## 12. Variáveis de ambiente (`.env.example`)

```
NEXT_PUBLIC_SITE_NAME=
NEXT_PUBLIC_SITE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL_EXTRACTION=
META_APP_ID=
META_APP_SECRET=
META_GRAPH_VERSION=        # ex.: v25.0 (confirmar a versão vigente)
IG_BUSINESS_USER_ID=
IG_LONG_LIVED_TOKEN=
CRON_SECRET=
ADMIN_EMAILS=
HASH_SALT=
```

---

## 13. Fases de entrega

**Fase 0: Descoberta e setup**
Confirmar nome, domínio e relação com a Made by Sweden. Criar o repositório, estrutura de pastas, lint/format, `.env.example`, `README`, `CLAUDE.md`. Entregar o passo a passo do app Meta e do App Review (7.1).
*Saída:* projeto rodando localmente + plano revisado.

**Fase 1: Taxonomia, banco e busca com dados fictícios**
Migrations, seed da taxonomia, ~60 anúncios fictícios realistas (sem fotos de terceiros: use placeholders), `parseQuery` com os testes da seção 5, telas Home, Resultados e Anúncio navegáveis.
*Saída:* preview navegável para eu aprovar o visual e a qualidade da busca.

**Fase 2: Extração com IA**
Pré-filtro, extração com Claude, normalização, checagem de coerência e deduplicação. Criar um conjunto de **40 legendas de teste realistas em PT-BR** (emojis, gírias, "aceito troca", "repasse", "189k", "R$189.900,00", "58mil km", ano "19/20", posts que **não** são venda) com o gabarito esperado.
*Saída:* comando `npm run extract:eval` com relatório de acurácia por campo e custo estimado por 1.000 posts.

**Fase 3: Conectores do Instagram**
Cliente tipado da Graph API, jobs de Business Discovery e Hashtag Search, controle do orçamento de hashtags, rate limit, renovação de token e modo `--dry-run`. Tudo funcionando contra fixtures quando não houver token real.
*Saída:* jobs rodando localmente contra mocks; com token, um teste real numa conta autorizada.

**Fase 4: Leads e WhatsApp**
Rota `/r/[ref]`, registro de lead, deduplicação de cliques, mensagem configurável, fallback para Instagram.
*Saída:* clique gera lead e abre o WhatsApp com a mensagem certa (testado no celular).

**Fase 5: Admin e moderação**
Todas as telas da seção 10.

**Fase 6: Vendedor**
Reivindicação, termos versionados, painel do vendedor, "marcar como vendido", remoção e blocklist.

**Fase 7: Produção**
SEO (seção 11), páginas legais em rascunho, analytics, revisão de performance e acessibilidade, deploy (Vercel + Supabase), crons em produção e um `RUNBOOK.md` (renovar token, adicionar loja, tratar remoção, o que fazer se a API falhar).

**Fase 8 (opcional): Crescimento**
Alertas de busca por e-mail, planos pagos com gateway, código de verificação por WhatsApp, página de parceiros (financiamento, seguro, vistoria, oficinas).

---

## 14. Critérios de aceite gerais

- Ao fim de cada fase: `build`, `lint` e testes passando.
- `s60 t5` retorna apenas S60 com motor T5 e entende as variações de escrita; `xc60 t8 sp até 250 mil` aplica todos os filtros.
- Nenhuma imagem de anúncio não reivindicado no nosso storage.
- Cada clique no WhatsApp gera um lead com `ref_code` único e abre a conversa com a mensagem correta.
- Jobs idempotentes: rodar duas vezes seguidas não duplica nada.
- Um anúncio removido sai do site imediatamente e não volta na coleta seguinte.
- Nenhum segredo no repositório.

## 15. O que não fazer

- Não usar scraping nem qualquer acesso não oficial ao Instagram, mesmo "só para testar".
- Não inventar dados de mercado (preço médio, tabela FIPE) sem fonte; se quiser comparar com FIPE, proponha a integração antes.
- Não usar logotipo ou identidade visual da Volvo.
- Não pular fases nem seguir sem minha aprovação.
- Não adicionar dependências pesadas sem justificar.
- Não armazenar dados pessoais do comprador.
