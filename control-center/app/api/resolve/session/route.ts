// This endpoint is no longer needed — orchestration is triggered via
// human-in-the-loop (copy/paste prompt into Archestra chat).
// Kept as a stub so existing fetches don't 404 during transition.

export async function POST() {
  return Response.json(
    {
      success: false,
      error: "Session creation is no longer required. Use the orchestration prompt panel to copy the prompt and paste it into Archestra chat.",
    },
    { status: 410 },
  );
}
