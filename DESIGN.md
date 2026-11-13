---
name: Buy My Volvo
description: Buscador e intermediador de Volvo seminovos e usados no Brasil.
colors:
  fjord-blue: "oklch(0.45 0.075 245)"
  fjord-deep: "oklch(0.32 0.06 245)"
  on-fjord: "oklch(0.985 0.002 240)"
  focus-ring: "oklch(0.6 0.08 245)"
  snow: "oklch(0.975 0.005 240)"
  paper: "oklch(1 0 0)"
  graphite: "oklch(0.21 0.012 255)"
  stone: "oklch(0.48 0.012 255)"
  mist: "oklch(0.95 0.009 240)"
  frost: "oklch(0.955 0.007 240)"
  ice: "oklch(0.94 0.02 240)"
  hairline: "oklch(0.895 0.008 240)"
  field-stroke: "oklch(0.87 0.01 240)"
  amber: "oklch(0.7 0.15 70)"
  amber-soft: "oklch(0.97 0.035 85)"
  amber-ink: "oklch(0.42 0.09 60)"
  alert-red: "oklch(0.55 0.2 27)"
  polar-night: "oklch(0.17 0.01 255)"
  polar-surface: "oklch(0.205 0.012 255)"
  polar-text: "oklch(0.96 0.004 240)"
  polar-stone: "oklch(0.73 0.01 240)"
  fjord-blue-night: "oklch(0.76 0.08 240)"
  on-fjord-night: "oklch(0.18 0.02 255)"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.6rem + 2.4vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  title-card:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.375
  price:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  lead:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.55
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.43
  caption:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
  wordmark:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.95rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "-0.025em"
  label-sm:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 500
    lineHeight: 1.5
  numeral:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.04em"
    fontFeature: "tnum"
  plate:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "min(22cqi, 6rem)"
    fontWeight: 600
    lineHeight: 0.85
    letterSpacing: "-0.04em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  2xl: "18px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
  "10": "40px"
  "12": "48px"
  "16": "64px"
components:
  model-plate:
    backgroundColor: "{colors.ice}"
    textColor: "{colors.fjord-deep}"
    typography: "{typography.plate}"
    padding: "20px"
  button-primary:
    backgroundColor: "{colors.fjord-blue}"
    textColor: "{colors.on-fjord}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-primary-hover:
    backgroundColor: "oklch(0.45 0.075 245 / 0.8)"
  button-primary-lg:
    backgroundColor: "{colors.fjord-blue}"
    textColor: "{colors.on-fjord}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 24px"
    height: "48px"
  button-outline:
    backgroundColor: "{colors.snow}"
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    padding: "0 10px"
    height: "32px"
  button-outline-hover:
    backgroundColor: "{colors.frost}"
  button-ghost-hover:
    backgroundColor: "{colors.frost}"
    textColor: "{colors.graphite}"
  chip:
    textColor: "{colors.graphite}"
    typography: "{typography.label}"
    rounded: "{rounded.full}"
    padding: "0 16px"
    height: "44px"
  chip-hover:
    backgroundColor: "{colors.ice}"
  badge-repasse:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.amber-ink}"
    typography: "{typography.caption}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
    height: "20px"
  card-listing:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.2xl}"
    padding: "16px"
  input:
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "4px 10px"
    height: "32px"
  input-public:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: "0 12px"
    height: "44px"
  input-search:
    textColor: "{colors.graphite}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: "0 12px 0 44px"
    height: "48px"
  notice-panel:
    backgroundColor: "{colors.frost}"
    textColor: "{colors.stone}"
    rounded: "{rounded.xl}"
    padding: "16px"
  header:
    backgroundColor: "{colors.snow}"
    textColor: "{colors.graphite}"
    height: "56px"
---

# Design System: Buy My Volvo

## Overview

**Creative North Star: "O Manual do Proprietário"**

O Buy My Volvo se apresenta como um bom manual do proprietário: preciso, honesto e didático. Cada anúncio é uma ficha clara (ano, km, preço, cidade), cada termo Volvo pode ser entendido por quem está chegando agora, e nada disputa atenção com o carro e os seus números. O clima é **sereno, entusiasta e didático**: a calma escandinava de neutros frios e muito respiro, com o entusiasmo de quem conhece a marca aparecendo nos detalhes (a placa tipográfica do modelo, os passos numerados, o selo de verificado em azul).

