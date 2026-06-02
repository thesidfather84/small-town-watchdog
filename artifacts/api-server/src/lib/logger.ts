// Simple console-based logger — no worker threads, works in any serverless environment
type LogFn = (obj: unknown, msg?: string) => void;
const make = (fn: (...args: unknown[]) => void) => (obj: unknown, msg?: string) => {
  if (msg) fn(msg, obj);
  else fn(obj);
};
export const logger = {
  info:  make(console.log),
  warn:  make(console.warn),
  error: make(console.error),
  debug: make(console.debug),
};
