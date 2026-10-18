import type { Game } from "../game/state";
import type { TileState } from "../types";

const ROWS = [
    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
    ["Enter", "z", "x", "c", "v", "b", "n", "m", "Backspace"],
];

const COLORS: Record<TileState, string> = {
    correct: "var(--correct)",
    present: "var(--present)",
    absent: "var(--key-absent)",
};

// One vertical stripe per board, so quordle keys show all four states.
function stripes(states: (TileState | undefined)[]): string {
    const n = states.length;
    const stops = states.map((s, i) => {
        const color = s ? COLORS[s] : "var(--key)";
        return `${color} ${(i * 100) / n}% ${((i + 1) * 100) / n}%`;
    });
    return `linear-gradient(to right, ${stops.join(", ")})`;
}

export function renderKeyboard(
    el: HTMLElement,
    game: Game,
    onKey: (key: string) => void,
): void {
    const states = game.keyStates();
    el.innerHTML = "";

    for (const keys of ROWS) {
        const row = document.createElement("div");
        row.className = "key-row";

        for (const key of keys) {
            const btn = document.createElement("button");
            btn.className = "key";
            btn.textContent = key === "Backspace" ? "⌫" : key;
            if (key.length > 1) btn.classList.add("wide");

            const s = states[key];
            if (s && s.some((x) => x !== undefined)) btn.style.background = stripes(s);

            btn.addEventListener("click", () => {
                btn.blur();
                onKey(key);
            });
            row.append(btn);
        }
        el.append(row);
    }
}
