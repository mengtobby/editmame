import type { SwarmMessage } from "@/types/wire-protocol";
import { base64ToBytes, bytesToBase64 } from "./base64";

/** Multiplexing tag shared with collab-sync.ts's Yjs update tag (0) on the same data channel. */
const SWARM_TAG = 2;

/**
 * Encodes swarm messages as tagged JSON, base64-ing any binary fields (chunk `data`, bitfield
 * `bits`). That costs ~33% size overhead versus a purpose-built binary frame, which matters for
 * the 1MiB chunk payload — an acceptable simplification for now, called out here as the first
 * thing to optimize if chunk throughput becomes a bottleneck.
 */
export function encodeSwarmMessage(message: SwarmMessage): ArrayBuffer {
  const json = JSON.stringify(message, (_key, value: unknown) => {
    if (value instanceof Uint8Array) return { __bytes: bytesToBase64(value as Uint8Array<ArrayBuffer>) };
    return value;
  });
  const jsonBytes = new TextEncoder().encode(json);
  const out = new Uint8Array(jsonBytes.length + 1);
  out[0] = SWARM_TAG;
  out.set(jsonBytes, 1);
  return out.buffer;
}

export function tryDecodeSwarmMessage(data: ArrayBuffer): SwarmMessage | null {
  const bytes = new Uint8Array(data);
  if (bytes.length === 0 || bytes[0] !== SWARM_TAG) return null;

  const json = new TextDecoder().decode(bytes.subarray(1));
  return JSON.parse(json, (_key, value: unknown) => {
    if (value && typeof value === "object" && "__bytes" in value) {
      return base64ToBytes((value as { __bytes: string }).__bytes);
    }
    return value;
  }) as SwarmMessage;
}
