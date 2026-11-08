import { CircleAlert, CircleCheck, TriangleAlert } from "lucide-react";

import type { FormState } from "@/lib/admin/form-state";
import { cn } from "@/lib/utils";

export interface Option {
  value: string;
  label: string;
}

export function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p id={`${id}-erro`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

/** Message, warnings and errors returned by a form action. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" && !state.warnings?.length) return null;
  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      {state.message && (
        <p
          role={state.status === "error" ? "alert" : "status"}
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
            state.status === "error"
              ? "bg-destructive/10 text-destructive"
              : "bg-secondary text-foreground",
          )}
        >
          {state.status === "error" ? (
            <CircleAlert className="size-4 shrink-0" aria-hidden />
          ) : (
            <CircleCheck className="size-4 shrink-0 text-primary" aria-hidden />
          )}
          {state.message}
        </p>
      )}
      {state.warnings?.map((w) => (
        <p
          key={w}
          className="flex items-center gap-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-foreground"
        >
          <TriangleAlert className="size-4 shrink-0" aria-hidden />
          {w}
        </p>
      ))}
    </div>
  );
}

export const textareaClass =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-2 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive md:text-sm dark:bg-input/30";