A densidade é moderada: telas públicas com seções largas separadas por linhas finas, conteúdo num contêiner de 72rem e textos corridos em colunas estreitas. A profundidade vem de tons e linhas, não de sombras: os cards em Papel ficam visivelmente acima do fundo em Neve, e a faixa didática da home fica em Geada. Os componentes são **firmes e confiantes**: as ações principais têm 48px de altura, os cards têm contorno nítido e o preço é o número mais pesado da tela. A identidade nórdica está em refinamento (decisão de 13/11/2026): **mais marcada e mais presente**, sem trocar a base de neutros frios e azul.

O visual fica longe de três mundos: o **portal de classificados** (banners, selos piscando, tudo disputando atenção), o **feirão** (vermelho e amarelo, "IMPERDÍVEL", preço gigante, contagem regressiva) e a **startup genérica** (gradientes roxos, ilustrações 3D, brilho por todo lado).

**Key Characteristics:**

- Neutros frios (matiz 240–255) com um único acento, o Azul Fiorde.
- Uma família tipográfica (Geist), hierarquia por tamanho, peso (500/600) e espaçamento apertado.
- Superfícies planas: bordas finas e painéis tonais; sombra só no que flutua.
- Placa do modelo em Gelo Azul, com o nome em Azul Fiorde e uma linha de ficha: o rosto dos anúncios sem foto.
- Passos numerados como num manual: numerais grandes em Azul Fiorde, sem ícones nem rótulos acima dos títulos.
- Cantos suaves e aninhados: 18px nos cards, 14px nos controles grandes, pílula nos chips.
- Ação principal grande e clara (48px), pensada para o polegar no celular.
- Tema claro e escuro, ambos verificados para WCAG 2.1 AA.

## Colors

Uma paleta fria e contida: neve, grafite e pedra, com o Azul Fiorde como única voz de cor e o âmbar reservado para alertas ao comprador.

### Primary

- **Azul Fiorde** (`fjord-blue`): botões principais, links, o ícone de vendedor verificado, os numerais dos passos de "Como funciona", os marcadores das dicas de segurança e da lista do que conferir no modelo, e o nome do modelo na placa (a 70%, 60% no escuro: pelo menos 3:1, como todo texto grande). No escuro vira o **Azul Fiorde Noturno** (`fjord-blue-night`), mais claro, com texto em `on-fjord-night`.
- **Fiorde Profundo** (`fjord-deep`): texto sobre o fundo Gelo Azul, como a linha de ficha da placa do modelo.
- **Anel de Foco** (`focus-ring`): contorno de foco de teclado, sempre com 3px a 50% de opacidade.

### Neutral

- **Neve Fria** (`snow`): fundo da página, um passo abaixo do Papel para os cards se destacarem. No escuro, **Noite Polar** (`polar-night`).
- **Papel** (`paper`): superfície dos cards e menus. No escuro, **Superfície Polar** (`polar-surface`).
- **Grafite Nórdico** (`graphite`): texto principal e títulos. No escuro, `polar-text`.
- **Pedra** (`stone`): texto secundário, metadados (ano · km, cidade · tipo · data), legendas. No escuro, `polar-stone`.
- **Névoa** (`mist`): fundo dos botões secundários e dos selos de destaque do anúncio.
- **Geada** (`frost`): a faixa didática da home ("Como funciona" e dicas de segurança, de ponta a ponta), painéis tonais (avisos de intermediação, dicas de segurança da página do anúncio e o aviso de busca vazia) e hover de botões outline e ghost.
- **Gelo Azul** (`ice`): superfície da placa do modelo e hover dos chips de busca e de modelo, o único neutro com um toque do acento.
- **Linha Fina** (`hairline`): bordas de cards e divisórias de seção (a 70% nos divisores estruturais: cabeçalho, rodapé, seções da home).
- **Contorno de Campo** (`field-stroke`): borda de inputs e selects, um passo mais escura que a Linha Fina.

### Alertas

- **Âmbar** (`amber`), **Âmbar Suave** (`amber-soft`) e **Tinta Âmbar** (`amber-ink`): selo "Repasse" e quadro de cuidados (repasse, ágio). Borda em âmbar a 60%, fundo suave, texto em tinta.
- **Vermelho de Alerta** (`alert-red`): só erros de formulário e ações destrutivas, quase sempre como tinta suave (10–20% de fundo).

