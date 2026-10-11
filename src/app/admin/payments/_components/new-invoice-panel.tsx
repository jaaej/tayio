"use client";

import { useId, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, SidePanel, buttonVariants } from "@/components/admin/ui";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { createInvoice } from "@/app/admin/_lib/actions-invoices";

export function NewInvoicePanel({
  parents,
  students,
}: {
  parents: { id: string; name: string; email: string }[];
  students: { id: string; name: string; parentIds: string[] }[];
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [parentId, setParentId] = useState("");
  const formId = useId();
  const eligibleStudents = students.filter((student) =>
    student.parentIds.includes(parentId),
  );

  function close() {
    if (pending) return;
    setError(null);
    setParentId("");
    setOpen(false);
  }

  return (
    <>
      <Button type="button" size="lg" onClick={() => setOpen(true)}>
        <Plus className="h-[15px] w-[15px]" strokeWidth={2.4} aria-hidden />
        New invoice
      </Button>
      <SidePanel
        open={open}
        onClose={close}
        title="New invoice"
        size="wide"
        footer={
          parents.length > 0 ? (
            <>
              <Button type="button" size="lg" variant="ghost" disabled={pending} onClick={close}>
                Cancel
              </Button>
              <Button type="submit" form={formId} size="lg" disabled={pending}>
                {pending ? "Creating…" : "Create invoice"}
              </Button>
            </>
          ) : undefined
        }
      >
        {parents.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-ink-soft">
              Invoices are billed to a parent account. Create one first.
            </p>
            <Link
              href="/admin/users?new=1"
              className={buttonVariants({ variant: "outline", size: "md" })}
            >
              Add user
            </Link>
          </div>
        ) : (
          <form
            id={formId}
            className="space-y-5"
            onSubmit={(event) => {
              event.preventDefault();
              setError(null);
              const data = new FormData(event.currentTarget);
              start(async () => {
                try {
                  const result = await createInvoice({
                    parentId: String(data.get("parentId") ?? ""),
                    studentId: String(data.get("studentId") ?? "") || null,
                    amount: Number(data.get("amount") ?? 0),
                    currency: String(data.get("currency") ?? "AUD"),
                    dueDate: String(data.get("dueDate") ?? ""),
                    description: String(data.get("description") ?? "") || undefined,
                  });
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  setParentId("");
                  setOpen(false);
                } catch (caught) {
                  setError(
                    caught instanceof Error ? caught.message : "Invoice could not be created.",
                  );
                }
              });
            }}
          >
            <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
              <Field label="Bill parent" htmlFor={`${formId}-parent`}>
                <Select
                  id={`${formId}-parent`}
                  name="parentId"
                  required
                  value={parentId}
                  onChange={(event) => setParentId(event.target.value)}
                >
                  <option value="" disabled>
                    Pick a parent
                  </option>
                  {parents.map((parent) => (
                    <option key={parent.id} value={parent.id}>
                      {parent.name} · {parent.email}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="For student" htmlFor={`${formId}-student`}>
                <Select
                  key={parentId}
                  id={`${formId}-student`}
                  name="studentId"
                  defaultValue=""
                  disabled={!parentId}
                >
                  <option value="">No linked student</option>
                  {eligibleStudents.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Amount" htmlFor={`${formId}-amount`}>
                <Input
                  id={`${formId}-amount`}
                  name="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                />
              </Field>
              <Field label="Currency" htmlFor={`${formId}-currency`}>
                <Input
                  id={`${formId}-currency`}
                  name="currency"
                  defaultValue="AUD"
                  minLength={3}
                  maxLength={3}
                  required
                />
              </Field>
              <Field label="Due date" htmlFor={`${formId}-due-date`}>
                <Input id={`${formId}-due-date`} name="dueDate" type="date" required />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Description" htmlFor={`${formId}-description`}>
                  <Input
                    id={`${formId}-description`}
                    name="description"
                    maxLength={1000}
                    placeholder="Term 2 · 10 lessons"
                  />
                </Field>
              </div>
            </fieldset>
            {error ? (
              <p
                role="alert"
                className="rounded-[10px] bg-bad-bg px-3 py-2 text-[12px] font-semibold text-bad"
              >
                {error}
              </p>
            ) : null}
          </form>
        )}
      </SidePanel>
    </>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="block font-bold">
        {label}
      </Label>
      {children}
    </div>
  );
}
