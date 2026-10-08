import { useState } from "react"

import { Segmented } from "@/components/common/segmented"
import { useSimRobots, useSimTools } from "@/api/simulation"
import type { SimTeleop } from "@/domain/simulation"

import type { JogMode } from "../lib"
import { JointJog } from "./joint-jog"
import { TcpJog } from "./tcp-jog"

const MODES = [
  { value: "tcp", label: "TCP" },
  { value: "joint", label: "Joint" },
] as const

export function KeyboardJog({ session }: { session: SimTeleop }) {
  const robots = useSimRobots()
  const tools = useSimTools()
  const assets = session.kind === "tool" ? tools.data : robots.data
  const link = assets?.find((a) => a.id === session.robotId)?.tcp ?? null
  const [picked, setPicked] = useState<JogMode>()
  const mode: JogMode = link === null ? "joint" : (picked ?? "tcp")

  return (
    <div className="grid gap-2">
      {link !== null && (
        <Segmented value={mode} onChange={setPicked} options={MODES} label="Jog mode" role="radiogroup" className="w-fit" />
      )}
      {mode === "tcp" && link !== null ? <TcpJog session={session} link={link} /> : <JointJog session={session} />}
    </div>
  )
}
