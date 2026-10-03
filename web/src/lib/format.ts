// Display formatting helpers. Number → string only, no domain knowledge.

export const pad = (n: number, width = 2) => String(n).padStart(width, "0")

/** Seconds → mm:ss (mm:ss.t with tenths) */
export function formatClock(sec: number, { tenths = false } = {}) {
  const s = Math.floor(sec)
  const base = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
  return tenths ? `${base}.${Math.floor((sec % 1) * 10)}` : base
}

/** Camera timecode mm:ss:ff */
export function formatTimecode(ms: number, fps: number) {
  const frames = Math.floor((ms / 1000) * fps)
  const sec = Math.floor(frames / fps)
  return `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}:${pad(frames % fps)}`
}

/** "2h 08m" / "58m" → seconds */
export function parseDuration(s?: string) {
  if (!s) return 0
  const h = Number(s.match(/(\d+)h/)?.[1] ?? 0)
  const m = Number(s.match(/(\d+)m/)?.[1] ?? 0)
  return (h * 60 + m) * 60
}

/** Seconds → "2h 08m" / "58m" (elapsed / remaining time) */
export function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h ? `${h}h ${pad(m)}m` : `${m}m`
}

/** Seconds → "55 s" / "4.1 min" / "3.6 h" (recording length) */
export function formatLength(sec: number) {
  if (sec < 60) return `${sec.toFixed(0)} s`
  if (sec < 3600) return `${(sec / 60).toFixed(1)} min`
  return `${(sec / 3600).toFixed(1)} h`
}

/** MB → "525.4 MB" / "1.4 GB" */
export const formatSize = (mb: number) => (mb < 1024 ? `${mb.toFixed(1)} MB` : `${(mb / 1024).toFixed(1)} GB`)

/** 0–1 → "67%", "—" when missing */
export const formatPct = (ratio?: number) => (ratio === undefined ? "—" : `${Math.round(ratio * 100)}%`)

export const formatUsd = (usd: number) => `$${usd.toFixed(2)}`

/** Hourly price "$1.89/h" */
export const formatRate = (usdPerHr: number) => `${formatUsd(usdPerHr)}/h`

/** "1 episode" / "1,212 episodes" */
export const plural = (n: number, word: string, many = `${word}s`) => `${n.toLocaleString()} ${n === 1 ? word : many}`

/** ISO timestamp → "2026-10-02 14:05" in the browser's time zone */
export function formatDateTime(iso?: string | null) {
  if (!iso) return "—"
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** ISO timestamp → "2026-10-02" */
export const formatDate = (iso?: string | null) => formatDateTime(iso).slice(0, 10)
