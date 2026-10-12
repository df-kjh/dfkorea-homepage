<script setup lang="ts">
import { nextTick, ref } from 'vue'
import KindaLogo from '@/components/common/site/KindaLogo.vue'
import PublicAction from '@/components/common/site/PublicAction.vue'

const tabs = [
  { id: 'monitor', label: '상태 확인' },
  { id: 'control', label: '밝기 제어' },
  { id: 'history', label: '운영 기록' },
] as const
type TabId = (typeof tabs)[number]['id']
const selectedTab = ref<TabId>('control')
const brightness = ref(70)
const appliedBrightness = ref(70)
const feedback = ref('')
const lamps = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  x: 61 + (index % 6) * 63,
  y: 68 + Math.floor(index / 6) * 143,
  selected: index % 6 < 3,
}))

// Marketing examples remain local to this component; never send these values to hardware or a control API.
function applyExample() {
  appliedBrightness.value = brightness.value
  feedback.value = `화면 예시: 선택한 조명 6개를 ${brightness.value}%로 표시합니다.`
}
async function handleTabKey(event: KeyboardEvent, index: number) {
  const next =
    event.key === 'ArrowRight'
      ? (index + 1) % tabs.length
      : event.key === 'ArrowLeft'
        ? (index + tabs.length - 1) % tabs.length
        : event.key === 'Home'
          ? 0
          : event.key === 'End'
            ? tabs.length - 1
            : undefined
  if (next === undefined) return
  event.preventDefault()
  const tabList = (event.currentTarget as HTMLElement).parentElement
  selectedTab.value = tabs[next]!.id
  await nextTick()
  tabList?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
}
</script>
<template>
  <div class="kinda-visual">
    <p class="visual-label">기능 화면 예시</p>
    <div class="demo-window">
      <div class="demo-chrome">
        <KindaLogo class="demo-brand" compact />
        <div class="demo-site">B1 주차장<span>예시 현장</span></div>
      </div>
      <div class="demo-tabs" role="tablist" aria-label="킨다 기능 예시">
        <PublicAction
          v-for="(tab, index) in tabs"
          :key="tab.id"
          class="demo-tab"
          :id="`demo-tab-${tab.id}`"
          role="tab"
          :aria-selected="selectedTab === tab.id"
          :aria-controls="`demo-${tab.id}`"
          :tabindex="selectedTab === tab.id ? 0 : -1"
          @click="selectedTab = tab.id"
          @keydown="handleTabKey($event, index)"
          >{{ tab.label }}</PublicAction
        >
      </div>
      <div
        class="demo-panel"
        id="demo-control"
        role="tabpanel"
        aria-labelledby="demo-tab-control"
        :hidden="selectedTab !== 'control'"
      >
        <div class="demo-toolbar">
          <strong>B1 · 서측 주차구역</strong
          ><span class="status-legend"><i aria-hidden="true"></i>그룹 선택</span>
        </div>
        <div class="map-and-control">
          <div class="plan">
            <svg
              viewBox="0 0 440 280"
              role="img"
              aria-label="주차장 도면 예시. 선택한 조명 6개와 다른 구역 조명 6개를 표시합니다."
            >
              <rect class="plan-line" x="15" y="20" width="410" height="240" rx="5" />
              <path
                class="plan-line"
                d="M30 35H410V100H30ZM30 180H410V245H30ZM92 35V100M155 35V100M217 35V100M280 35V100M342 35V100M92 180V245M155 180V245M217 180V245M280 180V245M342 180V245M30 138H170M270 138H410M157 133l12 5-12 5M283 133l-12 5 12 5"
              />
              <rect class="plan-line" x="185" y="113" width="70" height="55" />
              <path
                class="plan-line"
                d="M197 125H215M197 131H215M197 137H215M197 143H215M197 149H215M227 125h17v25h-17z"
              />
              <text class="plan-label" x="194" y="162">계단 / EV</text>
              <text class="plan-label" x="37" y="116">서측 주차구역</text>
              <text class="plan-label" x="316" y="173">동측 주차구역</text>
              <g v-for="lamp in lamps" :key="lamp.id">
                <circle
                  class="lamp-halo"
                  :class="{ 'is-selected': lamp.selected }"
                  :cx="lamp.x"
                  :cy="lamp.y"
                  r="17"
                  :style="lamp.selected ? { opacity: 0.25 + brightness / 133 } : undefined"
                />
                <circle
                  class="lamp"
                  :class="{ 'is-selected': lamp.selected }"
                  :cx="lamp.x"
                  :cy="lamp.y"
                  r="7"
                  :style="
                    lamp.selected
                      ? { fill: `hsl(202 38% ${72 - appliedBrightness * 0.28}%)` }
                      : undefined
                  "
                />
                <text class="lamp-caption" :x="lamp.x - 9" :y="lamp.y + 30">
                  {{ String(lamp.id).padStart(2, '0') }}
                </text>
              </g>
            </svg>
          </div>
          <div class="demo-controls">
            <small>선택한 조명</small><strong>6개</strong
            ><label for="brightness"
              >밝기 <output id="brightness-value" for="brightness">{{ brightness }}%</output></label
            ><input
              id="brightness"
              aria-label="예시 조명 밝기"
              v-model.number="brightness"
              type="range"
              min="10"
              max="100"
              @input="feedback = ''"
            />
            <div class="range-scale"><span>10%</span><span>100%</span></div>
            <PublicAction class="demo-apply" id="demo-apply" @click="applyExample"
              >예시 적용</PublicAction
            >
          </div>
        </div>
        <p class="demo-feedback" role="status" id="demo-feedback" :hidden="!feedback">
          {{ feedback }}
        </p>
      </div>
      <div
        class="demo-panel demo-panel--monitor"
        id="demo-monitor"
        role="tabpanel"
        aria-labelledby="demo-tab-monitor"
        :hidden="selectedTab !== 'monitor'"
      >
        <div class="monitor-info">
          <div>
            <p>등록 조명</p>
            <strong>12<em>개</em></strong>
          </div>
          <div>
            <p>켜진 조명</p>
            <strong>12<em>개</em></strong>
          </div>
          <div>
            <p>조회 구역</p>
            <strong>B1</strong>
          </div>
        </div>
        <div class="monitor-list">
          <div class="monitor-row"><strong>서측 주차구역</strong><span>상태 확인</span></div>
          <div class="monitor-row"><strong>동측 주차구역</strong><span>상태 확인</span></div>
          <div class="monitor-row"><strong>층별 조명 현황</strong><span>한눈에 보기</span></div>
        </div>
      </div>
      <div
        class="demo-panel demo-panel--history"
        id="demo-history"
        role="tabpanel"
        aria-labelledby="demo-tab-history"
        :hidden="selectedTab !== 'history'"
      >
        <p class="history-heading">어떤 조명을, 어떻게 제어했는지.</p>
        <div class="history-list">
          <div class="history-row">
            <div>
              <strong>서측 주차구역 · 밝기 70%</strong><small>그룹 조명 6개 · 예시 기록</small>
            </div>
            <time>09:00</time>
          </div>
          <div class="history-row">
            <div>
              <strong>동측 주차구역 · 밝기 100%</strong><small>그룹 조명 6개 · 예시 기록</small>
            </div>
            <time>08:30</time>
          </div>
          <div class="history-row">
            <div><strong>주차장 조명 상태 조회</strong><small>조회 이력 · 예시 기록</small></div>
            <time>08:00</time>
          </div>
        </div>
      </div>
    </div>
    <p class="demo-caption">
      <svg viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <circle cx="8" cy="8" r="6" stroke="currentColor" />
        <path d="M8 7v4M8 4v1" stroke="currentColor" stroke-width="1.5" /></svg
      >기능 이해를 위한 화면 예시입니다. 실제 조명은 제어하지 않습니다.
    </p>
  </div>
