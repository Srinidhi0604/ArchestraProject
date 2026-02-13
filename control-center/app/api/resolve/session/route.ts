import {
  createArchestraConversation,
  getArchestraBaseUrl,
} from "../_archestra";

export async function POST(req: Request) {
  try {
    void req;
    const conversation = await createArchestraConversation();

    return Response.json({
      success: true,
      conversationId: conversation.conversationId,
      chatUrl: conversation.chatUrl,
      archestraBaseUrl: getArchestraBaseUrl(),
      raw: conversation.raw,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown conversation creation error";
    const status = message.includes("ARCHESTRA_AGENT_ID is not configured") ? 400 : 500;

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status },
    );
  }
}
