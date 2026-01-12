export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp?: number;
  project_name?: string;
  agent_type?: string;
  agent_id?: string;
  cwd?: string;
}

export interface FilterOptions {
  source_apps: string[];
  session_ids: string[];
  hook_event_types: string[];
}

export interface WebSocketMessage {
  type: 'initial' | 'event' | 'auth_success' | 'auth_failed' | 'error';
  data?: HookEvent | HookEvent[];
  error?: string;
}

export type TimeRange = '1m' | '3m' | '5m';

export interface ChartDataPoint {
  timestamp: number;
  count: number;
  eventTypes: Record<string, number>; // event type -> count
  sessions: Record<string, number>; // session id -> count
}

export interface ChartConfig {
  maxDataPoints: number;
  animationDuration: number;
  barWidth: number;
  barGap: number;
  colors: {
    primary: string;
    glow: string;
    axis: string;
    text: string;
  };
}

// ============================================
// Grouped View Types (PRP-004)
// ============================================

/** Represents a consolidated tool call (PreToolUse + PostToolUse matched via tool_use_id) */
export interface ConsolidatedToolCall {
  id: string;                    // tool_use_id
  toolName: string;
  toolInput: Record<string, unknown>;
  preToolUseEvent: HookEvent;
  postToolUseEvent: HookEvent | null;  // null = still active
  isActive: boolean;             // true until PostToolUse received
  summary?: string;              // From PostToolUse event.summary
}

/** Represents an agent within a session */
export interface AgentState {
  agentId: string;
  agentType: string;
  sessionId: string;
  startTime: number;             // From SubagentStart timestamp
  endTime: number | null;        // From SubagentStop timestamp, null = active
  isActive: boolean;
  taskPreToolUseId: string | null;  // Links to Task tool that spawned this agent
  events: HookEvent[];           // All events for this agent
  consolidatedTools: ConsolidatedToolCall[];
  summary?: string;              // From Task PostToolUse summary
}

/** Represents a session within a project */
export interface SessionState {
  sessionId: string;
  sourceApp: string;
  events: HookEvent[];           // Session-level events (no agent_id, or Task tool events)
  agents: Map<string, AgentState>;  // agent_id -> AgentState
  consolidatedTools: ConsolidatedToolCall[];  // Session-level tool consolidation
}

/** Represents a project (source_app) */
export interface ProjectState {
  sourceApp: string;
  sessions: Map<string, SessionState>;  // session_id -> SessionState
}

/** Grouped view state */
export interface GroupedViewState {
  projects: Map<string, ProjectState>;  // source_app -> ProjectState
  pendingAgents: Map<string, { taskToolUseId: string; agentType: string }>;  // Awaiting SubagentStart
}