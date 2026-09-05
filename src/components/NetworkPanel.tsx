import { Avatar } from "@/components/Avatar";
import { colorFor } from "@/hooks/useNetworkTopology";
import type { NetworkTopologyState } from "@/hooks/useNetworkTopology";

interface NetworkPanelProps extends NetworkTopologyState {
  selfPeerId: string;
}

function formatBytesPerSec(bytes: number): string {
  if (bytes < 1024) return `${Math.round(bytes)} B/s`;
  return `${(bytes / 1024).toFixed(1)} KB/s`;
}

export function NetworkPanel({ peers, throughput, recentExchanges, selfPeerId }: NetworkPanelProps) {
  return (
    <aside className="hidden h-full w-72 shrink-0 flex-col border-l border-gray-200 bg-white lg:flex">
      <div className="border-b border-gray-200 px-4 py-3">
        <h2 className="text-sm font-medium text-gray-900">People</h2>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">
          Footage streams directly between browsers — nothing passes through a server.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        <div className="space-y-3 px-4 py-3">
          <PeerRow label="You" color={colorFor(selfPeerId)} peerId={selfPeerId} isSelf />

          {peers.length === 0 && (
            <p className="text-xs leading-relaxed text-gray-400">
              No one else is here yet. Click Share to invite a collaborator.
            </p>
          )}

          {peers.map((peer) => {
            const sample = throughput.get(peer.peerId);
            return (
              <PeerRow
                key={peer.peerId}
                label={peer.displayName}
                color={peer.color}
                peerId={peer.peerId}
                throughputUp={sample?.bytesUpPerSec ?? 0}
                throughputDown={sample?.bytesDownPerSec ?? 0}
              />
            );
          })}
        </div>

        <div className="border-t border-gray-100 px-4 py-3">
          <h3 className="text-xs font-medium text-gray-500">Media transfers</h3>
          <div className="mt-2 space-y-1.5">
            {recentExchanges.length === 0 && <p className="text-xs text-gray-400">No transfers yet.</p>}
            {recentExchanges.map((event, i) => (
              <div key={`${event.timestampMs}-${i}`} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={event.direction === "upload" ? "text-clip-audio-dark" : "text-accent-600"}>
                  {event.direction === "upload" ? "↑" : "↓"}
                </span>
                <span className="truncate font-mono text-[11px]">
                  chunk #{event.chunkIndex} · {event.assetHash.slice(0, 6)} · {event.peerId.slice(0, 6)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

interface PeerRowProps {
  label: string;
  color: string;
  peerId: string;
  isSelf?: boolean;
  throughputUp?: number;
  throughputDown?: number;
}

function PeerRow({ label, color, peerId, isSelf, throughputUp, throughputDown }: PeerRowProps) {
  return (
    <div className="flex items-center gap-2.5">
      <Avatar label={label} color={color} size="sm" ring={false} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <span className="truncate text-sm text-gray-800">{label}</span>
          <span className="shrink-0 font-mono text-[10px] text-gray-400">{peerId.slice(0, 6)}</span>
        </div>
        {!isSelf && (
          <div className="flex gap-3 text-[11px] text-gray-400">
            <span>↑ {formatBytesPerSec(throughputUp ?? 0)}</span>
            <span>↓ {formatBytesPerSec(throughputDown ?? 0)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
