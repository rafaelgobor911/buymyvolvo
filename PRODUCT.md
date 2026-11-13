# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Comprador em geral (público principal):** quem procura um Volvo seminovo ou usado no Brasil, muitas vezes sem conhecer as gerações, os motores (T5, T8, B5…) e as versões (Momentum, Inscription, R-Design…). Quer encontrar o carro certo, comparar com calma e falar com alguém de confiança antes de negociar. A ambição é que esse comprador vire **entusiasta** da marca e, quem sabe, participe da comunidade Made by Sweden.
- **Vendedor (lojas e particulares):** quer divulgar o carro para quem procura Volvo. Autoriza a divulgação pelo convite ou cadastra em "Anuncie seu Volvo", informa CPF (de loja, o do responsável) e aceita a comissão fixa, paga só se vender para um comprador apresentado pelo site.
- **Equipe do Buy My Volvo (dois sócios):** modera os anúncios, convida e confirma vendedores, atende os compradores pelo WhatsApp e faz a ponte com o vendedor.

## Product Purpose

Buscador e intermediador de Volvo seminovos e usados no Brasil. Reúne anúncios de lojas e particulares (Instagram pela API oficial, texto colado pela equipe e cadastro direto), só publica com a autorização do vendedor e conecta o comprador à equipe do Buy My Volvo, que apresenta as partes. Sucesso é o comprador achar o Volvo certo com segurança e o vendedor fechar negócio com alguém que chegou pelo site.

## Positioning

- **Só Volvo:** a busca entende modelos, motores, versões e o que foi vendido oficialmente no Brasil; cada página traz o que conferir naquele modelo.
- **Curadoria e autorização:** nenhum anúncio vai ao ar sem revisão e sem a autorização do vendedor; não há anúncio copiado nem abandonado.
- **Intermediação humana:** o comprador fala com a equipe do Buy My Volvo, não com um formulário; a equipe faz a ponte com o vendedor.
- **Comunidade:** ligação com a comunidade Made by Sweden e com quem gosta de Volvo.

## Operating Context

- O comprador chega pela busca do Google, pelas páginas de modelo (`/volvo/<modelo>`) ou pelo Instagram, quase sempre no celular. Busca em texto livre ("xc60 t8 sp até 250 mil"), filtra e abre o anúncio.
- O contato é um clique no botão do anúncio, que abre o WhatsApp do Buy My Volvo com a mensagem pronta e o código do contato (VX-XXXXX).
- O vendedor recebe o convite pelo WhatsApp ou pelo Direct, ou chega por "Anuncie seu Volvo".
- A equipe trabalha no admin (moderação por etapas, configurações, fontes, leads), no computador.

## Capabilities and Constraints

- Next.js 16 + Tailwind v4 + shadcn/ui (Base UI), tema claro e escuro; dados no Postgres (Supabase). Interface toda em português do Brasil.
- **Compliance (inegociável):** nada de scraping; página pública sem nome, telefone, @ ou post do vendedor; legenda original nunca publicada (só dados estruturados e um resumo com palavras próprias ou a descrição do vendedor); fotos só com licença do vendedor; LGPD (CPF/CNPJ nunca no site; o clique de contato não coleta dado do comprador).
- **Transparência obrigatória em todo anúncio:** "Anúncio intermediado pelo Buy My Volvo…", o aviso de que o site não recebe pagamento pelo carro e o bloco de dicas de segurança. "Este anúncio é seu? Remover | Reivindicar" em toda página de anúncio.
- **Sem dados de mercado inventados:** nada de FIPE ou preço médio sem fonte; as páginas de modelo mostram só a faixa dos preços pedidos nos anúncios do site.
- Muitos anúncios ainda não têm fotos (mostram a placa com o nome do modelo); as fotos vêm do vendedor.
- **Em aberto:** valor da comissão e forma de pagamento; textos jurídicos em rascunho até a revisão do advogado.

## Brand Commitments

- **Nome:** Buy My Volvo, em buymyvolvo.com.br, com links para a comunidade Made by Sweden (madebysweden.com.br).
- **Marca Volvo só descritiva:** sem logotipo, sem "iron mark" e sem elementos visuais oficiais da Volvo. O rodapé sempre diz "Não afiliado à Volvo Car Corporation."
- **Identidade nórdica (decisão do dono do produto, 13/11/2026):** refinar, não recriar; manter a identidade nórdica atual, deixando-a mais marcada e mais presente.
- **Voz:** de entusiasta, para passar confiança, mas sem dificultar. Explica os termos e as nomenclaturas Volvo (gerações, motores, versões) para quem não conhece, sem jargão de concessionária.

## Evidence on Hand

- Anúncios reais vindos de lojas no Instagram (em produção) e o cadastro direto; o ambiente local usa só anúncios fictícios (`scripts/db/fixtures.ts`, telefones com DDD 20).
- Checklists por modelo e textos das páginas de modelo em `src/content/` (alguns marcados para revisão).
- **Não existem:** depoimentos, números de vendas, avaliações de clientes, parcerias oficiais ou imprensa. Não inventar nenhum deles.

## Product Principles

1. **Confiança antes de volume:** cada anúncio é revisado e autorizado; vale mais um anúncio certo do que muitos duvidosos.
2. **Especialista que explica:** fala a língua de quem ama Volvo e traduz para quem está chegando agora.
3. **Gente por trás:** o contato é com a equipe, que apresenta comprador e vendedor; o site deixa isso claro.
4. **Transparência sem letra miúda:** quem paga a comissão, o que o site faz e o que não faz ficam à vista.
5. **Comprador hoje, entusiasta amanhã:** cada página ajuda a entender a marca e convida para a comunidade.

## Accessibility & Inclusion

- WCAG 2.1 AA, verificado com axe nos testes e2e (`tests/e2e/a11y.spec.ts`), nos temas claro e escuro.
- A maioria das visitas é pelo celular: tudo precisa funcionar bem em telas pequenas e com toque.
