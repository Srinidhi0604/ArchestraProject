"use client";

import type { InfrastructureSystem, SystemStatus } from "@/lib/infrastructure";
import { statusColor, systemTypeLabels } from "@/lib/infrastructure";
import { motion, AnimatePresence } from "framer-motion";

// ---------------------------------------------------------------------------
// Severity ordering — critical first
// ---------------------------------------------------------------------------
const SEVERITY_ORDER: Record<SystemStatus, number> = {
  critical: 0,
  risk: 1,
  healthy: 2,
};

function statusLabel(status: SystemStatus): string {
  if (status === "critical") return "CRITICAL";
  if (status === "risk") return "WARNING";
  return "NOMINAL";
}

interface IncidentPanelProps {
  systems: InfrastructureSystem[];
  selectedSystemId: string | null;
  resolvedSystemId?: string;
  onSelectSystem: (systemId: string) => void;
}

export function IncidentPanel({
  systems,
  selectedSystemId,
  resolvedSystemId,
  onSelectSystem,
}: IncidentPanelProps) {
  // Sort by severity (critical first), then by risk_score descending
  const sorted = [...systems].sort(
    (a, b) =>
      SEVERITY_ORDER[a.status] - SEVERITY_ORDER[b.status] ||
      b.risk_score - a.risk_score,
  );

  const criticalCount = systems.filter((s) => s.status === "critical").length;
  const riskCount = systems.filter((s) => s.status === "risk").length;

  return (
    <motion.div
      initial={{ opacity: 0, x: -30 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.8, duration: 0.5, type: "spring", damping: 20 }}
      className="glass-panel pointer-events-auto fixed left-6 top-[72px] z-20 w-[310px] max-w-[calc(100vw-3rem)] overflow-hidden"
    >
      {/* Header */}
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-bold tracking-widest text-white">
            INFRASTRUCTURE
          </div>
          <div className="flex items-center gap-2 text-[10px] tabular-nums">
            {criticalCount > 0 && (
              <span className="flex items-center gap-1 text-[#ff3366]">
                <span className="animate-pulse h-1.5 w-1.5 rounded-full bg-[#ff3366]" />
                {criticalCount}
              </span>
            )}
            {riskCount > 0 && (
              <span className="flex items-center gap-1 text-[#ff9500]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#ff9500]" />
                {riskCount}
              </span>
            )}
          </div>
        </div>
        <div className="mt-0.5 text-[10px] text-control-muted">
          {systems.length} systems · live telemetry
        </div>
      </div>

      {/* System rows */}
      <div className="max-h-[380px] overflow-auto scrollbar-control">
        <AnimatePresence mode="popLayout">
          {sorted.map((system) => {
            const color = statusColor[system.status];
            const isSelected = selectedSystemId === system.id;
            const isResolved = resolvedSystemId === system.id;

            return (
              <motion.button
                key={system.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                type="button"
                onClick={() => onSelectSystem(system.id)}
                className={`group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-all ${
                  isSelected
                    ? "bg-white/[0.06] border-l-2"
                    : "border-l-2 border-transparent hover:bg-white/[0.03]"
                }`}
                style={isSelected ? { borderLeftColor: color } : undefined}
              >
                {/* Status indicator */}
                <div className="relative shrink-0">
                  <span
                    className="block h-2.5 w-2.5 rounded-full"
                    style={{
                      backgroundColor: isResolved ? "#00ff88" : color,
                      boxShadow: `0 0 10px ${isResolved ? "#00ff88" : color}55`,
                    }}
                  />
                  {system.status === "critical" && !isResolved && (
                    <span
                      className="absolute inset-0 h-2.5 w-2.5 rounded-full animate-ping"
                      style={{ backgroundColor: color, opacity: 0.4 }}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-medium text-white">
                      {system.name}
                    </span>
                    {isResolved && (
                      <span className="text-[9px] font-bold text-[#00ff88] tracking-wider">
                        RESOLVED
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-control-muted">
                    <span>{systemTypeLabels[system.system_type]}</span>
                    <span className="text-white/15">·</span>
                    <span className="truncate">{system.location_label}</span>
                  </div>
                </div>

                {/* Risk score badge */}
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span
                    className="rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wider"
                    style={{
                      backgroundColor: `${isResolved ? "#00ff88" : color}15`,
                      color: isResolved ? "#00ff88" : color,
                      border: `1px solid ${isResolved ? "#00ff88" : color}30`,
                    }}
                  >
                    {statusLabel(system.status)}
                  </span>
                  <span
                    className="text-[9px] tabular-nums"
                    style={{ color: `${isResolved ? "#00ff88" : color}aa` }}
                  >
                    Risk {system.risk_score}
                  </span>
                </div>
              </motion.button>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-4 py-2 text-[9px] text-control-muted tracking-wide">
        SORTED BY SEVERITY · LIVE FEED
      </div>
    </motion.div>
  );
}
