<template>
  <el-dialog
    v-model="localVisible"
    :title="product?.name"
    width="800"
    :close-on-click-modal="true"
    @close="handleClose"
  >
    <div v-if="product" class="product-detail">
      <el-row :gutter="20">
        <el-col :xs="24" :sm="12">
          <img
            :src="getFirstImageUrl(product.images)"
            :alt="product.name"
            class="detail-image"
          />
        </el-col>
        <el-col :xs="24" :sm="12">
          <div class="detail-info">
            <p class="detail-description">{{ product.description }}</p>
            <el-divider />
            <h4>제품 사양</h4>
            <ul class="specs-list">
              <li v-if="product.modelName"><strong>모델명:</strong> {{ product.modelName }}</li>
              <li v-if="product.dimensions"><strong>크기:</strong> {{ product.dimensions }}</li>
              <li><strong>소비전력:</strong> {{ product.power }}</li>
              <li><strong>수명:</strong> {{ product.lifespan }}</li>
              <li><strong>카테고리:</strong> {{ categoryName }}</li>
              <li v-if="product.colorTemp"><strong>색온도:</strong> {{ product.colorTemp }}</li>
              <li v-if="product.ledChipManufacturer">
                <strong>LED 칩 제조사:</strong> {{ product.ledChipManufacturer }}
              </li>
              <li v-if="product.certifications && product.certifications.length > 0">
                <strong>인증:</strong> {{ product.certifications.join(', ') }}
              </li>
            </ul>
            <el-divider />
            <el-button type="primary" size="large" @click="emit('quote')">
              견적 문의하기
            </el-button>
          </div>
        </el-col>
      </el-row>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { Product } from '@/types'
import { getFirstImageUrl } from '@/utils/image'

interface Props {
  visible: boolean
  product: Product | null
}

interface Emits {
  (e: 'update:visible', value: boolean): void
  (e: 'quote'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const localVisible = ref(props.visible)

watch(
  () => props.visible,
  (newValue) => {
    localVisible.value = newValue
  },
)

watch(localVisible, (newValue) => {
  emit('update:visible', newValue)
})

const categoryName = computed(() => {
  if (!props.product) return ''
  const categoryMap: Record<string, string> = {
    indoor: '실내용',
    outdoor: '실외용',
    industrial: '산업용',
    smart: '스마트 조명',
  }
  return categoryMap[props.product.category] || '기타'
})

const handleClose = () => {
  emit('update:visible', false)
}
</script>

<style scoped>
.product-detail {
  padding: 20px 0;
}

.detail-image {
  width: 100%;
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.1);
}

.detail-info {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.detail-description {
  font-size: 1.1rem;
  color: var(--toss-gray);
  line-height: 1.8;
  margin-bottom: 20px;
}

.detail-info h4 {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--toss-dark);
  margin-bottom: 15px;
}

.specs-list {
  list-style: none;
  padding: 0;
  margin: 0 0 20px 0;
}

.specs-list li {
  padding: 10px 0;
  border-bottom: 1px solid #e5e8eb;
  font-size: 1rem;
  color: var(--toss-dark);
}

.specs-list li:last-child {
  border-bottom: none;
}

.specs-list strong {
  display: inline-block;
  width: 100px;
  color: var(--toss-gray);
  font-weight: 600;
}

.detail-info .el-button {
  width: 100%;
  margin-top: auto;
}

/* Responsive */
@media (max-width: 768px) {
  .product-detail :deep(.el-col) {
    margin-bottom: 20px;
  }

  .detail-image {
    margin-bottom: 20px;
  }

  .detail-description {
    font-size: 1rem;
  }

  .detail-info h4 {
    font-size: 1.2rem;
  }

  .specs-list li {
    font-size: 0.95rem;
  }

  .specs-list strong {
    width: 90px;
  }
}
</style>
