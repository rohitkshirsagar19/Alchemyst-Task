import test from "node:test";
import assert from "node:assert/strict";
import { parseServerMessage, safeJsonParse, validateServerMessage } from "@/lib/protocol/validators";

test("valid TOKEN parses", () => {
  const result = parseServerMessage(JSON.stringify({
    type: "TOKEN",
    seq: 1,
    stream_id: "s-1",
    text: "hello",
  }));

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.type, "TOKEN");
    assert.equal(result.value.seq, 1);
  }
});

test("valid TOOL_CALL parses", () => {
  const result = parseServerMessage(JSON.stringify({
    type: "TOOL_CALL",
    seq: 2,
    call_id: "tc-1",
    tool_name: "lookup_metric",
    args: { metric: "revenue" },
    stream_id: "s-1",
  }));

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.type, "TOOL_CALL");
    assert.deepEqual(result.value.args, { metric: "revenue" });
  }
});

test("valid PING with empty challenge parses", () => {
  const result = parseServerMessage(JSON.stringify({
    type: "PING",
    seq: 15,
    challenge: "",
  }));

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.type, "PING");
    assert.equal(result.value.challenge, "");
  }
});

test("invalid JSON returns failure", () => {
  const result = parseServerMessage("{not-json");
  assert.equal(result.ok, false);
});

test("unknown type returns failure", () => {
  const result = validateServerMessage({
    type: "NOT_REAL",
    seq: 1,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /Unknown server message type/);
  }
});

test("missing seq returns failure", () => {
  const result = validateServerMessage({
    type: "TOKEN",
    stream_id: "s-1",
    text: "hello",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /seq/);
  }
});

test("non-finite seq returns failure", () => {
  const result = validateServerMessage({
    type: "TOKEN",
    seq: Number.POSITIVE_INFINITY,
    stream_id: "s-1",
    text: "hello",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /finite number/);
  }
});

test("malformed tool args fail safely when args are not an object", () => {
  const result = validateServerMessage({
    type: "TOOL_CALL",
    seq: 3,
    call_id: "tc-1",
    tool_name: "lookup_metric",
    args: ["not", "an", "object"],
    stream_id: "s-1",
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.match(result.reason, /args/);
  }
});

test("safeJsonParse rejects malformed JSON without throwing", () => {
  const result = safeJsonParse("[");
  assert.equal(result.ok, false);
});
