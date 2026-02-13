import { randomUUID } from "crypto";
import {
  buildArchestraAgentChatUrl,
  extractUpstreamErrorMessage,
  getArchestraAgentId,
  getArchestraBaseUrl,
} from "./_archestra";

const ARCHESTRA_BASE_URL = getArchestraBaseUrl();

function getArchestraApiToken() {
  return process.env.ARCHESTRA_API_TOKEN?.trim();
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function extractA2aText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;

  const direct =
    asString(record.output) ||
    asString(record.response) ||
    asString(record.content) ||
    asString(record.text) ||
    asString(record.message);
  if (direct) return direct;

  const result =
    record.result && typeof record.result === "object"
      ? (record.result as Record<string, unknown>)
      : undefined;
  if (result) {
    const nestedDirect =
      asString(result.output) ||
      asString(result.response) ||
      asString(result.content) ||
      asString(result.text) ||
      asString(result.message);
    if (nestedDirect) return nestedDirect;

    const message =
      result.message && typeof result.message === "object"
        ? (result.message as Record<string, unknown>)
        : undefined;
    if (message) {
      const parts = Array.isArray(message.parts) ? (message.parts as unknown[]) : [];
      for (const part of parts) {
        if (part && typeof part === "object") {
          const partRecord = part as Record<string, unknown>;
          const partText = asString(partRecord.text) || asString(partRecord.content);
          if (partText) return partText;
        }
      }
      const messageContent = asString(message.content) || asString(message.text);
      if (messageContent) return messageContent;
    }
  }

  return undefined;
}

function extractJsonRpcError(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") return undefined;
  const record = payload as Record<string, unknown>;
  const errorRecord =
    record.error && typeof record.error === "object"
      ? (record.error as Record<string, unknown>)
      : undefined;
  if (!errorRecord) return undefined;

  return asString(errorRecord.message) || asString(errorRecord.error);
}

export async function POST(req: Request) {
  try {
    let body: { system_name?: string };
    try {
      body = (await req.json()) as { system_name?: string };
    } catch (jsonError) {
      const err = jsonError instanceof Error ? jsonError.message : String(jsonError);
      return Response.json(
        {
          success: false,
          error: `Invalid request JSON: ${err}`,
          degraded: false,
        },
        { status: 400 },
      );
    }

    const systemName = body.system_name || "Unknown system";
    const agentId = getArchestraAgentId();
    const archestraApiToken = getArchestraApiToken();
    if (!agentId) {
      return Response.json(
        {
          success: false,
          error: "ARCHESTRA_AGENT_ID is required. Set it in control-center/.env.local and restart the frontend.",
          degraded: false,
        },
        { status: 400 },
      );
    }

    if (!archestraApiToken) {
      return Response.json(
        {
          success: false,
          error: "ARCHESTRA_API_TOKEN is not loaded by the server. Confirm control-center/.env.local and restart the Next.js process.",
          degraded: false,
        },
        { status: 500 },
      );
    }

    void req;

    const orchestrationPrompt = `
Resolve infrastructure issue at ${systemName}.

Analyze telemetry.
Evaluate system risk.
Coordinate Forecast, Monitoring, Safety, and Operations agents.
Execute corrective action if safe.
Return diagnosis, risk level, and execution plan.
`;

    const runId = randomUUID();
    const requestId = randomUUID();

    const a2aResponse = await fetch(`${ARCHESTRA_BASE_URL}/${encodeURIComponent(agentId)}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(archestraApiToken
          ? { Authorization: `Bearer ${archestraApiToken}` }
          : {}),
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: requestId,
        method: "message/send",
        params: {
          metadata: {
            source: "control-center",
            runId,
            systemName,
          },
          message: {
            role: "user",
            parts: [
              {
                kind: "text",
                text: orchestrationPrompt.trim(),
              },
            ],
          },
        },
      }),
      signal: AbortSignal.timeout(15000),
      cache: "no-store",
    });

    const responseContentType = a2aResponse.headers.get("content-type") ?? "";
    const isJson = responseContentType.includes("application/json");
    const rawTextBody = await a2aResponse.text();
    let rawBody: unknown = rawTextBody;

    if (isJson) {
      try {
        rawBody = JSON.parse(rawTextBody);
      } catch {
        rawBody = rawTextBody;
      }
    }

    if (!a2aResponse.ok) {
      const upstreamError =
        typeof rawBody === "string"
          ? rawBody
          : extractUpstreamErrorMessage(rawBody) || JSON.stringify(rawBody);
      throw new Error(
        `Archestra A2A request failed (${a2aResponse.status}): ${upstreamError || a2aResponse.statusText}`,
      );
    }

    const jsonRpcError = extractJsonRpcError(rawBody);
    if (jsonRpcError) {
      throw new Error(`Archestra A2A error: ${jsonRpcError}`);
    }

    const orchestration =
      typeof rawBody === "string"
        ? rawBody
        : extractA2aText(rawBody) || JSON.stringify(rawBody);
    const chatUrl = buildArchestraAgentChatUrl(agentId);

    return Response.json({
      success: true,
      orchestration,
      conversationId: agentId,
      sessionId: agentId,
      runId,
      chatUrl,
      prePrompt: orchestrationPrompt.trim(),
      archestraBaseUrl: ARCHESTRA_BASE_URL,
      degraded: false,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown orchestration error",
        degraded: false,
      },
      { status: 500 }
    );
  }
}
