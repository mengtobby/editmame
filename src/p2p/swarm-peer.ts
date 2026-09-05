import { hashHex } from "@/media/blake3";
import { createEmptyBitfield, hasChunk, missingChunkIndices, setChunk } from "@/media/bitfield";
import type { ChunkStore } from "@/storage/chunk-store";
import type { ChunkExchangeEvent } from "@/types/network";
import type { AssetManifest, Bitfield, Blake3Hex } from "@/types/wire-protocol";
import { SwarmMessageType } from "@/types/wire-protocol";
import { ChunkScheduler } from "./chunk-scheduler";
import type { PeerConnectionManager } from "./peer-connection-manager";
import { encodeSwarmMessage, tryDecodeSwarmMessage } from "./swarm-codec";

/**
 * Wires the chunker/store/scheduler building blocks into the live swarm: announces locally
 * imported assets, tracks which peers hold which chunks, serves incoming requests from the local
 * ChunkStore, and verifies every incoming chunk's BLAKE3 hash before it's written to disk.
 */
export class SwarmPeer {
  private readonly manifests = new Map<Blake3Hex, AssetManifest>();
  private readonly remoteBitfields = new Map<Blake3Hex, Map<string, Bitfield>>();
  private readonly scheduler: ChunkScheduler;
  private readonly unsubscribe: () => void;
  onChunkExchange: ((event: ChunkExchangeEvent) => void) | null = null;
  onAssetUpdated: ((assetHash: Blake3Hex) => void) | null = null;

  constructor(
    private readonly manager: PeerConnectionManager,
    private readonly store: ChunkStore,
  ) {
    this.scheduler = new ChunkScheduler({
      requestChunk: (peerId, assetHash, chunkIndex, priority, requestId) => {
        this.manager.send(
          peerId,
          encodeSwarmMessage({ type: SwarmMessageType.RequestChunk, assetHash, chunkIndex, priority, requestId }),
        );
      },
      cancelChunk: (peerId, assetHash, chunkIndex, requestId) => {
        this.manager.send(peerId, encodeSwarmMessage({ type: SwarmMessageType.CancelRequest, assetHash, chunkIndex, requestId }));
      },
    });

    const offMessage = manager.on("message", ({ peerId, data }) => this.handleMessage(peerId, data));
    const offPeerConnected = manager.on("peer-connected", ({ peerId }) => this.handlePeerConnected(peerId));
    this.unsubscribe = () => {
      offMessage();
      offPeerConnected();
    };
  }

  dispose(): void {
    this.unsubscribe();
  }

  getManifest(assetHash: Blake3Hex): AssetManifest | undefined {
    return this.manifests.get(assetHash);
  }

  /** Registers a locally-imported asset (chunks already written to `store`) and tells the swarm
   *  about it, so peers know to request it once the referencing clip syncs over the CRDT. */
  async announceLocalAsset(manifest: AssetManifest): Promise<void> {
    this.manifests.set(manifest.assetHash, manifest);
    this.manager.broadcast(encodeSwarmMessage({ type: SwarmMessageType.ManifestAnnounce, manifest }));
    await this.broadcastLocalBitfield(manifest.assetHash);
  }

  /** Requests every chunk of `assetHash` this peer doesn't already have, from whichever
   *  connected peers have announced holding it. Safe to call repeatedly (e.g. on a timer or
   *  whenever a new remote bitfield arrives) — already-in-flight chunks are skipped. */
  async requestMissingChunks(assetHash: Blake3Hex): Promise<void> {
    const manifest = this.manifests.get(assetHash);
    if (!manifest) {
      this.manager.broadcast(encodeSwarmMessage({ type: SwarmMessageType.ManifestRequest, assetHash }));
      return;
    }

    const localBitfield = await this.store.getBitfield(assetHash, manifest.chunkCount);
    const missing = missingChunkIndices(localBitfield);
    if (missing.length === 0) return;

    const holders = this.remoteBitfields.get(assetHash);
    const candidates = missing.map((chunkIndex) => ({
      assetHash,
      chunkIndex,
      deadlineUs: 0,
      candidatePeerIds: holders
        ? Array.from(holders.entries())
            .filter(([, bitfield]) => hasChunk(bitfield, chunkIndex))
            .map(([peerId]) => peerId)
        : [],
    }));

    this.scheduler.schedule(candidates);
  }

  private async broadcastLocalBitfield(assetHash: Blake3Hex): Promise<void> {
    const manifest = this.manifests.get(assetHash);
    if (!manifest) return;
    const bitfield = await this.store.getBitfield(assetHash, manifest.chunkCount);
    this.manager.broadcast(
      encodeSwarmMessage({ type: SwarmMessageType.BitfieldUpdate, assetHash, bits: bitfield.bits }),
    );
  }

