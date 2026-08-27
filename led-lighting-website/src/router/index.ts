import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  scrollBehavior(to, from, savedPosition) {
    // savedPosition이 있으면 (브라우저 뒤로가기 등) 그 위치로 복원
    if (savedPosition) {
      return savedPosition
    }
    // 해시가 있으면 해당 요소로 스크롤
    if (to.hash) {
      return {
        el: to.hash,
        behavior: 'smooth',
      }
    }
    // 기본적으로 페이지 최상단으로 스크롤
    return { top: 0, left: 0, behavior: 'smooth' }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/tailwind-test',
      name: 'tailwind-test',
      component: () => import('../views/TailwindTest.vue'),
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
    {
      path: '/certificates',
      name: 'certificates',
      component: () => import('../views/CertificatesView.vue'),
    },
    {
      path: '/certificates/:id',
      name: 'certificate-category-detail',
      component: () => import('../views/CertificateDetailView.vue'),
    },
    {
      path: '/products',
      name: 'products',
      component: () => import('../views/ProductsView.vue'),
    },
    {
      path: '/products/:id',
      name: 'product-detail',
      component: () => import('../views/ProductDetailView.vue'),
    },
    {
      path: '/blog',
      name: 'blog',
      component: () => import('../views/BlogView.vue'),
    },
    {
      path: '/blog/:id',
      name: 'blog-detail',
      component: () => import('../views/BlogDetailView.vue'),
    },
    {
      path: '/admin/login',
      name: 'admin-login',
      component: () => import('../views/admin/AdminLogin.vue'),
    },
    {
      path: '/admin/dashboard',
      name: 'admin-dashboard',
      component: () => import('../views/admin/AdminDashboard.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/products/new',
      name: 'admin-product-create',
      component: () => import('../views/admin/ProductFormView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/products/:id',
      name: 'admin-product-edit',
      component: () => import('../views/admin/ProductFormView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/posts/new',
      name: 'admin-post-create',
      component: () => import('../views/admin/PostFormView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/posts/:id',
      name: 'admin-post-edit',
      component: () => import('../views/admin/PostFormView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/certificates/new',
      name: 'admin-certificate-create',
      component: () => import('../views/admin/CertificateFormView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin/certificates/:id',
      name: 'admin-certificate-edit',
      component: () => import('../views/admin/CertificateFormView.vue'),
      meta: { requiresAuth: true },
    },
    // 404 Not Found - 모든 라우트의 마지막에 위치해야 함
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../views/NotFoundView.vue'),
    },
  ],
})

// 인증 가드
router.beforeEach((to, from, next) => {
  const token = localStorage.getItem('admin_token')

  // 인증이 필요한 페이지인데 토큰이 없는 경우만 체크
  if (to.meta.requiresAuth && !token) {
    return next('/admin/login')
  }

  // 그 외의 경우는 모두 허용
  next()
})

export default router
