// Server configuration type definitions

export interface ServerConfig {
  id: string;                    // UUID
  alias: string;                 // User-friendly name (e.g., "Local", "Homelab")
  wsUrl: string;                 // WebSocket URL (wss://... or ws://...)
  httpUrl: string;               // HTTP URL for health checks
  apiKey?: string;               // Optional API key for authenticated servers
  isDefault: boolean;            // Whether this is the origin-derived default
  createdAt: string;             // ISO timestamp
}

export interface ServerHealth {
  serverId: string;
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  lastChecked: string;           // ISO timestamp
  latencyMs?: number;
  error?: string;
}

export interface ServerConfigState {
  servers: ServerConfig[];
  activeServerId: string | null;
  healthStatus: Record<string, ServerHealth>;
  isLoading: boolean;
  isPanelOpen: boolean;
}

// Utility types
export type ServerHealthStatus = ServerHealth['status'];
export type PartialServerConfig = Partial<ServerConfig>;
export type ServerConfigInput = Omit<ServerConfig, 'id' | 'createdAt' | 'isDefault'>;

// Constants
export const STORAGE_KEY_SERVERS = 'serverConfig_servers';
export const STORAGE_KEY_ACTIVE = 'serverConfig_activeId';
export const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
export const HEALTH_CHECK_TIMEOUT = 5000;   // 5 seconds
export const MAX_SERVER_CONFIGS = 10;

// Health status values for validation
export const SERVER_HEALTH_STATUSES: readonly ServerHealthStatus[] = [
  'healthy',
  'degraded',
  'unhealthy',
  'unknown',
] as const;
