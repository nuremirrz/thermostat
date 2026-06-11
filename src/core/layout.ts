import * as THREE from "three";

/**
 * Central layout / configuration for the wiring scene.
 * All positions are in the BackPanel's local space (panel centered at origin,
 * facing +Z). The BackPanel group is then placed on the wall.
 */

export const PANEL = {
  width: 1.7,
  height: 2.15,
  depth: 0.12,
  // Horizontal centre of each lettered pill (local X)
  columnX: 0.5,
  // Pill size (local units)
  pillW: 0.36,
  pillH: 0.14,
  // The gold screw (wire clamp) sits this far inboard of the pill centre.
  // This screw IS the wire connection point, so the wire seats next to its letter.
  screwInset: 0.115,
  // Vertical layout of the 8 terminal rows
  rowTop: 0.74,
  rowGap: 0.205,
  // Z of the panel front surface (where terminals sit)
  faceZ: 0.06,
};

export type Column = "L" | "R";

export interface TerminalDef {
  id: string;
  label: string;
  column: Column;
  row: number;
}

// Top-to-bottom, exactly as printed on the real Honeywell sub-base.
const LEFT_LABELS = ["S", "S", "Y", "Y₂", "G", "C", "U", "U"];
const RIGHT_LABELS = ["A", "A", "W₂", "E", "W", "K", "R", "Rc"];

export const TERMINALS: TerminalDef[] = [
  ...LEFT_LABELS.map((label, row) => ({
    id: `L${row}`,
    label,
    column: "L" as Column,
    row,
  })),
  ...RIGHT_LABELS.map((label, row) => ({
    id: `R${row}`,
    label,
    column: "R" as Column,
    row,
  })),
];

function columnSign(t: TerminalDef): number {
  return t.column === "L" ? -1 : 1;
}

function rowY(t: TerminalDef): number {
  return PANEL.rowTop - t.row * PANEL.rowGap;
}

/** Local-space centre of a terminal's lettered pill (used for drawing). */
export function pillCenter(t: TerminalDef): THREE.Vector3 {
  return new THREE.Vector3(columnSign(t) * PANEL.columnX, rowY(t), PANEL.faceZ);
}

/**
 * Local-space position of a terminal's screw point — where a wire clamps in.
 * It sits just inboard of the lettered pill, so the seated wire ends right next
 * to its label.
 */
export function terminalPosition(t: TerminalDef): THREE.Vector3 {
  const x = columnSign(t) * (PANEL.columnX - PANEL.screwInset);
  // sits clearly in front of the faceplate plane so seated wires rest on top of it
  return new THREE.Vector3(x, rowY(t), PANEL.faceZ + 0.05);
}

/** A wire definition: colour + the terminal it must reach. */
export interface WireDef {
  id: string;
  name: string; // human label (RU)
  colorHex: number;
  /** id of the correct target terminal */
  targetTerminalId: string;
  targetLabel: string;
  /** where the wire emerges from the wall (local space) */
  rootOffset: THREE.Vector3;
}

// Targets:  Green→G (L4), Yellow→Y (L2), White→W (R4), Red→R (R6)
export const WIRES: WireDef[] = [
  {
    id: "green",
    name: "Зелёный",
    colorHex: 0x2faf3e,
    targetTerminalId: "L4",
    targetLabel: "G",
    rootOffset: new THREE.Vector3(-0.12, 0.16, PANEL.faceZ + 0.04),
  },
  {
    id: "yellow",
    name: "Жёлтый",
    colorHex: 0xf2c014,
    targetTerminalId: "L2",
    targetLabel: "Y",
    rootOffset: new THREE.Vector3(-0.04, 0.16, PANEL.faceZ + 0.04),
  },
  {
    id: "white",
    name: "Белый",
    colorHex: 0xf3f1ea,
    targetTerminalId: "R4",
    targetLabel: "W",
    rootOffset: new THREE.Vector3(0.04, 0.16, PANEL.faceZ + 0.04),
  },
  {
    id: "red",
    name: "Красный",
    colorHex: 0xd23b32,
    targetTerminalId: "R6",
    targetLabel: "R",
    rootOffset: new THREE.Vector3(0.12, 0.16, PANEL.faceZ + 0.04),
  },
];

export function terminalById(id: string): TerminalDef {
  const t = TERMINALS.find((x) => x.id === id);
  if (!t) throw new Error(`Unknown terminal ${id}`);
  return t;
}
