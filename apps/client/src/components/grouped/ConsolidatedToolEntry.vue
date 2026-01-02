<template>
  <ExpandableEventEntry
    type="tool"
    :name="tool.toolName"
    :detail="toolDetail"
    :emoji="toolEmoji"
    :is-active="tool.isActive"
    :duration="duration"
    :summary="tool.summary"
    :pre-payload="prePayload"
    :post-payload="postPayload"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ConsolidatedToolCall } from '../../types';
import ExpandableEventEntry from '../shared/ExpandableEventEntry.vue';

const props = defineProps<{
  tool: ConsolidatedToolCall;
}>();

const toolEmoji = computed(() => {
  if (props.tool.isActive) return '🔧';
  return '✅';
});

const toolDetail = computed(() => {
  const input = props.tool.toolInput;
  if (input.command) {
    return input.command.toString().slice(0, 60) + (input.command.toString().length > 60 ? '...' : '');
  }
  if (input.file_path) {
    const path = input.file_path.toString();
    return path.split('/').pop() || path;
  }
  if (input.pattern) {
    return input.pattern.toString();
  }
  if (input.prompt) {
    return input.prompt.toString().slice(0, 60) + '...';
  }
  return undefined;
});

const duration = computed(() => {
  if (props.tool.isActive) return undefined;
  const pre = props.tool.preToolUseEvent.timestamp;
  const post = props.tool.postToolUseEvent?.timestamp;
  if (!pre || !post) return undefined;
  const ms = post - pre;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
});

// Pre payload: the full PreToolUse event payload
const prePayload = computed(() => {
  return props.tool.preToolUseEvent.payload;
});

// Post payload: the full PostToolUse event payload (if available)
const postPayload = computed(() => {
  return props.tool.postToolUseEvent?.payload || undefined;
});
</script>
