// Run with: node --test tests/
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const P = require("../game.js");

const src = fs.readFileSync(path.join(__dirname, "..", "words.js"), "utf8");
const W = new Function(src + "; return { VALID_WORDS, FAMILIAR_WORDS, START_WORDS };")();
const dict = P.createDictionary(W.VALID_WORDS, W.FAMILIAR_WORDS);

test("every start word can reach POOP within 6 moves", () => {
  assert.ok(W.START_WORDS.length > 250);
  for (const start of W.START_WORDS) {
    const { par, solution } = P.solve(start, dict);
    assert.ok(par >= 3 && par <= P.MAX_MOVES, `${start} has par ${par}`);
    assert.strictEqual(solution[0], start);
    assert.strictEqual(solution[solution.length - 1], "poop");
    assert.strictEqual(solution.length - 1, par);
    for (let i = 1; i < solution.length; i++) {
      assert.strictEqual(P.checkMove(solution[i], solution.slice(0, i), dict), null, `${start}: ${solution}`);
    }
  }
});

test("start words are distinct and valid", () => {
  assert.strictEqual(new Set(W.START_WORDS).size, W.START_WORDS.length);
  for (const w of W.START_WORDS) assert.ok(dict.valid.has(w), w);
});

test("checkMove rejects illegal moves", () => {
  assert.strictEqual(P.checkMove("coo", ["coal"], dict), "Not enough letters");
  assert.strictEqual(P.checkMove("coal", ["coal"], dict), "Change one letter");
  assert.strictEqual(P.checkMove("pool", ["coal"], dict), "Change exactly one letter");
  assert.strictEqual(P.checkMove("coaz", ["coal"], dict), "Not in word list");
  assert.strictEqual(P.checkMove("coal", ["coal", "cool"], dict), "Already used that word");
  assert.strictEqual(P.checkMove("cool", ["coal"], dict), null);
});

test("daily puzzles are deterministic and cycle through the list", () => {
  assert.strictEqual(P.puzzleNumber(P.LAUNCH_DAY), 1);
  assert.strictEqual(P.dailyStart(P.LAUNCH_DAY, W.START_WORDS), W.START_WORDS[0]);
  assert.strictEqual(P.dailyStart("2026-09-29", W.START_WORDS), W.START_WORDS[1]);
  assert.strictEqual(P.addDays("2026-03-01", -1), "2026-02-28");
  assert.strictEqual(P.addDays("2026-12-31", 1), "2027-01-01");
  const later = P.addDays(P.LAUNCH_DAY, W.START_WORDS.length);
  assert.strictEqual(P.dailyStart(later, W.START_WORDS), W.START_WORDS[0]);
});

test("scoring and streaks", () => {
  const win = (day, chain, par) => ({ day, chain, par, won: true });
  let s = P.emptyStats();
  s = P.recordResult(s, win("2026-10-01", ["coal", "cool", "pool", "poop"], 3), "daily");
  s = P.recordResult(s, win("2026-10-02", ["a", "b", "c", "d", "poop"], 3), "daily");
  assert.strictEqual(s.streak, 2);
  assert.deepStrictEqual([s.dist[0], s.dist[1]], [1, 1]);
  assert.strictEqual(P.currentStreak(s, "daily", "2026-10-03"), 2);
  assert.strictEqual(P.currentStreak(s, "daily", "2026-10-04"), 0);
  // A skipped day restarts the streak.
  s = P.recordResult(s, win("2026-10-05", ["x", "poop"], 1), "daily");
  assert.strictEqual(s.streak, 1);
  assert.strictEqual(s.maxStreak, 2);
  s = P.recordResult(s, { day: "2026-10-06", chain: ["x"], par: 3, won: false }, "daily");
  assert.deepStrictEqual([s.streak, s.played, s.wins, s.dist.miss], [0, 4, 3, 1]);

  let p = P.emptyStats();
  p = P.recordResult(p, win("2026-10-01", ["x", "poop"], 1), "practice");
  p = P.recordResult(p, win("2026-12-25", ["x", "poop"], 1), "practice");
  assert.strictEqual(p.streak, 2);
});

test("share text", () => {
  const g = { day: P.LAUNCH_DAY, chain: ["coal", "cool", "pool", "poop"], par: 3, won: true };
  assert.strictEqual(
    P.shareText(g, "daily"),
    "Poople #1 3/6 · Par 3 · Par\n⬜🟫⬜⬜\n⬜🟫🟨⬜\n🟨🟫🟫⬜\n💩💩💩💩"
  );
});
