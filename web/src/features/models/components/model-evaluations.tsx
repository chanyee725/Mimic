import { Link } from "react-router-dom"

import { EmptyState } from "@/components/app/empty-state"
import type { Model } from "@/dummy/models"
import { formatPct } from "@/lib/format"

/** 이 모델로 돌린 평가 기록. 없으면 Evaluate 로 가는 링크 */
export function ModelEvaluations({ model: m }: { model: Model }) {
  return (
    <section className="grid gap-2">
      <h3 className="text-sm font-semibold">Evaluations</h3>
      {m.evals.length === 0 ? (
        <EmptyState className="py-5">
          아직 평가하지 않았습니다.{" "}
          <Link to={`/evaluate?model=${m.id}`} className="text-foreground underline underline-offset-4">
            Evaluate 에서 돌려 보기
          </Link>
        </EmptyState>
      ) : (
        <ul className="divide-y rounded-md border">
          {m.evals.map((e) => (
            <li key={e.at} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-3 py-2 text-[13px]">
              <span className="truncate">{e.instruction}</span>
              <span className="text-right tabular-nums">
                {e.success} / {e.trials}
                <span className="text-muted-foreground"> ({formatPct(e.success / e.trials)})</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{e.at}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
