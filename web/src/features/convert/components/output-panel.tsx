import { LuPlay } from "react-icons/lu"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Panel } from "@/components/layout/page-layout"
import { plural } from "@/lib/format"

/** Output settings (dataset name · format · feature preview) and the convert button */
export function OutputPanel({
  repoId,
  onRepoIdChange,
  fps,
  actionHz,
  preview,
  count,
}: {
  repoId: string
  onRepoIdChange: (v: string) => void
  fps: number
  actionHz: number
  preview: string
  count: number
}) {
  return (
    <Panel title="Output" className="flex-1">
      <div className="grid gap-1.5">
        <Label htmlFor="repo" className="text-xs font-normal text-muted-foreground">
          Dataset name
        </Label>
        <Input
          id="repo"
          className="h-9 text-[13px]"
          value={repoId}
          placeholder="local/my_dataset"
          onChange={(e) => onRepoIdChange(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="format" className="text-xs font-normal text-muted-foreground">
          Format
        </Label>
        {/* Only LeRobot for now. Without conversion the source MCAP is uploaded as is */}
        <Select value="LeRobot v3.0">
          <SelectTrigger id="format" className="h-9 w-full text-[13px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="LeRobot v3.0" className="text-[13px]">
              LeRobot v3.0
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground tabular-nums">
          {fps} fps. Action {actionHz} Hz is downsampled to {fps} Hz to match the cameras.
        </p>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <span className="text-xs text-muted-foreground">Features</span>
        <pre className="flex-1 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed break-all whitespace-pre-wrap">
          {preview}
        </pre>
      </div>
      <Button size="lg" className="w-full" disabled={count === 0 || !repoId.trim()}>
        <LuPlay />
        Convert {plural(count, "episode")}
      </Button>
    </Panel>
  )
}
