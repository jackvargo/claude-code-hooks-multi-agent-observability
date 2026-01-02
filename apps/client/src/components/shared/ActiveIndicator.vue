<template>
  <span class="relative flex" :class="sizeClasses">
    <span
      v-if="active"
      class="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
      :class="activeColorClass"
    ></span>
    <span
      class="relative inline-flex rounded-full"
      :class="[sizeClasses, active ? activeColorClass : inactiveColorClass]"
    ></span>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  active: boolean;
  size?: 'sm' | 'md' | 'lg';
  activeColor?: string;
  inactiveColor?: string;
}>(), {
  size: 'md',
  activeColor: 'bg-green-500',
  inactiveColor: 'bg-gray-400'
});

const sizeClasses = computed(() => {
  const sizes: Record<string, string> = {
    sm: 'h-2 w-2',
    md: 'h-2.5 w-2.5',
    lg: 'h-3 w-3'
  };
  return sizes[props.size];
});

const activeColorClass = computed(() => props.activeColor);
const inactiveColorClass = computed(() => props.inactiveColor);
</script>
