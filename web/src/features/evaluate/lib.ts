/** 한 번 돌리는 흐름: 대기 → 정책 실행 → 사람이 결과 판정 */
export type RunPhase = "idle" | "running" | "judging"

export type TrialResult = "success" | "fail"

export type Trial = { n: number; instruction: string; seconds: number; result: TrialResult }