  private handlePeerConnected(peerId: string): void {
    for (const manifest of this.manifests.values()) {
      this.manager.send(peerId, encodeSwarmMessage({ type: SwarmMessageType.ManifestAnnounce, manifest }));
      void this.sendLocalBitfieldTo(peerId, manifest.assetHash);
    }
  }

  private async sendLocalBitfieldTo(peerId: string, assetHash: Blake3Hex): Promise<void> {
    const manifest = this.manifests.get(assetHash);
    if (!manifest) return;
    const bitfield = await this.store.getBitfield(assetHash, manifest.chunkCount);
    this.manager.send(peerId, encodeSwarmMessage({ type: SwarmMessageType.BitfieldUpdate, assetHash, bits: bitfield.bits }));
  }

  private handleMessage(peerId: string, data: string | ArrayBuffer): void {
    if (!(data instanceof ArrayBuffer)) return;
    const message = tryDecodeSwarmMessage(data);
    if (!message) return;

    switch (message.type) {
      case SwarmMessageType.ManifestAnnounce:
        this.manifests.set(message.manifest.assetHash, message.manifest);
        void this.requestMissingChunks(message.manifest.assetHash);
        break;
      case SwarmMessageType.ManifestRequest: {
        const manifest = this.manifests.get(message.assetHash);
        if (manifest) this.manager.send(peerId, encodeSwarmMessage({ type: SwarmMessageType.ManifestAnnounce, manifest }));
        break;
      }
      case SwarmMessageType.BitfieldUpdate:
        this.recordRemoteBitfield(peerId, message.assetHash, { assetHash: message.assetHash, chunkCount: message.bits.length * 8, bits: message.bits });
        void this.requestMissingChunks(message.assetHash);
        break;
      case SwarmMessageType.Have: {
        const manifest = this.manifests.get(message.assetHash);
        if (!manifest) break;
        let byPeer = this.remoteBitfields.get(message.assetHash);
        if (!byPeer) {
          byPeer = new Map();
          this.remoteBitfields.set(message.assetHash, byPeer);
        }
        const bitfield = byPeer.get(peerId) ?? createEmptyBitfield(message.assetHash, manifest.chunkCount);
        setChunk(bitfield, message.chunkIndex);
        byPeer.set(peerId, bitfield);
        void this.requestMissingChunks(message.assetHash);
        break;
      }
      case SwarmMessageType.RequestChunk:
        void this.serveChunkRequest(peerId, message.assetHash, message.chunkIndex, message.requestId);
        break;
      case SwarmMessageType.Chunk:
        void this.handleIncomingChunk(peerId, message.assetHash, message.chunkIndex, message.data, message.hash);
        break;
      case SwarmMessageType.CancelRequest:
        // No pending-send bookkeeping to cancel yet in this milestone — the response is small
        // enough (one chunk) that letting an in-flight send complete is harmless.
        break;
      default:
        break;
    }
  }

  private recordRemoteBitfield(peerId: string, assetHash: Blake3Hex, bitfield: Bitfield): void {
    let byPeer = this.remoteBitfields.get(assetHash);
    if (!byPeer) {
      byPeer = new Map();
      this.remoteBitfields.set(assetHash, byPeer);
    }
    byPeer.set(peerId, bitfield);
  }

  private async serveChunkRequest(peerId: string, assetHash: Blake3Hex, chunkIndex: number, requestId: string): Promise<void> {
    const data = await this.store.getChunk(assetHash, chunkIndex);
    if (!data) return;
    const hash = hashHex(data);
    this.manager.send(peerId, encodeSwarmMessage({ type: SwarmMessageType.Chunk, assetHash, chunkIndex, requestId, data, hash }));
    this.onChunkExchange?.({ peerId, assetHash, chunkIndex, direction: "upload", timestampMs: Date.now() });
  }

  private async handleIncomingChunk(
    peerId: string,
    assetHash: Blake3Hex,
    chunkIndex: number,
    data: Uint8Array<ArrayBuffer>,
    expectedHash: Blake3Hex,
  ): Promise<void> {
    this.scheduler.onChunkReceived(assetHash, chunkIndex);
    if (hashHex(data) !== expectedHash) return; // reject a corrupted or malicious chunk

    await this.store.putChunk(assetHash, chunkIndex, data);
    this.onChunkExchange?.({ peerId, assetHash, chunkIndex, direction: "download", timestampMs: Date.now() });
    this.onAssetUpdated?.(assetHash);

    const manifest = this.manifests.get(assetHash);
    if (manifest) {
      const bitfield = createEmptyBitfield(assetHash, manifest.chunkCount);
      setChunk(bitfield, chunkIndex);
      // Best-effort incremental Have; a full bitfield resync happens on the next
      // requestMissingChunks/announce pass, so a dropped Have here isn't fatal.
      this.manager.broadcast(encodeSwarmMessage({ type: SwarmMessageType.Have, assetHash, chunkIndex }));
    }
  }
}
