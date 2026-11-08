# Login com Google (Supabase Auth)

O código do login com Google já está pronto, tanto no admin (`/admin/entrar`) quanto na área do vendedor (`/vendedor/entrar`). Falta configurar três lugares: Google Cloud, Supabase e as variáveis de ambiente. Nada disso exige CNPJ, nem publicar ou verificar o app no Google.

## 1. Google Cloud: tela de consentimento

O Google só deixa criar a credencial depois que a tela de consentimento existe. É o erro mais comum.

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie um projeto ou escolha um existente, por exemplo "buymyvolvo".
2. Abra a tela de consentimento OAuth:
   - menu ☰ → **APIs e serviços** → **Tela de permissão OAuth**;
   - na interface nova, ela aparece como **Google Auth Platform**;
   - clique em **Começar** (_Get started_).
3. **Informações do app:** nome (por exemplo, "Buy My Volvo") e e-mail de suporte (o seu Gmail).
4. **Público** (_Audience_): **Externo** (_External_).
5. **Dados de contato:** o seu e-mail. Aceite a política e conclua.

Enquanto o app estiver em **Teste** (_Testing_), só os usuários de teste conseguem entrar:

- Para o admin, adicione o seu Gmail (o mesmo do `ADMIN_EMAILS`) em **Público** → **Usuários de teste**.
- Para os vendedores entrarem, clique em **Publicar app** quando formos ao ar. Os escopos usados (e-mail e perfil) são básicos e não exigem verificação do Google.

## 2. Google Cloud: credencial OAuth

1. Abra **Clientes** (_Clients_) → **Criar cliente**. No menu antigo, o caminho é **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**.
2. Escolha **Aplicativo da Web** como tipo de aplicativo.
3. Use um nome qualquer, por exemplo "Supabase".
4. Em **URIs de redirecionamento autorizados**, coloque `https://<ref-do-projeto>.supabase.co/auth/v1/callback`. É a URL do projeto Supabase seguida de `/auth/v1/callback`.
5. Deixe **Origens JavaScript autorizadas** em branco.
6. Clique em **Criar** e copie o **ID do cliente** e a **chave secreta do cliente**.

## 3. Supabase

1. **Authentication** → **Sign In / Providers** → **Google**:
   - ative o provedor;
   - cole o ID e a chave secreta do cliente e salve.
   - A chave secreta fica guardada só no Supabase.
2. **Authentication** → **URL Configuration**:
   - **Site URL:** `http://localhost:3000` por enquanto; depois, o domínio.
   - **Redirect URLs:** `http://localhost:3000/**` por enquanto. Depois entram `https://<domínio>/**` e o endereço das prévias da Vercel.

## 4. Variáveis de ambiente

As três primeiras já estão no ambiente desta sessão:

- `NEXT_PUBLIC_SUPABASE_URL`: a URL do projeto.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`: a _Publishable key_ (`sb_publishable_…`) ou a _anon public_ das chaves antigas.
- `ADMIN_EMAILS`: o e-mail Google de quem acessa o admin.
- Na Vercel (Fase 7), as mesmas três e mais `NEXT_PUBLIC_SITE_URL` com o domínio.

## Como testar

O Google precisa conseguir voltar para um endereço que o seu navegador alcance. O servidor da sessão do Claude não é acessível de fora. Por isso o teste de ponta a ponta acontece no deploy da Vercel (Fase 7), ou numa prévia antes disso, se você quiser.

Se algum passo der erro, anote a mensagem exata da tela.
