# RunPod 정의 검토

## 결론

- **지금 RunPod 정의는 공식 문서를 근거로 만든 것이 아닙니다.** 처음 웹 목업 화면에 맞춰 만든 옵션 목록을 백엔드 `backend/app/seeds/data/training.json`으로 옮긴 것입니다.
  - 코드, `docs/`, git 이력 어디에도 docs.runpod.io 인용이 없습니다.
  - `docs/api/training.md`도 "static option list, not live availability"라고 적혀 있습니다.
- UI 옵션 목록으로는 일관되지만 **API 계약으로는 부족합니다.** 지금 모델로는 실제 Pod 생성 요청을 만들 수 없습니다.
- **시급:** 공식 문서 기준 REST v1(`https://rest.runpod.io/v1`)은 deprecated이고 **2026-11-15에 폐기**될 예정입니다. 새로 구현한다면 **REST v2(`https://api.runpod.io/v2`)** 기준이어야 합니다.

## 공식 API 요약 (두 openapi.json을 직접 받아 확인)

- **인증:** `Authorization: Bearer <RUNPOD_API_KEY>`. GraphQL은 `?api_key=` 형식입니다.
- **v1**
  - 경로: `POST/GET /pods`, `GET/PATCH/DELETE /pods/{id}`(DELETE = terminate), `POST /pods/{id}/start|stop|restart|reset`, `/networkvolumes`, `/templates`, `/billing/pods`
  - `PodCreateInput`: `name`, `imageName`, `gpuTypeIds[]`, `gpuCount`, `cloudType`(`SECURE` | `COMMUNITY`), `dataCenterIds[]`, `networkVolumeId`, `containerDiskInGb`(50), `volumeInGb`(20), `volumeMountPath`(`/workspace`), `ports`(`"8888/http"`), `env`, `interruptible`, `templateId`, `allowedCudaVersions`, `dockerStartCmd[]`, `dockerEntrypoint[]`
  - 응답: `costPerHr`, `adjustedCostPerHr`, `desiredStatus`(`RUNNING` | `EXITED` | `TERMINATED`)
- **v2**
  - 경로: `POST/GET /v2/pods`, `GET /v2/pods/{id}/logs`, `POST /v2/pods/{id}/action {"action":"start|stop|restart|terminate"}`, `/v2/network-volumes`, `/v2/catalog/gpus`, `/v2/catalog/datacenters`, `/v2/billing/pods`
  - `CreatePodRequest`: `cloud`, `dataCenterIds`, `gpu{id,count,allowedCudaVersions,…}`, `image`, `cmd[]`, `env`, `ports`, `mounts{persistent{size,path}, network[{volumeId,path}]}`, `templateId`
  - 상태: `PROVISIONING`, `STARTING`, `RUNNING`, `EXITED`, `ERROR`, `TERMINATED`. 응답의 `cost`가 실제 과금 단가입니다.
- **GPU ID는 전체 이름입니다.** 예: `"NVIDIA GeForce RTX 4090"`, `"NVIDIA A100-SXM4-80GB"`, `"NVIDIA H100 80GB HBM3"`. v2 catalog는 `id`(요청용)와 `name`(`"RTX 4090"`, 표시용)을 구분합니다.
- **가격 · 재고:** GPU마다 `price.secure`, `price.community`(GPU 1장당 USD/h), `maxCount.*`, 데이터센터별 `availability`(`NONE` / `LOW` / `MEDIUM` / `HIGH`).
- **데이터센터 ID:** `EU-RO-1`, `US-TX-3` 등.
- **스토리지:**
  - container disk는 stop하면 지워집니다.
  - `/workspace` volume은 stop해도 남고 terminate하면 지워지며, stop 상태에서도 과금됩니다.
  - **network volume은 만들 때 정한 데이터센터의 Pod에만 붙일 수 있고**, 크기는 늘리기만 됩니다.

