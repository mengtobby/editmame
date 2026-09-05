import type { NetworkTopologyState } from "@/hooks/useNetworkTopology";

interface NetworkPanelProps extends NetworkTopologyState {
  selfPeerId: string;
}

function formatBytesPerSec(bytes: number): string {
  if (bytes < 1024) return `${bytes} B/s`;
  return `${(bytes / 1024).toFixed(1)} KB/s`;
}

export function NetworkPanel({ peers, throughput, recentExchanges, selfPeerId }: NetworkPanelProps) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-neutral-800 bg-surface-900">
      <div className="border-b border-neutral-800 px-3 py-2.5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Network Topology</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 scrollbar-thin">
        <PeerNode label="You" color="#818cf8" peerId={selfPeerId} />

        {peers.length === 0 && (
          <p className="mt-3 text-xs leading-relaxed text-neutral-600">
            No peers connected yet. Share the collaboration link to invite someone.
          </p>
        )}

        {peers.map((peer) => {
          const sample = throughput.get(peer.peerId);
          return (
            <div key={peer.peerId} className="mt-3">
              <PeerNode label={peer.displayName} color={peer.color} peerId={peer.peerId} />
              <div className="ml-4 mt-1 flex gap-3 pl-0.5 text-[11px] text-neutral-500">
                <span>↑ {formatBytesPerSec(sample?.bytesUpPerSec ?? 0)}</span>
                <span>↓ {formatBytesPerSec(sample?.bytesDownPerSec ?? 0)}</span>
              </div>
            </div>
          );
        })}

        <h3 className="mb-1.5 mt-5 text-[11px] font-semibold uppercase tracking-wide text-neutral-600">
          Chunk Exchange
        </h3>
        <div className="space-y-1">
          {recentExchanges.length === 0 && <p className="text-xs text-neutral-700">No chunk activity yet.</p>}
          {recentExchanges.map((event, i) => (
            <div key={`${event.timestampMs}-${i}`} className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              <span className={event.direction === "upload" ? "text-emerald-400" : "text-sky-400"}>
                {event.direction === "upload" ? "↑" : "↓"}
              </span>
              <span className="truncate">
                chunk #{event.chunkIndex} · {event.assetHash.slice(0, 6)} · {event.peerId.slice(0, 6)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function PeerNode({ label, color, peerId }: { label: string; color: string; peerId: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs text-neutral-300">{label}</span>
      <span className="font-mono text-[10px] text-neutral-600">{peerId.slice(0, 6)}</span>
    </div>
  );
}
