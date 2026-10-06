/** Evaluations view with the environment (and optionally the model) preselected in the form */
export const evalHref = (envId: string, modelId?: string) => `/evaluate?target=sim&env=${envId}${modelId ? `&model=${modelId}` : ""}`

/** KB → "3 KB" / "18.0 MB" */
export const formatKB = (kb: number) => (kb < 1024 ? `${kb.toLocaleString()} KB` : `${(kb / 1024).toFixed(1)} MB`)
