"use client";

import { useMutation } from "@tanstack/react-query";
import { AgentTracePanel } from "@/components/AgentTracePanel";
import { ArchestraPanel } from "@/components/ArchestraPanel";
import type { OrchestrationBadgeState } from "@/components/ArchestraPanel";
import { MapView } from "@/components/MapView";
import { SolutionPanel } from "@/components/SolutionPanel";
import { StatusBar } from "@/components/StatusBar";
import { SystemInfoPanel } from "@/components/SystemInfoPanel";
import {
  createOrchestrationConversation,
  isConversationNotFoundError,
  resolveInfrastructureIssue,
} from "@/lib/archestra";
import {
  InfrastructureSystem,
  SolutionPayload,
  Telemetry,
  evolveSystems,
  getInitialSystems,
} from "@/lib/infrastructure";
import {
  buildHostedArchestraConversationUrl,
  useOrchestrationSession,
} from "@/lib/orchestration-session";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

interface TelemetryPoint extends Telemetry {
  tick: string;
}

const traceTemplates = [
  { agent: "Master Orchestration Agent", detail: "Coordinating multi-agent workflow" },
  { agent: "Forecast Agent", detail: "Predicted demand spike in sector" },
  { agent: "Risk Agent", detail: "Identified overload risk pattern" },
  { agent: "Operations Agent", detail: "Proposed load reroute strategy" },
  { agent: "Monitoring Agent", detail: "Real-time stability verification" },
  { agent: "Safety Agent", detail: "Safety parameters validated" },
];

function nowTick() {
  return new Date().toLocaleTimeString("en-IN", { hour12: false });
}

