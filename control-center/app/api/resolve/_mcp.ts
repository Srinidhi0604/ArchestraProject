type McpSystemRecord = {
  system_id: string;
  system_type: string;
  name?: string;
};

type SystemIdAliasMap = Record<string, string>;

const MCP_SYSTEMS_URL =
  process.env.ARCHESTRA_MCP_SYSTEMS_URL?.trim() || "http://localhost:8010/systems";

const MCP_SYSTEMS_BEARER_TOKEN =
  process.env.ARCHESTRA_MCP_SYSTEMS_BEARER_TOKEN?.trim() ||
  process.env.ARCHESTRA_API_TOKEN?.trim() ||
  "";

const SYSTEM_ID_ALIAS_MAP: SystemIdAliasMap = (() => {
  const raw = process.env.ARCHESTRA_SYSTEM_ID_MAP?.trim();
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as SystemIdAliasMap;
  } catch {
    return {};
  }
})();

let cachedSystems: McpSystemRecord[] | null = null;
let cacheExpiresAt = 0;

function mapFrontendTypeToMcpType(systemType: string): string {
  if (systemType === "power_grid") return "power_grid";
  if (systemType === "hydro_plant") return "hydro_plant";
  if (systemType === "sewage_plant") return "sewage_plant";
  if (systemType === "data_center") return "data_center";
  if (systemType === "substation") return "substation";
  return systemType;
}

function suffixIndexFromId(systemId: string): number | null {
  const match = systemId.match(/_(\d+)$/);
  if (!match) return null;
  const index = Number.parseInt(match[1], 10);
  return Number.isFinite(index) && index > 0 ? index : null;
}

function normalizeCatalog(raw: unknown): McpSystemRecord[] {
  const getArrayCandidate = (input: unknown): unknown[] => {
    if (Array.isArray(input)) return input;
    if (!input || typeof input !== "object") return [];

    const record = input as Record<string, unknown>;
    if (Array.isArray(record.systems)) return record.systems;
    if (Array.isArray(record.data)) return record.data;
    if (Array.isArray(record.items)) return record.items;
    return [];
  };

  const catalogEntries = getArrayCandidate(raw);
  if (!catalogEntries.length) return [];

  return catalogEntries
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const record = entry as Record<string, unknown>;
      const systemId =
        (typeof record.system_id === "string" ? record.system_id : undefined) ||
        (typeof record.systemId === "string" ? record.systemId : undefined) ||
        (typeof record.id === "string" ? record.id : undefined) ||
        "";
      const systemType =
        (typeof record.system_type === "string" ? record.system_type : undefined) ||
        (typeof record.systemType === "string" ? record.systemType : undefined) ||
        (typeof record.type === "string" ? record.type : undefined) ||
        "";
      const name =
        (typeof record.name === "string" ? record.name : undefined) ||
        (typeof record.display_name === "string" ? record.display_name : undefined) ||
        (typeof record.displayName === "string" ? record.displayName : undefined);
      const normalizedSystemId = systemId.trim();
      const normalizedSystemType = systemType.trim();
      if (!normalizedSystemId || !normalizedSystemType) return null;
      return {
        system_id: normalizedSystemId,
        system_type: normalizedSystemType,
        ...(name?.trim() ? { name: name.trim() } : {}),
      };
    })
    .filter((entry): entry is McpSystemRecord => Boolean(entry));
}

export async function fetchMcpSystemsCatalog(): Promise<McpSystemRecord[]> {
  const now = Date.now();
  if (cachedSystems && now < cacheExpiresAt) {
    return cachedSystems;
  }

  const response = await fetch(MCP_SYSTEMS_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(MCP_SYSTEMS_BEARER_TOKEN
        ? { Authorization: `Bearer ${MCP_SYSTEMS_BEARER_TOKEN}` }
        : {}),
    },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(
      `Unable to fetch MCP systems catalog from ${MCP_SYSTEMS_URL} (status ${response.status}).`,
    );
  }

  const payload = (await response.json()) as unknown;

  const systems = normalizeCatalog(payload);
  if (systems.length === 0) {
    throw new Error("MCP systems catalog is empty or invalid.");
  }

  cachedSystems = systems;
  cacheExpiresAt = now + 15_000;
  return systems;
}

export function resolveCanonicalSystemId(
  frontendSystemId: string,
  frontendSystemType: string,
  mcpSystems: McpSystemRecord[],
): string | null {
  const normalizedFrontendId = frontendSystemId.trim();
  if (!normalizedFrontendId) return null;

  if (mcpSystems.some((system) => system.system_id === normalizedFrontendId)) {
    return normalizedFrontendId;
  }

  const alias = SYSTEM_ID_ALIAS_MAP[normalizedFrontendId]?.trim();
  if (alias && mcpSystems.some((system) => system.system_id === alias)) {
    return alias;
  }

  const mappedType = mapFrontendTypeToMcpType(frontendSystemType.trim());
  const typeCandidates = mcpSystems
    .filter((system) => system.system_type === mappedType)
    .sort((left, right) => left.system_id.localeCompare(right.system_id));

  if (typeCandidates.length === 0) return null;

  const index = suffixIndexFromId(normalizedFrontendId);
  if (index && index <= typeCandidates.length) {
    return typeCandidates[index - 1].system_id;
  }

  return typeCandidates[0].system_id;
}