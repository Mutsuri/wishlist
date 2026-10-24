<script setup lang="ts">
import type { CategoryColor } from '~/composables/useWishes'

const emit = defineEmits<{ close: [], created: [id: string] }>()
const { items, categories, addCategory, updateCategory, removeCategory, nextColor } = useWishes()

const counts = computed(() => {
  const m: Record<string, number> = {}
  for (const w of items.value) if (w.cat) m[w.cat] = (m[w.cat] ?? 0) + 1
  return m
})

const openColor = ref<string | null>(null)
const confirmDelete = ref<string | null>(null)
const newName = ref('')
const newColor = ref<CategoryColor>(nextColor())
const newEl = ref<HTMLInputElement>()

defineExpose({ focus: () => newEl.value?.focus() })

function create() {
  const name = newName.value.trim()
  if (!name) { newEl.value?.focus(); return }
  const c = addCategory(name, newColor.value)
  newName.value = ''
  newColor.value = nextColor()
  emit('created', c.id)
}
function rename(id: string, e: Event) {
  const v = (e.target as HTMLInputElement).value.trim()
  if (v) updateCategory(id, { name: v })
  else (e.target as HTMLInputElement).value = categories.value.find(c => c.id === id)?.name ?? ''
}

const group = 'overflow-hidden rounded-xl bg-card divide-y divide-line ring-1 ring-line'
const input = 'min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-sub/60'
</script>

<template>
  <div class="flex flex-col">
    <div class="sticky top-0 z-10 -mx-4 mb-4 grid grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-xl lg:-mx-6 lg:px-6">
      <span />
      <span class="text-[17px] font-semibold">หมวดหมู่</span>
      <button type="button" class="justify-self-end text-[17px] font-semibold text-accent transition-opacity hover:opacity-70 active:opacity-40" @click="emit('close')">เสร็จ</button>
    </div>

    <div class="flex flex-col gap-6">
      <div>
        <p class="px-4 pb-1.5 text-[13px] text-sub">หมวดใหม่</p>
        <form :class="group" @submit.prevent="create">
          <div class="flex min-h-11 items-center gap-3 px-4">
            <span class="size-3 shrink-0 rounded-full" :style="{ background: CATEGORY_COLORS[newColor] }" aria-hidden="true" />
            <input
              id="cm-new"
              ref="newEl"
              v-model="newName"
              :class="input"
              maxlength="40"
              placeholder="เช่น จัดสเปคคอม, ของแต่งห้อง"
              autocomplete="off"
            >
            <button type="submit" class="shrink-0 text-[15px] font-semibold text-accent transition-opacity enabled:hover:opacity-70 enabled:active:opacity-40 disabled:text-sub/50" :disabled="!newName.trim()">เพิ่ม</button>
          </div>
          <div class="px-4 py-3">
            <ColorDots v-model="newColor" />
          </div>
        </form>
      </div>

      <div v-if="categories.length">
        <p class="px-4 pb-1.5 text-[13px] text-sub">หมวดของคุณ</p>
        <div :class="group">
          <div v-for="c in categories" :key="c.id">
            <div v-if="confirmDelete === c.id" class="flex min-h-11 items-center gap-3 bg-red/8 px-4 py-2 text-[14px]">
              <span class="min-w-0 flex-1">
                ลบหมวด “{{ c.name }}”?
                <span v-if="counts[c.id]" class="block text-[12px] text-sub">ของ {{ counts[c.id] }} ชิ้นจะย้ายไปไม่มีหมวด</span>
              </span>
              <button type="button" class="shrink-0 font-medium text-sub transition hover:text-ink" @click="confirmDelete = null">ยกเลิก</button>
              <button type="button" class="shrink-0 font-semibold text-red transition hover:opacity-70" @click="removeCategory(c.id); confirmDelete = null">ลบ</button>
            </div>
            <template v-else>
              <div class="flex min-h-11 items-center gap-3 px-4">
                <button
                  type="button"
                  class="size-5 shrink-0 rounded-full ring-2 ring-offset-2 ring-offset-card transition hover:scale-110 active:scale-90"
                  :class="openColor === c.id ? 'ring-sub/40' : 'ring-transparent'"
                  :style="{ background: CATEGORY_COLORS[c.color] }"
                  :aria-label="`เปลี่ยนสีหมวด ${c.name}`"
                  :aria-expanded="openColor === c.id"
                  @click="openColor = openColor === c.id ? null : c.id"
                />
                <input
                  :id="`cm-name-${c.id}`"
                  :value="c.name"
                  :class="input"
                  maxlength="40"
                  :aria-label="`ชื่อหมวด ${c.name}`"
                  autocomplete="off"
                  @change="rename(c.id, $event)"
                  @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
                >
                <span class="shrink-0 text-[13px] text-sub tabular-nums">{{ counts[c.id] ?? 0 }} ชิ้น</span>
                <button
                  type="button"
                  class="grid size-8 shrink-0 place-items-center rounded-full text-sub transition hover:bg-red/10 hover:text-red active:scale-90"
                  :aria-label="`ลบหมวด ${c.name}`"
                  @click="confirmDelete = c.id"
                >
                  <svg viewBox="0 0 20 20" class="size-4 fill-none stroke-current stroke-[1.6]" aria-hidden="true"><path d="M4 6h12M8 6V4.5h4V6M5.5 6l.8 10h7.4l.8-10" stroke-linecap="round" stroke-linejoin="round" /></svg>
                </button>
              </div>
              <div v-if="openColor === c.id" class="px-4 pb-3">
                <ColorDots :model-value="c.color" @update:model-value="updateCategory(c.id, { color: $event })" />
              </div>
            </template>
          </div>
        </div>
      </div>
      <p v-else class="px-4 text-[13px] text-sub">
        ใช้หมวดแยกของเป็นกลุ่ม เช่น จัดสเปคคอม แล้วดูราคารวมของทั้งชุดได้
      </p>
    </div>
  </div>
</template>
