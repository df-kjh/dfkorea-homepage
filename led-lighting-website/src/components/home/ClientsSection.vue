<script setup lang="ts">
import { ref } from 'vue'
import PublicAction from '@/components/common/site/PublicAction.vue'
interface Client {
  name: string
  logo: string
}
withDefaults(defineProps<{ title?: string; subtitle?: string; clients?: Client[] }>(), {
  title: '함께해 온 파트너',
  subtitle: 'PARTNERS',
  clients: () => [
    { name: '경찰청', logo: '/images/clients/경찰청.svg' },
    { name: '농협', logo: '/images/clients/농협 하나로마트.svg' },
    { name: '서울시설관리공단', logo: '/images/clients/서울시설관리공단.svg' },
    { name: '셀트리온', logo: '/images/clients/셀트리온.svg' },
    { name: '인천공항', logo: '/images/clients/인천공항.svg' },
    { name: '인하대', logo: '/images/clients/인하대.svg' },
    { name: '한솥', logo: '/images/clients/한솥도시락.svg' },
    { name: 'CGV', logo: '/images/clients/CGV.svg' },
    { name: '삼성바이오로직스', logo: '/images/clients/samsung-biologics.svg' },
    { name: '앰코코리아', logo: '/images/clients/amkor-korea.svg' },
    { name: 'LH 한국토지주택공사', logo: '/images/clients/lh.svg' },
  ],
})
const failedLogos = ref(new Set<string>())
const paused = ref(false)
</script>
<template>
  <section class="home-partners">
    <div class="public-container">
      <div class="partners-heading">
        <p>{{ subtitle }}</p>
        <h2>{{ title }}</h2>
        <PublicAction
          class="partners-control"
          variant="text"
          :aria-label="paused ? '파트너 로고 재생' : '파트너 로고 일시정지'"
          :aria-pressed="paused"
          @click="paused = !paused"
        >
          <span aria-hidden="true">{{ paused ? '▶' : 'Ⅱ' }}</span>
          {{ paused ? '재생' : '일시정지' }}
        </PublicAction>
      </div>
      <div class="partners-carousel">
        <div class="partners-track" :data-paused="paused">
          <!-- Equal-width groups make the loop seamless; only the original is read aloud. -->
          <ul
            v-for="copy in 2"
            :key="copy"
            class="partners-group"
            :aria-label="copy === 1 ? title : undefined"
            :aria-hidden="copy === 2 ? true : undefined"
          >
            <li v-for="client in clients" :key="client.name">
              <span v-if="failedLogos.has(client.name)" class="partner-name">{{
                client.name
              }}</span>
              <img
                v-else
                :src="client.logo"
                :alt="copy === 1 ? `${client.name} 로고` : ''"
                loading="lazy"
                @error="failedLogos.add(client.name)"
              />
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
<style scoped>
.home-partners {
  padding: 52px 0 61px;
  background: #e9e4d9;
  color: var(--df-ink, #080906);
}
.partners-heading {
  display: flex;
  align-items: center;
  gap: 22px;
  margin-bottom: 34px;
}
.partners-heading p {
  font-size: 8px;
  letter-spacing: 0.18em;
  color: #9a8c73;
  margin: 0;
}
.partners-heading h2 {
  font-size: 13px;
  font-weight: 400;
  letter-spacing: -0.035em;
  margin: 0;
  color: #79715f;
}
.partners-heading :deep(.partners-control) {
  margin-left: auto;
  min-height: 32px;
  padding: 4px 0 4px 12px;
  gap: 8px;
  border: 0;
  font-size: 10px;
  color: #79715f;
  white-space: nowrap;
}
.partners-carousel {
  overflow: hidden;
  mask-image: linear-gradient(
    to right,
    transparent,
    #000 28px,
    #000 calc(100% - 28px),
    transparent
  );
}
.partners-track {
  display: flex;
  width: max-content;
  animation: partners-scroll 44s linear infinite;
}
.partners-track[data-paused='true'],
.partners-carousel:hover .partners-track {
  animation-play-state: paused;
}
.partners-group {
  list-style: none;
  display: flex;
  flex: 0 0 auto;
  min-width: calc(min(100vw, 1440px) - 2 * var(--df-gutter, 24px));
  justify-content: space-around;
  gap: 36px;
  margin: 0;
  padding: 0 36px 0 0;
}
.partners-group li {
  display: flex;
  flex: 0 0 140px;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 58px;
}
.partners-group img {
  width: 100%;
  height: 52px;
  object-fit: contain;
  filter: grayscale(1);
  opacity: 0.65;
  max-width: 125px;
  mix-blend-mode: multiply;
}
.partner-name {
  font-size: 12px;
  color: #786f5c;
  text-align: center;
  overflow-wrap: anywhere;
}
@keyframes partners-scroll {
  to {
    transform: translateX(-50%);
  }
}
@media (max-width: 600px) {
  .home-partners {
    padding: 36px 0 40px;
  }
  .partners-heading {
    gap: 16px;
    margin-bottom: 25px;
  }
  .partners-group {
    gap: 28px;
    padding-right: 28px;
  }
  .partners-group img {
    height: 44px;
  }
  .partners-group li {
    flex-basis: 116px;
    min-height: 52px;
  }
  .partners-heading h2 {
    font-size: 11px;
  }
  .partner-name {
    font-size: 9px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .partners-track {
    animation: none;
    width: 100%;
  }
  .partners-group {
    width: 100%;
    min-width: 0;
    padding: 0;
    flex-wrap: wrap;
  }
  .partners-group[aria-hidden='true'],
  .partners-heading :deep(.partners-control) {
    display: none;
  }
  .partners-carousel {
    mask-image: none;
  }
}
</style>
