import * as THREE from "three";

/**
 * The wall the sub-base is mounted on. A large lightly-textured plane plus a
 * shallow recessed box around the mounting area for a bit of depth.
 */
export class Wall {
  readonly group = new THREE.Group();

  constructor() {
    const tex = makeWallTexture();
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 9),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0 })
    );
    wall.position.z = -0.16;
    wall.receiveShadow = true;
    this.group.add(wall);

    // baseboard for a little grounding
    const skirt = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.5, 0.06),
      new THREE.MeshStandardMaterial({ color: 0xf3f1ec, roughness: 0.8 })
    );
    skirt.position.set(0, -4.0, -0.12);
    skirt.receiveShadow = true;
    this.group.add(skirt);
  }
}

function makeWallTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 512;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#e9e6df";
  ctx.fillRect(0, 0, 512, 512);
  // faint paint speckle
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const a = Math.random() * 0.05;
    ctx.fillStyle = `rgba(120,116,108,${a})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
