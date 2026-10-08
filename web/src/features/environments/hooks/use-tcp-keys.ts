import { useEffect, useRef, useState } from "react"

import { sendSimJog } from "@/api/simulation"
import { isTypingTarget } from "@/hooks/use-hotkeys"

import { JOG_RESEND_MS, TCP_KEYS, TCP_LIN_M_S, TCP_ROT_DEG_S } from "../lib"

/** Held keys and whether Shift turns them into rotations */
export type TcpHeld = { keys: string[]; rotate: boolean }

const NONE: TcpHeld = { keys: [], rotate: false }

export function tcpTwist({ keys, rotate }: TcpHeld) {
  const twist = [0, 0, 0, 0, 0, 0]
  for (const k of keys) {
    const { axis, dir } = TCP_KEYS[k]
    if (rotate) twist[3 + axis] += dir * TCP_ROT_DEG_S
    else twist[axis] += dir * TCP_LIN_M_S
  }
  return twist
}

/** Like useJogKeys: the twist is resent while keys are held and zeroed on release or blur */
export function useTcpKeys(enabled: boolean) {
  const [held, setHeld] = useState<TcpHeld>(NONE)
  const heldRef = useRef<TcpHeld>(NONE)
  const enabledRef = useRef(enabled)
  const stopRef = useRef(() => {})
  useEffect(() => {
    enabledRef.current = enabled
    if (!enabled) stopRef.current()
  }, [enabled])

  useEffect(() => {
    const update = (next: TcpHeld) => {
      const prev = heldRef.current
      if (prev.rotate === next.rotate && prev.keys.join() === next.keys.join()) return
      heldRef.current = next
      setHeld(next)
      if (next.keys.length || prev.keys.length) void sendSimJog({ twist: tcpTwist(next) })
    }
    const stop = () => update(NONE)
    stopRef.current = stop
    const down = (e: KeyboardEvent) => {
      if (!enabledRef.current || isTypingTarget(e.target)) return
      const key = e.key.toLowerCase()
      const { keys } = heldRef.current
      if (key === "shift") return update({ keys, rotate: true })
      if (!Object.hasOwn(TCP_KEYS, key)) return
      e.preventDefault()
      update({ keys: keys.includes(key) ? keys : [...keys, key], rotate: e.shiftKey })
    }
    const up = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      const { keys } = heldRef.current
      if (key === "shift") update({ keys, rotate: false })
      else if (Object.hasOwn(TCP_KEYS, key)) update({ keys: keys.filter((k) => k !== key), rotate: e.shiftKey })
    }
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", stop)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", stop)
      stop()
    }
  }, [])

  useEffect(() => {
    if (!held.keys.length) return
    const t = window.setInterval(() => void sendSimJog({ twist: tcpTwist(held) }), JOG_RESEND_MS)
    return () => window.clearInterval(t)
  }, [held])

  return held
}
