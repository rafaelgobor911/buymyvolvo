# RUNBOOK: Buy My Volvo em produção

Guia de operação: como colocar no ar, rotina, o que fazer quando algo quebra.

Arquitetura:

- **Vercel** (plano Hobby, gratuito): site e funções.
- **Supabase**: Postgres, login e fotos dos vendedores.
- **GitHub Actions**: migrations e agendamento dos jobs.

Endereço oficial: `https://buymyvolvo.com.br`. O `www` redireciona para ele.

> **Plano gratuito da Vercel:** os termos da Vercel limitam o Hobby a uso pessoal e não comercial. Quando o site gerar receita (anúncios, planos pagos ou comissão), mude para o **Pro**. O código não muda.

---

## 1. Colocar no ar (Fase 7b)

Faça na ordem. Cada passo diz onde fica a configuração.

### 1.1 Supabase

1. **Migrations:**
   1. Em **GitHub** → **Settings** → **Secrets and variables** → **Actions**, crie o segredo `MIGRATION_DATABASE_URL`. O valor é a connection string do **Session pooler**, porta 5432, em Supabase → **Connect**.
   2. Em **Actions** → **Banco: migrations** → **Run workflow**, rode primeiro **sem** marcar "Aplicar": só lista as pendentes.
   3. Rode de novo **marcando** "Aplicar".
   4. O seed fictício **nunca** vai para lá (o CLI recusa banco remoto).
2. **Auth:** **Authentication** → **URL Configuration**:
   - Site URL `https://buymyvolvo.com.br`;
   - Redirect URLs `https://buymyvolvo.com.br/**`.
3. **E-mails de login:** siga [`docs/login-email.md`](docs/login-email.md): modelos de e-mail e SMTP próprio para os vendedores.
4. **Google (opcional):** siga [`docs/login-google.md`](docs/login-google.md).
5. **Chave secreta:** em **Project Settings** → **API Keys**, copie a _Secret key_ (`sb_secret_…`). Ela vira `SUPABASE_SERVICE_ROLE_KEY` na Vercel, para as fotos dos vendedores. O bucket `listing-photos` é criado sozinho no primeiro envio.

### 1.2 Vercel

1. **New Project** → importe o repositório do GitHub. A Vercel detecta o Next.js; não mude os comandos.
2. **Settings** → **Functions**: confirme que o **Fluid Compute** está ligado. Os jobs precisam de até 300 s; sem ele, o limite cai para 60 s.
3. **Settings** → **Environment Variables**, para _Production_:

| Variável                                                                       | Valor                                                        |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `NEXT_PUBLIC_SITE_URL`                                                         | `https://buymyvolvo.com.br`                                  |
| `NEXT_PUBLIC_SITE_NAME`                                                        | `Buy My Volvo` (opcional, é o padrão)                        |
| `NEXT_PUBLIC_DEMO_MODE`                                                        | `false`                                                      |
| `DATABASE_URL`                                                                 | Supabase → **Connect** → **Transaction pooler** (porta 6543) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`                    | URL do projeto e _Publishable key_                           |
| `SUPABASE_SERVICE_ROLE_KEY`                                                    | _Secret key_ do passo 1.1.5                                  |
| `ADMIN_EMAILS`                                                                 | e-mail(s) do admin, separados por vírgula                    |
| `HASH_SALT`                                                                    | valor aleatório novo: `openssl rand -base64 48`              |
| `CRON_SECRET`                                                                  | outro valor aleatório novo (o mesmo vai para o GitHub)       |
| `ANTHROPIC_API_KEY`                                                            | chave da Anthropic (extração)                                |
| `META_APP_ID`, `META_APP_SECRET`, `IG_BUSINESS_USER_ID`, `IG_LONG_LIVED_TOKEN` | ver [`docs/meta-setup.md`](docs/meta-setup.md)               |
| `NEXT_PUBLIC_GA_MEASUREMENT_ID`                                                | ID do GA4 (`G-…`), ver 1.4                                   |
| `NEXT_PUBLIC_GOOGLE_ADS_ID`, `NEXT_PUBLIC_GOOGLE_ADS_LEAD_LABEL`               | só quando houver campanha (ver 1.4)                          |

**Nunca** defina `ADMIN_TEST_LOGIN_EMAIL` nem `SELLER_TEST_LOGIN_EMAIL` na Vercel.

O build de produção **falha de propósito** se faltar algo obrigatório ou se houver configuração de teste (`src/lib/env/production.ts`). A mensagem lista o que corrigir.

4. **Settings** → **Domains**:
   - adicione `buymyvolvo.com.br` e `www.buymyvolvo.com.br` (este redirecionando para o primeiro);
   - crie no registro.br os registros DNS que a Vercel indicar.
5. As prévias (_Preview_) podem usar o modo de prévia (`NEXT_PUBLIC_DEMO_MODE=true`) com um banco à parte. Nunca aponte uma prévia para o banco de produção com o modo de prévia ligado.

### 1.3 GitHub (agendamento)

Em **Settings** → **Secrets and variables** → **Actions**:

- **Variable** `SITE_URL` = `https://buymyvolvo.com.br`. Sem ela, o workflow de jobs não faz nada.
- **Secret** `CRON_SECRET` = o mesmo valor da Vercel.

