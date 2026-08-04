"use client";

import { useMemo, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/admin/ui";
import {
  createFamilyLink,
  removeFamilyLink,
  setPrimaryContact,
} from "@/app/admin/_lib/actions-users";

type Person = { id: string; name: string; email: string };
type LinkedPerson = Person & { isPrimaryContact: boolean };

export function FamilyLinksManager({
  viewer,
  userId,
  existing,
  options,
}: {
  viewer: "parent" | "student";
  userId: string;
  existing: LinkedPerson[];
  options: Person[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const existingIds = useMemo(() => new Set(existing.map((p) => p.id)), [existing]);
  const available = useMemo(
    () => options.filter((p) => !existingIds.has(p.id)),
    [options, existingIds],
  );
  const [picked, setPicked] = useState(available[0]?.id ?? "");

  return (
    <div className="space-y-4">
      {existing.length === 0 && (
        <div className="text-[13px] text-muted">No links yet.</div>
      )}

      <ul className="divide-y divide-line">
        {existing.map((p) => {
          const parentId = viewer === "parent" ? userId : p.id;
          const studentId = viewer === "parent" ? p.id : userId;
          return (
            <li
              key={p.id}
              className="py-2.5 flex items-center justify-between gap-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-ink truncate">
                    {p.name}
                  </span>
                  {p.isPrimaryContact && (
                    <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-brand-700">
                      Primary
                    </span>
                  )}
                </div>
                <div className="text-[12px] text-muted truncate">{p.email}</div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  size="sm"
                  variant={p.isPrimaryContact ? "brand" : "outline"}
                  disabled={pending}
                  onClick={() => {
                    setError(null);
                    start(async () => {
                      await setPrimaryContact(
                        parentId,
                        studentId,
                        !p.isPrimaryContact,
                      );
                    });
                  }}
                >
                  {p.isPrimaryContact ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden />
                      Primary
                    </>
                  ) : (
                    "Make primary"
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Remove link to ${p.name}?`)) return;
                    start(async () => {
                      setError(null);
                      await removeFamilyLink(parentId, studentId);
                    });
                  }}
                >
                  Remove
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      {available.length > 0 ? (
        <form
          className="flex items-end gap-3 pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!picked) return;
            setError(null);
            start(async () => {
              const args =
                viewer === "parent"
                  ? { parentId: userId, studentId: picked }
                  : { parentId: picked, studentId: userId };
              const res = await createFamilyLink({
                parentId: args.parentId,
                studentId: args.studentId,
                relationship: "parent",
              });
              if (!res.ok) setError(res.error);
            });
          }}
        >
          <div className="flex-1 space-y-1.5">
            <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted">
              Add {viewer === "parent" ? "child" : "parent"}
            </div>
            <Select
              value={picked}
              onChange={(e) => setPicked(e.target.value)}
            >
              {available.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.email}
                </option>
              ))}
            </Select>
          </div>
          <Button type="submit" variant="brand" disabled={pending || !picked}>
            Link
          </Button>
        </form>
      ) : (
        <div className="text-[12px] text-muted">
          No more {viewer === "parent" ? "students" : "parents"} to link.
        </div>
      )}

      {error && <div className="text-[12px] font-semibold text-bad">{error}</div>}
    </div>
  );
}
