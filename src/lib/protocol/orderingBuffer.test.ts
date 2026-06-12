import test from "node:test";
import assert from "node:assert/strict";
import { createOrderingBuffer } from "./orderingBuffer";
import type { ServerMessage } from "./types";

function token(seq: number): ServerMessage {
  return {
    type: "TOKEN",
    seq,
    text: `token-${seq}`,
    stream_id: "stream-1",
  };
}

test("normal sequence 1,2,3 processes immediately", () => {
  const buffer = createOrderingBuffer({ initialExpectedSeq: 1 });

  assert.deepEqual(buffer.push(token(1)).processed.map((message) => message.seq), [1]);
  assert.deepEqual(buffer.push(token(2)).processed.map((message) => message.seq), [2]);
  assert.deepEqual(buffer.push(token(3)).processed.map((message) => message.seq), [3]);
  assert.equal(buffer.getLastFullyProcessedSeq(), 3);
  assert.equal(buffer.getExpectedSeq(), 4);
});

test("out-of-order sequence 1,3,2 buffers then flushes", () => {
  const buffer = createOrderingBuffer({ initialExpectedSeq: 1 });

  assert.deepEqual(buffer.push(token(1)).processed.map((message) => message.seq), [1]);
  assert.equal(buffer.push(token(3)).accepted, "buffered");
  assert.deepEqual(buffer.push(token(2)).processed.map((message) => message.seq), [2, 3]);
  assert.equal(buffer.getLastFullyProcessedSeq(), 3);
  assert.equal(buffer.getBufferedCount(), 0);
});

test("duplicate processed message 1,2,2,3 is ignored", () => {
  const buffer = createOrderingBuffer({ initialExpectedSeq: 1 });

  buffer.push(token(1));
  buffer.push(token(2));
  const duplicate = buffer.push(token(2));
  const next = buffer.push(token(3));

  assert.equal(duplicate.accepted, "duplicate");
  assert.deepEqual(duplicate.processed, []);
  assert.deepEqual(next.processed.map((message) => message.seq), [3]);
});

test("duplicate buffered message 1,3,3,2 is ignored", () => {
  const buffer = createOrderingBuffer({ initialExpectedSeq: 1 });

  buffer.push(token(1));
  assert.equal(buffer.push(token(3)).accepted, "buffered");
  const duplicateBuffered = buffer.push(token(3));
  const flush = buffer.push(token(2));

  assert.equal(duplicateBuffered.accepted, "duplicate");
  assert.deepEqual(flush.processed.map((message) => message.seq), [2, 3]);
});

test("reversed batch 4,3,2,1 flushes in order when gap closes", () => {
  const buffer = createOrderingBuffer({ initialExpectedSeq: 1 });

  assert.equal(buffer.push(token(4)).accepted, "buffered");
  assert.equal(buffer.push(token(3)).accepted, "buffered");
  assert.equal(buffer.push(token(2)).accepted, "buffered");
  const flush = buffer.push(token(1));

  assert.deepEqual(flush.processed.map((message) => message.seq), [1, 2, 3, 4]);
  assert.equal(buffer.getLastFullyProcessedSeq(), 4);
});

test("gap fill 1,4,2,3,5 eventually flushes contiguous range", () => {
  const buffer = createOrderingBuffer({ initialExpectedSeq: 1 });

  buffer.push(token(1));
  buffer.push(token(4));
  assert.deepEqual(buffer.push(token(2)).processed.map((message) => message.seq), [2]);
  assert.deepEqual(buffer.push(token(3)).processed.map((message) => message.seq), [3, 4]);
  assert.deepEqual(buffer.push(token(5)).processed.map((message) => message.seq), [5]);
  assert.equal(buffer.getLastFullyProcessedSeq(), 5);
});

test("lower-than-expected late message is ignored", () => {
  const buffer = createOrderingBuffer({ initialExpectedSeq: 1 });

  buffer.push(token(1));
  buffer.push(token(2));
  const late = buffer.push(token(1));

  assert.equal(late.accepted, "duplicate");
  assert.deepEqual(late.processed, []);
  assert.equal(buffer.getLastFullyProcessedSeq(), 2);
});

test("lastFullyProcessedSeq updates only when messages are processable", () => {
  const buffer = createOrderingBuffer({ initialExpectedSeq: 1 });

  assert.equal(buffer.getLastFullyProcessedSeq(), null);
  buffer.push(token(3));
  assert.equal(buffer.getLastFullyProcessedSeq(), null);
  buffer.push(token(1));
  assert.equal(buffer.getLastFullyProcessedSeq(), 1);
  buffer.push(token(2));
  assert.equal(buffer.getLastFullyProcessedSeq(), 3);
});

test("reset clears processed state and supports new initial expected seq", () => {
  const buffer = createOrderingBuffer({ initialExpectedSeq: 1 });

  buffer.push(token(1));
  buffer.push(token(3));
  buffer.reset({ initialExpectedSeq: 5 });

  assert.equal(buffer.getExpectedSeq(), 5);
  assert.equal(buffer.getLastFullyProcessedSeq(), null);
  assert.equal(buffer.getBufferedCount(), 0);
  assert.equal(buffer.hasProcessed(1), false);
  assert.deepEqual(buffer.push(token(5)).processed.map((message) => message.seq), [5]);
});