Depois rode **Actions** → **Jobs agendados** → **Run workflow** com "Ensaio" marcado e confira que todos respondem 200.

### 1.4 Google (Analytics, Search Console, Ads)

1. **Analytics:**
   1. Crie uma propriedade GA4 (fuso: São Paulo; moeda: real) e um fluxo da Web para `buymyvolvo.com.br`.
   2. O ID `G-…` vai para `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
   3. Em **Admin** → **Eventos**, marque `generate_lead` como **evento-chave**: é o clique em "Falar com o vendedor".
   4. O script só carrega depois que o visitante aceita os cookies.
2. **Search Console:**
   1. Verifique o domínio por DNS no registro.br.
   2. Envie `https://buymyvolvo.com.br/sitemap.xml`.
3. **Google Ads** (quando houver campanha):
   1. Crie a conversão "Contato" e copie o ID (`AW-…`) e o rótulo para as duas variáveis.
   2. Ligar o Ads muda a versão do consentimento: todos veem o banner de novo, agora com a opção "Publicidade".
   3. Vincule o GA4 ao Ads para importar o `generate_lead`.

### 1.5 Testes de fumaça (no site publicado)

- [ ] Home, busca, `/volvo/xc60`, um anúncio. O aviso de prévia **não** aparece.
- [ ] Clique de contato num anúncio real, num celular: o WhatsApp abre com a mensagem e o código `VX-…`. O lead aparece em `/admin/leads`.
- [ ] Login do admin pelo link no e-mail, aberto no celular.
- [ ] Banner de cookies:
  - "Recusar": nenhum pedido a `googletagmanager.com` (aba Rede do navegador);
  - "Aceitar": GA4 em **Tempo real**.
- [ ] `/sitemap.xml` e `/robots.txt` com o domínio certo.
- [ ] Primeira coleta: em `/admin/jobs`, "rodar agora" do `collect-business-discovery` em ensaio, depois de verdade, depois `process-posts`. Revise a moderação.

---

## 2. Rotina

### Jobs (GitHub Actions, `.github/workflows/jobs.yml`)

Todo dia, a cada hora, aos 17 minutos (UTC):

| Job                          | Quando                                        |
| ---------------------------- | --------------------------------------------- |
| `collect-business-discovery` | a cada 3 h                                    |
| `collect-hashtags`           | toda hora (cada hashtag é lida 1 vez por dia) |
| `process-posts`              | toda hora, depois das coletas                 |
| `token-health`               | 1 vez por dia (06h17 em Brasília)             |
| `expire-listings`            | 1 vez por dia (06h17 em Brasília)             |

- O GitHub pode atrasar execuções agendadas em alguns minutos. Isso não é problema: os jobs têm trava e são idempotentes.
- Para rodar um job na mão:
  - pelo GitHub: **Actions** → **Jobs agendados** → **Run workflow**, escolhendo o job (e "Ensaio" para não gravar);
  - pelo site: `/admin/jobs`.
- **Minutos do GitHub:** repositório privado tem 2.000 minutos grátis por mês. Cada rodada leva de 1 a 5 minutos. Se passar do limite, reduza as horas (linha `cron` do workflow).

### O que olhar

