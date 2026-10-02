import type { IconType } from "react-icons"
import { LuCircleCheck, LuFilm, LuHardDrive, LuListVideo, LuTimer } from "react-icons/lu"

import type { getDataTotals } from "@/api/station"
import type { TaskStatus } from "@/domain/task"

export const MAX_TASKS = 6
export const MAX_PODS = 2

export const TOTAL_ICONS: Record<ReturnType<typeof getDataTotals>[number]["key"], IconType> = {
  episodes: LuListVideo,
  frames: LuFilm,
  hours: LuTimer,
  storage: LuHardDrive,
  success: LuCircleCheck,
}

export const STATUS_ORDER: Record<TaskStatus, number> = { active: 0, completed: 1, draft: 2 }
