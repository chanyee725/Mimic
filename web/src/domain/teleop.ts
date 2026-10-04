/** Teleoperation test of a rig: each leader drives its follower (POST /rigs/{id}/teleop) */
export type TeleopJoint = { name: string; leader: number | null; follower: number | null }

export type TeleopPair = { robot: string; teleop: string; joints: TeleopJoint[] }

export type TeleopState = {
  rigId: string
  running: boolean
  hz: number | null // measured loop rate
  targetHz: number
  error: string | null
  startedAt: string
  pairs: TeleopPair[]
}

/** Live joint samples of a running teleop session (GET /rigs/{id}/teleop/samples?after=seq) */
export type TeleopSamples = {
  joints: string[]
  seq: number // last returned sample (or `after` when none are new)
  t: number[] // seconds since the teleop session started
  action: number[][] // leader, per sample
  state: number[][] // follower, per sample
}
