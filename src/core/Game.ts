import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Wall } from "../objects/Wall.ts";
import { BackPanel } from "../objects/BackPanel.ts";
import { Thermostat } from "../objects/Thermostat.ts";
import { Wire } from "../objects/Wire.ts";
import { WIRES, terminalById } from "./layout.ts";
import { Easings, TweenManager } from "./Tween.ts";
import { Hud } from "../ui/Hud.ts";
import { t, onChange } from "./i18n.ts";

type Phase = "closed" | "opening" | "closing" | "wiring" | "complete";

/**
 * Descriptor of the currently shown banner. Stored (rather than a raw string)
 * so the banner can be re-rendered in the active language on a live switch.
 * `wireId`/`label` are only used by the "banner.selectedWire" template.
 */
type BannerDesc = { key: string; wireId?: string; label?: string };

export class Game {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: OrbitControls;
  private raycaster = new THREE.Raycaster();
  private pointer = new THREE.Vector2();
  private clock = new THREE.Clock();
  private tweens = new TweenManager();

  private wall = new Wall();
  private panel = new BackPanel();
  private thermostat = new Thermostat();
  private wires: Wire[] = [];

  private hud: Hud;
  private phase: Phase = "closed";
  private selected: Wire | null = null;
  private connectedCount = 0;
  private toggling = false;
  private currentBanner: BannerDesc | null = null;

  constructor(container: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    container.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0xcfccc4);

    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    this.camera.position.set(1.1, 0.25, 6.2);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.enablePan = false;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 8;
    this.controls.minPolarAngle = Math.PI * 0.28;
    this.controls.maxPolarAngle = Math.PI * 0.62;
    this.controls.minAzimuthAngle = -0.7;
    this.controls.maxAzimuthAngle = 0.7;
    this.controls.target.set(0, 0, 0);

    this.hud = new Hud(container);
    this.hud.onReplay = () => this.reset();
    this.hud.onReturn = () => this.setThermostatOpen(false);

    this.buildScene();
    this.bindEvents();

