import { isValidTimeString, secondsToTimeString, timeStringToSeconds } from "@/shared/time";

describe("time helpers", () => {
  it("converts time strings to seconds", () => {
    expect(timeStringToSeconds("01:30")).toBe(90);
    expect(timeStringToSeconds("01:02:03")).toBe(3723);
  });

  it("converts seconds to time strings", () => {
    expect(secondsToTimeString(90)).toBe("01:30");
    expect(secondsToTimeString(3723)).toBe("01:02:03");
  });

  it("validates supported time strings", () => {
    expect(isValidTimeString("00:20")).toBe(true);
    expect(isValidTimeString("01:02:03")).toBe(true);
    expect(isValidTimeString("00:90")).toBe(false);
  });
});
