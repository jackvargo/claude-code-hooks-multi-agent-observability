import { ref, watch, computed, type Ref } from 'vue';
import type {
  HookEvent,
  GroupedViewState,
  ProjectState,
  SessionState,
  AgentState,
  ConsolidatedToolCall
} from '../types';

export function useEventGrouping(events: Ref<HookEvent[]>) {
  const groupedState = ref<GroupedViewState>({
    projects: new Map(),
    pendingAgents: new Map()
  });

  // Determine if event belongs to agent card or session list
  function shouldRouteToAgent(event: HookEvent): boolean {
    // Task tool events stay in session list (they spawn agents, but the Task event itself is session-level)
    if (event.payload?.tool_name === 'Task') return false;
    // Events with agent_id go to agent card
    return !!event.agent_id;
  }

  // Create or get project
  function ensureProject(sourceApp: string): ProjectState {
    if (!groupedState.value.projects.has(sourceApp)) {
      groupedState.value.projects.set(sourceApp, {
        sourceApp,
        sessions: new Map()
      });
    }
    return groupedState.value.projects.get(sourceApp)!;
  }

  // Create or get session
  function ensureSession(project: ProjectState, sessionId: string, sourceApp: string): SessionState {
    if (!project.sessions.has(sessionId)) {
      project.sessions.set(sessionId, {
        sessionId,
        sourceApp,
        events: [],
        agents: new Map(),
        consolidatedTools: []
      });
    }
    return project.sessions.get(sessionId)!;
  }

  // Create consolidated tool entry
  function createConsolidatedTool(event: HookEvent): ConsolidatedToolCall | null {
    const toolUseId = event.payload?.tool_use_id;
    if (!toolUseId) return null;

    return {
      id: toolUseId,
      toolName: event.payload.tool_name || 'Unknown',
      toolInput: event.payload.tool_input || {},
      preToolUseEvent: event,
      postToolUseEvent: null,
      isActive: true
    };
  }

  // Process a single event
  function processEvent(event: HookEvent): void {
    const { source_app, session_id, agent_id, agent_type, hook_event_type } = event;

    // Ensure project and session exist
    const project = ensureProject(source_app);
    const session = ensureSession(project, session_id, source_app);

    // Handle SubagentStart - create agent
    if (hook_event_type === 'SubagentStart' && agent_id) {
      if (!session.agents.has(agent_id)) {
        session.agents.set(agent_id, {
          agentId: agent_id,
          agentType: agent_type || 'unknown',
          sessionId: session_id,
          startTime: event.timestamp || Date.now(),
          endTime: null,
          isActive: true,
          taskPreToolUseId: null,
          events: [event],
          consolidatedTools: []
        });
      } else {
        // Agent already exists, just add the event
        const agent = session.agents.get(agent_id)!;
        agent.events.push(event);
      }
      return;
    }

    // Handle SubagentStop - mark inactive
    if (hook_event_type === 'SubagentStop' && agent_id) {
      const agent = session.agents.get(agent_id);
      if (agent) {
        agent.isActive = false;
        agent.endTime = event.timestamp || Date.now();
        agent.events.push(event);
        // Extract summary if available
        if (event.summary) {
          agent.summary = event.summary;
        }
      }
      return;
    }

    // Handle tool consolidation for PreToolUse/PostToolUse
    const toolUseId = event.payload?.tool_use_id;

    if (hook_event_type === 'PreToolUse' && toolUseId) {
      const consolidated = createConsolidatedTool(event);
      if (consolidated) {
        if (shouldRouteToAgent(event) && agent_id) {
          const agent = session.agents.get(agent_id);
          if (agent) {
            agent.events.push(event);
            agent.consolidatedTools.push(consolidated);
          } else {
            // Agent doesn't exist yet - fallback to session
            session.events.push(event);
            session.consolidatedTools.push(consolidated);
          }
        } else {
          session.events.push(event);
          session.consolidatedTools.push(consolidated);
        }
      }
      return;
    }

    if (hook_event_type === 'PostToolUse' && toolUseId) {
      // Find and update the consolidated tool
      if (shouldRouteToAgent(event) && agent_id) {
        const agent = session.agents.get(agent_id);
        if (agent) {
          agent.events.push(event);
          const consolidated = agent.consolidatedTools.find(t => t.id === toolUseId);
          if (consolidated) {
            consolidated.postToolUseEvent = event;
            consolidated.isActive = false;
            consolidated.summary = event.summary;
          }
        } else {
          // Agent doesn't exist - fallback to session
          session.events.push(event);
          const consolidated = session.consolidatedTools.find(t => t.id === toolUseId);
          if (consolidated) {
            consolidated.postToolUseEvent = event;
            consolidated.isActive = false;
            consolidated.summary = event.summary;
          }
        }
      } else {
        session.events.push(event);
        const consolidated = session.consolidatedTools.find(t => t.id === toolUseId);
        if (consolidated) {
          consolidated.postToolUseEvent = event;
          consolidated.isActive = false;
          consolidated.summary = event.summary;
        }
      }
      return;
    }

    // Route other events to agent or session
    if (shouldRouteToAgent(event) && agent_id) {
      const agent = session.agents.get(agent_id);
      if (agent) {
        agent.events.push(event);
      }
    } else {
      session.events.push(event);
    }
  }

  // Rebuild state from events array
  function rebuildState(eventsList: HookEvent[]): void {
    groupedState.value = {
      projects: new Map(),
      pendingAgents: new Map()
    };
    eventsList.forEach(processEvent);
  }

  // Watch events and rebuild state
  watch(events, (newEvents) => {
    rebuildState(newEvents);
  }, { immediate: true, deep: true });

  // Get sorted agents for a session
  function getSortedAgents(session: SessionState): AgentState[] {
    const agents = Array.from(session.agents.values());
    // Active agents first (sorted by start time, longest running first)
    // Then inactive agents (sorted by end time, most recent first)
    const active = agents.filter(a => a.isActive).sort((a, b) => a.startTime - b.startTime);
    const inactive = agents.filter(a => !a.isActive).sort((a, b) => (b.endTime || 0) - (a.endTime || 0));
    return [...active, ...inactive];
  }

  // Get sorted projects
  const sortedProjects = computed(() => {
    return Array.from(groupedState.value.projects.values());
  });

  // Get sorted sessions for a project
  function getSortedSessions(project: ProjectState): SessionState[] {
    return Array.from(project.sessions.values());
  }

  return {
    groupedState,
    getSortedAgents,
    getSortedSessions,
    sortedProjects,
    rebuildState
  };
}
