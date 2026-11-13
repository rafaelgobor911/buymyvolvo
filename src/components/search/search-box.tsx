import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function SearchBox({
  defaultValue,
  size = "lg",
  autoFocus,
  className,
}: {
  defaultValue?: string;
  size?: "lg" | "md";
  autoFocus?: boolean;
  className?: string;
}) {
  // The compact results header keeps 44px from 640px; phones always get 48px.
  const height = size === "lg" ? "h-12" : "h-12 sm:h-11";
  return (
    <form
      action="/busca"
      method="get"
      role="search"
      className={cn("flex flex-col gap-3 sm:flex-row", className)}
    >
      <label htmlFor="q" className="sr-only">
        Buscar anúncios
      </label>
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          id="q"
          name="q"
          type="search"
          autoComplete="off"
          enterKeyHint="search"
          autoFocus={autoFocus}
          defaultValue={defaultValue}
          placeholder="Ex.: xc60 t8 sp até 250 mil"
          className={cn(height, "rounded-xl pl-11 text-base md:text-base")}
        />
      </div>
      <Button type="submit" className={cn(height, "rounded-xl px-6 text-base")}>
        Buscar
      </Button>
    </form>
  );
}
