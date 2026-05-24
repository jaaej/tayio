"use client";

import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  createFamilyLink,
  removeFamilyLink,
} from "@/app/admin/_lib/actions-users";

type Person = { id: string; name: string; email: string };

export function FamilyLinksManager({
  viewer,
  userId,
  existing,
  options,
}: {
  viewer: "parent" | "student";
  userId: string;
  existing: Person[];
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
        <div className="text-sm text-muted">No links yet.</div>
      )}

      <ul className="divide-y divide-hairline/60">
        {existing.map((p) => (
          <li
            key={p.id}
            className="py-2 flex items-center justify-between gap-4"
          >
            <div>
              <div className="text-sm text-ink">{p.name}</div>
              <div className="text-xs text-muted">{p.email}</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Remove link to ${p.name}?`)) return;
                start(async () => {
                  setError(null);
                  const args =
                    viewer === "parent"
                      ? { parentId: userId, studentId: p.id }
                      : { parentId: p.id, studentId: userId };
                  await removeFamilyLink(args.parentId, args.studentId);
                });
              }}
            >
              Remove
            </Button>
          </li>
        ))}
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
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted">
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
          <Button type="submit" disabled={pending || !picked}>
            Link
          </Button>
        </form>
      ) : (
        <div className="text-xs text-muted">
          No more {viewer === "parent" ? "students" : "parents"} to link.
        </div>
      )}

      {error && <div className="text-xs text-rose-700">{error}</div>}
    </div>
  );
}
