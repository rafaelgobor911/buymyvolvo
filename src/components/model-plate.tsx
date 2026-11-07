import { cn } from "@/lib/utils";

/**
 * Neutral typographic placeholder used instead of photos. Unclaimed listings never
 * show third-party images, and claimed listings without photos look the same.
 * No Volvo logo or official visual elements.
 */
export function ModelPlate({ modelName, className }: { modelName: string; className?: string }) {
  const short = modelName.replace(/ Cross Country$/, "");
  const isCrossCountry = short !== modelName;
  return (
    <div
      aria-hidden
      className={cn(
        "relative flex w-full items-end overflow-hidden bg-gradient-to-br from-secondary to-muted p-5",
        className,
      )}
    >
      <span className="text-5xl font-semibold tracking-tighter text-foreground/10 select-none sm:text-6xl">
        {short}
      </span>
      {isCrossCountry && (
        <span className="absolute top-4 left-5 text-xs font-medium tracking-widest text-foreground/30 uppercase">
          Cross Country
        </span>
      )}
      <span className="absolute right-5 bottom-4 text-xs text-foreground/30">sem foto</span>
    </div>
  );
}
