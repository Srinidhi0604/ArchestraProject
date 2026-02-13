"use client";

import { AgentTraceStep } from "@/lib/infrastructure";
import { AnimatePresence, motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Agent definitions — the six orchestration agents
// ---------------------------------------------------------------------------
interface AgentDef {
  name: string;
  role: string;
}

const AGENTS: AgentDef[] = [
  { name: "Master Orchestration Agent", role: "Coordinating workflow" },
  { name: "Forecast Agent", role: "Demand prediction" },
  { name: "Risk Agent", role: "Risk assessment" },
  { name: "Operations Agent", role: "Action planning" },
  { name: "Monitoring Agent", role: "System monitoring" },
  { name: "Safety Agent", role: "Safety validation" },
];

type AgentState = "waiting" | "thinking" | "completed";

const stateColors: Record<AgentState, string> = {
  waiting: "#3a4560",
  thinking: "#00bbff",
  completed: "#00ff88",
};

const stateLabels: Record<AgentState, string> = {
  waiting: "Standby",
  thinking: "Processing",
  completed: "Complete",
};

// ---------------------------------------------------------------------------
// Resolve agent state from trace steps
// ---------------------------------------------------------------------------
function getAgentState(agentName: string, steps: AgentTraceStep[]): AgentState {
  if (steps.some((s) => s.agent === agentName)) return "completed";

  // The agent one position after the last completed one is "thinking"
  const idx = AGENTS.findIndex((a) => a.name === agentName);
  const completedIndices = AGENTS.map((a, i) =>
    steps.some((s) => s.agent === a.name) ? i : -1,
  ).filter((i) => i >= 0);
  const maxCompleted =
    completedIndices.length > 0 ? Math.max(...completedIndices) : -1;

  if (
    idx === maxCompleted + 1 &&
    steps.length > 0 &&
    steps.length < AGENTS.length
  ) {
    return "thinking";
  }

  return "waiting";
}

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
            {steps.length} / {AGENTS.length} complete
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

      {/* Agent list */}
      <div className="space-y-0.5 p-2.5">
        <AnimatePresence initial={false}>
          {AGENTS.map((agent, idx) => {
            const state = getAgentState(agent.name, steps);
            const color = stateColors[state];

            return (
              <motion.div
                key={agent.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors"
                style={{
                  backgroundColor:
                    state === "thinking"
                      ? "rgba(0,187,255,0.07)"
                      : state === "completed"
                        ? "rgba(0,255,136,0.04)"
                        : "transparent",
                }}
              >
                {/* Indicator dot */}
                <div className="relative shrink-0">
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: color,
                      boxShadow:
                        state !== "waiting" ? `0 0 8px ${color}` : "none",
                    }}
                  />
                  {state === "thinking" && (
                    <div
                      className="absolute inset-0 h-2 w-2 animate-ping rounded-full"
                      style={{ backgroundColor: color, opacity: 0.4 }}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-white">
                    {agent.name}
                  </p>
                  <p className="text-[10px] text-control-muted">{agent.role}</p>
                </div>

                {/* State badge */}
                <span
                  className="shrink-0 text-[9px] font-bold uppercase tracking-wider"
                  style={{ color }}
                >
                  {stateLabels[state]}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Progress bar */}
      <div className="px-5 pb-4 pt-1">
        <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.06]">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #00bbff, #00ff88)",
            }}
            initial={{ width: "0%" }}
            animate={{ width: `${(steps.length / AGENTS.length) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
    </motion.div>
  );
}
