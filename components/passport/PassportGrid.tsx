'use client';

import { useState, useEffect } from "react";
import { PassportStamp } from "./PassportStamp";

interface PassportGridProps {
  initialStamps?: any[];
}

export function PassportGrid({ initialStamps = [] }: PassportGridProps) {
  const [stamps, setStamps] = useState<any[]>(initialStamps);

  useEffect(() => {
    // Refresh stamps list when parent re-loads data
    setStamps(initialStamps);
  }, [initialStamps]);

  const handleStampClick = (stamp: any) => {
    // Future: open a stamp detail modal or the route detail screen
    if (!stamp.isCompleted) {
      console.log('[Passport] Stamp clicked — incomplete route:', stamp.name);
    }
  };

  return (
    <div className="grid grid-cols-3 gap-3">
      {stamps.map((stamp, index) => (
        <PassportStamp
          key={stamp.id}
          id={stamp.id}
          name={stamp.name}
          date={stamp.date}
          stampUrl={stamp.stampUrl}
          totalPois={stamp.totalPois ?? 1}
          visitedPois={stamp.visitedPois ?? 0}
          quizDonePois={stamp.quizDonePois ?? 0}
          poisProgress={stamp.poisProgress ?? []}
          isCompleted={stamp.isCompleted ?? false}
          onClick={() => handleStampClick(stamp)}
          index={index}
        />
      ))}
    </div>
  );
}
