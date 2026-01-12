<template>
  <div class="h-screen flex flex-col bg-[var(--theme-bg-secondary)]">
    <!-- Header with Primary Theme Colors -->
    <header class="bg-gradient-to-r from-[var(--theme-primary)] to-[var(--theme-primary-light)] shadow-lg border-b-2 border-[var(--theme-primary-dark)]">
      <div class="px-3 py-4 mobile:py-2 mobile:flex-col mobile:space-y-2 flex items-center justify-between">
        <!-- Title Section -->
        <div class="mobile:w-full mobile:text-center">
          <h1 class="text-2xl mobile:text-lg font-bold text-white drop-shadow-lg">
            Multi-Agent Observability
          </h1>
        </div>

        <!-- Connection Status -->
        <div class="mobile:w-full mobile:justify-center flex items-center space-x-1.5">
          <!-- Health indicator -->
          <span class="relative flex h-3 w-3">
            <span v-if="isConnected" class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-3 w-3" :class="isConnected ? 'bg-green-500' : 'bg-red-500'"></span>
          </span>

          <!-- Server alias -->
          <span class="text-base mobile:text-sm text-white font-semibold drop-shadow-md">
            {{ activeServer?.alias ?? 'Connecting...' }}
          </span>

          <!-- Gear icon for server config -->
          <button
            @click="showServerConfig = true"
            class="p-1 rounded hover:bg-white/20 transition-colors"
            title="Configure servers"
          >
            <span class="text-lg">⚙️</span>
          </button>
        </div>

        <!-- Event Count and Theme Toggle -->
        <div class="mobile:w-full mobile:justify-center flex items-center space-x-2">
          <span class="text-base mobile:text-sm text-white font-semibold drop-shadow-md bg-[var(--theme-primary-dark)] px-3 py-1.5 rounded-full border border-white/30">
            {{ events.length }} events
          </span>

          <!-- Group by Agents Toggle Button -->
          <button
            @click="groupByAgents = !groupByAgents"
            class="p-3 mobile:p-1.5 rounded-lg transition-all duration-200 border backdrop-blur-sm shadow-lg hover:shadow-xl"
            :class="groupByAgents
              ? 'bg-white/40 border-white/60 hover:bg-white/50'
              : 'bg-white/20 border-white/30 hover:bg-white/30 hover:border-white/50'"
            :title="groupByAgents ? 'Switch to flat list view' : 'Group events by agents'"
          >
            <span class="text-2xl mobile:text-lg">👥</span>
          </button>

          <!-- Filters Toggle Button -->
          <button
            @click="showFilters = !showFilters"
            class="p-3 mobile:p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
            :title="showFilters ? 'Hide filters' : 'Show filters'"
          >
            <span class="text-2xl mobile:text-lg">📊</span>
          </button>

          <!-- Theme Manager Button -->
          <button
            @click="handleThemeManagerClick"
            class="p-3 mobile:p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-all duration-200 border border-white/30 hover:border-white/50 backdrop-blur-sm shadow-lg hover:shadow-xl"
            title="Open theme manager"
          >
            <span class="text-2xl mobile:text-lg">🎨</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Filters -->
    <FilterPanel
      v-if="showFilters"
      :filters="filters"
      @update:filters="filters = $event"
    />

    <!-- Live Pulse Chart -->
    <LivePulseChart
      :events="events"
      :filters="filters"
    />

    <!-- Timeline -->
    <EventTimeline
      :events="events"
      :filters="filters"
      :group-by-agents="groupByAgents"
      v-model:stick-to-bottom="stickToBottom"
    />

    <!-- Stick to bottom button -->
    <StickScrollButton
      :stick-to-bottom="stickToBottom"
      @toggle="stickToBottom = !stickToBottom"
    />

    <!-- Error message -->
    <div
      v-if="error"
      class="fixed bottom-4 left-4 mobile:bottom-3 mobile:left-3 mobile:right-3 bg-red-100 border border-red-400 text-red-700 px-3 py-2 mobile:px-2 mobile:py-1.5 rounded mobile:text-xs"
    >
      {{ error }}
    </div>

    <!-- Theme Manager -->
    <ThemeManager
      :is-open="showThemeManager"
      @close="showThemeManager = false"
    />

    <!-- Server Config Panel -->
    <ServerConfigPanel
      :is-open="showServerConfig"
      @close="showServerConfig = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { useWebSocket } from './composables/useWebSocket';
import { useThemes } from './composables/useThemes';
import { useServerConfig } from './composables/useServerConfig';
import EventTimeline from './components/EventTimeline.vue';
import FilterPanel from './components/FilterPanel.vue';
import StickScrollButton from './components/StickScrollButton.vue';
import LivePulseChart from './components/LivePulseChart.vue';
import ThemeManager from './components/ThemeManager.vue';
import ServerConfigPanel from './components/ServerConfigPanel.vue';

// WebSocket connection - dynamic URL with fallback for initial load
const initialWsUrl = (() => {
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${window.location.host}/stream`;
})();
const { events, isConnected, error, reconnect } = useWebSocket(initialWsUrl);

// Theme management (initializes theme system)
useThemes();

// Server configuration
const {
  activeServer,
  activeWsUrl
} = useServerConfig();

// Watch for server changes and reconnect (passing apiKey for WebSocket auth)
watch([activeWsUrl, activeServer], ([newUrl, newServer]) => {
  if (newUrl) {
    reconnect(newUrl, newServer?.apiKey);
  }
}, { deep: true });

// Filters
const filters = ref({
  sourceApp: '',
  sessionId: '',
  eventType: ''
});

// UI state
const stickToBottom = ref(true);
const showThemeManager = ref(false);
const showFilters = ref(false);
const groupByAgents = ref(true);  // Default ON per PRP requirements
const showServerConfig = ref(false);


// Debug handler for theme manager
const handleThemeManagerClick = () => {
  console.log('Theme manager button clicked!');
  showThemeManager.value = true;
};
</script>
