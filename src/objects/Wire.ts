import * as THREE from "three";
import { WireDef, terminalById, terminalPosition } from "../core/layout.ts";

/**
 * One coloured wire emerging from the wall slot. It is a tube following a
 * Catmull-Rom curve from a fixed root to a movable free end. Connecting the
 * wire just animates the free end onto the target terminal screw.
 *
 * All positions are in BackPanel-local space (the wire group is parented to it).
 */
export class Wire {
  readonly group = new THREE.Group();
  readonly def: WireDef;

  connected = false;

  private readonly root: THREE.Vector3;
  private readonly looseEnd: THREE.Vector3;
  private readonly connectedEnd: THREE.Vector3;
  private readonly end: THREE.Vector3;

  private tube!: THREE.Mesh;
  private tip: THREE.Mesh;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly baseEmissive = new THREE.Color(0x000000);

  constructor(def: WireDef, index: number) {
    this.def = def;
    this.root = def.rootOffset.clone();

    // loose end droops forward & down toward the camera so it is easy to grab
    const spread = (index - 1.5) * 0.14;
    this.looseEnd = this.root
      .clone()
      .add(new THREE.Vector3(spread, -0.34, 0.42));

    this.connectedEnd = terminalPosition(terminalById(def.targetTerminalId));
    this.end = this.looseEnd.clone();

    this.material = new THREE.MeshStandardMaterial({
      color: def.colorHex,
      roughness: 0.5,
      metalness: 0.05,
      emissive: this.baseEmissive,
    });

    // copper conductor tip at the free end
    this.tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.026, 0.09, 16),
      new THREE.MeshStandardMaterial({
        color: 0xc77b3b,
        roughness: 0.35,
        metalness: 0.85,
      })
    );
    this.tip.userData.wireId = def.id;
    this.tip.userData.kind = "wire";
    this.group.add(this.tip);

    this.rebuild();
  }

  // ---- curve / geometry --------------------------------------------------

  private curve(): THREE.CatmullRomCurve3 {
    if (this.connected) {
      // seated route: exit the slot forward, arc over to the screw, end flush —
      // reads as a wire bent neatly onto its terminal rather than a straight stick
      const exit = this.root.clone();
      exit.z += 0.05;
      exit.y -= 0.03;
      const approach = this.end.clone().lerp(this.root, 0.22);
      approach.z += 0.05;
      return new THREE.CatmullRomCurve3([
        this.root.clone(),
        exit,
        approach,
        this.end.clone(),
      ]);
    }
    // loose: a soft cable drooping forward toward the camera
    const mid = this.root.clone().lerp(this.end, 0.5);
    mid.z += 0.22;
    mid.y -= 0.05;
    return new THREE.CatmullRomCurve3([this.root.clone(), mid, this.end.clone()]);
  }

  private rebuild(): void {
    const curve = this.curve();
    const radius = this.connected ? 0.02 : 0.024;
    const geo = new THREE.TubeGeometry(curve, 40, radius, 12, false);
    if (this.tube) {
      this.tube.geometry.dispose();
      this.tube.geometry = geo;
    } else {
      this.tube = new THREE.Mesh(geo, this.material);
      this.tube.castShadow = true;
      this.tube.userData.wireId = this.def.id;
      this.tube.userData.kind = "wire";
      this.group.add(this.tube);
    }

    // copper tip at the free end, oriented along the curve. When seated it sits
    // flush in the screw; when loose it pokes out a little for grabbing.
    const tan = curve.getTangentAt(1).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    this.tip.quaternion.setFromUnitVectors(up, tan);
    this.tip.position.copy(this.end).addScaledVector(tan, this.connected ? 0.0 : 0.035);
  }

  // ---- interaction state -------------------------------------------------

  setEnd(p: THREE.Vector3): void {
    this.end.copy(p);
    this.rebuild();
  }

  /** progress 0..1 from loose to connected position. */
  animateConnect(v: number): void {
    this.end.lerpVectors(this.looseEnd, this.connectedEnd, v);
    this.connected = v >= 1;
    this.rebuild();
  }

  setSelected(on: boolean): void {
    this.material.emissive.copy(on ? new THREE.Color(0xffffff) : this.baseEmissive);
    this.material.emissiveIntensity = on ? 0.25 : 0;
  }

  get targetWorldEnd(): THREE.Vector3 {
    return this.group.localToWorld(this.connectedEnd.clone());
  }
}
