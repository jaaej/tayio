/**
 * How long Supabase Auth bans a deactivated account. Supabase has no
 * "forever", so this is 100 years; it used to be one year, after which a
 * deactivated account could sign in again. Reactivating lifts it ("none").
 * The sign-in action also refuses an inactive profile, in case a ban is
 * ever missing.
 */
export const DEACTIVATED_BAN_DURATION = "876000h";
