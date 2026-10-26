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

function colorFor(state: TileState | undefined): string {
    return state ? COLORS[state] : "var(--key)";
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
            if (key.length > 1) btn.classList.add("wide");

            const label = document.createElement("span");
            label.className = "key-label";
            label.textContent = key === "Backspace" ? "⌫" : key;
            btn.append(label);

            const s = states[key];
            if (key.length === 1 && s && s.some((x) => x !== undefined)) {
                if (s.length === 1) {
                    btn.style.background = colorFor(s[0]);
                } else {
                    btn.classList.add("quadrants");
                    for (let i = 0; i < 4; i++) {
                        btn.style.setProperty(`--q${i}`, colorFor(s[i]));
                    }
                }
            }

            btn.addEventListener("click", () => {
                btn.blur();
                onKey(key);
            });
            row.append(btn);
        }
        el.append(row);
    }
}
