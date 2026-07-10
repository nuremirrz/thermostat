/**
 * Tiny i18n layer for the thermostat sim.
 *
 * - Locale comes from the parent platform two ways: the `?lang=` URL param
 *   (first paint, pre-JS) and a `postMessage({type:'set-locale', locale})`.
 * - Supported locales: en / ru / es. Default is `en` (not Russian).
 * - No hardcoded user-facing strings live outside this dictionary; Russian is
 *   just one branch equal to en/es.
 *
 * Only text codes that are physical hardware markings stay untranslated and are
 * NOT in here: terminal designations (S Y G W R Rc …) and the faceplate
 * silkscreen ("U & R WIRES", "1 WIRE", "2 WIRES").
 */

export const SUPPORTED = ["en", "ru", "es"] as const;
export type Lang = (typeof SUPPORTED)[number];
export const DEFAULT: Lang = "en";

/** Coerce anything into a supported locale, falling back to the default. */
export function normalize(l: string | null | undefined): Lang {
  return SUPPORTED.includes(l as Lang) ? (l as Lang) : DEFAULT;
}

type Entry = string | ((p: Record<string, string>) => string);
type Table = Record<string, Entry>;

const dict: Record<Lang, Table> = {
  en: {
    "ui.docTitle": "Thermostat Wiring Simulation",
    "ui.loading": "Loading scene…",
    "ui.loadError": (p) => `Loading error: ${p.message}`,

    "hud.checklistTitle": "Wiring",
    "hud.returnBtn": "Put thermostat back",

    "overlay.title": "Level complete!",
    "overlay.sub": "Thermostat connected to power",
    "overlay.rating": "Perfect!",
    "overlay.points": "+100 points",
    "overlay.wiresDone": "4/4 wires connected",
    "overlay.replay": "Restart",

    "wires.green": "Green",
    "wires.yellow": "Yellow",
    "wires.white": "White",
    "wires.red": "Red",

    "banner.takeOff": "Click the thermostat to take it off the wall",
    "banner.takeOffAgain": "Click the thermostat to take it off the wall again",
    "banner.removing": "Taking the thermostat off…",
    "banner.returning": "Putting the thermostat back…",
    "banner.wiringOpenHint":
      "Pick a wire and click a terminal — or put the thermostat back",
    "banner.selectWire": "Pick a wire, then click the right terminal",
    "banner.selectedWire": (p) =>
      `${p.name} wire — connect it to terminal ${p.label}`,
    "banner.allConnected": "All wires connected — power is on ✅",

    "toast.selectFirst": "Select a wire first",
    "toast.wrongTerminal": (p) =>
      `Terminal ${p.got} is wrong. You need ${p.need}`,
    "toast.connected": (p) => `✓ ${p.name} → ${p.label}`,
  },

  ru: {
    "ui.docTitle": "Симулятор подключения термостата",
    "ui.loading": "Загрузка сцены…",
    "ui.loadError": (p) => `Ошибка загрузки: ${p.message}`,

    "hud.checklistTitle": "Подключение проводов",
    "hud.returnBtn": "Вернуть термостат на стену",

    "overlay.title": "Уровень пройден!",
    "overlay.sub": "Термостат подключён к питанию",
    "overlay.rating": "Отлично!",
    "overlay.points": "+100 очков",
    "overlay.wiresDone": "4/4 провода подключены",
    "overlay.replay": "Заново",

    "wires.green": "Зелёный",
    "wires.yellow": "Жёлтый",
    "wires.white": "Белый",
    "wires.red": "Красный",

    "banner.takeOff": "Кликните по термостату, чтобы снять его со стены",
    "banner.takeOffAgain":
      "Кликните по термостату, чтобы снова снять его со стены",
    "banner.removing": "Снимаем термостат…",
    "banner.returning": "Возвращаем термостат…",
    "banner.wiringOpenHint":
      "Выберите провод и кликните по клемме — либо верните термостат на стену",
    "banner.selectWire": "Выберите провод, затем кликните по нужной клемме",
    "banner.selectedWire": (p) =>
      `Провод «${p.name}» — подключите к клемме «${p.label}»`,
    "banner.allConnected": "Все провода подключены — питание подаётся ✅",

    "toast.selectFirst": "Сначала выберите провод",
    "toast.wrongTerminal": (p) =>
      `Клемма «${p.got}» — не та. Нужна «${p.need}»`,
    "toast.connected": (p) => `✓ ${p.name} → ${p.label}`,
  },

  es: {
    "ui.docTitle": "Simulación de conexión del termostato",
    "ui.loading": "Cargando escena…",
    "ui.loadError": (p) => `Error de carga: ${p.message}`,

    "hud.checklistTitle": "Conexión de cables",
    "hud.returnBtn": "Volver a colocar el termostato",

    "overlay.title": "¡Nivel completado!",
    "overlay.sub": "Termostato conectado a la corriente",
    "overlay.rating": "¡Perfecto!",
    "overlay.points": "+100 puntos",
    "overlay.wiresDone": "4/4 cables conectados",
    "overlay.replay": "Reiniciar",

    "wires.green": "Verde",
    "wires.yellow": "Amarillo",
    "wires.white": "Blanco",
    "wires.red": "Rojo",

    "banner.takeOff": "Haz clic en el termostato para retirarlo de la pared",
    "banner.takeOffAgain":
      "Haz clic en el termostato para retirarlo de la pared de nuevo",
    "banner.removing": "Retirando el termostato…",
    "banner.returning": "Volviendo a colocar el termostato…",
    "banner.wiringOpenHint":
      "Elige un cable y haz clic en un borne, o vuelve a colocar el termostato",
    "banner.selectWire": "Elige un cable y luego haz clic en el borne correcto",
    "banner.selectedWire": (p) =>
      `Cable «${p.name}»: conéctalo al borne ${p.label}`,
    "banner.allConnected": "Todos los cables conectados: hay corriente ✅",

    "toast.selectFirst": "Primero elige un cable",
    "toast.wrongTerminal": (p) =>
      `El borne ${p.got} no es correcto. Necesitas ${p.need}`,
    "toast.connected": (p) => `✓ ${p.name} → ${p.label}`,
  },
};

