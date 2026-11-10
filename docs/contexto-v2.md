# Contexto para a v2 (resumo até 10/11/2026)

Prompt para abrir uma conversa nova sobre a v2 do Buy My Volvo. Copie tudo abaixo da linha.

---

Vamos planejar a **v2 do Buy My Volvo** (https://buymyvolvo.com.br), repositório `rafaelgobor911/buymyvolvo`, branch `main`. Converse comigo em português do Brasil.

**Antes de propor qualquer coisa, leia no repositório:**

- `CLAUDE.md`: convenções, stack, regras de compliance e de cada fase.
- `docs/plano.md`: decisões e pendências de cada fase.
- `RUNBOOK.md`: operação em produção.
- `docs/PROMPT.md`: especificação original.

## O que é

Agregador e buscador de anúncios de Volvo seminovos e usados no Brasil. Os anúncios vêm do Instagram, **só pela API oficial da Meta** (Business Discovery de lojas e Hashtag Search), e de vendedores que reivindicam o anúncio.

Uma IA (Claude Haiku 5.5, structured outputs) extrai os dados da legenda e escreve um resumo com palavras próprias. O comprador busca em texto livre ("xc60 t8 sp até 250 mil") e fala com o vendedor pelo WhatsApp, com um código de lead `VX-XXXXX`.

## Estado atual

- **Fases 0 a 7 concluídas.** O site está no ar desde 10/11/2026.
- **Coleta:** cerca de 30 anúncios ativos, vindos de 7 lojas e 19 hashtags (lidas 1 vez por dia; orçamento de 20 das 25 vagas, na janela de 7 dias da Meta).
- **Agendamento:** os jobs rodam de hora em hora pelo GitHub Actions, sem falhas desde 10/11.
- **Stack:**
  - Next.js 16 (App Router, Cache Components), Tailwind v4 e shadcn/ui (Base UI).
  - Postgres no Supabase (RLS em tudo, grants por coluna), Supabase Auth e Storage.
  - Vitest e Playwright (e2e desktop + mobile, com axe para acessibilidade).
- **Produção:**
  - Vercel Hobby em `iad1`; Supabase em `us-east-1`.
  - DNS na Hostinger; o `www` ainda não redireciona.
  - GA4 `G-C9699057HJ`, com Consent Mode básico e banner LGPD.
  - Search Console verificado, com o sitemap enviado.
- **Testes:** `npm run check` com 509 testes; e2e com 120 aprovados (as escritas rodam só no desktop).

## O que já existe, por fase

1. **Taxonomia e busca:**
   - Modelos, gerações, motores e versões do mercado brasileiro, com marcação `brazil: false`.
   - `parseQuery` determinístico.
   - Busca em Postgres (full-text + trigram) com filtros na URL.
2. **Extração com IA:**
   - Pré-filtro, normalização como fonte da verdade, dedupe e moderação.
   - Gabaritos de avaliação: 40 legendas fictícias e 35 reais.
3. **Coleta do Instagram:**
   - Jobs com trava, `job_runs`, dry-run e orçamento de tempo.
   - Ciclo de vida do anúncio: vendido, expirado, legenda editada.
4. **Leads:** `/r/<código>` grava o lead (hash de IP/UA, sem dado do comprador) e redireciona para `wa.me` com mensagem pronta.
5. **Admin:**
   - Moderação, anúncios, configurações, fontes, leads (CSV), jobs, remoções, blocklist e vendedores.
   - Toda escrita vai para o `audit_log`.
6. **Vendedor:**
   - Remoção sem login e reivindicação com código pelo Direct do Instagram.
   - Painel com visitas e contatos, edição do anúncio e fotos licenciadas (sharp, sem EXIF).
   - Planos: só a estrutura, sem preço.
7. **Produção:**
   - Páginas de SEO `/volvo/<modelo>[/<versão|uf>][/<uf>]`, JSON-LD, sitemap e páginas jurídicas em rascunho.
   - GA4 com consentimento; login do admin e do vendedor com Google ou link no e-mail.
   - Workflows `jobs.yml` (de hora em hora) e `db-migrate.yml` (manual).
   - Build de produção que falha com configuração errada.
   - Local padrão da loja e estado pelo DDD para anúncios sem local.

## Lições do lançamento (detalhes no RUNBOOK)

- **Segredos colados com Enter:** agora os valores são aparados.
- **`CRON_SECRET`:** vai em **Repository secrets**, não em Environments.
- **Variáveis na Vercel:** só valem depois de um Redeploy.
- **Migration nova:** aplique primeiro pelo `db-migrate.yml` a partir do branch, e só depois faça o merge do código que depende dela.
- **Meta "API access blocked":** era a conta do Facebook pedindo verificação de segurança.
- **Extração falhando:** o alerta do `process-posts` mostra o erro; depois de corrigir a causa, use a opção "Reprocessar posts com erro" do workflow.
- **Ambiente na nuvem do Claude:**
  - `NODE_USE_ENV_PROXY=1` para os scripts falarem com a API;
  - `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium` para o e2e;
  - o Postgres local pode precisar de `service postgresql start`;
  - os hosts do site, do `dns.google` e do Supabase já estão liberados na rede do ambiente.

## Pendências de configuração (comigo, sem código)

- Marcar `generate_lead` como evento-chave no GA4.
- Preencher o local padrão das lojas sem cidade na bio (webcarsbrasil, nattamotors, consultingcars, safetycarmotors).
- Redirecionar o `www` na Vercel.
- SMTP próprio para o login dos vendedores por link.

## Backlog e decisões em aberto

- **Referência de preço de mercado:** nada de FIPE ou média sem fonte; propor a integração antes.
- **Fontes de repasse:** hashtags gastam vagas do orçamento.
- **Monetização:** benefícios e preços dos planos e o meio de pagamento (Mercado Pago, Asaas ou Stripe). Quando houver receita, a Vercel precisa ir para o plano **Pro**, porque o Hobby é só para uso não comercial.
- **Login com Instagram** para vendedores (exige o produto no app da Meta e revisão).
- **Textos jurídicos:** revisão do advogado.
- **Processamento:** o `process-posts` processa 50 posts por rodada; avaliar processar tudo o que couber no orçamento de tempo.
- **Busca:** a lista de buscas populares tem termos sem anúncios hoje (V40, C30).
- **Dados:** 6 anúncios sem local (sem telefone) e um possível duplicado (XC60 T8 2026).

## Forma de trabalho (manter)

- **Por fases.** Antes de cada fase, um plano curto.
- **No fim de cada fase:** `npm run check`, `npm run test:e2e`, capturas de tela e lista de pendências. Depois, **parar e esperar a minha aprovação** antes do merge e da próxima fase.
- **Decisão de negócio ou ambígua: perguntar.** Não invente preços, credenciais nem textos jurídicos definitivos.
- **Idiomas:** código, identificadores e commits em inglês; interface em PT-BR.
- **Compliance inegociável (detalhes no `CLAUDE.md`):**
  - nada de scraping do Instagram;
  - fotos de terceiros nunca vão para o nosso storage;
  - LGPD: mínimo de dados do vendedor e nenhum dado do comprador;
  - nada de logo nem identidade visual da Volvo;
  - segredos só em variáveis de ambiente.

## O que quero agora

Planejar a **v2** com base nas ideias que vou te contar a seguir.

1. Comece pelas perguntas que precisar e por um plano curto, dividido em fases.
2. Não implemente nada até eu aprovar o plano.
3. Leve em conta o que já existe, para reaproveitar em vez de refazer.