## 우리 정의와 다른 점

| # | 우리 정의 | 공식 |
| --- | --- | --- |
| 1 | GPU `name`이 표시 이름(`"RTX 4090"`, `"A100 SXM"`)이고 이 값을 `TrainJob.gpu`, `services/training/plan.py`에 그대로 씀 | 요청에는 `"NVIDIA A100-SXM4-80GB"` 형식의 `id`가 필요. `RTX 5090` · `H200 SXM` · `B200`은 v1 목록에 없음 (v2는 미확인) |
| 2 | `pricePerHr` 하드코딩, community ×0.8 · spot ×0.5 배율은 임의 값 | GPU마다 `price.secure` / `price.community`, 실제 과금은 Pod의 `cost` |
| 3 | `stock: high/low/none` 정적 값, out-of-stock 409는 실제 재고와 무관 | 4단계, 데이터센터 · cloud마다 다름 |
| 4 | `community: bool` 하나 | secure와 community가 따로 있음 |
| 5 | `region = "any"` + 하드코딩한 region 5개 | `dataCenterIds: string[]`, "아무 곳이나"는 필드 생략 |
| 6 | 존재하지 않는 볼륨 `vla-datasets (200 GB, EU-RO-1)`이 `data/settings/runpod.yaml` 기본값. 볼륨과 region의 데이터센터 일치를 검사하지 않음 | 볼륨 목록은 `GET /v2/network-volumes`. 볼륨을 붙이면 데이터센터를 그 볼륨의 것으로 고정 |
| 7 | `diskGB` 하나 | container disk와 persistent volume(`/workspace`)이 따로 있음 |
| 8 | on-demand / spot 선택, "Spot … 마지막 checkpoint 에서 이어 학습"을 약속하지만 구현 없음 | v1은 `interruptible`. v2 지정 방법은 미확인 |
| 9 | `gpu_count: 1 | 2 | 4`, 단일 프로세스 명령 | `count ≥ 1`, GPU마다 `maxCount`. 여러 GPU 학습에는 accelerate 필요 |
| 10 | `PodState`가 running / idle / terminated, stop · terminate가 메모리 상태만 바꿈 | 상태 6개. stop(EXITED)은 디스크 과금이 계속되고 terminate와 다름 |
| 11 | 생성 요청에 필요한 image · cmd · env · ports · `allowedCudaVersions` 없음 | 필수이거나 사실상 필수 |
| 12 | `spentThisMonth`는 항상 null, `monthly_budget` · `idle_alert_min` 미사용 | `/v2/billing/pods`가 있음 |
| 13 | Settings의 Default region · volume이 학습에 반영되지 않음 (학습은 `RUNPOD_DEFAULTS` 사용) | 우리 앱 내부 문제 |
| 14 | 키 연결 테스트가 키 존재 여부만 확인 | `GET /v2/pods` 한 번으로 실제 검증 가능 |

## 고친 모델 (v2 기준 초안)

```python
class RunPodGpuType(CamelModel):      # GET /v2/catalog/gpus (cache ~5 min)
    id: str                            # "NVIDIA GeForce RTX 4090" (request)
    name: str                          # "RTX 4090" (display)
    memory_gb: int
    secure: bool
    community: bool
    price_secure: float | None         # USD/h per GPU
    price_community: float | None
    max_count_secure: int
    max_count_community: int
    availability: Literal["NONE", "LOW", "MEDIUM", "HIGH"]
    data_centers: list[DataCenterAvail]  # {id: "EU-RO-1", availability}

class NetworkVolume(CamelModel):      # GET /v2/network-volumes
    id: str
    name: str
    size_gb: int
    data_center: str

class RunPodLaunch(CamelModel):       # user choices -> CreatePodRequest
    gpu_type_id: str
    gpu_count: int = 1                 # <= maxCount[cloud]
    cloud: Literal["SECURE", "COMMUNITY"] = "SECURE"
    data_center_ids: list[str] = []    # [] = any; forced to [volume.data_center] with a volume
    network_volume_id: str | None = None
    container_disk_gb: int = 50
    persistent_gb: int = 0
    image: str                         # pinned lerobot[smolvla] image
    max_hours: float = 6
    budget_usd: float = 0
    on_finish: Literal["terminate", "stop", "keep"] = "terminate"

class PodInfo(CamelModel):            # mirrors GET /v2/pods/{id}; persisted with the job
    id: str
    status: Literal["PROVISIONING", "STARTING", "RUNNING", "EXITED", "ERROR", "TERMINATED"]
    data_center_id: str | None
    cost_per_hr: float                 # billed `cost`, not computed
    started_at: str | None
```

