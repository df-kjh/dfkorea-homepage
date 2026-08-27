<template>
  <div id="app" class="bg-background-dark min-h-screen flex flex-col text-white font-sans">
    <TheNavigation v-if="!isAdminPage" />

    <main class="flex-1 w-full">
      <NuxtPage />
    </main>

    <TheFooter v-if="!isAdminPage" />

    <button
      v-show="showBackTop && !isAdminPage"
      class="fixed right-8 bottom-8 w-12 h-12 bg-primary text-background-white rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all hover:-translate-y-1 z-50"
      aria-label="Back to top"
      @click="scrollToTop"
    >
      <span class="material-symbols-outlined">arrow_upward</span>
    </button>

    <ToastContainer />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import TheNavigation from "@/components/layout/TheNavigation.vue";
import TheFooter from "@/components/layout/TheFooter.vue";
import ToastContainer from "@/components/common/ToastContainer.vue";

const route = useRoute();
const isAdminPage = computed(() => route.path.startsWith("/admin"));
const showBackTop = ref(false);

const handleScroll = () => {
  showBackTop.value = window.scrollY > 300;
};

const scrollToTop = () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
};

onMounted(() => {
  window.addEventListener("scroll", handleScroll);
});

onUnmounted(() => {
  window.removeEventListener("scroll", handleScroll);
});
</script>
