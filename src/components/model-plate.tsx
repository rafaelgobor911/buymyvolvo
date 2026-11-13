import { plateText } from "@/lib/listings/plate";
import { cn } from "@/lib/utils";

/**
 * Typographic plate used instead of photos: the model name, large and tinted
 * Fjord blue (at least 3:1 on the ice surface, like any large text), with a
 * spec line from the taxonomy. Unclaimed listings never show third-party
 * images, and claimed listings without photos look the same. No Volvo logo or
 * official visual elements.
 */
export function ModelPlate({
  modelId,
  modelName,
  yearModel,
  className,
}: {
  modelId: string;
  modelName: string;
  yearModel: number | null;
  className?: string;
}) {
  const { name, details } = plateText(modelId, modelName, yearModel);
  return (
    <div
      aria-hidden
      className={cn(
        "@container relative flex w-full flex-col justify-end gap-2 overflow-hidden bg-accent p-5 select-none",
        className,
      )}
    >
      <span className="text-[length:min(22cqi,6rem)] leading-[0.85] font-semibold tracking-[-0.04em] text-primary/70 dark:text-primary/60">
        {name}
      </span>
      {details && <span className="text-sm font-medium text-accent-foreground">{details}</span>}
      <span className="absolute top-4 right-5 text-xs text-muted-foreground">sem foto</span>
    </div>
  );
}
