import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * The thermostat body (provided thermostat.glb). It sits over the sub-base and
 * slides aside when clicked, revealing the panel and wires.
 */
export class Thermostat {
  readonly group = new THREE.Group();
  /** mesh(es) used for click picking */
  readonly pickTargets: THREE.Object3D[] = [];

  private model?: THREE.Group;
  private readonly closedPos = new THREE.Vector3(0, 0.05, 0.22);
  private readonly openPos: THREE.Vector3;

  constructor() {
    // when opened it slides to the right and tilts forward off the wall
    this.openPos = this.closedPos.clone().add(new THREE.Vector3(2.7, -0.1, 0.6));
    this.group.position.copy(this.closedPos);
  }

  async load(): Promise<void> {
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync("models/thermostat.glb");
    const model = gltf.scene;

    // The GLB uses the deprecated KHR_materials_pbrSpecularGlossiness extension,
    // which modern three.js ignores — so its diffuse texture is dropped and the
    // material falls back to a dark metallic default. Re-apply the baked diffuse
    // texture (extracted from the GLB) and make the surface matte plastic.
    const texLoader = new THREE.TextureLoader();
    const diffuse = await texLoader.loadAsync("textures/thermostat_img0.png");
    diffuse.flipY = false;
    diffuse.colorSpace = THREE.SRGBColorSpace;
    diffuse.anisotropy = 8;
    model.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.material = new THREE.MeshStandardMaterial({
          map: diffuse,
          roughness: 0.65,
          metalness: 0.0,
        });
      }
    });

    // normalise: centre, scale to a target height, face the camera (+Z)
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    model.position.sub(center); // centre at origin
    const targetH = 1.9;
    const scale = targetH / size.y;
    model.scale.setScalar(scale);

    model.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        const m = o as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        this.pickTargets.push(m);
      }
    });

    this.model = model;
    this.group.add(model);
  }

  /** progress 0..1 closed→open. */
  setOpen(v: number): void {
    this.group.position.lerpVectors(this.closedPos, this.openPos, v);
    this.group.rotation.y = v * 0.5;
    this.group.rotation.z = v * -0.12;
  }

  /** small idle hover so the closed thermostat invites a click. */
  idle(t: number, opened: boolean): void {
    if (!this.model || opened) return;
    this.group.position.z = this.closedPos.z + Math.sin(t * 1.5) * 0.01;
  }
}
