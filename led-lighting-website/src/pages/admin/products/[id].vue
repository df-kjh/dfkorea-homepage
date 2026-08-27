<template>
  <ProductFormView />
</template>

<script setup lang="ts">
import ProductFormView from "@/views/admin/ProductFormView.vue";

definePageMeta({
  middleware: "auth",
});
</script>
