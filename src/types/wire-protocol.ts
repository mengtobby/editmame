/**
 * P2P chunk swarm wire protocol.
 *
 * A BitTorrent-style scheme layered directly on RTCDataChannel: imported media is sliced into
 * fixed-size chunks addressed by BLAKE3 hash, peers broadcast which chunks they hold via
 * bitfields, and a playhead-aware scheduler (see ChunkRequestCandidate) requests missing chunks
 * from whichever peers have them, weighted by how soon the player will need the data.
 */

export const CHUNK_SIZE_BYTES = 1024 * 1024; // 1 MiB
export const SWARM_PROTOCOL_VERSION = 1;

/** Hex-encoded BLAKE3 digest (32 bytes -> 64 hex chars). */
export type Blake3Hex = string;

/** Describes one imported asset: its chunk layout and the hash of every chunk for verification. */
export interface AssetManifest {
  /** BLAKE3 merkle root over all chunk hashes — the asset's content address. */
  assetHash: Blake3Hex;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  chunkCount: number;
  /** Leaf hashes, index-aligned with chunk index; each incoming chunk is verified against this
   *  before it is written to OPFS. */
  chunkHashes: Blake3Hex[];
}

/** Local (or remote, once received via BitfieldUpdateMessage) chunk availability for one asset. */
export interface Bitfield {
  assetHash: Blake3Hex;
  chunkCount: number;
  /** One bit per chunk, ceil(chunkCount / 8) bytes, bit i = chunk i present. */
  bits: Uint8Array<ArrayBuffer>;
}

// ---------------------------------------------------------------------------
// Signaling (WebSocket, out-of-band from the DataChannel swarm — SDP/ICE only)
// ---------------------------------------------------------------------------

export type SignalingMessage =
  | { type: "join"; roomId: string; peerId: string }
  | { type: "peer-joined"; peerId: string }
  | { type: "peer-left"; peerId: string }
  | { type: "room-peers"; peerIds: string[] }
  | { type: "signal"; fromPeerId: string; toPeerId: string; payload: RTCSignalPayload }
  | { type: "error"; message: string };

export type RTCSignalPayload =
  | { kind: "offer"; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "ice-candidate"; candidate: RTCIceCandidateInit };

// ---------------------------------------------------------------------------
// Swarm messages (binary-framed, sent over an RTCDataChannel per peer connection)
// ---------------------------------------------------------------------------

export enum SwarmMessageType {
  Handshake = 0,
  BitfieldUpdate = 1,
  Have = 2,
  RequestChunk = 3,
  Chunk = 4,
  CancelRequest = 5,
  ManifestAnnounce = 6,
  ManifestRequest = 7,
  ChokeUpdate = 8,
}

export interface HandshakeMessage {
  type: SwarmMessageType.Handshake;
  peerId: string;
  protocolVersion: number;
}

/** Sent whenever the sender's local bitfield for an asset changes materially (e.g. after a
 *  batch of chunks lands), rather than on every single chunk — see HaveMessage for that. */
export interface BitfieldUpdateMessage {
  type: SwarmMessageType.BitfieldUpdate;
  assetHash: Blake3Hex;
  bits: Uint8Array<ArrayBuffer>;
}

/** Incremental announcement that a single chunk just became available locally. */
export interface HaveMessage {
  type: SwarmMessageType.Have;
  assetHash: Blake3Hex;
  chunkIndex: number;
}

export interface RequestChunkMessage {
  type: SwarmMessageType.RequestChunk;
  assetHash: Blake3Hex;
  chunkIndex: number;
  /** Higher = more urgent (closer to the playhead deadline); used by the receiver to decide
   *  which of several inbound requests to service first. */
  priority: number;
  requestId: string;
}

export interface ChunkMessage {
  type: SwarmMessageType.Chunk;
  assetHash: Blake3Hex;
  chunkIndex: number;
  requestId: string;
  data: Uint8Array<ArrayBuffer>;
  /** BLAKE3 of `data`; the receiver re-verifies this against the asset's manifest before
   *  writing to OPFS, independent of transport integrity. */
  hash: Blake3Hex;
}

export interface CancelRequestMessage {
  type: SwarmMessageType.CancelRequest;
  assetHash: Blake3Hex;
  chunkIndex: number;
  requestId: string;
}

export interface ManifestAnnounceMessage {
  type: SwarmMessageType.ManifestAnnounce;
  manifest: AssetManifest;
}

export interface ManifestRequestMessage {
  type: SwarmMessageType.ManifestRequest;
  assetHash: Blake3Hex;
}

/** Bandwidth-management signal (tit-for-tat style), analogous to BitTorrent choking. */
export interface ChokeUpdateMessage {
  type: SwarmMessageType.ChokeUpdate;
  choked: boolean;
}

export type SwarmMessage =
  | HandshakeMessage
  | BitfieldUpdateMessage
  | HaveMessage
  | RequestChunkMessage
  | ChunkMessage
  | CancelRequestMessage
  | ManifestAnnounceMessage
  | ManifestRequestMessage
  | ChokeUpdateMessage;

// ---------------------------------------------------------------------------
// Scheduler-facing types (playhead-urgency chunk requesting)
// ---------------------------------------------------------------------------

export interface ChunkRequestCandidate {
  assetHash: Blake3Hex;
  chunkIndex: number;
  /** Estimated microseconds of playback time until this chunk's data is needed. Negative once
   *  the deadline has already passed and the player is stalling on it. */
  deadlineUs: number;
  /** Peers known (via their broadcast bitfields) to hold this chunk. */
  candidatePeerIds: string[];
}

export interface InFlightRequest {
  requestId: string;
  assetHash: Blake3Hex;
  chunkIndex: number;
  peerId: string;
  requestedAtMs: number;
}
