"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { Plus } from "lucide-react";
import { SidePanel } from "@/components/ui/side-panel";
import { Button } from "@/components/student/button";
import { addResource } from "@/app/_actions/resources";
import { ResourceForm, type ResourceFormSubject } from "./resource-form";

/** Only one add panel exists per page, so a literal id is enough to wire the
 *  footer submit button back to the form via the `form` attribute. */
const FORM_ID = "add-resource-form";

/** Opens the panel, optionally preselecting a subject. */
const OpenContext = createContext<((subjectId?: string) => void) | null>(null);

function useOpenAddResource() {
  const open = useContext(OpenContext);
  if (!open) {
    throw new Error("Add-resource triggers must render inside AddResourceProvider");
  }
  return open;
}

/**
 * Owns the single add-resource slide-over for the page. Wraps the page body so
 * both the header action and each subject section's "Add to <Subject>" control
 * open the same panel - one form, one implementation, rather than an inline
 * form repeated under every subject.
 */
export function AddResourceProvider({
  subjects,
  children,
}: {
  subjects: ResourceFormSubject[];
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [subjectId, setSubjectId] = useState(subjects[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Remounts the form to clear it - cheaper and less error-prone than
  // threading a reset down through every field.
  const [formKey, setFormKey] = useState(0);

  const openFor = useCallback(
    (preselect?: string) => {
      setError(null);
      setFormKey((k) => k + 1);
      if (preselect) setSubjectId(preselect);
      setOpen(true);
    },
    [],
  );

  function submit(formData: FormData) {
    setError(null);
    start(async () => {
      try {
        const res = await addResource(formData);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setOpen(false);
      } catch {
        setError("Could not add this resource. Check the fields and try again.");
      }
    });
  }

  const footer = (
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
        variant="primary"
        disabled={pending}
      >
        {pending ? "Adding…" : "Add resource"}
      </Button>
    </>
  );

  const value = useMemo(() => openFor, [openFor]);

  return (
    <OpenContext.Provider value={value}>
      {children}

      <SidePanel
        open={open}
        onClose={() => setOpen(false)}
        title="Add resource"
        footer={footer}
      >
        <ResourceForm
          key={formKey}
          formId={FORM_ID}
          subjects={subjects}
          subjectId={subjectId}
          onSubjectChange={setSubjectId}
          disabled={pending}
          error={error}
          onSubmit={submit}
        />
      </SidePanel>
    </OpenContext.Provider>
  );
}

/** Page-header action. */
export function AddResourceButton() {
  const open = useOpenAddResource();
  return (
    <Button type="button" variant="primary" onClick={() => open()}>
      <Plus className="h-4 w-4" aria-hidden />
      Add resource
    </Button>
  );
}

/** Subject-section action - opens the same panel with that subject chosen. */
export function AddToSubjectButton({
  subjectId,
  subjectName,
}: {
  subjectId: string;
  subjectName: string;
}) {
  const open = useOpenAddResource();
  return (
    <Button
      type="button"
      variant="link"
      // Sits on the page wash, not on a card: the variant's --brand-600 drops
      // to 2.8:1 against the dark end of the gradient, --brand-ink holds 5.9:1.
      className="px-1.5 text-brand-ink hover:text-ink"
      onClick={() => open(subjectId)}
    >
      <Plus className="h-3.5 w-3.5" aria-hidden />
      Add to {subjectName}
    </Button>
  );
}
