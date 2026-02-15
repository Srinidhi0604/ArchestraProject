import type { InfrastructureSystem } from "@/lib/infrastructure";

export const DEMO_SYSTEM_ID = "grid_001";

export const systemRegistry: InfrastructureSystem[] = [
  {
    id: "grid_001",
    name: "North Power Grid",
    system_type: "power_grid",
    location: { lat: 13.027, lng: 77.614, alt: 620 },
    location_label: "North Region",
    status: "critical",
    telemetry: { voltage: 246, current: 528, temperature: 72, load_percent: 96 },
    risk_score: 92,
  },
  {
    id: "grid_002",
    name: "South Power Grid",
    system_type: "power_grid",
    location: { lat: 12.944, lng: 77.594, alt: 625 },
    location_label: "South Region",
    status: "risk",
    telemetry: { voltage: 236, current: 462, temperature: 64, load_percent: 82 },
    risk_score: 76,
  },
  {
    id: "hydro_001",
    name: "Riverside Hydro Plant",
    system_type: "hydro_plant",
    location: { lat: 12.931, lng: 77.573, alt: 640 },
    location_label: "Upper Valley",
    status: "risk",
    telemetry: { voltage: 229, current: 401, temperature: 54, load_percent: 76 },
    risk_score: 71,
  },
  {
    id: "sewage_001",
    name: "Central Sewage Plant",
    system_type: "sewage_plant",
    location: { lat: 12.899, lng: 77.648, alt: 610 },
    location_label: "Industrial Zone",
    status: "risk",
    telemetry: { voltage: 221, current: 352, temperature: 58, load_percent: 81 },
    risk_score: 73,
  },
  {
    id: "substation_001",
    name: "Main Substation",
    system_type: "substation",
    location: { lat: 12.844, lng: 77.668, alt: 605 },
    location_label: "Electronic Corridor",
    status: "critical",
    telemetry: { voltage: 239, current: 448, temperature: 69, load_percent: 91 },
    risk_score: 87,
  },
  {
    id: "data_center_001",
    name: "Primary Data Center",
    system_type: "data_center",
    location: { lat: 12.934, lng: 77.626, alt: 615 },
    location_label: "Tech Park",
    status: "risk",
    telemetry: { voltage: 230, current: 404, temperature: 64, load_percent: 83 },
    risk_score: 79,
  },
];

export const componentsAtRiskRegistry: Record<string, string[]> = {
  grid_001: ["Substation A", "Transformer B", "Feeder D"],
  grid_002: ["Transformer A", "Distribution Line C"],
  hydro_001: ["Turbine 2", "Intake Valve", "Generator Cooling Loop"],
  sewage_001: ["Aeration Blower", "Clarifier Drive", "Pump Station 1"],
  substation_001: ["Breaker Bay 4", "Bus Coupler", "Protection Relay"],
  data_center_001: ["Rack Row C", "CRAC Unit 2", "UPS Bank"],
};

export function getComponentsAtRisk(systemId: string): string[] {
  return componentsAtRiskRegistry[systemId] ?? [];
}
