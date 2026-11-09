import type { Metadata } from "next";

import { LegalDocumentView } from "@/components/legal-document";
import { PRIVACY_POLICY } from "@/content/legal";

export const metadata: Metadata = {
  title: PRIVACY_POLICY.title,
  alternates: { canonical: "/privacidade" },
  // Draft: kept out of search engines until reviewed by a lawyer.
  robots: { index: false },
};

export default function PrivacyPage() {
  return <LegalDocumentView doc={PRIVACY_POLICY} />;
}
