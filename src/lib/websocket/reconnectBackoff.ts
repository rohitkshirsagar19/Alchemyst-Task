export interface CreateReconnectBackoffOptions {
  initialMs: number;
  factor: number;
  maxMs: number;
}

export interface ReconnectBackoff {
  nextDelay(): number;
  reset(): void;
  getAttempt(): number;
}

export function createReconnectBackoff(options: CreateReconnectBackoffOptions): ReconnectBackoff {
  let attempt = 0;

  function nextDelay(): number {
    const delay = Math.min(
      options.initialMs * options.factor ** attempt,
      options.maxMs,
    );
    attempt += 1;
    return delay;
  }

  function reset(): void {
    attempt = 0;
  }

  function getAttempt(): number {
    return attempt;
  }

  return {
    nextDelay,
    reset,
    getAttempt,
  };
}
