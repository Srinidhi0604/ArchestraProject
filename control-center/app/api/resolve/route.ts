import {
  getArchestraAgentId,
} from "./_archestra";
import { fetchMcpSystemsCatalog, resolveCanonicalSystemId } from "./_mcp";

// ---------------------------------------------------------------------------
// POST /api/resolve
//
// Lightweight endpoint: resolves the canonical MCP system_id from the
// frontend asset_id and returns the Archestra agent_id so the frontend can
// build the chat URL and orchestration prompt.  No A2A message/send — all
// execution is triggered by the user pasting the prompt into Archestra chat.
// ---------------------------------------------------------------------------

export async function POST(req: Request) {
  try {
    let body: {
      asset_id?: string;
      system_type?: string;
    };
    try {
      body = (await req.json()) as { asset_id?: string; system_type?: string };
    } catch (jsonError) {
      const err = jsonError instanceof Error ? jsonError.message : String(jsonError);
      return Response.json(
        { success: false, error: `Invalid request JSON: ${err}` },
        { status: 400 },
      );
    }

    const assetId = body.asset_id || "unknown-asset";
    const systemType = body.system_type || "unknown-system-type";

    // Resolve the canonical MCP system_id
    let canonicalSystemId: string;
    try {
      const mcpSystems = await fetchMcpSystemsCatalog();
      const resolvedId = resolveCanonicalSystemId(assetId, systemType, mcpSystems);
      if (!resolvedId) {
        return Response.json(
          {
            success: false,
            error: `Unable to resolve MCP canonical system_id for '${assetId}'. Verify MCP get_systems includes this infrastructure system.`,
          },
          { status: 400 },
        );
      }
      canonicalSystemId = resolvedId;
    } catch (catalogError) {
      const message =
        catalogError instanceof Error
          ? catalogError.message
          : "Failed to load MCP systems catalog.";
      return Response.json({ success: false, error: message }, { status: 500 });
    }

    const agentId = getArchestraAgentId();

    return Response.json({
      success: true,
      canonicalSystemId,
      agentId: agentId || null,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
