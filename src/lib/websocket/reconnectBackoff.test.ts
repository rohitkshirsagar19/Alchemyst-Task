import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createReconnectBackoff } from "@/lib/websocket/reconnectBackoff";

describe("createReconnectBackoff", () => {
  it("returns 500ms for the first delay", () => {
    const backoff = createReconnectBackoff({ initialMs: 500, factor: 2, maxMs: 10000 });
    assert.equal(backoff.nextDelay(), 500);
  });

  it("doubles each time until capped", () => {
    const backoff = createReconnectBackoff({ initialMs: 500, factor: 2, maxMs: 10000 });
    assert.deepEqual(
      [
        backoff.nextDelay(),
        backoff.nextDelay(),
        backoff.nextDelay(),
        backoff.nextDelay(),
      ],
      [500, 1000, 2000, 4000],
    );
  });

  it("caps at 10 seconds", () => {
    const backoff = createReconnectBackoff({ initialMs: 500, factor: 2, maxMs: 10000 });
    assert.deepEqual(
      [
        backoff.nextDelay(),
        backoff.nextDelay(),
        backoff.nextDelay(),
        backoff.nextDelay(),
        backoff.nextDelay(),
        backoff.nextDelay(),
        backoff.nextDelay(),
      ],
      [500, 1000, 2000, 4000, 8000, 10000, 10000],
    );
  });

  it("reset returns back to 500ms", () => {
    const backoff = createReconnectBackoff({ initialMs: 500, factor: 2, maxMs: 10000 });
    backoff.nextDelay();
    backoff.nextDelay();
    backoff.reset();
    assert.equal(backoff.nextDelay(), 500);
  });

  it("tracks attempt count", () => {
    const backoff = createReconnectBackoff({ initialMs: 500, factor: 2, maxMs: 10000 });
    assert.equal(backoff.getAttempt(), 0);
    backoff.nextDelay();
    backoff.nextDelay();
    assert.equal(backoff.getAttempt(), 2);
  });
});
