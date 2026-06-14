import { diffJson } from "@/lib/context/jsonDiff";
import type { ContextHistory, ContextInspectorState, ContextSnapshotRecord } from "@/lib/context/types";
import type { JsonValue } from "@/lib/protocol/types";

export interface IncomingContextSnapshot {
  contextId: string;
  seq: number;
  data: JsonValue;
}

interface AppendContextSnapshotOptions {
  timestamp?: number;
  approxSizeBytes?: number;
}

export function appendContextSnapshotState(
  state: ContextInspectorState,
  snapshot: IncomingContextSnapshot,
  options: AppendContextSnapshotOptions = {},
): ContextInspectorState {
  const existingHistory = state.historiesById[snapshot.contextId];
  if (existingHistory?.snapshots.some((entry) => entry.seq === snapshot.seq)) {
    return state;
  }

  const previous = existingHistory?.snapshots.at(-1);
  const record: ContextSnapshotRecord = {
    id: `${snapshot.contextId}:${snapshot.seq}`,
    contextId: snapshot.contextId,
    seq: snapshot.seq,
    timestamp: options.timestamp ?? Date.now(),
    data: snapshot.data,
    diffFromPrevious: diffJson(previous?.data, snapshot.data),
    approxSizeBytes: options.approxSizeBytes ?? new Blob([JSON.stringify(snapshot.data)]).size,
  };
  const snapshots = [...(existingHistory?.snapshots ?? []), record];
  const shouldAutoSelect = !existingHistory || !existingHistory.isUserScrubbing || state.selectedContextId === snapshot.contextId;

  return {
    ...state,
    selectedContextId: state.selectedContextId ?? snapshot.contextId,
    historiesById: {
      ...state.historiesById,
      [snapshot.contextId]: {
        contextId: snapshot.contextId,
        snapshots,
        selectedIndex: shouldAutoSelect ? snapshots.length - 1 : existingHistory.selectedIndex,
        isUserScrubbing: existingHistory?.isUserScrubbing ?? false,
      },
    },
  };
}

export function selectContextSnapshotState(
  state: ContextInspectorState,
  contextId: string,
  index?: number,
): ContextInspectorState {
  const history = state.historiesById[contextId];
  if (!history) {
    return { ...state, selectedContextId: contextId };
  }

  const selectedIndex = clamp(index ?? history.selectedIndex, 0, Math.max(0, history.snapshots.length - 1));
  return {
    ...state,
    selectedContextId: contextId,
    historiesById: {
      ...state.historiesById,
      [contextId]: {
        ...history,
        selectedIndex,
        isUserScrubbing: selectedIndex !== history.snapshots.length - 1,
      },
    },
  };
}

export function selectLatestContextSnapshotState(state: ContextInspectorState, contextId: string): ContextInspectorState {
  const history = state.historiesById[contextId];
  if (!history) {
    return state;
  }

  return {
    ...state,
    selectedContextId: contextId,
    historiesById: {
      ...state.historiesById,
      [contextId]: {
        ...history,
        selectedIndex: Math.max(0, history.snapshots.length - 1),
        isUserScrubbing: false,
      },
    },
  };
}

export function createContextHistory(contextId: string, snapshots: ContextSnapshotRecord[], selectedIndex = 0, isUserScrubbing = false): ContextHistory {
  return {
    contextId,
    snapshots,
    selectedIndex,
    isUserScrubbing,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
