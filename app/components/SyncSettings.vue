<script setup lang="ts">
const emit = defineEmits<{ close: [] }>()
const { sync, syncNow, configure, disconnect } = useSync()

const url = ref(sync.url)
const secret = ref(sync.secret)
const showSecret = ref(false)
const confirmDisconnect = ref(false)
const urlEl = ref<HTMLInputElement>()
defineExpose({ focus: () => urlEl.value?.focus() })

const urlLooksWrong = computed(() => url.value.trim() !== '' && !/^https:\/\/script\.google\.com\/.+\/exec\b/.test(url.value.trim()))
const lastSync = computed(() => sync.lastSyncAt
  ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(sync.lastSyncAt)
  : 'ยังไม่เคย')
const dot = computed(() => ({ off: 'bg-sub/50', idle: 'bg-green', syncing: 'bg-accent animate-pulse', error: 'bg-red' })[sync.status])

function save() {
  if (!url.value.trim() || !secret.value.trim() || urlLooksWrong.value) return
  configure(url.value, secret.value)
}
function doDisconnect() {
  disconnect()
  url.value = ''
  secret.value = ''
  confirmDisconnect.value = false
}

const row = 'flex min-h-11 items-center gap-3 px-4'
const input = 'min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-sub/60'
const group = 'overflow-hidden rounded-xl bg-card divide-y divide-line ring-1 ring-line'
</script>

<template>
  <form novalidate class="flex flex-col" @submit.prevent="save">
    <div class="sticky top-0 z-10 -mx-4 mb-4 grid grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-xl lg:-mx-6 lg:px-6">
      <span />
      <span class="text-[17px] font-semibold">Google Sheet</span>
      <button type="button" class="justify-self-end text-[17px] font-semibold text-accent transition-opacity hover:opacity-70 active:opacity-40" @click="emit('close')">เสร็จ</button>
    </div>

    <div class="flex flex-col gap-6">
      <!-- Status -->
      <div class="flex items-start gap-3 rounded-xl bg-card px-4 py-3 ring-1 ring-line" aria-live="polite">
        <span class="mt-1.5 size-2.5 shrink-0 rounded-full" :class="dot" aria-hidden="true" />
        <div class="min-w-0 flex-1 text-[14px]">
          <p v-if="sync.status === 'off'" class="font-medium">ยังไม่ได้เชื่อมต่อ</p>
          <p v-else-if="sync.status === 'syncing'" class="font-medium">กำลัง sync…</p>
          <p v-else-if="sync.status === 'error'" class="font-medium text-red">sync ไม่สำเร็จ</p>
          <p v-else class="font-medium">เชื่อมต่อแล้ว</p>
          <p class="text-[13px] break-words text-sub">
            <template v-if="sync.status === 'off'">ข้อมูลอยู่ในเครื่องนี้อย่างเดียว เชื่อมต่อเพื่อใช้ข้อมูลเดียวกันทุกเครื่อง</template>
            <template v-else-if="sync.status === 'error'">{{ sync.error }}</template>
            <template v-else>sync ล่าสุด {{ lastSync }}</template>
          </p>
        </div>
        <button
          v-if="sync.status !== 'off'"
          type="button"
          class="shrink-0 rounded-full bg-fill px-3 py-1 text-[13px] font-medium text-accent transition hover:bg-accent/10 active:scale-95 disabled:opacity-50"
          :disabled="sync.status === 'syncing'"
          @click="syncNow()"
        >
          sync ตอนนี้
        </button>
      </div>

      <div>
        <div :class="group">
          <label :class="row">
            <span class="w-16 shrink-0 text-[15px]">ลิงก์</span>
            <input id="sy-url" ref="urlEl" v-model="url" :class="input" type="url" placeholder="https://script.google.com/macros/s/…/exec" autocomplete="off" spellcheck="false">
          </label>
          <label :class="row">
            <span class="w-16 shrink-0 text-[15px]">รหัสลับ</span>
            <input id="sy-secret" v-model="secret" :class="input" :type="showSecret ? 'text' : 'password'" placeholder="SECRET ใน Apps Script" autocomplete="off" spellcheck="false">
            <button type="button" class="shrink-0 text-[13px] font-medium text-accent transition-opacity hover:opacity-70" @click="showSecret = !showSecret">
              {{ showSecret ? 'ซ่อน' : 'แสดง' }}
            </button>
          </label>
        </div>
        <p v-if="urlLooksWrong" class="px-4 pt-1.5 text-[13px] text-red">ลิงก์ต้องเป็นลิงก์เว็บแอปของ Apps Script ที่ลงท้ายด้วย /exec</p>
        <p v-else class="px-4 pt-1.5 text-[13px] text-sub">ลิงก์และรหัสลับเก็บในเครื่องนี้เท่านั้น</p>
      </div>

      <button
        type="submit"
        class="rounded-xl bg-accent py-3 text-[16px] font-medium text-white transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
        :disabled="!url.trim() || !secret.trim() || urlLooksWrong || sync.status === 'syncing'"
      >
        บันทึกและ sync
      </button>

      <template v-if="sync.status !== 'off'">
        <div v-if="confirmDisconnect" class="flex items-center gap-3 rounded-xl bg-red/8 px-4 py-3 text-[14px]">
          <span class="min-w-0 flex-1">เลิกเชื่อมต่อ? ข้อมูลในเครื่องและในชีตยังอยู่ครบ</span>
          <button type="button" class="shrink-0 font-medium text-sub transition hover:text-ink" @click="confirmDisconnect = false">ยกเลิก</button>
          <button type="button" class="shrink-0 font-semibold text-red transition hover:opacity-70" @click="doDisconnect">เลิกเชื่อมต่อ</button>
        </div>
        <button v-else type="button" class="py-1 text-[15px] text-red transition-opacity hover:opacity-70" @click="confirmDisconnect = true">
          เลิกเชื่อมต่อ
        </button>
      </template>
    </div>
  </form>
</template>
