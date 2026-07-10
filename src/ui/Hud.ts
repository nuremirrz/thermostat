import { WIRES } from "../core/layout.ts";
import { t } from "../core/i18n.ts";

/**
 * DOM overlay: instruction banner, wire→terminal checklist, feedback toast,
 * and the "level complete" card.
 *
 * All static wording is (re)applied from the dictionary via retranslate(); the
 * banner text itself is owned by Game (it depends on gameplay state), so this
 * component only re-renders its own static labels on a language switch.
 */
export class Hud {
  private banner: HTMLDivElement;
  private checklist: HTMLDivElement;
  private checklistTitle: HTMLHeadingElement;
  private toast: HTMLDivElement;
  private overlay: HTMLDivElement;
  private rows = new Map<string, HTMLDivElement>();
  private nameSpans = new Map<string, HTMLSpanElement>();
  private overlayEls = new Map<string, HTMLElement>();
  private replayBtn: HTMLButtonElement;
  private returnBtn: HTMLButtonElement;
  private toastTimer?: number;

  onReplay?: () => void;
  onReturn?: () => void;

  constructor(root: HTMLElement) {
    this.banner = el("div", "banner");
    root.appendChild(this.banner);

    this.returnBtn = el("button", "return-btn");
    this.returnBtn.style.display = "none";
    this.returnBtn.addEventListener("click", () => this.onReturn?.());
    root.appendChild(this.returnBtn);

    this.checklist = el("div", "checklist");
    this.checklist.style.display = "none";
    this.checklistTitle = el("h3");
    this.checklist.appendChild(this.checklistTitle);
    for (const w of WIRES) {
      const row = el("div", "row");
      row.dataset.wire = w.id;
      const dot = el("span", "dot");
      dot.style.background = "#" + w.colorHex.toString(16).padStart(6, "0");
      const name = el("span");
      const arrow = el("span", "arrow");
      arrow.textContent = "→";
      const term = el("span");
      term.textContent = w.targetLabel; // terminal code — not translated
      const state = el("span", "state");
      state.textContent = "○";
      row.append(dot, name, arrow, term, state);
      this.checklist.appendChild(row);
      this.rows.set(w.id, row);
      this.nameSpans.set(w.id, name);
    }
    root.appendChild(this.checklist);

    this.toast = el("div", "toast");
    root.appendChild(this.toast);

    this.overlay = el("div", "overlay");
    // data-t keys map to overlay.<key> dictionary entries; emojis/symbols stay.
    this.overlay.innerHTML = `
      <div class="card">
        <div class="emoji">🎉</div>
        <h2 data-t="title"></h2>
        <div class="sub" data-t="sub"></div>
        <div class="stats">
          <div>⭐⭐⭐ <span data-t="rating"></span></div>
          <div>🏆 <span data-t="points"></span></div>
          <div>✅ <span data-t="wiresDone"></span></div>
        </div>
        <button id="replay"></button>
      </div>`;
    root.appendChild(this.overlay);
    this.overlay.querySelectorAll<HTMLElement>("[data-t]").forEach((node) => {
      this.overlayEls.set(node.dataset.t!, node);
    });
    this.replayBtn = this.overlay.querySelector<HTMLButtonElement>("#replay")!;
    this.replayBtn.addEventListener("click", () => this.onReplay?.());

    this.retranslate();
  }

  /** (Re)apply all static wording from the dictionary. Safe to call on switch. */
  retranslate(): void {
    this.returnBtn.textContent = `↩ ${t("hud.returnBtn")}`;
    this.checklistTitle.textContent = t("hud.checklistTitle");
    for (const [id, span] of this.nameSpans) span.textContent = t("wires." + id);
    for (const [key, node] of this.overlayEls) node.textContent = t("overlay." + key);
    this.replayBtn.textContent = `${t("overlay.replay")} ↻`;
  }

  setBanner(text: string): void {
    this.banner.textContent = text;
  }

  showChecklist(): void {
    this.checklist.style.display = "";
  }

  hideChecklist(): void {
    this.checklist.style.display = "none";
  }

  setReturnVisible(on: boolean): void {
    this.returnBtn.style.display = on ? "" : "none";
  }

  setActiveWire(wireId: string | null): void {
    for (const [id, row] of this.rows) {
      row.classList.toggle("active", id === wireId && !row.classList.contains("done"));
    }
  }

  markConnected(wireId: string): void {
    const row = this.rows.get(wireId);
    if (!row) return;
    row.classList.add("done");
    row.classList.remove("active");
    row.querySelector(".state")!.textContent = "✓";
  }

  flash(message: string, bad = false): void {
    this.toast.textContent = message;
    this.toast.classList.toggle("bad", bad);
    this.toast.classList.add("show");
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => {
      this.toast.classList.remove("show");
    }, 1800);
  }

  showComplete(): void {
    this.overlay.classList.add("show");
  }

  reset(): void {
    this.overlay.classList.remove("show");
    this.checklist.style.display = "none";
    this.returnBtn.style.display = "none";
    for (const row of this.rows.values()) {
      row.classList.remove("done", "active");
      row.querySelector(".state")!.textContent = "○";
    }
    // banner text is re-emitted by Game (it owns the current banner descriptor)
  }
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls?: string
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
