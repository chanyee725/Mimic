import { SIM_GPU, SIM_JOBS, SIM_SCENES } from "@/dummy/simulation"
import type { SimJob, SimScene } from "@/domain/simulation"

export const listSimScenes = (): SimScene[] => SIM_SCENES
export const getSimScene = (id: string): SimScene | undefined => SIM_SCENES.find((s) => s.id === id)
export const listSimJobs = (): SimJob[] => SIM_JOBS
export const getSimJob = (id: string): SimJob | undefined => SIM_JOBS.find((j) => j.id === id)

/** Isaac Sim runs only on this GPU (local RTX 4090) */
export { SIM_GPU }
