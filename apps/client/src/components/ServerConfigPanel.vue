<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <!-- Backdrop -->
      <div
        class="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        @click="close"
      ></div>

      <!-- Modal -->
      <div
        class="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl flex flex-col overflow-hidden z-10"
        style="width: 60vw; height: 60vh"
        @click.stop
      >
        <!-- Header -->
        <div class="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-2xl font-semibold text-gray-900 dark:text-white">
              Server Configuration
            </h2>
            <button
              @click="close"
              class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <svg class="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Content -->
        <div class="flex-1 p-6 overflow-y-auto">
          <!-- Server List -->
          <div class="mb-6">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Configured Servers</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div
                v-for="server in state.servers"
                :key="server.id"
                @click="handleSelectServer(server.id)"
                :class="[
                  'rounded-lg border-2 p-4 transition-all',
                  editingServerId === server.id
                    ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20'
                    : state.activeServerId === server.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 cursor-pointer hover:shadow-md'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 cursor-pointer hover:shadow-md'
                ]"
              >
                <!-- Edit Mode -->
                <template v-if="editingServerId === server.id">
                  <div class="space-y-3">
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Alias</label>
                      <input
                        v-model="editForm.alias"
                        type="text"
                        @click.stop
                        class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">WebSocket URL</label>
                      <input
                        v-model="editForm.wsUrl"
                        type="text"
                        @click.stop
                        class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">HTTP URL</label>
                      <input
                        v-model="editForm.httpUrl"
                        type="text"
                        @click.stop
                        class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label class="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">API Key (optional)</label>
                      <input
                        v-model="editForm.apiKey"
                        type="password"
                        @click.stop
                        placeholder="Bearer token for authenticated servers"
                        class="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
                      />
                    </div>
                    <div class="flex space-x-2 pt-2">
                      <button
                        @click.stop="handleSaveEdit"
                        :disabled="!isEditFormValid"
                        :class="[
                          'px-3 py-1 text-sm rounded transition-colors',
                          isEditFormValid
                            ? 'bg-green-600 text-white hover:bg-green-700'
                            : 'bg-gray-300 dark:bg-gray-600 text-gray-500 cursor-not-allowed'
                        ]"
                      >
                        Save
                      </button>
                      <button
                        @click.stop="handleCancelEdit"
                        class="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </template>

                <!-- Display Mode -->
                <template v-else>
                  <!-- Server Info -->
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center space-x-2">
                      <!-- Health Indicator -->
                      <span
                        class="inline-flex h-3 w-3 rounded-full"
                        :class="getHealthColor(server.id)"
                      ></span>
                      <h4 class="font-medium text-gray-900 dark:text-white">{{ server.alias }}</h4>
                    </div>
                    <!-- Active Badge -->
                    <span
                      v-if="state.activeServerId === server.id"
                      class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                    >
                      <svg class="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                      </svg>
                      Active
                    </span>
                  </div>

                  <!-- URLs -->
                  <div class="text-sm text-gray-500 dark:text-gray-400 space-y-1">
                    <p class="truncate" :title="server.wsUrl">WS: {{ server.wsUrl }}</p>
                    <p class="truncate" :title="server.httpUrl">HTTP: {{ server.httpUrl }}</p>
                    <p v-if="server.apiKey" class="text-xs text-gray-400 dark:text-gray-500">API Key: ********</p>
                  </div>

                  <!-- Health Status -->
                  <div v-if="state.healthStatus[server.id]" class="mt-2 text-xs text-gray-400 dark:text-gray-500">
                    <span v-if="state.healthStatus[server.id].latencyMs">
                      {{ state.healthStatus[server.id].latencyMs }}ms
                    </span>
                    <span v-if="state.healthStatus[server.id].error" class="text-red-500">
                      {{ state.healthStatus[server.id].error }}
                    </span>
                  </div>

                  <!-- Action Buttons (for non-default servers) -->
                  <div v-if="!server.isDefault" class="mt-3 flex space-x-3">
                    <button
                      @click.stop="handleEditServer(server)"
                      class="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      @click.stop="handleRemoveServer(server.id)"
                      class="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Add Server Form -->
          <div class="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 class="text-lg font-medium text-gray-900 dark:text-white mb-4">Add New Server</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Alias
                </label>
                <input
                  v-model="newServerForm.alias"
                  type="text"
                  placeholder="e.g., Homelab"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  WebSocket URL
                </label>
                <input
                  v-model="newServerForm.wsUrl"
                  type="text"
                  placeholder="wss://server.example.com/stream"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  HTTP URL
                </label>
                <input
                  v-model="newServerForm.httpUrl"
                  type="text"
                  placeholder="https://server.example.com/events/filter-options"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key (optional)
                </label>
                <input
                  v-model="newServerForm.apiKey"
                  type="password"
                  placeholder="Bearer token for authenticated servers"
                  class="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              @click="handleAddServer"
              :disabled="!isFormValid"
              :class="[
                'px-4 py-2 rounded-lg transition-colors',
                isFormValid
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              ]"
            >
              Add Server
            </button>
          </div>

          <!-- Actions -->
          <div class="flex justify-between items-center pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
            <button
              @click="checkAllHealth"
              class="px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              Refresh Health Status
            </button>
            <button
              @click="close"
              class="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useServerConfig } from '../composables/useServerConfig';
