import { useState } from "react";
import type { SignalingState } from "@/p2p/peer-connection-manager";

interface TopBarProps {
  roomId: string;
  peerCount: number;
  signalingState: SignalingState;
  onNewRoom: () => void;
}

const STATUS_STYLES: Record<SignalingState, { dot: string; label: string }> = {
  connecting: { dot: "bg-amber-400", label: "Connecting…" },
  open: { dot: "bg-emerald-400", label: "Connected" },
  reconnecting: { dot: "bg-amber-400 animate-pulse", label: "Reconnecting…" },
  closed: { dot: "bg-red-500", label: "Disconnected" },
};

export function TopBar({ roomId, peerCount, signalingState, onNewRoom }: TopBarProps) {
  const [copied, setCopied] = useState(false);
  const status = STATUS_STYLES[signalingState];

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-neutral-800 bg-surface-900 px-4">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold tracking-tight text-neutral-100">LoomP2P</span>
        <span className="flex items-center gap-1.5 rounded-full border border-neutral-800 bg-surface-950 px-2.5 py-1 text-xs text-neutral-400">
          <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />
          {status.label}
          {peerCount > 0 && <span className="text-neutral-600">· {peerCount} peer{peerCount === 1 ? "" : "s"}</span>}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden font-mono text-xs text-neutral-600 sm:inline">room {roomId.slice(0, 8)}</span>
        <button
          type="button"
          onClick={onNewRoom}
          className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 transition-colors hover:bg-neutral-800"
        >
          New Room
        </button>
        <button
          type="button"
          onClick={handleCopyLink}
          className="rounded-md bg-accent-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-accent-500"
        >
          {copied ? "Copied!" : "Copy Collaboration Link"}
        </button>
      </div>
    </header>
  );
}
