import { useState } from "react"

import { Label } from "@/components/ui/label"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { Segmented } from "@/components/common/segmented"
import { SettingsSection } from "@/components/common/settings-section"
import { StatusDot } from "@/components/common/status-dot"
import { useSimEnvs } from "@/api/simulation"
import type { Rig } from "@/domain/rig"
import { envCompat, type SimEnv } from "@/domain/simulation"
import { TASK_WORLD_LABEL, taskWorld, type Task, type TaskWorld } from "@/domain/task"

import { SimpleSelect } from "./simple-select"

/** Real robot, or an Isaac Sim environment registered on the Environments page */
export function TaskWorldSection({ task, rig, onChange }: { task: Task; rig: Rig | undefined; onChange: (patch: Partial<Task>) => void }) {
  const envs = useSimEnvs()
  // Isaac Sim stays picked while no environment is chosen yet
  const [picked, setPicked] = useState<TaskWorld>()
  const world = task.envId ? "sim" : (picked ?? taskWorld(task))
  const ready = (envs.data ?? []).filter((e) => e.state === "ready" || e.id === task.envId)
  const errors = (env: SimEnv) =>
    rig ? envCompat(env, { cameras: task.cameras, actionDim: rig.joints.length }).filter((i) => i.level === "error") : []
  const env = ready.find((e) => e.id === task.envId)

  function pick(w: TaskWorld) {
    setPicked(w)
    if (w === "real") onChange({ envId: null })
    else if (!task.envId) {
      // The first environment that fits the rig and cameras, else the first one
      const first = ready.find((e) => errors(e).length === 0) ?? ready[0]
      if (first) onChange({ envId: first.id })
    }
  }

  return (
    <SettingsSection title="World">
      <div className="flex items-center gap-2">
        <Segmented
          label="World"
          role="radiogroup"
          size="md"
          value={world}
          onChange={pick}
          options={(["real", "sim"] as const).map((w) => ({ value: w, label: TASK_WORLD_LABEL[w] }))}
        />
        {world === "sim" && ready.length > 0 && (
          <div className="min-w-0 flex-1">
            <Label htmlFor="t-env" className="sr-only">
              Environment
            </Label>
            <SimpleSelect
              id="t-env"
              value={task.envId ?? ""}
              options={ready.map((e) => ({ value: e.id, label: `${e.name} · ${e.id}${errors(e).length ? " (incompatible)" : ""}` }))}
              onChange={(envId) => onChange({ envId })}
            />
          </div>
        )}
      </div>
      {world === "sim" &&
        (envs.isError ? (
          <ErrorNote error={envs.error} onRetry={() => void envs.refetch()} />
        ) : envs.isPending ? (
          <LoadingNote />
        ) : ready.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">등록된 환경이 없습니다. Environments 에서 먼저 등록하세요.</p>
        ) : (
          env &&
          errors(env).map((i) => (
            <StatusDot key={i.text} tone="bad" className="text-[13px]">
              {i.text}
            </StatusDot>
          ))
        ))}
    </SettingsSection>
  )
}
