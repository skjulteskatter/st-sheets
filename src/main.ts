import { createApp } from "vue";
import "./index.css";
import App from "./App.vue";
import "./services/wakeLock";
import "./services/install";

createApp(App).mount("#app");
