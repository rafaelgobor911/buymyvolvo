import { LogOut } from "lucide-react";
import { Suspense } from "react";

import { AdminNav, AdminNavFallback } from "@/components/admin/admin-nav";
import { Button } from "@/components/ui/button";
import { currentAdmin } from "@/lib/admin/auth";

import { signOut } from "../auth-actions";

/**
 * Chrome of the signed-in admin. The session is read inside Suspense
 * boundaries (never at the top of the layout), and every page checks it again
 * with requireAdmin().
 */
export default function PanelLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">
            Admin
          </span>
          <Suspense fallback={<AdminNavFallback />}>
            <AdminNav />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <SignedInAs />
        </Suspense>
      </div>
      {children}
    </div>
  );
}

async function SignedInAs() {
  const admin = await currentAdmin();
  if (!admin) return null;
  return (
    <form action={signOut} className="flex items-center gap-2 text-sm text-muted-foreground">
      <span className="truncate">
        {admin.email}
        {admin.via === "test" && " (teste)"}
      </span>
      <Button type="submit" variant="ghost" size="sm" className="rounded-lg">
        <LogOut aria-hidden />
        Sair
      </Button>
    </form>
  );
}
