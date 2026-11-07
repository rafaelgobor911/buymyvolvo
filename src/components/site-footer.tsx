import { site } from "@/lib/site";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 text-sm text-muted-foreground">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>{site.name} reúne anúncios de terceiros e não participa da negociação.</p>
        <p>{site.brandDisclaimer}</p>
      </div>
    </footer>
  );
}
