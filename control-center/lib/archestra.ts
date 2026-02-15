import { InfrastructureSystem } from "@/lib/infrastructure";
import { buildOrchestrationPrompt } from "@/lib/orchestration-prompt";

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

const ARCHESTRA_CHAT_BASE_URL =
  process.env.NEXT_PUBLIC_ARCHESTRA_CHAT?.trim() ||
  process.env.NEXT_PUBLIC_ARCHESTRA_CHAT_BASE_URL?.trim() ||
  "http://localhost:3000";

const ARCHESTRA_RUNTIME_BASE_URL =
  process.env.NEXT_PUBLIC_ARCHESTRA_RUNTIME?.trim() || "http://localhost:9000";

const ARCHESTRA_API_KEY = process.env.NEXT_PUBLIC_ARCHESTRA_API_KEY?.trim() || "";

const MASTER_AGENT_ID = "9fcf5462-8372-4f22-9c1e-432d26eb68ab";

const ARCHESTRA_AGENT_ID =
  process.env.NEXT_PUBLIC_ARCHESTRA_AGENT_ID?.trim() || MASTER_AGENT_ID;

// MCP simulator system_ids are `grid_001`, `hydro_001`, `sewage_001`, etc.
// Keep a small compatibility map for older IDs that may appear in URLs/logs.
const SYSTEM_MAP: Record<string, string> = {
  "sys-power-grid-1": "grid_001",
  "sys-hydro-1": "hydro_001",
  "sys-sewage-1": "sewage_001",
};

// ---------------------------------------------------------------------------
// Chat URL
// ---------------------------------------------------------------------------

export function getArchestraAgentId(): string {
  return ARCHESTRA_AGENT_ID || MASTER_AGENT_ID;
}

export function buildArchestraChatUrl(agentId?: string): string {
  const resolvedAgentId = agentId || ARCHESTRA_AGENT_ID;
  if (!resolvedAgentId) {
    return `${ARCHESTRA_CHAT_BASE_URL}/chat/new`;
  }
  return `${ARCHESTRA_CHAT_BASE_URL}/chat/new?agent_id=${encodeURIComponent(resolvedAgentId)}`;
}

function normalizeRuntimeUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function getA2aEndpoint(agentId: string): string {
  return `${normalizeRuntimeUrl(ARCHESTRA_RUNTIME_BASE_URL)}/v1/a2a/${encodeURIComponent(agentId)}`;
}

function buildResolvePrompt(canonicalSystemId: string): string {
  return `Target system: ${canonicalSystemId}\nAnalyze the target system, evaluate risk, and execute corrective actions to stabilize it. Operate autonomously using MCP tools.`;
}

export function toCanonicalSystemId(systemId: string): string {
  const normalized = systemId.trim();
  return SYSTEM_MAP[normalized] ?? normalized;
}

function appendQueryParam(url: string, key: string, value: string): string {
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
}

function extractFirstText(result: unknown): string | null {
  if (!result || typeof result !== "object") return null;

  const anyResult = result as Record<string, unknown>;
  const candidateMessage =
    (anyResult.message as Record<string, unknown> | undefined) ??
    (anyResult.output as Record<string, unknown> | undefined) ??
    anyResult;

  const directText = (candidateMessage as Record<string, unknown>).text;
  if (typeof directText === "string") return directText;

  const parts = (candidateMessage as Record<string, unknown>).parts;
  if (!Array.isArray(parts)) return null;

  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const text = (part as Record<string, unknown>).text;
    if (typeof text === "string") return text;
  }

  return null;
}

export async function resolveInfrastructureIssue(systemId: string): Promise<void> {
  const canonicalSystemId = toCanonicalSystemId(systemId);
  const agentId = getArchestraAgentId();

  if (!agentId) {
    throw new Error("NEXT_PUBLIC_ARCHESTRA_AGENT_ID is required");
  }

  if (!ARCHESTRA_API_KEY) {
    throw new Error("NEXT_PUBLIC_ARCHESTRA_API_KEY is required");
  }

  const prompt = buildResolvePrompt(canonicalSystemId);
  const chatUrl = appendQueryParam(buildArchestraChatUrl(agentId), "user_prompt", prompt);
  const pendingChatWindow = window.open(chatUrl, "_blank", "noopener,noreferrer");

  if (!pendingChatWindow) {
    throw new Error("Popup was blocked. Please allow popups for this site.");
  }

  const payload = {
    jsonrpc: "2.0",
    id: Date.now(),
    method: "message/send",
    params: {
      message: {
        parts: [
          {
            kind: "text",
            text: prompt,
          },
        ],
      },
    },
  };

  let response: Response;
  try {
    response = await fetch(getA2aEndpoint(agentId), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ARCHESTRA_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (networkError) {
    const message = networkError instanceof Error ? networkError.message : String(networkError);
    throw new Error(`A2A request failed to send: ${message}`);
  }

  if (!response.ok) {
    const responseText = await response.text();
    throw new Error(`A2A request failed (${response.status}): ${responseText || "Unknown error"}`);
  }

  let rpc: { error?: { code?: number; message?: string }; result?: unknown };
  try {
    rpc = (await response.json()) as { error?: { code?: number; message?: string }; result?: unknown };
  } catch (parseError) {
    const message = parseError instanceof Error ? parseError.message : String(parseError);
    throw new Error(`A2A response was not valid JSON: ${message}`);
  }

  if (rpc.error) {
    throw new Error(rpc.error.message || `A2A JSON-RPC error (${rpc.error.code ?? "unknown"})`);
  }

  // Common failure mode: runtime logs show `finishReason: "error"` (often due to 429)
  // but the JSON-RPC payload still parses and text is empty.
  const resultText = extractFirstText(rpc.result);
  if (resultText !== null && resultText.trim().length === 0) {
    throw new Error("A2A returned an empty response (runtime may be rate-limited or errored). Check runtime logs.");
  }
}

// ---------------------------------------------------------------------------
// Prompt Generation
// ---------------------------------------------------------------------------

export function buildInfrastructureOrchestrationPrompt(system: InfrastructureSystem): string {
  return buildOrchestrationPrompt({
    systemId: system.id,
    systemName: system.name,
    systemType: system.system_type,
    location: system.location_label,
    status: system.status,
    riskScore: system.risk_score,
    telemetry: {
      loadPercent: system.telemetry.load_percent,
      temperature: system.telemetry.temperature,
      voltage: system.telemetry.voltage,
      current: system.telemetry.current,
    },
  });
}

