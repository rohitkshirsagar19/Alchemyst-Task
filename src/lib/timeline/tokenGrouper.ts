import type { TimelineEvent, TimelineRowEvent, TokenGroupTimelineEvent } from "@/lib/timeline/types";

interface PendingTokenGroup {
  firstEvent: TimelineEvent;
  lastEvent: TimelineEvent;
  text: string;
  tokenCount: number;
}

export function groupTokenEvents(events: TimelineEvent[]): TimelineRowEvent[] {
  const rows: TimelineRowEvent[] = [];
  let pending: PendingTokenGroup | null = null;

  for (const event of events) {
    if (event.kind === "TOKEN" && event.streamId && event.seq !== undefined) {
      if (pending && pending.firstEvent.streamId === event.streamId) {
        pending = {
          firstEvent: pending.firstEvent,
          lastEvent: event,
          text: pending.text + payloadText(event),
          tokenCount: pending.tokenCount + 1,
        };
      } else {
        flushPending(rows, pending);
        pending = {
          firstEvent: event,
          lastEvent: event,
          text: payloadText(event),
          tokenCount: 1,
        };
      }
      continue;
    }

    flushPending(rows, pending);
    pending = null;
    rows.push(event);
  }

  flushPending(rows, pending);
  return rows;
}

function flushPending(rows: TimelineRowEvent[], pending: PendingTokenGroup | null): void {
  if (!pending) {
    return;
  }

  const seqStart = pending.firstEvent.seq ?? 0;
  const seqEnd = pending.lastEvent.seq ?? seqStart;
  const durationMs = Math.max(0, pending.lastEvent.timestamp - pending.firstEvent.timestamp);
  const group: TokenGroupTimelineEvent = {
    id: `token-group:${pending.firstEvent.streamId}:${seqStart}:${seqEnd}`,
    kind: "TOKEN_GROUP",
    direction: "inbound",
    timestamp: pending.firstEvent.timestamp,
    seqStart,
    seqEnd,
    streamId: pending.firstEvent.streamId ?? "unknown-stream",
    title: "TOKEN_GROUP",
    summary: `Streamed ${pending.tokenCount} tokens · seq ${seqStart}-${seqEnd} · ${formatDuration(durationMs)}`,
    payloadPreview: pending.text,
    payload: pending.text,
    relatedChatElementId: pending.firstEvent.relatedChatElementId,
    tokenCount: pending.tokenCount,
    text: pending.text,
  };

  rows.push(group);
}

function payloadText(event: TimelineEvent): string {
  return typeof event.payload === "string" ? event.payload : event.payloadPreview;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}
