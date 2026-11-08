"use server";

import { redirect } from "next/navigation";

import { db } from "@/lib/db/client";
import type { FormState } from "@/lib/form-state";
import { requireSellerUser, sellerActor } from "@/lib/sellers/auth";
import { getSellerByAuthUser, markListingSold, type SoldAnswer } from "@/lib/sellers/data";

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
