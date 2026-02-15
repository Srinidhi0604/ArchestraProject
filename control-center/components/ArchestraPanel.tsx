"use client";

import { motion } from "framer-motion";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface ArchestraPanelProps {
  prompt: string;
  systemName: string;
  onOpenChat: () => void;
  onCopyPrompt: () => void;
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function ArchestraPanel({
  prompt,
  systemName,
  onOpenChat,
  onCopyPrompt,
  onClose,
}: ArchestraPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 40 }}
      transition={{ type: "spring", damping: 26, stiffness: 300 }}
      className="glass-panel fixed bottom-6 right-6 z-20 w-[380px] max-h-[80vh] flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5 shrink-0">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-white">
            Orchestration Prompt
          </h3>
          <p className="mt-0.5 text-[10px] font-medium text-[#00bbff]">
            {systemName}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-[#00ff88]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#00ff88]" />
            <span>Copy prompt and paste into Archestra chat</span>
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

      {/* Prompt text */}
      <div className="flex-1 overflow-y-auto px-4 py-3 min-h-0">
        <pre className="whitespace-pre-wrap break-words rounded-lg bg-black/40 border border-white/[0.06] p-3 text-[11px] leading-relaxed text-white/85 font-mono">
          {prompt}
        </pre>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-t border-white/[0.06] px-5 py-3 shrink-0">
        <button
          type="button"
          onClick={onCopyPrompt}
          className="flex-1 rounded-lg border border-[#00ff88]/30 bg-[#00ff88]/15 px-3 py-2.5 text-xs font-semibold text-[#00ff88] transition-colors hover:bg-[#00ff88]/25 flex items-center justify-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy Prompt
        </button>
        <button
          type="button"
          onClick={onOpenChat}
          className="flex-1 rounded-lg border border-[#00bbff]/30 bg-[#00bbff]/15 px-3 py-2.5 text-xs font-semibold text-[#00bbff] transition-colors hover:bg-[#00bbff]/25 flex items-center justify-center gap-1.5"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
            <polyline points="15 3 21 3 21 9" />
            <line x1="10" y1="14" x2="21" y2="3" />
          </svg>
          Open Chat
        </button>
      </div>
    </motion.div>
  );
}
