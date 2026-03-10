<template>
  <aside class="session-list">
    <!-- 新建会话按钮 -->
    <div class="session-header">
      <button class="btn-new-session" @click="sessionStore.createSession()" title="新建会话">
        <span class="icon-plus">+</span>
        <span>开启新对话</span>
      </button>
    </div>

    <!-- 会话列表 -->
    <div class="session-items">
      <!-- 按时间分组 -->
      <template v-for="group in groupedSessions" :key="group.label">
        <div class="session-group-label">{{ group.label }}</div>
        <div
          v-for="session in group.items"
          :key="session.key"
          class="session-item"
          :class="{ 'session-item--active': session.key === sessionStore.currentKey }"
          @click="sessionStore.switchTo(session.key)"
        >
          <div class="session-item-content">
            <div class="session-name">{{ getSessionTitle(session) }}</div>
            <div class="session-date">{{ formatDate(session) }}</div>
          </div>
          <button
            class="btn-delete"
            @click.stop="sessionStore.deleteSession(session.key)"
            title="删除会话"
          >
            ×
          </button>
        </div>
      </template>

      <!-- 如果没有会话，显示空状态 -->
      <div v-if="!sessionStore.loading && sessionStore.sessions.length === 0" class="session-empty">
        暂无会话
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useSessionStore } from '../stores/session'
import type { SessionItem } from '../api/types'

const sessionStore = useSessionStore()

// 格式化日期
function formatDate(session: SessionItem): string {
  // 尝试从 key 中提取时间戳
  const match = session.key.match(/(\d{13,})/)
  if (match) {
    const date = new Date(Number(match[1]))
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }
  return ''
}

// 获取会话显示标题
function getSessionTitle(session: SessionItem): string {
  if (session.derivedTitle) return session.derivedTitle
  if (session.label) return session.label
  if (session.lastMessagePreview) return session.lastMessagePreview
  
  // 新会话或者还没有内容的会话，做兜底格式化展示
  return '新对话'
}

// 按时间分组会话
const groupedSessions = computed(() => {
  const now = Date.now()
  const oneWeek = 7 * 24 * 60 * 60 * 1000
  const oneMonth = 30 * 24 * 60 * 60 * 1000

  const weekItems: SessionItem[] = []
  const monthItems: SessionItem[] = []
  const olderItems: SessionItem[] = []

  for (const session of sessionStore.sessions) {
    const match = session.key.match(/(\d{13,})/)
    const ts = match ? Number(match[1]) : now
    const diff = now - ts

    if (diff < oneWeek) {
      weekItems.push(session)
    } else if (diff < oneMonth) {
      monthItems.push(session)
    } else {
      olderItems.push(session)
    }
  }

  const groups: { label: string; items: SessionItem[] }[] = []
  if (weekItems.length > 0) groups.push({ label: '一周内', items: weekItems })
  if (monthItems.length > 0) groups.push({ label: '一个月内', items: monthItems })
  if (olderItems.length > 0) groups.push({ label: '更早', items: olderItems })

  // 如果没有分组结果但有会话，放到一个默认组
  if (groups.length === 0 && sessionStore.sessions.length > 0) {
    groups.push({ label: '全部会话', items: sessionStore.sessions })
  }

  return groups
})
</script>

<style scoped>
.session-list {
  width: var(--sidebar-width);
  background: var(--color-bg-secondary);
  border-right: 1px solid var(--color-border);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.session-header {
  padding: var(--space-lg);
  border-bottom: 1px solid var(--color-border);
}

.btn-new-session {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-xs);
  width: 100%;
  padding: var(--space-md) var(--space-lg);
  border-radius: var(--radius-md);
  border: 1px dashed var(--color-accent);
  color: var(--color-accent);
  font-size: var(--font-size-sm);
  font-weight: 500;
  transition: all var(--transition-fast);
  background: var(--color-accent-subtle);
}

.btn-new-session:hover {
  background: var(--color-accent-light);
  border-style: solid;
}

.icon-plus {
  font-size: var(--font-size-lg);
  font-weight: 300;
}

.session-items {
  flex: 1;
  overflow-y: auto;
  padding: var(--space-sm) var(--space-md);
}

.session-group-label {
  font-size: var(--font-size-xs);
  font-weight: 600;
  color: var(--color-text-muted);
  padding: var(--space-md) var(--space-sm) var(--space-xs);
  user-select: none;
}

.session-item {
  display: flex;
  align-items: center;
  padding: var(--space-md);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  margin-bottom: 2px;
}

.session-item:hover {
  background: var(--color-bg-hover);
}

.session-item--active {
  background: var(--color-bg-active);
}

.session-item-content {
  flex: 1;
  min-width: 0;
}

.session-name {
  font-size: var(--font-size-sm);
  color: var(--color-text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4;
}

.session-date {
  font-size: var(--font-size-xs);
  color: var(--color-text-muted);
  margin-top: 2px;
}

.btn-delete {
  width: 22px;
  height: 22px;
  border-radius: var(--radius-sm);
  color: var(--color-text-muted);
  font-size: var(--font-size-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.session-item:hover .btn-delete {
  opacity: 1;
}

.btn-delete:hover {
  background: var(--color-error);
  color: #fff;
  opacity: 1;
}

.session-empty {
  padding: var(--space-xl);
  text-align: center;
  color: var(--color-text-muted);
  font-size: var(--font-size-sm);
}
</style>
