import { useEffect, useMemo, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { WS_BASE_URL } from '@/shared/infrastructure/api/runtimeEndpoint';

type UseWebSocketOptions<T> = {
  url?: string;
  eventName: string;
  enabled?: boolean;
  validatePayload?: (payload: unknown) => payload is T;
};

export function useWebSocket<T>({
  url,
  eventName,
  enabled = true,
  validatePayload
}: UseWebSocketOptions<T>) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const endpoint = useMemo(() => url ?? WS_BASE_URL, [url]);

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const socket = io(endpoint, {
      transports: ['websocket']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
      setError(null);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    socket.on('connect_error', (err) => {
      setError(err.message);
    });

    socket.on(eventName, (payload: unknown) => {
      if (validatePayload && !validatePayload(payload)) {
        return;
      }

      setLastMessage(payload as T);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, endpoint, eventName, validatePayload]);

  return {
    isConnected,
    lastMessage,
    error
  };
}
