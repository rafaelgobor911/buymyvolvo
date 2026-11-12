/**
 * Termos de Uso e Política de Privacidade. RASCUNHOS para revisão por
 * advogado (regra 8 do CLAUDE.md): controlador, encarregado, prazos e foro
 * ficam "[a definir]". O texto descreve o que o sistema faz hoje; mudou o
 * tratamento de dados, mude aqui também (e a versão).
 *
 * "[NOME_DO_SITE]" vira o nome configurado do site na hora de exibir.
 */
export interface LegalDocument {
  title: string;
  version: string;
  draftNotice: string;
  sections: ReadonlyArray<{ heading: string; paragraphs: readonly string[] }>;
}

const DRAFT_NOTICE =
  "Rascunho para revisão jurídica. Este texto ainda não foi revisado por advogado e pode mudar antes do lançamento.";

export const TERMS_OF_USE: LegalDocument = {
  title: "Termos de Uso",
  version: "2026-11-16-rascunho",
  draftNotice: DRAFT_NOTICE,
  sections: [
    {
      heading: "1. O que é o [NOME_DO_SITE]",
      paragraphs: [
        "O [NOME_DO_SITE] divulga anúncios de Volvo seminovos e usados no Brasil e intermedeia o contato entre compradores e vendedores (lojas e particulares). Os anúncios vêm de posts do Instagram (lidos somente pela API oficial da Meta) ou de cadastro, e só aparecem no site depois que o vendedor autoriza a divulgação e a intermediação.",
        "O [NOME_DO_SITE] não é dono dos veículos e não recebe pagamento pelo carro: a compra é feita diretamente com o vendedor. A comissão do [NOME_DO_SITE] é paga pelo vendedor; para o comprador, o serviço é gratuito.",
      ],
    },
    {
      heading: "2. Informações dos anúncios",
      paragraphs: [
        "Os dados de cada anúncio (modelo, versão, ano, quilometragem, preço, cidade) vêm do anúncio do vendedor. Organizamos esses dados e escrevemos um resumo, que pode conter erros. Confirme as informações com a nossa equipe antes de fechar negócio.",
        "Um anúncio pode já ter sido vendido ou alterado sem que o site saiba. Os preços mostrados são os pedidos pelos anunciantes, não uma avaliação do carro nem uma tabela de referência.",
      ],
    },
    {
      heading: "3. Contato e intermediação",
      paragraphs: [
        "O botão de contato abre o WhatsApp do [NOME_DO_SITE] com uma mensagem pronta e um código de referência. Você pode editar a mensagem antes de enviar. Nossa equipe tira dúvidas, confirma a disponibilidade e apresenta você ao vendedor.",
        "Para fazer essa ponte, guardamos os dados que você nos passar na conversa, somente para esta negociação (veja a Política de Privacidade).",
      ],
    },
    {
      heading: "4. Cuidados na compra",
      paragraphs: [
        "Nunca pague sinal ou qualquer valor antes de ver o carro e conferir a documentação. Desconfie de preços muito abaixo do mercado, faça vistoria cautelar e uma avaliação mecânica independente, e confirme que quem vende é o dono do veículo ou está autorizado por ele.",
        "O [NOME_DO_SITE] nunca pede pagamento pelo carro: o pagamento é feito ao vendedor.",
      ],
    },
    {
      heading: "5. Uso permitido",
      paragraphs: [
        "Não é permitido copiar o conteúdo do site de forma automatizada, usar o site para enviar mensagens em massa, publicar informações falsas ou pedir a remoção de anúncios que não são seus.",
      ],
    },
    {
      heading: "6. Marcas e conteúdo de terceiros",
      paragraphs: [
        "Volvo e os nomes dos modelos são marcas da Volvo Car Corporation, usadas aqui apenas para descrever os veículos anunciados. O [NOME_DO_SITE] não é afiliado à Volvo Car Corporation nem à rede de concessionárias.",
        "Fotos e textos dos anúncios pertencem aos vendedores e são exibidos com a autorização deles.",
      ],
    },
    {
      heading: "7. Este anúncio é seu?",
      paragraphs: [
        "Toda página de anúncio tem as opções Remover e Reivindicar. A remoção tira o anúncio do ar na hora e é confirmada pela nossa equipe em até 48 horas. A reivindicação permite editar o anúncio, enviar fotos e acompanhar os contatos, conforme os Termos do Anunciante.",
      ],
    },
    {
      heading: "8. Responsabilidade",
      paragraphs: ["[Cláusulas de limitação de responsabilidade a definir com o advogado.]"],
    },
    {
      heading: "9. Alterações, contato e foro",
      paragraphs: [
        "Estes termos podem mudar; a data da versão fica no topo da página. Contato: [e-mail a definir]. Foro: [a definir].",
      ],
    },
  ],
};

