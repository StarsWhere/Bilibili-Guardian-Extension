import { clampButtonPosition, hasDragged, snapToViewportEdge } from "@/content/ui/drag";

describe("floating button drag helpers", () => {
  it("clamps positions into viewport", () => {
    expect(clampButtonPosition({ x: -10, y: 9999 }, { width: 200, height: 300 }, 56)).toEqual({
      x: 8,
      y: 236
    });
  });

  it("detects drag threshold", () => {
    expect(hasDragged({ x: 10, y: 10 }, { x: 20, y: 10 })).toBe(true);
    expect(hasDragged({ x: 10, y: 10 }, { x: 13, y: 12 })).toBe(false);
  });

  it("snaps toward nearest edge", () => {
    expect(snapToViewportEdge({ x: 100, y: 80 }, { width: 400, height: 300 }, 56)).toEqual({
      x: 12,
      y: 80
    });
    expect(snapToViewportEdge({ x: 300, y: 80 }, { width: 400, height: 300 }, 56)).toEqual({
      x: 332,
      y: 80
    });
  });
});
