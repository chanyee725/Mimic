import { SIM_ENVS, SIM_ENVS_DIR, SIM_GPU, SIM_JOBS } from "@/dummy/simulation"
import type { SimEnv, SimJob } from "@/domain/simulation"

/** Environments found in the environments folder (the backend rescans it on request) */
export const listSimEnvs = (): SimEnv[] => SIM_ENVS
export const getSimEnv = (id: string): SimEnv | undefined => SIM_ENVS.find((e) => e.id === id)
/** Folder the station scans for environments */
export const getSimEnvsDir = (): string => SIM_ENVS_DIR

export const listSimJobs = (): SimJob[] => SIM_JOBS
export const getSimJob = (id: string): SimJob | undefined => SIM_JOBS.find((j) => j.id === id)

/** Isaac Sim runs only on this GPU (local RTX 4090) */
export { SIM_GPU }
