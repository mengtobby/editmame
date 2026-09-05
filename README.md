# LoomP2P

A local-first, peer-to-peer collaborative non-linear video editor. Multiple people join a shared
editing session over WebRTC, import local media without uploading it anywhere, edit a multi-track
timeline together in real time via CRDTs, and distribute video chunks directly between browsers.

Media never touches a server. The signaling server only exchanges SDP/ICE handshakes to establish
direct peer connections — once a WebRTC data channel is open, it's out of the loop.

## Architecture

- **CRDT timeline** (`src/crdt/`, `src/types/timeline.ts`) — Yjs-backed, with tracks and clips as
  flat id-keyed collections using fractional indexing for order, so concurrent edits merge
  per-field instead of one write clobbering another.
- **Networking** (`src/p2p/`) — a WebRTC connection lifecycle manager with deterministic initiator
  election and automatic reconnection, a Yjs sync layer multiplexed over the data channel, and a
  BitTorrent-style chunk swarm (manifest announce, bitfield exchange, playback-deadline-ranked
  chunk requests, BLAKE3 verification on receipt).
- **Storage** (`src/storage/`) — content-addressed chunk cache backed by OPFS (falls back to an
  in-memory store where OPFS isn't available).
- **Playback** (`src/playback/`, `src/workers/`) — an OffscreenCanvas worker demuxing MP4 via
  mp4box.js, decoding with WebCodecs' `VideoDecoder`, and compositing multi-track layers with a
  WebGL2 shader, driven by a wall-clock-anchored playback clock.
- **UI** (`src/components/`, `src/hooks/`) — the timeline, preview canvas, and network topology
  panel, all driven by the pieces above.

## Running it

Two processes: the signaling server (Node/WebSocket) and the Vite dev server.

```bash
npm install
npm run signaling   # ws://localhost:8787
npm run dev         # http://localhost:5173 (or next free port)
```

Open the dev server URL, then open it again in a second tab or browser profile — the second tab
will pick up the `?room=` id from the first if you use "Copy Collaboration Link", or you can paste
the URL directly. Within a couple of seconds both tabs should show **Connected · 1 peer** in the
top bar, with the other peer listed in the network topology panel on the right.

By default the app connects to `ws://localhost:8787`; override with `VITE_SIGNALING_URL` in a
`.env.local` file to point at a different signaling server.

## Testing

```bash
npm run test        # vitest — CRDT, networking, chunking, storage, scheduler, playback logic
npm run typecheck   # tsc -b across the app/worker/node project references
npm run test:e2e    # playwright — real two-browser-context WebRTC handshake + CRDT sync
```

The vitest suite covers everything that doesn't require an actual browser: CRDT conflict
resolution, the WebRTC connection state machine and swarm protocol (via in-memory fakes — no real
network needed), BLAKE3 chunking/verification, and the playback clock/frame-selection/timecode
math.

`test:e2e` boots the real signaling server and Vite dev server (see `playwright.config.ts`) and
drives two independent browser contexts through an actual WebRTC handshake and a CRDT sync — not
mocked. If Playwright can't download its bundled Chromium in your environment, point it at a
system browser instead: `PLAYWRIGHT_EXECUTABLE_PATH="/path/to/chrome" npm run test:e2e`.

The WebCodecs decode + WebGL compositing pipeline itself (as opposed to the UI shell around it)
still needs manual verification with a real video file in a browser — there's no way to feed
WebCodecs a real H.264/VP9 stream from a unit or E2E test without checking in binary fixtures.

## Project layout

```
server/                 signaling server (SDP/ICE relay only)
src/
  types/                CRDT timeline schema + P2P wire protocol types
  crdt/                 Yjs-backed TimelineDoc + fractional indexing
  p2p/                  WebRTC lifecycle, Yjs sync, chunk swarm
  media/                BLAKE3 hashing, chunking, video metadata probing
  storage/              content-addressed chunk store (OPFS / in-memory)
  playback/             playback clock, frame selection, transforms, timecode
  workers/              OffscreenCanvas decode/render worker
  hooks/, components/   React UI
```
