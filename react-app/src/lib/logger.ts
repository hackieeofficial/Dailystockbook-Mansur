type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogPayload {
  timestamp: string;
  level: LogLevel;
  module: string;
  operation: string;
  message: string;
  version: string;
  userId?: string;
  userEmail?: string;
  error?: any;
  durationMs?: number;
  meta?: any;
}

// In-memory rolling buffer for the last 50 errors for debugging
const recentErrors: LogPayload[] = [];
const MAX_ERRORS = 50;

function pushToErrorBuffer(payload: LogPayload) {
  recentErrors.unshift(payload);
  if (recentErrors.length > MAX_ERRORS) {
    recentErrors.pop();
  }
}

export function getRecentErrors() {
  return [...recentErrors];
}

function log(level: LogLevel, module: string, operation: string, message: string, error?: any, meta?: any, durationMs?: number) {
  let user = null;
  try {
    const raw = sessionStorage.getItem('mansurActiveUser') || localStorage.getItem('mansurActiveUser');
    if (raw) user = JSON.parse(raw);
  } catch (e) {}

  const payload: LogPayload = {
    timestamp: new Date().toISOString(),
    level,
    module,
    operation,
    message,
    version: 'react-v1',
    userId: user?.uid,
    userEmail: user?.email,
  };

  if (error !== undefined) {
    // Attempt to extract useful info from error objects
    payload.error = error instanceof Error 
      ? { message: error.message, stack: error.stack, name: error.name } 
      : error;
  }
  
  if (durationMs !== undefined) {
    payload.durationMs = durationMs;
  }
  
  if (meta !== undefined) {
    payload.meta = meta;
  }

  // Format as a single-line JSON string for easy parsing, 
  // but we can also log the object directly to the console for better DevTools experience.
  const logString = JSON.stringify(payload);

  switch (level) {
    case 'DEBUG':
      console.debug(logString, payload);
      break;
    case 'INFO':
      console.info(logString, payload);
      break;
    case 'WARN':
      console.warn(logString, payload);
      break;
    case 'ERROR':
      pushToErrorBuffer(payload);
      console.error(logString, payload);
      break;
  }
}

export const logger = {
  debug: (module: string, operation: string, message: string, meta?: any) => 
    log('DEBUG', module, operation, message, undefined, meta),
    
  info: (module: string, operation: string, message: string, meta?: any) => 
    log('INFO', module, operation, message, undefined, meta),
    
  warn: (module: string, operation: string, message: string, error?: any, meta?: any) => 
    log('WARN', module, operation, message, error, meta),
    
  error: (module: string, operation: string, message: string, error?: any, meta?: any) => 
    log('ERROR', module, operation, message, error, meta),
    
  time: (module: string, operation: string) => {
    const start = performance.now();
    return (message: string = 'Operation complete', meta?: any) => {
      const durationMs = Math.round(performance.now() - start);
      log('INFO', module, operation, message, undefined, meta, durationMs);
    };
  }
};
