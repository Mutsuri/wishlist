<script setup lang="ts">
// Shown instead of the list until this device is linked to the Google Sheet.
const { sync, connect } = useSync()

const secret = ref('')
const showSecret = ref(false)
const error = ref('')
const busy = ref(false)
const customUrl = ref(false)
const url = ref(SHEET_URL)

async function submit() {
  if (!secret.value.trim() || busy.value) return
  busy.value = true
  error.value = await connect(secret.value, url.value)
  busy.value = false
}

const row = 'flex min-h-11 items-center gap-3 px-4'
const input = 'min-w-0 flex-1 bg-transparent py-2.5 text-[15px] outline-none placeholder:text-sub/60'
</script>

<template>
  <section class="mx-auto flex max-w-md flex-col items-center pt-6 text-center lg:pt-14">
    <div class="grid size-16 place-items-center rounded-[18px] bg-accent/10 text-accent">
      <svg viewBox="0 0 24 24" class="size-8 fill-none stroke-current stroke-[1.6]" aria-hidden="true">
        <rect x="4" y="3" width="16" height="18" rx="2.5" />
        <path d="M4 9h16M4 15h16M10 3v18" />
      </svg>
    </div>
    <h1 class="mt-5 text-[28px] leading-tight font-semibold tracking-[-0.03em] text-balance">เชื่อมต่อ Google Sheet</h1>
    <p class="mt-2 text-[15px] text-balance text-sub">
      Wishbook เก็บข้อมูลไว้ใน Google Sheet เท่านั้น ใส่รหัสลับเพื่อเริ่มใช้งานในเครื่องนี้
    </p>

    <form novalidate class="mt-8 flex w-full flex-col gap-3 text-left" @submit.prevent="submit">
      <div class="overflow-hidden rounded-xl bg-card ring-1 ring-line divide-y divide-line">
        <label v-if="customUrl" :class="row">
          <span class="w-16 shrink-0 text-[15px]">ลิงก์</span>
          <input id="cn-url" v-model="url" :class="input" type="url" autocomplete="off" spellcheck="false">
        </label>
        <label :class="row">
          <span class="w-16 shrink-0 text-[15px]">รหัสลับ</span>
          <input
            id="cn-secret"
            v-model="secret"
            :class="input"
            :type="showSecret ? 'text' : 'password'"
            placeholder="SECRET ใน Apps Script"
            autocomplete="off"
            spellcheck="false"
            autofocus
          >
          <button type="button" class="shrink-0 text-[13px] font-medium text-accent transition-opacity hover:opacity-70" @click="showSecret = !showSecret">
            {{ showSecret ? 'ซ่อน' : 'แสดง' }}
          </button>
        </label>
      </div>

      <p v-if="error" class="px-1 text-[13px] text-red" role="alert">เชื่อมต่อไม่ได้: {{ error }}</p>

      <button
        type="submit"
        class="mt-1 rounded-xl bg-accent py-3 text-[16px] font-medium text-white transition hover:brightness-110 active:scale-[0.99] disabled:opacity-40"
        :disabled="!secret.trim() || busy"
      >
        {{ busy || sync.status === 'syncing' ? 'กำลังเชื่อมต่อ…' : 'เชื่อมต่อ' }}
      </button>

      <p class="px-1 text-[13px] text-sub">
        รหัสลับดูได้ใน Apps Script ของชีต → ⚙ การตั้งค่าโปรเจกต์ → พร็อพเพอร์ตี้ของสคริปต์ → SECRET
        <button v-if="!customUrl" type="button" class="ml-1 text-accent transition-opacity hover:opacity-70" @click="customUrl = true">ใช้ชีตอื่น</button>
      </p>
    </form>
  </section>
</template>
