import { site } from "@/lib/site";

/**
 * "Como funciona": the conditions the seller accepts, in plain words (invite
 * page and public form). The full text is in the Termos do Anunciante.
 */
export function IntermediationTerms({
  commission,
  photos,
}: {
  /** "R$ 1.500" */
  commission: string;
  /** Where the photos come from: the seller's post (invite) or this form. */
  photos: "post" | "upload";
}) {
  return (
    <ul className="flex list-disc flex-col gap-2 pl-5 text-pretty">
      <li>
        <strong>Comissão fixa de {commission}</strong>, paga por você só se vender o carro para um
        comprador apresentado pelo {site.name}. Vendeu para outra pessoa? Não paga nada.
      </li>
      <li>
        <strong>Sem exclusividade:</strong> continue anunciando e vendendo por onde quiser.
      </li>
      <li>
        O anúncio aparece sem o seu nome, telefone ou marca. Os interessados falam com o {site.name}
        , que os apresenta a você com um código de referência (por exemplo, VX-7K3P9).
      </li>
      {photos === "post" ? (
        <li>
          Usamos as fotos do seu post, recortadas para tirar marcas, contatos e placas. Se tiverem
          marca d&apos;água, podemos pedir as originais.
        </li>
      ) : (
        <li>
          Usamos as fotos que você enviar aqui; podemos recortá-las para tirar marcas, contatos e
          placas.
        </li>
      )}
      <li>Seus dados e os dos compradores servem só para esta negociação, nada além disso.</li>
      <li>Você pode tirar o anúncio do ar quando quiser.</li>
    </ul>
  );
}
