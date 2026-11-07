# Guia: app da Meta, tokens e App Review

> **Conferido em 07/11/2026** na documentação oficial (developers.facebook.com, Instagram Platform). A Meta muda telas e nomes com frequência, então os nomes de menus podem variar um pouco. Quando algo divergir, vale o que está no painel. Os pontos que só um teste real confirma estão marcados com **⚠️ confirmar**.

## Resumo em 30 segundos

1. **O que temos que fazer já:** decidir qual conta do Instagram será a "dona" da integração, criar o portfólio empresarial (com CNPJ), criar o app na Meta e **começar a Verificação da Empresa** (Business Verification). A verificação é o item mais lento e não depende de código.
2. **O Business Discovery (fonte principal) provavelmente não precisa de App Review.** A Meta diz que, se o app só usa a sua própria conta profissional, o _Standard Access_ basta. Nosso app consulta outras contas **a partir da nossa** conta, então deve funcionar sem revisão. **⚠️ confirmar** com uma chamada real no Graph API Explorer (passo 12).
3. **O Hashtag Search (fonte complementar) exige App Review** do recurso _Instagram Public Content Access_. A revisão pede um site público com política de privacidade e um screencast do fluxo funcionando, então só faz sentido enviar quando as Fases 3 e 5 estiverem prontas e publicadas.
4. **Token:** em vez do token de usuário de 60 dias, recomendo um **token de System User** do nosso portfólio, que pode não expirar. O código suporta os dois e o job de monitoramento alerta antes de qualquer expiração.

## O que mudou em relação ao PROMPT.md

| Tema                               | No prompt                                                                     | O que a documentação atual diz                                                                                                                               | Proposta                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Versão da Graph API                | "ex.: v25.0"                                                                  | A documentação usa **v27.0**                                                                                                                                 | `META_GRAPH_VERSION=v27.0`                                                                                                    |
| App Review para Business Discovery | Pedir `instagram_basic`, `pages_read_engagement`, `instagram_manage_insights` | App que só serve a própria conta → **Standard Access, sem App Review**                                                                                       | Testar sem revisão; só pedir se falhar                                                                                        |
| Header de rate limit               | `X-Business-Use-Case-Usage`                                                   | Business Discovery e Hashtag Search usam **Platform Rate Limiting** (`X-App-Usage`)                                                                          | Ler os dois headers                                                                                                           |
| Hashtag: o que conta no limite     | consulta à hashtag                                                            | `recent_media` **e** `top_media` contam, mesmo com o ID em cache                                                                                             | Orçamento conta qualquer leitura de hashtag                                                                                   |
| Embed (oEmbed)                     | "embed oficial (oEmbed)"                                                      | O endpoint `instagram_oembed` exige App Review de **Meta oEmbed Read**                                                                                       | Usar o código de incorporação oficial do Instagram (sem token); pedir oEmbed Read junto com a revisão de hashtags, como opção |
| Tipo de integração                 | "Instagram API with Facebook Login"                                           | A Meta agora recomenda a **Instagram API with Unified Login** para integrações novas. As duas usam `graph.facebook.com` e as mesmas permissões `instagram_*` | Decisão sua (ver "Escolha do tipo de integração")                                                                             |

## Escolha do tipo de integração

As três variantes oficiais:

|                       | **Facebook Login** (o que o prompt pede) | **Unified Login** (recomendada pela Meta para apps novos)    | Instagram Login |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------ | --------------- |
| Página do Facebook    | Obrigatória, vinculada à conta do IG     | Não precisa                                                  | Não precisa     |
| Portfólio empresarial | Depende                                  | Obrigatório                                                  | Não precisa     |
| Token                 | Usuário (60 dias) ou System User         | System User do portfólio (validade definida na configuração) | Usuário do IG   |
| Business Discovery    | ✅                                       | ✅ (segundo a página do recurso)                             | ❌              |
| Hashtag Search        | ✅                                       | ✅                                                           | ❌              |

**Instagram Login está fora:** não tem Business Discovery nem Hashtag Search.

**Minha recomendação:** comece pelo **Facebook Login com token de System User**. É o caminho do prompt e o que a página de referência do Business Discovery documenta explicitamente. Na prática, o System User resolve o problema de expiração que seria a maior vantagem do Unified Login. Como o código é o mesmo nos dois casos (mesmo host, mesmo ID da conta, só muda como o token é obtido), dá para migrar depois sem retrabalho.

## Passo a passo

### Etapa A: contas e empresa (você faz, sem código)

1. **Escolha a conta do Instagram** que fará as consultas: @madebysweden.br ou uma conta nova do marketplace (**pendente**). Todo o orçamento de hashtags (30 por 7 dias) é dessa conta.
2. **Garanta que ela é profissional:** no app do Instagram, Configurações → _Tipo de conta e ferramentas_ → _Mudar para conta profissional_ → **Empresa** (Business).
3. **Crie (ou use) uma Página do Facebook** para o marketplace e vincule a conta do Instagram a ela: na Página, Configurações → _Contas vinculadas_ → Instagram. Quem for administrar precisa ter controle total da Página.
4. **Crie o portfólio empresarial** em business.facebook.com (Meta Business Suite) **com o CNPJ que vai operar o marketplace**. Adicione a Página e a conta do Instagram como ativos do portfólio.
5. **Ative a autenticação em dois fatores** em todas as contas de administrador. A Meta exige isso para várias ações do portfólio.

