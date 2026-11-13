import { ImagePlus } from "lucide-react";

import { cn } from "@/lib/utils";

export const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/avif";

/**
 * Photo picker for the seller form and the seller panel: a large, labelled
 * drop area instead of the browser's file button (which shows "Choose Files"
 * in the browser's language). The real input stays focusable for keyboards.
 */
export function PhotoPicker({
  label,
  detail,
  disabled,
  describedBy,
  onFiles,
}: {
  label: string;
  detail: string;
  disabled?: boolean;
  describedBy?: string;
  onFiles: (files: FileList) => void;
}) {
  return (
    <label
      className={cn(
        "flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-input bg-card px-4 py-6 text-center transition-colors hover:border-primary/40 hover:bg-accent has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <ImagePlus className="size-6 text-primary" aria-hidden />
      <span className="text-base font-medium">{label}</span>
      <span className="text-sm text-muted-foreground">{detail}</span>
      <input
        type="file"
        accept={PHOTO_ACCEPT}
        multiple
        disabled={disabled}
        aria-describedby={describedBy}
        className="sr-only"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
