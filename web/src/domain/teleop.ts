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
