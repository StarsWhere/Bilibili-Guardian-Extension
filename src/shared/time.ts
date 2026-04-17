export function timeStringToSeconds(time: string | null | undefined): number {
  if (!time) {
    return 0;
  }

  const parts = String(time)
    .trim()
    .split(":")
    .map((part) => Number(part));

  if (parts.some((part) => Number.isNaN(part))) {
    return 0;
  }

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return parts[0] ?? 0;
}

export function secondsToTimeString(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const remain = safeSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");

  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(remain)}`;
  }

  return `${pad(minutes)}:${pad(remain)}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeAdRange(
  start: string | null,
  end: string | null,
  minimumDurationSeconds: number
): { start: string | null; end: string | null } {
  if (!start || !end) {
    return { start, end };
  }

  const startSeconds = timeStringToSeconds(start);
  const endSeconds = timeStringToSeconds(end);

  if (endSeconds <= startSeconds) {
    return {
      start,
      end: secondsToTimeString(startSeconds + minimumDurationSeconds)
    };
  }

  if (endSeconds - startSeconds < minimumDurationSeconds) {
    return {
      start,
      end: secondsToTimeString(startSeconds + minimumDurationSeconds)
    };
  }

  return { start, end };
}
