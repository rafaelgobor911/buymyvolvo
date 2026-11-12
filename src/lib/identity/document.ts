/**
 * Brazilian identity documents of sellers (Phase 9b): CPF and CNPJ, checked by
 * their verification digits (Receita Federal), so a typo or an invented
 * number is refused. Pure, no Node APIs: the forms check in the browser too.
 *
 * CNPJ accepts the alphanumeric format issued since July 2026 (12 letters or
 * digits + 2 numeric check digits; each character counts as its ASCII code
 * minus 48, so digits keep their value).
 */

const digitsOf = (raw: string) => raw.replace(/\D/g, "");

/** "123.456.789-09" → "12345678909" when valid, else null. */
export function parseCpf(raw: string | null | undefined): string | null {
  const cpf = digitsOf(raw ?? "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return null;
  const check = (length: number) => {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]) ? cpf : null;
}

const CNPJ_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** "12.ABC.345/01DE-35" or "11.222.333/0001-81" → normalized, when valid; else null. */
export function parseCnpj(raw: string | null | undefined): string | null {
  const cnpj = (raw ?? "").toUpperCase().replace(/[.\-/\s]/g, "");
  if (!/^[A-Z0-9]{12}\d{2}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return null;
  const value = (c: string) => c.charCodeAt(0) - 48;
  const check = (length: number) => {
    const weights = CNPJ_WEIGHTS.slice(CNPJ_WEIGHTS.length - length);
    let sum = 0;
    for (let i = 0; i < length; i++) sum += value(cnpj[i]!) * weights[i]!;
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  return check(12) === Number(cnpj[12]) && check(13) === Number(cnpj[13]) ? cnpj : null;
}

export const formatCpf = (cpf: string) =>
  cpf.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");

export const formatCnpj = (cnpj: string) =>
  cnpj.replace(/^(.{2})(.{3})(.{3})(.{4})(\d{2})$/, "$1.$2.$3/$4-$5");