### Etapa B: app no Meta for Developers

6. Em developers.facebook.com → _Meus apps_ → **Criar app**. Escolha o tipo **Business** (ou o caso de uso equivalente que leve ao tipo Business) e **vincule ao portfólio** da etapa 4.
7. No painel do app, adicione o produto **Instagram** → _Configuração da API com login do Facebook_ (_API setup with Facebook login_).
8. Em _Configurações do app → Básico_, preencha:
   - **Ícone 1024×1024** (sem logotipo da Volvo)
   - **URL da Política de Privacidade:** pode ser um rascunho publicado; a versão final sai na Fase 7
   - **Categoria** (ex.: _Business and Pages_ ou _Shopping_)
   - **E-mail de contato**, para onde vão os resultados do App Review e os alertas
9. Anote o **App ID** e o **App Secret**. Eles vão para as variáveis de ambiente (`META_APP_ID` e `META_APP_SECRET`) **na Vercel/no `.env.local`**. Não envie por chat, e-mail nem commit.
10. Em _Funções do app_, adicione como administradores ou testadores as pessoas que vão operar o sistema.

### Etapa C: Verificação da Empresa (comece já)

11. Em business.facebook.com → _Configurações do negócio_ → _Central de segurança_ → **Iniciar verificação**. Você vai precisar de:
    - razão social e CNPJ exatamente como na Receita
    - endereço e telefone comerciais
    - um documento oficial (cartão CNPJ, contrato social ou conta de serviço no nome da empresa)
    - **domínio ou e-mail com domínio próprio** para confirmação. Isso depende da decisão de nome e domínio, que ainda está pendente.

    O prazo varia de dias a semanas. Sem verificação não existe _Advanced Access_, e portanto não existe Hashtag Search.

### Etapa D: token e primeira chamada

12. **Opção recomendada: token de System User**
    1. business.facebook.com → _Configurações do negócio_ → _Usuários_ → **Usuários do sistema** → _Adicionar_ (função **Admin**).
    2. _Atribuir ativos_: o **app** (controle total), a **Página** e a **conta do Instagram**.
    3. _Gerar novo token_, selecionando o app e as permissões `instagram_basic`, `instagram_manage_insights`, `pages_read_engagement`, `pages_show_list` e `business_management`. Escolha **validade "Nunca"** se a opção existir; se não existir, escolha 60 dias, e nosso job vai alertar e renovar.
    4. **⚠️ confirmar:** que o token de System User funciona para Business Discovery e Hashtag Search no nosso caso. A documentação de referência fala em _User access token_. Fontes de terceiros relatam uso com System User, mas só um teste real confirma.

    **Opção alternativa: token de usuário de longa duração (60 dias)**
    1. Gere um token de usuário no _Graph API Explorer_ com as permissões acima.
    2. Troque por um token longo: `GET https://graph.facebook.com/v27.0/oauth/access_token?grant_type=fb_exchange_token&client_id={APP_ID}&client_secret={APP_SECRET}&fb_exchange_token={TOKEN_CURTO}`.
    3. Esse token dura cerca de 60 dias. O job de saúde do token (Fase 3) consulta `debug_token` diariamente e alerta com 10 dias de antecedência.

13. **Descubra o `IG_BUSINESS_USER_ID`:**
    `GET /v27.0/me/accounts?fields=name,instagram_business_account{id,username}` (o ID começa com `1784…`).
14. **Faça a primeira chamada de Business Discovery** no Graph API Explorer, usando uma loja que você sabe que é conta profissional:
    `GET /v27.0/{IG_BUSINESS_USER_ID}?fields=business_discovery.username({loja}){username,name,biography,website,media.limit(5){id,caption,media_type,permalink,timestamp}}`
    - **Se funcionar:** a fonte principal está liberada sem App Review. 🎉
    - **Se der erro de permissão:** me mande o código e a mensagem do erro (sem o token) e eu ajusto o plano.
15. **Guarde as variáveis:** `IG_BUSINESS_USER_ID`, `IG_LONG_LIVED_TOKEN` (mesmo que seja um token de System User, o nome da variável continua esse), `META_GRAPH_VERSION=v27.0`.

> **Observação para esta sessão na nuvem:** chamadas reais exigem que `graph.facebook.com` esteja liberado na rede do ambiente. Vou pedir isso só na Fase 3, quando houver token.

### Etapa E: App Review (quando as Fases 3 e 5 estiverem no ar)

**O que pedir:**

