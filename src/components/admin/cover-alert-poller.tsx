"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncAdminCoverAlerts } from "@/app/_actions/tutor-cover";

const POLL_MS = 5 * 60 * 1000;

/** Keep 48h/24h cover alerts current while an admin has the portal open. */
export function CoverAlertPoller() {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function sync() {
      if (document.visibilityState !== "visible") return;
      try {
        const result = await syncAdminCoverAlerts();
        if (active && result.sent > 0) router.refresh();
      } catch (error) {
        console.error("[cover-alert-poller] reminder sync failed", error);
      }
    }

    const timer = window.setInterval(sync, POLL_MS);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void sync();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router]);

  return null;
}
