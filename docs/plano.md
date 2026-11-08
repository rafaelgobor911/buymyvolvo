# Plano revisado (após a Fase 0)

## Decisões tomadas

| Tema                          | Decisão                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Nome e domínio                | **Provisório**: `NEXT_PUBLIC_SITE_NAME` (padrão `[NOME_DO_SITE]`). Definir até a Fase 7                            |
| Relação com a Made by Sweden  | **Domínio próprio + links cruzados** (conteúdo "o que checar neste modelo", divulgação na comunidade)              |
| Conta do Instagram para a API | **@buymyvolvo**, ligada à Página "Buy My Volvo" (Business Suite) e ao app "Buy My Volvo" (modo de desenvolvimento) |
| Repositório                   | GitHub (você cria e conecta; eu faço o push)                                                                       |
| Gerenciador de pacotes        | npm (Node 22)                                                                                                      |
| UI                            | shadcn/ui no estilo `base-nova` (primitivas Base UI), Geist, neutros + azul-aço, claro/escuro                      |
| Next.js                       | 16.4 com Cache Components + Partial Prefetching (padrão do create-next-app; serão o padrão na próxima major)       |

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
- `graph.facebook.com` está liberado no ambiente `buymyvolvo`. **Salvar variáveis nas configurações do ambiente tem apagado essa liberação**: no início de cada sessão, conferir e liberar de novo se for preciso.
- O `fetch` do Node só passa pelo proxy desta sandbox com `NODE_USE_ENV_PROXY=1` (em produção não é necessário): `NODE_USE_ENV_PROXY=1 npm run job -- ...`.
- Variáveis da Meta no ambiente: `META_APP_ID`, `META_APP_SECRET`, `IG_LONG_LIVED_TOKEN`, `IG_BUSINESS_USER_ID`.
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

## Fase 3: decisões

| Tema                  | Decisão                                                                                                                                                                               |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Acesso à Meta         | Business Discovery com _Standard Access_ (sem App Review, sem CNPJ). Hashtag Search respondeu em modo de desenvolvimento; tratado como bônus                                          |
| Token                 | Usuário, 60 dias (vence 07/01/2027), renovação manual pelo Graph API Explorer; `token-health` diário alerta 10 dias antes. System User quando houver portfólio                        |
| Cliente               | `fetch` + Zod, sem SDK. Token no header `Authorization` + `appsecret_proof`. Lê `X-App-Usage` e `X-Business-Use-Case-Usage` e para a coleta em 90%                                    |
| Erros                 | Limite (4, 17, 32, 613, 80000–80014) e temporários (`is_transient`, 1, 2, 5xx): espera exponencial. Token inválido (190): o job falha. Conta pessoal (110): registra na fonte e segue |
| Dados pedidos         | Sem `media_url` nem métricas: id, legenda, tipo, permalink e data                                                                                                                     |
| Jobs                  | `collect-business-discovery` (2–3h), `collect-hashtags` (1h), `process-posts`, `token-health` e `expire-listings` (diários). Trava por prazo em `job_locks`, registro em `job_runs`   |
| Dry-run               | O mesmo código numa transação desfeita. Com a API real, hashtags que gastariam vaga nova não são consultadas (a vaga da Meta não volta)                                               |
| Ciclo de vida         | Legenda editada para "vendido" → `sold`. Post sumido do trecho lido → `expired`, se não houver outra fonte viva. Só de hashtag: aviso aos 14 dias, expira aos 30                      |
| Orçamento de hashtags | Teto 25 de 30 (`hashtag_budget_max`), sincronizado com `recently_searched_hashtags`; buscas feitas fora do sistema entram como `ext_<id>`                                             |
| Fixtures              | Mundo fictício com as respostas e erros reais; fontes terminadas em `.demo`/`_demo` (`npm run sources -- add-fixtures`, `npm run job -- all --fixtures`)                              |
| Agendamento           | Rotas `/api/cron/<job>` (GET/POST) com `CRON_SECRET`. O agendador de produção fica para a Fase 7                                                                                      |

### Teste real (08/11/2026)

- **Coleta:** 6 lojas (@matellimotors, @nattamotors, @bslmotors, @autolandbrasil, @webcarsbrasil, @safetycarmotors), 300 posts em 12 requisições (~10 s), nenhum erro. O dry-run anterior não gravou nada.
- **Pré-filtro:** 285 descartados sem IA: carros de outras marcas (cinco lojas são multimarca), vídeos de conteúdo sem venda (Matelli) e 4 posts "VENDIDO".
- **Extração:** 15 posts → 11 anúncios publicados, 1 em moderação (o resumo repetiu 8 palavras da legenda) e 3 duplicados juntados ao anúncio original. Custo: US$ 0,0052.
- **Conferência manual dos 12 anúncios:** modelo, motor, versão, ano, km e preço corretos. A cidade vem da bio quando a legenda não traz (Vinhedo, Ribeirão Preto).
- **Hashtag:** #volvoavenda (1 de 25 vagas), sem posts nas últimas 24h.
- **Token:** válido por mais 59 dias, com todas as permissões.

### Revisão da Fase 3 (08/11/2026)

Todos os itens aprovados na página de revisão; merge da Fase 3 feito.

