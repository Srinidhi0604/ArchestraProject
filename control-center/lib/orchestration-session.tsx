"use client";

import { AgentTraceStep, OrchestrationState } from "@/lib/infrastructure";
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from "react";

export interface OrchestrationMetadata {
  schemaVersion?: number;
  conversationValid?: boolean;
  createdAt?: string;
  updatedAt?: string;
  systemId?: string;
  systemName?: string;
  archestraBaseUrl?: string;
  prePrompt?: string;
}

export interface OrchestrationSessionState {
  conversationId: string | null;
  runId: string | null;
  status: OrchestrationState;
  chatUrl: string | null;
  traceSteps: AgentTraceStep[];
  metadata: OrchestrationMetadata;
  error: string | null;
}

const STORAGE_KEY = "archestra.orchestration.session.v1";
const SESSION_SCHEMA_VERSION = 2;
const HOSTED_ARCHESTRA_CHAT_BASE_URL =
  process.env.NEXT_PUBLIC_ARCHESTRA_CHAT_BASE_URL?.trim() || "http://localhost:3000";

const initialState: OrchestrationSessionState = {
  conversationId: null,
  runId: null,
  status: "idle",
  chatUrl: null,
  traceSteps: [],
  metadata: {
    schemaVersion: SESSION_SCHEMA_VERSION,
    conversationValid: false,
  },
  error: null,
};

type Action =
  | { type: "hydrate"; payload: OrchestrationSessionState }
  | {
      type: "setConversation";
      payload: { conversationId: string; chatUrl?: string; archestraBaseUrl?: string };
    }
  | {
      type: "startRun";
      payload: { runId: string; systemId: string; systemName: string; prePrompt?: string };
    }
  | { type: "setStatus"; payload: OrchestrationState }
  | { type: "setTraceSteps"; payload: AgentTraceStep[] }
  | { type: "appendTraceStep"; payload: AgentTraceStep }
  | { type: "setError"; payload: string | null }
  | {
      type: "setSessionMeta";
      payload: Partial<Pick<OrchestrationSessionState, "chatUrl">> & {
        archestraBaseUrl?: string;
        prePrompt?: string;
      };
    }
  | { type: "markConversationInvalid" }
  | { type: "invalidateConversation" }
  | { type: "reset" };

function reducer(state: OrchestrationSessionState, action: Action): OrchestrationSessionState {
  const now = new Date().toISOString();

  switch (action.type) {
    case "hydrate":
      return action.payload;

    case "setConversation":
      return {
        ...state,
        conversationId: action.payload.conversationId,
        chatUrl: action.payload.chatUrl ?? state.chatUrl,
        metadata: {
          ...state.metadata,
          schemaVersion: SESSION_SCHEMA_VERSION,
          conversationValid: true,
          createdAt: state.metadata.createdAt ?? now,
          updatedAt: now,
          archestraBaseUrl: action.payload.archestraBaseUrl ?? state.metadata.archestraBaseUrl,
        },
        error: null,
      };

    case "startRun":
      return {
        ...state,
        runId: action.payload.runId,
        status: "resolving",
        traceSteps: [],
        metadata: {
          ...state.metadata,
          schemaVersion: SESSION_SCHEMA_VERSION,
          updatedAt: now,
          systemId: action.payload.systemId,
          systemName: action.payload.systemName,
          prePrompt: action.payload.prePrompt ?? state.metadata.prePrompt,
        },
        error: null,
      };

    case "setStatus":
      return {
        ...state,
        status: action.payload,
        metadata: { ...state.metadata, schemaVersion: SESSION_SCHEMA_VERSION, updatedAt: now },
      };

    case "setTraceSteps":
      return {
        ...state,
        traceSteps: action.payload,
        metadata: { ...state.metadata, schemaVersion: SESSION_SCHEMA_VERSION, updatedAt: now },
      };

    case "appendTraceStep":
      return {
        ...state,
        traceSteps: [...state.traceSteps, action.payload],
        metadata: { ...state.metadata, schemaVersion: SESSION_SCHEMA_VERSION, updatedAt: now },
      };

    case "setError":
      return {
        ...state,
        error: action.payload,
        status: action.payload ? "error" : state.status,
        metadata: { ...state.metadata, schemaVersion: SESSION_SCHEMA_VERSION, updatedAt: now },
      };

    case "setSessionMeta":
      return {
        ...state,
        chatUrl: action.payload.chatUrl ?? state.chatUrl,
        metadata: {
          ...state.metadata,
          schemaVersion: SESSION_SCHEMA_VERSION,
          updatedAt: now,
          archestraBaseUrl: action.payload.archestraBaseUrl ?? state.metadata.archestraBaseUrl,
          prePrompt: action.payload.prePrompt ?? state.metadata.prePrompt,
        },
      };

    case "markConversationInvalid":
      return {
        ...state,
        conversationId: null,
        chatUrl: null,
        runId: null,
        metadata: {
          ...state.metadata,
          schemaVersion: SESSION_SCHEMA_VERSION,
          updatedAt: now,
          conversationValid: false,
        },
      };

    case "invalidateConversation":
      return {
        ...state,
        conversationId: null,
        chatUrl: null,
        runId: null,
        status: "idle",
        traceSteps: [],
        error: null,
        metadata: {
          ...state.metadata,
          schemaVersion: SESSION_SCHEMA_VERSION,
          conversationValid: false,
          updatedAt: now,
        },
      };

    case "reset":
      return initialState;

    default:
      return state;
  }
}

