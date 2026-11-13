import type { NamePart } from "@/lib/taxonomy/explain";
import { cn } from "@/lib/utils";

/**
 * "Entenda o nome": the listing title split into model, engine and trim, each
 * explained in plain words (from the taxonomy). Same shape as the numbered
 * steps of the home: a hairline opens each item, the code leads.
 */
export function NameParts({ parts }: { parts: NamePart[] }) {
  if (!parts.length) return null;
  return (
    <section aria-labelledby="entenda-o-nome" className="flex flex-col gap-4">
      <h2 id="entenda-o-nome" className="text-xl font-semibold tracking-tight">
        Entenda o nome
      </h2>
      <dl
        className={cn(
          "grid gap-x-6 gap-y-5",
          parts.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {parts.map((part) => (
          <div key={part.role} className="flex flex-col gap-1 border-t border-border pt-4">
            <dt className="text-2xl font-semibold tracking-tight text-balance">{part.code}</dt>
            <dd className="flex flex-col gap-1">
              <span className="text-sm font-medium">{part.role}</span>
              <span className="text-pretty text-muted-foreground">{part.text}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
