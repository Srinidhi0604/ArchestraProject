"use client";

import {
  InfrastructureSystem,
  Telemetry,
  statusColor,
  systemTypeLabels,
} from "@/lib/infrastructure";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TelemetryPoint extends Telemetry {
  tick: string;
}

interface SystemInfoPanelProps {
  system: InfrastructureSystem;
  history: TelemetryPoint[];
  isResolving: boolean;
  onResolve: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-1.5">
      <span className="text-[10px] uppercase tracking-wider text-control-muted">
        {label}
      </span>
      <p className="text-sm font-medium tabular-nums text-white">{value}</p>
    </div>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-control-muted transition-colors hover:bg-white/10 hover:text-white"
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
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------
export function SystemInfoPanel({
  system,
  history,
  isResolving,
  onResolve,
  onClose,
}: SystemInfoPanelProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (!chartRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const e = entries[0];
      if (!e) return;
      setChartSize({
        width: Math.floor(e.contentRect.width),
        height: Math.floor(e.contentRect.height),
      });
    });
    obs.observe(chartRef.current);
    return () => obs.disconnect();
  }, []);

  const color = statusColor[system.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 40, scale: 0.96 }}
      transition={{ type: "spring", damping: 26, stiffness: 320 }}
      className="glass-panel fixed bottom-6 left-6 z-20 w-[370px] max-w-[calc(100vw-3rem)]"
    >
      {/* ---- Header ---- */}
      <div className="flex items-start justify-between border-b border-white/[0.06] px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
            />
            <h3 className="truncate text-sm font-semibold text-white">
              {system.name}
            </h3>
          </div>
          <p className="mt-0.5 text-[11px] text-control-muted">
            {systemTypeLabels[system.system_type]}
          </p>
        </div>
        <CloseButton onClick={onClose} />
      </div>

      {/* ---- Status + Risk ---- */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-2.5">
        <span
          className="rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
          style={{
            backgroundColor: `${color}18`,
            color,
            border: `1px solid ${color}35`,
          }}
        >
          {system.status}
        </span>
        <div className="text-right">
          <span className="text-[10px] uppercase tracking-wider text-control-muted">
            Risk&nbsp;
          </span>
          <span className="text-sm font-bold tabular-nums" style={{ color }}>
            {system.risk_score}
          </span>
        </div>
      </div>

      {/* ---- Telemetry Grid ---- */}
      <div className="grid grid-cols-2 gap-x-4 px-5 py-2">
        <Metric label="Voltage" value={`${system.telemetry.voltage} V`} />
        <Metric label="Current" value={`${system.telemetry.current} A`} />
        <Metric label="Temperature" value={`${system.telemetry.temperature} °C`} />
        <Metric label="Load" value={`${system.telemetry.load_percent}%`} />
      </div>

      {/* ---- Mini Sparkline ---- */}
      <div ref={chartRef} className="h-24 px-4 py-1">
        {chartSize.width > 0 && chartSize.height > 0 && history.length > 1 && (
          <ResponsiveContainer width={chartSize.width} height={chartSize.height}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00bbff" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00bbff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="tick" hide />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "rgba(10,22,40,0.95)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "8px",
                  fontSize: "11px",
                }}
                labelStyle={{ color: "#8EA0C8" }}
              />
              <Area
                type="monotone"
                dataKey="load_percent"
                stroke="#00bbff"
                strokeWidth={1.5}
                fill="url(#sparkGrad)"
                dot={false}
                animationDuration={400}
              />
              <Area
                type="monotone"
                dataKey="temperature"
                stroke="#ff3366"
                strokeWidth={1}
                fill="none"
                dot={false}
                animationDuration={400}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ---- Resolve Button ---- */}
      {system.status !== "healthy" && (
        <div className="border-t border-white/[0.06] px-5 py-3">
          <button
            type="button"
            onClick={onResolve}
            disabled={isResolving}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
            style={{
              background: isResolving
                ? "rgba(255,255,255,0.08)"
                : `linear-gradient(135deg, ${color}cc, ${color}80)`,
              boxShadow: isResolving ? "none" : `0 0 24px ${color}30`,
            }}
          >
            {isResolving ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="h-4 w-4 animate-spin"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="2"
                    opacity="0.3"
                  />
                  <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
                Orchestrating…
              </span>
            ) : (
              "Resolve Issue"
            )}
          </button>
        </div>
      )}
    </motion.div>
  );
}
