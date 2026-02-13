"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-black p-6 text-control-text">
      <div className="glass-panel max-w-xl p-8 text-center">
        <div
          className="mx-auto mb-4 h-3 w-3 rounded-full"
          style={{ backgroundColor: "#ff3366", boxShadow: "0 0 16px #ff3366" }}
        />
        <h2 className="text-lg font-semibold text-white">
          Control Center Error
        </h2>
        <p className="mt-2 text-sm text-control-muted">
          Something failed while rendering the infrastructure interface.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-lg border border-[#00bbff]/30 bg-[#00bbff]/15 px-6 py-2.5 text-sm font-semibold text-[#00bbff] transition-colors hover:bg-[#00bbff]/25"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
