import { redirect } from "next/navigation";

export default async function TutorClassPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/tutor/classes/${id}/curriculum`);
}
