import { useEffect, useRef, useState } from "react"
import { LuRotateCcw } from "react-icons/lu"
import * as THREE from "three"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"

import { Button } from "@/components/ui/button"
import { ErrorNote } from "@/components/common/query-state"
import { cn } from "@/lib/utils"

const FOV = 35
// Front-right-above in glTF's Y-up, +Z-front frame
const VIEW_DIR = new THREE.Vector3(1, 0.7, 1.3).normalize()

function disposeScene(scene: THREE.Scene) {
  scene.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments)) return
    obj.geometry.dispose()
    for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) {
      for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose()
      m.dispose()
    }
  })
}

/** Static glTF binary viewer with orbit / zoom; renders only when the view changes. Load lazily: it pulls in three.js */
export function ModelViewer({ data, className }: { data: ArrayBuffer; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const resetRef = useRef<() => void>(() => {})
  const [error, setError] = useState<unknown>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const css = getComputedStyle(host)
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    // glTF materials default to fully metallic, which renders black without an environment to reflect
    const pmrem = new THREE.PMREMGenerator(renderer)
    const room = new RoomEnvironment()
    const envMap = pmrem.fromScene(room, 0.04).texture
    room.dispose()
    pmrem.dispose()
    scene.environment = envMap
    scene.environmentIntensity = 0.35
    scene.add(new THREE.HemisphereLight(0xffffff, 0x6a6a6a, 0.8))
    const sun = new THREE.DirectionalLight(0xffffff, 1.6)
    scene.add(sun)

    const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 100)
    const controls = new OrbitControls(camera, renderer.domElement)
    const render = () => renderer.render(scene, camera)
    controls.addEventListener("change", render)

    const resize = () => {
      const { clientWidth: w, clientHeight: h } = host
      if (!w || !h) return
      renderer.setSize(w, h)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      render()
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)

    let disposed = false
    new GLTFLoader().parse(
      data.slice(0), // parse may detach the buffer; the query cache keeps the original
      "",
      (gltf) => {
        if (disposed) return
        const model = gltf.scene
        // Without normals (welded CAD points) smooth normals would blur hard edges: shade per face instead
        model.traverse((obj) => {
          if (!(obj instanceof THREE.Mesh) || obj.geometry.attributes.normal) return
          for (const m of Array.isArray(obj.material) ? obj.material : [obj.material]) {
            m.flatShading = true
            m.needsUpdate = true
          }
        })
        scene.add(model)

        const box = new THREE.Box3().setFromObject(model)
        const sphere = box.getBoundingSphere(new THREE.Sphere())
        const r = sphere.radius || 0.5
        const center = sphere.center
        camera.near = r / 100
        camera.far = r * 100
        sun.position.copy(center).add(new THREE.Vector3(1, 2, 1.5).multiplyScalar(r * 2))

        // Grid on the model's floor, sized to a round number of meters
        const size = Math.max(0.5, Math.ceil(r * 3 * 2) / 2)
        const line = new THREE.Color(css.getPropertyValue("--stage-line").trim() || "#e4e4e7")
        const grid = new THREE.GridHelper(size, Math.round(size * 10), line, line)
        grid.position.set(center.x, box.min.y, center.z)
        scene.add(grid)

        resetRef.current = () => {
          // Fit the bounding sphere into the narrower of the two fields of view
          const vHalf = THREE.MathUtils.degToRad(FOV / 2)
          const half = Math.min(vHalf, Math.atan(Math.tan(vHalf) * camera.aspect))
          const dist = (r / Math.sin(half)) * 1.05
          camera.position.copy(center).addScaledVector(VIEW_DIR, dist)
          controls.target.copy(center)
          controls.minDistance = r * 0.2
          controls.maxDistance = r * 20
          camera.updateProjectionMatrix()
          controls.update()
          render()
        }
        resize()
        resetRef.current()
      },
      (e) => !disposed && setError(e instanceof Error ? e : new Error("3D 모델을 읽을 수 없습니다.")),
    )

    return () => {
      disposed = true
      observer.disconnect()
      controls.dispose()
      disposeScene(scene)
      envMap.dispose()
      renderer.dispose()
      renderer.domElement.remove()
      resetRef.current = () => {}
    }
  }, [data])

  return (
    <div className={cn("relative overflow-hidden rounded-md border bg-stage", className)}>
      <div ref={hostRef} className="absolute inset-0 cursor-grab active:cursor-grabbing" />
      {error ? (
        <ErrorNote error={error} className="absolute inset-x-3 top-3" />
      ) : (
        <Button variant="outline" size="xs" className="absolute top-2 right-2 bg-background" onClick={() => resetRef.current()}>
          <LuRotateCcw />
          Reset view
        </Button>
      )}
    </div>
  )
}
