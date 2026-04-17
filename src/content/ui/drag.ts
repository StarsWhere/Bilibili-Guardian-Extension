import type { FloatingButtonPosition } from "@/shared/types";

export const DRAG_CLICK_THRESHOLD = 6;

export function clampButtonPosition(position: FloatingButtonPosition, viewport: { width: number; height: number }, size: number) {
  return {
    x: Math.max(8, Math.min(viewport.width - size - 8, position.x)),
    y: Math.max(8, Math.min(viewport.height - size - 8, position.y))
  };
}

export function snapToViewportEdge(
  position: FloatingButtonPosition,
  viewport: { width: number; height: number },
  size: number
): FloatingButtonPosition {
  const clamped = clampButtonPosition(position, viewport, size);
  const leftDistance = clamped.x;
  const rightDistance = viewport.width - size - clamped.x;
  const snappedX = leftDistance <= rightDistance ? 12 : Math.max(12, viewport.width - size - 12);

  return {
    x: snappedX,
    y: clamped.y
  };
}

export function hasDragged(start: FloatingButtonPosition, end: FloatingButtonPosition): boolean {
  return Math.abs(end.x - start.x) > DRAG_CLICK_THRESHOLD || Math.abs(end.y - start.y) > DRAG_CLICK_THRESHOLD;
}
