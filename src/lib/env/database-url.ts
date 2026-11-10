/**
 * Explains, in plain words, what is wrong with a pasted DATABASE_URL, without
 * ever echoing it (it carries the database password). Pure; used by the env
 * schema, the production build check and the database CLI (migrations).
 */
export function databaseUrlProblem(raw: string): string | null {
  const url = raw.trim();
  if (/^["']|["']$/.test(url)) return "remova as aspas do começo e do fim do valor.";
  if (/^[A-Z][A-Z0-9_]*=/.test(url)) {
    return 'cole só o valor, sem o nome da variável (por exemplo, sem "DATABASE_URL=") na frente.';
  }
  if (/^psql\s/.test(url)) {
    return 'esse é o comando do psql; copie a connection string no formato URI (começa com "postgresql://").';
  }
  if (!/^postgres(ql)?:\/\//.test(url)) {
    return 'o valor precisa começar com "postgresql://" (connection string do Supabase, formato URI).';
  }
  if (url.includes("[YOUR-PASSWORD]")) {
    return "troque [YOUR-PASSWORD], incluindo os colchetes, pela senha do banco.";
  }
  if (/\s/.test(url)) return "há espaços ou quebras de linha no meio do valor.";
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "a senha parece ter caracteres especiais (como #, / ou ?). Troque a senha do banco por uma só com letras e números.";
  }
  if (!parsed.hostname) return "falta o endereço do banco. Copie a connection string completa.";
  return null;
}
