---
name: Buy My Volvo
description: Buscador e intermediador de Volvo seminovos e usados no Brasil.
colors:
  fjord-blue: "oklch(0.45 0.075 245)"
  fjord-deep: "oklch(0.32 0.06 245)"
  on-fjord: "oklch(0.985 0.002 240)"
  focus-ring: "oklch(0.6 0.08 245)"
  snow: "oklch(0.99 0.002 240)"
  paper: "oklch(1 0 0)"
  graphite: "oklch(0.21 0.012 255)"
  stone: "oklch(0.48 0.012 255)"
  mist: "oklch(0.96 0.006 240)"
  frost: "oklch(0.965 0.004 240)"
  ice: "oklch(0.95 0.018 240)"
  hairline: "oklch(0.905 0.006 240)"
  field-stroke: "oklch(0.88 0.008 240)"
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
  eyebrow:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.33
    letterSpacing: "0.1em"
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
    height: "36px"
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

A densidade é moderada: telas públicas com seções largas separadas por linhas finas, conteúdo num contêiner de 72rem e textos corridos em colunas estreitas. A profundidade vem de tons e linhas, não de sombras. Os componentes são **firmes e confiantes**: as ações principais têm 48px de altura, os cards têm contorno nítido e o preço é o número mais pesado da tela. A identidade nórdica está em refinamento (decisão de 13/11/2026): **mais marcada e mais presente**, sem trocar a base de neutros frios e azul.

O visual fica longe de três mundos: o **portal de classificados** (banners, selos piscando, tudo disputando atenção), o **feirão** (vermelho e amarelo, "IMPERDÍVEL", preço gigante, contagem regressiva) e a **startup genérica** (gradientes roxos, ilustrações 3D, brilho por todo lado).

**Key Characteristics:**

- Neutros frios (matiz 240–255) com um único acento, o Azul Fiorde.
- Uma família tipográfica (Geist), hierarquia por tamanho, peso (500/600) e espaçamento apertado.
- Superfícies planas: bordas finas e painéis tonais; sombra só no que flutua.
- Cantos suaves e aninhados: 18px nos cards, 14px nos controles grandes, pílula nos chips.
- Ação principal grande e clara (48px), pensada para o polegar no celular.
- Tema claro e escuro, ambos verificados para WCAG 2.1 AA.

## Colors

Uma paleta fria e contida: neve, grafite e pedra, com o Azul Fiorde como única voz de cor e o âmbar reservado para alertas ao comprador.

### Primary

- **Azul Fiorde** (`fjord-blue`): botões principais, links, o ícone de vendedor verificado, os rótulos "Passo 1, 2, 3", os marcadores das dicas de segurança e da lista do que conferir no modelo. No escuro vira o **Azul Fiorde Noturno** (`fjord-blue-night`), mais claro, com texto em `on-fjord-night`.
- **Fiorde Profundo** (`fjord-deep`): texto sobre o fundo Gelo Azul (estado de destaque suave).
- **Anel de Foco** (`focus-ring`): contorno de foco de teclado, sempre com 3px a 50% de opacidade.

### Neutral

- **Neve Fria** (`snow`): fundo da página. No escuro, **Noite Polar** (`polar-night`).
- **Papel** (`paper`): superfície dos cards e menus. No escuro, **Superfície Polar** (`polar-surface`).
- **Grafite Nórdico** (`graphite`): texto principal e títulos. No escuro, `polar-text`.
- **Pedra** (`stone`): texto secundário, metadados (ano · km, cidade · tipo · data), legendas. No escuro, `polar-stone`.
- **Névoa** (`mist`): fundo dos botões secundários e dos selos de destaque do anúncio.
- **Geada** (`frost`): painéis tonais (dicas de segurança e avisos de intermediação, usados a 60%) e hover de botões outline e ghost.
- **Gelo Azul** (`ice`): hover dos chips de busca e de modelo, o único neutro com um toque do acento.
- **Linha Fina** (`hairline`): bordas de cards e divisórias de seção (a 70% nos divisores estruturais: cabeçalho, rodapé, seções da home).
- **Contorno de Campo** (`field-stroke`): borda de inputs e selects, um passo mais escura que a Linha Fina.

### Alertas

- **Âmbar** (`amber`), **Âmbar Suave** (`amber-soft`) e **Tinta Âmbar** (`amber-ink`): selo "Repasse" e quadro de cuidados (repasse, ágio). Borda em âmbar a 60%, fundo suave, texto em tinta.
- **Vermelho de Alerta** (`alert-red`): só erros de formulário e ações destrutivas, quase sempre como tinta suave (10–20% de fundo).

