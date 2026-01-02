<template>
  <div
    class="mb-6 rounded-xl border shadow-xl overflow-hidden bg-[var(--theme-bg-primary)]"
    :style="{ borderColor: projectHexColor }"
  >
    <!-- Project Header -->
    <div
      class="flex items-center justify-between px-4 py-3 cursor-pointer"
      :style="{ backgroundColor: projectHexColor + '20' }"
      @click="toggleCollapsed"
    >
      <div class="flex items-center space-x-3">
        <!-- Collapse/Expand Icon -->
        <svg
          class="w-5 h-5 transition-transform duration-200"
          :class="{ 'rotate-90': !isCollapsed }"
          :style="{ color: projectHexColor }"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>

        <!-- Project Color Bar -->
        <div
          class="w-3 h-8 rounded"
          :style="{ backgroundColor: projectHexColor }"
        ></div>

        <!-- Project Name -->
        <span class="text-lg font-bold text-[var(--theme-text-primary)]">
          PROJECT: {{ project.sourceApp }}
        </span>
      </div>

      <!-- Session Count -->
      <span
        class="text-sm font-semibold px-3 py-1 rounded-full"
        :style="{
          backgroundColor: projectHexColor + '30',
          color: projectHexColor
        }"
      >
        {{ project.sessions.size }} {{ project.sessions.size === 1 ? 'session' : 'sessions' }}
      </span>
    </div>

    <!-- Collapsible Content -->
    <div
      v-show="!isCollapsed"
      class="px-4 py-3 bg-[var(--theme-bg-secondary)]"
    >
      <SessionRow
        v-for="session in sortedSessions"
        :key="session.sessionId"
        :session="session"
      />

      <div
        v-if="project.sessions.size === 0"
        class="text-center py-8 text-[var(--theme-text-tertiary)]"
      >
        No sessions in this project
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ProjectState, SessionState } from '../../types';
import { useEventColors } from '../../composables/useEventColors';
import SessionRow from './SessionRow.vue';

const props = defineProps<{
  project: ProjectState;
}>();

const { getHexColorForApp } = useEventColors();

const isCollapsed = ref(false);

const projectHexColor = computed(() => {
  return getHexColorForApp(props.project.sourceApp);
});

const sortedSessions = computed((): SessionState[] => {
  return Array.from(props.project.sessions.values());
});

const toggleCollapsed = () => {
  isCollapsed.value = !isCollapsed.value;
};
</script>
