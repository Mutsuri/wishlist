<script setup lang="ts">
// Bottom sheet on phones, centered dialog on PC.
defineProps<{ open: boolean, label: string }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet" :duration="350">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-end lg:items-center lg:justify-center lg:p-6"
        role="dialog"
        aria-modal="true"
        :aria-label="label"
      >
        <div class="sheet-backdrop absolute inset-0 bg-black/40 lg:backdrop-blur-sm" @click="emit('close')" />
        <div class="sheet-panel relative max-h-[92dvh] w-full overflow-y-auto rounded-t-[14px] bg-bg px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] lg:max-h-[85dvh] lg:max-w-[480px] lg:rounded-[20px] lg:px-6 lg:pb-6 lg:shadow-[0_24px_80px_rgb(0_0_0/0.3)] lg:ring-1 lg:ring-line">
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
