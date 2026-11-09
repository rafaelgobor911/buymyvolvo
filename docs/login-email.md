# Login por link no e-mail (Supabase Auth)

O admin (`/admin/entrar`) e a área do vendedor (`/vendedor/entrar`) aceitam, além do Google, um **link de acesso enviado por e-mail**. Não há senha: a pessoa digita o e-mail, recebe o link e entra.

- **Admin:** o link só sai para e-mails listados em `ADMIN_EMAILS`. Para qualquer outro e-mail, a tela responde igual ("se o e-mail tiver acesso, enviamos um link"), sem revelar quem é admin.
- **Vendedor:** qualquer e-mail. A conta é criada no primeiro acesso.
- O link vale uma vez e expira (1 hora, padrão do Supabase).

## 1. Supabase: endereços de retorno

**Authentication** → **URL Configuration**:

- **Site URL:** `https://buymyvolvo.com.br`.
- **Redirect URLs:** `https://buymyvolvo.com.br/**`. Enquanto testar localmente, inclua também `http://localhost:3000/**`. Para as prévias da Vercel, inclua o endereço delas.

## 2. Supabase: modelos de e-mail (recomendado)

Com o modelo padrão, o link só funciona se for aberto **no mesmo navegador** em que foi pedido. Quem pede no computador e abre o e-mail no celular cai em "o link expirou". O ajuste abaixo faz o link funcionar em qualquer navegador.

Em **Authentication** → **Emails** → **Templates**, troque o link dos modelos **Magic Link** e **Confirm signup**. O segundo é o que vai para quem entra pela primeira vez. O link novo é:

```html
<a href="{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email">Entrar no Buy My Volvo</a>
```

Sugestão de texto, em português:

- **Assunto:** `Seu link de acesso ao Buy My Volvo`
- **Corpo:** "Clique no link abaixo para entrar. Ele vale por 1 hora e só pode ser usado uma vez. Se você não pediu este acesso, ignore este e-mail."

O `{{ .RedirectTo }}` já traz `?next=…`, por isso o modelo usa `&` e não `?`. As rotas de retorno (`/admin/auth/callback` e `/auth/callback`) aceitam os dois formatos: o `token_hash` do modelo novo e o `code` do modelo padrão.

## 3. Envio dos e-mails (SMTP)

O envio padrão do Supabase serve só para testes:

- cerca de **2 e-mails por hora para o projeto inteiro**;
- só entrega para endereços da equipe do projeto no Supabase.

Para o **admin**, isso basta, desde que o e-mail do `ADMIN_EMAILS` seja membro da organização no Supabase (**Organization** → **Team**).

Para os **vendedores**, configure um SMTP próprio em **Authentication** → **Emails** → **SMTP Settings**. Serviços com plano gratuito: Resend, Brevo, Amazon SES. Cada um pede para confirmar o domínio `buymyvolvo.com.br` (registros DNS SPF/DKIM). Remetente sugerido: `acesso@buymyvolvo.com.br`.

Com SMTP próprio, o limite sobe (padrão de 30 por hora, ajustável em **Authentication** → **Rate Limits**). O Supabase também impede pedir outro link para o mesmo e-mail em menos de 60 segundos. A tela mostra "Muitos pedidos de link" quando o limite é atingido.

## 4. Como testar

1. Configure os passos 1 e 2.
2. No site publicado (ou numa prévia da Vercel), abra `/admin/entrar`.
3. Digite o seu e-mail do `ADMIN_EMAILS` e clique em **Receber link de acesso**.
4. Abra o e-mail, de preferência em outro aparelho, para confirmar o passo 2.
5. Repita em `/vendedor/entrar` com um e-mail que não é admin. Esse passo só funciona com SMTP próprio.

O servidor da sessão do Claude não é acessível de fora, então o teste de ponta a ponta acontece na Vercel.