### Named Rules

**The Fjord Accent Rule.** O Azul Fiorde marca o que se clica, o que tem foco e o que indica confiança (verificado, passos, marcadores), e tinge o nome do modelo na placa. Superfícies grandes nunca são azuis; o Gelo Azul é um neutro.

**The Visible Step Rule.** Dois neutros só separam superfícies se a diferença se vê: pelo menos 2% de luminosidade entre fundo, faixa e card, além da Linha Fina.

**The Amber Means Caution Rule.** Âmbar é só para alertas ao comprador declarados no próprio anúncio. Nunca para promoção, destaque ou urgência.

## Typography

**Display Font:** Geist (com ui-sans-serif, system-ui)
**Body Font:** Geist
**Label/Mono Font:** Geist Mono, só para códigos técnicos no admin

**Character:** Uma sans geométrica, limpa e neutra, que soa técnica sem ser fria. A personalidade vem do peso semibold com espaçamento apertado nos títulos e nos preços, como a ficha técnica de um manual.

### Hierarchy

- **Display** (600, 2.25rem → 3rem, 1.1, -0.025em): o título da home ("Encontre seu próximo Volvo."), com `text-balance`.
- **Headline** (600, 1.5rem, 1.33, -0.025em): títulos de seção da home ("Anúncios recentes", "Como funciona") e o título do anúncio, que sobe para 1.875rem em telas maiores.
- **Title** (600, 1.25rem, 1.4, -0.025em): seções da página do anúncio ("Sobre este carro", "Entenda o nome", "Ficha" e a lista do que conferir no modelo) e a contagem de resultados da busca ("5 anúncios"), um degrau acima dos títulos dos cards.
- **Title Card** (500, 1rem, 1.375): o nome do carro no card ("Volvo XC60 T8 Inscription").
- **Price** (600, 1.25rem no card, 1.875rem no anúncio, -0.025em): o preço pedido, o número mais pesado da tela.
- **Body** (400, 1rem, 1.5): textos corridos, em colunas de até 36–48rem.
- **Lead** (400, 1.125rem, 1.55): o subtítulo da home, em Pedra, com `text-pretty`.
- **Label** (500, 0.875rem): botões, links de navegação, chips, rótulos de campos.
- **Label pequeno** (500, 0.8rem): botões pequenos do admin e do painel do vendedor; nunca nas páginas públicas.
- **Wordmark** (600, 0.95rem, -0.025em): só o nome "Buy My Volvo" no cabeçalho.
- **Caption** (400, 0.75rem): notas abaixo do botão de contato, origem da descrição, selos.
- **Numeral** (600, 2.25rem no celular e 3rem a partir de 640px, algarismos tabulares, -0.04em): os numerais dos passos de "Como funciona", em Azul Fiorde.
- **Placa** (600, até 22% da largura da placa e no máximo 6rem, entrelinha 0.85, -0.04em): o nome do modelo na placa sem foto.

### Named Rules

**The One Family Rule.** Toda a hierarquia sai da Geist em três pesos (400, 500, 600). Nenhuma segunda família decorativa.

**The Price Anchor Rule.** O preço é semibold, com espaçamento apertado, na cor do texto. Nunca em vermelho, nunca riscado, nunca com "a partir de".

## Layout

- **Contêiner:** largura máxima de 72rem (1152px), centralizado, com 16px de margem lateral no celular e 24px a partir de 640px.
- **Ritmo das seções:** 48px de respiro vertical no celular e 64px a partir de 640px; seções da home em Neve separadas por uma Linha Fina a 70%. A faixa didática ("Como funciona" e dicas de segurança) fica em Geada, de ponta a ponta, antes do rodapé.
- **Grade de anúncios:** 1 coluna no celular, 2 a partir de 640px, 3 a partir de 1024px, com 16px de espaço entre os cards. No celular, a placa sem foto fica em 2:1 (mais baixa que a foto 16:10) para a grade não virar uma sequência de placas.
- **Página do anúncio:** a partir de 1024px, duas colunas (conteúdo flexível + coluna lateral de 22rem, fixa ao rolar a 80px do topo). No celular, a coluna lateral vem primeiro e o botão de contato fica numa barra fixa no rodapé da tela.
- **Larguras de leitura:** títulos e buscas em até 48rem, textos de apoio em até 36rem.
- **Espaçamento:** escala de 4px; os passos mais usados são 8, 12 e 16px dentro de componentes e 24, 32 e 48px entre blocos.
- **Carregamento:** esqueletos com pelo menos a altura da tela, para o rodapé não pular quando a página chega.

