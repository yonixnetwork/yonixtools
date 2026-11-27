import type { Vars } from "./format";

/**
 * An error whose message is shown to the user. Library code (src/lib/tools/*) throws it with a
 * translation key instead of English text; the component renders t(err.key, err.vars) from its own
 * namespace. `message` keeps an English hint for logs only.
 */
export class UserError extends Error {
  constructor(
    public key: string,
    public vars?: Vars,
    hint?: string,
  ) {
    super(hint ?? key);
    this.name = "UserError";
  }
}

export const isUserError = (e: unknown): e is UserError => e instanceof UserError;
