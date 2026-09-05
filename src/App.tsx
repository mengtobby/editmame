import { useEffect, useMemo, useState } from "react";
import { ImportButton } from "@/components/ImportButton";
import { NetworkPanel } from "@/components/NetworkPanel";
import { PreviewCanvas } from "@/components/PreviewCanvas";
import { Timeline } from "@/components/timeline/Timeline";
import { ToolbarButton } from "@/components/ToolbarButton";
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
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-gray-50 text-gray-900">
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

          <div className="flex items-center gap-1 border-b border-gray-200 bg-white px-3 py-1.5">
            <ImportButton
              engine={room.engine}
              chunkStore={room.chunkStore}
              swarm={room.swarm}
              tracks={room.tracks}
              playheadUs={playback.currentTimeUs}
            />
            <span className="mx-1 h-5 w-px bg-gray-200" />
            <ToolbarButton onClick={() => addTrack("video")} icon={<VideoTrackIcon />}>
              Video track
            </ToolbarButton>
            <ToolbarButton onClick={() => addTrack("audio")} icon={<AudioTrackIcon />}>
              Audio track
            </ToolbarButton>
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

function VideoTrackIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 6l3.5 2L6 10V6Z" fill="currentColor" />
    </svg>
  );
}

function AudioTrackIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-4 w-4">
      <path
        d="M2 8h1.5l1.5-3 2 6 2-8 2 5 1.5-2.5H14"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default App;
