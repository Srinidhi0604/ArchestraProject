"use client";

import {
  InfrastructureSystem,
  OrchestrationState,
  statusColor,
} from "@/lib/infrastructure";
import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface StatusBarProps {
  systems: InfrastructureSystem[];
  lifecycleState: OrchestrationState;
}

// ---------------------------------------------------------------------------
// Component — Minimal always-visible HUD at top-left
// ---------------------------------------------------------------------------
export function StatusBar({ systems, lifecycleState }: StatusBarProps) {
  const healthy = systems.filter((s) => s.status === "healthy").length;
  const risk = systems.filter((s) => s.status === "risk").length;
  const critical = systems.filter((s) => s.status === "critical").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="glass-panel fixed left-6 top-5 z-10 flex items-center gap-3.5 px-4 py-2.5"
    >
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div
          className="h-2 w-2 rounded-full"
          style={{
            backgroundColor: "#00bbff",
            boxShadow: "0 0 8px #00bbff",
          }}
        />
        <span className="text-[11px] font-bold tracking-widest text-white">
          ARCHESTRA
        </span>
      </div>

      <div className="h-3.5 w-px bg-white/10" />

      {/* System health counts */}
      <div className="flex items-center gap-2.5 text-[11px] tabular-nums">
        <span className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: statusColor.healthy }}
          />
          <span className="text-control-muted">{healthy}</span>
        </span>
        <span className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: statusColor.risk }}
          />
          <span className="text-control-muted">{risk}</span>
        </span>
        <span className="flex items-center gap-1">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: statusColor.critical }}
          />
          <span className="text-control-muted">{critical}</span>
        </span>
      </div>

      {/* Active orchestration state */}
      {lifecycleState !== "idle" && (
        <>
          <div className="h-3.5 w-px bg-white/10" />
          <div className="flex items-center gap-1.5">
            <div
              className={`h-1.5 w-1.5 rounded-full ${
                lifecycleState === "resolving" ||
                lifecycleState === "agents_running"
                  ? "animate-pulse-glow bg-[#00bbff]"
                  : lifecycleState === "error"
                    ? "bg-[#ff3366]"
                    : "bg-[#00ff88]"
              }`}
            />
            <span className="text-[10px] uppercase tracking-wider text-control-muted">
              {lifecycleState.replace(/_/g, " ")}
            </span>
          </div>
        </>
      )}
    </motion.div>
  );
}
