import type { JsonArray, JsonObject, JsonValue } from "@/lib/protocol/types";

export type JsonDiffKind = "added" | "removed" | "changed";

export interface JsonDiffEntry {
  kind: JsonDiffKind;
  path: string;
  oldValue?: JsonValue;
  newValue?: JsonValue;
}

export function diffJson(previous: JsonValue | undefined, next: JsonValue): JsonDiffEntry[] {
  if (previous === undefined) {
    return [{ kind: "added", path: "$", newValue: next }];
  }

  const entries: JsonDiffEntry[] = [];
  diffValue(previous, next, "$", entries);
  return entries;
}

function diffValue(previous: JsonValue, next: JsonValue, path: string, entries: JsonDiffEntry[]): void {
  if (Object.is(previous, next)) {
    return;
  }

  if (isJsonArray(previous) && isJsonArray(next)) {
    diffArray(previous, next, path, entries);
    return;
  }

  if (isJsonObject(previous) && isJsonObject(next)) {
    diffObject(previous, next, path, entries);
    return;
  }

  entries.push({ kind: "changed", path, oldValue: previous, newValue: next });
}

function diffObject(previous: JsonObject, next: JsonObject, path: string, entries: JsonDiffEntry[]): void {
  const keys = Array.from(new Set([...Object.keys(previous), ...Object.keys(next)])).sort();

  for (const key of keys) {
    const childPath = `${path}.${escapePathSegment(key)}`;
    const hasPrevious = Object.prototype.hasOwnProperty.call(previous, key);
    const hasNext = Object.prototype.hasOwnProperty.call(next, key);

    if (!hasPrevious) {
      entries.push({ kind: "added", path: childPath, newValue: next[key] });
      continue;
    }

    if (!hasNext) {
      entries.push({ kind: "removed", path: childPath, oldValue: previous[key] });
      continue;
    }

    diffValue(previous[key], next[key], childPath, entries);
  }
}

function diffArray(previous: JsonArray, next: JsonArray, path: string, entries: JsonDiffEntry[]): void {
  const maxLength = Math.max(previous.length, next.length);

  for (let index = 0; index < maxLength; index += 1) {
    const childPath = `${path}[${index}]`;
    const hasPrevious = index < previous.length;
    const hasNext = index < next.length;

    if (!hasPrevious) {
      entries.push({ kind: "added", path: childPath, newValue: next[index] });
      continue;
    }

    if (!hasNext) {
      entries.push({ kind: "removed", path: childPath, oldValue: previous[index] });
      continue;
    }

    diffValue(previous[index], next[index], childPath, entries);
  }
}

function isJsonObject(value: JsonValue): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonArray(value: JsonValue): value is JsonArray {
  return Array.isArray(value);
}

function escapePathSegment(segment: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(segment) ? segment : JSON.stringify(segment);
}
