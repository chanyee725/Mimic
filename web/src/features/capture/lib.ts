import type { CapturePhase } from "@/domain/capture"

/** Badge per phase of the station's episode state machine */
export const PHASE: Record<CapturePhase, { label: string; className: string }> = {
  idle: { label: "READY", className: "bg-muted text-muted-foreground" },
  countdown: { label: "GET READY", className: "bg-info-muted text-info" },
  recording: { label: "REC", className: "bg-bad-muted text-bad" },
  review: { label: "REVIEW", className: "bg-warn-muted text-warn" },
}

/** Operator used when the station settings list none (pseudonymous ID) */
export const FALLBACK_OPERATOR = "OP-01"