| Item                                                | Por quê                                  | Quando                                                                                                    |
| --------------------------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Instagram Public Content Access** (recurso)       | Hashtag Search                           | Depois da Fase 3 (job) + Fase 5 (admin) publicadas                                                        |
| `instagram_basic`                                   | Dependência do Hashtag Search            | Junto                                                                                                     |
| **Meta oEmbed Read** (opcional)                     | Embed via API (há alternativa sem token) | Junto, se quisermos                                                                                       |
| `instagram_basic` para vendedores sem função no app | "Reivindicar com Instagram" (Fase 6)     | Fase 6. Pode exigir **outro app**, porque um app usa Facebook Login **ou** Instagram Login, nunca os dois |

Não peça permissões que o app não usa: a Meta reprova a submissão inteira.

**Pré-requisitos da submissão** (todos obrigatórios):

- site público funcionando, com a **Política de Privacidade** no ar
- ícone, categoria e e-mail preenchidos (passo 8)
- **pelo menos 1 chamada de API bem-sucedida** com cada permissão pedida, nos últimos 30 dias
- instruções passo a passo para o revisor entrar e testar, com credenciais de teste do admin
- **um screencast por permissão ou recurso**

**Textos de caso de uso** (em inglês, porque os revisores leem em inglês):

_Instagram Public Content Access_

> Our website is a search engine for used Volvo cars for sale in Brazil. We use Hashtag Search to find recent public posts with car-sale hashtags (e.g. #volvoavenda, #volvoseminovo) published by dealers and private sellers. For each post we store only the media ID, permalink, caption and timestamp; we never download or re-host images or videos. Our system reads the caption to extract structured data (model, year, mileage, price, city), writes a short summary in our own words and shows the listing with a link and credit back to the original Instagram post, where the buyer can see the full content. Every listing page has a "Is this your listing? Remove | Claim" link; removal requests are honored within 48 hours and the post is blocklisted so it is never re-imported. We query at most ~25 hashtags per rolling 7-day window and track usage with the recently_searched_hashtags endpoint.

_instagram_basic_

> instagram_basic is required as a dependency of Instagram Public Content Access and Business Discovery. It is used only server-side, with our own Instagram professional account, to run hashtag searches and read public posts from professional accounts of car dealers listed by our admin team.

**Roteiro do screencast** (2–3 min, interface em inglês ou legendas em inglês, sem dados sensíveis na tela):

1. _(Legenda)_ "This is our admin panel. Only our staff can access it." → login no `/admin`.
2. Tela **Fontes**: lista de hashtags monitoradas e o contador "X of 30 unique hashtags used in the last 7 days".
3. Rodar o job de Hashtag Search (botão "Run now"): mostrar o log com os posts coletados.
4. Tela **Moderação**: um post coletado, com o embed/link do original ao lado dos campos extraídos (modelo, ano, km, preço). Aprovar.
5. Página pública do anúncio: dados estruturados, resumo próprio, **link "View on Instagram" com crédito ao autor** e nenhuma foto copiada. _(Legenda)_ "We do not store or re-host any images."
6. Clicar em "Is this your listing? Remove": enviar o formulário e mostrar o anúncio fora do ar e o item na blocklist.
7. _(Legenda)_ "Removed posts are never re-imported."

**Motivos comuns de reprovação:** revisor não consegue logar; screencast não mostra o uso real da permissão; permissão pedida mas não usada; política de privacidade fora do ar ou genérica; app em modo de desenvolvimento quando a revisão exige modo Live.

## Limites e comportamentos que o código já vai respeitar

- **Business Discovery:** contas pessoais e com restrição de idade não retornam (registrar e seguir). `GET` direto num media retornado falha por permissão. A paginação de `media` traz cursores `before`/`after` sem `next`/`previous`; montamos à mão. `media_url` não vem em vídeos com áudio licenciado, o que não nos afeta, porque não guardamos imagens.
- **Hashtag Search:** 30 hashtags únicas por 7 dias, em janela móvel e por conta. Repetir uma hashtag dentro da janela não consome nova vaga nem reinicia o prazo. `recent_media` e `top_media` contam no limite. `recent_media` traz só as últimas 24h, no máximo 50 por página, fora de ordem cronológica, só cursor `after`, sem `username` e sem impulsionados. Hashtags com emoji ou "sensíveis" retornam erro genérico.
- **Rate limit:** Business Discovery e Hashtag Search seguem o _Platform Rate Limiting_ (header `X-App-Usage`). Erros 4, 17, 32, 613 e 80002 levam a backoff exponencial.
- **oEmbed:** até 1.000 requisições por hora. Os metadados servem só para exibição; nada é extraído nem persistido a partir deles.

## Fontes oficiais

- Business Discovery: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/business-discovery
- Referência `business_discovery` (permissões): https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/business_discovery
- Hashtag Search: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-facebook-login/hashtag-search
- `recent_media`: https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-hashtag/recent-media
- Visão geral (níveis de acesso, tokens, rate limiting): https://developers.facebook.com/documentation/instagram-platform/overview
- Unified Login: https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-unified-login
- App Review: https://developers.facebook.com/documentation/instagram-platform/app-review
- oEmbed: https://developers.facebook.com/documentation/instagram-platform/oembed
