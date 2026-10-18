// Turns a string (like today's date) into a number.
function hashString(s: string): number {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

// Small seeded random number generator: same seed, same sequence.
function mulberry32(seed: number): () => number {
    let a = seed;
    return () => {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Picks `count` distinct words. With a seed the result is repeatable (daily mode).
export function pickTargets(answers: string[], count: number, seed?: string): string[] {
    const rng: () => number = seed ? mulberry32(hashString(seed)) : Math.random;
    const pool = [...answers];
    const picked: string[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const idx = Math.floor(rng() * pool.length);
        picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
}
