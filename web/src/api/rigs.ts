import { RIGS, getRig as findRig } from "@/dummy/rigs"
import type { Rig } from "@/domain/rig"

export const listRigs = (): Rig[] => RIGS
/** Falls back to the first rig when the id is unknown */
export const getRig = (id: string): Rig => findRig(id)
