const ARCHESTRA_BASE_URL =
  process.env.ARCHESTRA_BASE_URL?.trim() ||
  process.env.ARCHESTRA_URL?.trim() ||
  "http://localhost:9000/v1/a2a";
const ARCHESTRA_AGENT_ID = process.env.ARCHESTRA_AGENT_ID?.trim();
const ARCHESTRA_CHAT_BASE_URL =
  process.env.ARCHESTRA_CHAT_BASE_URL?.trim() || "http://localhost:3000";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function pickRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

export function extractUpstreamErrorMessage(payload: unknown): string | undefined {
  const record = pickRecord(payload);
  if (!record) return undefined;

  if (typeof record.error === "string" && record.error.trim()) {
    return record.error.trim();
  }

  const nestedError = pickRecord(record.error);
  if (nestedError) {
    const nestedMessage = asString(nestedError.message) || asString(nestedError.error);
    if (nestedMessage) return nestedMessage;
  }

  return asString(record.message);
}

export function buildArchestraAgentChatUrl(agentId: string) {
  return `${ARCHESTRA_CHAT_BASE_URL}/chat/new?agent_id=${encodeURIComponent(agentId)}`;
}

export function getArchestraBaseUrl() {
  return ARCHESTRA_BASE_URL;
}

export function getArchestraAgentId() {
  return ARCHESTRA_AGENT_ID;
}

export async function createArchestraConversation() {
  if (!ARCHESTRA_AGENT_ID) {
    throw new Error(
      "ARCHESTRA_AGENT_ID is not configured. Set it in control-center/.env.local and restart the frontend.",
    );
  }

  return {
    conversationId: ARCHESTRA_AGENT_ID,
    chatUrl: buildArchestraAgentChatUrl(ARCHESTRA_AGENT_ID),
    raw: {
      mode: "a2a",
      agentId: ARCHESTRA_AGENT_ID,
      baseUrl: ARCHESTRA_BASE_URL,
    },
  };
}
