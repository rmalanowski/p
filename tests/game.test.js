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

test("scoring and streaks", () => {
  const win = (chain, par) => ({ chain, par, won: true });
  let s = P.emptyStats();
  s = P.recordResult(s, win(["coal", "cool", "pool", "poop"], 3));
  s = P.recordResult(s, win(["a", "b", "c", "d", "poop"], 3));
  assert.deepStrictEqual([s.streak, s.maxStreak, s.dist[0], s.dist[1]], [2, 2, 1, 1]);
  s = P.recordResult(s, { chain: ["x"], par: 3, won: false });
  assert.deepStrictEqual([s.streak, s.maxStreak, s.played, s.wins, s.dist.miss], [0, 2, 3, 2, 1]);
  s = P.recordResult(s, win(["x", "poop"], 1));
  assert.deepStrictEqual([s.streak, s.maxStreak], [1, 2]);
  assert.strictEqual(P.resultName({ chain: ["x"], par: 3, won: false }), "Miss");
  assert.strictEqual(P.resultName(win(["a", "b", "c", "d", "e", "poop"], 3)), "Double Bogey");
});

test("share text", () => {
  const g = { start: "coal", chain: ["coal", "cool", "pool", "poop"], par: 3, won: true };
  assert.strictEqual(
    P.shareText(g),
    "Poople: COAL 3/6 · Par 3 · Par\n⬜🟫⬜⬜\n⬜🟫🟨⬜\n🟨🟫🟫⬜\n💩💩💩💩"
  );
});