export default function HomePage() {
  const [systems, setSystems] = useState<InfrastructureSystem[]>(getInitialSystems);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [solution, setSolution] = useState<SolutionPayload | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<TelemetryPoint[]>([]);
  const [resolvedSystemId, setResolvedSystemId] = useState<string | undefined>();
  const [authError, setAuthError] = useState<string | null>(null);

  const [showAgentTrace, setShowAgentTrace] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [showArchestraBridge, setShowArchestraBridge] = useState(false);
  const [bridgeBadgeState, setBridgeBadgeState] = useState<OrchestrationBadgeState>("active");

  const { state: session, actions } = useOrchestrationSession();

  const selectedSystem = useMemo(
    () => (selectedSystemId ? systems.find((s) => s.id === selectedSystemId) ?? null : null),
    [selectedSystemId, systems],
  );

  useEffect(() => {
    const t = window.setInterval(() => setSystems((p) => evolveSystems(p)), 5000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selectedSystem) return;
    setTelemetryHistory((prev) => {
      const next = [...prev, { tick: nowTick(), ...selectedSystem.telemetry }];
      return next.slice(-25);
    });
  }, [selectedSystem]);

  const ensureConversation = useCallback(async () => {
    if (session.conversationId) {
      const fallbackChatUrl = buildHostedArchestraConversationUrl(session.conversationId);
      const activeChatUrl = session.chatUrl || fallbackChatUrl;

      if (!session.chatUrl) {
        actions.setSessionMeta({ chatUrl: activeChatUrl });
      }

      return {
        conversationId: session.conversationId,
        chatUrl: activeChatUrl,
      };
    }

    const created = await createOrchestrationConversation();

    actions.setConversation({
      conversationId: created.conversationId,
      chatUrl: created.chatUrl,
      archestraBaseUrl: created.archestraBaseUrl,
    });

    return {
      conversationId: created.conversationId,
      chatUrl: created.chatUrl,
    };
  }, [actions, session.chatUrl, session.conversationId]);

  const openArchestraChat = useCallback(
    (chatUrl?: string) => {
      const target =
        chatUrl ||
        session.chatUrl ||
        (session.conversationId
          ? buildHostedArchestraConversationUrl(session.conversationId)
          : undefined);
      if (!target) {
        toast.error("No active Archestra conversation yet.");
        return;
      }
      const popup = window.open(target, "_blank", "noopener,noreferrer");
      if (!popup) toast.error("Popup blocked — use the chat link in Archestra panel.");
    },
    [session.chatUrl, session.conversationId],
  );

  const copyPrompt = useCallback(async () => {
    const prompt = session.metadata.prePrompt;
    if (!prompt) {
      toast.error("No orchestration prompt available yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(prompt);
      toast.success("Prompt copied to clipboard.");
    } catch {
      toast.error("Clipboard access failed.");
    }
  }, [session.metadata.prePrompt]);

  const handleSelectSystem = useCallback((id: string) => {
    setSelectedSystemId(id);
    setTelemetryHistory([]);
  }, []);

  const handleDeselectSystem = useCallback(() => {
    setSelectedSystemId(null);
  }, []);

  const resolveMutation = useMutation({
    mutationFn: async (system: InfrastructureSystem) => {
      const created = await ensureConversation();
      try {
        return await resolveInfrastructureIssue(system, created.conversationId);
      } catch (error) {
        if (!isConversationNotFoundError(error)) {
          throw error;
        }

        setBridgeBadgeState("recovering");
        actions.markConversationInvalid();

        const recreated = await createOrchestrationConversation();
        actions.setConversation({
          conversationId: recreated.conversationId,
          chatUrl: recreated.chatUrl,
          archestraBaseUrl: recreated.archestraBaseUrl,
        });

        const retried = await resolveInfrastructureIssue(system, recreated.conversationId);
        setBridgeBadgeState("restored");
        return retried;
      }
    },
    retry: (failureCount, error) => {
      const m = error instanceof Error ? error.message.toLowerCase() : "";
      if (m.includes("401") || m.includes("sign in") || m.includes("session")) return false;
      return failureCount < 1;
    },
    onMutate: async (system) => {
      const prev = systems;
      setAuthError(null);
      setSolution(null);
      setBridgeBadgeState("active");
      actions.setError(null);
      actions.setTraceSteps([]);
      actions.setStatus("resolving");
      setShowAgentTrace(true);
      setShowSolution(false);
      setShowArchestraBridge(true);

      setSystems((cur) =>
        cur.map((s) =>
          s.id === system.id && s.status === "critical"
            ? { ...s, status: "risk", risk_score: Math.max(65, s.risk_score - 12) }
            : s,
        ),
      );
      return { prev };
    },
    onSuccess: ({
      solution: nextSolution,
      conversationId,
      runId,
      chatUrl,
      prePrompt,
      archestraBaseUrl,
    }) => {
      if (!conversationId) {
        actions.setError("Orchestration response did not include a valid conversation id.");
        setBridgeBadgeState("recovering");
        toast.error("Invalid orchestration session. Retry resolve to create a new session.");
        return;
      }

      const activeChatUrl =
        chatUrl ||
        session.chatUrl ||
        buildHostedArchestraConversationUrl(conversationId);

      actions.setConversation({
        conversationId,
        chatUrl: activeChatUrl,
        archestraBaseUrl,
      });
      actions.startRun({
        runId: runId ?? session.runId ?? `run-${Date.now()}`,
        systemId: selectedSystemId ?? "",
        systemName: selectedSystem?.name ?? "Unknown system",
        prePrompt,
      });
      actions.setSessionMeta({
        chatUrl: activeChatUrl,
        archestraBaseUrl,
        prePrompt,
      });
      actions.setStatus("solution_ready");

      setSolution(nextSolution);
      setShowSolution(true);
      setShowArchestraBridge(true);

      setSystems((cur) =>
        cur.map((s) =>
          s.id === selectedSystemId
            ? {
                ...s,
                status: "healthy",
                risk_score: Math.max(10, s.risk_score - 45),
                telemetry: {
                  ...s.telemetry,
                  load_percent: Math.max(35, s.telemetry.load_percent - 20),
                  temperature: Math.max(34, s.telemetry.temperature - 8),
                },
              }
            : s,
        ),
      );

      setResolvedSystemId(selectedSystemId ?? undefined);
      toast.success("Archestra orchestration complete");
      window.setTimeout(() => openArchestraChat(chatUrl), 700);
      window.setTimeout(() => {
        actions.setStatus("execution_complete");
        setBridgeBadgeState("complete");
      }, 900);
    },
    onError: (error, _vars, ctx) => {
      if (ctx?.prev) setSystems(ctx.prev);
      setBridgeBadgeState("active");
      const msg = error instanceof Error ? error.message : "Orchestration request failed.";
      actions.setError(msg);
      actions.setStatus("error");

      const lower = msg.toLowerCase();
      if (lower.includes("conversation not found") || lower.includes("404")) {
        actions.markConversationInvalid();
        setShowArchestraBridge(true);
      }

      if (lower.includes("session") || lower.includes("sign in") || lower.includes("401")) {
        setAuthError(msg);
      }
      if (lower.includes("authorization header required") || lower.includes("bearer")) {
        setAuthError("A2A authentication required. Set ARCHESTRA_API_TOKEN in control-center/.env.local.");
      }
      toast.error(msg);
    },
  });

  useEffect(() => {
    if (!resolvedSystemId) return;
    const t = window.setTimeout(() => setResolvedSystemId(undefined), 2500);
    return () => window.clearTimeout(t);
  }, [resolvedSystemId]);

  useEffect(() => {
    if (!resolveMutation.isPending) return;
    actions.setStatus("agents_running");
    const timeouts = traceTemplates.map((tmpl, i) =>
      window.setTimeout(() => {
        actions.appendTraceStep({ ...tmpl, timestamp: nowTick() });
      }, (i + 1) * 650),
    );
    return () => timeouts.forEach((t) => window.clearTimeout(t));
  }, [actions, resolveMutation.isPending]);

  const hasConversation = Boolean(session.conversationId);
  const isOrchestrating = session.status === "resolving" || session.status === "agents_running";
  const hasSolution = session.status === "solution_ready" || session.status === "execution_complete";

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <MapView
        systems={systems}
        selectedSystemId={selectedSystemId}
        resolvedSystemId={resolvedSystemId}
        onSelectSystem={handleSelectSystem}
        onDeselectSystem={handleDeselectSystem}
      />

      <div
        className="pointer-events-none fixed inset-0 z-[1]"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      <StatusBar systems={systems} lifecycleState={session.status} />

      <AnimatePresence>
        {authError && (
          <div className="glass-panel fixed left-1/2 top-5 z-30 -translate-x-1/2 border-[#ff3366]/20 px-5 py-3">
            <p className="text-xs text-[#ff3366]">{authError}</p>
            <p className="mt-1 text-[10px] text-control-muted">
              If your A2A runtime enforces auth, add ARCHESTRA_API_TOKEN in .env.local and restart.
            </p>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {selectedSystem && (
          <SystemInfoPanel
            key={selectedSystem.id}
            system={selectedSystem}
            history={telemetryHistory}
            isResolving={resolveMutation.isPending}
            onResolve={() => resolveMutation.mutate(selectedSystem)}
            onClose={handleDeselectSystem}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAgentTrace && (isOrchestrating || hasSolution) && session.traceSteps.length > 0 && (
          <AgentTracePanel
            key="agent-trace"
            steps={session.traceSteps}
            onClose={() => setShowAgentTrace(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSolution && hasSolution && solution && (
          <SolutionPanel
            key="solution"
            solution={solution}
            onClose={() => setShowSolution(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showArchestraBridge && hasConversation && (
          <ArchestraPanel
            key="archestra-bridge"
            conversationId={session.conversationId ?? undefined}
            runId={session.runId ?? undefined}
            sessionId={session.conversationId ?? undefined}
            chatUrl={
              session.chatUrl ??
              (session.conversationId
                ? buildHostedArchestraConversationUrl(session.conversationId)
                : undefined)
            }
            prePrompt={session.metadata.prePrompt}
            statusLabel={session.status.replace(/_/g, " ")}
            badgeState={bridgeBadgeState}
            onOpenChat={() => openArchestraChat()}
            onCopyPrompt={copyPrompt}
            onClose={() => setShowArchestraBridge(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
