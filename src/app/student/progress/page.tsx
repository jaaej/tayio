import { Card, CardLabel } from "@/components/ui/card";

export default function ProgressPlaceholderPage() {
  return (
    <div className="space-y-8">
      <header className="rise">
        <CardLabel>Progress</CardLabel>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Topic mastery
        </h1>
      </header>
      <Card>
        <div className="py-6 text-sm text-ink-soft">
          Progress tracking arrives in Phase 4. For now, ask your tutor where
          you stand — they keep notes after every lesson.
        </div>
      </Card>
    </div>
  );
}
