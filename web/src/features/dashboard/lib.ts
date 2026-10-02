import type { IconType } from "react-icons"
import { LuCircleCheck, LuFilm, LuHardDrive, LuListVideo, LuTimer } from "react-icons/lu"

import type { DATA_TOTALS } from "@/dummy/station"
import type { TaskStatus } from "@/dummy/tasks"

export const MAX_TASKS = 6
export const MAX_PODS = 2

export const TOTAL_ICONS: Record<(typeof DATA_TOTALS)[number]["key"], IconType> = {
  episodes: LuListVideo,
  frames: LuFilm,
  hours: LuTimer,
  storage: LuHardDrive,
  success: LuCircleCheck,
}

export const STATUS_ORDER: Record<TaskStatus, number> = { active: 0, completed: 1, draft: 2 }
