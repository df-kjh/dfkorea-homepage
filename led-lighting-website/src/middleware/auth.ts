export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server || !to.path.startsWith("/admin")) {
    return;
  }

  if (to.path === "/admin/login") {
    return;
  }

  const token = localStorage.getItem("admin_token");
  if (!token) {
    return navigateTo("/admin/login");
  }
});
