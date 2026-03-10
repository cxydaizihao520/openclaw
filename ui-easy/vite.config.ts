import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  build: {
    // 构建产物输出到项目根 dist/easy-ui/，与 dist/chat-ui、dist/control-ui 统一
    outDir: "../dist/easy-ui",
    emptyOutDir: true,
    // 兼容麒麟V10自带浏览器（基于 Chromium 内核），降低目标
    target: "es2015",
  },
  server: {
    // 开发服务器端口（Gateway 在 10508，开发端口错开）
    port: 10509,
    host: "0.0.0.0",
    proxy: {
      // 开发模式：Gateway WebSocket 代理（使用 /ws 路径，避免与 Vite HMR 冲突）
      "/ws": {
        target: "ws://127.0.0.1:10508",
        ws: true,
        rewrite: (path: string) => path.replace(/^\/ws/, "/"),
      },
    },
  },
});
