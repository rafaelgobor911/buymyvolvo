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
- A sessão na nuvem não repassa `ANTHROPIC_API_KEY` aos comandos. A chave fica também em `BUYMYVOLVO_ANTHROPIC_API_KEY` (variável do ambiente, não lida pelo código) e a avaliação roda com `ANTHROPIC_API_KEY="$BUYMYVOLVO_ANTHROPIC_API_KEY" npm run extract:eval`.
- E2E aqui: `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium npm run test:e2e`. Ao retomar uma sessão, o Postgres pode estar parado: `pg_ctlcluster 16 main start`.
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

## Revisão da taxonomia (07/11/2026)

59 respostas do dono do produto aplicadas. Principais mudanças:

- **Não vendidos no Brasil** (continuam reconhecidos pela busca, com aviso; saem dos filtros): V90 e V90 Cross Country, S60 e V60 Cross Country, V70 3ª geração, motores T2, D3, D4, B4, B5 e B6, versões Summum e Polestar (2014–2018).
- **Disponibilidade restrita:** T3 só no V40 (2015–2017); T4 sem versão Recharge, nos S60, V60, V40 e XC40; D5 na XC60 (2015–2020) e na XC90 (2018–2020); T6 sem versão Recharge.
- **Anos:** S60 3ª geração até 2022; Inscription a partir de 2015; Momentum a partir de 2015; Kinetic 2010–2013; Polestar Engineered até 2026; ES90 a partir de 2026.
- **Novos itens:** geração V70 XC (1997–2000) dentro da XC70; versões Ultimate Dark e Ultra Dark (XC60 e XC90); Ultra disponível em todos os modelos atuais.

Segunda rodada: Polestar Engineered na XC60 (2019–2026) e no S60 (2019–2022), sem V60; Ultimate Dark e Ultra Dark na XC60 e na XC90. Nenhuma dúvida pendente na taxonomia.

## Fase 2: decisões

| Tema                | Decisão                                                                                                                                                                       |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Formato da resposta | Structured outputs (`output_config.format`) com o schema Zod, em vez de forçar uma tool call; Zod valida de novo e há 1 retry                                                 |
| "Temperatura baixa" | O Haiku 5.5 rejeita `temperature`; usamos raciocínio desligado + esforço baixo                                                                                                |
| Números             | O modelo devolve o número e o trecho original (`price_text`, `km_text`); a normalização re-lê o trecho ("189k", "58mil", emojis de dígitos)                                   |
| Coerência           | Penalidades na confiança: motor/versão/ano impossíveis, itens não vendidos no Brasil, resumo copiado da legenda, combustível incoerente                                       |
| Duplicados          | Chave exata (modelo, motor, ano, km arredondado a 5 mil, contato) + regra aproximada (mesmo vendedor/modelo/ano e km até 3 mil de diferença)                                  |
| Custo               | Haiku 5.5: US$ 0,10/M entrada, US$ 0,50/M saída; cache estimado com multiplicadores padrão (1,25×/0,1×)                                                                       |
| Chave da API        | Não aceita pelo formulário seguro (host da própria Anthropic); vai como variável do ambiente `buymyvolvo`                                                                     |
| Resumo público      | O resumo vai para a página e para a meta description; o telefone não. Frases que só falam de contato saem; telefone, @ ou link manda para moderação; preço no resumo penaliza |
| `version_text`      | Só motor e versão como escritos ("T5 Momentum"), sem modelo, ano, cor, km ou câmbio, porque aparece como "Versão" quando a taxonomia não casa                                 |
| Tipo de vendedor    | "Único dono" descreve o histórico do carro, não quem vende (lojas também usam): não define `seller_type`. Particular só com "particular", "meu carro", "vendo meu"            |

### Avaliação (`npm run extract:eval`, 08/11/2026, prompt `2026-11-08.3`)

- **Acurácia:** 100% em todos os 13 campos medidos (modelo, motor, versão, anos, km, preço, cidade, UF, câmbio, combustível, tipo de vendedor, telefone), 100% em "é anúncio?", 6/6 sinais de alerta, 0 erros.
- **Custo (Haiku 5.5):** cerca de US$ 0,16–0,18 por 1.000 posts (com pré-filtro; no gabarito 33 de 40 posts passam) e US$ 0,20 por 1.000 extrações. A saída domina o custo (~260 tokens por post); o prompt de sistema (~5,5 mil tokens) vem do cache.
- **Publicação:** 28 de 29 anúncios passam do limite de 0,85; o XC60 B5 (motor não vendido no Brasil) vai para moderação, como esperado.
- **"Único dono" (prompt `.3`):** em 4 legendas fictícias fora do gabarito, 3 repetições cada, o prompt `.2` acertou 9/12 ("único dono" sozinho virava particular) e o `.3` acertou 12/12, sem mudar o placar do gabarito.
- O placar não mede resumo, cor nem `version_text`; esses foram revisados à mão em cada rodada (relatório final em `evals/extraction/reports/latest-claude-haiku-5-5.md`).

## Próxima fase (Fase 2: extração com IA)

Pré-filtro por regex, extração com Claude (tool use + Zod), normalização (telefone E.164, preço, km, anos), checagem de coerência com a taxonomia, deduplicação e 40 legendas de teste com gabarito. Saída: `npm run extract:eval`.
