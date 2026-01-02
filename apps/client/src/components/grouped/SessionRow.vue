<template>
  <div class="mb-4">
    <!-- Session Header -->
    <div class="flex items-center space-x-2 mb-2 px-2">
      <span class="text-sm font-semibold text-[var(--theme-text-secondary)]">SESSION:</span>
      <span
        class="text-xs font-mono px-2 py-0.5 rounded-full border bg-[var(--theme-bg-tertiary)]"
        :class="borderColorClass"
      >
        {{ sessionIdShort }}
      </span>
      <span class="text-xs text-[var(--theme-text-tertiary)]">
        ({{ session.agents.size }} agents, {{ session.events.length }} events)
      </span>
    </div>

    <!-- Horizontal Scroll Container -->
    <div class="relative">
      <!-- Left Edge Shadow (scroll indicator) -->
      <div
        v-if="showLeftShadow"
        class="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[var(--theme-bg-secondary)] to-transparent z-10 pointer-events-none"
      ></div>

      <!-- Scrollable Cards Container -->
      <div
        ref="scrollContainer"
        class="flex space-x-3 overflow-x-auto pb-2 px-2 scrollbar-thin scrollbar-thumb-[var(--theme-primary)] scrollbar-track-[var(--theme-bg-tertiary)]"
        @scroll="handleScroll"
      >
        <!-- Session Messages Card (always leftmost) -->
        <SessionMessagesCard :session="session" />

        <!-- Agent Cards (active first, then inactive) -->
        <AgentCard
          v-for="agent in sortedAgents"
          :key="agent.agentId"
          :agent="agent"
        />
      </div>

      <!-- Right Edge Shadow (scroll indicator) -->
      <div
        v-if="showRightShadow"
        class="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--theme-bg-secondary)] to-transparent z-10 pointer-events-none"
      ></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import type { SessionState, AgentState } from '../../types';
import { useEventColors } from '../../composables/useEventColors';
import SessionMessagesCard from './SessionMessagesCard.vue';
import AgentCard from './AgentCard.vue';

const props = defineProps<{
  session: SessionState;
}>();

const { getColorForSession } = useEventColors();

const scrollContainer = ref<HTMLElement>();
const showLeftShadow = ref(false);
const showRightShadow = ref(false);

const sessionIdShort = computed(() => {
  return props.session.sessionId.slice(0, 8);
});

const borderColorClass = computed(() => {
  return getColorForSession(props.session.sessionId).replace('bg-', 'border-');
});

// Sort agents: active first (by startTime), then inactive (by endTime desc)
const sortedAgents = computed((): AgentState[] => {
  const agents = Array.from(props.session.agents.values());
  const active = agents.filter(a => a.isActive).sort((a, b) => a.startTime - b.startTime);
  const inactive = agents.filter(a => !a.isActive).sort((a, b) => (b.endTime || 0) - (a.endTime || 0));
  return [...active, ...inactive];
});

const handleScroll = () => {
  if (!scrollContainer.value) return;
  const { scrollLeft, scrollWidth, clientWidth } = scrollContainer.value;
  showLeftShadow.value = scrollLeft > 10;
  showRightShadow.value = scrollWidth - scrollLeft - clientWidth > 10;
};

const checkScroll = () => {
  if (!scrollContainer.value) return;
  const { scrollWidth, clientWidth } = scrollContainer.value;
  showRightShadow.value = scrollWidth > clientWidth;
};

onMounted(() => {
  checkScroll();
  window.addEventListener('resize', checkScroll);
});

onUnmounted(() => {
  window.removeEventListener('resize', checkScroll);
});
</script>

<style scoped>
/* Custom scrollbar styling */
.scrollbar-thin::-webkit-scrollbar {
  height: 6px;
}

.scrollbar-thin::-webkit-scrollbar-track {
  background: var(--theme-bg-tertiary);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb {
  background: var(--theme-primary);
  border-radius: 3px;
}

.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: var(--theme-primary-dark);
}
</style>
