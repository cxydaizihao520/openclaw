<template>
  <div class="app-layout">
    <StatusBar />
    <div class="app-body">
      <ChatView />
    </div>
  </div>
</template>

<script setup lang="ts">
import StatusBar from './StatusBar.vue'
import ChatView from './ChatView.vue'
</script>

<style scoped>
.app-layout {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-primary);
}

.app-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}
</style>
