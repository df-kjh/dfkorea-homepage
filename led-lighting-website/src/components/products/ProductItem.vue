<template>
  <el-card :body-style="{ padding: '0px' }" shadow="hover" class="product-card">
    <div class="product-image">
      <img
        :src="getFirstImageUrl(product.images)"
        :alt="product.name"
      />
      <div class="product-badge" v-if="product.isNew">
        <el-tag type="danger" effect="dark">NEW</el-tag>
      </div>
    </div>
    <div class="product-body">
      <h3>{{ product.name }}</h3>
      <p class="product-description">{{ product.description }}</p>
      <div class="product-specs">
        <div class="spec-item">
          <el-icon><Lightning /></el-icon>
          <span>{{ product.power }}</span>
        </div>
        <div class="spec-item">
          <el-icon><Timer /></el-icon>
          <span>{{ product.lifespan }}</span>
        </div>
      </div>
      <div class="product-footer">
        <el-button type="primary" @click="emit('detail', product)"> 상세보기 </el-button>
        <el-button @click="emit('inquiry', product)">
          <el-icon><ShoppingCart /></el-icon>
        </el-button>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Lightning, Timer, ShoppingCart } from '@element-plus/icons-vue'
import type { Product } from '@/types'
import { getFirstImageUrl } from '@/utils/image'

interface Props {
  product: Product
}

interface Emits {
  (e: 'detail', product: Product): void
  (e: 'inquiry', product: Product): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()
</script>

<style scoped>
.product-card {
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

.product-card:hover {
  transform: translateY(-8px);
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.08);
}

.product-image {
  width: 100%;
  height: 220px;
  overflow: hidden;
  background-color: var(--toss-light-gray);
  position: relative;
}

.product-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.product-card:hover .product-image img {
  transform: scale(1.05);
}

.product-badge {
  position: absolute;
  top: 15px;
  right: 15px;
}

.product-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.product-body h3 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--toss-dark);
  margin-bottom: 10px;
  letter-spacing: -0.01em;
}

.product-description {
  font-size: 0.95rem;
  color: var(--toss-gray);
  line-height: 1.5;
  margin-bottom: 15px;
  flex: 1;
}

.product-specs {
  display: flex;
  gap: 15px;
  margin-bottom: 20px;
}

.spec-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.9rem;
  color: var(--toss-gray);
}

.spec-item .el-icon {
  color: var(--toss-blue);
  font-size: 18px;
}

.product-footer {
  display: flex;
  gap: 10px;
}

.product-footer .el-button {
  flex: 1;
}

.product-footer .el-button:last-child {
  flex: 0;
  padding: 12px;
}

/* Responsive */
@media (max-width: 768px) {
  .product-image {
    height: 200px;
  }

  .product-body {
    padding: 20px;
  }

  .product-body h3 {
    font-size: 1.15rem;
  }

  .product-description {
    font-size: 0.9rem;
  }
}

@media (max-width: 480px) {
  .product-image {
    height: 180px;
  }

  .product-body h3 {
    font-size: 1.1rem;
  }
}
</style>
