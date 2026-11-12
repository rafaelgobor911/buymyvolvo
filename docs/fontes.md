# Fontes de anúncios além do Instagram (Fase 9c)

Pesquisa de 12/11/2026 sobre de onde mais o Buy My Volvo pode tirar anúncios **sem scraping** e **com a autorização do dono do anúncio** (regras do `CLAUDE.md`). É um documento de decisão: nada aqui foi implementado.

## Resumo

1. **Os portais (OLX, Webmotors, iCarros, Facebook Marketplace) não oferecem leitura de anúncios de terceiros.** As APIs que existem servem para o próprio anunciante publicar o estoque dele. A Webmotors veda raspagem nos termos de uso. Para esses portais, o caminho continua sendo a Fase 9a: copiar à mão o anúncio de um vendedor que vocês contataram.
2. **O caminho mais promissor é o estoque da própria loja, com a autorização dela.** As lojas já usam sistemas de gestão (DMS) que publicam o mesmo estoque no site da loja e em vários portais. O Buy My Volvo pode receber esse estoque de duas formas: por um **link de feed** que a loja já tem, ou como **mais um canal** dentro desses sistemas.
3. **Mercado Livre:** dá para usar a API **com a conta do próprio vendedor** (ele conecta e autoriza). Puxar anúncios de terceiros pela API vai contra o espírito dos termos de desenvolvedor, que limitam o uso a servir os usuários do próprio aplicativo.

## Fonte por fonte

| Fonte                                                                           | Leitura de anúncios de terceiros                                                           | O que é permitido                                                                            | Recomendação                                                            |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| **Feed de estoque da loja** (XML/CSV do sistema dela)                           | Não se aplica: é a loja que entrega                                                        | Com a autorização da loja (Termos do Anunciante)                                             | **Fazer primeiro** (ver abaixo)                                         |
| **Sistemas de gestão** (Autoconf, Revenda Mais, Altimus, Cockpit da Webmotors…) | Não                                                                                        | Virar um canal de destino, como os portais                                                   | Conversa comercial com 1 ou 2 sistemas                                  |
| **Mercado Livre**                                                               | Termos limitam o uso da API ao serviço dos usuários do app                                 | A loja conecta a conta dela (OAuth) e o site lê só os anúncios dela                          | Avaliar depois do feed; confirmar os termos do Brasil                   |
| **OLX**                                                                         | Sem API pública de leitura no Brasil; a OLX comprou a Altimus (DMS) em 2023                | Só a publicação pelo próprio anunciante                                                      | Só pela Fase 9a (colar à mão)                                           |
| **Webmotors**                                                                   | Termos vedam raspagem ("crawler") por terceiros                                            | A Webmotors funciona como hub do estoque das lojas (Cockpit) e conecta a outros marketplaces | Só pela Fase 9a; perguntar sobre virar canal                            |
| **iCarros**                                                                     | Sem API pública de leitura encontrada                                                      | Painel e integrações para revendas                                                           | Só pela Fase 9a                                                         |
| **Facebook Marketplace**                                                        | Sem API de leitura; desde 2023 páginas de empresa não criam anúncios de veículos no Brasil | Anúncios pagos de estoque (catálogo de veículos da Meta)                                     | Só pela Fase 9a; o formato do catálogo pode servir como formato de feed |

## 1. Feed de estoque da loja (recomendado)

**Como funciona:** muitas lojas já têm um arquivo de estoque (XML ou CSV), gerado pelo sistema delas, para alimentar o próprio site, portais ou anúncios no Facebook e no Google. A loja autoriza (Termos do Anunciante, como no convite da 8a) e informa o link. Um job lê o feed de tempos em tempos, cria ou atualiza os anúncios da loja e marca como vendido o que sumiu.

**Por que é o melhor caminho:**

- Tem a autorização explícita do dono do estoque.
- Os dados vêm estruturados (sem depender da extração por IA), com fotos licenciadas e preço atualizado.
- O ciclo de vida fica automático, como no Business Discovery do Instagram.

**O que falta descobrir:** os formatos reais. Cada sistema tem o seu, e os formatos dos catálogos de anúncios de veículos (da Meta, por exemplo) são candidatos a "formato padrão". Precisamos de **1 ou 2 lojas parceiras** que mandem um exemplo do feed delas.

**Esforço estimado** (com um exemplo real em mãos): importador para um formato, tela para cadastrar o feed da loja (em Fontes) e o job de atualização, no mesmo padrão dos jobs da Fase 3. É uma fase do tamanho da 9a.

## 2. Virar canal nos sistemas de gestão

