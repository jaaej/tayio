// Supabase Storage bucket for student homework submissions and tutor-provided
// worksheets. Bucket must exist; suggested config: private, authenticated read,
// students can write to a path prefixed by their auth uid (enforced by RLS).
export const HOMEWORK_BUCKET = "homework-submissions";
