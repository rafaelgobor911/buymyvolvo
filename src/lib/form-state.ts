/** What a form action returns to the page (errors per field, warnings, a message). */
export interface FormState {
  status: "idle" | "saved" | "error";
  message?: string;
  errors?: Record<string, string>;
  warnings?: string[];
}

export const IDLE: FormState = { status: "idle" };
