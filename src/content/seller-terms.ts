/**
 * Termos do Anunciante. RASCUNHO para revisão por advogado (regra 8 do
 * CLAUDE.md): valores comerciais ficam "[a definir]" até a decisão do dono do
 * produto. Mudou o texto? Crie uma versão nova: os aceites guardam a versão.
 */
export const SELLER_TERMS_VERSION = "2026-11-08-rascunho";

export const SELLER_TERMS = {
  title: "Termos do Anunciante",
  draftNotice:
    "Rascunho para revisão jurídica. Este texto ainda não foi revisado por advogado e pode mudar antes do lançamento.",
  sections: [
    {
      heading: "1. O que é o serviço",
      paragraphs: [
        "O [NOME_DO_SITE] reúne anúncios de Volvo publicados no Instagram e cadastrados no site, e encaminha interessados ao anunciante pelo WhatsApp ou pelo Instagram. O site não compra, não vende e não participa da negociação.",
      ],
    },
    {
      heading: "2. Reivindicação do anúncio",
      paragraphs: [
        "Ao reivindicar um anúncio, você declara ser o anunciante ou ter autorização dele, e que as informações do anúncio são verdadeiras.",
        "A posse é confirmada pela nossa equipe (por exemplo, com o código enviado pelo Instagram que publicou o anúncio). Podemos recusar ou desfazer uma reivindicação se a confirmação não for possível ou se houver indício de fraude.",
      ],
    },
    {
      heading: "3. Contatos e código de referência",
      paragraphs: [
        "Cada contato que chega pelo site traz um código de referência (por exemplo, VX-7K3P9). Você verá esses contatos no seu painel, sem dados pessoais de quem clicou.",
        "Ao marcar um anúncio como vendido, você informa se a venda foi para alguém que chegou pelo site. Essa informação é usada para medir resultados e, quando houver plano ou comissão contratada, para o cálculo previsto no item 4.",
      ],
    },
    {
      heading: "4. Planos e comissão",
      paragraphs: [
        "Os planos (Gratuito, Destaque e Loja Pro) e uma eventual comissão sobre vendas feitas a partir do site serão definidos em contrato próprio: [valores, percentual e forma de pagamento a definir]. Nenhuma cobrança é feita sem a sua contratação expressa.",
      ],
    },
    {
      heading: "5. Fotos e conteúdo",
      paragraphs: [
        "Fotos enviadas por você ficam no nosso armazenamento com a licença que você conceder no envio, só para exibição no anúncio. Você declara ter os direitos sobre elas. [Termos da licença de imagens a definir na próxima etapa.]",
      ],
    },
    {
      heading: "6. Remoção e dados pessoais (LGPD)",
      paragraphs: [
        "Você pode remover o anúncio a qualquer momento. Guardamos o mínimo necessário: seu nome de exibição, e-mail da conta e os contatos publicados no anúncio. Pedidos sobre seus dados podem ser feitos pelos canais indicados na Política de Privacidade.",
      ],
    },
    {
      heading: "7. Alterações e foro",
      paragraphs: [
        "Estes termos podem mudar; uma versão nova pede um novo aceite. Foro: [a definir].",
      ],
    },
  ],
} as const;
