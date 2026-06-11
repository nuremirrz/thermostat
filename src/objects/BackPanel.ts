import * as THREE from "three";
import {
  PANEL,
  TERMINALS,
  TerminalDef,
  pillCenter,
  terminalPosition,
  WIRES,
} from "../core/layout.ts";

/**
 * The thermostat sub-base ("задняя панель"). Built procedurally:
 *  - a rounded white plate (extruded shape with a central wire slot)
 *  - a canvas-drawn faceplate texture reproducing the printed terminal layout
 *  - invisible click hotspots + highlight rings at the wired terminals
 */
export class BackPanel {
  readonly group = new THREE.Group();
  /** clickable hotspot meshes, keyed by terminal id */
  readonly hotspots = new Map<string, THREE.Mesh>();
  private readonly rings = new Map<string, THREE.Mesh>();

  constructor() {
    this.buildPlate();
    this.buildHotspots();
  }

  // ---- geometry -----------------------------------------------------------

  private buildPlate(): void {
    const w = PANEL.width;
    const h = PANEL.height;

    // plate body — extruded rounded rect, plain cream material on every face.
    // (We intentionally do NOT texture the extruded faces: ExtrudeGeometry's UVs
    //  are raw shape coordinates, not 0..1, which warps a mapped texture.)
    const shape = new THREE.Shape();
    roundedRectPath(shape, -w / 2, -h / 2, w, h, 0.12);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: PANEL.depth,
      bevelEnabled: true,
      bevelThickness: 0.015,
      bevelSize: 0.015,
      bevelSegments: 2,
      steps: 1,
    });
    geo.translate(0, 0, -PANEL.depth);

    const body = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: 0xeae7df,
        roughness: 0.85,
        metalness: 0.0,
      })
    );
    body.castShadow = true;
    body.receiveShadow = true;
    this.group.add(body);

    // faceplate — flat plane with clean 0..1 UVs so the printed layout maps
    // exactly. The wire slot is drawn into the texture as a dark opening.
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({
        map: makeFaceTexture(),
        roughness: 0.8,
        metalness: 0.0,
      })
    );
    face.position.z = PANEL.faceZ;
    face.receiveShadow = true;
    this.group.add(face);
  }

  private buildHotspots(): void {
    const ringGeo = new THREE.TorusGeometry(0.075, 0.012, 12, 32);
    const discGeo = new THREE.CircleGeometry(0.07, 32);

    for (const wire of WIRES) {
      const term = TERMINALS.find((t) => t.id === wire.targetTerminalId)!;
      const pos = terminalPosition(term);

      // invisible disc used purely for raycasting
      const disc = new THREE.Mesh(
        discGeo,
        new THREE.MeshBasicMaterial({ visible: false })
      );
      disc.position.copy(pos).setZ(pos.z + 0.001);
      disc.userData.terminalId = term.id;
      disc.userData.kind = "terminal";
      this.group.add(disc);
      this.hotspots.set(term.id, disc);

      // highlight ring, hidden until the matching wire is picked up
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0x49c0ff,
          transparent: true,
          opacity: 0.95,
        })
      );
      ring.position.copy(pos).setZ(pos.z + 0.002);
      ring.visible = false;
      this.group.add(ring);
      this.rings.set(term.id, ring);
    }
  }

  // ---- api ---------------------------------------------------------------

  terminalWorldPosition(term: TerminalDef): THREE.Vector3 {
    return this.group.localToWorld(terminalPosition(term).clone());
  }

  highlightTerminal(terminalId: string | null): void {
    for (const [id, ring] of this.rings) ring.visible = id === terminalId;
  }

  pulse(t: number): void {
    for (const ring of this.rings.values()) {
      if (ring.visible) {
        const s = 1 + Math.sin(t * 6) * 0.08;
        ring.scale.setScalar(s);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function roundedRectPath(
  path: THREE.Shape | THREE.Path,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  path.moveTo(x + r, y);
  path.lineTo(x + w - r, y);
  path.quadraticCurveTo(x + w, y, x + w, y + r);
  path.lineTo(x + w, y + h - r);
  path.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  path.lineTo(x + r, y + h);
  path.quadraticCurveTo(x, y + h, x, y + h - r);
  path.lineTo(x, y + r);
  path.quadraticCurveTo(x, y, x + r, y);
}

/** Draw the printed faceplate into a canvas and return it as a texture. */
function makeFaceTexture(): THREE.CanvasTexture {
  const w = PANEL.width;
  const h = PANEL.height;
  const CH = 1180;
  const CW = Math.round((CH * w) / h);
  const canvas = document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH;
  const ctx = canvas.getContext("2d")!;

  // map local panel coords -> canvas pixels
  const toU = (x: number) => ((x + w / 2) / w) * CW;
  const toV = (y: number) => ((h / 2 - y) / h) * CH;

  // background plate
  ctx.fillStyle = "#efece4";
  ctx.fillRect(0, 0, CW, CH);

  // subtle inner border frame
  ctx.strokeStyle = "#d9d5cb";
  ctx.lineWidth = 10;
  roundRectCtx(ctx, 24, 24, CW - 48, CH - 48, 36);
  ctx.stroke();

  // central wire slot — drawn as a dark recessed opening the wires emerge from
  {
    const sx0 = toU(-0.17);
    const sy0 = toV(0.58);
    const sw = (0.34 / w) * CW;
    const sh = (0.62 / h) * CH;
    ctx.save();
    roundRectCtx(ctx, sx0, sy0, sw, sh, 26);
    const sg = ctx.createLinearGradient(0, sy0, 0, sy0 + sh);
    sg.addColorStop(0, "#2b2b2b");
    sg.addColorStop(1, "#3d3d3d");
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.strokeStyle = "#cdc8be";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
  }

  const pillW = (PANEL.pillW / w) * CW;
  const pillH = (PANEL.pillH / h) * CH;

  for (const t of TERMINALS) {
    const pill = pillCenter(t);
    const screw = terminalPosition(t);
    const dir = t.column === "L" ? -1 : 1;
    const pillCx = toU(pill.x);
    const pillCy = toV(pill.y);

    // pill
    ctx.fillStyle = isWired(t.id) ? "#9a958c" : "#dcd8cf";
    roundRectCtx(ctx, pillCx - pillW / 2, pillCy - pillH / 2, pillW, pillH, pillH / 2);
    ctx.fill();
    ctx.strokeStyle = "#cfcabf";
    ctx.lineWidth = 3;
    ctx.stroke();

    // label — nudged toward the outboard side so it never sits under the screw
    ctx.fillStyle = isWired(t.id) ? "#ffffff" : "#7d786d";
    ctx.font = `600 ${Math.round(pillH * 0.6)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(t.label, pillCx + dir * pillW * 0.18, pillCy + 2);

    // gold screw terminal (inboard edge of the pill = wire clamp point)
    const sx = toU(screw.x);
    const sy = toV(screw.y);
    const sr = (0.045 / h) * CH;
    const grd = ctx.createRadialGradient(sx - sr * 0.3, sy - sr * 0.3, sr * 0.1, sx, sy, sr);
    grd.addColorStop(0, "#f6e3a6");
    grd.addColorStop(0.6, "#caa64a");
    grd.addColorStop(1, "#9c7c2e");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
    // screw slot
    ctx.strokeStyle = "#6e561d";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx - sr * 0.55, sy);
    ctx.lineTo(sx + sr * 0.55, sy);
    ctx.stroke();
  }

  // centre label block under the slot
  ctx.fillStyle = "#8a857b";
  ctx.textAlign = "center";
  ctx.font = `700 ${Math.round((0.05 / h) * CH)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillText("U & R WIRES", toU(0), toV(-0.24));
  ctx.font = `600 ${Math.round((0.042 / h) * CH)}px "Segoe UI", Arial, sans-serif`;
  ctx.fillText("1 WIRE", toU(0), toV(-0.34));
  ctx.fillText("2 WIRES", toU(0), toV(-0.46));

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function isWired(id: string): boolean {
  return WIRES.some((wd) => wd.targetTerminalId === id);
}

function roundRectCtx(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
