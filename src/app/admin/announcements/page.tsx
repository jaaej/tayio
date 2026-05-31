import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import { announcements, classes, profiles } from "@/db/schema";
import { Card, CardLabel } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    <div className="space-y-10">
      <header className="rise">
        <h1 className="text-4xl lg:text-5xl font-medium tracking-tight text-ink uppercase">
          Announcements
        </h1>
      </header>

      <section className="rise" style={{ animationDelay: "60ms" }}>
        <Card>
          <CardLabel>Send announcement</CardLabel>
          <div className="mt-4">
            <CreateAnnouncementForm classes={classOptions} />
          </div>
        </Card>
      </section>

      <section className="rise space-y-3" style={{ animationDelay: "120ms" }}>
        {rows.length === 0 && (
          <Card>
            <div className="text-sm text-muted">
              No announcements yet. Write your first above.
            </div>
          </Card>
        )}
        {rows.map((r) => {
          const audience = r.audienceClassId
            ? `Class · ${r.className}`
            : r.audienceRole
              ? `All ${r.audienceRole}s`
              : "Everyone";
          return (
            <Card key={r.id}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <Badge tone="brand">{audience}</Badge>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-muted">
                      {new Date(r.publishedAt).toLocaleString("en-AU", {
                        day: "numeric",
                        month: "short",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <h3 className="mt-2 text-lg text-ink">{r.title}</h3>
                  <p className="mt-2 text-sm text-ink-soft whitespace-pre-wrap">
                    {r.body}
                  </p>
                  <div className="mt-3 text-xs text-muted">
                    by {r.authorFirst} {r.authorLast}
                  </div>
                </div>
                <DeleteAnnouncementButton id={r.id} title={r.title} />
              </div>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
