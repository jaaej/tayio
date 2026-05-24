import { Card, CardLabel } from "@/components/ui/card";

export default function ResourcesPlaceholderPage() {
  return (
    <div className="space-y-8">
      <header className="rise">
        <CardLabel>Resources</CardLabel>
        <h1 className="mt-2 text-4xl lg:text-5xl font-light tracking-tight text-ink">
          Library
        </h1>
      </header>
      <Card>
        <div className="py-6 text-sm text-ink-soft">
          The resource library — worksheets, past papers, videos, formula
          sheets — opens in Phase 4.
        </div>
      </Card>
    </div>
  );
}
