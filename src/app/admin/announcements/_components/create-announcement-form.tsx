"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/admin/ui";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createAnnouncement } from "@/app/admin/_lib/actions-announcements";

type Audience = "everyone" | "role:student" | "role:parent" | "role:tutor" | "role:admin" | "class";

export function CreateAnnouncementForm({
  classes,
}: {
  classes: { id: string; name: string }[];
}) {
  const [pending, start] = useTransition();
  const [audience, setAudience] = useState<Audience>("everyone");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        const fd = new FormData(e.currentTarget);
        const form = e.currentTarget;
        const role = audience.startsWith("role:")
          ? (audience.slice(5) as "student" | "parent" | "tutor" | "admin")
          : null;
        const cls = audience === "class" ? classId : null;
        start(async () => {
          try {
            const res = await createAnnouncement({
              title: String(fd.get("title") || ""),
              body: String(fd.get("body") || ""),
              audienceRole: role,
              audienceClassId: cls,
            });
            if (res.ok) {
              setOk(true);
              form.reset();
              setAudience("everyone");
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="title">Title</Label>
        <Input id="title" name="title" required maxLength={200} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="body">Message</Label>
        <Textarea id="body" name="body" required rows={5} />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="audience">Audience</Label>
          <Select
            id="audience"
            value={audience}
            onChange={(e) => setAudience(e.target.value as Audience)}
          >
            <option value="everyone">Everyone</option>
            <option value="role:student">All students</option>
            <option value="role:parent">All parents</option>
            <option value="role:tutor">All tutors</option>
            <option value="role:admin">All admins</option>
            {classes.length > 0 && <option value="class">Specific class</option>}
          </Select>
        </div>
        {audience === "class" && (
          <div className="space-y-1.5">
            <Label htmlFor="classId">Class</Label>
            <Select
              id="classId"
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>
      <div className="flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Publishing…" : "Publish"}
        </Button>
        {ok && <span className="text-xs text-emerald-700">Published.</span>}
        {error && <span className="text-xs text-rose-700">{error}</span>}
      </div>
    </form>
  );
}