As lojas publicam o estoque em vários portais a partir de um só sistema: Autoconf, Revenda Mais, Altimus (da OLX), Cockpit (da Webmotors) e outros. Se o Buy My Volvo virar um dos destinos, toda loja que usa aquele sistema pode ligar o Buy My Volvo com um clique.

- É **comercial antes de técnico**: depende de o fornecedor aceitar o Buy My Volvo como canal (e às vezes de pagamento ou de volume mínimo).
- Tecnicamente, costuma ser o feed do item 1 ou uma API que o sistema chama.
- Vale perguntar às lojas que vocês já acompanham qual sistema elas usam: se a maioria usa o mesmo, a conversa fica fácil de priorizar.

## 3. Mercado Livre com a conta do vendedor

A API do Mercado Livre funciona com OAuth: o vendedor entra com a conta dele e autoriza o aplicativo. Com isso, o Buy My Volvo pode ler **os anúncios daquele vendedor** e mantê-los sincronizados.

- Os termos de desenvolvedor que a pesquisa encontrou (versão argentina; a brasileira segue a mesma linha) dão uma licença revogável e limitam o uso da API e do conteúdo a facilitar o serviço para os usuários do aplicativo. Ler anúncios de terceiros para montar um catálogo concorrente não se encaixa nisso.
- Exige criar um aplicativo no portal de desenvolvedores do Mercado Livre. Esta sessão não consegue abrir `developers.mercadolivre.com.br` (o host não está liberado na rede do ambiente), então os detalhes da versão brasileira dos termos e da categoria de veículos ficam para conferir.
- Faz sentido depois do item 1: o vendedor que anuncia no Mercado Livre normalmente também tem o estoque num sistema de gestão.

## 4. Portais sem leitura para terceiros

Para OLX, Webmotors, iCarros e Facebook Marketplace não há API de leitura, e a pesquisa só encontrou ferramentas de raspagem de terceiros (proibidas pelas regras do projeto e, no caso da Webmotors, pelos termos de uso). O que continua valendo:

- **Fase 9a:** a equipe vê o anúncio, fala com o vendedor, cola o texto no admin e manda o convite de autorização.
- **Fase 9b:** convidar esses vendedores a cadastrar o carro em "Anuncie seu Volvo".

## Perguntas para o dono do produto

1. Alguma das lojas que vocês acompanham aceitaria ser a **loja piloto do feed**? Basta o link (ou um arquivo de exemplo) do estoque.
2. Vocês sabem **qual sistema de gestão** essas lojas usam? Isso decide com quem conversar no item 2.
3. Querem que eu abra a conversa técnica com algum fornecedor (Mercado Livre, Webmotors, OLX), ou isso fica com vocês, pelo lado comercial?

## Fontes consultadas

- Mercado Livre: [Items & Searches (documentação)](https://developers.mercadolivre.com.br/en_us/items-and-searches) e [Termos do programa de desenvolvedores (Argentina)](https://developers.mercadolibre.com.ar/es-ar-terminos-y-condiciones); [Termos de desenvolvedor do Mercado Pago (Brasil)](https://www.mercadopago.com.br/developers/pt/guides/resources/legal/terms-and-conditions).
- Webmotors: [Segurança, termos e LGPD](https://www.webmotors.com.br/seguranca/); [Cockpit (Consumidor Moderno)](https://consumidormoderno.com.br/nova-plataforma-webmotors/); [Webmotors como hub de marketplaces (Neofeed)](https://neofeed.com.br/blog/home/webmotors-pega-carona-com-santander-e-car-sales-e-engata-expansao-internacional/).
- OLX: [OLX compra a Altimus (AutoData)](https://www.autodata.com.br/news/2023/07/06/olx-anuncia-aquisicao-da-altimus/58588/).
- Sistemas de gestão: [Autoconf integra site e portais (Economic News Brasil)](https://economicnewsbrasil.com.br/2022/01/04/nova-tecnologia-turbina-a-gestao-de-lojas-de-carros-usados-e-seminovos/); [Integrações com OLX, Mercado Livre e Webmotors (AutoSDR, material de fornecedor)](https://blog.autosdr.com.br/blog/integracoes-marketplace-olx-mercadolivre-webmotors).
- iCarros: [Manual do Portal Revenda](https://www.icarros.com.br/media/mediaresource?id=1717).
- Facebook Marketplace: [Mudança nos anúncios de veículos de empresas (Meta, 2023)](https://www.facebook.com/business/help/492940666175475); [Fim dos feeds de concessionárias (NetSource Media)](https://www.netsourcemedia.com/blog/changes-dealership-facebook-ads/).

Os textos de fornecedores (AutoSDR, Autoconf) são material comercial: servem como indício, não como especificação técnica.
