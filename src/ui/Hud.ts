import { WIRES } from "../core/layout.ts";

/**
 * DOM overlay: instruction banner, wire→terminal checklist, feedback toast,
 * and the "level complete" card.
 */
export class Hud {
  private banner: HTMLDivElement;
  private checklist: HTMLDivElement;
  private toast: HTMLDivElement;
  private overlay: HTMLDivElement;
  private rows = new Map<string, HTMLDivElement>();
  private returnBtn: HTMLButtonElement;
  private toastTimer?: number;

  onReplay?: () => void;
  onReturn?: () => void;

  constructor(root: HTMLElement) {
    this.banner = el("div", "banner");
    this.banner.textContent = "Кликните по термостату, чтобы снять его со стены";
    root.appendChild(this.banner);

    this.returnBtn = el("button", "return-btn");
    this.returnBtn.textContent = "↩ Вернуть термостат на стену";
    this.returnBtn.style.display = "none";
    this.returnBtn.addEventListener("click", () => this.onReturn?.());
    root.appendChild(this.returnBtn);

    this.checklist = el("div", "checklist");
    this.checklist.style.display = "none";
    const h = el("h3");
    h.textContent = "Подключение проводов";
    this.checklist.appendChild(h);
    for (const w of WIRES) {
      const row = el("div", "row");
      row.dataset.wire = w.id;
      const dot = el("span", "dot");
      dot.style.background = "#" + w.colorHex.toString(16).padStart(6, "0");
      const name = el("span");
      name.textContent = w.name;
      const arrow = el("span", "arrow");
      arrow.textContent = "→";
      const term = el("span");
      term.textContent = w.targetLabel;
      const state = el("span", "state");
      state.textContent = "○";
      row.append(dot, name, arrow, term, state);
      this.checklist.appendChild(row);
      this.rows.set(w.id, row);
    }
    root.appendChild(this.checklist);

    this.toast = el("div", "toast");
    root.appendChild(this.toast);

    this.overlay = el("div", "overlay");
    this.overlay.innerHTML = `
      <div class="card">
        <div class="emoji">🎉</div>
        <h2>Уровень пройден!</h2>
        <div class="sub">Термостат подключён к питанию</div>
        <div class="stats">
          ⭐⭐⭐ Отлично!<br/>
          🏆 +100 очков<br/>
          ✅ 4/4 провода подключены
        </div>
        <button id="replay">Заново ↻</button>
      </div>`;
    root.appendChild(this.overlay);
    this.overlay
      .querySelector<HTMLButtonElement>("#replay")!
      .addEventListener("click", () => this.onReplay?.());
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
    this.setBanner("Кликните по термостату, чтобы снять его со стены");
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
