import { EmptyState } from "@/components/common/empty-state"
import { StatusDot } from "@/components/common/status-dot"

import type { Trial } from "../lib"

/** Trials from this session, newest first */
export function TrialsList({ trials }: { trials: Trial[] }) {
  const wins = trials.filter((t) => t.result === "success").length

  return (
    <section className="grid gap-2">
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-semibold">Trials</h3>
        {trials.length > 0 && (
          <span className="text-[13px] tabular-nums">
            {wins} / {trials.length} success
            <span className="text-muted-foreground"> ({Math.round((wins / trials.length) * 100)}%)</span>
          </span>
        )}
      </div>
      {trials.length === 0 ? (
        <EmptyState className="py-5 text-xs">정책을 돌린 뒤 결과를 표시하면 여기에 쌓입니다.</EmptyState>
      ) : (
        <ul className="divide-y rounded-md border">
          {[...trials].reverse().map((t) => (
            <li key={t.n} className="grid grid-cols-[2rem_minmax(0,1fr)_auto_auto] items-center gap-2 px-3 py-1.5 text-[13px]">
              <span className="text-muted-foreground tabular-nums">#{t.n}</span>
              <span className="truncate text-muted-foreground" title={t.instruction}>
                {t.instruction}
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{t.seconds.toFixed(1)} s</span>
              <StatusDot tone={t.result === "success" ? "ok" : "bad"} className="w-16 justify-end text-xs">
                {t.result === "success" ? "Success" : "Fail"}
              </StatusDot>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