### Named Rules

**The Fjord Accent Rule.** O Azul Fiorde marca o que se clica, o que tem foco e o que indica confiança (verificado, passos, marcadores). Superfícies grandes nunca são azuis.

**The Amber Means Caution Rule.** Âmbar é só para alertas ao comprador declarados no próprio anúncio. Nunca para promoção, destaque ou urgência.

## Typography

**Display Font:** Geist (com ui-sans-serif, system-ui)
**Body Font:** Geist
**Label/Mono Font:** Geist Mono, só para códigos técnicos no admin

**Character:** Uma sans geométrica, limpa e neutra, que soa técnica sem ser fria. A personalidade vem do peso semibold com espaçamento apertado nos títulos e nos preços, como a ficha técnica de um manual.

### Hierarchy

- **Display** (600, 2.25rem → 3rem, 1.1, -0.025em): o título da home ("Encontre seu próximo Volvo."), com `text-balance`.
- **Headline** (600, 1.5rem, 1.33, -0.025em): títulos de seção da home ("Anúncios recentes", "Como funciona") e o título do anúncio, que sobe para 1.875rem em telas maiores.
- **Title** (600, 1.25rem, 1.4, -0.025em): seções da página do anúncio ("Sobre este carro", "Ficha" e a lista do que conferir no modelo).
- **Title Card** (500, 1rem, 1.375): o nome do carro no card ("Volvo XC60 T8 Inscription").
- **Price** (600, 1.25rem no card, 1.875rem no anúncio, -0.025em): o preço pedido, o número mais pesado da tela.
- **Body** (400, 1rem, 1.5): textos corridos, em colunas de até 36–48rem.
- **Lead** (400, 1.125rem, 1.55): o subtítulo da home, em Pedra, com `text-pretty`.
- **Label** (500, 0.875rem): botões, links de navegação, chips, rótulos de campos.
- **Caption** (400, 0.75rem): notas abaixo do botão de contato, origem da descrição, selos.
- **Eyebrow** (500, 0.75rem, 0.1em, maiúsculas): o "Cross Country" da placa do modelo.

### Named Rules

**The One Family Rule.** Toda a hierarquia sai da Geist em três pesos (400, 500, 600). Nenhuma segunda família decorativa.

**The Price Anchor Rule.** O preço é semibold, com espaçamento apertado, na cor do texto. Nunca em vermelho, nunca riscado, nunca com "a partir de".

## Layout

- **Contêiner:** largura máxima de 72rem (1152px), centralizado, com 16px de margem lateral no celular e 24px a partir de 640px.
- **Ritmo das seções:** 48px de respiro vertical no celular e 64px a partir de 640px; seções da home separadas por uma Linha Fina a 70%.
- **Grade de anúncios:** 1 coluna no celular, 2 a partir de 640px, 3 a partir de 1024px, com 16px de espaço entre os cards.
- **Página do anúncio:** a partir de 1024px, duas colunas (conteúdo flexível + coluna lateral de 22rem, fixa ao rolar a 80px do topo). No celular, a coluna lateral vem primeiro e o botão de contato fica numa barra fixa no rodapé da tela.
- **Larguras de leitura:** títulos e buscas em até 48rem, textos de apoio em até 36rem.
- **Espaçamento:** escala de 4px; os passos mais usados são 8, 12 e 16px dentro de componentes e 24, 32 e 48px entre blocos.
- **Carregamento:** esqueletos com pelo menos a altura da tela, para o rodapé não pular quando a página chega.

## Elevation & Depth

O sistema é plano. A profundidade vem de tons (Papel sobre Neve, painéis em Geada a 60%) e de bordas finas. A sombra aparece só no que flutua sobre o conteúdo: o banner de cookies, o painel de filtros e os botões sobre fotos. O cabeçalho e a barra de contato do celular ficam translúcidos (80–95%) com desfoque do fundo, para dar a sensação de camada sem sombra.

### Shadow Vocabulary

