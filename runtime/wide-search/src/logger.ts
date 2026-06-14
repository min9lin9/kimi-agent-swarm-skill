export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

interface MutableLogger extends Logger {
  setLevel(level: LogLevel): void;
}

function makeLogger(level: LogLevel = 'info'): MutableLogger {
  let currentLevel = LEVELS[level] ?? LEVELS.info;

  function log(
    methodLevel: LogLevel,
    consoleMethod: 'log' | 'error' | 'warn',
    message: string,
    args: unknown[]
  ): void {
    if (LEVELS[methodLevel] < currentLevel) {
      return;
    }
    if (args.length > 0) {
      // eslint-disable-next-line no-console
      console[consoleMethod](message, ...args);
    } else {
      // eslint-disable-next-line no-console
      console[consoleMethod](message);
    }
  }

  return {
    debug: (message, ...args) => log('debug', 'log', message, args),
    info: (message, ...args) => log('info', 'error', message, args),
    warn: (message, ...args) => log('warn', 'error', message, args),
    error: (message, ...args) => log('error', 'error', message, args),
    setLevel: (level) => {
      currentLevel = LEVELS[level] ?? LEVELS.info;
    },
  };
}

export function createLogger(level?: LogLevel): Logger {
  return makeLogger(level);
}

export const defaultLogger: MutableLogger = makeLogger('info');

export function setDefaultLoggerLevel(level: LogLevel): void {
  defaultLogger.setLevel(level);
}
