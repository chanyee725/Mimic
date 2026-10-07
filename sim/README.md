# sim

Isaac Sim 5.1.0 환경과 실행기를 두는 곳입니다. 시뮬레이션은 **데이터 수집**(Isaac Sim Task)과 **평가**에 쓰고, 이 스테이션이나 시뮬레이션 서버에서 돕니다.

```
sim/
  pyproject.toml   Isaac Sim 5.1.0 (Python 3.11) — `uv sync` 로 sim/.venv 에 설치
  runner/
    server.py      Isaac Sim 서버: 앱을 띄우고 끄며 환경을 엽니다 (표준 라이브러리만 사용)
    app.py         Isaac Sim 앱: server.py 가 window / headless 로 실행
    scene.py       환경 스크립트의 build(scene) 를 실행해 장면을 만듭니다 (pxr 만 사용)
  assets/          환경이 가져다 쓰는 기본 에셋 (USDA, 원점은 바닥 중앙, m 단위, Z 위)
    table/         1.2 × 0.8 m 테이블, 윗면 높이 0.75 m (고정)
    cube/          4 cm 큐브, 50 g 강체 (집을 물체)
    tray/          16 × 12 cm 트레이, 벽 3 cm (놓을 곳, 고정)
  examples/envs/   예제 환경 스크립트 (lift_cube.py)

data/sims/         스테이션 데이터 (git 밖, `VLA_SIM_DIR` 로 옮김)
  envs/            환경 스크립트: <env-id>.py, 또는 <env-id>/env.py + 그 환경만 쓰는 파일
  envs.yaml        환경별 로봇 태그 (Environments 화면에서 편집)
  robot/           로봇 USD: <robot-id>.usd 또는 <robot-id>/<robot-id>.usd
```

## 설치

```sh
cd sim && uv sync     # Isaac Sim 5.1.0 (약 16 GB). 실행기는 NVIDIA EULA 에 동의한 것으로 Isaac Sim 을 띄웁니다
```

최소 사양은 RTX 4080 (VRAM 16 GB), RAM 32 GB 입니다. 그보다 낮은 GPU 에서도 단순한 장면은 열리지만, 카메라 여러 대를 쓰는 평가는 어려울 수 있습니다.

## 실행 방식

Settings → Connection → **Isaac Sim** 에서 고릅니다.

- **This station:** 백엔드가 필요할 때 `127.0.0.1:8211` 에 서버를 띄웁니다. 백엔드를 재시작해도 서버는 남아 있고, 앱은 Environments 화면의 **Stop** 으로 끕니다.
- **Remote server:** 시뮬레이션 서버에 이 저장소를 받고 `cd sim && uv sync` 한 뒤 아래처럼 띄워 두고, Server URL 에 `http://<서버>:8211` 을 적습니다. 환경을 열 때 스크립트(폴더면 폴더 전체)와 로봇 USD 를 서버로 보내므로 서버에 `data/sims` 를 맞춰 둘 필요는 없습니다. `sim/assets/` 는 서버 쪽 저장소의 것을 씁니다.

  ```sh
  sim/.venv/bin/python sim/runner/server.py --host 0.0.0.0 --port 8211
  ```

- **Display:** Window 는 Isaac Sim 창을 띄우고, Headless 는 화면 없이 돌립니다. 원격 서버에서 Window 를 고르면 서버 화면에 창이 뜹니다.
- **Window 모드 도구:** 가벼운 기본 구성에 Physics UI 를 더해 띄웁니다. 관절은 **Window → Physics → Physics Authoring Toolbar** 의 Physics Inspector 로 움직입니다. Full 구성(`isaacsim.exp.full.kit`)은 `SimulationApp` 으로 띄우면 죽어서 쓰지 않습니다.
- **Physics:** 물리 연산(PhysX) 장치입니다. 기본값은 GPU 이고, 바꾸면 앱이 다시 시작됩니다. 렌더링은 항상 NVIDIA GPU 에서 합니다.
- **첫 실행:** 처음 장면을 열 때 RTX 셰이더를 컴파일하느라 1~3분 걸리고 CPU 를 많이 씁니다. 캐시(`sim/.venv/.../isaacsim/kit/cache`)가 생긴 뒤에는 20초 안팎으로 열립니다.