</template>
<style scoped>
.kinda-visual {
  position: relative;
  min-width: 0;
  padding: 0;
}
.visual-label {
  margin: 0 0 15px;
  color: #88938b;
  font-size: 13px;
  text-align: right;
}
.demo-window {
  position: relative;
  border: 1px solid #cdd9dc;
  border-radius: 17px;
  overflow: hidden;
  background: #f4f8fa;
  box-shadow: 0 22px 55px #26372812;
}
.demo-chrome {
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 18px;
  background: white;
  border-bottom: 1px solid #dce5e9;
  gap: 16px;
}
.demo-brand {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #15324a;
  font-weight: 800;
  font-size: 16px;
}
.demo-brand img {
  width: 22px;
  height: 22px;
}
.demo-site {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #657e90;
}
.demo-site span {
  padding: 4px 8px;
  border-radius: 5px;
  background: #eef3f6;
  font-size: 11px;
  color: #657e90;
}
.demo-tabs {
  display: flex;
  gap: 5px;
  padding: 13px 16px 10px;
}
.demo-tabs .demo-tab {
  border: 0;
  background: transparent;
  color: #687d8d;
  padding: 9px 12px;
  font-size: 13px;
  font-weight: 650;
  border-radius: 7px;
  min-height: 38px;
  flex: 1;
  white-space: nowrap;
  justify-content: center;
  min-width: 0;
  gap: 0;
  line-height: 1.5;
  letter-spacing: normal;
}
.demo-tabs .demo-tab[aria-selected='true'] {
  background: #e3eff6;
  color: #256fa1;
}
.demo-tabs .demo-tab:hover {
  background: #e9f1f5;
}
.demo-panel {
  padding: 0 16px 16px;
}
.demo-panel[hidden] {
  display: none;
}
.demo-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: center;
  background: white;
  border: 1px solid #dce5e9;
  border-bottom: 0;
  padding: 12px 14px;
  border-radius: 9px 9px 0 0;
}
.demo-toolbar strong {
  font-size: 13px;
  color: #15324a;
  line-height: 1.6;
}
.status-legend {
  font-size: 11px;
  color: #6b7d84;
  display: flex;
  align-items: center;
  gap: 6px;
}
.status-legend i {
  width: 6px;
  height: 6px;
  background: #2a7958;
  border-radius: 50%;
}
.map-and-control {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 134px;
  border: 1px solid #dce5e9;
  border-radius: 0 0 9px 9px;
  overflow: hidden;
  background: white;
}
.plan {
  padding: 16px 10px;
  background: #eef3f6;
  position: relative;
  min-width: 0;
  display: grid;
  align-items: center;
}
.plan svg {
  width: 100%;
  height: auto;
}
.plan-line {
  stroke: #9aabb6;
  stroke-width: 1;
  fill: none;
}
.plan-label {
  fill: #8c9faa;
  font-family: var(--font-family-sans);
  font-size: 11px;
}
.lamp {
  fill: #dcecd7;
  stroke: #35754e;
  stroke-width: 1.5;
}
.lamp-halo {
  fill: #dcecd740;
  stroke: #35754e30;
  stroke-width: 1;
}
.lamp.is-selected {
  fill: #6b9cb8;
  stroke: #256fa1;
}
.lamp-halo.is-selected {
  fill: #256fa110;
  stroke: #256fa140;
}
.lamp-caption {
  fill: #6e8693;
  font-family: var(--font-family-sans);
  font-size: 10px;
}
.demo-controls {
  padding: 18px 13px;
  border-left: 1px solid #dce5e9;
  color: #15324a;
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.demo-controls small {
  font-size: 12px;
  color: #6b7d84;
}
.demo-controls strong {
  font-size: 25px;
  letter-spacing: -0.04em;
  margin: 6px 0 17px;
  font-weight: 700;
}
.demo-controls label {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  margin: 0 0 8px;
  line-height: 1.6;
}
.demo-controls input {
  width: 100%;
  height: 28px;
  accent-color: #256fa1;
  margin: 0;
}
.range-scale {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: #8a99a1;
  margin-top: 3px;
}
.demo-controls .demo-apply {
  background: #256fa1;
  color: white;
  border: 0;
  border-radius: 6px;
  min-height: 36px;
  font-size: 12px;
  font-weight: 650;
  margin-top: 16px;
  padding: 9px 4px;
  justify-content: center;
  gap: 0;
  letter-spacing: normal;
}
.demo-caption {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #74858d;
  line-height: 1.65;
  margin-top: 12px;
  padding-inline: 1px;
}
.demo-caption svg {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
}
.demo-feedback {
  color: #256fa1;
  font-size: 12px;
  padding: 8px 14px;
  background: #e7f0f6;
  line-height: 1.6;
  border-radius: 7px;
  margin-top: 10px;
  min-height: 34px;
}
.demo-feedback[hidden] {
  display: none;
}
.monitor-info {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  background: white;
  border: 1px solid #dce5e9;
  border-radius: 9px;
  padding: 20px 15px;
  margin-bottom: 12px;
}
.monitor-info p {
  font-size: 12px;
  color: #788d96;
}
.monitor-info strong {
  display: block;
  margin-top: 8px;
  font-size: 24px;
  color: #15324a;
  font-weight: 700;
}
.monitor-info strong em {
  font-style: normal;
  font-size: 12px;
  font-weight: 500;
}
.monitor-row,
.history-row {
  padding: 14px;
  border-bottom: 1px solid #e2e9ec;
  font-size: 13px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.monitor-row > span {
  color: #2a7958;
  font-size: 11px;
  background: #ebf5ee;
  border-radius: 5px;
  padding: 5px 7px;
}
.monitor-list,
.history-list {
  background: white;
  border: 1px solid #dce5e9;
  border-radius: 9px;
  overflow: hidden;
  color: #15324a;
}
.monitor-row:last-child,
.history-row:last-child {
  border: 0;
}
.history-row div {
  display: grid;
  gap: 6px;
}
.history-row small {
  font-size: 11px;
  color: #7e8e97;
}
.history-row time {
  font-size: 12px;
  color: #7e8e97;
  white-space: nowrap;
}
.history-heading {
  font-size: 14px;
  font-weight: 650;
  color: #15324a;
  margin: 8px 0 16px;
}
.demo-panel--monitor,
.demo-panel--history {
  min-height: 298px;
}

.demo-controls .demo-apply:hover {
  background: #1d5b84;
  border-color: transparent;
}
@media (max-width: 1100px) {
  .demo-controls {
    padding-inline: 10px;
  }
  .map-and-control {
    grid-template-columns: minmax(0, 1fr) 117px;
  }
}
@media (max-width: 900px) {
  .demo-window {
    max-width: 720px;
  }
  .map-and-control {
    grid-template-columns: minmax(0, 1fr) 190px;
  }
  .demo-controls {
    padding: 22px;
  }
  .demo-controls strong {
    font-size: 32px;
  }
  .demo-controls label {
    font-size: 14px;
  }
  .demo-controls .demo-apply {
    min-height: 42px;
    font-size: 14px;
  }
  .demo-toolbar strong {
    font-size: 15px;
  }
  .demo-tabs .demo-tab {
    font-size: 14px;
  }
  .plan {
    padding: 18px;
  }
}
@media (max-width: 767px) {
  .demo-window {
    border-radius: 12px;
  }
  .demo-chrome {
    height: 45px;
    padding-inline: 13px;
    gap: 10px;
  }
  .demo-site {
    font-size: 11px;
  }
  .demo-site span {
    display: none;
  }
  .demo-tabs {
    padding: 10px 8px;
    gap: 3px;
  }
  .demo-tabs .demo-tab {
    font-size: 12px;
    padding: 9px 6px;
    min-height: 38px;
  }
  .demo-panel {
    padding: 0 10px 12px;
  }
  .demo-toolbar {
    padding: 11px 10px;
  }
  .demo-toolbar strong {
    font-size: 12px;
  }
  .status-legend {
    font-size: 10px;
    gap: 4px;
  }
  .map-and-control {
    grid-template-columns: minmax(0, 1fr);
  }
  .plan {
    padding: 15px 10px;
  }
  .demo-controls {
    border-left: 0;
    border-top: 1px solid #dce5e9;
    padding: 13px 14px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0 20px;
    align-items: center;
  }
  .demo-controls small {
    font-size: 11px;
  }
  .demo-controls strong {
    font-size: 21px;
    margin: 5px 0;
    grid-row: 2;
    grid-column: 1;
  }
  .demo-controls label {
    grid-row: 1;
    grid-column: 2;
    font-size: 12px;
    margin: 0;
  }
  .demo-controls input {
    grid-row: 2;
    grid-column: 2;
    height: 38px;
    min-width: 0;
  }
  .range-scale {
    display: none;
  }
  .demo-controls .demo-apply {
    grid-column: 1/-1;
    min-height: 38px;
    margin-top: 12px;
    font-size: 13px;
  }
  .demo-caption {
    font-size: 11px;
    align-items: flex-start;
  }
  .monitor-info {
    padding: 16px 12px;
    gap: 7px;
  }
  .monitor-info p {
    font-size: 11px;
  }
  .monitor-info strong {
    font-size: 21px;
  }
  .monitor-row,
  .history-row {
    font-size: 12px;
  }
  .demo-panel--monitor,
  .demo-panel--history {
    min-height: 300px;
  }
}
@media (max-width: 350px) {
  .demo-controls {
    gap: 0 14px;
  }
  .demo-tabs .demo-tab {
    font-size: 11px;
  }
}
</style>