| Item                       | Decisão                                                                                                    | Quando          |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- | --------------- |
| Extração em legendas reais | Gabarito com ~30 legendas reais; prompt: resumo só sobre o carro, motor só quando escrito                  | Antes da Fase 4 |
| Aviso de prévia            | Desligar o modo de prévia em produção quando entrarem dados reais                                          | Fase 7          |
| Legenda editada            | Reprocessar e atualizar preço/km de anúncio não reivindicado, guardando o valor anterior                   | Fase 5          |
| Alertas                    | No painel do admin (Fase 5) e por e-mail (Fase 7, provedor a escolher)                                     | Fases 5 e 7     |
| Agendador                  | Decidir na Fase 7. **Hashtags 1 vez por dia** (decisão do dono do produto): `poll_interval_minutes = 1440` | Fase 7          |
| Token                      | Renovar à mão até haver portfólio com CNPJ; depois System User                                             | Até 28/12/2026  |

**Hashtags escolhidas (19):** #volvoxc60, #volvoxc40, #volvoxc90, #volvoex30, #volvoex40, #volvoex90, #volvoc40, #volvoec40, #volvos60, #volvos90, #volvov60, #volvov40, #volvoc30, #volvos40, #volvoxc70, #volvo850, #volvot8, #volvot5, #volvot6. A #volvoavenda ficou de fora (pausada; conta até 15/11). Orçamento: 20 de 25.

**Primeira coleta (08/11):** 274 posts nas últimas 24h (máximo de 63 por hashtag, longe do teto de 200 por execução, então 1 vez por dia comporta o volume). 11 passaram do pré-filtro, 9 viraram anúncio: 4 brasileiros publicados (#volvoxc60, #volvoxc40, #volvot8, #volvot5) e 5 estrangeiros (Espanha, Itália, Angola) que só a regra de mercado brasileiro segurou.

**Ajustes feitos depois da revisão (branch `phase-3-followup`):**

- **Pré-filtro por origem:** lojas cadastradas são brasileiras por curadoria e pulam a checagem de Brasil (recuperou 4 anúncios reais da Autoland, sem R$ nem telefone na legenda); posts de hashtag precisam de R$, +55 ou telefone com DDD (barra os estrangeiros). Sigla de UF só conta em maiúsculas ("es", "pe" e "ms" são palavras em espanhol e italiano).
- **Moeda estrangeira:** preço em euro, dólar, libra ou kwanza fica vazio e o anúncio vai para moderação.
- **Tempo:** cada leitura de hashtag leva 7 a 20 s na API da Meta (19 hashtags = ~5 min). Os jobs de coleta aceitam um orçamento de tempo (`--max-seconds`; 240 s nas rotas de cron) e continuam de onde pararam na chamada seguinte, por isso o agendador deve chamar a rota mais de uma vez por dia mesmo com hashtags diárias.

### Extração em legendas reais (08/11/2026)

**Gabarito real** (`evals/extraction/dataset-real.ts`, `npm run extract:eval -- --set=real`): 35 posts reais das 6 lojas e das hashtags, anonimizados (telefones brasileiros trocados por fictícios, telefones estrangeiros, e-mails, links, sites, menções e nomes de pessoas removidos) e guardados no repositório com aprovação do dono do produto. 20 anúncios brasileiros e 15 negativos (estrangeiros, vendidos, outras marcas, conteúdo). O gabarito foi escrito lendo as legendas; motor não escrito = vazio.

| Conjunto real                         | Prompt `.4` | Prompt `.6` + normalização (2 rodadas) |
| ------------------------------------- | ----------- | -------------------------------------- |
| Campos corretos                       | 98,2%       | **100%**                               |
| Motor                                 | 18/20       | **20/20**                              |
| Telefone                              | 18/20       | **20/20**                              |
| Resumos que falam do vendedor/negócio | 10 de 20    | **0**                                  |
| Resumos que copiam a legenda          | 1           | **0**                                  |
| Custo por 1.000 posts                 | US$ 0,21    | US$ 0,18                               |

O conjunto fictício segue em 100% (40/40, 6/6 alertas); 1 resumo ainda cita "venda rápida".

**O que mudou:**

- Taxonomia: **P6** = Single Motor e **P8** = Twin Motor (XC40/C40 Recharge, também em anúncios de EX40/EC40); o prompt passou a listar os apelidos dos motores.
- Prompt `2026-11-08.6`: resumo só sobre o carro (sem vendedor, loja, financiamento, troca, propostas, sinal, pressa, entrega), de 1 a 3 frases; motor só quando escrito; a bio da conta não descreve o carro (um resumo chegou a dizer que o carro era blindado porque a bio da loja falava em blindados); telefones da legenda.
- Normalização: motor que a legenda não nomeia é descartado; o motor escrito na versão vale mais que o campo do modelo; o par de anos escrito na legenda ("20/20", "2023/2024", "2024/24") vale mais que a leitura do modelo; telefone da legenda antes do da bio.

**Resíduos:** um resumo inverteu o sentido de "primeira [revisão] feita agora" para "ainda por fazer". Erros de compreensão assim não têm regra que pegue; sugestão para a Fase 5/7: marcar o texto como "resumo automático do post; confira no original".

### Pendências

- Rendimento por hashtag depois de uma semana de coleta (depende de rodar a coleta diária; até a Fase 7 só manualmente).
- Rótulo de resumo automático na página do anúncio (decidir na Fase 5 ou 7).
- Itens das fases 5 e 7 na tabela da revisão.

## Próxima fase (Fase 4: leads e WhatsApp)

Rota `/r/[ref]`, registro de lead (IP e user agent só em hash com salt), deduplicação de cliques, mensagem configurável e fallback para o Instagram quando não houver telefone. Saída: o clique gera um lead e abre o WhatsApp com a mensagem certa (testado no celular).
