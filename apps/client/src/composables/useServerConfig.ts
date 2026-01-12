import { ref, computed, readonly, onMounted } from 'vue';
import type { ServerConfig, ServerHealth, ServerConfigState } from '../types/server';
import {
  STORAGE_KEY_SERVERS,
  STORAGE_KEY_ACTIVE,
  HEALTH_CHECK_INTERVAL,
  HEALTH_CHECK_TIMEOUT,
  MAX_SERVER_CONFIGS
} from '../types/server';

// ============================================================================
// Module-level state (singleton pattern)
// ============================================================================

/**
 * Shared state across all component instances.
 * Declared at module level to ensure singleton behavior.
 */
const state = ref<ServerConfigState>({
  servers: [],
  activeServerId: null,
  healthStatus: {},
  isLoading: false,
  isPanelOpen: false
});

/**
 * Tracks whether initialization has occurred to prevent duplicate init/intervals.
 */
let isInitialized = false;

/**
 * Server configuration composable for multi-server connection management.
 * Handles server list persistence, health monitoring, and active server switching.
 *
 * Uses singleton pattern - all components share the same state instance.
 */
export function useServerConfig() {

  // ============================================================================
  // Computed
  // ============================================================================

  /**
   * The currently active server configuration, or null if none selected.
   */
  const activeServer = computed(() =>
    state.value.servers.find(s => s.id === state.value.activeServerId) ?? null
  );

  /**
   * WebSocket URL for the active server, or null if none selected.
   */
  const activeWsUrl = computed(() => activeServer.value?.wsUrl ?? null);

  // ============================================================================
  // Core Functions
  // ============================================================================

  /**
   * Derives the default server configuration from the current page origin.
   * Uses wss:// for HTTPS pages and ws:// for HTTP pages.
   */
  const deriveDefaultServer = (): ServerConfig => {
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const httpProtocol = window.location.protocol;

    return {
      id: 'default-origin',
      alias: window.location.hostname === 'localhost' ? 'Local' : 'Origin',
      wsUrl: `${wsProtocol}//${window.location.host}/stream`,
      httpUrl: `${httpProtocol}//${window.location.host}/events/filter-options`,
      isDefault: true,
      createdAt: new Date().toISOString()
    };
  };

  /**
   * Performs a health check on a single server.
   * Uses the /events/filter-options endpoint which is CORS-enabled.
   * Sends Authorization header if apiKey is configured.
   *
   * @param server - The server configuration to check
   * @returns ServerHealth object with status and timing information
   */
  const checkServerHealth = async (server: ServerConfig): Promise<ServerHealth> => {
    const startTime = Date.now();
    try {
      const headers: Record<string, string> = {};
      if (server.apiKey) {
        headers['Authorization'] = `Bearer ${server.apiKey}`;
      }

      const response = await fetch(server.httpUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT)
      });

      return {
        serverId: server.id,
        status: response.ok ? 'healthy' : 'degraded',
        lastChecked: new Date().toISOString(),
        latencyMs: Date.now() - startTime
      };
    } catch (error) {
      return {
        serverId: server.id,
        status: 'unhealthy',
        lastChecked: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  };

  /**
   * Checks health of all configured servers in parallel.
   * Updates state.healthStatus with results.
   */
  const checkAllHealth = async (): Promise<void> => {
    const checks = state.value.servers.map(checkServerHealth);
    const results = await Promise.all(checks);

    results.forEach(health => {
      state.value.healthStatus[health.serverId] = health;
    });
  };

  /**
   * Adds a new server configuration.
   * Enforces MAX_SERVER_CONFIGS limit.
   *
   * @param config - Server configuration without id, createdAt, and isDefault
   * @returns The created ServerConfig or null if limit exceeded
   */
  const addServer = (
    config: Omit<ServerConfig, 'id' | 'createdAt' | 'isDefault'>
  ): ServerConfig | null => {
    if (state.value.servers.length >= MAX_SERVER_CONFIGS) {
      console.warn(`Cannot add server: maximum of ${MAX_SERVER_CONFIGS} servers reached`);
      return null;
    }

    const server: ServerConfig = {
      ...config,
      id: crypto.randomUUID(),
      isDefault: false,
      createdAt: new Date().toISOString()
    };

    state.value.servers.push(server);
    saveToStorage();

    // Check health asynchronously
    checkServerHealth(server).then(health => {
      state.value.healthStatus[server.id] = health;
    });

    return server;
  };

  /**
   * Removes a server configuration by ID.
   * Cannot remove the default server.
   * Falls back activeServerId if the removed server was active.
   *
   * @param id - Server ID to remove
   * @returns true if removed, false if not found or is default
   */
  const removeServer = (id: string): boolean => {
    const server = state.value.servers.find(s => s.id === id);
    if (!server) return false;
    if (server.isDefault) {
      console.warn('Cannot remove default server');
      return false;
    }

    state.value.servers = state.value.servers.filter(s => s.id !== id);
    delete state.value.healthStatus[id];

    // Fallback active server if needed
    if (state.value.activeServerId === id) {
      const fallback = state.value.servers.find(s => s.isDefault) ?? state.value.servers[0];
      state.value.activeServerId = fallback?.id ?? null;
    }

    saveToStorage();
    return true;
  };

  /**
   * Sets the active server by ID.
   * Only updates if the server exists.
   *
   * @param id - Server ID to make active
   */
  const setActiveServer = (id: string): void => {
    if (state.value.servers.some(s => s.id === id)) {
      state.value.activeServerId = id;
      saveToStorage();
    }
  };

  /**
   * Updates an existing server configuration.
   * Cannot update id, isDefault, or createdAt fields.
   *
   * @param id - Server ID to update
   * @param updates - Partial server config with fields to update
   * @returns true if updated, false if server not found
   */
  const updateServer = (
    id: string,
    updates: Partial<Omit<ServerConfig, 'id' | 'isDefault' | 'createdAt'>>
  ): boolean => {
    const index = state.value.servers.findIndex(s => s.id === id);
    if (index === -1) return false;

    state.value.servers[index] = {
      ...state.value.servers[index],
      ...updates
    };
    saveToStorage();

    // Re-check health if URL changed
    if (updates.httpUrl) {
      checkServerHealth(state.value.servers[index]).then(health => {
        state.value.healthStatus[id] = health;
      });
    }

    return true;
  };

  /**
   * Opens the server configuration panel.
   */
  const openPanel = (): void => {
    state.value.isPanelOpen = true;
  };

  /**
   * Closes the server configuration panel.
   */
  const closePanel = (): void => {
    state.value.isPanelOpen = false;
  };

  // ============================================================================
  // Utility Functions
  // ============================================================================

  /**
   * Saves server list and active server ID to localStorage.
   */
  const saveToStorage = (): void => {
    try {
      localStorage.setItem(STORAGE_KEY_SERVERS, JSON.stringify(state.value.servers));
      localStorage.setItem(STORAGE_KEY_ACTIVE, state.value.activeServerId ?? '');
    } catch (error) {
      console.warn('Failed to save server config to localStorage:', error);
    }
  };

  /**
   * Loads server list and active server ID from localStorage.
   * Falls back to empty arrays on parse errors.
   */
  const loadFromStorage = (): void => {
    try {
      const storedServers = localStorage.getItem(STORAGE_KEY_SERVERS);
      const storedActive = localStorage.getItem(STORAGE_KEY_ACTIVE);

      if (storedServers) {
        state.value.servers = JSON.parse(storedServers);
      }
      if (storedActive) {
        state.value.activeServerId = storedActive || null;
      }
    } catch (error) {
      console.warn('Failed to load server config from localStorage:', error);
      state.value.servers = [];
      state.value.activeServerId = null;
    }
  };

  // ============================================================================
  // Lifecycle
  // ============================================================================

  /**
   * Initializes the server configuration:
   * 1. Loads from localStorage
   * 2. Ensures default server exists
   * 3. Sets active server if not set
   * 4. Triggers health checks
   */
  const initialize = (): void => {
    loadFromStorage();

    // Ensure default server exists
    const hasDefault = state.value.servers.some(s => s.isDefault);
    if (!hasDefault) {
      const defaultServer = deriveDefaultServer();
      state.value.servers.unshift(defaultServer);
    }

    // Set active to default if not set
    if (!state.value.activeServerId) {
      const defaultServer = state.value.servers.find(s => s.isDefault);
      state.value.activeServerId = defaultServer?.id ?? state.value.servers[0]?.id ?? null;
    }

    saveToStorage();
    checkAllHealth();
  };

  onMounted(() => {
    // Only initialize once across all component instances (singleton pattern)
    if (!isInitialized) {
      isInitialized = true;
      initialize();

      // Periodic health checks - only set once
      setInterval(checkAllHealth, HEALTH_CHECK_INTERVAL);
    }
  });

  // ============================================================================
  // Public API
  // ============================================================================

  return {
    // State (readonly)
    state: readonly(state),

    // Computed
    activeServer,
    activeWsUrl,

    // Core functions
    addServer,
    removeServer,
    updateServer,
    setActiveServer,
    checkServerHealth,
    checkAllHealth,

    // Panel controls
    openPanel,
    closePanel,

    // Initialization (for manual calling if needed)
    initialize
  };
}
