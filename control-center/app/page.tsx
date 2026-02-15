"use client";

import { MapView } from "@/components/MapView";
import { IncidentPanel } from "@/components/IncidentPanel";
import { OrchestrationPhase } from "@/components/OrchestrationStatus";
import { StatusBar } from "@/components/StatusBar";
import { SystemInfoPanel } from "@/components/SystemInfoPanel";
import {
  resolveInfrastructureIssue,
  toCanonicalSystemId,
} from "@/lib/archestra";
import {
  InfrastructureSystem,
  OrchestrationState,
  evolveSystems,
  getInitialSystems,
} from "@/lib/infrastructure";
import { DEMO_SYSTEM_ID } from "@/lib/systemRegistry";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";

export default function HomePage() {
  const [systems, setSystems] = useState<InfrastructureSystem[]>(getInitialSystems);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(DEMO_SYSTEM_ID);
  const [resolvedSystemId, setResolvedSystemId] = useState<string | undefined>();
  const [resolvingSystemId, setResolvingSystemId] = useState<string | undefined>();
  const [isResolving, setIsResolving] = useState(false);
  const [orchestrationPhase, setOrchestrationPhase] = useState<OrchestrationPhase | null>(null);
  const [lifecycleState, setLifecycleState] = useState<OrchestrationState>("idle");
  const orchestrationTimersRef = useRef<number[]>([]);

  const selectedSystem = useMemo(
    () =>
      selectedSystemId
        ? systems.find((s) => toCanonicalSystemId(s.id) === selectedSystemId) ?? null
        : null,
    [selectedSystemId, systems],
  );

  useEffect(() => {
    const t = window.setInterval(() => setSystems((p) => evolveSystems(p)), 2000);
    return () => window.clearInterval(t);
  }, []);

  const handleSelectSystem = useCallback((id: string) => {
    setSelectedSystemId(toCanonicalSystemId(id));
  }, []);

  const handleDeselectSystem = useCallback(() => {
    setSelectedSystemId(null);
  }, []);

  const clearOrchestrationTimers = useCallback(() => {
    orchestrationTimersRef.current.forEach((id) => window.clearTimeout(id));
    orchestrationTimersRef.current = [];
  }, []);

  const startOrchestrationStatus = useCallback(() => {
    clearOrchestrationTimers();
    setOrchestrationPhase("monitoring");
    setLifecycleState("resolving");

    orchestrationTimersRef.current.push(
      window.setTimeout(() => {
        setOrchestrationPhase("risk");
        setLifecycleState("agents_running");
      }, 1100),
      window.setTimeout(() => setOrchestrationPhase("action"), 2400),
    );
  }, [clearOrchestrationTimers]);

  const handleResolveIssue = useCallback(async (system: InfrastructureSystem) => {
    const canonicalId = toCanonicalSystemId(system.id);
    setIsResolving(true);
    setResolvingSystemId(canonicalId);
    startOrchestrationStatus();

    try {
      await resolveInfrastructureIssue(system.id);
      toast.success("Master orchestration started in Archestra chat.");
      setResolvedSystemId(canonicalId);
      setResolvingSystemId(undefined);
      clearOrchestrationTimers();
      setOrchestrationPhase("stabilized");
      setLifecycleState("resolved");
      orchestrationTimersRef.current.push(
        window.setTimeout(() => {
          setOrchestrationPhase(null);
          setLifecycleState("idle");
        }, 4000),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to resolve issue";
      toast.error(message);
      clearOrchestrationTimers();
      setOrchestrationPhase(null);
      setResolvingSystemId(undefined);
      setLifecycleState("error");
      orchestrationTimersRef.current.push(
        window.setTimeout(() => setLifecycleState("idle"), 3000),
      );
    } finally {
      setIsResolving(false);
    }
  }, [clearOrchestrationTimers, startOrchestrationStatus]);

  useEffect(() => {
    if (!resolvedSystemId) return;
    const t = window.setTimeout(() => setResolvedSystemId(undefined), 6000);
    return () => window.clearTimeout(t);
  }, [resolvedSystemId]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black">
      <MapView
        systems={systems}
        selectedSystemId={selectedSystemId}
        resolvedSystemId={resolvedSystemId}
        resolvingSystemId={resolvingSystemId}
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

      <StatusBar systems={systems} lifecycleState={lifecycleState} />

      <IncidentPanel
        systems={systems}
        selectedSystemId={selectedSystemId}
        resolvedSystemId={resolvedSystemId}
        onSelectSystem={handleSelectSystem}
      />

      <AnimatePresence mode="wait">
        {selectedSystem && (
          <SystemInfoPanel
            key={selectedSystem.id}
            system={selectedSystem}
            isResolving={isResolving}
            orchestrationPhase={orchestrationPhase}
            onResolve={() => handleResolveIssue(selectedSystem)}
            onClose={handleDeselectSystem}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
