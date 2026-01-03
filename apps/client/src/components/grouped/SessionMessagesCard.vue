<template>
  <div
    class="flex flex-col min-w-[280px] max-w-[400px] w-[clamp(280px,25vw,400px)] h-[400px] mobile:min-w-full mobile:max-w-full mobile:w-full rounded-lg border border-[var(--theme-border-primary)] shadow-lg bg-[var(--theme-bg-primary)]"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] rounded-t-lg">
      <div class="flex items-center space-x-2">
        <span class="text-base">📋</span>
        <span class="font-semibold text-sm text-[var(--theme-text-primary)]">Session Messages</span>
      </div>
      <span class="text-xs text-[var(--theme-text-tertiary)] font-mono">
        {{ sessionIdShort }}
      </span>
    </div>

    <!-- Scrollable Content -->
    <div
      ref="scrollContainer"
      class="flex-1 overflow-y-auto p-2 space-y-2"
      @scroll="handleScroll"
    >
      <!-- Display items using ExpandableEventEntry -->
      <template v-for="item in displayItems" :key="item.name + item.detail">
        <ExpandableEventEntry
          :type="item.type"
          :name="item.name"
          :detail="item.detail"
          :emoji="item.emoji"
          :is-active="item.isActive"
          :duration="item.duration"
          :summary="item.summary"
          :pre-payload="item.prePayload"
          :post-payload="item.postPayload"
          :agent-id="item.agentId"
          :agent-type="item.agentType"
        />
      </template>

      <div
        v-if="displayItems.length === 0"
        class="text-center py-4 text-[var(--theme-text-tertiary)] text-sm"
      >
        No session messages yet
      </div>
    </div>

    <!-- Footer with Stick-to-Bottom Toggle -->
    <div class="flex items-center justify-center px-3 py-1.5 border-t border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] rounded-b-lg">
      <button
        @click="toggleStickToBottom"
        class="p-1.5 rounded transition-all duration-200"
        :class="[
          stickToBottom
            ? 'bg-[var(--theme-primary)] text-white'
            : 'bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-quaternary)]'
        ]"
        :title="stickToBottom ? 'Disable auto-scroll' : 'Enable auto-scroll'"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M19 14l-7 7m0 0l-7-7m7 7V3"
          />
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import type { SessionState, ConsolidatedToolCall, HookEvent } from '../../types';
import type { ExpandableEventEntryProps } from '../shared/ExpandableEventEntry.vue';
import ExpandableEventEntry from '../shared/ExpandableEventEntry.vue';

const props = defineProps<{
  session: SessionState;
}>();

const scrollContainer = ref<HTMLElement>();
const stickToBottom = ref(true);

// Scroll to bottom on mount if stickToBottom is enabled
onMounted(() => {
  if (stickToBottom.value) {
    nextTick(() => scrollToBottom());
  }
});

const sessionIdShort = computed(() => {
  return props.session.sessionId.slice(0, 8);
});

const emojiMap: Record<string, string> = {
  'PreToolUse': '🔧',
  'PostToolUse': '✅',
  'Notification': '🔔',
  'Stop': '🛑',
  'SubagentStop': '👥',
  'SubagentStart': '🚀',
  'PreCompact': '📦',
  'UserPromptSubmit': '💬'
};

// Helper to get tool detail
const getToolDetail = (tool: ConsolidatedToolCall): string | undefined => {
  const input = tool.toolInput;
  if (input.command) {
    const cmd = String(input.command);
    return cmd.slice(0, 60) + (cmd.length > 60 ? '...' : '');
  }
  if (input.file_path) {
    const path = String(input.file_path);
    return path.split('/').pop() || path;
  }
  if (input.pattern) {
    return String(input.pattern);
  }
  if (input.prompt) {
    return String(input.prompt).slice(0, 60) + '...';
  }
  return undefined;
};

