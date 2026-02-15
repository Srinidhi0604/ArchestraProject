export interface BuildPromptInput {
  systemId: string;
  systemName: string;
  systemType: string;
  location?: string;
  status?: string;
  riskScore?: number;
  telemetry?: {
    loadPercent?: number;
    temperature?: number;
    voltage?: number;
    current?: number;
  };
}

const PROMPT_MODE =
  process.env.NEXT_PUBLIC_ORCHESTRATION_PROMPT_MODE?.trim().toLowerCase() || "compact";

function buildDetectedCondition(input: BuildPromptInput): string {
  const lines: string[] = [];

  if (input.status === "critical") {
    lines.push(
      `System "${input.systemName}" is in CRITICAL state requiring immediate intervention.`,
    );
  } else if (input.status === "risk") {
    lines.push(`System "${input.systemName}" shows elevated risk conditions.`);
  } else {
    lines.push(`System "${input.systemName}" has been flagged for evaluation.`);
  }

  if (input.riskScore !== undefined) {
    lines.push(`Risk score: ${input.riskScore}/100`);
  }

  if (input.telemetry) {
    const t = input.telemetry;
    if (t.loadPercent !== undefined) lines.push(`Load: ${t.loadPercent}%`);
    if (t.temperature !== undefined) lines.push(`Temperature: ${t.temperature}°C`);
    if (t.voltage !== undefined) lines.push(`Voltage: ${t.voltage}V`);
    if (t.current !== undefined) lines.push(`Current: ${t.current}A`);
  }

  return lines.join("\n");
}

export function buildOrchestrationPrompt(input: BuildPromptInput): string {
  const detectedCondition = buildDetectedCondition(input);

  if (PROMPT_MODE === "compact") {
    return `Infrastructure orchestration request:

System ID: ${input.systemId}
System Type: ${input.systemType}
Location: ${input.location || "Not specified"}
Current Status: ${input.status || "unknown"}

Detected condition:
${detectedCondition}

Execution constraints:
- Operate only on System ID ${input.systemId}
- Do not call get_systems for full registry analysis
- No forecasting, simulation expansion, or unrelated analysis
- Maximum 4 tool calls for this run

Required tool sequence:
1. get_system_state("${input.systemId}")
2. evaluate_system_risk("${input.systemId}")
3. If mitigation required: execute_control_action("${input.systemId}", action_type, parameters)
4. get_system_state("${input.systemId}") for verification

Return a concise execution report with:
- state retrieved
- risk evaluation
- mitigation action (if executed)
- verification result
- final system status

Keep response concise and resolution-focused.`;
  }

  return `Infrastructure orchestration request:

System ID: ${input.systemId}
System Type: ${input.systemType}
System Name: ${input.systemName}
Location: ${input.location || "Not specified"}
Current Status: ${input.status || "unknown"}
Risk Score: ${input.riskScore ?? "unknown"}

Detected condition:
${detectedCondition}

Tasks:
1. Retrieve system state using MCP tools: get_system_state("${input.systemId}")
2. Evaluate system risk and identify affected components: evaluate_system_risk("${input.systemId}")
3. Execute appropriate mitigation actions using MCP tools: execute_control_action("${input.systemId}", action_type, parameters)
4. Verify updated system state after mitigation: get_system_state("${input.systemId}")
5. Provide detailed execution report including tool calls and state transitions

Execution constraints:
- Scope strictly to system_id ${input.systemId}
- Avoid full-registry analysis unless explicitly requested
- Avoid forecasting or extended scenario modeling
- Avoid redundant or repeated tool calls

Show all tool calls, actions taken, and final system status.`;
}