## Elevation & Depth

O sistema é plano. A profundidade vem de tons (Papel sobre Neve, faixa em Geada, painéis em Geada, Papel com Linha Fina dentro da faixa) e de bordas finas. A sombra aparece só no que flutua sobre o conteúdo: o banner de cookies, o painel de filtros e os botões sobre fotos. O cabeçalho e a barra de contato do celular ficam translúcidos (80–95%) com desfoque do fundo, para dar a sensação de camada sem sombra.

### Shadow Vocabulary

- **Flutuante** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): banner de cookies e painéis sobrepostos.
- **Sobre foto** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): botões pequenos posicionados sobre miniaturas de foto.

### Named Rules

**The Flat Snow Rule.** Cards e painéis ficam planos em repouso e no hover. O hover de um card é a borda tingida de Azul Fiorde (40%), nunca sombra nem elevação.

## Shapes

Retângulos de cantos suaves, aninhados do maior para o menor: cards, galerias, ficha técnica e painéis de dicas com 18px; controles grandes (busca, botão de contato) e avisos com 14px; botões e campos padrão com 10px; chips e selos em pílula. As imagens são recortadas em 16:10 nos cards e em 4:3 na galeria da página do anúncio (a proporção das fotos de celular), sempre dentro do card com borda; sem foto, a placa da página do anúncio fica em 16:9. A placa do modelo (sem foto) é tipográfica: superfície lisa em Gelo Azul, o nome do modelo grande em Azul Fiorde, sem desenho de carro, sem degradê e sem nenhum elemento da marca Volvo.

### Named Rules

**The Nested Radius Rule.** O raio diminui de fora para dentro (18 → 14 → 10px); nada dentro de um card tem raio maior que o card.

## Components

### Buttons

Firmes e diretos: um único botão principal por bloco, com texto que diz a ação ("Buscar", "Tenho interesse: falar no WhatsApp").

- **Shape:** cantos suaves (10px); a versão grande usa 14px.
- **Primary:** Azul Fiorde com texto `on-fjord`, 32px de altura, 10px de preenchimento lateral, Label.
- **Primary grande (ação principal das páginas públicas):** 48px de altura, 24px de preenchimento lateral, texto de 1rem. Usado na busca e no botão de contato do anúncio (largura total no celular).
- **Hover / Focus:** o fundo cai para 80%; o foco de teclado ganha borda no Anel de Foco e um anel de 3px a 50%; ao pressionar, desce 1px. Desabilitado fica a 50%.
- **Outline:** fundo Neve, Linha Fina, hover em Geada. **Secondary:** fundo Névoa. **Ghost:** sem fundo, hover em Geada (usado no botão de tema). **Destructive:** tinta suave de vermelho (10%, 20% no hover). **Link:** Azul Fiorde com sublinhado no hover.

### Chips

- **Style:** pílula com Linha Fina, sem fundo, texto Grafite em Label, 44px de altura no celular; a partir de 640px, 36px (40px nos chips de modelo, que trazem a contagem em Pedra).
- **State:** hover com fundo Gelo Azul e borda Azul Fiorde a 40%; foco com o anel de 3px. Usados para "Buscas populares" e "Explore por tipo e modelo". O chip que abre um tipo inteiro ("Todos os SUVs") fica em Gelo Azul, sem borda.

### Badges

- **Padrão:** pílula de 20px, Caption em peso 500.
- **Repasse:** fundo Âmbar Suave, texto Tinta Âmbar, borda Âmbar a 60%, com `title` explicando que o próprio anúncio se declara repasse.
- **Destaques do anúncio:** fundo Névoa, 28px de altura, texto de 0.875rem em peso normal.

### Cards / Containers

- **Corner Style:** 18px.
- **Background:** Papel, sobre o fundo Neve.
- **Shadow Strategy:** nenhuma (ver The Flat Snow Rule).
- **Border:** Linha Fina; no hover, Azul Fiorde a 40%.
- **Internal Padding:** 16px, com 8px entre as linhas.
- **Card de anúncio:** imagem 16:10 (ou a placa do modelo, 2:1 no celular), título do carro, "ano · km" em Pedra, selo de repasse quando houver, preço empurrado para baixo e a linha "cidade · tipo de vendedor · há N dias". O card inteiro é clicável por um link esticado no título; o selo de verificado fica à direita do título, em Azul Fiorde.

