import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/legal-document";
import { SELLER_TERMS, SELLER_TERMS_VERSION } from "@/content/seller-terms";

export const metadata: Metadata = {
  title: SELLER_TERMS.title,
  alternates: { canonical: "/termos-do-anunciante" },
  // Draft: kept out of search engines until reviewed.
  robots: { index: false },
};

export default function SellerTermsPage() {
  return <LegalDocumentView doc={{ ...SELLER_TERMS, version: SELLER_TERMS_VERSION }} />;
}
