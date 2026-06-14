# DECISIONS.md

## 1. Architecture Overview
The core architectural decision was to treat the frontend as a protocol client first and a React application second. The runtime pipeline is:

```txt
WebSocketManager
  → safe parser / validator
  → immediate protocol side effects
  → seq ordering buffer
  → app state reducers
  → derived UI panels
```

`WebSocketManager` owns socket lifecycle and raw transport concerns. Raw-path side effects exist only for latency-sensitive protocol obligations: `PONG` and `TOOL_ACK`. Everything user-visible still flows through ordered validated events, which keeps React rendering isolated from transport timing and chaos-mode disorder.

This separation matters because the protocol has obligations that are faster than the UI path. The chat panel, timeline, and context inspector all derive from ordered state, while protocol liveness remains close to the socket.

## 2. Seq Ordering and Deduplication
The ordering layer uses four pieces of state:

```txt
expectedSeq: next processable sequence number
buffer: Map<number, ServerMessage>
processedSeqs: Set<number>
lastFullyProcessedSeq: highest seq released and consumed
```

`Map` is the right fit for future messages because lookup by sequence number is O(1). `Set` is the right fit for duplicate suppression for the same reason. `expectedSeq` gives a simple contiguous flush model: if a message arrives ahead of the current gap, it is buffered; when the missing seq arrives, the buffer drains in order.

`lastFullyProcessedSeq` is intentionally different from “last received seq”. A received seq may still be buffered, ignored as duplicate, or not yet applied into app state. `RESUME` is only safe when it references the highest seq already released by the ordering buffer and consumed by reducers.

Behavior under load is deliberately explicit:
- future seq values are buffered
- the current `expectedSeq` is processed immediately
- buffered values flush while contiguous seqs exist
- duplicate or late events are ignored and surfaced in the timeline
- stale buffered state is discarded on reconnect and reinitialized to `lastSeq + 1`

Normal mode is gapless, but chaos mode can reorder and duplicate aggressively, so the ordering layer is the gatekeeper for every user-visible state update.

## 3. Tool Call Rendering and Layout Stability
Assistant turns are keyed by `stream_id`. Each assistant message contains ordered `blocks`, where each block is either text or tool state.

This block model solved the main rendering problem: token streaming and tool interruptions are not one linear string. `TOKEN` events append to the current text block. `TOOL_CALL` freezes whatever text block currently exists and appends a tool block. `TOOL_RESULT` updates that same tool block by `call_id`. Later `TOKEN` events continue in a later text block rather than rewriting earlier content.

This avoids several failure modes at once:
- flicker from replacing the whole assistant message
- overwritten tool cards when multiple tools occur in one stream
- duplicated text after tool results or replay
- layout instability caused by rebuilding the entire assistant bubble on every event

The reducer also supports edge cases that the backend exercises:
- tool call before any text
- multiple stacked tool calls in one stream
- tool results that update cards without appending JSON into assistant prose

## 4. Reconnection and State Recovery
Unexpected close and manual disconnect are treated differently. Manual disconnect is terminal for that session and does not schedule reconnect. Unexpected close/error enters exponential backoff with `500ms → 1s → 2s → 4s → 8s → 10s cap`.

UI state is preserved during reconnect. Existing chat, tool cards, timeline rows, and context snapshots remain visible. The input is disabled while reconnecting/resuming so a new prompt cannot corrupt the global ordered stream.

On reopen, the client sends `RESUME` first. The payload uses `lastFullyProcessedSeq`, not the last raw inbound seq. Before replay is consumed, the ordering buffer is reset to `lastSeq + 1`, which makes the replay authoritative and prevents stale buffered messages from the dead socket from contaminating the new session.

Replay then passes through the exact same validation, ordering, dedupe, reducer, and selector path as live traffic. That means:
- replayed tokens do not duplicate text
- replayed `TOOL_RESULT` updates the existing waiting card
- replayed context snapshots dedupe by `context_id + seq`
- duplicate timeline-worthy protocol events become explicit duplicate markers, not double-rendered state

One additional hardening decision from chaos-mode testing was to block overlapping prompts while an assistant turn is still active. The backend uses one ordered seq stream per turn, and resetting ordering state during an active stream caused corruption. The frontend now treats “active assistant stream” as a send guard.

## 5. Timeline and Context Inspector
The timeline is a debugging surface, not just an activity feed. It records inbound, outbound, and internal events so protocol behavior is inspectable during failure cases. Consecutive `TOKEN` events are grouped into `TOKEN_GROUP` rows so the UI does not render one row per token burst. Tool call, ack, and result rows are linked by `call_id`, and internal states such as `BUFFERED`, `DUPLICATE_IGNORED`, and skipped duplicate ACKs are shown instead of being silently swallowed.

