import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { Megaphone } from "lucide-react";
import { db } from "@/db/client";
import { announcements, classes, profiles } from "@/db/schema";
import { Card, CardHead, CardBody, Pill, PageHeader, Empty } from "@/components/admin/ui";
import { CreateAnnouncementForm } from "./_components/create-announcement-form";
import { DeleteAnnouncementButton } from "./_components/delete-announcement-button";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  const author = alias(profiles, "author");

  const rows = await db
    .select({
      id: announcements.id,
      title: announcements.title,
      body: announcements.body,
      audienceRole: announcements.audienceRole,
      audienceClassId: announcements.audienceClassId,
      publishedAt: announcements.publishedAt,
      authorFirst: author.firstName,
      authorLast: author.lastName,
      className: classes.name,
    })
    .from(announcements)
    .innerJoin(author, eq(author.id, announcements.authorId))
    .leftJoin(classes, eq(classes.id, announcements.audienceClassId))
    .orderBy(desc(announcements.publishedAt));

  const classOptions = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .orderBy(classes.name);

  return (
    <div className="space-y-6">
      <PageHeader
        className="rise"
        eyebrow="Communications"
        title="Announcements"
      />

      <section className="rise" style={{ animationDelay: "60ms" }}>
        <Card accent="brand">
          <CardHead title="Send announcement" eyebrow="Compose" />
          <CardBody>
            <CreateAnnouncementForm classes={classOptions} />
          </CardBody>
        </Card>
      </section>

      <section className="rise space-y-4" style={{ animationDelay: "120ms" }}>
        {rows.length === 0 ? (
          <Card>
            <Empty>No announcements yet. Write your first above.</Empty>
          </Card>
        ) : (
          rows.map((r) => {
            const audience = r.audienceClassId
              ? `Class · ${r.className}`
              : r.audienceRole
                ? `All ${r.audienceRole}s`
                : "Everyone";
            return (
              <Card key={r.id}>
                <div className="flex items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      <Pill tone="brand" dot>
                        {audience}
                      </Pill>
                      <span className="text-[11px] uppercase tracking-[0.14em] font-bold text-muted-2">
                        {new Date(r.publishedAt).toLocaleString("en-AU", {
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <h3 className="mt-2.5 text-[16px] font-extrabold tracking-[-0.01em] text-ink">
                      {r.title}
                    </h3>
                    <p className="mt-2 text-[13px] text-ink-soft whitespace-pre-wrap">
                      {r.body}
                    </p>
                    <div className="mt-3 flex items-center gap-1.5 text-[12px] text-muted">
                      <Megaphone className="h-3.5 w-3.5" aria-hidden />
                      by {r.authorFirst} {r.authorLast}
                    </div>
                  </div>
                  <DeleteAnnouncementButton id={r.id} title={r.title} />
                </div>
              </Card>
            );
          })
        )}
      </section>
    </div>
  );
}
