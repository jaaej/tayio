"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Plus } from "lucide-react";
import { Button, SidePanel } from "@/components/admin/ui";
import { createUser } from "@/app/admin/_lib/actions-users";
import { CreateUserForm, type CreateUserValues } from "./create-user-form";

/** Only one create panel exists per page, so a literal id is enough to wire
 *  the footer submit button back to the form via the `form` attribute. */
const FORM_ID = "create-user-form";

type Created = { name: string; email: string; tempPassword?: string };

export function CreateUserPanel({
  canManagePrivilegedRoles,
}: {
  canManagePrivilegedRoles: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  // Remounts the form to clear it - cheaper and less error-prone than
  // threading a reset down through every field.
  const [formKey, setFormKey] = useState(0);

  function blank() {
    setError(null);
    setCreated(null);
    setFormKey((k) => k + 1);
  }

  function submit(values: CreateUserValues) {
    setError(null);
    start(async () => {
      const res = await createUser(values);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCreated({
        name: `${values.firstName} ${values.lastName}`,
        email: values.email,
        tempPassword: res.tempPassword,
      });
    });
  }

  const footer = created ? (
    <>
      <Button type="button" size="lg" variant="outline" onClick={blank}>
        Create another
      </Button>
      <Button
        type="button"
        size="lg"
        variant="brand"
        onClick={() => setOpen(false)}
      >
        Done
      </Button>
    </>
  ) : (
    <>
      <Button
        type="button"
        size="lg"
        variant="ghost"
        disabled={pending}
        onClick={() => setOpen(false)}
      >
        Cancel
      </Button>
      <Button
        type="submit"
        form={FORM_ID}
        size="lg"
        variant="brand"
        disabled={pending}
      >
        {pending ? "Creating…" : "Create user"}
      </Button>
    </>
  );

  return (
    <>
      {/* Default `md` height, matching every other admin PageHeader action.
          The panel's own buttons stay `lg`: it goes full-width on mobile, so
          those are real thumb targets in a way a desktop header action is not. */}
      <Button
        type="button"
        variant="brand"
        onClick={() => {
          blank();
          setOpen(true);
        }}
      >
        <Plus className="h-4 w-4" aria-hidden />
        Create a New User
      </Button>

      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="New user"
        footer={footer}
      >
        {created ? (
          <CreatedSummary created={created} />
        ) : (
          <CreateUserForm
            key={formKey}
            formId={FORM_ID}
            canManagePrivilegedRoles={canManagePrivilegedRoles}
            disabled={pending}
            error={error}
            onSubmit={submit}
          />
        )}
      </SidePanel>
    </>
  );
}

function CreatedSummary({ created }: { created: Created }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");

  async function copyPassword(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setCopy("copied");
    } catch {
      setCopy("failed");
    }
    setTimeout(() => setCopy("idle"), 2000);
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-good-bg text-good">
            <Check className="h-4 w-4" aria-hidden />
          </span>
          <h3 className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
            Account created
          </h3>
        </div>
        <p className="mt-2 text-[13px] text-ink-soft">
          {created.name} · {created.email}
        </p>
      </div>

      {created.tempPassword && (
        <div className="rounded-[10px] border border-line bg-surface-2 p-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Temporary password
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[8px] border border-line bg-surface px-3 py-2.5 font-mono text-[13px] text-ink">
              {created.tempPassword}
            </code>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => copyPassword(created.tempPassword as string)}
            >
              {copy === "copied" ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copy === "copied"
                ? "Copied"
                : copy === "failed"
                  ? "Copy failed"
                  : "Copy"}
            </Button>
          </div>
          <p className="mt-2 text-[12px] text-ink-soft">
            Give this to {created.name} - it will not be shown again.
          </p>
        </div>
      )}
    </div>
  );
}
