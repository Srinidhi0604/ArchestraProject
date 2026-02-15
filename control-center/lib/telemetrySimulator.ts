import type { Telemetry } from "@/lib/infrastructure";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function round(value: number) {
  return Math.round(value);
}

/**
 * Generates semi-realistic telemetry from a base load percentage.
 * Keeps values bounded and correlated (load ↔ current ↔ temperature, and voltage droops under load).
 */
export function generateTelemetry(baseLoad: number): Telemetry {
  const now = Date.now();
  const t = now / 1000;

  const base = clamp(baseLoad, 25, 98);

  const oscillation =
    Math.sin(t / 5) * 3.2 +
    Math.sin(t / 17) * 1.4 +
    Math.sin(t / 41) * 0.8;

  const noise = (Math.sin(t * 2.3) + Math.cos(t * 1.7)) * 0.6;

  const load = clamp(base + oscillation + noise, 10, 100);

  const voltage = clamp(242 - (load - 55) * 0.22 + Math.sin(t / 9) * 1.8, 208, 252);
  const current = clamp(190 + load * 3.9 + Math.sin(t / 7) * 11, 150, 560);
  const temperature = clamp(32 + load * 0.38 + Math.cos(t / 13) * 1.6, 25, 84);

  return {
    voltage: round(voltage),
    current: round(current),
    temperature: round(temperature),
    load_percent: round(load),
  };
}
