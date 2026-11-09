import { ArrowDown, ArrowLeft, ArrowUp, ExternalLink, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PhotoUploader } from "@/components/seller/photo-uploader";
import { SellerEditForm } from "@/components/seller/seller-edit-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PHOTO_LICENSE_TEXT, PHOTO_LICENSE_VERSION } from "@/content/photo-license";
import { db } from "@/lib/db/client";
import { listPhotos } from "@/lib/photos/data";
import { PHOTOS_PER_LISTING } from "@/lib/photos/process";
import { photoStorage } from "@/lib/photos/storage";
import { UFS } from "@/lib/search/places";
import { requireSellerUser } from "@/lib/sellers/auth";
import { getSellerByAuthUser, hasAcceptedTerms, sellerEditableListing } from "@/lib/sellers/data";
import { site } from "@/lib/site";
import { FUEL_LABELS, FUELS, TRANSMISSION_LABELS, TRANSMISSIONS } from "@/lib/taxonomy";

import { deletePhotoAction, movePhotoAction } from "../../actions";

export const metadata: Metadata = { title: "Editar anúncio", robots: { index: false } };

export default function SellerListingPage(props: PageProps<"/vendedor/anuncios/[id]">) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <Suspense fallback={<Skeleton className="h-96 rounded-xl" />}>
        <EditView params={props.params} />
      </Suspense>
    </div>
  );
}

async function EditView({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireSellerUser(`/vendedor/anuncios/${id}`);
  const sql = db();
  const seller = await getSellerByAuthUser(sql, user.authUserId);
  const listing =
    seller && (await sellerEditableListing(sql, { sellerId: seller.id, listingId: id }));
  if (!seller || !listing) notFound();
  const [photos, licenseAccepted] = await Promise.all([
    listPhotos(sql, id),
    hasAcceptedTerms(sql, {
      sellerId: seller.id,
      terms: "photo_license",
      version: PHOTO_LICENSE_VERSION,
    }),
  ]);
  const storage = photoStorage();

  return (
    <>
      <Link
        href="/vendedor"
        className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Painel
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Volvo {listing.title}</h1>
        <Badge variant="outline">
          {listing.status === "active"
            ? "No ar"
            : listing.status === "sold"
              ? "Vendido"
              : "Fora do ar"}
        </Badge>
        <a
          href={`/anuncio/${listing.slug}`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Ver anúncio <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>

      <section aria-labelledby="fotos" className="flex flex-col gap-3">
        <h2 id="fotos" className="text-lg font-semibold">
          Fotos ({photos.length} de {PHOTOS_PER_LISTING})
        </h2>
        {photos.length > 0 && storage && (
          <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {photos.map((photo, i) => (
              <li
                key={photo.id}
                className="flex flex-col gap-2 rounded-xl border border-border p-2"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- already resized WebP from our storage */}
                <img
                  src={storage.url(`${photo.storagePath}-640.webp`)}
                  alt={`Foto ${i + 1}`}
                  width={photo.width ?? undefined}
                  height={photo.height ?? undefined}
                  className="aspect-[4/3] w-full rounded-lg object-cover"
                />
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-muted-foreground">
                    {i === 0 ? "Capa" : `Foto ${i + 1}`}
                  </span>
                  <div className="flex gap-1">
                    {(["subir", "descer"] as const).map((direcao) => (
                      <form key={direcao} action={movePhotoAction}>
                        <input type="hidden" name="foto" value={photo.id} />
                        <input type="hidden" name="direcao" value={direcao} />
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          disabled={direcao === "subir" ? i === 0 : i === photos.length - 1}
                          aria-label={
                            direcao === "subir"
                              ? `Mover foto ${i + 1} para antes`
                              : `Mover foto ${i + 1} para depois`
                          }
                        >
                          {direcao === "subir" ? (
                            <ArrowUp aria-hidden />
                          ) : (
                            <ArrowDown aria-hidden />
                          )}
                        </Button>
                      </form>
                    ))}
                    <form action={deletePhotoAction}>
                      <input type="hidden" name="foto" value={photo.id} />
                      <Button
                        type="submit"
                        variant="ghost"
                        size="icon"
                        aria-label={`Apagar foto ${i + 1}`}
                      >
                        <Trash2 aria-hidden />
                      </Button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
        {storage ? (
          <PhotoUploader
            listingId={listing.id}
            remaining={PHOTOS_PER_LISTING - photos.length}
            licenseAccepted={licenseAccepted}
            licenseText={PHOTO_LICENSE_TEXT.replaceAll("[NOME_DO_SITE]", site.name)}
          />
        ) : (
          <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
            O envio de fotos ainda não está disponível.
          </p>
        )}
      </section>

      <section aria-labelledby="dados" className="flex flex-col gap-3">
        <h2 id="dados" className="text-lg font-semibold">
          Dados do anúncio
        </h2>
        <p className="text-sm text-muted-foreground">
          Modelo, motor, versão e ano são conferidos pela nossa equipe. Se algum estiver errado,
          mande uma mensagem para @{site.instagramHandle}.
        </p>
        <SellerEditForm
          id={listing.id}
          values={{
            priceCents: listing.priceCents,
            km: listing.km,
            color: listing.color,
            transmission: listing.transmission,
            fuel: listing.fuel,
            city: listing.city,
            uf: listing.uf,
            phone: listing.phone,
            igUsername: listing.igUsername,
            description: listing.description,
            options: listing.options,
          }}
          options={{
            transmissions: TRANSMISSIONS.map((t) => ({ value: t, label: TRANSMISSION_LABELS[t] })),
            fuels: FUELS.map((f) => ({ value: f, label: FUEL_LABELS[f] })),
            ufs: Object.entries(UFS).map(([value, name]) => ({
              value,
              label: `${value} · ${name}`,
            })),
          }}
        />
      </section>
    </>
  );
}
