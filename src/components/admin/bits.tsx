import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { type AdminStatus, STATUS_LABELS } from "@/lib/admin/listings";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<AdminStatus, string> = {
  pending_review: "border-warning/60 bg-warning-soft text-warning-foreground",
  active: "border-primary/40 text-primary",
  sold: "border-border text-muted-foreground",
  expired: "border-border text-muted-foreground",
  removed: "border-destructive/40 text-destructive",
  rejected: "border-destructive/40 text-destructive",
};

export function StatusBadge({ status }: { status: AdminStatus }) {
  return (
    <Badge variant="outline" className={cn(STATUS_STYLE[status])}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function AdminSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}

export function PageTitle({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
    </div>
  );
}

export const formatDateTime = (d: Date) =>
  d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
