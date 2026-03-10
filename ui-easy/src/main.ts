// 应用入口 — 初始化 Vue + Pinia + 样式

import { createPinia } from "pinia";
import { createApp } from "vue";
import App from "./App.vue";
// 导入样式
import "./styles/variables.css";
import "./styles/main.css";

const app = createApp(App);
const pinia = createPinia();

app.use(pinia);
app.mount("#app");
