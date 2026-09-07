import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { colorFor } from "@/hooks/useNetworkTopology";
import type { SignalingState } from "@/p2p/peer-connection-manager";
import type { PeerInfo } from "@/types/network";

interface TopBarProps {
  roomId: string;
  peerId: string;
  projectName: string;
  onRenameProject: (name: string) => void;
  peers: PeerInfo[];
  signalingState: SignalingState;
  onNewRoom: () => void;
}

const STATUS_LABEL: Record<SignalingState, string> = {
  connecting: "Connecting…",
  open: "Connected",
  reconnecting: "Reconnecting…",
  closed: "Disconnected",
};

const STATUS_TONE: Record<SignalingState, string> = {
  connecting: "text-gray-500",
  open: "text-gray-500",
  reconnecting: "text-amber-600",
  closed: "text-red-600",
};

export function TopBar({ roomId, peerId, projectName, onRenameProject, peers, signalingState, onNewRoom }: TopBarProps) {
  const [copied, setCopied] = useState(false);
  const [draftName, setDraftName] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraftName(projectName), [projectName]);

  const commitName = () => {
    const trimmed = draftName.trim();
    if (trimmed && trimmed !== projectName) onRenameProject(trimmed);
    else setDraftName(projectName);
  };

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4">
      <div
        role="img"
        aria-label="Editmame"
        title="Editmame"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-500 text-white"
      >
        <FilmIcon />
      </div>

      <div className="flex min-w-0 flex-col justify-center leading-tight">
        <input
          ref={inputRef}
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          onBlur={commitName}
          onKeyDown={(event) => {
            if (event.key === "Enter") inputRef.current?.blur();
            if (event.key === "Escape") setDraftName(projectName);
          }}
          size={Math.max(draftName.length, 4)}
          aria-label="Project name"
          className="-mx-1.5 max-w-[40vw] truncate rounded px-1.5 py-0.5 text-base font-medium text-gray-900 hover:bg-gray-100 focus:bg-white focus:outline focus:outline-2 focus:outline-accent-500"
        />
        <span data-testid="connection-status" className={`px-1.5 text-xs ${STATUS_TONE[signalingState]}`}>
          {STATUS_LABEL[signalingState]}
        </span>
      </div>

      <div className="flex-1" />

      <div
        className="flex items-center -space-x-2 pr-1"
        aria-label={`${peers.length + 1} people in this room`}
      >
        <Avatar label="You" color={colorFor(peerId)} />
        {peers.map((peer) => (
          <Avatar key={peer.peerId} label={peer.displayName} color={peer.color} />
        ))}
      </div>

      <button
        type="button"
        onClick={onNewRoom}
        className="rounded-full px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-100"
      >
        New room
      </button>
      <button
        type="button"
        onClick={handleShare}
        className="flex items-center gap-1.5 rounded-full bg-accent-500 px-4 py-1.5 text-sm font-medium text-white shadow-toolbar transition-colors hover:bg-accent-600"
      >
        <ShareIcon />
        {copied ? "Link copied" : "Share"}
      </button>

      <span className="hidden shrink-0 font-mono text-xs text-gray-400 lg:inline">room {roomId.slice(0, 8)}</span>
    </header>
  );
}

function FilmIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5">
      <rect x="3" y="4" width="14" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M3 7.5h14M3 12.5h14M7 4v3M7 13v3M13 4v3M13 13v3" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
      <path d="M14.5 12.3c-.6 0-1.1.2-1.5.6L7.9 10c0-.2.1-.3.1-.5s0-.3-.1-.5l5-2.9c.4.4 1 .6 1.6.6a2.3 2.3 0 1 0-2.3-2.3c0 .2 0 .3.1.5l-5 2.9a2.3 2.3 0 1 0 0 3.3l5.1 3c0 .1 0 .3 0 .4a2.2 2.2 0 1 0 2.2-2.2Z" />
    </svg>
  );
}
