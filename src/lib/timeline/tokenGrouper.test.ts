import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupTokenEvents } from "@/lib/timeline/tokenGrouper";
import type { TimelineEvent } from "@/lib/timeline/types";

function token(seq: number, streamId: string, text: string): TimelineEvent {
  return {
    id: `token:${streamId}:${seq}`,
    kind: "TOKEN",
    direction: "inbound",
    timestamp: 1000 + seq,
    seq,
    streamId,
    title: "TOKEN",
    summary: text,
    payloadPreview: text,
    payload: text,
    relatedChatElementId: `${streamId}:text:1`,
  };
}

function tool(seq: number, streamId = "s1"): TimelineEvent {
  return {
    id: `tool:${seq}`,
    kind: "TOOL_CALL",
    direction: "inbound",
    timestamp: 1000 + seq,
    seq,
    streamId,
    callId: "tc_1",
    title: "TOOL_CALL",
    summary: "lookup_metric call_id=tc_1",
    payloadPreview: "lookup_metric",
  };
}

function end(seq: number, streamId = "s1"): TimelineEvent {
  return {
    id: `end:${seq}`,
    kind: "STREAM_END",
    direction: "inbound",
    timestamp: 1000 + seq,
    seq,
    streamId,
    title: "STREAM_END",
    summary: "stream ended",
    payloadPreview: "stream ended",
  };
}

describe("groupTokenEvents", () => {
  it("consecutive tokens same stream become one group", () => {
    const rows = groupTokenEvents([token(1, "s1", "Hello "), token(2, "s1", "world")]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kind, "TOKEN_GROUP");
  });

  it("tokens from different streams create separate groups", () => {
    const rows = groupTokenEvents([token(1, "s1", "A"), token(2, "s2", "B")]);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].kind, "TOKEN_GROUP");
    assert.equal(rows[1].kind, "TOKEN_GROUP");
  });

  it("TOOL_CALL flushes previous token group", () => {
    const rows = groupTokenEvents([token(1, "s1", "A"), tool(2), token(3, "s1", "B")]);
    assert.deepEqual(rows.map((row) => row.kind), ["TOKEN_GROUP", "TOOL_CALL", "TOKEN_GROUP"]);
  });

  it("STREAM_END flushes previous token group", () => {
    const rows = groupTokenEvents([token(1, "s1", "A"), end(2)]);
    assert.deepEqual(rows.map((row) => row.kind), ["TOKEN_GROUP", "STREAM_END"]);
  });

  it("token group contains full joined text", () => {
    const [row] = groupTokenEvents([token(1, "s1", "Hello "), token(2, "s1", "world")]);
    assert.equal(row.kind, "TOKEN_GROUP");
    assert.equal("text" in row ? row.text : "", "Hello world");
  });

  it("token group records seqStart and seqEnd", () => {
    const [row] = groupTokenEvents([token(4, "s1", "A"), token(5, "s1", "B")]);
    assert.equal(row.kind, "TOKEN_GROUP");
    assert.equal(row.seqStart, 4);
    assert.equal(row.seqEnd, 5);
  });
});
