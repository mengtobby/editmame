import { pixelsToUs } from "./constants";

/**
 * Wires a horizontal pointer-drag gesture starting from `event`: converts every subsequent
 * pointer move into a microsecond delta from the drag's start position and calls `onDeltaUs`,
 * cleaning up its own window listeners on pointerup. Shared by clip move and clip trim, which
 * differ only in what they do with the delta.
 */
export function startHorizontalDragUs(event: React.PointerEvent, onDeltaUs: (deltaUs: number) => void): void {
  const startX = event.clientX;

  const onMove = (moveEvent: PointerEvent) => onDeltaUs(pixelsToUs(moveEvent.clientX - startX));
  const onUp = () => {
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
  };

  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}
