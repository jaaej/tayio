import Link from "next/link";
import { Building2 } from "lucide-react";
import { Card } from "@/components/student/card";

type TutorContact = {
  id: string;
  firstName: string;
  lastName: string;
  subjects: string[];
};

type AdminContact = {
  id: string;
  firstName: string;
  lastName: string;
} | null;

/**
 * Student-facing contacts list: the student's tutors plus the admin office
 * (when provided). Each row opens a DM via the /student/messages/with route.
 * Rendered on both the dashboard (entry point) and the messages inbox.
 */
export function StudentContacts({
  tutors,
  admin = null,
  className,
}: {
  tutors: TutorContact[];
  admin?: AdminContact;
  className?: string;
}) {
  const hasAny = tutors.length > 0 || !!admin;

  return (
    <Card className={className}>
      <div className="px-4 pt-3.5 pb-2">
        <h3 className="m-0 text-[13px] font-extrabold uppercase tracking-[0.14em] text-muted">
          Messages
        </h3>
      </div>
      {!hasAny ? (
        <div className="px-4 pb-4 text-[13px] text-muted">
          No one to message yet.
        </div>
      ) : (
        <div className="divide-y divide-line">
          {tutors.map((t) => (
            <ContactRow
              key={t.id}
              name={`${t.firstName} ${t.lastName}`.trim()}
              meta={t.subjects.join(" · ")}
              userId={t.id}
            />
          ))}
          {admin && (
            <ContactRow
              key={admin.id}
              icon
              name="Admin office"
              meta="Billing, enrolment & general questions"
              userId={admin.id}
            />
          )}
        </div>
      )}
    </Card>
  );
}

function ContactRow({
  name,
  meta,
  userId,
  icon = false,
}: {
  name: string;
  meta?: string;
  userId: string;
  icon?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-100 text-[12px] font-extrabold text-brand-ink">
        {icon ? (
          <Building2 className="h-[18px] w-[18px]" />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-bold text-ink truncate">{name}</div>
        {meta && <div className="text-[12px] text-muted truncate">{meta}</div>}
      </div>
      <Link
        href={`/student/messages/with/${userId}`}
        className="shrink-0 rounded-lg bg-brand-50 px-3 py-1.5 text-[12px] font-bold text-brand-700 hover:bg-brand-100 transition-colors"
      >
        Message
      </Link>
    </div>
  );
}