interface OrchestrationSessionContextValue {
  state: OrchestrationSessionState;
  actions: {
    setConversation: (payload: { conversationId: string; chatUrl?: string; archestraBaseUrl?: string }) => void;
    startRun: (payload: { runId: string; systemId: string; systemName: string; prePrompt?: string }) => void;
    setStatus: (status: OrchestrationState) => void;
    setTraceSteps: (steps: AgentTraceStep[]) => void;
    appendTraceStep: (step: AgentTraceStep) => void;
    setError: (error: string | null) => void;
    setSessionMeta: (payload: { chatUrl?: string; archestraBaseUrl?: string; prePrompt?: string }) => void;
    markConversationInvalid: () => void;
    invalidateConversation: () => void;
    reset: () => void;
  };
}

const OrchestrationSessionContext = createContext<OrchestrationSessionContextValue | null>(null);

export function OrchestrationSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw) as OrchestrationSessionState;
      if (parsed && typeof parsed === "object") {
        if (parsed.metadata?.schemaVersion !== SESSION_SCHEMA_VERSION) {
          window.sessionStorage.removeItem(STORAGE_KEY);
          return;
        }
        dispatch({ type: "hydrate", payload: parsed });
      }
    } catch {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const actions = useMemo(
    () => ({
      setConversation: (payload: { conversationId: string; chatUrl?: string; archestraBaseUrl?: string }) =>
        dispatch({ type: "setConversation", payload }),
      startRun: (payload: { runId: string; systemId: string; systemName: string; prePrompt?: string }) =>
        dispatch({ type: "startRun", payload }),
      setStatus: (status: OrchestrationState) => dispatch({ type: "setStatus", payload: status }),
      setTraceSteps: (steps: AgentTraceStep[]) => dispatch({ type: "setTraceSteps", payload: steps }),
      appendTraceStep: (step: AgentTraceStep) => dispatch({ type: "appendTraceStep", payload: step }),
      setError: (error: string | null) => dispatch({ type: "setError", payload: error }),
      setSessionMeta: (payload: { chatUrl?: string; archestraBaseUrl?: string; prePrompt?: string }) =>
        dispatch({ type: "setSessionMeta", payload }),
      markConversationInvalid: () => dispatch({ type: "markConversationInvalid" }),
      invalidateConversation: () => dispatch({ type: "invalidateConversation" }),
      reset: () => dispatch({ type: "reset" }),
    }),
    [],
  );

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return (
    <OrchestrationSessionContext.Provider value={value}>
      {children}
    </OrchestrationSessionContext.Provider>
  );
}

export function useOrchestrationSession() {
  const context = useContext(OrchestrationSessionContext);
  if (!context) {
    throw new Error("useOrchestrationSession must be used within OrchestrationSessionProvider");
  }
  return context;
}

export function buildHostedArchestraConversationUrl(conversationId: string) {
  return `${HOSTED_ARCHESTRA_CHAT_BASE_URL}/chat/new?agent_id=${encodeURIComponent(conversationId)}`;
}
