import type { Tone } from "@/components/common/status-dot"
import type { Randomization, SimJobStatus } from "@/domain/simulation"

export const SIM_STATUS: Record<SimJobStatus, { tone: Tone; label: string }> = {
  running: { tone: "info", label: "Running" },
  queued: { tone: "muted", label: "Queued" },
  done: { tone: "ok", label: "Done" },
  failed: { tone: "bad", label: "Failed" },
  stopped: { tone: "muted", label: "Stopped" },
}

export const RANDOMIZATION: { value: Randomization; label: string; hint: string }[] = [
  { value: "none", label: "None", hint: "장면을 그대로 둡니다" },
  { value: "low", label: "Low", hint: "조명 · 물체 위치를 조금 흔듭니다" },
  { value: "high", label: "High", hint: "조명 · 물체 위치 · 색 · 카메라 위치까지 크게 흔듭니다" },
]

/** Finished / total episodes as a 0–100 percentage */
export const simPct = (done: number, total: number) => (total ? Math.round((done / total) * 100) : 0)
