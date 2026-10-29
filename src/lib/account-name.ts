type AccountUser = {
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null;
};

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * The first name greetings and the shell chip show. Admin-created accounts
 * carry the name in app_metadata only (actions-users.ts keeps it in sync with
 * the profile), so that comes first; user_metadata covers accounts made
 * before that, and the email prefix is the last resort before `fallback`.
 */
export function accountFirstName(user: AccountUser, fallback: string): string {
  return (
    nonEmpty(user.app_metadata?.first_name) ??
    nonEmpty(user.user_metadata?.first_name) ??
    nonEmpty(user.email?.split("@")[0]) ??
    fallback
  );
}
