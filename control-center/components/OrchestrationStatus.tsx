"use client";

import { motion } from "framer-motion";

export type OrchestrationPhase = "monitoring" | "risk" | "action" | "stabilized";

// ---------------------------------------------------------------------------
// Pipeline steps definition
// ---------------------------------------------------------------------------
const STEPS: { key: OrchestrationPhase; label: string }[] = [
  { key: "monitoring", label: "Monitoring" },
  { key: "risk", label: "Evaluating Risk" },
  { key: "action", label: "Corrective Action" },
  { key: "stabilized", label: "Stabilized" },
];

const PHASE_IDX: Record<OrchestrationPhase, number> = {
  monitoring: 0,
  risk: 1,
  action: 2,
  stabilized: 3,
};

interface OrchestrationStatusProps {
  phase: OrchestrationPhase | null;
}

export function OrchestrationStatus({ phase }: OrchestrationStatusProps) {
  if (!phase) return null;

  const activeIdx = PHASE_IDX[phase];

  return (
    <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
      <div className="flex items-center gap-1">
        {STEPS.map((step, idx) => {
          const completed = idx < activeIdx;
          const active = idx === activeIdx;
          const color = completed || (active && phase === "stabilized")
            ? "#00ff88"
            : active
              ? "#00bbff"
              : "rgba(255,255,255,0.15)";

          return (
            <div key={step.key} className="flex items-center gap-1 flex-1">
              {/* Step dot */}
              <div className="relative flex items-center justify-center">
                <motion.div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                  animate={{
                    scale: active && phase !== "stabilized" ? [1, 1.3, 1] : 1,
                    boxShadow: active ? `0 0 8px ${color}` : "none",
                  }}
                  transition={
                    active && phase !== "stabilized"
                      ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" }
                      : { duration: 0.3 }
                  }
                />
                {completed && (
                  <svg
                    width="8"
                    height="8"
                    viewBox="0 0 10 10"
                    className="absolute"
                    fill="none"
                    stroke="#0a1628"
                    strokeWidth="2"
                    strokeLinecap="round"
                  >
                    <path d="M2.5 5 L4.5 7 L7.5 3" />
                  </svg>
                )}
              </div>

              {/* Connector line (not after last) */}
              {idx < STEPS.length - 1 && (
                <div className="flex-1 h-px mx-0.5" style={{
                  backgroundColor: completed ? "#00ff88" : "rgba(255,255,255,0.08)",
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Active step label */}
      <div className="mt-1.5 text-center">
        <span
          className="text-[10px] font-medium tracking-wider"
          style={{
            color: phase === "stabilized" ? "#00ff88" : "#00bbff",
          }}
        >
          {STEPS[activeIdx].label}
        </span>
      </div>
    </div>
  );
}
