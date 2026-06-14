import test from "node:test";
import assert from "node:assert/strict";
import {
  appendContextSnapshotState,
  createContextHistory,
  selectContextSnapshotState,
  selectLatestContextSnapshotState,
} from "@/lib/context/contextState";
import { initialContextInspectorState, type ContextSnapshotRecord } from "@/lib/context/types";

function snapshotRecord(overrides: Partial<ContextSnapshotRecord>): ContextSnapshotRecord {
  return {
    id: "ctx:1",
    contextId: "ctx",
    seq: 1,
    timestamp: 1,
    data: { value: 1 },
    diffFromPrevious: [],
    approxSizeBytes: 10,
    ...overrides,
  };
}

test("first snapshot creates history", () => {
  const nextState = appendContextSnapshotState(initialContextInspectorState, {
    contextId: "ctx-report",
    seq: 1,
    data: { report: "Q3" },
  }, { timestamp: 10, approxSizeBytes: 22 });

  assert.equal(nextState.selectedContextId, "ctx-report");
  assert.equal(nextState.historiesById["ctx-report"].snapshots.length, 1);
  assert.equal(nextState.historiesById["ctx-report"].selectedIndex, 0);
  assert.equal(nextState.historiesById["ctx-report"].snapshots[0].timestamp, 10);
  assert.equal(nextState.historiesById["ctx-report"].snapshots[0].approxSizeBytes, 22);
});

test("second snapshot with same context_id appends and computes diff against previous snapshot", () => {
  const firstState = appendContextSnapshotState(initialContextInspectorState, {
    contextId: "ctx-report",
    seq: 1,
    data: { report: "Q3", focus: "revenue" },
  }, { timestamp: 10, approxSizeBytes: 30 });

  const nextState = appendContextSnapshotState(firstState, {
    contextId: "ctx-report",
    seq: 2,
    data: { report: "Q3", focus: "operations", metric: "23.4%" },
  }, { timestamp: 11, approxSizeBytes: 40 });

  const history = nextState.historiesById["ctx-report"];
  assert.equal(history.snapshots.length, 2);
  assert.equal(history.selectedIndex, 1);
  assert.deepEqual(
    history.snapshots[1].diffFromPrevious.map((entry) => ({ kind: entry.kind, path: entry.path })),
    [
      { kind: "changed", path: "$.focus" },
      { kind: "added", path: "$.metric" },
    ],
  );
});

test("same context_id and same seq is ignored", () => {
  const firstState = appendContextSnapshotState(initialContextInspectorState, {
    contextId: "ctx-report",
    seq: 1,
    data: { report: "Q3" },
  });

  const nextState = appendContextSnapshotState(firstState, {
    contextId: "ctx-report",
    seq: 1,
    data: { report: "changed" },
  });

  assert.equal(nextState, firstState);
});

test("selecting older snapshot only updates context selection state", () => {
  const state = {
    selectedContextId: "ctx-report",
    historiesById: {
      "ctx-report": createContextHistory("ctx-report", [
        snapshotRecord({ id: "ctx-report:1", contextId: "ctx-report", seq: 1, data: { value: 1 } }),
        snapshotRecord({ id: "ctx-report:2", contextId: "ctx-report", seq: 2, data: { value: 2 } }),
      ], 1, false),
    },
  };

  const nextState = selectContextSnapshotState(state, "ctx-report", 0);

  assert.equal(nextState.selectedContextId, "ctx-report");
  assert.equal(nextState.historiesById["ctx-report"].selectedIndex, 0);
  assert.equal(nextState.historiesById["ctx-report"].isUserScrubbing, true);
  assert.equal(nextState.historiesById["ctx-report"].snapshots.length, 2);
  assert.deepEqual(nextState.historiesById["ctx-report"].snapshots, state.historiesById["ctx-report"].snapshots);
});

test("selectLatestContextSnapshotState jumps to the latest snapshot and clears scrubbing", () => {
  const state = {
    selectedContextId: "ctx-report",
    historiesById: {
      "ctx-report": createContextHistory("ctx-report", [
        snapshotRecord({ id: "ctx-report:1", contextId: "ctx-report", seq: 1 }),
        snapshotRecord({ id: "ctx-report:2", contextId: "ctx-report", seq: 2 }),
      ], 0, true),
    },
  };

  const nextState = selectLatestContextSnapshotState(state, "ctx-report");
  assert.equal(nextState.historiesById["ctx-report"].selectedIndex, 1);
  assert.equal(nextState.historiesById["ctx-report"].isUserScrubbing, false);
});

test("new snapshot respects manual scrubbing when another context is selected", () => {
  const state = {
    selectedContextId: "ctx-b",
    historiesById: {
      "ctx-a": createContextHistory("ctx-a", [
        snapshotRecord({ id: "ctx-a:1", contextId: "ctx-a", seq: 1, data: { value: 1 } }),
        snapshotRecord({ id: "ctx-a:2", contextId: "ctx-a", seq: 2, data: { value: 2 } }),
      ], 0, true),
      "ctx-b": createContextHistory("ctx-b", [
        snapshotRecord({ id: "ctx-b:1", contextId: "ctx-b", seq: 1, data: { value: 10 } }),
      ], 0, false),
    },
  };

  const nextState = appendContextSnapshotState(state, {
    contextId: "ctx-a",
    seq: 3,
    data: { value: 3 },
  });

  assert.equal(nextState.historiesById["ctx-a"].selectedIndex, 0);
  assert.equal(nextState.historiesById["ctx-a"].isUserScrubbing, true);
  assert.equal(nextState.historiesById["ctx-a"].snapshots.length, 3);
});
