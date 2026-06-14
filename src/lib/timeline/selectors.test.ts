import test from "node:test";
import assert from "node:assert/strict";
import { defaultTimelineFilters, searchableText, selectTimelineRows } from "@/lib/timeline/selectors";
import type { TimelineEvent } from "@/lib/timeline/types";

function event(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: "event-1",
    kind: "TOKEN",
    direction: "inbound",
    timestamp: 1,
    title: "TOKEN",
    summary: "token text",
    payloadPreview: "preview",
    ...overrides,
  };
}

test("selectTimelineRows filters by event type", () => {
  const events = [
    event({ id: "1", kind: "TOOL_CALL", title: "TOOL_CALL" }),
    event({ id: "2", kind: "PING", title: "PING" }),
  ];

  const rows = selectTimelineRows(events, {
    ...defaultTimelineFilters,
    kind: "PING",
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].kind, "PING");
});

test("selectTimelineRows filters by direction", () => {
  const events = [
    event({ id: "1", kind: "TOOL_ACK", direction: "outbound" }),
    event({ id: "2", kind: "TOOL_CALL", direction: "inbound" }),
  ];

  const rows = selectTimelineRows(events, {
    ...defaultTimelineFilters,
    direction: "outbound",
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].direction, "outbound");
});

test("selectTimelineRows search matches call_id", () => {
  const events = [
    event({ id: "1", kind: "TOOL_CALL", callId: "tc-search", title: "TOOL_CALL" }),
  ];

  const rows = selectTimelineRows(events, {
    ...defaultTimelineFilters,
    query: "tc-search",
  });

  assert.equal(rows.length, 1);
});

test("selectTimelineRows search matches tool name in summary", () => {
  const events = [
    event({ id: "1", kind: "TOOL_CALL", summary: "lookup_metric call_id=tc-1" }),
  ];

  const rows = selectTimelineRows(events, {
    ...defaultTimelineFilters,
    query: "lookup_metric",
  });

  assert.equal(rows.length, 1);
});

test("selectTimelineRows search matches stream_id", () => {
  const events = [
    event({ id: "1", streamId: "stream-123", summary: "stream event" }),
  ];

  const rows = selectTimelineRows(events, {
    ...defaultTimelineFilters,
    query: "stream-123",
  });

  assert.equal(rows.length, 1);
});

test("selectTimelineRows search matches payloadPreview", () => {
  const events = [
    event({ id: "1", kind: "CONTEXT_SNAPSHOT", payloadPreview: "approx 589KB schema snapshot" }),
  ];

  const rows = selectTimelineRows(events, {
    ...defaultTimelineFilters,
    query: "589kb",
  });

  assert.equal(rows.length, 1);
});

test("searchableText includes grouped token text", () => {
  const tokenGroup = {
    id: "group-1",
    kind: "TOKEN_GROUP" as const,
    direction: "inbound" as const,
    timestamp: 1,
    title: "TOKEN_GROUP",
    summary: "Streamed 2 tokens",
    payloadPreview: "joined token preview",
    seqStart: 1,
    seqEnd: 2,
    streamId: "stream-1",
    tokenCount: 2,
    text: "full grouped token text",
  };

  assert.match(searchableText(tokenGroup), /full grouped token text/);
});
