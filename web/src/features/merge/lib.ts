import type { Dataset } from "@/domain/dataset"

/** Name part of a repoId: `local/stack_two_blocks` → `stack_two_blocks` */
export const repoName = (repoId: string) => repoId.split("/").pop() ?? repoId

/** Suggested output name from the first source: `local/<first>_merged` */
export const defaultRepoId = (first: string | undefined) => (first ? `local/${repoName(first)}_merged` : "")

/** Search on repoId and task */
export const matches = (d: Dataset, q: string) => !q || d.repoId.toLowerCase().includes(q) || d.taskId.toLowerCase().includes(q)
