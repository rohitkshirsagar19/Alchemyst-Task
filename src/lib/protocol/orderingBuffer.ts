import type { ServerMessage } from "@/lib/protocol/types";

export interface CreateOrderingBufferOptions {
  initialExpectedSeq: number;
}

export interface ResetOrderingBufferOptions {
  initialExpectedSeq?: number;
}

export interface OrderedPushResult {
  accepted: "processed" | "buffered" | "duplicate";
  bufferedCount: number;
  expectedSeq: number;
  lastFullyProcessedSeq: number | null;
  processed: ServerMessage[];
  receivedSeq: number;
}

export interface OrderingBuffer {
  push(message: ServerMessage): OrderedPushResult;
  reset(options?: ResetOrderingBufferOptions): void;
  getLastFullyProcessedSeq(): number | null;
  getExpectedSeq(): number;
  getBufferedCount(): number;
  hasProcessed(seq: number): boolean;
}

export function createOrderingBuffer(options: CreateOrderingBufferOptions): OrderingBuffer {
  let expectedSeq = options.initialExpectedSeq;
  let lastFullyProcessedSeq: number | null = null;
  let buffer = new Map<number, ServerMessage>();
  let processedSeqs = new Set<number>();

  function push(message: ServerMessage): OrderedPushResult {
    const { seq } = message;

    if (processedSeqs.has(seq) || buffer.has(seq) || seq < expectedSeq) {
      return buildResult("duplicate", seq, []);
    }

    if (seq > expectedSeq) {
      buffer.set(seq, message);
      return buildResult("buffered", seq, []);
    }

    const processed: ServerMessage[] = [];
    acceptMessage(message, processed);

    while (buffer.has(expectedSeq)) {
      const nextMessage = buffer.get(expectedSeq);
      if (!nextMessage) {
        break;
      }

      buffer.delete(expectedSeq);
      acceptMessage(nextMessage, processed);
    }

    return buildResult("processed", seq, processed);
  }

  function reset(resetOptions?: ResetOrderingBufferOptions): void {
    expectedSeq = resetOptions?.initialExpectedSeq ?? options.initialExpectedSeq;
    lastFullyProcessedSeq = null;
    buffer = new Map<number, ServerMessage>();
    processedSeqs = new Set<number>();
  }

  function getLastFullyProcessedSeq(): number | null {
    return lastFullyProcessedSeq;
  }

  function getExpectedSeq(): number {
    return expectedSeq;
  }

  function getBufferedCount(): number {
    return buffer.size;
  }

  function hasProcessed(seq: number): boolean {
    return processedSeqs.has(seq);
  }

  function acceptMessage(message: ServerMessage, processed: ServerMessage[]): void {
    processedSeqs.add(message.seq);
    processed.push(message);
    expectedSeq = message.seq + 1;
    lastFullyProcessedSeq = message.seq;
  }

  function buildResult(
    accepted: OrderedPushResult["accepted"],
    receivedSeq: number,
    processed: ServerMessage[],
  ): OrderedPushResult {
    return {
      accepted,
      bufferedCount: buffer.size,
      expectedSeq,
      lastFullyProcessedSeq,
      processed,
      receivedSeq,
    };
  }

  return {
    push,
    reset,
    getLastFullyProcessedSeq,
    getExpectedSeq,
    getBufferedCount,
    hasProcessed,
  };
}
