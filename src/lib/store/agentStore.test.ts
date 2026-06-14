import test from "node:test";
import assert from "node:assert/strict";
import { agentReducer, initialAgentState, type AgentState, type ChatMessage } from "@/lib/store/agentStore";
import { selectHasActiveAssistantStream } from "@/lib/store/selectors";
import type { ServerMessage } from "@/lib/protocol/types";

function applyMessages(state: AgentState, messages: ServerMessage[]): AgentState {
  return agentReducer(state, {
    type: "APPLY_PROCESSED_MESSAGES",
    messages,
  });
}

test("first TOKEN creates assistant message for stream_id", () => {
  const nextState = applyMessages(initialAgentState, [
    { type: "TOKEN", seq: 1, stream_id: "s-1", text: "Hello" },
  ]);

  assert.equal(nextState.messages.length, 1);
  const message = nextState.messages[0];
  assert.equal(message.role, "assistant");
  assert.equal(message.streamId, "s-1");
  assert.equal(message.status, "streaming");
  assert.equal(message.content, "Hello");
  assert.deepEqual(message.blocks, [
    {
      type: "text",
      id: "s-1:text:1",
      text: "Hello",
      seqStart: 1,
      seqEnd: 1,
    },
  ]);
});

test("consecutive TOKEN events append to the same text block without duplicating content", () => {
  const nextState = applyMessages(initialAgentState, [
    { type: "TOKEN", seq: 1, stream_id: "s-1", text: "Hello" },
    { type: "TOKEN", seq: 2, stream_id: "s-1", text: " world" },
  ]);

  const message = nextState.messages[0];
  assert.equal(message.content, "Hello world");
  assert.equal(message.blocks?.length, 1);
  const block = message.blocks?.[0];
  assert.deepEqual(block, {
    type: "text",
    id: "s-1:text:1",
    text: "Hello world",
    seqStart: 1,
    seqEnd: 2,
  });
});

test("STREAM_END marks the stream as ended without changing content", () => {
  const state = applyMessages(initialAgentState, [
    { type: "TOKEN", seq: 1, stream_id: "s-1", text: "Hello" },
    { type: "TOKEN", seq: 2, stream_id: "s-1", text: " world" },
  ]);

  const nextState = applyMessages(state, [
    { type: "STREAM_END", seq: 3, stream_id: "s-1" },
  ]);

  assert.equal(nextState.messages[0].status, "ended");
  assert.equal(nextState.messages[0].content, "Hello world");
});

test("STREAM_END for unknown stream_id does not crash or change state", () => {
  const state = applyMessages(initialAgentState, [
    { type: "TOKEN", seq: 1, stream_id: "s-1", text: "Hello" },
  ]);

  const nextState = applyMessages(state, [
    { type: "STREAM_END", seq: 2, stream_id: "missing" },
  ]);

  assert.deepEqual(nextState, state);
});

test("TOOL_CALL after text inserts a tool block after text", () => {
  const nextState = applyMessages(initialAgentState, [
    { type: "TOKEN", seq: 1, stream_id: "s-1", text: "Before tool" },
    { type: "TOOL_CALL", seq: 2, stream_id: "s-1", call_id: "tc-1", tool_name: "lookup", args: { metric: "rev" } },
  ]);

  const message = nextState.messages[0];
  assert.equal(message.blocks?.length, 2);
  assert.equal(message.blocks?.[0]?.type, "text");
  assert.deepEqual(message.blocks?.[1], {
    type: "tool",
    id: "s-1:tool:tc-1",
    callId: "tc-1",
    toolName: "lookup",
    args: { metric: "rev" },
    status: "waiting",
    streamId: "s-1",
    callSeq: 2,
  });
});

test("TOOL_CALL before any token creates assistant message with tool block first", () => {
  const nextState = applyMessages(initialAgentState, [
    { type: "TOOL_CALL", seq: 1, stream_id: "s-1", call_id: "tc-1", tool_name: "search", args: { query: "sla" } },
  ]);

  const message = nextState.messages[0];
  assert.equal(message.role, "assistant");
  assert.equal(message.content, "");
  assert.equal(message.blocks?.length, 1);
  assert.equal(message.blocks?.[0]?.type, "tool");
});

