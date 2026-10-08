import { useEffect, useRef, useState } from "react"

import { sendSimJog } from "@/api/simulation"
import { isTypingTarget } from "@/hooks/use-hotkeys"

import { JOG_DEG_S, JOG_RESEND_MS, JOG_SLOW_DEG_S } from "../lib"

type Held = { joint: string; dir: number; slow: boolean }

/** Speeds are resent while a key is held (the backend drops them when they stop coming) and cleared on release or blur */
export function useJogKeys(joints: string[], enabled: boolean) {
  const [selected, setSelected] = useState(0)
  const [held, setHeld] = useState<Held | null>(null)
  const heldRef = useRef<Held | null>(null)
  const index = Math.min(selected, Math.max(joints.length - 1, 0))

  const press = (joint: string, dir: number, slow = false) => {
    const h = { joint, dir, slow }
    heldRef.current = h
    setHeld(h)
    void sendSimJog({ velocities: { [joint]: dir * (slow ? JOG_SLOW_DEG_S : JOG_DEG_S) } })
  }
  const release = () => {
    if (!heldRef.current) return
    heldRef.current = null
    setHeld(null)
    void sendSimJog({ velocities: {} })
  }

  const live = useRef({ joints, index, enabled, press, release })
  useEffect(() => {
    live.current = { joints, index, enabled, press, release }
  })

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const { joints, index, enabled, press } = live.current
      if (!enabled || !joints.length || isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      if (key === "arrowup" || key === "w") setSelected((i) => Math.max(0, Math.min(i, joints.length - 1) - 1))
      else if (key === "arrowdown" || key === "s") setSelected((i) => Math.min(joints.length - 1, i + 1))
      else if (key === "arrowleft" || key === "a" || key === "arrowright" || key === "d") {
        if (!e.repeat) press(joints[index], key === "arrowleft" || key === "a" ? -1 : 1, e.shiftKey)
      } else return
      e.preventDefault()
    }
    const up = (e: KeyboardEvent) => {
      if (["arrowleft", "arrowright", "a", "d"].includes(e.key.toLowerCase())) live.current.release()
    }
    const blur = () => live.current.release()
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
      live.current.release()
    }
  }, [])

  useEffect(() => {
    if (!held) return
    const t = window.setInterval(
      () => void sendSimJog({ velocities: { [held.joint]: held.dir * (held.slow ? JOG_SLOW_DEG_S : JOG_DEG_S) } }),
      JOG_RESEND_MS,
    )
    return () => window.clearInterval(t)
  }, [held])

  return { selected: joints[index], select: (name: string) => setSelected(Math.max(0, joints.indexOf(name))), held, press, release }
}
