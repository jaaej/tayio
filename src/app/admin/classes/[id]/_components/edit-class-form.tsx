"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/admin/ui";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { updateClass } from "@/app/admin/_lib/actions-classes";
import type { ClassType } from "@/db/schema";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Initial = {
  name: string;
  subjectId: string;
  tutorId: string;
  classType: ClassType;
  capacity: number;
  location: string;
  onlineLink: string;
  isRecurring: boolean;
  weekday: number | null;
  startTime: string;
  endTime: string;
};

export function EditClassForm({
  id,
  initial,
  tutors,
  subjects,
}: {
  id: string;
  initial: Initial;
  tutors: { id: string; firstName: string; lastName: string }[];
  subjects: { id: string; name: string; yearLevel: string | null }[];
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  return (
    <form
      className="grid sm:grid-cols-2 gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setOk(false);
        const fd = new FormData(e.currentTarget);
        start(async () => {
          try {
            const res = await updateClass({
              id,
              name: String(fd.get("name") || ""),
              subjectId: String(fd.get("subjectId") || ""),
              tutorId: String(fd.get("tutorId") || ""),
              classType: fd.get("classType") === "one_on_one" ? "one_on_one" : "group",
              capacity: Number(fd.get("capacity") || 8),
              location: String(fd.get("location") || "") || null,
              onlineLink: String(fd.get("onlineLink") || "") || null,
              isRecurring: fd.get("isRecurring") === "on",
              weekday:
                fd.get("weekday") === "" ? null : Number(fd.get("weekday")),
              startTime: String(fd.get("startTime") || "") || null,
              endTime: String(fd.get("endTime") || "") || null,
            });
            if (res.ok) setOk(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed");
          }
        });
      }}
    >
      <div className="sm:col-span-2 space-y-1.5">
        <Label htmlFor="name">Class name</Label>
        <Input id="name" name="name" defaultValue={initial.name} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="subjectId">Subject</Label>
        <Select
          id="subjectId"
          name="subjectId"
          defaultValue={initial.subjectId}
          required
        >
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.yearLevel ? ` (Yr ${s.yearLevel})` : ""}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="tutorId">Tutor</Label>
        <Select
          id="tutorId"
          name="tutorId"
          defaultValue={initial.tutorId}
          required
        >
          {tutors.map((t) => (
            <option key={t.id} value={t.id}>
              {t.firstName} {t.lastName}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="classType">Class type</Label>
        <Select
          id="classType"
          name="classType"
          defaultValue={initial.classType}
        >
          <option value="group">Group</option>
          <option value="one_on_one">One-on-one</option>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="capacity">Capacity</Label>
        <Input
          id="capacity"
          name="capacity"
          type="number"
          min={1}
          max={200}
          defaultValue={initial.capacity}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="weekday">Weekday</Label>
        <Select
          id="weekday"
          name="weekday"
          defaultValue={initial.weekday === null ? "" : String(initial.weekday)}
        >
          <option value="">-</option>
          {WEEKDAYS.map((d, i) => (
            <option key={d} value={i}>
              {d}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="startTime">Start time</Label>
        <Input
          id="startTime"
          name="startTime"
          type="time"
          defaultValue={initial.startTime}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="endTime">End time</Label>
        <Input
          id="endTime"
          name="endTime"
          type="time"
          defaultValue={initial.endTime}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="location">Location</Label>
        <Input id="location" name="location" defaultValue={initial.location} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="onlineLink">Online link</Label>
        <Input
          id="onlineLink"
          name="onlineLink"
          type="url"
          defaultValue={initial.onlineLink}
        />
      </div>
      <label className="sm:col-span-2 flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          name="isRecurring"
          defaultChecked={initial.isRecurring}
          className="h-4 w-4 accent-brand-600"
        />
        Recurring weekly
      </label>
      <div className="sm:col-span-2 flex items-center gap-3 pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        {ok && <span className="text-xs font-semibold text-good">Saved.</span>}
        {error && <span className="text-xs font-semibold text-bad">{error}</span>}
      </div>
    </form>
  );
}
