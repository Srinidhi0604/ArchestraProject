"use client";

import { AgentTraceStep } from "@/lib/infrastructure";
import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface AgentTracePanelProps {
  steps: AgentTraceStep[];
  onClose: () => void;
}

export function AgentTracePanel({ steps, onClose }: AgentTracePanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      className="glass-panel fixed left-6 top-20 z-20 w-[290px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
            Agent Orchestration
          </h3>
          <p className="mt-0.5 text-[10px] text-control-muted">
            {steps.length} runtime events
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-control-muted transition-colors hover:bg-white/10 hover:text-white"
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

      <div className="space-y-0.5 p-2.5">
        {steps.length === 0 && (
          <div className="rounded-lg border border-white/10 bg-black/25 px-3 py-2.5 text-[11px] text-control-muted">
            No runtime trace events returned yet.
          </div>
        )}
        {steps.map((step, idx) => (
          <motion.div
            key={`${step.timestamp}-${step.agent}-${idx}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.03 }}
            className="rounded-lg bg-[#00bbff]/[0.06] px-3 py-2"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="truncate text-[11px] font-medium text-white">{step.agent}</p>
              <span className="shrink-0 text-[9px] text-control-muted">{step.timestamp}</span>
            </div>
            <p className="mt-1 text-[10px] text-control-muted">{step.detail}</p>
          </motion.div>
        ))}
      </div>

      <div className="px-5 pb-4 pt-1 text-[10px] text-control-muted">
        Trace panel reflects runtime-emitted A2A events only.
      </div>
    </motion.div>
  );
}
