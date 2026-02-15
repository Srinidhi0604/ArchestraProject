const ARCHESTRA_AGENT_ID = process.env.ARCHESTRA_AGENT_ID?.trim();

export function getArchestraAgentId() {
  return ARCHESTRA_AGENT_ID;
}
