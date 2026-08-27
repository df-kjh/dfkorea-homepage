import { createPinia } from "pinia";
import { useThemeStore } from "@/stores/theme";

export default defineNuxtPlugin((nuxtApp) => {
  const pinia = createPinia();
  nuxtApp.vueApp.use(pinia);

  if (import.meta.client) {
    const themeStore = useThemeStore();
    themeStore.initTheme();
  }
});
