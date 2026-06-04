export type LogLevel = 'INFO' | 'WARN' | 'ERROR';

export type StructuredLogPayload = {
  event: string;
  module: string;
  details?: Record<string, unknown>;
};

const serialize = (payload: StructuredLogPayload, level: LogLevel) =>
  JSON.stringify({
    level,
    timestamp: new Date().toISOString(),
    ...payload
  });

export const logInfo = (payload: StructuredLogPayload) => {
  // eslint-disable-next-line no-console
  console.info(serialize(payload, 'INFO'));
};

export const logWarn = (payload: StructuredLogPayload) => {
  // eslint-disable-next-line no-console
  console.warn(serialize(payload, 'WARN'));
};

export const logError = (payload: StructuredLogPayload) => {
  // eslint-disable-next-line no-console
  console.error(serialize(payload, 'ERROR'));
};
