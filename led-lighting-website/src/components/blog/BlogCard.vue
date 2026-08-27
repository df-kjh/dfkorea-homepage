<template>
  <el-card :body-style="{ padding: '0px' }" shadow="hover" class="blog-card">
    <div class="blog-image">
      <img :src="getImageUrl(post.image)" :alt="post.title" loading="lazy" />
      <div class="blog-category">
        <el-tag :type="categoryType">
          {{ categoryName }}
        </el-tag>
      </div>
    </div>
    <div class="blog-content">
      <div class="blog-meta">
        <span>
          <el-icon><Calendar /></el-icon>
          {{ formattedDate }}
        </span>
        <span>
          <el-icon><View /></el-icon>
          {{ post.views }}
        </span>
      </div>
      <h3 class="blog-title">{{ post.title }}</h3>
      <p class="blog-excerpt">{{ post.excerpt }}</p>
      <el-button type="primary" text @click="emit('view', post)">
        자세히 보기
        <el-icon class="el-icon--right"><ArrowRight /></el-icon>
      </el-button>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Calendar, View, ArrowRight } from '@element-plus/icons-vue'
import { getImageUrl } from '@/utils/image'

interface BlogPost {
  id: string
  title: string
  excerpt: string
  content: string
  category: string
  image: string
  views: number
  createdAt: string
  updatedAt: string
}

interface Props {
  post: BlogPost
}

interface Emits {
  (e: 'view', post: BlogPost): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const categoryMap: Record<string, string> = {
  회사소식: '회사소식',
  제품소식: '제품소식',
  기술정보: '기술정보',
  산업동향: '산업동향',
}

const categoryTypeMap: Record<string, '' | 'success' | 'info' | 'warning' | 'danger'> = {
  회사소식: 'info',
  제품소식: 'success',
  기술정보: 'danger',
  산업동향: 'warning',
}

const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

const categoryName = computed(() => categoryMap[props.post.category] || '기타')
const categoryType = computed(() => categoryTypeMap[props.post.category] || '')
const formattedDate = computed(() => formatDate(props.post.createdAt))
</script>

<style scoped>
.blog-card {
  border-radius: 20px;
  overflow: hidden;
  transition:
    transform 0.3s ease,
    box-shadow 0.3s ease;
  border: 1px solid #e5e8eb;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.blog-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
}

.blog-image {
  width: 100%;
  height: 240px;
  overflow: hidden;
  background-color: var(--toss-light-gray);
  position: relative;
}

.blog-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.blog-card:hover .blog-image img {
  transform: scale(1.05);
}

.blog-category {
  position: absolute;
  top: 15px;
  left: 15px;
}

.blog-content {
  padding: 24px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.blog-meta {
  display: flex;
  gap: 20px;
  margin-bottom: 15px;
  font-size: 0.9rem;
  color: var(--toss-gray);
}

.blog-meta span {
  display: flex;
  align-items: center;
  gap: 6px;
}

.blog-meta .el-icon {
  font-size: 16px;
}

.blog-title {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--toss-dark);
  margin-bottom: 12px;
  line-height: 1.4;
  letter-spacing: -0.01em;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.blog-excerpt {
  font-size: 0.95rem;
  color: var(--toss-gray);
  line-height: 1.6;
  margin-bottom: 20px;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Responsive */
@media (max-width: 768px) {
  .blog-image {
    height: 200px;
  }

  .blog-content {
    padding: 20px;
  }

  .blog-title {
    font-size: 1.15rem;
  }

  .blog-excerpt {
    font-size: 0.9rem;
  }

  .blog-meta {
    font-size: 0.85rem;
  }
}

@media (max-width: 480px) {
  .blog-image {
    height: 180px;
  }

  .blog-title {
    font-size: 1.1rem;
  }
}
</style>
