# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small teams and creators who edit video together in real time — a podcast team assembling an
episode, a couple of friends cutting a trip video, a small crew reviewing and trimming footage
live on a call. Each person is on their own machine with their own local media; nobody is "the
editor" who owns the project file and has to export/send it around.

## Product Purpose

Editmame is a browser-based, peer-to-peer collaborative non-linear video editor. Multiple people
join a shared session, each imports their own local footage, and everyone edits one shared
multi-track timeline together in real time. Success is a session where editing feels as
synchronous and lightweight as editing a Google Doc together, but for video.

## Positioning

Fully peer-to-peer and local-first: media is never uploaded to a server. A lightweight signaling
server only exchanges WebRTC connection handshakes; once peers are connected, timeline edits sync
directly between browsers via a CRDT (Yjs), and video chunks transfer directly between peers over
WebRTC data channels (BitTorrent-style, content-addressed, BLAKE3-verified). No other product in
this space can make the "your footage never leaves your machine" claim while still being real-time
multiplayer.

## Operating Context

- A session lives at a URL with a room id in the query string; opening/sharing that URL is how
  people join.
- Each participant imports video from their own local disk; nothing is pre-uploaded or shared in
  advance.
- Editing happens live: dragging a clip, trimming an in/out point, adding a track, muting a track
  — all of it is visible to every other participant within roughly a second.
- Sessions are ad hoc and short-lived (no persistent account system, project library, or saved
  history yet) — a room exists as long as people are in it.

## Capabilities and Constraints

- Multi-track timeline: video and audio tracks, drag-to-move clips, trim handles, track
  mute/lock/hide, track reordering.
- Preview playback: play/pause, scrub, frame-step, timecode display, driven by a WebCodecs +
  WebGL decode/composite pipeline running off the main thread.
- Local media import only — no server-side transcoding or storage; chunking/hashing/storage all
  happen client-side.
- Network/collaboration visibility: who else is in the room, connection health, and (as a P2P app)
  visibility into the peer-to-peer data exchange itself is a meaningful part of the product's
  honesty about how it works, not just debug info.
- Undecided / explicitly out of scope for now: accounts, saved project history, export/render,
  audio waveforms, transitions/effects beyond basic opacity/transform.

## Product Principles

1. Make the peer-to-peer, local-first nature legible, not hidden — people should be able to see
   that their footage is going directly to their collaborator, not through a server.
2. Collaboration should feel as low-friction as a shared document: open a link, start
   editing together, see each other's changes appear naturally.
3. The editor is for small, fast, casual collaborative sessions, not a dense professional
   broadcast suite — prioritize approachability and clarity over information density.
4. Never let the interface imply footage is being uploaded, stored remotely, or processed
   server-side — copy and visuals must stay honest about where data actually lives and moves.
