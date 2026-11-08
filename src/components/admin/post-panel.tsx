import { ExternalLink, FileText } from "lucide-react";

import type { AdminListing } from "@/lib/admin/listings";
import { publishable } from "@/lib/admin/listing-form";
import { RED_FLAG_LABELS, type RedFlag } from "@/lib/extraction/schema";

import { formatDateTime } from "./bits";

/** Why a listing is waiting for a moderator, in plain words. */
export function moderationReasons(listing: AdminListing, threshold: number): string[] {
  const reasons = (listing.post?.issues ?? []).map((i) => i.message);
  if (listing.confidence !== null && listing.confidence < threshold) {
    reasons.push(
      `Confiança da extração ${listing.confidence.toFixed(2).replace(".", ",")}, abaixo do limiar ${threshold.toFixed(2).replace(".", ",")}.`,
    );
  }
  if (!publishable(listing)) reasons.push("Faltam o ano-modelo ou o preço e um contato.");
  const flags = listing.redFlags.filter((f) => f !== "sem_contato");
  if (flags.length) {
    reasons.push(
      `O post declara: ${flags.map((f) => RED_FLAG_LABELS[f as RedFlag].toLowerCase()).join("; ")}.`,
    );
  }
  return reasons;
}

/** The source post as collected (caption is internal: only the admin sees it). */
export function PostPanel({ listing }: { listing: AdminListing }) {
  const post = listing.post;
  if (!post) {
    return (
      <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        {listing.origin === "direct"
          ? "Anúncio cadastrado direto no site: não há post de origem."
          : "Sem post de origem (anúncio de exemplo)."}
      </p>
    );
  }
  const source =
    post.sourceType === "ig_hashtag"
      ? `#${post.source}`
      : post.username
        ? `@${post.username}`
        : null;
  return (
    <section
      aria-labelledby="post-original"
      className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="post-original" className="flex items-center gap-2 font-semibold">
          <FileText className="size-4" aria-hidden />
          Post original
        </h2>
        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Abrir no Instagram <ExternalLink className="size-3.5" aria-hidden />
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        {[source, post.postedAt && formatDateTime(post.postedAt)].filter(Boolean).join(" · ")}
      </p>
      <p className="max-h-96 overflow-y-auto text-sm whitespace-pre-wrap">
        {post.caption ?? "(post sem legenda)"}
      </p>
    </section>
  );
}
