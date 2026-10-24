<script setup lang="ts" generic="T extends string">
// macOS-style pop-up button: translucent menu, checkmark on the current choice.
const props = defineProps<{
  /** short: what the button shows when picked (defaults to label); hint: dim text at the row's end */
  options: { value: T, label: string, short?: string, hint?: string }[]
  label: string
  /** Hide the label inside the button (it's still announced to screen readers) */
  hideLabel?: boolean
  /** Open the menu toward the left from the button's right edge at every width */
  alignRight?: boolean
}>()
const model = defineModel<T>({ required: true })

const open = ref(false)
const active = ref(0)
const root = ref<HTMLElement>()
const button = ref<HTMLButtonElement>()
const menu = ref<HTMLElement>()
const items = ref<HTMLButtonElement[]>([])
const picked = computed(() => props.options.find(o => o.value === model.value))
const current = computed(() => picked.value?.short ?? picked.value?.label ?? '')

// The menu is teleported to <body> with fixed positioning, so rounded boxes with
// overflow-hidden (form groups, sheets) can't clip it. Place it from the button's rect.
const pos = ref<Record<string, string>>({})
const upward = ref(false)
const GAP = 8
const EDGE = 12
function place() {
  const r = button.value?.getBoundingClientRect()
  if (!r) return
  const below = innerHeight - r.bottom - GAP - EDGE
  const above = r.top - GAP - EDGE
  // Prefer opening downward; flip up when there's clearly more room above.
  upward.value = below < 240 && above > below
  const style: Record<string, string> = { maxHeight: `${Math.max(120, upward.value ? above : below)}px` }
  if (upward.value) style.bottom = `${innerHeight - r.top + GAP}px`
  else style.top = `${r.bottom + GAP}px`
  // Right-align on wide screens (or when asked); on phones grow from the button's left edge.
  if (props.alignRight || innerWidth >= 640) style.right = `${Math.max(EDGE, innerWidth - r.right)}px`
  else style.left = `${Math.max(EDGE, r.left)}px`
  pos.value = style
}

async function show() {
  place()
  open.value = true
  active.value = Math.max(0, props.options.findIndex(o => o.value === model.value))
  await nextTick()
  items.value[active.value]?.focus()
}
function hide(refocus = true) {
  open.value = false
  if (refocus) button.value?.focus()
}
function pick(v: T) {
  model.value = v
  hide()
}
function move(d: number) {
  const n = props.options.length
  active.value = (active.value + d + n) % n
  items.value[active.value]?.focus()
}

function onDocDown(e: PointerEvent) {
  const t = e.target as Node
  if (open.value && !root.value?.contains(t) && !menu.value?.contains(t)) hide(false)
}
// A fixed menu would drift from its button when the page or a sheet scrolls: close it instead.
function onScroll(e: Event) {
  if (open.value && !menu.value?.contains(e.target as Node)) hide(false)
}
function onResize() {
  if (open.value) hide(false)
}
onMounted(() => {
  document.addEventListener('pointerdown', onDocDown)
  document.addEventListener('scroll', onScroll, true)
  window.addEventListener('resize', onResize)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocDown)
  document.removeEventListener('scroll', onScroll, true)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <div ref="root" class="relative inline-block">
    <button
      ref="button"
      type="button"
      aria-haspopup="menu"
      :aria-expanded="open"
      :aria-label="`${label}: ${picked?.label ?? ''}`"
      class="inline-flex items-center gap-1.5 rounded-full bg-fill py-1.5 pr-3 text-[13px] font-medium text-ink ring-1 ring-transparent transition hover:bg-card hover:shadow-sm hover:ring-line active:scale-95"
      :class="hideLabel ? 'pl-3' : 'pl-4'"
      @click="open ? hide() : show()"
      @keydown.down.prevent="show"
      @keydown.up.prevent="show"
    >
      <span v-if="!hideLabel" class="text-sub">{{ label }}</span>
      <span>{{ current }}</span>
      <svg viewBox="0 0 12 12" class="size-2.5 fill-none stroke-sub stroke-[1.8] transition" :class="open && 'rotate-180'" aria-hidden="true">
        <path d="M3 4.5l3 3 3-3" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 scale-95"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="open"
        ref="menu"
        role="menu"
        :aria-label="label"
        :style="pos"
        class="fixed z-[60] w-max max-w-[calc(100vw-24px)] min-w-[200px] overflow-y-auto rounded-[12px] bg-card/80 p-1.5 font-sans shadow-[0_10px_40px_rgb(0_0_0/0.18),0_2px_8px_rgb(0_0_0/0.08)] ring-1 ring-line backdrop-blur-2xl backdrop-saturate-150"
        :class="upward ? (pos.right ? 'origin-bottom-right' : 'origin-bottom-left') : (pos.right ? 'origin-top-right' : 'origin-top-left')"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.esc.stop.prevent="hide()"
        @keydown.tab="hide(false)"
      >
        <button
          v-for="(o, i) in options"
          :key="o.value"
          ref="items"
          type="button"
          role="menuitemradio"
          :aria-checked="model === o.value"
          class="flex w-full items-center gap-2 rounded-[7px] px-2.5 py-1.5 text-left text-[14px] text-ink outline-none transition-colors duration-75 hover:bg-accent hover:text-white focus-visible:bg-accent focus-visible:text-white"
          @click="pick(o.value)"
          @mouseenter="active = i; items[i]?.focus()"
        >
          <svg viewBox="0 0 12 12" class="size-3 shrink-0 fill-none stroke-current stroke-2" :class="model === o.value ? 'opacity-100' : 'opacity-0'" aria-hidden="true">
            <path d="M2.5 6.5l2.3 2.3L9.5 3.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <span class="flex-1">{{ o.label }}</span>
          <span v-if="o.hint" class="pl-4 text-[12px] opacity-60 tabular-nums">{{ o.hint }}</span>
        </button>
      </div>
    </Transition>
    </Teleport>
  </div>
</template>
