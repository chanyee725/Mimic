// 일별 에피소드 취득 수 (GitHub 잔디 형태 표시용 더미)

export type DayCount = { date: string; count: number }

export const ACTIVITY_END = "2026-10-02"
export const ACTIVITY_WEEKS = 52
const TOTAL_EPISODES = 1212

function pseudoRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function build(): DayCount[] {
  const end = new Date(`${ACTIVITY_END}T00:00:00`)
  // 마지막 주가 토요일까지 차도록 시작일을 일요일에 맞춘다
  const days = ACTIVITY_WEEKS * 7 - (6 - end.getDay())
  const start = new Date(end)
  start.setDate(end.getDate() - days + 1)

  const weights: number[] = []
  const dates: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dow = d.getDay()
    const ramp = Math.max(0, (i - days * 0.35) / (days * 0.65)) // 취득은 약 4개월 전부터 증가
    const weekend = dow === 0 || dow === 6
    const r = pseudoRandom(i + 7)
    const w = ramp === 0 || (weekend && r < 0.8) || r < 0.12 ? 0 : ramp * (0.4 + r)
    weights.push(w)
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
  }
  const sum = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((w) => (w / sum) * TOTAL_EPISODES)
  const counts = exact.map(Math.floor)
  // 최대 잔여법: 소수부가 큰 날부터 1씩 더해 총합을 맞춘다
  const left = TOTAL_EPISODES - counts.reduce((a, b) => a + b, 0)
  exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
    .slice(0, left)
    .forEach(({ i }) => (counts[i] += 1))
  return dates.map((date, i) => ({ date, count: counts[i] }))
}

export const EPISODE_ACTIVITY: DayCount[] = build()
