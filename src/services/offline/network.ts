import { ref } from "vue";

/** Browser connectivity. `navigator.onLine` false means definitely offline; true can still mean no route. */
export const online = ref(navigator.onLine);

window.addEventListener("online", () => (online.value = true));
window.addEventListener("offline", () => (online.value = false));
