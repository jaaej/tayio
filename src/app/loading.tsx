import { PageLoadingIndicator } from "@/components/ui/navigation-loading-indicator";

/** Immediate feedback while an App Router navigation waits on server data. */
export default function Loading() {
  return <PageLoadingIndicator />;
}
