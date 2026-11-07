# Plano revisado (após a Fase 0)

## Decisões tomadas

| Tema                          | Decisão                                                                                                      |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Nome e domínio                | **Provisório**: `NEXT_PUBLIC_SITE_NAME` (padrão `[NOME_DO_SITE]`). Definir até a Fase 7                      |
| Relação com a Made by Sweden  | **Domínio próprio + links cruzados** (conteúdo "o que checar neste modelo", divulgação na comunidade)        |
| Conta do Instagram para a API | **Pendente** (@madebysweden.br ou conta nova). O desenvolvimento segue com fixtures                          |
| Repositório                   | GitHub (você cria e conecta; eu faço o push)                                                                 |
| Gerenciador de pacotes        | npm (Node 22)                                                                                                |
| UI                            | shadcn/ui no estilo `base-nova` (primitivas Base UI), Geist, neutros + azul-aço, claro/escuro                |
| Next.js                       | 16.4 com Cache Components + Partial Prefetching (padrão do create-next-app; serão o padrão na próxima major) |

## Ajustes propostos ao PROMPT.md (para sua aprovação)

1. **Graph API v27.0** em vez de "v25.0".
2. **Business Discovery sem App Review:** o _Standard Access_ basta porque o app só usa a nossa própria conta. O App Review fica restrito ao Hashtag Search (e à Fase 6). Isso encurta o caminho crítico.
3. **Token de System User** como padrão, com o token de usuário de 60 dias como alternativa. O job de saúde do token existe nos dois casos.
4. **Rate limit:** ler `X-App-Usage` (Platform Rate Limiting) além de `X-Business-Use-Case-Usage`.
5. **Embed:** usar o código de incorporação oficial do Instagram (blockquote + `embed.js`, o mesmo do botão "Incorporar"), sem token e sem App Review. O endpoint oEmbed fica opcional.
6. **Orçamento de hashtags:** contar qualquer leitura de `recent_media`/`top_media` e sincronizar com `GET /{ig-user-id}/recently_searched_hashtags`.

Detalhes e fontes em `docs/meta-setup.md`.

## Caminho crítico externo (fora do código)

```
Conta IG profissional ─┐
Página FB + portfólio ─┼─> App Meta ─> Token ─> teste do Business Discovery (Fase 3 real)
CNPJ + domínio ────────┴─> Business Verification ─┐
                       Site no ar + privacidade ──┴─> App Review (Hashtag Search)
```

A Business Verification depende do **CNPJ** e, idealmente, do **domínio**. Vale decidir o nome e o domínio antes da Fase 3.

## Riscos e mitigação

| Risco                                                                        | Mitigação                                                                                                             |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| App Review do Hashtag Search negado ou demorado                              | O Business Discovery é a fonte principal e não depende dele. Lista curada de lojas no admin. Cadastro direto (Fase 6) |
| Muitos particulares usam conta pessoal, que o Business Discovery não alcança | Hashtag Search + cadastro direto + reivindicação                                                                      |
| Token expira ou é revogado (troca de senha, remoção do app)                  | Token de System User, `debug_token` diário, alerta com 10 dias, `RUNBOOK.md` (Fase 7)                                 |
| Custo de IA                                                                  | Pré-filtro por regex antes da IA; Haiku; relatório de custo por 1.000 posts na Fase 2                                 |
| Mudanças da Meta (versões a cada ~4 meses, campos removidos)                 | Versão em env; cliente tipado com testes contra fixtures; checar o changelog a cada fase                              |

## Ambiente desta sessão (nuvem)

- Hosts liberados no ambiente Default: `ui.shadcn.com` (componentes) e `developers.facebook.com` (documentação).
- Para chamadas reais na Fase 3, será preciso liberar `graph.facebook.com`.
- Docker não roda aqui, então não dá para usar o Supabase CLI local. Para a Fase 1 há duas opções: (a) você cria um projeto Supabase na nuvem e libera o host dele, ou (b) uso o **Postgres 16 local** do container, com as mesmas migrations, e conecto ao Supabase depois. Decidir no início da Fase 1.

## Fase 1: decisões

| Tema                       | Decisão                                                                                                                       |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Banco nesta fase           | Postgres 16 local, compatível com Supabase (bootstrap de roles e schemas). O Supabase entra depois, trocando o `DATABASE_URL` |
| Acesso a dados             | SQL direto (driver `postgres`), leituras públicas como `anon` para exercitar a RLS                                            |
| Taxonomia                  | Modelo → geração (com plataforma e faixa de anos); motor e versão separados; Cross Country como variante do modelo base       |
| Cross Country              | "v40" inclui o V40 Cross Country (idem S60, V60, V90). "v40 cc" busca só o Cross Country                                      |
| São Paulo / Rio de Janeiro | Sozinhos = estado, com atalho "ver só a cidade". "cidade de…", "capital" e "sampa" = cidade                                   |
| Elétricos renomeados       | "xc40 elétrico" inclui o EX40; "c40" e "ec40" são o mesmo carro                                                               |
| Busca                      | Full-text `pt_unaccent` + trigram para erros de digitação. Parâmetros do painel sobrescrevem o texto                          |
| WhatsApp                   | Botão desativado até a Fase 4                                                                                                 |
| SEO                        | Página de busca com `noindex` até as páginas por modelo/UF da Fase 7                                                          |

## Próxima fase (Fase 2: extração com IA)

Pré-filtro por regex, extração com Claude (tool use + Zod), normalização (telefone E.164, preço, km, anos), checagem de coerência com a taxonomia, deduplicação e 40 legendas de teste com gabarito. Saída: `npm run extract:eval`.