Search and filtering operate on precomputed lightweight fields such as title, summary, ids, and payload preview. That keeps the timeline useful under high event rates without repeated heavy stringification.

The context inspector stores snapshots by `context_id`, computes diffs when snapshots arrive, and renders JSON lazily. The key choice there was to move work to ingest time where possible: diff now, render later. Large payloads such as the 500KB+ schema snapshot are not recursively dumped into the DOM. The tree renders top-level branches first, expands children lazily, and keeps snapshot history separate from chat/timeline state.

## 6. Protocol Race Conditions and Failure Modes
The most important race discovered during implementation was around `TOOL_ACK`.

In chaos mode, a `TOOL_CALL` can be received by the client while earlier seq gaps keep it buffered. If ACK is sent only after ordered rendering, the backend timer can expire before the card reaches the ordered UI path. That produced `TOOL_ACK_TIMEOUT` followed by a late `TOOL_ACK` with verdict `unexpected`.

The fix was to separate protocol liveness from ordered UI rendering:
- `TOOL_ACK` is sent from the raw valid `TOOL_CALL` path
- ACK is deduped by `call_id`
- chat rendering still happens only through ordered events
- if the socket dies after the client receives a `TOOL_CALL` but before ACK is sent, the ACK is queued and flushed immediately after `RESUME`

That design keeps UI ordering correct while meeting the server’s ACK timer as aggressively as possible.

Heartbeat handling had a similar but simpler failure mode. The backend can emit a corrupt `PING` with an empty challenge. The client treats that as valid enough to echo: `PONG { echo: "" }`. This keeps the connection alive and avoids conflating protocol oddity with fatal parse failure.

There is one impossible case worth stating explicitly: if the server drops before the client ever receives a `TOOL_CALL` frame, the client cannot ACK what it never received. The implementation covers the received-but-unsent race, not nonexistent delivery.

## 7. If This Needed 50 Concurrent Agent Streams
For an operations dashboard, I would avoid one large React-invalidating state object for everything. The current design is fine for one interactive console, but 50 streams would require stronger partitioning.

I would change the system in these ways:
- keep protocol engine state indexed per connection/session
- keep stream-specific UI state partitioned so one active stream does not re-render all others
- virtualize both chat and timeline panels
- introduce bounded event retention and compact old timeline/token rows
- offload large diffing and possibly token grouping to a Worker
- add health summaries per stream instead of relying on full-detail panels for every one
- add render throttling/backpressure for high-rate streams

If all 50 streams shared one socket with one global seq, one ordering buffer would still be required at the transport layer. If they each had independent sockets/sessions, each would need its own protocol engine and resume state.

## 8. If Responses Were 100x Longer
The current chat renderer is intentionally simple, but 100x longer responses would stress both memory and React rendering.

I would change the storage model first:
- avoid one ever-growing string per message
- store completed text in chunk or rope-like segments
- compact token groups after stream end
- checkpoint completed streams so replay state does not depend on giant in-memory strings
- move searchable completed content into IndexedDB or another persistent log

UI-side, I would:
- virtualize long chat transcripts
- virtualize timeline history
- reduce retained payload detail for older events
- build search/indexes over completed chunks rather than raw token arrays
- move heavyweight markdown or rich-text processing off the main thread

The same principle applies as in chaos mode: correctness first, then bounded rendering cost.

## 9. Testing Strategy
The project currently has `66 tests passing` and focuses on pure logic first.

Covered areas:
- ordering buffer
- token grouping
- JSON diff
- reconnect backoff
- chat store/reducer
- active assistant stream selector
- context state helpers
- timeline selectors
- protocol validators

This coverage is intentionally biased toward the parts most likely to create silent corruption: ordering, replay safety, dedupe, reducer behavior, and diff logic.

Manual validation was still necessary for:
- `WebSocketManager` lifecycle
- reconnect and `RESUME`
- queued ACK flush after reconnect
- timeline/chat/context scrolling and highlighting
- full chaos-mode scenarios

WebSocket lifecycle is manually validated because a clean browser WebSocket harness was not added for this assignment. I preferred strong pure-logic coverage plus repeated browser-backed chaos verification over a brittle socket mock that would create false confidence.

## 10. Known Tradeoffs
A few tradeoffs are intentional rather than accidental:
- WebSocket lifecycle is manually tested rather than fully automated.
- Large context diffing still happens on the main thread; for multi-megabyte payloads, a Worker would be preferable.
- The UI prioritizes observability and correctness over visual polish.
- The timeline retains enough protocol detail for debugging; a production deployment would likely apply stronger retention and compaction policies.

These are scope decisions, not protocol shortcuts. The implemented system is optimized to be understandable under failure, which was the main goal of the assignment.
