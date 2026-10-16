"use client";

import { useEffect } from "react";

export function PrintControls({ auto }: { auto: boolean }) {
  useEffect(() => {
    if (auto) {
      const t = setTimeout(() => window.print(), 300);
      return () => clearTimeout(t);
    }
  }, [auto]);
  return (
    <div className="no-print mb-4 flex justify-center gap-2 text-sm">
      <button onClick={() => window.print()} className="rounded bg-black px-3 py-1.5 text-white">Print</button>
      <button onClick={() => window.close()} className="rounded px-3 py-1.5 ring-1 ring-stone-300">Close</button>
    </div>
  );
}
