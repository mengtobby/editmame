import { useEffect, useMemo, useState } from "react";
import { ImportButton } from "@/components/ImportButton";
import { NetworkPanel } from "@/components/NetworkPanel";
import { PreviewCanvas } from "@/components/PreviewCanvas";
import { Timeline } from "@/components/timeline/Timeline";
import { TopBar } from "@/components/TopBar";
import { useCollabRoom } from "@/hooks/useCollabRoom";
import { useNetworkTopology } from "@/hooks/useNetworkTopology";
import { usePlaybackWorker } from "@/hooks/usePlaybackWorker";
import { computeVisibleClips } from "@/playback/visible-clips";
import { stepFrameTimeUs } from "@/playback/timecode";

const MIN_TIMELINE_DURATION_US = 10_000_000;

function App() {
  const room = useCollabRoom();
  const playback = usePlaybackWorker();
  const topology = useNetworkTopology(room.manager, room.swarm, room.connectedPeerIds);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);

  const durationUs = useMemo(() => {
    const clipEnds = room.tracks.flatMap((track) => track.clips.map((clip) => clip.startOnTimelineUs + clip.durationUs));
    return Math.max(MIN_TIMELINE_DURATION_US, ...clipEnds, 0);
  }, [room.tracks]);

  useEffect(() => {
    playback.setClips(computeVisibleClips(room.tracks, playback.currentTimeUs));
  }, [room.tracks, playback, playback.currentTimeUs]);

  const handleStepFrame = (direction: 1 | -1) => {
    playback.seek(stepFrameTimeUs(playback.currentTimeUs, room.meta.frameRateNum, room.meta.frameRateDen, direction));
  };

  const addTrack = (kind: "video" | "audio") => {
    room.engine.addTrack({
      id: crypto.randomUUID(),
      kind,
      name: `${kind === "video" ? "V" : "A"}${room.tracks.filter((t) => t.kind === kind).length + 1}`,
      muted: false,
      locked: false,
      hidden: false,
      zIndex: room.tracks.length,
    });
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-950 text-neutral-100">
      <TopBar
        roomId={room.roomId}
        peerId={room.peerId}
        projectName={room.meta.name}
        onRenameProject={(name) => room.engine.updateMeta({ name })}
        peers={topology.peers}
        signalingState={room.signalingState}
        onNewRoom={room.regenerateRoom}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="h-[42%] min-h-[220px]">
            <PreviewCanvas playback={playback} meta={room.meta} durationUs={durationUs} onStepFrame={handleStepFrame} />
          </div>

          <div className="flex items-center gap-2 border-b border-t border-neutral-800 bg-surface-900 px-3 py-2">
            <ImportButton
              engine={room.engine}
              chunkStore={room.chunkStore}
              swarm={room.swarm}
              tracks={room.tracks}
              playheadUs={playback.currentTimeUs}
            />
            <button
              type="button"
              onClick={() => addTrack("video")}
              className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              + Video Track
            </button>
            <button
              type="button"
              onClick={() => addTrack("audio")}
              className="rounded-md border border-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-800"
            >
              + Audio Track
            </button>
          </div>

          <div className="min-h-0 flex-1">
            <Timeline
              engine={room.engine}
              tracks={room.tracks}
              durationUs={durationUs}
              currentTimeUs={playback.currentTimeUs}
              onSeek={playback.seek}
              selectedClipId={selectedClipId}
              onSelectClip={setSelectedClipId}
            />
          </div>
        </div>

        <NetworkPanel
          peers={topology.peers}
          throughput={topology.throughput}
          recentExchanges={topology.recentExchanges}
          selfPeerId={room.peerId}
        />
      </div>
    </div>
  );
}

export default App;
