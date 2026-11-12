/**
 * Termos do Anunciante. RASCUNHO para revisão por advogado (regra 8 do
 * CLAUDE.md): valores comerciais ficam "[a definir]" até a decisão do dono do
 * produto. Mudou o texto? Crie uma versão nova: os aceites guardam a versão.
 *
 * Versão de 16/11/2026: modelo intermediado (Fase 8a). O vendedor aceita estes
 * termos na página de autorização (/autorizar/...) ou ao reivindicar o anúncio.
 */
export const SELLER_TERMS_VERSION = "2026-11-19-rascunho";

export const SELLER_TERMS = {
  title: "Termos do Anunciante",
  draftNotice:
    "Rascunho para revisão jurídica. Este texto ainda não foi revisado por advogado e pode mudar.",
  sections: [
    {
      heading: "1. O que é o serviço",
      paragraphs: [
        "O [NOME_DO_SITE] divulga anúncios de Volvo seminovos e usados e intermedeia o contato entre compradores e vendedores: os interessados falam com o [NOME_DO_SITE], que os atende e os apresenta ao vendedor.",
        "O [NOME_DO_SITE] não é dono dos veículos, não recebe o pagamento do carro e não garante o negócio. Preço final, condições, documentação, vistoria e entrega são combinados entre comprador e vendedor.",
      ],
    },
    {
      heading: "2. Autorização do anúncio",
      paragraphs: [
        "Um anúncio só aparece no site depois que o vendedor autoriza a divulgação e a intermediação. Ao autorizar, você declara ser o anunciante ou ter poderes para representá-lo e que as informações do anúncio são verdadeiras.",
        "Para autorizar ou cadastrar um anúncio, você informa o seu CPF (no caso de loja, o CPF do responsável e, se quiser, o CNPJ da loja), usado só para identificar quem anuncia e para o contrato de intermediação.",
        "A autorização não tem exclusividade: você pode continuar anunciando e vendendo o carro por outros meios.",
      ],
    },
    {
      heading: "3. Comissão",
      paragraphs: [
        "A comissão é um valor fixo, pago pelo vendedor, informado na página de autorização antes do aceite. O valor aceito fica registrado junto com a autorização.",
        "A comissão só é devida se o carro for vendido para um comprador apresentado pelo [NOME_DO_SITE], identificado pelo código de referência do contato (por exemplo, VX-7K3P9), inclusive se o negócio for fechado diretamente entre as partes depois da apresentação. Nada é devido se a venda for para alguém que não chegou pelo [NOME_DO_SITE].",
        "Forma e prazo de pagamento: [a definir].",
      ],
    },
    {
      heading: "4. Como o anúncio aparece",
      paragraphs: [
        "O anúncio mostra os dados do carro, um resumo escrito pelo [NOME_DO_SITE] e as fotos do item 5. O nome, o telefone, o perfil e a marca da loja ou do vendedor não aparecem: os interessados falam com o WhatsApp do [NOME_DO_SITE].",
        "Podemos corrigir dados do anúncio para deixá-los coerentes com o que você informou, e recusar ou retirar anúncios com indício de fraude.",
      ],
    },
    {
      heading: "5. Fotos",
      paragraphs: [
        "Você autoriza o [NOME_DO_SITE] a usar as fotos do anúncio que publicou no Instagram, ou que nos enviar, para exibi-las no site enquanto o anúncio estiver no ar. As fotos podem ser recortadas para retirar marcas, contatos e placas. Se houver marca d'água, podemos pedir as fotos originais.",
        "Você declara ter os direitos sobre as fotos. A licença é gratuita, não exclusiva e vale só para a divulgação deste anúncio.",
      ],
    },
    {
      heading: "6. Dados pessoais (LGPD)",
      paragraphs: [
        "Guardamos o seu nome, WhatsApp e e-mail (se informado), e os dados de contato dos compradores interessados, somente para a intermediação: apresentar as partes, acompanhar a negociação e, quando devida, cobrar a comissão. Esses dados não são usados para outra finalidade, não são vendidos e só são compartilhados com a outra parte da negociação.",
        "Pedidos sobre seus dados podem ser feitos pelos canais indicados na Política de Privacidade.",
      ],
    },
    {
      heading: "7. Remoção",
      paragraphs: [
        'Você pode retirar o anúncio a qualquer momento, pelo link "Remover" da página do anúncio ou pelo nosso WhatsApp. A comissão continua devida por vendas a compradores apresentados antes da remoção.',
      ],
    },
    {
      heading: "8. Conta do vendedor",
      paragraphs: [
        "Você pode entrar no site para acompanhar visitas e contatos, editar o anúncio e enviar fotos. A posse de um anúncio é confirmada pela nossa equipe (por exemplo, com um código enviado pelo Instagram que publicou o anúncio); podemos recusar ou desfazer uma reivindicação se a confirmação não for possível ou se houver indício de fraude.",
      ],
    },
    {
      heading: "9. Alterações e foro",
      paragraphs: [
        "Estes termos podem mudar; uma versão nova pede um novo aceite e não altera a comissão de autorizações já dadas. Foro: [a definir].",
      ],
    },
  ],
} as const;
