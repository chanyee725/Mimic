// Mock daily episode counts for the GitHub-style contribution heatmap

import type { DayCount } from "@/domain/activity"

export const ACTIVITY_END = "2026-10-02"
export const ACTIVITY_WEEKS = 52
const TOTAL_EPISODES = 1212

function pseudoRandom(seed: number) {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

function build(): DayCount[] {
  const end = new Date(`${ACTIVITY_END}T00:00:00`)
  // Start on a Sunday so the last week runs through Saturday
  const days = ACTIVITY_WEEKS * 7 - (6 - end.getDay())
  const start = new Date(end)
  start.setDate(end.getDate() - days + 1)

  const weights: number[] = []
  const dates: string[] = []
  for (let i = 0; i < days; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const dow = d.getDay()
    const ramp = Math.max(0, (i - days * 0.35) / (days * 0.65)) // collection ramps up from about four months ago
    const weekend = dow === 0 || dow === 6
    const r = pseudoRandom(i + 7)
    const w = ramp === 0 || (weekend && r < 0.8) || r < 0.12 ? 0 : ramp * (0.4 + r)
    weights.push(w)
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`)
  }
  const sum = weights.reduce((a, b) => a + b, 0)
  const exact = weights.map((w) => (w / sum) * TOTAL_EPISODES)
  const counts = exact.map(Math.floor)
  // Largest remainder: add 1 to the days with the biggest fractions until the total matches
  const left = TOTAL_EPISODES - counts.reduce((a, b) => a + b, 0)
  exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
    .slice(0, left)
    .forEach(({ i }) => (counts[i] += 1))
  return dates.map((date, i) => ({ date, count: counts[i] }))
}

export const EPISODE_ACTIVITY: DayCount[] = build()