let current: Lang = DEFAULT;
const listeners = new Set<() => void>();

/** Current active locale. */
export function getLang(): Lang {
  return current;
}

/** Translate a dictionary key; template entries take interpolation params. */
export function t(key: string, params: Record<string, string> = {}): string {
  const entry = dict[current][key] ?? dict[DEFAULT][key];
  if (entry === undefined) return key; // last-resort: show the key itself
  return typeof entry === "function" ? entry(params) : entry;
}

/** Set the active locale and notify subscribers if it actually changed. */
export function setLang(lang: Lang): void {
  const next = normalize(lang);
  if (next === current) return;
  current = next;
  for (const cb of listeners) cb();
}

/** Subscribe to locale changes; returns an unsubscribe function. */
export function onChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Locale requested via the `?lang=` URL param (or the default). */
export function getInitialLang(): Lang {
  return normalize(new URLSearchParams(location.search).get("lang"));
}

/** Whether a postMessage origin is an allowed parent (platform host). */
export function isTrustedParent(origin: string): boolean {
  return (
    origin === "https://tradescamp.io" ||
    origin === "https://www.tradescamp.io" ||
    /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/i.test(origin) ||
    /^http:\/\/localhost(:\d+)?$/i.test(origin) ||
    /^http:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin)
  );
}

/** Listen for `{type:'set-locale', locale}` from a trusted parent window. */
export function initLocaleBridge(): void {
  window.addEventListener("message", (e: MessageEvent) => {
    if (!isTrustedParent(e.origin)) return;
    const data = e.data;
    if (data && data.type === "set-locale") setLang(normalize(data.locale));
  });
}
