/** One run: idle -> policy running -> human judges the result */
export type RunPhase = "idle" | "running" | "judging"

export type TrialResult = "success" | "fail"

export type Trial = { n: number; instruction: string; seconds: number; result: TrialResult }
