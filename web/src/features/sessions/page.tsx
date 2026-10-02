import { useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { LuCircleCheck, LuHistory, LuListVideo, LuTarget, LuTimer } from "react-icons/lu"

import { Page, Panel } from "@/components/app/page"
import { StatStrip } from "@/components/app/stat-strip"
import { buttonVariants } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { episodesOf, SESSIONS, type Episode, type Review } from "@/dummy/sessions"
import { getTask, TASKS } from "@/dummy/tasks"
import { EpisodesTable, ReplayPanel, SessionList } from "@/features/sessions/parts"

const DEFAULT_TASK = "stack-two-blocks"

export function SessionsPage() {
  const [params, setParams] = useSearchParams()
  const task = getTask(params.get("task") ?? DEFAULT_TASK) ?? TASKS[0]

  const sessions = useMemo(() => SESSIONS.filter((s) => s.taskId === task.id), [task.id])
  const [pickedSession, setPickedSession] = useState<string>()
  const session = sessions.find((s) => s.id === pickedSession) ?? sessions[0]

  const episodes = useMemo(() => (session ? episodesOf(session.id) : []), [session])
  const [pickedEpisode, setPickedEpisode] = useState(3)
  const episode = episodes.find((e) => e.index === pickedEpisode) ?? episodes[0]

  // 리뷰 결과는 백엔드 연결 전까지 로컬 상태로만 유지
  const [reviews, setReviews] = useState<Record<string, Review>>({})
  const reviewOf = (e: Episode) => (session && reviews[`${session.id}:${e.index}`]) ?? e.review

  const stats = useMemo(() => {
    const collected = sessions.reduce((n, s) => n + s.episodes, 0)
    const accepted = sessions.reduce((n, s) => n + s.accepted, 0)
    const success = collected
      ? Math.round(sessions.reduce((n, s) => n + s.successPct * s.episodes, 0) / collected)
      : 0
    const lengths = sessions.flatMap((s) => episodesOf(s.id).map((e) => e.lengthS))
    const avg = lengths.length ? lengths.reduce((a, b) => a + b, 0) / lengths.length : 0
    return { collected, accepted, success, avg }
  }, [sessions])

  const selectTask = (id: string) => {
    setParams({ task: id })
    setPickedSession(undefined)
  }

  return (
    <Page
      fit
      title="Sessions"
      description={
        <>
          <Link to={`/tasks/${task.id}`} className="font-mono text-foreground hover:underline">
            {task.id}
          </Link>{" "}
          · {task.instruction}
        </>
      }
      actions={
        <>
          <Select value={task.id} onValueChange={(v) => v && selectTask(v)}>
            <SelectTrigger aria-label="Task" className="h-9 min-w-48 font-mono text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASKS.map((t) => (
                <SelectItem key={t.id} value={t.id} className="font-mono text-[13px]">
                  {t.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Link to="/convert" className={buttonVariants({ size: "lg" })}>
            Convert {stats.accepted} accepted
          </Link>
        </>
      }
    >
      <StatStrip
        items={[
          { label: "Collected", value: `${stats.collected} / ${task.targetEpisodes}`, icon: LuListVideo },
          { label: "Accepted", value: String(stats.accepted), icon: LuCircleCheck },
          { label: "Success rate", value: `${stats.success}%`, icon: LuTarget },
          { label: "Avg length", value: `${stats.avg.toFixed(1)}s`, icon: LuTimer },
          { label: "Sessions", value: String(sessions.length), icon: LuHistory },
        ]}
      />

      {session && episode ? (
        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
          <SessionList
            sessions={sessions}
            selectedId={session.id}
            onSelect={(id) => {
              setPickedSession(id)
              setPickedEpisode(0)
            }}
          />
          <div className="flex min-h-0 min-w-0 flex-col gap-4">
            <ReplayPanel
              episode={episode}
              review={reviewOf(episode)}
              onReview={(r) => setReviews((prev) => ({ ...prev, [`${session.id}:${episode.index}`]: r }))}
            />
            <EpisodesTable
              episodes={episodes}
              reviewOf={reviewOf}
              selectedIndex={episode.index}
              onSelect={setPickedEpisode}
              subtaskCount={Math.max(task.subtasks.length, 1)}
            />
          </div>
        </div>
      ) : (
        <Panel className="flex-1 items-center justify-center border-dashed py-16 text-center">
          <p className="text-sm text-muted-foreground">이 Task로 녹화된 세션이 없습니다.</p>
          <Link to="/capture" className={buttonVariants({ variant: "outline" })}>
            Start capture
          </Link>
        </Panel>
      )}
    </Page>
  )
}
