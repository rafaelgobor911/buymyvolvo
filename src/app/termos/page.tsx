import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/legal-document";
import { TERMS_OF_USE } from "@/content/legal";

export const metadata: Metadata = {
  title: TERMS_OF_USE.title,
  alternates: { canonical: "/termos" },
  // Draft: kept out of search engines until reviewed by a lawyer.
  robots: { index: false },
};

export default function TermsPage() {
  return <LegalDocumentView doc={TERMS_OF_USE} />;
}
