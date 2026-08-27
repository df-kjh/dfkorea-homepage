<template>
  <div class="min-h-screen bg-background font-display text-text-main flex">
    <!-- Mobile Overlay -->
    <div
      v-if="isSidebarOpen"
      class="fixed inset-0 bg-black/50 z-40 lg:hidden"
      @click="isSidebarOpen = false"
    ></div>

    <!-- Left Sidebar Navigation -->
    <aside
      class="w-64 bg-white border-r border-gray-200 fixed left-0 top-0 h-screen flex flex-col z-50 transition-transform duration-300"
      :class="isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
    >
      <!-- Mobile Close Button -->
      <div class="lg:hidden flex justify-end p-4">
        <button
          @click="isSidebarOpen = false"
          class="text-gray-600 hover:text-gray-900 transition-colors"
        >
          <span class="material-symbols-outlined !text-[28px]">close</span>
        </button>
      </div>

      <!-- Navigation Menu -->
      <nav class="flex-1 px-4 py-6 space-y-2">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all text-left"
          :class="
            activeTab === tab.id
              ? 'bg-primary text-white'
              : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
          "
          @click="handleTabClick(tab.id)"
        >
          <span class="material-symbols-outlined !text-[24px]">{{ tab.icon }}</span>
          <span class="text-sm font-semibold">{{ tab.label }}</span>
        </button>
      </nav>

      <!-- Logout Button -->
      <div class="px-4 py-4 border-t border-gray-200">
        <button
          class="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-600 hover:bg-red-50 hover:text-red-600 transition-all"
          @click="handleLogout"
        >
          <span class="material-symbols-outlined !text-[24px]">logout</span>
          <span class="text-sm font-semibold">로그아웃</span>
        </button>
      </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 lg:ml-64">
      <!-- Top Header -->
      <header class="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-gray-100">
        <div class="flex items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <!-- Mobile Menu Button -->
          <button
            @click="isSidebarOpen = true"
            class="lg:hidden text-gray-600 hover:text-gray-900 transition-colors"
          >
            <span class="material-symbols-outlined !text-[28px]">menu</span>
          </button>

          <div>
            <p class="text-xs font-medium text-primary uppercase tracking-widest">Admin</p>
            <h2 class="text-base sm:text-lg font-bold tracking-tight">
              {{ tabs.find((t) => t.id === activeTab)?.label || 'Dashboard' }}
            </h2>
          </div>

          <!-- Empty div for spacing -->
          <div class="lg:hidden w-7"></div>
        </div>
      </header>

      <!-- Content -->
      <div class="p-4 sm:p-6 lg:p-8">
        <!-- Products Only View -->
        <div v-if="activeTab === 'products'">
          <ProductManagement />
        </div>

        <!-- News Only View -->
        <div v-else-if="activeTab === 'news'">
          <PostManagement />
        </div>

        <!-- Certificates Only View -->
        <div v-else-if="activeTab === 'certificates'">
          <CertificateManagement />
        </div>

        <!-- Tender notices -->
        <div v-else-if="activeTab === 'tenders'">
          <TenderManagement />
        </div>

        <!-- Settings Placeholder -->
        <div v-else-if="activeTab === 'settings'" class="py-12 text-center">
          <span class="material-symbols-outlined text-gray-300 text-8xl">settings</span>
          <h3 class="text-xl font-bold mt-4 mb-2">Settings</h3>
          <p class="text-gray-500">Settings page coming soon...</p>
        </div>
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from '@/composables/useToast'
import ProductManagement from '@/components/admin/ProductManagement.vue'
import PostManagement from '@/components/admin/PostManagement.vue'
import CertificateManagement from '@/components/admin/CertificateManagement.vue'
import TenderManagement from '@/components/admin/TenderManagement.vue'

const router = useRouter()
const route = useRoute()
const toast = useToast()
const activeTab = ref('products')
const isSidebarOpen = ref(false)

const tabs = [
  { id: 'products', icon: 'inventory_2', label: '제품' },
  { id: 'news', icon: 'newspaper', label: '소식' },
  { id: 'certificates', icon: 'workspace_premium', label: '인증서' },
  { id: 'tenders', icon: 'calendar_month', label: '입찰 공고' },
  { id: 'settings', icon: 'settings', label: '설정' },
]

// 페이지 로드 시 쿼리 파라미터에서 탭 정보 복원
onMounted(() => {
  const tabFromQuery = route.query.tab as string
  if (tabFromQuery && tabs.some(t => t.id === tabFromQuery)) {
    activeTab.value = tabFromQuery
  }
})

// 탭 변경 시 URL 쿼리 파라미터 업데이트
watch(activeTab, (newTab) => {
  router.replace({ query: { tab: newTab } })
})

const handleTabClick = (tabId: string) => {
  activeTab.value = tabId
  // Close sidebar on mobile after selection
  isSidebarOpen.value = false
}

const handleLogout = (): void => {
  if (confirm('로그아웃 하시겠습니까?')) {
    localStorage.removeItem('admin_token')
    localStorage.removeItem('admin_user')
    toast.success('로그아웃 되었습니다')
    router.push('/admin/login')
  }
}
</script>

<style scoped>
/* Space Grotesk font - ensure it's loaded */
.font-display {
  font-family: 'Space Grotesk', sans-serif;
}

/* Primary color override for admin dashboard */
.bg-primary {
  background-color: #22a8c3;
}

.text-primary {
  color: #22a8c3;
}

.hover\:bg-primary\/90:hover {
  background-color: rgba(34, 168, 195, 0.9);
}

.bg-surface {
  background-color: #f9fafb;
}
</style>
