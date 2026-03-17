export type SegmentParam = string | string[] | undefined;

export function readSegmentParam(value: SegmentParam) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