    // Live language switch: re-render static HUD text + the current banner.
    onChange(() => this.applyLanguage());
    this.setBanner({ key: "banner.takeOff" });
  }

  // ---- localization ------------------------------------------------------

  /** Store the current banner and render it in the active language. */
  private setBanner(desc: BannerDesc): void {
    this.currentBanner = desc;
    this.hud.setBanner(this.renderBanner(desc));
  }

  private renderBanner(desc: BannerDesc): string {
    if (desc.key === "banner.selectedWire") {
      return t(desc.key, {
        name: t("wires." + desc.wireId),
        label: desc.label ?? "",
      });
    }
    return t(desc.key);
  }

  /** Re-render everything text-related after a locale change (DOM only). */
  private applyLanguage(): void {
    this.hud.retranslate();
    if (this.currentBanner) this.hud.setBanner(this.renderBanner(this.currentBanner));
  }

  // ---- setup -------------------------------------------------------------

  private buildScene(): void {
    this.scene.add(this.wall.group);

    this.panel.group.position.set(0, 0, 0);
    this.scene.add(this.panel.group);

    // wires parented to the panel so they share its local space.
    // hidden while the thermostat covers the panel.
    for (let i = 0; i < WIRES.length; i++) {
      const wire = new Wire(WIRES[i], i);
      wire.group.visible = false;
      this.wires.push(wire);
      this.panel.group.add(wire.group);
    }

    this.scene.add(this.thermostat.group);

    this.addLights();
  }

  private addLights(): void {
    const hemi = new THREE.HemisphereLight(0xffffff, 0x9a978f, 0.85);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(3.5, 5, 6);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 25;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    key.shadow.bias = -0.0004;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0xfff3e0, 0.4);
    fill.position.set(-4, 1, 3);
    this.scene.add(fill);
  }

  async start(): Promise<void> {
    await this.thermostat.load();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  // ---- input -------------------------------------------------------------

  private bindEvents(): void {
    window.addEventListener("resize", () => this.onResize());
    const dom = this.renderer.domElement;
    // distinguish a click from an orbit-drag
    let downX = 0;
    let downY = 0;
    dom.addEventListener("pointerdown", (e) => {
      downX = e.clientX;
      downY = e.clientY;
    });
    dom.addEventListener("pointerup", (e) => {
      const moved = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (moved < 6) this.onClick(e);
    });
  }

  private setPointer(e: PointerEvent): void {
    this.pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    this.pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  private onClick(e: PointerEvent): void {
    this.setPointer(e);
    if (this.phase === "opening" || this.phase === "closing") return;

    // Clicking the thermostat toggles it: snap it off the wall, or put it back.
    if (this.phase === "closed" || this.phase === "wiring") {
      const hit = this.raycaster.intersectObjects(this.thermostat.pickTargets, true);
      if (hit.length) {
        this.setThermostatOpen(this.phase === "closed");
        return;
      }
    }
    if (this.phase !== "wiring") return;

    // gather interactive targets: wire meshes + visible terminal hotspots
    const wireMeshes: THREE.Object3D[] = [];
    this.wires.forEach((w) => {
      if (!w.connected) wireMeshes.push(w.group);
    });
    const termMeshes = [...this.panel.hotspots.values()];

    const hits = this.raycaster.intersectObjects(
      [...wireMeshes, ...termMeshes],
      true
    );
    if (!hits.length) {
      this.selectWire(null);
      return;
    }

    const obj = hits[0].object;
    const kind = obj.userData.kind ?? obj.parent?.userData.kind;
    if (kind === "wire") {
      const id = obj.userData.wireId ?? obj.parent?.userData.wireId;
      const wire = this.wires.find((w) => w.def.id === id) ?? null;
      if (wire && !wire.connected) this.selectWire(wire);
    } else if (kind === "terminal") {
      this.tryConnect(obj.userData.terminalId as string);
    }
  }

  // ---- gameplay ----------------------------------------------------------

  /** Slide the thermostat off the wall (open=true) or back onto it (open=false). */
  private setThermostatOpen(open: boolean): void {
    if (this.toggling) return;
    this.toggling = true;
    this.phase = open ? "opening" : "closing";
    this.selectWire(null);
    this.panel.highlightTerminal(null);
    this.hud.setReturnVisible(false);
    this.setBanner({ key: open ? "banner.removing" : "banner.returning" });
    this.controls.enabled = false;

    const camFrom = this.camera.position.clone();
    const tgtFrom = this.controls.target.clone();
    const camTo = open
      ? new THREE.Vector3(0, 0.15, 4.3)
      : new THREE.Vector3(1.1, 0.25, 6.2);
    const tgtTo = open ? new THREE.Vector3(0, 0.1, 0) : new THREE.Vector3(0, 0, 0);
    const from = open ? 0 : 1;
    const to = open ? 1 : 0;

    this.tweens.to(
      1.1,
      (v) => {
        const o = from + (to - from) * v;
        this.thermostat.setOpen(o);
        this.camera.position.lerpVectors(camFrom, camTo, v);
        this.controls.target.lerpVectors(tgtFrom, tgtTo, v);
        // wires are only visible while the thermostat is clear of the panel
        const wiresVisible = o > 0.35;
        this.wires.forEach((w) => (w.group.visible = wiresVisible));
      },
      {
        easing: Easings.easeInOutCubic,
        onComplete: () => {
          this.toggling = false;
          this.controls.enabled = true;
          if (open) {
            this.phase = this.connectedCount === WIRES.length ? "complete" : "wiring";
            this.hud.showChecklist();
            this.hud.setReturnVisible(true);
            this.setBanner({ key: "banner.wiringOpenHint" });
          } else {
            this.phase = "closed";
            this.hud.hideChecklist();
            this.setBanner({ key: "banner.takeOffAgain" });
          }
        },
      }
    );
  }

  private selectWire(wire: Wire | null): void {
    if (this.selected) this.selected.setSelected(false);
    this.selected = wire;
    if (wire) {
      wire.setSelected(true);
      this.panel.highlightTerminal(wire.def.targetTerminalId);
      this.hud.setActiveWire(wire.def.id);
      this.setBanner({
        key: "banner.selectedWire",
        wireId: wire.def.id,
        label: wire.def.targetLabel,
      });
    } else {
      this.panel.highlightTerminal(null);
      this.hud.setActiveWire(null);
      this.setBanner({ key: "banner.selectWire" });
    }
  }

  private tryConnect(terminalId: string): void {
    if (!this.selected) {
      this.hud.flash(t("toast.selectFirst"));
      return;
    }
    const wire = this.selected;
    if (wire.def.targetTerminalId !== terminalId) {
      const term = terminalById(terminalId);
      this.hud.flash(
        t("toast.wrongTerminal", { got: term.label, need: wire.def.targetLabel }),
        true
      );
      return;
    }

    // correct → animate the wire onto the screw
    this.selectWire(null);
    this.panel.highlightTerminal(null);
    this.tweens.to(
      0.7,
      (v) => wire.animateConnect(v),
      {
        easing: Easings.easeOutCubic,
        onComplete: () => {
          this.connectedCount++;
          this.hud.markConnected(wire.def.id);
          this.hud.flash(
            t("toast.connected", {
              name: t("wires." + wire.def.id),
              label: wire.def.targetLabel,
            })
          );
          if (this.connectedCount === WIRES.length) this.finish();
        },
      }
    );
  }

  private finish(): void {
    this.phase = "complete";
    this.hud.setReturnVisible(false);
    this.setBanner({ key: "banner.allConnected" });
    setTimeout(() => this.hud.showComplete(), 600);

    // Сообщаем родительскому окну (платформе), что уровень пройден.
    if (window.parent !== window) {
      window.parent.postMessage(
        { source: "hvac-sim", type: "level-complete", slug: "thermostat" },
        "*"
      );
    }
  }

  private reset(): void {
    this.connectedCount = 0;
    this.toggling = false;
    this.selectWire(null);
    this.wires.forEach((w) => {
      w.animateConnect(0);
      w.group.visible = false;
    });
    this.thermostat.setOpen(0);
    this.phase = "closed";
    this.camera.position.set(1.1, 0.25, 6.2);
    this.controls.target.set(0, 0, 0);
    this.controls.enabled = true;
    this.hud.reset();
    this.setBanner({ key: "banner.takeOff" });
  }

  // ---- loop --------------------------------------------------------------

  private frame(): void {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    this.tweens.update(dt);
    this.thermostat.idle(t, this.phase !== "closed");
    this.panel.pulse(t);
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
