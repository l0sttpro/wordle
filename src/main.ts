import "./style.css";
import { DEFAULT_WORD_LENGTH } from "./config";
import { Game } from "./game/state";
import { availableLengths, getWords } from "./words";
import { renderBoards } from "./ui/board";
import { renderKeyboard } from "./ui/keyboard";
import type { GameModeName, Language, Settings } from "./types";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header>
    <h1>word<span>le</span></h1>
    <div id="controls"></div>
  </header>
  <p id="status"></p>
  <main id="boards"></main>
  <div id="keyboard"></div>
  <div id="toast"></div>
`;

const controlsEl = document.querySelector<HTMLElement>("#controls")!;
const statusEl = document.querySelector<HTMLElement>("#status")!;
const boardsEl = document.querySelector<HTMLElement>("#boards")!;
const keysEl = document.querySelector<HTMLElement>("#keyboard")!;
const toastEl = document.querySelector<HTMLElement>("#toast")!;

const settings: Settings = {
    language: "en",
    mode: "wordle",
    wordLength: DEFAULT_WORD_LENGTH,
    daily: false,
};

let game: Game;
let busy = false; // true while the tiles are flipping
let toastTimer: number | undefined;

// ---------- game lifecycle ----------

function dailySeed(): string {
    const d = new Date();
    const day = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
    return `${day}|${settings.language}|${settings.mode}|${settings.wordLength}`;
}

function newGame(): void {
    // If the chosen length has no words in this language, fall back.
    const lengths = availableLengths(settings.language);
    if (!lengths.includes(settings.wordLength)) {
        settings.wordLength = lengths.includes(DEFAULT_WORD_LENGTH)
            ? DEFAULT_WORD_LENGTH
            : lengths[0];
    }

    const pool = getWords(settings.language, settings.wordLength);
    game = new Game(settings, pool, settings.daily ? dailySeed() : undefined);
    busy = false;

    drawControls();
    drawBoards();
    drawKeys();
    drawStatus();
}

// ---------- input ----------

function handleKey(key: string): void {
    if (busy || game.status !== "playing") return;

    if (key === "Enter") {
        const result = game.submit();
        if (result === "short") return toast("Too short");
        if (result === "invalid") return toast("Not in word list");
        reveal();
        return;
    }

    if (key === "Backspace") game.removeLetter();
    else game.addLetter(key.toLowerCase());
    drawBoards();
}

function reveal(): void {
    const row = game.guesses.length - 1;
    busy = true;
    drawBoards(row);
    // Update keyboard and status only after the flip animation finishes.
    window.setTimeout(() => {
        busy = false;
        drawKeys();
        drawStatus();
    }, game.settings.wordLength * 120 + 500);
}

window.addEventListener("keydown", (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if ((e.target as HTMLElement).tagName === "SELECT") return;
    if (e.key === "Enter" || e.key === "Backspace" || /^[a-zA-Z]$/.test(e.key)) {
        e.preventDefault();
        handleKey(e.key);
    }
});

// ---------- drawing ----------

function option(value: string, label: string, selected: boolean): string {
    return `<option value="${value}"${selected ? " selected" : ""}>${label}</option>`;
}

function drawControls(): void {
    const lengths = availableLengths(settings.language);
    controlsEl.innerHTML = `
    <select id="sel-lang">
      ${option("en", "English", settings.language === "en")}
      ${option("af", "Afrikaans", settings.language === "af")}
    </select>
    <select id="sel-mode">
      ${option("wordle", "Wordle", settings.mode === "wordle")}
      ${option("quordle", "Quordle", settings.mode === "quordle")}
    </select>
    <select id="sel-len">
      ${lengths.map((n) => option(String(n), `${n} letters`, n === settings.wordLength)).join("")}
    </select>
    <select id="sel-play">
      ${option("random", "Random", !settings.daily)}
      ${option("daily", "Daily", settings.daily)}
    </select>
    <button id="btn-new">New game</button>
  `;
}

function drawBoards(revealRow = -1): void {
    renderBoards(boardsEl, game, revealRow);
}

function drawKeys(): void {
    renderKeyboard(keysEl, game, handleKey);
}

function drawStatus(): void {
    if (game.status === "won") {
        statusEl.textContent = `Solved in ${game.guesses.length} guesses`;
    } else if (game.status === "lost") {
        statusEl.textContent = `Out of guesses. Answer: ${game.targets.join(", ").toUpperCase()}`;
    } else {
        const daily = settings.daily ? " · daily" : "";
        statusEl.textContent = `${game.guesses.length} / ${game.maxGuesses} guesses${daily}`;
    }
}

function toast(message: string): void {
    toastEl.textContent = message;
    toastEl.classList.add("show");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove("show"), 1400);
}

// ---------- controls (event delegation, survives re-rendering) ----------

controlsEl.addEventListener("change", (e) => {
    const t = e.target as HTMLSelectElement;
    if (t.id === "sel-lang") settings.language = t.value as Language;
    else if (t.id === "sel-mode") settings.mode = t.value as GameModeName;
    else if (t.id === "sel-len") settings.wordLength = Number(t.value);
    else if (t.id === "sel-play") settings.daily = t.value === "daily";
    t.blur();
    newGame();
});

controlsEl.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    if (t.id === "btn-new") {
        t.blur();
        newGame();
    }
});

newGame();
