export function assertNever(value: never, context?: string): never {
  const prefix = context ? `${context}: ` : "";
  throw new Error(`${prefix}Unhandled case: ${String(value)}`);
}
