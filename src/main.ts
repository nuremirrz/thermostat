import { Game } from "./core/Game.ts";

const app = document.getElementById("app")!;

const loader = document.createElement("div");
loader.className = "loader";
loader.textContent = "Загрузка сцены…";
app.appendChild(loader);

const game = new Game(app);
game
  .start()
  .then(() => loader.remove())
  .catch((err) => {
    console.error(err);
    loader.textContent = "Ошибка загрузки: " + err.message;
  });
