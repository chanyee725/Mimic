import { LuMerge } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Panel } from "@/components/layout/page-layout"
import { ErrorNote } from "@/components/common/query-state"
import { ApiError } from "@/api/client"
import { plural } from "@/lib/format"

/** Output name and the Merge button; a 422 lists the server's problems under the error */
export function MergeOutput({
  repoId,
  onRepoIdChange,
  count,
  canMerge,
  merging,
  error,
  onMerge,
}: {
  repoId: string
  onRepoIdChange: (v: string) => void
  count: number
  /** At least two sources, a fresh preview and no problems */
  canMerge: boolean
  merging: boolean
  error: Error | null
  onMerge: () => void
}) {
  const problems = error instanceof ApiError ? ((error.details.problems as string[] | undefined) ?? []) : []
  return (
    <Panel title="Output">
      <div className="grid gap-1.5">
        <Label htmlFor="merge-repo" className="text-xs font-normal text-muted-foreground">
          Dataset name
        </Label>
        <Input
          id="merge-repo"
          className="h-9 text-[13px]"
          value={repoId}
          placeholder="local/my_dataset_merged"
          onChange={(e) => onRepoIdChange(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">원본 데이터셋은 그대로 두고 새 LeRobot v3.0 데이터셋을 만듭니다.</p>
      </div>
      <ErrorNote error={error} />
      {problems.map((p) => (
        <p key={p} className="text-xs text-bad">
          {p}
        </p>
      ))}
      <Button size="lg" className="w-full" disabled={!canMerge || merging || !repoId.trim()} onClick={onMerge}>
        <LuMerge />
        {merging ? "Starting merge…" : `Merge ${plural(count, "dataset")}`}
      </Button>
    </Panel>
  )
}
