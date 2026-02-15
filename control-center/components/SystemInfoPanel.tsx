"use client";

import { OrchestrationPhase, OrchestrationStatus } from "@/components/OrchestrationStatus";
import { InfrastructureSystem, statusColor, systemTypeLabels } from "@/lib/infrastructure";
import { getComponentsAtRisk } from "@/lib/systemRegistry";
import { motion } from "framer-motion";

interface SystemInfoPanelProps {
  system: InfrastructureSystem;
  isResolving: boolean;
  orchestrationPhase: OrchestrationPhase | null;
  onResolve: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-control-muted transition-colors hover:bg-white/10 hover:text-white"
      aria-label="Close"
    >
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
        <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}

function MetricBar({
  label,
  value,
  unit,
  pct,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  pct?: number;
  color: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[9px] uppercase tracking-wider text-control-muted">{label}</span>
        <span className="text-[12px] font-semibold tabular-nums text-white">
          {value}
          <span className="text-[9px] text-control-muted ml-0.5">{unit}</span>
        </span>
      </div>
      {pct !== undefined && (
        <div className="h-1 w-full rounded-full bg-white/[0.06] overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color, opacity: 0.7 }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(pct, 100)}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Risk gauge — small circular arc indicator
// ---------------------------------------------------------------------------
function RiskGauge({ score, color }: { score: number; color: string }) {
  const radius = 18;
  const circumference = Math.PI * radius; // half-circle
  const pct = Math.min(score / 100, 1);
  const offset = circumference * (1 - pct);

  return (
    <div className="flex flex-col items-center gap-0.5">
      <svg width="44" height="26" viewBox="0 0 44 26">
        <path
          d="M4 24 A18 18 0 0 1 40 24"
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <motion.path
          d="M4 24 A18 18 0 0 1 40 24"
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ filter: `drop-shadow(0 0 4px ${color})` }}
        />
      </svg>
      <span className="text-[14px] font-bold tabular-nums" style={{ color }}>
        {score}
      </span>
      <span className="text-[8px] uppercase tracking-wider text-control-muted">RISK</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function SystemInfoPanel({
  system,
  isResolving,
  orchestrationPhase,
  onResolve,
  onClose,
}: SystemInfoPanelProps) {
  const color = statusColor[system.status];
  const componentsAtRisk = getComponentsAtRisk(system.id);
  const t = system.telemetry;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.96 }}
      transition={{ type: "spring", damping: 26, stiffness: 320 }}
      className="glass-panel fixed bottom-6 left-6 z-20 w-[360px] max-w-[calc(100vw-3rem)]"
    >
      {/* Header */}
      <div className="flex items-start justify-between px-5 py-3.5 border-b border-white/[0.06]">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="relative">
              <div
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
              />
              {system.status === "critical" && (
                <div
                  className="absolute inset-0 h-2.5 w-2.5 rounded-full animate-ping"
                  style={{ backgroundColor: color, opacity: 0.3 }}
                />
              )}
            </div>
            <h3 className="truncate text-[14px] font-semibold text-white">{system.name}</h3>
            <span
              className="rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${color}15`,
                color,
                border: `1px solid ${color}30`,
              }}
            >
              {system.status}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[10px] text-control-muted">
            <span>{systemTypeLabels[system.system_type]}</span>
            <span className="text-white/15">·</span>
            <span className="truncate">{system.location_label}</span>
          </div>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      {/* Risk gauge + primary load bar */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-white/[0.06]">
        <RiskGauge score={system.risk_score} color={color} />
        <div className="flex-1 space-y-2.5">
          <MetricBar label="Load" value={t.load_percent} unit="%" pct={t.load_percent} color={color} />
          <MetricBar label="Temperature" value={t.temperature} unit="°C" pct={(t.temperature / 100) * 100} color={t.temperature > 75 ? "#ff3366" : color} />
        </div>
      </div>

      {/* Telemetry grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-5 py-3 border-b border-white/[0.06]">
        <MetricBar label="Voltage" value={t.voltage} unit="V" color={color} />
        <MetricBar label="Current" value={t.current} unit="A" color={color} />
      </div>

      {/* Components at risk */}
      {componentsAtRisk.length > 0 && (
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <div className="text-[9px] font-bold uppercase tracking-wider text-control-muted mb-1.5">
            Components at Risk
          </div>
          <div className="space-y-1">
            {componentsAtRisk.slice(0, 4).map((name) => (
              <div key={name} className="flex items-center gap-2 text-[11px]">
                <span
                  className="h-1 w-1 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate text-white/85">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Resolve action */}
      {system.status !== "healthy" && (
        <div className="px-5 py-3">
          <button
            type="button"
            onClick={onResolve}
            disabled={isResolving}
            className="group w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{
              background: isResolving
                ? "rgba(255,255,255,0.06)"
                : `linear-gradient(135deg, ${color}cc, ${color}80)`,
              boxShadow: isResolving ? "none" : `0 0 20px ${color}25`,
            }}
          >
            {isResolving ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Orchestrating…
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
                  <path d="M9 12l2 2 4-4" />
                </svg>
                Resolve Issue
              </span>
            )}
          </button>

          <OrchestrationStatus phase={orchestrationPhase} />
        </div>
      )}
    </motion.div>
  );
}
