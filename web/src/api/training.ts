import {
  JOBS,
  LOCAL_GPUS,
  POLICY,
  POLICY_BASE,
  RUNPOD_DEFAULTS,
  RUNPOD_GPUS,
  RUNPOD_PRICE_FACTOR,
  RUNPOD_REGIONS,
  RUNPOD_VOLUMES,
  getJob as findJob,
} from "@/dummy/training"
import type { TrainJob } from "@/domain/training"

export const listJobs = (): TrainJob[] => JOBS
export const getJob = (id: string): TrainJob | undefined => findJob(id)

// Station / RunPod configuration. Will come from a backend config endpoint.
export { LOCAL_GPUS, POLICY, POLICY_BASE, RUNPOD_DEFAULTS, RUNPOD_GPUS, RUNPOD_PRICE_FACTOR, RUNPOD_REGIONS, RUNPOD_VOLUMES }
