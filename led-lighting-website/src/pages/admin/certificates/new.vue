<template>
  <CertificateFormView />
</template>

<script setup lang="ts">
import CertificateFormView from "@/views/admin/CertificateFormView.vue";

definePageMeta({
  middleware: "auth",
});
</script>
