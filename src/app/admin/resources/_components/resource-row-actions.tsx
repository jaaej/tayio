import { ChevronDown } from "lucide-react";
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
  title,
  status,
}: {
  id: string;
  title: string;
  status: "live" | "unpublished" | "removed";
}) {
  if (status === "removed") {
    return (
      <form
        className="flex justify-end"
        action={async (formData) => {
          "use server";
          await restoreResource(formData);
        }}
      >
        <input type="hidden" name="id" value={id} />
        <Button type="submit" variant="outline" size="sm" className="h-8 px-3">
          Restore
        </Button>
      </form>
    );
  }

  return (
    <div className="flex items-start justify-end gap-1.5">
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
        <Button type="submit" variant="outline" size="sm" className="h-8 px-3">
          {status === "live" ? "Unpublish" : "Republish"}
        </Button>
      </form>

      {/* Removing hides the resource from every role, so it asks for an
          optional reason before it runs instead of firing on one click. */}
      <details className="group">
        <summary
          aria-label={`Remove ${title}`}
          className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-[9px] border border-[#F2C6C2] bg-surface px-3 text-[12px] font-bold text-bad transition-colors hover:bg-[#FEF3F2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 [&::-webkit-details-marker]:hidden"
        >
          Remove
          <ChevronDown
            className="h-3.5 w-3.5 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <form
          action={async (formData) => {
            "use server";
            await removeResource(formData);
          }}
          className="mt-2 flex w-[240px] flex-col gap-2 rounded-[12px] bg-surface-2 p-2.5"
        >
          <input type="hidden" name="id" value={id} />
          <label className="flex flex-col gap-1 text-[12px] font-bold text-ink">
            Reason (optional)
            <input
              name="reason"
              maxLength={500}
              className="h-9 rounded-[9px] border border-line-field bg-surface px-2.5 text-[12px] font-medium text-ink focus:border-ink focus:outline-none focus:ring-[3px] focus:ring-ink/10"
            />
          </label>
          <Button type="submit" variant="danger" size="sm" className="h-8">
            Remove resource
          </Button>
        </form>
      </details>
    </div>
  );
}