- **Flutuante** (`box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): banner de cookies e painéis sobrepostos.
- **Sobre foto** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): botões pequenos posicionados sobre miniaturas de foto.

### Named Rules

**The Flat Snow Rule.** Cards e painéis ficam planos em repouso e no hover. O hover de um card é a borda tingida de Azul Fiorde (40%), nunca sombra nem elevação.

## Shapes

Retângulos de cantos suaves, aninhados do maior para o menor: cards, galerias, ficha técnica e painéis de dicas com 18px; controles grandes (busca, botão de contato) e avisos com 14px; botões e campos padrão com 10px; chips e selos em pílula. As imagens são recortadas em 16:10 nos cards e 16:9 na página do anúncio, sempre dentro do card com borda. A placa do modelo (sem foto) é tipográfica: o nome do modelo grande e quase transparente, sem desenho de carro e sem nenhum elemento da marca Volvo.

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

- **Style:** pílula com Linha Fina, sem fundo, texto Grafite em Label, 36px de altura (40px nos chips de modelo, que trazem a contagem em Pedra).
- **State:** hover com fundo Gelo Azul e borda Azul Fiorde a 40%; foco com o anel de 3px. Usados para "Buscas populares" e "Explore por modelo".

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
- **Card de anúncio:** imagem 16:10 (ou a placa do modelo), título do carro, "ano · km" em Pedra, selo de repasse quando houver, preço empurrado para baixo e a linha "cidade · tipo de vendedor · há N dias". O card inteiro é clicável por um link esticado no título; o selo de verificado fica à direita do título, em Azul Fiorde.

### Inputs / Fields

- **Style:** borda em Contorno de Campo, fundo transparente (branco a 30% no escuro), 10px de raio, 32px de altura, texto de 1rem no celular (evita o zoom do iOS) e 0.875rem a partir de 768px.
- **Busca:** 48px de altura, 14px de raio, ícone de lupa à esquerda e texto sempre em 1rem.
- **Focus:** borda no Anel de Foco e anel de 3px a 50%.
- **Error / Disabled:** erro com borda vermelha e anel vermelho a 20%; desabilitado a 50% com cursor de bloqueio.

### Navigation

- **Cabeçalho:** fixo no topo, 56px, Neve a 80% com desfoque e Linha Fina a 70% embaixo. À esquerda, o nome "Buy My Volvo" como texto (0.95rem, semibold, espaçamento apertado), sem logotipo; à direita, o link "Anuncie seu Volvo" (Label, hover em Névoa) e o botão de tema.
- **Rodapé:** Linha Fina a 70% em cima, texto de 0.875rem em Pedra, links com sublinhado no hover, a frase de intermediação e "Não afiliado à Volvo Car Corporation."
- **Trilha de navegação:** 0.875rem em Pedra, com hover em Grafite.

### Placa do modelo (Signature Component)

O lugar da foto quando o anúncio não tem foto licenciada: um retângulo com degradê diagonal de Névoa para Geada, o nome do modelo enorme (3–3.75rem, semibold, espaçamento mais apertado) em Grafite a 10%, "Cross Country" como Eyebrow no topo quando for o caso e "sem foto" discreto no canto. É o detalhe de entusiasta que faz um anúncio sem foto parecer intencional.

### Quadros de aviso

- **Aviso de intermediação:** Geada a 60%, 14px de raio, 16px de preenchimento, texto de 0.875rem em Pedra com ícone de informação.
- **Dicas de segurança:** Geada a 60%, 18px de raio, 24px de preenchimento (40px a partir de 640px), escudo em Azul Fiorde no título e marcadores de 6px em Azul Fiorde.
- **Ficha técnica:** grade de 2 ou 3 colunas dentro de um contêiner com Linha Fina e 18px de raio; rótulo em Pedra (0.875rem) e valor em peso 500.

## Do's and Don'ts

### Do:

- **Do** usar o Azul Fiorde só para ação, foco e sinais de confiança; as superfícies ficam neutras.
- **Do** separar superfícies com Linha Fina e painéis em Geada a 60%, não com sombra.
- **Do** dar à ação principal de cada página pública 48px de altura, 14px de raio e texto de 1rem.
- **Do** manter o preço em semibold com espaçamento apertado, como o número mais pesado do card e do anúncio.
- **Do** definir toda cor como token com a versão do tema escuro e conferir o contraste AA nos dois temas.
- **Do** mostrar a placa do modelo quando não houver foto licenciada pelo vendedor.
- **Do** usar o âmbar suave (fundo, borda a 60%, tinta) para os alertas de repasse e ágio.

### Don't:

- **Don't** usar o logotipo da Volvo, o "iron mark" ou qualquer elemento visual oficial da marca.
- **Don't** parecer um portal de classificados: nada de banners, selos piscando ou vários destaques disputando atenção.
- **Don't** usar a linguagem do feirão: vermelho e amarelo, "IMPERDÍVEL", preço gigante, contagem regressiva.
- **Don't** usar gradientes roxos, ilustrações 3D ou brilhos de startup genérica.
- **Don't** dar sombra ou elevação aos cards, nem em repouso nem no hover.
- **Don't** usar o vermelho fora de erros e ações destrutivas, nem o âmbar fora dos alertas ao comprador.
- **Don't** mostrar fotos que não vieram com a licença do vendedor.
