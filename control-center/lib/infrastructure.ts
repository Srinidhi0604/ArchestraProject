import { systemRegistry } from "@/lib/systemRegistry";
import { generateTelemetry } from "@/lib/telemetrySimulator";

// ---------------------------------------------------------------------------
// Infrastructure Domain Types & Simulated Entities
// ---------------------------------------------------------------------------

export type SystemType =
  | "power_grid"
  | "hydro_plant"
  | "sewage_plant"
  | "data_center"
  | "substation"
  | "solar_farm";

export type SystemStatus = "healthy" | "risk" | "critical";

export interface Telemetry {
  voltage: number;
  current: number;
  temperature: number;
  load_percent: number;
}

export interface InfrastructureSystem {
  id: string;
  name: string;
  system_type: SystemType;
  location: { lat: number; lng: number; alt: number };
  location_label: string;
  status: SystemStatus;
  telemetry: Telemetry;
  risk_score: number;
}

export type OrchestrationState =
  | "idle"
  | "resolving"
  | "agents_running"
  | "solution_ready"
  | "execution_complete"
  | "resolved"
  | "error";

export interface AgentTraceStep {
  agent: string;
  detail: string;
  timestamp: string;
}

export interface SolutionPayload {
  diagnosis: string;
  riskLevel: SystemStatus;
  recommendedActions: string[];
  executionCommands: string[];
  confidence: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const systemTypeLabels: Record<SystemType, string> = {
  power_grid: "Power Grid",
  hydro_plant: "Hydro Plant",
  sewage_plant: "Sewage Plant",
  data_center: "Data Center",
  substation: "Substation",
  solar_farm: "Solar Farm",
};

export const statusColor: Record<SystemStatus, string> = {
  healthy: "#00ff88",
  risk: "#ff9500",
  critical: "#ff3366",
};

// ---------------------------------------------------------------------------
// Simulation Utilities
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function statusFromRisk(riskScore: number): SystemStatus {
  if (riskScore >= 85) return "critical";
  if (riskScore >= 60) return "risk";
  return "healthy";
}

export function getInitialSystems(): InfrastructureSystem[] {
  return structuredClone(systemRegistry);
}

export function evolveSystems(current: InfrastructureSystem[]): InfrastructureSystem[] {
  return current.map((system) => {
    const telemetry: Telemetry = generateTelemetry(system.telemetry.load_percent);

    const nextRisk = Math.round(
      clamp(
        telemetry.load_percent * 0.55 +
          telemetry.temperature * 0.35 +
          (telemetry.current / 560) * 100 * 0.1,
        5,
        99,
      ),
    );

    return {
      ...system,
      telemetry,
      risk_score: nextRisk,
      status: statusFromRisk(nextRisk),
    };
  });
}
