// Downloads word lists once and writes them to src/words/data/.
// Run with: node scripts/build-words.mjs   (needs Node 18+)
import { mkdir, writeFile } from "node:fs/promises";

const LENGTHS = [4, 5, 6, 7]; // keep in sync with MIN/MAX_WORD_LENGTH in config.ts
const OUT = "src/words/data";

const GH = "https://raw.githubusercontent.com";
const URLS = {
    enCommon: `${GH}/first20hours/google-10000-english/master/google-10000-english-no-swears.txt`,
    enDict: `${GH}/dwyl/english-words/master/words_alpha.txt`,
    enHunspell: `${GH}/LibreOffice/dictionaries/master/en/en_US.dic`,
    afFreq: `${GH}/hermitdave/FrequencyWords/master/content/2018/af/af_full.txt`,
    afDic: `${GH}/LibreOffice/dictionaries/master/af_ZA/af_ZA.dic`,
};

// Extra words you never want as a secret word (abbreviations, slang, etc).
const BLOCK = new Set(["ctrl", "intl", "bool", "gotta", "univ", "docs"]);

// Strip diacritics and lowercase: "môre" -> "more".
const norm = (w) => w.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const isWord = (w) => /^[a-z]+$/.test(w) && LENGTHS.includes(w.length);
const lines = (text) => text.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

async function get(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status} ${url}`);
    return res.text();
}

async function save(name, words) {
    const sorted = [...new Set(words)].sort();
    await writeFile(`${OUT}/${name}.txt`, sorted.join("\n"));
    console.log(`${name}: ${sorted.length} words`);
}

await mkdir(OUT, { recursive: true });

// ---------- English ----------
const enDict = lines(await get(URLS.enDict)).map(norm).filter(isWord);
const enDictSet = new Set(enDict);

// Proper nouns (names, countries, cities, brands) must not be secret words.
// In the hunspell dictionary they are capitalised ("Todd", "Boston") while ordinary
// words are lowercase. A word counts as a proper noun when its capitalised form
// exists but no lowercase form does. For plurals we also check the singular, so
// "banks" survives because "bank" is a lowercase word.
const enRoots = lines(await get(URLS.enHunspell))
    .slice(1) // first line is a count
    .map((l) => l.split("/")[0]);
const enLower = new Set(enRoots.filter((w) => w === w.toLowerCase()));
const hasLowerForm = (w) =>
    enLower.has(w) ||
    (w.endsWith("s") && enLower.has(w.slice(0, -1))) ||
    (w.endsWith("es") && enLower.has(w.slice(0, -2)));
const enProper = new Set(
    enRoots
        .filter((w) => /^[A-Z][a-z]+$/.test(w))
        .map((w) => w.toLowerCase())
        .filter((w) => !hasLowerForm(w)),
);

const enCandidates = lines(await get(URLS.enCommon))
    .map(norm)
    .filter((w) => isWord(w) && enDictSet.has(w) && !BLOCK.has(w));
const enAnswers = enCandidates.filter((w) => !enProper.has(w));
console.log(`English: dropped ${enCandidates.length - enAnswers.length} proper nouns from answers`);

await save("en-answers", enAnswers);
await save("en-allowed", enDict); // guesses stay generous, only secret words are filtered

// ---------- Afrikaans ----------
// Hunspell .dic lines look like "magasyn/E": the part before "/" is the root word.
// Lowercase-only roots skips proper nouns (Galilea, Furse, ...).
const afRoots = new Set(
    lines(await get(URLS.afDic))
        .slice(1) // first line is a count
        .map((l) => l.split("/")[0])
        .filter((w) => w === w.toLowerCase())
        .map(norm)
        .filter(isWord),
);

// Frequency lines look like "die 12974".
const afFreq = lines(await get(URLS.afFreq)).map((l) => {
    const [word, count] = l.split(" ");
    return { word: norm(word), count: Number(count) };
});

const afAnswers = afFreq
    .filter((f) => f.count >= 3 && isWord(f.word) && afRoots.has(f.word) && !BLOCK.has(f.word))
    .map((f) => f.word);
const afAllowed = [
    ...afRoots,
    ...afFreq.filter((f) => f.count >= 2 && isWord(f.word)).map((f) => f.word),
];

await save("af-answers", afAnswers);
await save("af-allowed", afAllowed);
