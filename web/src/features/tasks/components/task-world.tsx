import { useState } from "react"

import { Label } from "@/components/ui/label"
import { ErrorNote, LoadingNote } from "@/components/common/query-state"
import { Segmented } from "@/components/common/segmented"
import { SettingsSection } from "@/components/common/settings-section"
import { useSimEnvs } from "@/api/simulation"
import { envFitsRig } from "@/domain/simulation"
import { TASK_WORLD_LABEL, taskWorld, type Task, type TaskWorld } from "@/domain/task"

import { SimpleSelect } from "./simple-select"

/** Real robot, or an Isaac Sim environment imported on the Environments page */
export function TaskWorldSection({ task, onChange }: { task: Task; onChange: (patch: Partial<Task>) => void }) {
  const envs = useSimEnvs()
  // Isaac Sim stays picked while no environment is chosen yet
  const [picked, setPicked] = useState<TaskWorld>()
  const world = task.envId ? "sim" : (picked ?? taskWorld(task))
  // Environments in the task rig's folder or at the top level
  const list = (envs.data ?? []).filter((e) => envFitsRig(e, task.rigId))

  function pick(w: TaskWorld) {
    setPicked(w)
    if (w === "real") onChange({ envId: null })
    else if (!task.envId && list[0]) onChange({ envId: list[0].id })
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
        {world === "sim" && list.length > 0 && (
          <div className="min-w-0 flex-1">
            <Label htmlFor="t-env" className="sr-only">
              Environment
            </Label>
            <SimpleSelect
              id="t-env"
              value={task.envId ?? ""}
              options={list.map((e) => ({ value: e.id, label: `${e.name} · ${e.scene}` }))}
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
        ) : (
          list.length === 0 && <p className="text-[13px] text-muted-foreground">이 Rig 에서 쓸 수 있는 환경이 없습니다.</p>
        ))}
    </SettingsSection>
  )
}