### Inputs / Fields

- **Style:** borda em Contorno de Campo, 10px de raio, texto de 1rem no celular (evita o zoom do iOS) e 0.875rem a partir de 768px. Nas páginas públicas (formulário do vendedor, autorização, remoção, reivindicação, filtros e painel do vendedor), 44px de altura sobre Papel (branco a 30% no escuro), aplicados pela classe `PUBLIC_FIELDS` no formulário; o admin mantém 32px com fundo transparente.
- **Escolhas:** rádios e caixas de seleção de 20px dentro de uma linha clicável de 44px. "Você é: Particular | Loja" vira dois blocos de 44px em Papel, com borda em Azul Fiorde e fundo Gelo Azul quando marcados; o CNPJ só aparece para loja.
- **Fotos:** área de 112px com borda tracejada em Papel, ícone em Azul Fiorde, "Escolher fotos" e a contagem; nenhuma foto sai em silêncio (acima de 10 MB, fora do limite ou que não seja imagem: aviso em âmbar escuro, anunciado ao leitor de tela).
- **Dica e erro:** ficam embaixo do campo e são ligados a ele (`aria-describedby`), para o leitor de tela ler junto.
- **Busca:** 48px de altura (44px no cabeçalho da busca a partir de 640px), 14px de raio, ícone de lupa à esquerda e texto sempre em 1rem.
- **Focus:** borda no Anel de Foco e anel de 3px a 50%.
- **Error / Disabled:** erro com borda vermelha e anel vermelho a 20%; desabilitado a 50% com cursor de bloqueio.

### Navigation

- **Cabeçalho:** fixo no topo, 56px, Neve a 80% com desfoque e Linha Fina a 70% embaixo. À esquerda, o nome "Buy My Volvo" como texto (papel Wordmark: 0.95rem, semibold, espaçamento apertado), sem logotipo; à direita, o link "Anuncie seu Volvo" (Label, hover em Névoa) e o botão de tema, ambos com 44px de altura no celular. O rótulo do botão de tema só diz a ação ("Ativar tema escuro" ou "claro") depois que a página carrega.
- **Rodapé:** Linha Fina a 70% em cima, texto de 0.875rem em Pedra, links com sublinhado no hover (44px de altura no celular), a frase de intermediação e "Não afiliado à Volvo Car Corporation."
- **Alvos de toque:** no celular, tudo o que se toca tem pelo menos 44px de altura: chips, ordenação, paginação, botões e links soltos (estes ganham área de toque sem mudar o espaço que ocupam). Links dentro de frases ficam como texto.
- **Trilha de navegação:** 0.875rem em Pedra, com hover em Grafite.

### Placa do modelo (Signature Component)

O lugar da foto quando o anúncio não tem foto licenciada, e o rosto da maioria dos anúncios. Superfície lisa em Gelo Azul; o nome do modelo-base enorme (papel tipográfico Placa) em Azul Fiorde a 70% (60% no escuro, para manter pelo menos 3:1 sobre o Gelo Azul); logo abaixo, a linha de ficha em Fiorde Profundo (0.875rem, 500), gerada só da taxonomia: variante, carroceria e geração do ano-modelo ("SUV · 2ª geração", "Cross Country · Hatch", "2ª geração (hatch)"); "sem foto" em Pedra (0.75rem) no canto superior direito. A placa é decorativa (`aria-hidden`): o título do card já diz o modelo. É o detalhe de entusiasta que faz um anúncio sem foto parecer intencional.

### Passos numerados

A forma de "Como funciona": lista ordenada de três passos, cada um aberto por uma Linha Fina. À esquerda, o numeral (papel Numeral, Azul Fiorde) alinhado pela linha de base ao título (1.125rem, 500); embaixo, o texto em Pedra. Sem ícones e sem rótulo acima do título: a ordem é a informação, e o numeral a carrega.

### Explore por tipo e modelo