Environments 화면에서 환경을 고르고 **Open in Isaac Sim** 을 누르면 그 환경 스크립트로 장면을 만들어 엽니다. 스크립트에서 오류가 나면 화면의 Isaac Sim 상태에 메시지가 뜹니다. 로그와 받은 환경은 `~/.cache/mimic-sim/` 에 있습니다.

## 환경 추가

환경은 장면을 만드는 Python 스크립트 하나입니다. `build(scene)` 함수에서 에셋과 로봇 위치를 정합니다.

```python
# data/sims/envs/lift_cube.py
TABLE_TOP = 0.75

def build(scene):
    scene.add("table")                                   # sim/assets/table
    scene.add("cube", pos=(0, 0.08, TABLE_TOP))          # 테이블 위 (원점이 바닥이라 z = 윗면 높이)
    scene.add("tray", pos=(0.2, 0.0, TABLE_TOP))
    scene.robot(pos=(0, -0.2, TABLE_TOP), yaw=180)       # 로봇은 태그에서 정함, 바닥에 고정
```

- 장면에는 처음부터 `/World`, 물리 장면(중력), 조명, 바닥이 있습니다. 단위는 m, 위쪽은 Z, `yaw` 는 Z 축 회전(도)입니다.
- `scene.add(asset, pos, yaw, name, scale, color)`: `sim/assets/<asset>/` 를 `/World/<name>` 에 놓습니다. `color=(r, g, b)` (0~1) 로 색을 바꿉니다.
- `scene.robot(pos, yaw)`: 환경의 로봇 태그 중 첫 번째 로봇을 `/World/Robot` 에 놓고, base 를 고정 관절로 바닥에 묶어 Play 해도 넘어지지 않습니다. 태그가 없으면 오류가 납니다.
- `scene.stage` 는 `pxr` 스테이지라 그 밖의 것은 직접 만들 수 있습니다.
- 예제로 시작하려면 로봇 USD 를 받고 예제 스크립트를 복사한 뒤 **Rescan** 합니다.

  ```sh
  scripts/fetch-sim-robot.sh                        # data/sims/robot/so101_follower.usd (23 MB)
  cp sim/examples/envs/lift_cube.py data/sims/envs/
  ```

- **로봇 태그:** Environments 화면의 **Robots** 에서 `data/sims/robot/` 의 로봇을 체크합니다 (`data/sims/envs.yaml` 에 저장). 로봇 id 는 LeRobot 팔로워 타입 이름(예: `so101_follower`)으로 둡니다. 태그가 있으면 팔로워가 모두 태그된 로봇인 Rig 의 Task 와 모델에서만 쓰고, 태그가 없으면 모든 Rig 에서 씁니다.
- 새 로봇은 `data/sims/robot/<robot-id>.usd` 에 USD 를 넣으면 태그 목록에 나타납니다. URDF 에서 만든 USD 에 꺼진 `root_joint` 가 있어도 상관없습니다 (Mimic 이 따로 고정 관절을 붙입니다).
- `_` 나 `.` 로 시작하는 파일과 폴더는 스캔하지 않습니다. 폴더 위치는 환경 변수 `VLA_SIM_DIR` (기본값 `data/sims`).
- Task 가 쓰고 있는 환경은 지울 수 없습니다.
- 썸네일: 스크립트 옆에 같은 이름의 이미지(`lift_cube.py` → `lift_cube.png`, jpg / webp 도 가능)를 두거나, 폴더 환경이면 안에 `thumbnail.png` 를 둡니다.
- 스캔 규칙과 서버 API: [docs/api/simulation.md](../docs/api/simulation.md)

## Task 환경 선택 (데이터 수집)

Rig 는 실제 장비 하나로 씁니다. Tasks 에서 **Isaac Sim** 태그를 고르고 Environments 에 등록된 환경 하나를 고르면, 그 환경이 Task 에 저장됩니다 (YAML `env: <env-id>`).

- 실제 리더 팔이 환경 안의 팔로워를 움직이고, Capture, Review, Datasets 흐름을 그대로 씁니다. 녹화에는 환경 id (`simEnv`) 가 붙습니다.
- Isaac Sim 연결(브리지)은 아직 없어서, Isaac Sim Task 의 Capture 는 지금은 503 을 돌려줍니다.
- Environments 화면은 환경 관리(Rescan, 로봇 태그, 열기, 삭제)만 합니다. 평가는 Evaluate 화면에서 대상을 **Isaac Sim** 으로 고릅니다.
