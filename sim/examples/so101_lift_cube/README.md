# so101_lift_cube

SO-101 팔로워가 테이블 위 빨간 큐브를 마주 보는 예제 환경입니다. 배치는 [LeIsaac](https://github.com/LightwheelAI/leisaac) 의 `lift_cube` 태스크를 따릅니다.

```sh
scripts/fetch-sim-example.sh     # sim/envs/so101-kit/so101_lift_cube/ 에 받기
```

받은 뒤 Environments 화면에서 **Rescan** 하면 `so101-kit` Rig 전용 환경으로 나타납니다.

| 파일 | 내용 |
| --- | --- |
| `scene.usda` | 장면: 물리 장면, 조명, 테이블과 큐브, 로봇 (저장소에 포함) |
| `robot/so101_follower.usd` | SO-101 팔로워 (LeIsaac v0.1.0 릴리스, 23 MB) |
| `table_with_cube/` | 테이블과 큐브 (LeIsaac v0.1.2 릴리스 `table_with_cube.zip`) |
| `thumbnail.png` | 테이블 장면 썸네일 |

- 로봇은 `(0.35, -0.64, 0.01)` m 에 Z 축으로 180° 돌려 두고, 큐브는 `(0.35, -0.36)` 에 있습니다. 단위는 m, 위쪽은 Z 축입니다.
- 받는 파일은 SHA-256 으로 확인하고 git 에는 올리지 않습니다 (`.gitignore`).
- 에셋 라이선스: LeIsaac, Apache License 2.0 (LightwheelAI).
