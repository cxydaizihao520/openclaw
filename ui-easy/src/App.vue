<template>
  <AppLayout />
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useConnectionStore } from './stores/connection'
import AppLayout from './components/AppLayout.vue'

const connectionStore = useConnectionStore()

onMounted(() => {
  // Token 获取优先级：URL 参数 > 环境变量
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token') || import.meta.env.VITE_GATEWAY_TOKEN || undefined

  connectionStore.connect(token)
})
</script>
