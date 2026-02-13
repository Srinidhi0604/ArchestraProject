"use client";

import { SolutionPayload, statusColor } from "@/lib/infrastructure";
import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SolutionPanelProps {
  solution: SolutionPayload;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function SolutionPanel({ solution, onClose }: SolutionPanelProps) {
  const color = statusColor[solution.riskLevel];

  return (
    <motion.div
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      className="glass-panel fixed right-6 top-1/2 z-20 max-h-[80vh] w-[350px] max-w-[calc(100vw-3rem)] -translate-y-1/2 overflow-y-auto"
    >
      {/* Header */}
      <div className="flex items-start justify-between border-b border-white/[0.06] px-5 py-4">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
            Orchestration Result
          </h3>
          <span
            className="mt-1.5 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: `${color}18`,
              color,
              border: `1px solid ${color}35`,
            }}
          >
            {solution.riskLevel} risk
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-control-muted transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M1 1L9 9M9 1L1 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className="space-y-4 px-5 py-4">
        {/* Diagnosis */}
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-control-muted">
            Diagnosis
          </p>
          <p className="text-sm leading-relaxed text-white/90">
            {solution.diagnosis}
          </p>
        </div>

        {/* Confidence bar */}
        <div>
          <p className="mb-1 text-[10px] uppercase tracking-wider text-control-muted">
            Confidence
          </p>
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${solution.confidence * 100}%`,
                  background: "linear-gradient(90deg, #00bbff, #00ff88)",
                }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-white">
              {Math.round(solution.confidence * 100)}%
            </span>
          </div>
        </div>

        {/* Recommended Actions */}
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-wider text-control-muted">
            Recommended Actions
          </p>
          <div className="space-y-1.5">
            {solution.recommendedActions.map((action, i) => (
              <div
                key={i}
                className="flex items-start gap-2 text-[12px] text-white/80"
              >
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#00bbff]" />
                {action}
              </div>
            ))}
          </div>
        </div>

        {/* Execution Commands */}
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-wider text-control-muted">
            Execution Commands
          </p>
          <div className="space-y-1 rounded-lg bg-black/30 p-3">
            {solution.executionCommands.map((cmd, i) => (
              <p
                key={i}
                className="font-mono text-[11px] text-[#00bbff]/80"
              >{`> ${cmd}`}</p>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
