import {
  removeResource,
  restoreResource,
  setResourcePublished,
} from "@/app/_actions/resources";
import { Button } from "@/components/admin/ui";

// Fire-and-forget forms, matching the admin/discussions moderation pattern
// (src/app/admin/discussions/[boardId]/[threadId]/page.tsx): bare
// <form action={serverAction}> with hidden fields, no client-side error UI.
export function ResourceRowActions({
  id,
  status,
}: {
  id: string;
  status: "live" | "unpublished" | "removed";
}) {
  if (status === "removed") {
    return (
      <form
        action={async (formData) => {
          "use server";
          await restoreResource(formData);
        }}
      >
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="outline" size="sm">
          Restore
        </Button>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <form
        action={async (formData) => {
          "use server";
          await setResourcePublished(formData);
        }}
      >
        <input type="hidden" name="id" value={id} />
        <input
          type="hidden"
          name="published"
          value={status === "live" ? "false" : "true"}
        />
        <Button type="submit" variant="outline" size="sm">
          {status === "live" ? "Unpublish" : "Republish"}
        </Button>
      </form>

      <form
        action={async (formData) => {
          "use server";
          await removeResource(formData);
        }}
        className="flex items-center gap-1.5"
      >
        <input type="hidden" name="id" value={id} />
        <input
          name="reason"
          maxLength={500}
          placeholder="Reason (optional)"
          className="w-36 rounded-lg border border-line bg-surface px-2 py-1.5 text-[12px] text-ink placeholder:text-muted focus:outline-none focus:border-line-strong"
        />
        <Button type="submit" variant="danger" size="sm">
          Remove
        </Button>
      </form>
    </div>
  );
}
