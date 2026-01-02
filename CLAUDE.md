# Claude Code Hooks Multi-Agent Observability

## Overview

Real-time observability dashboard for Claude Code hook events. Captures hook lifecycle events (PreToolUse, PostToolUse, Notification, Stop, etc.) and displays them in a web UI for monitoring and debugging multi-agent workflows.

## Architecture

### Project Structure
```
.
├── .claude/hooks/       # Python hook scripts that send events
├── apps/
│   ├── server/          # Bun/Hono backend with SQLite
│   ├── client/          # Vue 3 frontend dashboard
│   └── agent-runner/    # Agent orchestration
├── PRPs/                # Project Requirement Plans
└── ai_docs/             # AI-generated documentation
```

### Technology Stack
- **Hooks**: Python 3 scripts with httpx
- **Server**: Bun + Hono + SQLite (better-sqlite3)
- **Client**: Vue 3 + TypeScript + Vite + TailwindCSS
- **Package Manager**: bun (apps), uv (Python hooks)

### Key Components

**Hook Scripts** (`.claude/hooks/`)
- `send_event.py` - Main event sender with agent ID correlation
- `notification.py` - Handles notification hook events
- `stop.py` - Handles stop hook events
- `subagent_stop.py` - Handles subagent completion

**Server** (`apps/server/`)
- SQLite database for event storage
- REST API for event ingestion and retrieval
- WebSocket support for real-time updates

**Client** (`apps/client/`)
- Real-time event feed with filtering
- Agent ID badges for subagent correlation
- Mobile-responsive design
- **Grouped View** (`components/grouped/`): Hierarchical visualization with Project → Session → Agent cards
- **Tool Consolidation**: PreToolUse + PostToolUse events merged by `tool_use_id`
- **Active Indicators**: Pulsing dots for running agents and pending tool calls

## Development

### Running the Server
```bash
cd apps/server && bun run dev
```

### Running the Client
```bash
cd apps/client && bun run dev
```

### Testing Hooks
Hook scripts are triggered by Claude Code automatically. Events are sent to `http://localhost:3008/api/events`.

## Vective System

This project uses the Vective System for structured development.

- PRPs stored in: `PRPs/`
- Templates: `PRPs/templates/`
- Config reference: `PRPs/config/`

See `PRPs/config/CLAUDE.vective.md` for complete system documentation.

## Client Architecture

### View Modes
- **Flat List** (toggle OFF): Traditional chronological event feed via `EventRow.vue`
- **Grouped View** (toggle ON, default): Hierarchical visualization via `grouped/` components

### Grouped View Component Hierarchy
```
GroupedEventView.vue
└── ProjectCard.vue (per source_app)
    └── SessionRow.vue (per session_id, horizontal scroll)
        ├── SessionMessagesCard.vue (leftmost, session-level events)
        │   └── ExpandableEventEntry.vue (unified event display)
        └── AgentCard.vue[] (subagent events, sorted by activity)
            └── ConsolidatedToolEntry.vue → ExpandableEventEntry.vue
```

### Shared Components
- `components/shared/ExpandableEventEntry.vue`: Unified event display with click-to-expand showing both PreToolUse and PostToolUse payloads
- `components/shared/ActiveIndicator.vue`: Pulsing dot indicator for active state

### Composables
- `useEventGrouping.ts`: Transforms flat events into Project → Session → Agent hierarchy
- `useToolConsolidation.ts`: Matches PreToolUse to PostToolUse by `tool_use_id`
- `useEventColors.ts`: Deterministic color assignment via hash

### Event Routing Logic
- Events with `agent_id` route to agent cards (unless Task tool)
- Task tool events stay in session messages with agent badge
- SubagentStart creates agent card, SubagentStop marks inactive

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2024-12-29 | PRP-004 Iteration 1: Unified ExpandableEventEntry component for harmonized session/agent views | Claude |
| 2024-12-29 | Agent Grouping Visualization (PRP-004) | Claude |
| 2024-12-28 | Agent ID correlation feature (PRP-002) | Claude |
| 2024-12-28 | Vective System initialization | Claude |
