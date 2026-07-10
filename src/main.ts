import { Game } from "./core/Game.ts";
import {
  getInitialLang,
  getLang,
  initLocaleBridge,
  onChange,
  setLang,
  t,
} from "./core/i18n.ts";

// Determine locale from ?lang BEFORE building the scene (works on first paint),
// then listen for live `set-locale` messages from the trusted parent platform.
setLang(getInitialLang());
initLocaleBridge();

const applyDocumentChrome = () => {
  document.title = t("ui.docTitle");
  document.documentElement.lang = getLang();
};
applyDocumentChrome();
onChange(applyDocumentChrome);

const app = document.getElementById("app")!;

const loader = document.createElement("div");
loader.className = "loader";
loader.textContent = t("ui.loading");
app.appendChild(loader);
onChange(() => {
  if (loader.isConnected) loader.textContent = t("ui.loading");
});

const game = new Game(app);
game
  .start()
  .then(() => loader.remove())
  .catch((err) => {
    console.error(err);
    loader.textContent = t("ui.loadError", { message: err.message });
  });
