"use client";

import { CHOICE_BOX, CHOICE_ROW } from "@/components/public-fields";
import { cn } from "@/lib/utils";

export type SellerTypeValue = "" | "particular" | "loja";

/**
 * "Você é: Particular | Loja" as two large tiles (44px tall, whole tile
 * clickable). Controlled, so the form can show the CNPJ only for shops.
 */
export function SellerTypeChoice({
  idPrefix,
  value,
  onChange,
  error,
  order = ["particular", "loja"],
}: {
  idPrefix: string;
  value: SellerTypeValue;
  onChange: (value: "particular" | "loja") => void;
  error?: string;
  order?: Array<"particular" | "loja">;
}) {
  const labels = { particular: "Particular", loja: "Loja" } as const;
  return (
    <fieldset
      className="flex flex-col gap-2"
      aria-describedby={error ? `${idPrefix}-tipo-erro` : undefined}
    >
      <legend className="mb-1 text-sm font-medium">Você é</legend>
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        {order.map((type) => (
          <label
            key={type}
            className={cn(
              CHOICE_ROW,
              "rounded-xl border border-input bg-card px-4 text-base font-medium transition-colors hover:border-primary/40 has-[:checked]:border-primary has-[:checked]:bg-accent has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 sm:text-sm dark:bg-input/30",
            )}
          >
            <input
              type="radio"
              name="tipo"
              value={type}
              required
              checked={value === type}
              onChange={() => onChange(type)}
              className={CHOICE_BOX}
            />
            {labels[type]}
          </label>
        ))}
      </div>
      {error && (
        <p id={`${idPrefix}-tipo-erro`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      )}
    </fieldset>
  );
}
