import { LogIn, Store } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { LoginLinkForm } from "@/components/login-link-form";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabaseConfigured } from "@/lib/admin/supabase";
import { LOGIN_LINK_ERRORS, type LoginLinkError } from "@/lib/auth/login-link";
import { safeNext } from "@/lib/sellers/access";
import { currentSellerUser, enabledSellerTestLogin } from "@/lib/sellers/auth";

import {
  requestSellerLoginLink,
  signInSellerForTest,
  signInSellerWithGoogle,
} from "../auth-actions";

export const metadata: Metadata = { title: "Entrar como vendedor", robots: { index: false } };

const ERRORS: Record<string, string> = {
  google: "Não foi possível entrar com o Google. Tente de novo.",
  "google-indisponivel": "O login com Google ainda não está disponível. Tente mais tarde.",
  sessao: "Não foi possível entrar: o link expirou ou já foi usado. Peça outro.",
  ...Object.fromEntries(
    Object.entries(LOGIN_LINK_ERRORS).map(([k, v]) => [`link-${k as LoginLinkError}`, v]),
  ),
};

export default function SellerLoginPage(props: PageProps<"/vendedor/entrar">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
      <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
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
  const params = await searchParams;
  const next = safeNext(params.next);
  if (await currentSellerUser()) redirect(next);
  const error = typeof params.erro === "string" ? ERRORS[params.erro] : undefined;
  const google = supabaseConfigured();
  const testEmail = enabledSellerTestLogin();

  return (
    <>
      <div className="flex flex-col gap-2">
        <Store className="size-8 text-primary" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">Área do vendedor</h1>
        <p className="text-muted-foreground">
          Entre para reivindicar seus anúncios e ver os contatos que chegam pelo site.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <form action={signInSellerWithGoogle} className="flex flex-col gap-2">
        <input type="hidden" name="next" value={next} />
        <Button type="submit" disabled={!google} className="h-11 rounded-xl text-base">
          <LogIn aria-hidden />
          Entrar com Google
        </Button>
        {!google && (
          <p className="text-xs text-muted-foreground">
            O login com Google ainda está sendo configurado.
          </p>
        )}
      </form>
      <p className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden>
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </p>
      <LoginLinkForm
        action={requestSellerLoginLink}
        next={next}
        sent={params.link === "enviado"}
        available={google}
      />
      {testEmail && (
        <form
          action={signInSellerForTest}
          className="flex flex-col gap-2 rounded-xl border border-dashed border-warning/60 p-4"
        >
          <input type="hidden" name="next" value={next} />
          <p className="text-sm text-muted-foreground">
            Ambiente de teste: entrar sem Google como{" "}
            <strong className="font-medium">{testEmail}</strong>.
          </p>
          <Button type="submit" variant="outline" className="h-10 self-start rounded-xl px-4">
            Entrar como vendedor de teste
          </Button>
        </form>
      )}
    </>
  );
}