- **Início do admin** (`/admin`): fila de moderação, remoções vencendo (48 h), alertas de jobs e do token.
- **E-mail do GitHub:** um job que responde diferente de 200 faz o workflow falhar e o GitHub avisa por e-mail.
- **Remoções:** o compromisso público é confirmar em até 48 h (`/admin/remocoes`).
- **Custo de IA:** os últimos 30 dias aparecem em `/admin/jobs`.

---

## 3. Quando algo dá errado

| Sintoma                                                | O que fazer                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Alerta "token da Meta vence em N dias"                 | Gere um token novo ([`docs/meta-setup.md`](docs/meta-setup.md), etapa D) e troque `IG_LONG_LIVED_TOKEN` na Vercel. A troca vale no próximo deploy: em **Deployments**, use **Redeploy**.                                                                                             |
| Job com `rate_limit` da Meta                           | Nada: ele para e continua na próxima hora. Se persistir, espace o `collect-business-discovery` (workflow).                                                                                                                                                                           |
| Meta responde "API access blocked" (código 200)        | O app ou a conta do Facebook que o administra foi restrito. Entre no Facebook (verificação de segurança, Status da conta) e no painel do app em developers.facebook.com (alertas, "Ação necessária"). Depois de liberado, pode levar alguns minutos.                                 |
| Posts com erro na extração (alerta do `process-posts`) | A mensagem do erro aparece no alerta do job (GitHub e `/admin/jobs`). Corrija a causa (por exemplo, `ANTHROPIC_API_KEY` ausente ou sem crédito; depois de mudar na Vercel, **Redeploy**) e rode **Jobs agendados** com o job `process-posts` e "Reprocessar posts com erro" marcado. |
| Orçamento de hashtags no limite                        | Veja `/admin/fontes`. Pause hashtags pouco úteis; a janela é de 7 dias corridos.                                                                                                                                                                                                     |
| Workflow de jobs com 401                               | `CRON_SECRET` diferente entre GitHub e Vercel. Acerte os dois (no GitHub, em **Repository secrets**, não em Environments) e faça **Redeploy** na Vercel: a variável só vale no deploy seguinte.                                                                                      |
| Workflow de jobs com 503                               | `CRON_SECRET` ausente na Vercel.                                                                                                                                                                                                                                                     |
| "CRON_SECRET vazio" no workflow                        | O segredo não está em **Repository secrets** (talvez em Environments → production ou em Variables). Crie em Settings → Secrets and variables → Actions → Repository secrets.                                                                                                         |
| Job que estoura o tempo (504)                          | Confira o Fluid Compute (1.2.2). Os jobs de coleta param sozinhos em 240 s e continuam na rodada seguinte.                                                                                                                                                                           |
| Deploy novo com problema                               | Vercel → **Deployments** → deploy anterior → **Instant Rollback**. Migrations não voltam sozinhas: se a última mudou o banco, avalie antes.                                                                                                                                          |
| Migration falhou                                       | Cada migration roda numa transação: nada fica pela metade. Corrija com uma **migration nova** (nunca edite uma já aplicada) e rode o workflow de novo.                                                                                                                               |
| Supabase pausado ou fora                               | No plano gratuito, projetos parados por dias são pausados; os jobs de hora em hora mantêm o projeto ativo. Reative no painel. O site mostra erro até o banco voltar.                                                                                                                 |
| Pedido de dados pessoais (LGPD)                        | Anúncio: o próprio link "Remover" resolve. Outros pedidos chegam pelo contato da Política de Privacidade; responda em até 15 dias.                                                                                                                                                   |
| Segredo vazado                                         | Gere outro e troque na Vercel (e no GitHub, se for o `CRON_SECRET`), depois redeploy. Trocar o `HASH_SALT` só zera a deduplicação de cliques (24 h) e a contagem diária de pedidos de remoção por aparelho.                                                                          |

---

## 4. Referências

- Projeto e convenções: [`CLAUDE.md`](CLAUDE.md).
- Plano e decisões: [`docs/plano.md`](docs/plano.md).
- Meta: [`docs/meta-setup.md`](docs/meta-setup.md).
- Login: [`docs/login-email.md`](docs/login-email.md) e [`docs/login-google.md`](docs/login-google.md).
- Variáveis: [`.env.example`](.env.example).
