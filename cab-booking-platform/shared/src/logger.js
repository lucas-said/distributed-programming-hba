// Tiny structured logger. Avoids pulling in a heavy dep like winston/pino
// while still giving us timestamps and log levels.
const ts = () => new Date().toISOString();

export const logger = {
  info:  (...args) => console.log(  `[${ts()}] [INFO] `, ...args),
  warn:  (...args) => console.warn( `[${ts()}] [WARN] `, ...args),
  error: (...args) => console.error(`[${ts()}] [ERROR]`, ...args),
};
