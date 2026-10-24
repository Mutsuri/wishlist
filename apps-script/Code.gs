// หลังบ้านของ Wishbook: วางไฟล์นี้ใน ส่วนขยาย → Apps Script ของ Google Sheet
// รันฟังก์ชัน setupSecret ครั้งเดียว: สุ่มรหัสลับเก็บใน พร็อพเพอร์ตี้ของสคริปต์ ชื่อ SECRET แล้วดูรหัสได้ใน บันทึกการดำเนินการ
// แล้ว Deploy → การทำให้ใช้งานได้รายการใหม่ → เว็บแอป (ดำเนินการในฐานะ: ฉัน, ผู้มีสิทธิ์เข้าถึง: ทุกคน)

// คอลัมน์ใหม่ต่อท้ายเสมอ ข้อมูลเก่าในชีตจะได้ไม่เลื่อนช่อง
const SHEETS = {
  wishes: ['id', 'name', 'price', 'currency', 'link', 'shops', 'note', 'cat', 'done', 'created', 'updatedAt', 'deleted', 'when'],
  categories: ['id', 'name', 'color', 'updatedAt', 'deleted'],
}
const MONEY = ['price']
const NUMBERS = ['created', 'updatedAt']
const BOOLEANS = ['done', 'deleted']
// ลิงก์ร้านอื่นหลายลิงก์ เก็บในช่องเดียว คั่นด้วยขึ้นบรรทัดใหม่
const LISTS = ['shops']

// สุ่มรหัสลับครั้งแรก (มีอยู่แล้วจะไม่เปลี่ยน) แล้วแสดงในบันทึกการดำเนินการ เอาไปใส่ในแอปหน้า Google Sheet
function setupSecret() {
  const props = PropertiesService.getScriptProperties()
  let secret = props.getProperty('SECRET')
  if (!secret) {
    secret = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '')
    props.setProperty('SECRET', secret)
  }
  Logger.log('SECRET = ' + secret)
}

function doGet() {
  return json({ ok: true, app: 'Wishbook' })
}

function doPost(e) {
  const lock = LockService.getScriptLock()
  lock.waitLock(20000)
  try {
    const req = JSON.parse(e.postData.contents)
    const secret = PropertiesService.getScriptProperties().getProperty('SECRET')
    if (!secret) return json({ ok: false, error: 'ยังไม่ได้ตั้ง SECRET ใน Script Properties' })
    if (req.secret !== secret) return json({ ok: false, error: 'รหัสลับไม่ตรง' })

    const ss = SpreadsheetApp.getActiveSpreadsheet()
    return json({
      ok: true,
      wishes: mergeSheet(ss, 'wishes', req.wishes || []),
      categories: mergeSheet(ss, 'categories', req.categories || []),
    })
  } catch (err) {
    return json({ ok: false, error: String(err) })
  } finally {
    lock.releaseLock()
  }
}

// รวมแถวที่ส่งมากับในชีต ใครแก้ทีหลัง (updatedAt มากกว่า) ชนะ แล้วคืนทั้งหมดกลับไป
function mergeSheet(ss, name, incoming) {
  const cols = SHEETS[name]
  const sheet = getSheet(ss, name, cols)
  const byId = new Map()

  const last = sheet.getLastRow()
  if (last > 1) {
    for (const values of sheet.getRange(2, 1, last - 1, cols.length).getValues()) {
      if (!values[0]) continue
      const r = {}
      cols.forEach((c, i) => (r[c] = fromCell(c, values[i])))
      byId.set(String(r.id), r)
    }
  }

  for (const r of incoming) {
    const mine = byId.get(r.id)
    if (mine && mine.updatedAt >= r.updatedAt) continue
    byId.set(
      r.id,
      r.deleted
        ? Object.assign({}, mine, { id: r.id, updatedAt: r.updatedAt, deleted: true })
        : Object.assign({}, r, { deleted: false }),
    )
  }

  const rows = Array.from(byId.values()).sort((a, b) => (a.created || a.updatedAt) - (b.created || b.updatedAt))

  if (last > 1) sheet.getRange(2, 1, last - 1, cols.length).clearContent()
  if (rows.length) {
    const range = sheet.getRange(2, 1, rows.length, cols.length)
    range.setNumberFormats(rows.map(() => cols.map(formatOf)))
    range.setValues(rows.map((r) => cols.map((c) => toCell(c, r[c]))))
  }
  return rows
}

function getSheet(ss, name, cols) {
  let sheet = ss.getSheetByName(name)
  if (!sheet) sheet = ss.insertSheet(name)
  // เขียนหัวตารางทุกครั้ง เผื่อมีคอลัมน์ใหม่
  sheet.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold')
  sheet.setFrozenRows(1)
  return sheet
}

function formatOf(col) {
  if (MONEY.includes(col)) return '#,##0.00'
  if (NUMBERS.includes(col)) return '0'
  return '@'
}

function toCell(col, v) {
  if (MONEY.includes(col)) return Number(v) || 0
  if (BOOLEANS.includes(col)) return v ? 'TRUE' : ''
  if (LISTS.includes(col)) return Array.isArray(v) ? v.join('\n') : ''
  return v === undefined || v === null ? '' : v
}

function fromCell(col, v) {
  if (MONEY.includes(col)) return Number(v) || 0
  if (NUMBERS.includes(col)) return Number(v) || 0
  if (BOOLEANS.includes(col)) return v === true || v === 'TRUE'
  if (LISTS.includes(col)) return String(v || '').split('\n').filter(Boolean)
  return String(v)
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON)
}