- 클라이언트는 한 모듈(예: `services/training/runpod_client.py`)에 두고, 참고한 docs.runpod.io 링크와 OpenAPI 버전을 주석으로 남깁니다.
- 가격 미리보기는 `price_<cloud> × count`로 계산해 "추정"이라고 표시하고, Pod가 뜬 뒤에는 실제 `cost`와 billing API 값으로 바꿉니다.
- 정적 카탈로그(`training.json`의 RunPod 목록, 지역, 볼륨 기본값)는 지우고 catalog API 결과로 대체합니다. 키가 없으면 RunPod 탭은 "키를 넣으세요"만 보여 줍니다.

## SmolVLA 학습을 RunPod에서 돌리는 흐름 (제안)

1. **데이터 전달** — 데이터셋을 HF Hub private repo에 올리는 것을 기본으로 합니다(HF 연동이 먼저 필요). 대안은 데이터센터에 묶인 network volume에 미리 동기화.
2. **이미지** — `lerobot[smolvla]` 버전을 고정한 자체 이미지, `allowedCudaVersions`로 호스트 드라이버와 맞춤.
3. **생성** — `POST /v2/pods`: `gpu{id,count}`, `cloud`, `dataCenterIds`, `mounts.network=[{volumeId, path:"/workspace"}]`, `env{HF_TOKEN, JOB_ID, DATASET}`, `cmd=["bash","-lc","lerobot-train --policy.path=lerobot/smolvla_base --dataset.repo_id=$DATASET --output_dir=/workspace/runs/$JOB_ID --job_name=$JOB_ID --policy.device=cuda … && <upload>"]`.
4. **모니터링** — `GET /v2/pods/{id}`로 status · cost를 폴링, `/logs`를 파싱해 step · loss를 `training.metrics` 이벤트로. `max_hours`나 예산을 넘으면 stop 또는 terminate.
5. **체크포인트 회수** — Pod가 `save_freq`마다 HF private repo에 올리고, 스테이션이 받아 Models에 저장.
6. **종료** — 학습이 끝나면 `{"action":"terminate"}` (EXITED 상태에서도 디스크 과금이 계속되므로 terminate가 기본). **job과 Pod ID를 디스크에 저장**하고, 시작할 때 이름 prefix로 고아 Pod를 정리.

## 미확인

- v2에서 spot(interruptible) 지정 방법
- global network volume 존재 여부
- RTX 5090 · H200 · B200의 공식 GPU ID
- GraphQL의 spot 가격 필드 이름
- LeRobot `policy.push_to_hub` 기본값

## 출처

- https://docs.runpod.io/api-reference/overview (v1 폐기일)
- https://docs.runpod.io/api-reference/pods/POST/pods
- https://rest.runpod.io/v1/openapi.json
- https://docs.runpod.io/api-reference-v2/migrate-from-v1
- https://api.runpod.io/v2/openapi.json
- https://docs.runpod.io/api-reference-v2/catalog/list-gpu-types
- https://docs.runpod.io/pods/storage/types
- https://docs.runpod.io/storage/network-volumes
- https://docs.runpod.io/graphql-api
