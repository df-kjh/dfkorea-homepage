<script setup lang="ts">
import { computed, useId } from 'vue'
const props = withDefaults(
  defineProps<{
    modelValue?: string
    field: string
    label: string
    limit: number
    multiline?: boolean
    required?: boolean
    error?: string
    placeholder?: string
  }>(),
  { modelValue: '', multiline: false, required: false, error: '', placeholder: '' },
)
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const id = useId()
const invalid = computed(() => !!props.error || props.modelValue.length > props.limit)
const update = (event: Event) => emit('update:modelValue', (event.target as HTMLInputElement).value)
</script>
<template>
  <div class="detail-field">
    <label :for="id">{{ label }} <span v-if="required" aria-hidden="true">*</span></label>
    <textarea
      v-if="multiline"
      :id="id"
      :data-detail-field="field"
      :value="modelValue"
      :maxlength="limit"
      :required="required"
      :aria-invalid="invalid"
      :aria-describedby="`${id}-hint`"
      :placeholder="placeholder"
      rows="3"
      @input="update"
    />
    <input
      v-else
      :id="id"
      :data-detail-field="field"
      :value="modelValue"
      :maxlength="limit"
      :required="required"
      :aria-invalid="invalid"
      :aria-describedby="`${id}-hint`"
      :placeholder="placeholder"
      type="text"
      @input="update"
    />
    <p :id="`${id}-hint`" class="detail-field-hint" :class="{ 'detail-field-error': invalid }">
      {{ error || `${modelValue.length} / ${limit}자` }}
    </p>
  </div>
</template>
