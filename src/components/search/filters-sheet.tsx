"use client";

import { SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

/** Bottom sheet with the filter form on small screens. */
export function FiltersSheet({
  activeCount,
  children,
}: {
  activeCount: number;
  children: React.ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button variant="outline" className="h-10 rounded-lg lg:hidden">
            <SlidersHorizontal aria-hidden />
            Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
          </Button>
        }
      />
      <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-4 pb-8">
        <SheetHeader className="px-0">
          <SheetTitle>Filtros</SheetTitle>
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
