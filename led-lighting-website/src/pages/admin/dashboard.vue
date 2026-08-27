<template>
  <AdminDashboard />
</template>

<script setup lang="ts">
import AdminDashboard from "@/views/admin/AdminDashboard.vue";

definePageMeta({
  middleware: "auth",
});
</script>
