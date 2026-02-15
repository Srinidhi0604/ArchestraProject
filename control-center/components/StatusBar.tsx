"use client";

import {
  InfrastructureSystem,
  OrchestrationState,
  statusColor,
} from "@/lib/infrastructure";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface StatusBarProps {
  systems: InfrastructureSystem[];
  lifecycleState: OrchestrationState;
}

// ---------------------------------------------------------------------------
// Live clock hook
// ---------------------------------------------------------------------------
function useClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

// ---------------------------------------------------------------------------
// Orchestration phase label + color
// ---------------------------------------------------------------------------
function stateLabel(s: OrchestrationState) {
  switch (s) {
    case "resolving":
      return { label: "RESOLVING", color: "#00bbff" };
    case "agents_running":
      return { label: "AGENTS ACTIVE", color: "#00bbff" };
    case "resolved":
      return { label: "STABILIZED", color: "#00ff88" };
    case "error":
      return { label: "ERROR", color: "#ff3366" };
    default:
      return { label: "MONITORING", color: "#8EA0C8" };
  }
}

// ---------------------------------------------------------------------------
// Component — Minimal always-visible HUD at top-left
// ---------------------------------------------------------------------------
export function StatusBar({ systems, lifecycleState }: StatusBarProps) {
  const clock = useClock();
  const healthy = systems.filter((s) => s.status === "healthy").length;
  const risk = systems.filter((s) => s.status === "risk").length;
  const critical = systems.filter((s) => s.status === "critical").length;
  const total = systems.length;

  const { label: phaseLabel, color: phaseColor } = stateLabel(lifecycleState);

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.5 }}
      className="glass-panel fixed left-6 top-5 z-10 flex items-center gap-3 px-4 py-2.5"
    >
      {/* Brand */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <div
            className="h-2 w-2 rounded-full"
            style={{
              backgroundColor: phaseColor,
              boxShadow: `0 0 8px ${phaseColor}`,
            }}
          />
          {lifecycleState !== "idle" && lifecycleState !== "resolved" && (
            <div
              className="absolute inset-0 h-2 w-2 rounded-full animate-ping"
              style={{ backgroundColor: phaseColor, opacity: 0.4 }}
            />
          )}
        </div>
        <div className="leading-tight">
          <div className="text-[11px] font-bold tracking-widest text-white">
            SENTINEL
          </div>
          <div className="text-[9px] text-control-muted tracking-wide">
            AUTONOMOUS INFRASTRUCTURE CONTROL
          </div>
        </div>
      </div>

      <div className="h-4 w-px bg-white/10" />

      {/* Live clock */}
      <span className="text-[11px] tabular-nums text-control-muted font-mono">
        {clock}
      </span>

      <div className="h-4 w-px bg-white/10" />

      {/* System health counts */}
      <div className="flex items-center gap-2.5 text-[11px] tabular-nums">
        <span className="flex items-center gap-1" title="Healthy">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: statusColor.healthy }}
          />
          <span className="text-control-muted">{healthy}</span>
        </span>
        <span className="flex items-center gap-1" title="At Risk">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: statusColor.risk }}
          />
          <span className="text-control-muted">{risk}</span>
        </span>
        <span className="flex items-center gap-1" title="Critical">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: statusColor.critical }}
          />
          <span className="text-control-muted">{critical}</span>
        </span>
        <span className="text-[9px] text-control-muted/50">/{total}</span>
      </div>

      {/* Orchestration phase indicator */}
      <div className="h-4 w-px bg-white/10" />
      <div className="flex items-center gap-1.5">
        <div
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: phaseColor, boxShadow: `0 0 6px ${phaseColor}` }}
        />
        <span
          className="text-[10px] font-medium tracking-wider"
          style={{ color: phaseColor }}
        >
          {phaseLabel}
        </span>
      </div>
    </motion.div>
  );
}