import type { ServerConfig } from '../types/server';

defineProps<{
  isOpen: boolean;
}>();

const emit = defineEmits<{
  close: [];
}>();

// Server configuration
const {
  state,
  addServer,
  removeServer,
  updateServer,
  setActiveServer,
  checkAllHealth
} = useServerConfig();

// Form state for adding new server
const newServerForm = ref({
  alias: '',
  wsUrl: '',
  httpUrl: '',
  apiKey: ''
});

// Edit mode state
const editingServerId = ref<string | null>(null);
const editForm = ref({
  alias: '',
  wsUrl: '',
  httpUrl: '',
  apiKey: ''
});

// Computed: Form validation for add
const isFormValid = computed(() => {
  return (
    newServerForm.value.alias.trim() !== '' &&
    newServerForm.value.wsUrl.trim() !== '' &&
    newServerForm.value.httpUrl.trim() !== ''
  );
});

// Computed: Form validation for edit
const isEditFormValid = computed(() => {
  return (
    editForm.value.alias.trim() !== '' &&
    editForm.value.wsUrl.trim() !== '' &&
    editForm.value.httpUrl.trim() !== ''
  );
});

// Methods
const handleAddServer = () => {
  if (isFormValid.value) {
    addServer({
      alias: newServerForm.value.alias.trim(),
      wsUrl: newServerForm.value.wsUrl.trim(),
      httpUrl: newServerForm.value.httpUrl.trim(),
      apiKey: newServerForm.value.apiKey.trim() || undefined
    });
    newServerForm.value = { alias: '', wsUrl: '', httpUrl: '', apiKey: '' };
  }
};

const handleRemoveServer = (id: string) => {
  removeServer(id);
};

const handleSelectServer = (id: string) => {
  // Don't select if currently editing this server
  if (editingServerId.value === id) return;
  setActiveServer(id);
};

const handleEditServer = (server: ServerConfig) => {
  editingServerId.value = server.id;
  editForm.value = {
    alias: server.alias,
    wsUrl: server.wsUrl,
    httpUrl: server.httpUrl,
    apiKey: server.apiKey || ''
  };
};

const handleSaveEdit = () => {
  if (editingServerId.value && isEditFormValid.value) {
    updateServer(editingServerId.value, {
      alias: editForm.value.alias.trim(),
      wsUrl: editForm.value.wsUrl.trim(),
      httpUrl: editForm.value.httpUrl.trim(),
      apiKey: editForm.value.apiKey.trim() || undefined
    });
    handleCancelEdit();
  }
};

const handleCancelEdit = () => {
  editingServerId.value = null;
  editForm.value = { alias: '', wsUrl: '', httpUrl: '', apiKey: '' };
};

const getHealthColor = (serverId: string): string => {
  const health = state.value.healthStatus[serverId];
  if (!health) return 'bg-gray-400';

  switch (health.status) {
    case 'healthy':
      return 'bg-green-500';
    case 'degraded':
      return 'bg-yellow-500';
    case 'unhealthy':
      return 'bg-red-500';
    default:
      return 'bg-gray-400';
  }
};

const close = () => {
  handleCancelEdit();
  emit('close');
};
</script>
