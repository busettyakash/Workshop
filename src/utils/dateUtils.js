/**
 * Central date/time formatting utilities — all output in IST (Asia/Kolkata).
 * Import these helpers across all pages instead of calling new Date().toLocale* directly.
 */

const TZ = "Asia/Kolkata"

/**
 * Safely parse a date from DB/API. If the string is in UTC format without 'Z',
 * appends 'Z' so JavaScript Date doesn't treat it as local system time.
 */
export const parseUtcDate = (raw) => {
  if (!raw) return null
  if (raw instanceof Date) return raw
  let s = String(raw).trim()
  if (!s.endsWith("Z") && !/[+-]\d{2}(:?\d{2})?$/.test(s) && /^\d{4}-\d{2}-\d{2}/.test(s)) {
    s = s.replace(" ", "T") + "Z"
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? new Date(raw) : d
}

/** "29 Aug 2026" */
export const fmtDateIST = (raw) => {
  if (!raw) return "—"
  try {
    const d = parseUtcDate(raw)
    if (!d || isNaN(d.getTime())) return String(raw)
    return d.toLocaleDateString("en-IN", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" })
  } catch { return "—" }
}

/** "10:27:07 am" */
export const fmtTimeIST = (raw) => {
  if (!raw) return "—"
  try {
    const d = parseUtcDate(raw)
    if (!d || isNaN(d.getTime())) return "—"
    return d.toLocaleTimeString("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })
  } catch { return "—" }
}

/** "29 Aug 2026, 10:27:07 am" */
export const fmtDateTimeIST = (raw) => {
  if (!raw) return "—"
  try {
    const d = parseUtcDate(raw)
    if (!d || isNaN(d.getTime())) return String(raw)
    return d.toLocaleString("en-IN", {
      timeZone: TZ,
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: true
    })
  } catch { return "—" }
}

/** "Aug 29" short format */
export const fmtDateShortIST = (raw) => {
  if (!raw) return "—"
  try {
    const d = parseUtcDate(raw)
    if (!d || isNaN(d.getTime())) return "—"
    return d.toLocaleDateString("en-IN", { timeZone: TZ, month: "short", day: "numeric" })
  } catch { return "—" }
}

/** "Aug 29, 10:27 am" short date+time */
export const fmtDateTimeShortIST = (raw) => {
  if (!raw) return "—"
  try {
    const d = parseUtcDate(raw)
    if (!d || isNaN(d.getTime())) return "—"
    return d.toLocaleString("en-IN", { timeZone: TZ, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
  } catch { return "—" }
}