"use client";

import { Trash2 } from "lucide-react";
import { startTransition, useActionState } from "react";

import { adminDeletePhotoAction } from "@/app/admin/(painel)/actions";
import { IDLE } from "@/lib/admin/form-state";

export function PhotoDeleteButton({ photoId, label }: { photoId: string; label: string }) {
  const [state, formAction, pending] = useActionState(adminDeletePhotoAction, IDLE);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!window.confirm("Excluir esta foto? Não dá para desfazer.")) return;
        const data = new FormData(event.currentTarget);
        startTransition(() => formAction(data));
      }}
    >
      <input type="hidden" name="foto" value={photoId} />
      <button
        type="submit"
        disabled={pending}
        aria-label={label}
        title={state.status === "error" ? state.message : label}
        className="absolute top-1 right-1 rounded-full bg-background/90 p-1.5 text-destructive shadow hover:bg-background disabled:opacity-50"
      >
        <Trash2 className="size-3.5" aria-hidden />
      </button>
    </form>
  );
}
