import { redirect } from "next/navigation";

/**
 * The parent Timetable used to live here (it was called Classes). Links in
 * notifications already sent still point at it, so it forwards with its
 * query (`child`, `month`, `lesson`).
 */
export default async function ParentClassesRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }
  const qs = params.toString();
  redirect(qs ? `/parent/timetable?${qs}` : "/parent/timetable");
}
