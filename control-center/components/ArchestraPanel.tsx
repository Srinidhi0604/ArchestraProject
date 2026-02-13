"use client";

import { motion } from "framer-motion";

export type OrchestrationBadgeState =
  | "active"
  | "recovering"
  | "restored"
  | "complete";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ArchestraPanelProps {
  conversationId?: string;
  runId?: string;
  sessionId?: string;
  chatUrl?: string;
  prePrompt?: string;
  statusLabel?: string;
  badgeState?: OrchestrationBadgeState;
  onOpenChat: () => void;
  onCopyPrompt: () => void;
  onClose: () => void;
}

function getBadgeConfig(state: OrchestrationBadgeState) {
  if (state === "recovering") {
    return {
      label: "Recovering session…",
      dotClassName: "bg-[#ff9500]",
      textClassName: "text-[#ff9500]",
    };
  }

  if (state === "restored") {
    return {
      label: "Session restored",
      dotClassName: "bg-[#00bbff]",
      textClassName: "text-[#00bbff]",
    };
  }

  if (state === "complete") {
    return {
      label: "Autonomous resolution complete",
      dotClassName: "bg-[#00ff88]",
      textClassName: "text-[#00ff88]",
    };
  }

  return {
    label: "Orchestration Active",
    dotClassName: "bg-[#00bbff]",
    textClassName: "text-[#00bbff]",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ArchestraPanel({
  conversationId,
  runId,
  sessionId,
  chatUrl,
  prePrompt,
  statusLabel,
  badgeState = "active",
  onOpenChat,
  onCopyPrompt,
  onClose,
}: ArchestraPanelProps) {
  const activeConversationId = conversationId || sessionId;
  const canOpenChat = Boolean(chatUrl && activeConversationId);
  const badge = getBadgeConfig(badgeState);

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      className="glass-panel fixed bottom-6 right-6 z-20 w-[310px]"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
            Archestra Bridge
          </h3>
          <p className="mt-0.5 text-[10px] font-medium text-[#00bbff]">
            {statusLabel ?? "Session Active"}
          </p>
          <div className={`mt-1.5 flex items-center gap-1.5 text-[10px] font-medium ${badge.textClassName}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${badge.dotClassName}`} />
            <span>{badge.label}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-center rounded-full text-control-muted transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M1 1L9 9M9 1L1 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      {/* Session info */}
      <div className="space-y-1.5 px-5 py-3 text-[11px]">
        <div className="flex justify-between">
          <span className="text-control-muted">Conversation</span>
          <span className="max-w-[170px] truncate font-mono text-white">
            {activeConversationId ?? "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-control-muted">Run</span>
          <span className="max-w-[170px] truncate font-mono text-white">
            {runId ?? "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-control-muted">Chat</span>
          {chatUrl ? (
            <a
              href={chatUrl}
              target="_blank"
              rel="noreferrer"
              className="max-w-[170px] truncate text-[#00bbff] underline"
            >
              Open conversation
            </a>
          ) : (
            <span className="max-w-[170px] truncate text-white">—</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-white/[0.06] px-5 py-3">
        <button
          type="button"
          onClick={onOpenChat}
          disabled={!canOpenChat}
          className="flex-1 rounded-lg border border-[#00bbff]/30 bg-[#00bbff]/15 px-3 py-2 text-xs font-semibold text-[#00bbff] transition-colors hover:bg-[#00bbff]/25"
        >
          Open Chat
        </button>
        <button
          type="button"
          onClick={onCopyPrompt}
          disabled={!prePrompt}
          className="flex-1 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-control-text transition-colors hover:bg-white/5"
        >
          Copy Prompt
        </button>
      </div>
    </motion.div>
  );
}