// Helper to calculate duration
const getToolDuration = (tool: ConsolidatedToolCall): string | undefined => {
  if (tool.isActive) return undefined;
  const pre = tool.preToolUseEvent.timestamp;
  const post = tool.postToolUseEvent?.timestamp;
  if (!pre || !post) return undefined;
  const ms = post - pre;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// Helper to calculate duration from event pair
const calculateDuration = (preEvent: HookEvent, postEvent: HookEvent | null | undefined): string | undefined => {
  if (!postEvent) return undefined;
  const pre = preEvent.timestamp;
  const post = postEvent.timestamp;
  if (!pre || !post) return undefined;
  const ms = post - pre;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
};

// Process session events and consolidated tools into display items
const displayItems = computed((): ExpandableEventEntryProps[] => {
  const items: ExpandableEventEntryProps[] = [];
  const processedToolIds = new Set<string>();

  // Process consolidated tools (session-level tool calls)
  for (const tool of props.session.consolidatedTools) {
    // Skip Task tools - they're handled separately from events
    if (tool.toolName === 'Task') continue;

    processedToolIds.add(tool.id);

    items.push({
      type: 'tool',
      name: tool.toolName,
      detail: getToolDetail(tool),
      emoji: tool.isActive ? '🔧' : '✅',
      isActive: tool.isActive,
      duration: getToolDuration(tool),
      summary: tool.summary,
      prePayload: tool.preToolUseEvent.payload,
      postPayload: tool.postToolUseEvent?.payload
    });
  }

  // Process events for non-tool items and uncaptured tool events
  for (const event of props.session.events) {
    const toolUseId = event.payload?.tool_use_id;

    // Skip tool events already handled via consolidatedTools
    if (toolUseId && processedToolIds.has(toolUseId)) continue;

    // Handle PreToolUse/PostToolUse events
    if (event.hook_event_type === 'PreToolUse' || event.hook_event_type === 'PostToolUse') {
      // Handle Task tool events specially
      if (event.payload?.tool_name === 'Task') {
        if (toolUseId) {
          if (processedToolIds.has(toolUseId)) continue;
          processedToolIds.add(toolUseId);
        }

        // Find matching post event
        const postEvent = toolUseId ? props.session.events.find(
          e => e.payload?.tool_use_id === toolUseId && e.hook_event_type === 'PostToolUse'
        ) : null;

        const agentType = event.payload?.tool_input?.subagent_type ||
                          event.agent_type ||
                          'agent';

        let agentId = event.agent_id;
        if (!agentId) {
          for (const agent of props.session.agents.values()) {
            if (agent.agentType === agentType) {
              agentId = agent.agentId;
              break;
            }
          }
        }

        items.push({
          type: 'task',
          name: 'Task',
          detail: agentType,
          emoji: '🚀',
          isActive: !postEvent,
          duration: calculateDuration(event, postEvent),
          summary: postEvent?.summary,
          prePayload: event.payload,
          postPayload: postEvent?.payload,
          agentId,
          agentType
        });
        continue;
      }

      // Handle non-Task tool events that weren't consolidated (missing tool_use_id)
      // Only show PreToolUse to avoid duplicates
      if (event.hook_event_type === 'PreToolUse') {
        const toolName = event.payload?.tool_name || 'Unknown';
        const input = event.payload?.tool_input || {};
        let detail: string | undefined;
        if (input.command) {
          const cmd = String(input.command);
          detail = cmd.slice(0, 60) + (cmd.length > 60 ? '...' : '');
        } else if (input.file_path) {
          const path = String(input.file_path);
          detail = path.split('/').pop() || path;
        } else if (input.pattern) {
          detail = String(input.pattern);
        }

        // Check if there's a matching PostToolUse
        const postEvent = toolUseId ? props.session.events.find(
          e => e.payload?.tool_use_id === toolUseId && e.hook_event_type === 'PostToolUse'
        ) : null;

        items.push({
          type: 'tool',
          name: toolName,
          detail,
          emoji: postEvent ? '✅' : '🔧',
          isActive: !postEvent,
          duration: calculateDuration(event, postEvent),
          summary: postEvent?.summary,
          prePayload: event.payload,
          postPayload: postEvent?.payload
        });
      }
      continue;
    }

    // Handle UserPromptSubmit
    if (event.hook_event_type === 'UserPromptSubmit') {
      const prompt = event.payload?.prompt || 'No prompt';
      items.push({
        type: 'prompt',
        name: 'UserPromptSubmit',
        detail: prompt.slice(0, 100) + (prompt.length > 100 ? '...' : ''),
        emoji: '💬',
        isActive: false,
        prePayload: event.payload
      });
      continue;
    }

    // Handle other events (Notification, Stop, etc.)
    let detail: string | undefined;
    if (event.payload?.tool_name) {
      detail = event.payload.tool_name;
    } else if (event.summary) {
      detail = event.summary;
    }

    items.push({
      type: 'other',
      name: event.hook_event_type,
      detail,
      emoji: emojiMap[event.hook_event_type] || '❓',
      isActive: false,
      prePayload: event.payload
    });
  }

  // Sort by timestamp (extract from prePayload or first available event)
  items.sort((a, b) => {
    const aTime = (a.prePayload as any)?.timestamp || 0;
    const bTime = (b.prePayload as any)?.timestamp || 0;
    return aTime - bTime;
  });

  return items;
});

const toggleStickToBottom = () => {
  stickToBottom.value = !stickToBottom.value;
  if (stickToBottom.value) {
    scrollToBottom();
  }
};

const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  }
};

const handleScroll = () => {
  if (!scrollContainer.value) return;
  const { scrollTop, scrollHeight, clientHeight } = scrollContainer.value;
  const isAtBottom = scrollHeight - scrollTop - clientHeight < 30;
  if (isAtBottom !== stickToBottom.value) {
    stickToBottom.value = isAtBottom;
  }
};

// Auto-scroll when new items are added
watch(
  () => displayItems.value.length,
  async () => {
    if (stickToBottom.value) {
      await nextTick();
      scrollToBottom();
    }
  }
);
</script>
