<script setup lang="ts">
import { ref } from 'vue'
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
  ],
})
const failedLogos = ref(new Set<string>())
</script>
<template>
  <section class="home-partners">
    <div class="public-container">
      <div class="partners-heading">
        <p>{{ subtitle }}</p>
        <h2>{{ title }}</h2>
      </div>
      <ul class="partners-grid">
        <li v-for="client in clients" :key="client.name">
          <span v-if="failedLogos.has(client.name)" class="partner-name">{{ client.name }}</span
          ><img
            v-else
            :src="client.logo"
            :alt="`${client.name} 로고`"
            loading="lazy"
            @error="failedLogos.add(client.name)"
          />
        </li>
      </ul>
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
.partners-grid {
  list-style: none;
  display: grid;
  grid-template-columns: repeat(8, minmax(0, 1fr));
  gap: 26px;
  margin: 0;
  padding: 0;
}
.partners-grid li {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 0;
  min-height: 58px;
}
.partners-grid img {
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
@media (max-width: 1000px) {
  .partners-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 25px 35px;
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
  .partners-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 24px 19px;
  }
  .partners-grid img {
    height: 37px;
  }
  .partners-grid li {
    min-height: 42px;
  }
  .partners-heading h2 {
    font-size: 11px;
  }
  .partner-name {
    font-size: 9px;
  }
}
</style>