test("multiple TOOL_CALL events stack instead of overwriting", () => {
  const nextState = applyMessages(initialAgentState, [
    { type: "TOOL_CALL", seq: 1, stream_id: "s-1", call_id: "tc-1", tool_name: "search", args: { query: "a" } },
    { type: "TOOL_CALL", seq: 2, stream_id: "s-1", call_id: "tc-2", tool_name: "lookup", args: { query: "b" } },
  ]);

  assert.equal(nextState.messages[0].blocks?.length, 2);
  assert.deepEqual(
    nextState.messages[0].blocks?.map((block) => block.type === "tool" ? block.callId : null),
    ["tc-1", "tc-2"],
  );
});

test("duplicate TOOL_CALL with same call_id does not create duplicate card", () => {
  const nextState = applyMessages(initialAgentState, [
    { type: "TOOL_CALL", seq: 1, stream_id: "s-1", call_id: "tc-1", tool_name: "search", args: { query: "a" } },
    { type: "TOOL_CALL", seq: 2, stream_id: "s-1", call_id: "tc-1", tool_name: "search", args: { query: "a" } },
  ]);

  assert.equal(nextState.messages[0].blocks?.length, 1);
});

test("TOOL_RESULT updates the matching tool block without appending JSON into assistant text", () => {
  const nextState = applyMessages(initialAgentState, [
    { type: "TOKEN", seq: 1, stream_id: "s-1", text: "Before tool" },
    { type: "TOOL_CALL", seq: 2, stream_id: "s-1", call_id: "tc-1", tool_name: "lookup", args: { metric: "rev" } },
    { type: "TOOL_RESULT", seq: 3, stream_id: "s-1", call_id: "tc-1", result: { value: "23%" } },
  ]);

  const message = nextState.messages[0];
  const toolBlock = message.blocks?.[1];
  assert.equal(toolBlock?.type, "tool");
  if (toolBlock?.type !== "tool") {
    assert.fail("expected tool block");
  }
  assert.equal(toolBlock.status, "completed");
  assert.equal(toolBlock.resultSeq, 3);
  assert.deepEqual(toolBlock.result, { value: "23%" });
  assert.equal(message.content, "Before tool");
});

test("TOOL_RESULT for unknown call_id does not crash or create a card", () => {
  const state = applyMessages(initialAgentState, [
    { type: "TOKEN", seq: 1, stream_id: "s-1", text: "Hello" },
  ]);

  const nextState = applyMessages(state, [
    { type: "TOOL_RESULT", seq: 2, stream_id: "s-1", call_id: "missing", result: { value: "x" } },
  ]);

  assert.deepEqual(nextState, state);
});

test("selectHasActiveAssistantStream returns false when no assistant stream exists", () => {
  assert.equal(selectHasActiveAssistantStream(initialAgentState), false);
});

test("selectHasActiveAssistantStream returns true when assistant status is streaming", () => {
  const state = applyMessages(initialAgentState, [
    { type: "TOKEN", seq: 1, stream_id: "s-1", text: "Hello" },
  ]);

  assert.equal(selectHasActiveAssistantStream(state), true);
});

test("selectHasActiveAssistantStream returns true when a waiting tool card exists", () => {
  const state = applyMessages(initialAgentState, [
    { type: "TOOL_CALL", seq: 1, stream_id: "s-1", call_id: "tc-1", tool_name: "search", args: { q: "sla" } },
  ]);

  assert.equal(selectHasActiveAssistantStream(state), true);
});

test("selectHasActiveAssistantStream returns false when all assistant messages are ended", () => {
  const state = applyMessages(initialAgentState, [
    { type: "TOKEN", seq: 1, stream_id: "s-1", text: "Hello" },
    { type: "STREAM_END", seq: 2, stream_id: "s-1" },
  ]);

  assert.equal(selectHasActiveAssistantStream(state), false);
});

test("active stream selector stays false when only user messages exist", () => {
  const userState = agentReducer(initialAgentState, {
    type: "ADD_USER_MESSAGE",
    message: {
      id: "user-1",
      role: "user",
      content: "hello",
      status: "ended",
    } satisfies ChatMessage,
  });

  assert.equal(selectHasActiveAssistantStream(userState), false);
});
