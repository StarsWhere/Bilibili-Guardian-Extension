import { normalizeAdRange, secondsToTimeString, timeStringToSeconds } from "@/shared/time";

describe("time helpers", () => {
  it("converts time strings to seconds", () => {
    expect(timeStringToSeconds("01:30")).toBe(90);
    expect(timeStringToSeconds("01:02:03")).toBe(3723);
  });

  it("converts seconds to time strings", () => {
    expect(secondsToTimeString(90)).toBe("01:30");
    expect(secondsToTimeString(3723)).toBe("01:02:03");
  });

  it("normalizes short ad ranges", () => {
    expect(normalizeAdRange("00:20", "00:30", 30)).toEqual({
      start: "00:20",
      end: "00:50"
    });
  });
});
