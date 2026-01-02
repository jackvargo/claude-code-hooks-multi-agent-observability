<template>
  <div
    class="p-3 mobile:p-2 rounded-lg border transition-all duration-200 cursor-pointer"
    :class="[
      isActive
        ? borderActiveClass
        : 'border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-bg-tertiary)]'
    ]"
    @click="toggleExpanded"
  >
    <!-- Header Row -->
    <div class="flex items-center justify-between mb-1 gap-2">
      <div class="flex items-center space-x-2 min-w-0 flex-1">
        <span class="text-base mobile:text-sm flex-shrink-0">{{ emoji }}</span>
        <span class="font-semibold text-sm mobile:text-xs text-[var(--theme-text-primary)] truncate" :title="name">
          {{ name }}
        </span>
        <ActiveIndicator v-if="isActive" :active="true" size="sm" :active-color="activeIndicatorColor" class="flex-shrink-0" />
      </div>
      <div class="flex items-center space-x-2 flex-shrink-0">
        <span
          v-if="!isActive && duration"
          class="text-xs text-[var(--theme-text-tertiary)] whitespace-nowrap"
        >
          {{ duration }}
        </span>
        <span v-if="isActive && showActiveLabel" class="text-xs font-medium whitespace-nowrap" :class="activeLabelClass">
          active
        </span>
      </div>
    </div>

    <!-- Detail Row (truncated) -->
    <div v-if="detail" class="text-xs text-[var(--theme-text-secondary)] truncate mb-1">
      {{ detail }}
    </div>

    <!-- Agent Badge (for Task entries) -->
    <div v-if="agentId" class="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 mb-1">
      <span class="mr-0.5">🤖</span>
      {{ agentId.slice(0, 8) }}
    </div>

    <!-- Summary Row (wrapped text, not truncated) -->
    <div
      v-if="!isActive && summary"
      class="mt-1 px-2 py-1 bg-[var(--theme-primary)]/10 border border-[var(--theme-primary)]/30 rounded text-xs text-[var(--theme-text-primary)] break-words whitespace-normal"
    >
      <span class="mr-1">📝</span>{{ summary }}
    </div>

    <!-- Expanded Payload Section -->
    <div v-if="isExpanded" class="mt-2 pt-2 border-t border-[var(--theme-border-primary)]">
      <!-- PreToolUse Payload -->
      <div v-if="prePayload" class="mb-2">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-semibold text-[var(--theme-text-secondary)]">PreToolUse Payload</span>
          <button
            @click.stop="copyPrePayload"
            class="px-2 py-0.5 text-xs rounded bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-dark)] text-white transition-colors"
          >
            {{ copyPreText }}
          </button>
        </div>
        <pre class="text-xs text-[var(--theme-text-primary)] bg-[var(--theme-bg-tertiary)] p-2 rounded overflow-x-auto max-h-40 overflow-y-auto font-mono">{{ formattedPrePayload }}</pre>
      </div>

      <!-- PostToolUse Payload -->
      <div v-if="postPayload">
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs font-semibold text-[var(--theme-text-secondary)]">PostToolUse Payload</span>
          <button
            @click.stop="copyPostPayload"
            class="px-2 py-0.5 text-xs rounded bg-[var(--theme-primary)] hover:bg-[var(--theme-primary-dark)] text-white transition-colors"
          >
            {{ copyPostText }}
          </button>
        </div>
        <pre class="text-xs text-[var(--theme-text-primary)] bg-[var(--theme-bg-tertiary)] p-2 rounded overflow-x-auto max-h-40 overflow-y-auto font-mono">{{ formattedPostPayload }}</pre>
      </div>

      <!-- Awaiting completion message if active -->
      <div v-if="isActive && !postPayload" class="text-xs text-[var(--theme-text-tertiary)] italic">
        ⏳ Awaiting PostToolUse completion...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import ActiveIndicator from './ActiveIndicator.vue';

export interface ExpandableEventEntryProps {
  type: 'tool' | 'task' | 'prompt' | 'other';
  name: string;                    // Tool name, "Task", "UserPromptSubmit", etc.
  detail?: string;                 // Truncated detail line
  emoji: string;                   // 🔧, ✅, 🚀, 💬
  isActive: boolean;
  duration?: string;               // "23ms" or "1.2s"
  summary?: string;                // Full summary text (wraps)
  prePayload?: Record<string, unknown>;  // PreToolUse payload
  postPayload?: Record<string, unknown>; // PostToolUse payload (null if active)
  agentId?: string;                // For Task entries, shows badge
  agentType?: string;              // For Task entries
}

const props = defineProps<ExpandableEventEntryProps>();

const isExpanded = ref(false);
const copyPreText = ref('📋 Copy');
const copyPostText = ref('📋 Copy');

const toggleExpanded = () => {
  isExpanded.value = !isExpanded.value;
};

// Styling based on type
const borderActiveClass = computed(() => {
  if (props.type === 'task') {
    return 'border-amber-500/50 bg-amber-500/10 hover:bg-amber-500/20';
  }
  // Default for tools
  return 'border-green-500/50 bg-green-500/10 hover:bg-green-500/20';
});

const activeIndicatorColor = computed(() => {
  if (props.type === 'task') return 'bg-amber-500';
  return 'bg-green-500';
});

const showActiveLabel = computed(() => {
  return props.type === 'tool' || props.type === 'task';
});

const activeLabelClass = computed(() => {
  if (props.type === 'task') return 'text-amber-400';
  return 'text-green-400';
});

const formattedPrePayload = computed(() => {
  return JSON.stringify(props.prePayload, null, 2);
});

const formattedPostPayload = computed(() => {
  return JSON.stringify(props.postPayload, null, 2);
});

const copyPrePayload = async () => {
  try {
    await navigator.clipboard.writeText(formattedPrePayload.value);
    copyPreText.value = '✅ Copied!';
    setTimeout(() => {
      copyPreText.value = '📋 Copy';
    }, 2000);
  } catch {
    copyPreText.value = '❌ Failed';
    setTimeout(() => {
      copyPreText.value = '📋 Copy';
    }, 2000);
  }
};

const copyPostPayload = async () => {
  try {
    await navigator.clipboard.writeText(formattedPostPayload.value);
    copyPostText.value = '✅ Copied!';
    setTimeout(() => {
      copyPostText.value = '📋 Copy';
    }, 2000);
  } catch {
    copyPostText.value = '❌ Failed';
    setTimeout(() => {
      copyPostText.value = '📋 Copy';
    }, 2000);
  }
};
</script>
