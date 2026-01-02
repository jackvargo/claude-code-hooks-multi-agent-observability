import { ref } from 'vue';
import type { HookEvent, ConsolidatedToolCall } from '../types';

export function useToolConsolidation() {
  // Map: tool_use_id -> ConsolidatedToolCall
  const consolidatedTools = ref(new Map<string, ConsolidatedToolCall>());

  function processEvent(event: HookEvent): ConsolidatedToolCall | null {
    const toolUseId = event.payload?.tool_use_id;
    if (!toolUseId) return null;

    if (event.hook_event_type === 'PreToolUse') {
      // Create new consolidated entry
      const consolidated: ConsolidatedToolCall = {
        id: toolUseId,
        toolName: event.payload.tool_name || 'Unknown',
        toolInput: event.payload.tool_input || {},
        preToolUseEvent: event,
        postToolUseEvent: null,
        isActive: true
      };
      consolidatedTools.value.set(toolUseId, consolidated);
      return consolidated;
    } else if (event.hook_event_type === 'PostToolUse') {
      // Complete existing entry
      const existing = consolidatedTools.value.get(toolUseId);
      if (existing) {
        existing.postToolUseEvent = event;
        existing.isActive = false;
        existing.summary = event.summary;
        return existing;
      }
      // If no PreToolUse found, create a completed entry
      const consolidated: ConsolidatedToolCall = {
        id: toolUseId,
        toolName: event.payload.tool_name || 'Unknown',
        toolInput: event.payload.tool_input || {},
        preToolUseEvent: event, // Use PostToolUse as fallback
        postToolUseEvent: event,
        isActive: false,
        summary: event.summary
      };
      consolidatedTools.value.set(toolUseId, consolidated);
      return consolidated;
    }

    return null;
  }

  function getConsolidated(toolUseId: string): ConsolidatedToolCall | undefined {
    return consolidatedTools.value.get(toolUseId);
  }

  function isToolActive(toolUseId: string): boolean {
    const tool = consolidatedTools.value.get(toolUseId);
    return tool?.isActive ?? false;
  }

  function reset(): void {
    consolidatedTools.value.clear();
  }

  return {
    consolidatedTools,
    processEvent,
    getConsolidated,
    isToolActive,
    reset
  };
}
