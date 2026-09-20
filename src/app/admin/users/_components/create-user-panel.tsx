"use client";

import { useState, useTransition } from "react";
import { Check, Copy, MailCheck, Plus, TriangleAlert } from "lucide-react";
import { Button, SidePanel } from "@/components/admin/ui";
import { createUser } from "@/app/admin/_lib/actions-users";
import { CreateUserForm, type CreateUserValues } from "./create-user-form";
import { roleLabel } from "@/lib/roles";

/** Only one create panel exists per page, so a literal id is enough to wire
 *  the footer submit button back to the form via the `form` attribute. */
const FORM_ID = "create-user-form";

type CreatedAccount = {
  label: string;
  name: string;
  email: string;
  tempPassword?: string;
  passwordSetupEmail: { sent: true } | { sent: false; error: string };
};

type Created = {
  primary: CreatedAccount;
  linkedParent?: CreatedAccount;
};

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
        primary: {
          label: roleLabel(values.role),
          name: `${values.firstName} ${values.lastName}`,
          email: values.email,
          tempPassword: res.tempPassword,
          passwordSetupEmail: res.passwordSetupEmail,
        },
        linkedParent: values.linkedParent
          ? {
              label: "Parent",
              name: `${values.linkedParent.firstName} ${values.linkedParent.lastName}`,
              email: values.linkedParent.email,
              tempPassword: res.linkedParent?.tempPassword,
              passwordSetupEmail: res.linkedParent?.passwordSetupEmail ?? {
                sent: false,
                error: "Email delivery status was unavailable.",
              },
            }
          : undefined,
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
        size="wide"
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
  const hasParent = Boolean(created.linkedParent);

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-good-bg text-good">
            <Check className="h-4 w-4" aria-hidden />
          </span>
          <h3 className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">
            {hasParent ? "Accounts created and linked" : "Account created"}
          </h3>
        </div>
        {hasParent && (
          <p className="mt-2 text-[13px] text-ink-soft">
            The parent is linked as this student&apos;s primary contact.
          </p>
        )}
      </div>

      <CreatedAccountCard account={created.primary} />
      {created.linkedParent && (
        <CreatedAccountCard account={created.linkedParent} />
      )}
    </div>
  );
}

function CreatedAccountCard({ account }: { account: CreatedAccount }) {
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
    <div className="rounded-[12px] border border-line bg-surface-2 p-4">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
        {account.label}
      </p>
      <p className="mt-1 text-[13px] font-bold text-ink">{account.name}</p>
      <p className="text-[12px] text-ink-soft">{account.email}</p>

      {account.passwordSetupEmail.sent ? (
        <div className="mt-3 flex items-start gap-2 rounded-[9px] border border-good/20 bg-good-bg px-3 py-2.5 text-[12px] text-good">
          <MailCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Password-setup email sent. The link lets this user choose their own
            password securely.
          </p>
        </div>
      ) : (
        <div className="mt-3 flex items-start gap-2 rounded-[9px] border border-bad/20 bg-bad-bg px-3 py-2.5 text-[12px] text-bad">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            Account created, but the setup email could not be sent: {" "}
            {account.passwordSetupEmail.error}. Use the temporary password
            below or retry Reset from this user&apos;s gear menu.
          </p>
        </div>
      )}

      {account.tempPassword && (
        <div className="mt-4 border-t border-line pt-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Temporary password
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 truncate rounded-[8px] border border-line bg-surface px-3 py-2.5 font-mono text-[13px] text-ink">
              {account.tempPassword}
            </code>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => copyPassword(account.tempPassword as string)}
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
            Give this to {account.name} - it will not be shown again.
          </p>
        </div>
      )}
    </div>
  );
}
