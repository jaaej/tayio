"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { markVideoWatched } from "../_actions";

export function VideoPlayer({
  src,
  subjectWeekId,
  alreadyWatched,
}: {
  src: string;
  subjectWeekId: string;
  alreadyWatched: boolean;
}) {
  const router = useRouter();
  const sent = useRef(alreadyWatched);
  const [, setTick] = useState(0);

  return (
    <video
      controls
      className="w-full rounded-[14px] bg-black"
      onPlay={() => {
        if (sent.current) return;
        sent.current = true;
        markVideoWatched(subjectWeekId).then((res) => {
          if (res.ok) {
            setTick((n) => n + 1);
            router.refresh();
          }
        });
      }}
    >
      <source src={src} />
    </video>
  );
}