export const PRIVACY_POLICY: LegalDocument = {
  title: "Política de Privacidade",
  version: "2026-11-19-rascunho",
  draftNotice: DRAFT_NOTICE,
  sections: [
    {
      heading: "1. Quem trata os dados",
      paragraphs: [
        "Controlador: [razão social e CNPJ a definir]. Encarregado pelo tratamento de dados pessoais (DPO): [nome e e-mail a definir]. Pedidos sobre os seus dados podem ser feitos por esse contato.",
      ],
    },
    {
      heading: "2. Visitantes e compradores",
      paragraphs: [
        "Você não precisa de conta para buscar ou entrar em contato. Quando você clica no botão de contato de um anúncio, registramos o anúncio, a data, o número do [NOME_DO_SITE] que recebeu o contato, a página de origem e os parâmetros de campanha do link (UTM), com um código de referência. Nesse clique não guardamos seu nome, telefone nem o endereço IP: guardamos apenas uma assinatura irreversível (hash com chave secreta) do IP e do navegador, usada para não contar o mesmo clique duas vezes e para evitar abuso.",
        "Na conversa pelo WhatsApp, você fala com a equipe do [NOME_DO_SITE]. Os dados que você nos passar ali (por exemplo, nome e telefone) são usados somente para intermediar esta compra: apresentar você ao vendedor e acompanhar o resultado da negociação. Não usamos esses dados para outra finalidade e não os vendemos. Base legal: [a validar com o advogado].",
        "As visitas às páginas de anúncio são contadas apenas como um total por dia, sem nenhum dado de quem visitou.",
      ],
    },
    {
      heading: "3. Anunciantes",
      paragraphs: [
        "De anúncios publicados no Instagram, guardamos o @ da conta, o telefone e a cidade que o próprio anúncio publicou, os dados do carro e o link para o post. A legenda é lida por um serviço de inteligência artificial (Anthropic) para organizar esses dados e escrever um resumo. Usamos o contato publicado para pedir a autorização do vendedor; sem ela, o anúncio não é publicado. Base legal: [legítimo interesse, a validar com o advogado].",
        "Anúncios que o vendedor nos manda ou que a nossa equipe copia à mão de outro site para pedir a autorização dele: guardamos o texto, o contato e o link do anúncio, só para a moderação e o convite. O texto também é lido pelo serviço de inteligência artificial e nunca é publicado.",
        'Quem cadastra o anúncio no formulário "Anuncie seu Volvo" informa os dados do carro, a cidade, nome, tipo (loja ou particular), WhatsApp, CPF (e o CNPJ, se for loja) e, se quiser, e-mail, e pode enviar fotos (gravadas sem metadados, como a localização). Para limitar abusos, guardamos uma assinatura irreversível (hash com chave secreta) do IP de quem enviou.',
        "Quem autoriza a divulgação informa nome, tipo (loja ou particular), WhatsApp, CPF (e o CNPJ, se for loja) e, se quiser, e-mail. O CPF e o CNPJ servem só para identificar quem anuncia e para o contrato de intermediação, e nunca aparecem no site. Guardamos esses dados, a versão e a data do aceite dos Termos do Anunciante, a comissão aceita e a licença das fotos, somente para a intermediação e para a cobrança da comissão quando devida.",
        "O nome, o telefone e o perfil do vendedor não aparecem no site: os compradores falam com o [NOME_DO_SITE].",
        "Quem pede a remoção de um anúncio pode informar um contato (opcional). Para impedir que o mesmo anúncio volte a ser importado, guardamos o telefone, o @ e os posts do anúncio removido numa lista de bloqueio.",
        "Quem entra na área do vendedor fornece e-mail e nome (pelo login com Google), o nome de exibição, o tipo (loja ou particular) e, se quiser, um telefone. Guardamos também a versão e a data do aceite dos Termos do Anunciante e da licença das fotos. Fotos enviadas são gravadas sem metadados (como localização GPS e dados da câmera).",
      ],
    },
    {
      heading: "4. Cookies e tecnologias parecidas",
      paragraphs: [
        "Essenciais (sempre ativos): o cookie de sessão de quem entra na área do vendedor ou do administrador, a sua escolha sobre cookies e a preferência de tema claro ou escuro (guardada no próprio navegador).",
        "Medição (só com o seu consentimento): Google Analytics, para entender como o site é usado (páginas vistas e cliques de contato, sem dados do comprador).",
        "Publicidade (só com o seu consentimento): cookies do Google usados para medir campanhas e, se ativadas, personalizar anúncios.",
        "Você pode mudar a sua escolha a qualquer momento em “Preferências de cookies”, no rodapé do site.",
      ],
    },
    {
      heading: "5. Com quem compartilhamos",
      paragraphs: [
        "Na intermediação: o vendedor recebe os dados do comprador interessado (e vice-versa) quando for preciso para apresentar as partes e seguir a negociação.",
        "Prestadores que operam o site por nós: Vercel (hospedagem), Supabase (banco de dados, login e armazenamento de fotos), Anthropic (organização dos textos dos anúncios), Meta (origem dos anúncios do Instagram e WhatsApp) e Google (login com Google e, com consentimento, Google Analytics). Alguns desses serviços processam dados fora do Brasil. [Transferência internacional e salvaguardas a validar com o advogado.]",
        "Não vendemos dados pessoais.",
      ],
    },
    {
      heading: "6. Por quanto tempo",
      paragraphs: [
        "Anúncios: enquanto estiverem no site ou até o pedido de remoção. Lista de bloqueio: enquanto for necessária para cumprir o pedido de remoção. Dados da negociação (comprador e vendedor), registros de contato e de auditoria: [prazo a definir]. Conta do vendedor: até o pedido de exclusão.",
      ],
    },
    {
      heading: "7. Seus direitos",
      paragraphs: [
        "Pela LGPD (art. 18), você pode pedir confirmação do tratamento, acesso, correção, anonimização, bloqueio ou eliminação de dados desnecessários, portabilidade, informação sobre compartilhamento e revogação do consentimento. Para anúncios, o caminho mais rápido é o link “Remover” na página do anúncio. Para os demais pedidos: [e-mail a definir].",
      ],
    },
    {
      heading: "8. Segurança e alterações",
      paragraphs: [
        "O acesso aos dados é restrito por regras no próprio banco (cada consulta pública só enxerga as colunas públicas), e as ações da equipe ficam registradas. Esta política pode mudar; a data da versão fica no topo da página.",
      ],
    },
  ],
};
