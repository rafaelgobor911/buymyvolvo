"use client";

import { useState } from "react";

import { Field } from "@/components/admin/form-bits";
import { Input } from "@/components/ui/input";
import { parseCnpj, parseCpf } from "@/lib/identity/document";

/**
 * CPF or CNPJ field that checks the verification digits as soon as the person
 * leaves it (the server checks again). An error from the server wins.
 */
export function DocumentInput({
  id,
  name,
  kind,
  label,
  hint,
  required,
  serverError,
}: {
  id: string;
  name: string;
  kind: "cpf" | "cnpj";
  label: string;
  hint?: string;
  required?: boolean;
  serverError?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const message = serverError ?? error ?? undefined;
  return (
    <Field id={id} label={label} hint={hint} error={message}>
      <Input
        id={id}
        name={name}
        inputMode={kind === "cpf" ? "numeric" : "text"}
        autoComplete="off"
        placeholder={kind === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
        maxLength={kind === "cpf" ? 14 : 18}
        required={required}
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? `${id}-erro` : undefined}
        onBlur={(e) => {
          const value = e.target.value.trim();
          if (!value) return setError(null);
          const valid = kind === "cpf" ? parseCpf(value) : parseCnpj(value);
          setError(
            valid
              ? null
              : kind === "cpf"
                ? "CPF inválido: confira os números."
                : "CNPJ inválido: confira os números e letras.",
          );
        }}
      />
    </Field>
  );
}
