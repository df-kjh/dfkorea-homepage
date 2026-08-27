<template>
  <PostFormView />
</template>

<script setup lang="ts">
import PostFormView from "@/views/admin/PostFormView.vue";

definePageMeta({
  middleware: "auth",
});
</script>
