<template>
  <div class="flex-1 mobile:h-[50vh] overflow-hidden flex flex-col">
    <!-- Fixed Header -->
    <div
      class="px-3 py-4 mobile:py-2 bg-gradient-to-r from-[var(--theme-bg-primary)] to-[var(--theme-bg-secondary)] relative z-10"
      style="box-shadow: 0 4px 20px -2px rgba(0, 0, 0, 0.3), 0 8px 25px -5px rgba(0, 0, 0, 0.2);"
    >
      <h2 class="text-2xl mobile:text-lg font-bold text-[var(--theme-primary)] text-center drop-shadow-sm">
        Agent Event Stream
        <span class="text-sm font-normal text-[var(--theme-text-tertiary)] ml-2">(Grouped View)</span>
      </h2>
    </div>

    <!-- Scrollable Project List -->
    <div class="flex-1 overflow-y-auto px-3 py-3 mobile:px-2 mobile:py-1.5">
      <TransitionGroup
        name="project"
        tag="div"
      >
        <ProjectCard
          v-for="project in sortedProjects"
          :key="project.sourceApp"
          :project="project"
        />
      </TransitionGroup>

      <div
        v-if="sortedProjects.length === 0"
        class="text-center py-8 mobile:py-6 text-[var(--theme-text-tertiary)]"
      >
        <div class="text-4xl mobile:text-3xl mb-3">👥</div>
        <p class="text-lg mobile:text-base font-semibold text-[var(--theme-primary)] mb-1.5">
          No events to display
        </p>
        <p class="text-base mobile:text-sm">
          Events will be grouped by Project → Session → Agent as they arrive
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { HookEvent } from '../../types';
import { useEventGrouping } from '../../composables/useEventGrouping';
import ProjectCard from './ProjectCard.vue';

const props = defineProps<{
  events: HookEvent[];
  filters: {
    sourceApp: string;
    sessionId: string;
    eventType: string;
  };
}>();

// Filter events first
const filteredEvents = computed(() => {
  return props.events.filter(event => {
    if (props.filters.sourceApp && event.source_app !== props.filters.sourceApp) {
      return false;
    }
    if (props.filters.sessionId && event.session_id !== props.filters.sessionId) {
      return false;
    }
    if (props.filters.eventType && event.hook_event_type !== props.filters.eventType) {
      return false;
    }
    return true;
  });
});

// Create a ref wrapper for the filtered events
import { ref, watch } from 'vue';
const eventsRef = ref<HookEvent[]>([]);
watch(filteredEvents, (newEvents) => {
  eventsRef.value = newEvents;
}, { immediate: true });

// Use the grouping composable
const { sortedProjects } = useEventGrouping(eventsRef);
</script>

<style scoped>
.project-enter-active {
  transition: all 0.3s ease;
}

.project-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.project-leave-active {
  transition: all 0.3s ease;
}

.project-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>
