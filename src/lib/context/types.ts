import type { JsonValue } from "@/lib/protocol/types";
import type { JsonDiffEntry } from "@/lib/context/jsonDiff";

export interface ContextSnapshotRecord {
  id: string;
  contextId: string;
  seq: number;
  timestamp: number;
  data: JsonValue;
  diffFromPrevious: JsonDiffEntry[];
  approxSizeBytes: number;
}

export interface ContextHistory {
  contextId: string;
  snapshots: ContextSnapshotRecord[];
  selectedIndex: number;
  isUserScrubbing: boolean;
}

export interface ContextInspectorState {
  historiesById: Record<string, ContextHistory>;
  selectedContextId?: string;
}

export const initialContextInspectorState: ContextInspectorState = {
  historiesById: {},
};
