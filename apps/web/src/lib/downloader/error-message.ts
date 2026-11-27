import type { Translator } from "@/i18n/translator";

/**
 * Downloader errors are shown from the "errors" catalogue BY CODE, in the visitor's language,
 * never from the server's English text:
 *   1. an explicit client key (err.key, e.g. "client.timeout") when the client produced the error,
 *   2. "platform.<platform>.<code>" when the backend has more precise wording for that platform,
 *   3. "code.<code>",
 *   4. "code.server_error".
 */
export interface ErrorLike {
  code?: string;
  platform?: string;
  key?: string;
}

type Has = Pick<Translator, "has">;

export function errorMessageKey(t: Has, err: ErrorLike | null | undefined): string {
  if (err?.key && t.has(err.key)) return err.key;
  if (err?.code) {
    if (err.platform && t.has(`platform.${err.platform}.${err.code}`)) return `platform.${err.platform}.${err.code}`;
    if (t.has(`code.${err.code}`)) return `code.${err.code}`;
  }
  return "code.server_error";
}

/** The message for a downloader error, translated with a translator for the "errors" namespace. */
export const errorMessage = (t: Translator, err: ErrorLike | null | undefined): string => t(errorMessageKey(t, err));
