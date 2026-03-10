<template>
  <header class="status-bar">
    <div class="brand-info">
      <div class="brand-logo">
        <img src="/botlogo.svg" alt="logo" width="28" height="28" />
      </div>
      <span class="brand-name">新点智能问数</span>
    </div>
    <div class="status-indicator">
      <label class="thinking-toggle" title="是否展示大模型的思考过程">
        <input type="checkbox" :checked="chatStore.showThinking" @change="chatStore.toggleThinking()" />
        <span class="thinking-toggle-text">显示思考过程</span>
      </label>
      <div class="divider"></div>
      <span class="status-dot" :class="statusClass"></span>
      <span class="status-text">{{ statusText }}</span>
    </div>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useConnectionStore } from '../stores/connection'
import { useChatStore } from '../stores/chat'

const connectionStore = useConnectionStore()
const chatStore = useChatStore()

// 状态样式类
const statusClass = computed(() => ({
  'status-dot--connected': connectionStore.status === 'connected',
  'status-dot--connecting': connectionStore.status === 'connecting',
  'status-dot--disconnected': connectionStore.status === 'disconnected',
}))

// 状态文本
const statusText = computed(() => {
  switch (connectionStore.status) {
    case 'connected': return '在线'
    case 'connecting': return '连接中...'
    case 'disconnected': return '离线'
    default: return '未知'
  }
})
</script>

<style scoped>
.status-bar {
  height: var(--statusbar-height);
  background: linear-gradient(135deg, var(--color-header-start), var(--color-header-end));
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-xl);
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(43, 125, 233, 0.2);
}

.brand-info {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.brand-logo {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.9);
}

.brand-name {
  font-size: var(--font-size-lg);
  font-weight: 600;
  color: #ffffff;
  letter-spacing: 0.5px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

.thinking-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: rgba(255, 255, 255, 0.9);
  font-size: var(--font-size-sm);
  user-select: none;
}

.thinking-toggle input {
  cursor: pointer;
}

.divider {
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.2);
  margin: 0 var(--space-sm);
}

.status-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  transition: background var(--transition-normal);
}

.status-dot--connected {
  background: #6ee7b7;
  box-shadow: 0 0 6px rgba(110, 231, 183, 0.6);
}

.status-dot--connecting {
  background: #fcd34d;
  animation: pulse 1.2s ease-in-out infinite;
}

.status-dot--disconnected {
  background: #fca5a5;
}

.status-text {
  font-size: var(--font-size-xs);
  color: rgba(255, 255, 255, 0.85);
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
</style>
