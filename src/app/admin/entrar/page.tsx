import { LogIn, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AdminSkeleton } from "@/components/admin/bits";
import { Button } from "@/components/ui/button";
import { currentAdmin, enabledTestLogin } from "@/lib/admin/auth";
import { supabaseConfigured, supabaseServer } from "@/lib/admin/supabase";

import { signInForTest, signInWithGoogle, signOut } from "../auth-actions";

export const metadata: Metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  google: "Não foi possível entrar com o Google. Tente de novo.",
  "google-indisponivel": "O login com Google ainda não está configurado.",
};

export default function LoginPage(props: PageProps<"/admin/entrar">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <Suspense fallback={<AdminSkeleton />}>
        <LoginView searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function LoginView({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if (await currentAdmin()) redirect("/admin");
  const { erro } = await searchParams;
  const error = typeof erro === "string" ? ERRORS[erro] : undefined;
  const google = supabaseConfigured();
  const testEmail = enabledTestLogin();

  // Signed in with Google, but not on the ADMIN_EMAILS list.
  let deniedEmail: string | null = null;
  if (google) {
    const { data } = await (await supabaseServer()).auth.getUser();
    deniedEmail = data.user?.email ?? null;
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <ShieldCheck className="size-8 text-primary" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">Entrar no admin</h1>
        <p className="text-muted-foreground">
          Acesso restrito à equipe, com a conta Google autorizada.
        </p>
      </div>

      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {deniedEmail ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border p-4">
          <p className="text-sm">
            A conta <strong className="font-medium">{deniedEmail}</strong> não tem acesso ao admin.
          </p>
          <form action={signOut}>
            <Button type="submit" variant="outline" className="h-10 rounded-xl px-4">
              Sair e usar outra conta
            </Button>
          </form>
        </div>
      ) : (
        <form action={signInWithGoogle} className="flex flex-col gap-2">
          <Button type="submit" disabled={!google} className="h-11 rounded-xl text-base">
            <LogIn aria-hidden />
            Entrar com Google
          </Button>
          {!google && (
            <p className="text-xs text-muted-foreground">
              O login com Google é ativado quando o projeto do Supabase for configurado
              (NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY).
            </p>
          )}
        </form>
      )}

      {testEmail && (
        <form
          action={signInForTest}
          className="flex flex-col gap-2 rounded-xl border border-dashed border-warning/60 p-4"
        >
          <p className="text-sm text-muted-foreground">
            Ambiente de teste: entrar sem Google como{" "}
            <strong className="font-medium">{testEmail}</strong>.
          </p>
          <Button type="submit" variant="outline" className="h-10 self-start rounded-xl px-4">
            Entrar como admin de teste
          </Button>
        </form>
      )}
    </>
  );
}
