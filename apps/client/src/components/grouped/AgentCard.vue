<template>
  <div
    class="flex flex-col min-w-[280px] max-w-[400px] w-[clamp(280px,25vw,400px)] h-[400px] mobile:min-w-full mobile:max-w-full mobile:w-full rounded-lg border shadow-lg bg-[var(--theme-bg-primary)]"
    :class="[
      agent.isActive
        ? 'border-green-500/50'
        : 'border-[var(--theme-border-primary)]'
    ]"
  >
    <!-- Header -->
    <div
      class="flex items-center justify-between px-3 py-2 border-b rounded-t-lg"
      :class="[
        agent.isActive
          ? 'border-green-500/30 bg-green-500/10'
          : 'border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)]'
      ]"
    >
      <div class="flex items-center space-x-2">
        <ActiveIndicator :active="agent.isActive" size="md" />
        <span class="font-semibold text-sm text-[var(--theme-text-primary)] truncate max-w-[150px]">
          {{ agent.agentType }}
        </span>
      </div>
      <span class="text-xs text-[var(--theme-text-tertiary)] font-mono">
        {{ agentIdShort }}
      </span>
    </div>

    <!-- Scrollable Content -->
    <div
      ref="scrollContainer"
      class="flex-1 overflow-y-auto p-2 space-y-2"
      @scroll="handleScroll"
    >
      <ConsolidatedToolEntry
        v-for="tool in agent.consolidatedTools"
        :key="tool.id"
        :tool="tool"
      />
      <div
        v-if="agent.consolidatedTools.length === 0"
        class="text-center py-4 text-[var(--theme-text-tertiary)] text-sm"
      >
        No tool calls yet
      </div>
    </div>

    <!-- Summary (for completed agents) -->
    <div
      v-if="!agent.isActive && agent.summary"
      class="px-3 py-2 border-t border-[var(--theme-border-primary)] bg-[var(--theme-primary)]/10"
    >
      <div class="text-xs text-[var(--theme-text-primary)]">
        <span class="mr-1">📝</span>
        <span class="font-medium">{{ agent.summary }}</span>
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
import type { AgentState } from '../../types';
import ActiveIndicator from '../shared/ActiveIndicator.vue';
import ConsolidatedToolEntry from './ConsolidatedToolEntry.vue';

const props = defineProps<{
  agent: AgentState;
}>();

const scrollContainer = ref<HTMLElement>();
const stickToBottom = ref(true);

// Scroll to bottom on mount if stickToBottom is enabled
onMounted(() => {
  if (stickToBottom.value) {
    nextTick(() => scrollToBottom());
  }
});

const agentIdShort = computed(() => {
  return props.agent.agentId.slice(0, 8);
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

// Auto-scroll when new tools are added
watch(
  () => props.agent.consolidatedTools.length,
  async () => {
    if (stickToBottom.value) {
      await nextTick();
      scrollToBottom();
    }
  }
);
</script>
