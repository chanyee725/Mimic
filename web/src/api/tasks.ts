import { CURRENT_TASK_ID } from "@/dummy/station"
import { TASKS, getTask as findTask } from "@/dummy/tasks"
import type { Task } from "@/domain/task"

export const listTasks = (): Task[] => TASKS
export const getTask = (id: string): Task | undefined => findTask(id)
/** Task currently being captured on this station */
export const getCurrentTaskId = () => CURRENT_TASK_ID