Na home, os modelos com anúncios agrupados pela carroceria (SUV, Sedã, Perua, Hatch, Cupê, Conversível), cada grupo numa linha aberta por uma Linha Fina: o nome do tipo à esquerda (1.125rem, 600) e, à direita, o chip "Todos os SUVs" em Gelo Azul com a contagem (abre a busca pela carroceria), seguido dos chips de modelo com contagem. Cada modelo fica no tipo da sua geração mais recente. O agrupamento mostra, sem precisar dizer, que no nome Volvo XC é SUV, S é sedã e V é perua.

### Chips da busca interpretada

"Entendemos:" lista só o que a busca reconheceu (chips em Gelo Azul com ×). As palavras que ela não reconheceu ficam numa linha própria, "Também buscamos o texto:", com o mesmo chip; nunca aparecem como entendidas.

### Entenda o nome

Na página do anúncio, entre "Sobre este carro" e a Ficha: o título do carro dividido em modelo, motor e versão, como lista de definições. Cada parte é aberta por uma Linha Fina, com o código como está no título (1.5rem, 600, Grafite), o papel ("Modelo", "Motor", "Versão", 0.875rem, 500) e a explicação em Pedra. O texto sai só da taxonomia e do significado geral de cada termo: carroceria e geração ("SUV · 2ª geração, desde 2018"), o combustível do motor ("Híbrido plug-in (motor a gasolina e motor elétrico, com bateria que carrega na tomada)") e o que é uma versão ("A versão define o pacote de equipamentos e o acabamento"). Some quando o título é só o modelo. Na página de modelo, os motores aparecem em linhas (chip e combustível ao lado, em coluna alinhada) e as versões em chips sob a mesma frase; nos filtros, os motores ficam agrupados por combustível e as variantes dizem o que incluem ("V40 (inclui Cross Country)").

### Quadros de aviso

- **Aviso de intermediação:** Geada, 14px de raio, 16px de preenchimento, texto de 0.875rem em Pedra com ícone de informação.
- **Dicas de segurança:** 18px de raio, 24px de preenchimento (40px a partir de 640px), escudo em Azul Fiorde no título e marcadores de 6px em Azul Fiorde. Na página do anúncio, Geada; na home, Papel com Linha Fina dentro da faixa em Geada.
- **Ficha técnica:** grade de 2 ou 3 colunas dentro de um contêiner com Linha Fina e 18px de raio; rótulo em Pedra (0.875rem) e valor em peso 500.

## Do's and Don'ts

### Do:

- **Do** usar o Azul Fiorde só para ação, foco e sinais de confiança; as superfícies ficam neutras.
- **Do** separar superfícies com Linha Fina e painéis em Geada, não com sombra.
- **Do** dar à ação principal de cada página pública 48px de altura, 14px de raio e texto de 1rem.
- **Do** manter o preço em semibold com espaçamento apertado, como o número mais pesado do card e do anúncio.
- **Do** definir toda cor como token com a versão do tema escuro e conferir o contraste AA nos dois temas.
- **Do** mostrar a placa do modelo (Gelo Azul, nome em Azul Fiorde a 70%, linha de ficha da taxonomia) quando não houver foto licenciada pelo vendedor.
- **Do** numerar sequências de verdade (passos) com o numeral grande em Azul Fiorde, à esquerda do título.
- **Do** explicar o código Volvo onde ele aparece (motor, versão, variante), com palavras geradas da taxonomia; o mesmo termo usa sempre as mesmas palavras.
- **Do** usar o âmbar suave (fundo, borda a 60%, tinta) para os alertas de repasse e ágio.

### Don't:

- **Don't** usar o logotipo da Volvo, o "iron mark" ou qualquer elemento visual oficial da marca.
- **Don't** parecer um portal de classificados: nada de banners, selos piscando ou vários destaques disputando atenção.
- **Don't** usar a linguagem do feirão: vermelho e amarelo, "IMPERDÍVEL", preço gigante, contagem regressiva.
- **Don't** usar gradientes roxos, ilustrações 3D ou brilhos de startup genérica.
- **Don't** dar sombra ou elevação aos cards, nem em repouso nem no hover.
- **Don't** separar superfícies com neutros a menos de 2% de luminosidade um do outro, nem com degradê entre tons quase iguais: se não se vê, não separa.
- **Don't** pôr um rótulo pequeno acima de títulos (eyebrow); a hierarquia vem do próprio título.
- **Don't** usar o vermelho fora de erros e ações destrutivas, nem o âmbar fora dos alertas ao comprador.
- **Don't** mostrar fotos que não vieram com a licença do vendedor.
