"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import type { FormState } from "@/lib/form-state";
import { requireSellerUser, sellerActor } from "@/lib/sellers/auth";
import { deletePhoto, movePhoto } from "@/lib/photos/data";
import { photoStorage } from "@/lib/photos/storage";
import {
  getSellerByAuthUser,
  markListingSold,
  sellerEditableListing,
  type SoldAnswer,
  updateSellerListing,
} from "@/lib/sellers/data";
import { parseSellerEdit } from "@/lib/sellers/edit-form";

const str = (form: FormData, key: string) => {
  const value = form.get(key);
  return typeof value === "string" ? value : "";
};

export async function markSoldAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireSellerUser("/vendedor");
  const sql = db();
  const seller = await getSellerByAuthUser(sql, user.authUserId);
  if (!seller) return { status: "error", message: "Cadastro de vendedor não encontrado." };
  const result = await markListingSold(sql, {
    sellerId: seller.id,
    listingId: str(form, "id"),
    answer: str(form, "pelo_site") as SoldAnswer,
    leadRef: str(form, "contato") || null,
    actor: sellerActor(seller.id),
  });
  if (!result.ok) return { status: "error", message: result.error };
  // The form disappears once the listing is sold: confirm at the top of the panel.
  redirect("/vendedor?vendido=1");
}

export async function updateSellerListingAction(
  _prev: FormState,
  form: FormData,
): Promise<FormState> {
  const id = str(form, "id");
  const user = await requireSellerUser(`/vendedor/anuncios/${id}`);
  const sql = db();
  const seller = await getSellerByAuthUser(sql, user.authUserId);
  const current =
    seller && (await sellerEditableListing(sql, { sellerId: seller.id, listingId: id }));
  if (!seller || !current) return { status: "error", message: "Anúncio não encontrado." };
  const input = Object.fromEntries([...form.keys()].map((k) => [k, str(form, k)])) as Record<
    string,
    string
  >;
  const parsed = parseSellerEdit(input, { phone: current.phone });
  if (!parsed.ok)
    return { status: "error", message: "Corrija os campos marcados.", errors: parsed.errors };
  const result = await updateSellerListing(sql, {
    sellerId: seller.id,
    listingId: id,
    edit: parsed.edit,
    actor: sellerActor(seller.id),
  });
  if (!result.ok) return { status: "error", message: result.error };
  refresh();
  return { status: "saved", message: result.changed ? "Alterações salvas." : "Nada mudou." };
}

async function photoSeller() {
  const user = await requireSellerUser("/vendedor");
  return getSellerByAuthUser(db(), user.authUserId);
}

export async function deletePhotoAction(form: FormData) {
  const seller = await photoSeller();
  if (!seller) return;
  const storagePath = await deletePhoto(db(), {
    photoId: str(form, "foto"),
    sellerId: seller.id,
    actor: sellerActor(seller.id),
  });
  if (storagePath) {
    await photoStorage()?.remove([`${storagePath}-1600.webp`, `${storagePath}-640.webp`]);
  }
  refresh();
}

export async function movePhotoAction(form: FormData) {
  const seller = await photoSeller();
  if (!seller) return;
  await movePhoto(db(), {
    photoId: str(form, "foto"),
    sellerId: seller.id,
    direction: str(form, "direcao") === "subir" ? "up" : "down",
  });
  refresh();
}
