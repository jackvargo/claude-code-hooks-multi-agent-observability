import { ref, onMounted, onUnmounted } from 'vue';
import type { HookEvent, WebSocketMessage } from '../types';

export function useWebSocket(url: string, apiKey?: string) {
  const events = ref<HookEvent[]>([]);
  const isConnected = ref(false);
  const isAuthenticated = ref(false);
  const error = ref<string | null>(null);

  let ws: WebSocket | null = null;
  let reconnectTimeout: number | null = null;

  // Store URL and apiKey in mutable variables so reconnect can change them
  let currentUrl = url;
  let currentApiKey = apiKey;
  
  // Get max events from environment variable or use default
  const maxEvents = parseInt(import.meta.env.VITE_MAX_EVENTS_TO_DISPLAY || '100');
  
  const connect = () => {
    try {
      ws = new WebSocket(currentUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        isConnected.value = true;
        error.value = null;

        // Send auth if apiKey is configured
        if (currentApiKey) {
          console.log('Sending WebSocket auth...');
          ws!.send(JSON.stringify({ type: 'auth', token: currentApiKey }));
        } else {
          // No API key - assume local dev, mark as authenticated
          isAuthenticated.value = true;
        }
      };
      
      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Handle auth responses
          if (message.type === 'auth_success') {
            console.log('WebSocket authenticated');
            isAuthenticated.value = true;
            return;
          }

          if (message.type === 'auth_failed') {
            console.error('WebSocket auth failed:', message.error);
            error.value = 'Authentication failed';
            isAuthenticated.value = false;
            // Don't auto-reconnect on auth failure
            if (reconnectTimeout) {
              clearTimeout(reconnectTimeout);
              reconnectTimeout = null;
            }
            return;
          }

          // Only process data messages if authenticated (or no apiKey required)
          if (!isAuthenticated.value && currentApiKey) {
            console.warn('Received data before authentication');
            return;
          }

          if (message.type === 'initial') {
            const initialEvents = Array.isArray(message.data) ? message.data : [];
            // Only keep the most recent events up to maxEvents
            events.value = initialEvents.slice(-maxEvents);
          } else if (message.type === 'event') {
            const newEvent = message.data as HookEvent;
            events.value.push(newEvent);

            // Limit events array to maxEvents, removing the oldest when exceeded
            if (events.value.length > maxEvents) {
              // Remove the oldest events (first 10) when limit is exceeded
              events.value = events.value.slice(events.value.length - maxEvents + 10);
            }
          }
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };
      
      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        error.value = 'WebSocket connection error';
      };
      
      ws.onclose = (closeEvent) => {
        console.log('WebSocket disconnected');
        isConnected.value = false;
        isAuthenticated.value = false;

        // Don't auto-reconnect if auth failed (code 4001)
        if (closeEvent.code === 4001) {
          console.log('Connection closed due to auth failure, not reconnecting');
          return;
        }

        // Attempt to reconnect after 3 seconds
        reconnectTimeout = window.setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      };
    } catch (err) {
      console.error('Failed to connect:', err);
      error.value = 'Failed to connect to server';
    }
  };
  
  const disconnect = () => {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }

    if (ws) {
      ws.close();
      ws = null;
    }
  };

  // Reconnect to a new URL (for server switching)
  const reconnect = (newUrl: string, newApiKey?: string) => {
    // Close existing connection (also clears reconnect timeout)
    disconnect();

    // Clear events for new server
    events.value = [];
    isAuthenticated.value = false;

    // Update URL, apiKey and reconnect
    currentUrl = newUrl;
    currentApiKey = newApiKey;
    connect();
  };

  onMounted(() => {
    connect();
  });
  
  onUnmounted(() => {
    disconnect();
  });
  
  return {
    events,
    isConnected,
    isAuthenticated,
    error,
    reconnect,
    disconnect
  };
}