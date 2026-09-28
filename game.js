// Pure game logic for Poople: word graph, validation, puzzles, scoring.
// No DOM access here so it can be tested under Node.
(function (root) {
  const TARGET = "poop";
  const MAX_MOVES = 6;
  const LAUNCH_DAY = "2026-09-28"; // Daily puzzle #1

  function makeSet(spaceSeparated) {
    return new Set(spaceSeparated.split(" "));
  }

  function createDictionary(validWords, familiarWords) {
    return { valid: makeSet(validWords), familiar: makeSet(familiarWords) };
  }

  function neighbors(word, words) {
    const out = [];
    for (let i = 0; i < word.length; i++) {
      for (let c = 97; c <= 122; c++) {
        const ch = String.fromCharCode(c);
        if (ch === word[i]) continue;
        const next = word.slice(0, i) + ch + word.slice(i + 1);
        if (words.has(next)) out.push(next);
      }
    }
    return out;
  }

  // Shortest path from `from` to TARGET through `words`, or null if none.
  function shortestPath(from, words) {
    if (from === TARGET) return [TARGET];
    const prev = new Map([[from, null]]);
    const queue = [from];
    for (let head = 0; head < queue.length; head++) {
      const word = queue[head];
      for (const next of neighbors(word, words)) {
        if (prev.has(next)) continue;
        prev.set(next, word);
        if (next === TARGET) {
          const path = [next];
          for (let w = word; w !== null; w = prev.get(w)) path.unshift(w);
          return path;
        }
        queue.push(next);
      }
    }
    return null;
  }

  // Par is the true minimum over every valid word. The solution shown to the
  // player uses familiar words when they give an equally short path.
  function solve(start, dict) {
    const best = shortestPath(start, dict.valid);
    const familiar = shortestPath(start, dict.familiar);
    const path = familiar && familiar.length === best.length ? familiar : best;
    return { par: best.length - 1, solution: path };
  }

  function letterDiff(a, b) {
    let diff = 0;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
    return diff;
  }

  // Returns null if `guess` is a legal next move, otherwise a message.
  function checkMove(guess, chain, dict) {
    const prev = chain[chain.length - 1];
    if (guess.length !== 4) return "Not enough letters";
    if (guess === prev) return "Change one letter";
    if (letterDiff(guess, prev) !== 1) return "Change exactly one letter";
    if (!dict.valid.has(guess)) return "Not in word list";
    if (chain.includes(guess)) return "Already used that word";
    return null;
  }

  // --- Dates -------------------------------------------------------------

  function dayKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function dayNumber(key) {
    const [y, m, d] = key.split("-").map(Number);
    return Math.round(Date.UTC(y, m - 1, d) / 86400000);
  }

  function addDays(key, n) {
    const date = new Date((dayNumber(key) + n) * 86400000);
    return date.toISOString().slice(0, 10);
  }

  function puzzleNumber(key) {
    return dayNumber(key) - dayNumber(LAUNCH_DAY) + 1;
  }

  function dailyStart(key, starts) {
    const n = puzzleNumber(key) - 1;
    return starts[((n % starts.length) + starts.length) % starts.length];
  }

  // --- Scoring -----------------------------------------------------------

  const RESULT_NAMES = ["Par", "Bogey", "Double Bogey", "Triple Bogey"];

  // Score bucket: 0..3 strokes over par, or "miss" for a loss.
  function scoreKey(game) {
    return game.won ? String(game.chain.length - 1 - game.par) : "miss";
  }

  function resultName(game) {
    const key = scoreKey(game);
    return key === "miss" ? "Miss" : RESULT_NAMES[Number(key)] || `+${key}`;
  }

  function emptyStats() {
    return {
      played: 0,
      wins: 0,
      streak: 0,
      maxStreak: 0,
      lastDay: null, // daily only: last day a result was recorded
      dist: { 0: 0, 1: 0, 2: 0, 3: 0, miss: 0 },
    };
  }

  // Daily streak counts consecutive days won; practice counts consecutive wins.
  function recordResult(stats, game, mode) {
    const s = JSON.parse(JSON.stringify(stats));
    s.played++;
    s.dist[scoreKey(game)] = (s.dist[scoreKey(game)] || 0) + 1;
    if (game.won) {
      s.wins++;
      const continues = mode !== "daily" || s.lastDay === addDays(game.day, -1);
      s.streak = continues ? s.streak + 1 : 1;
      s.maxStreak = Math.max(s.maxStreak, s.streak);
    } else {
      s.streak = 0;
    }
    if (mode === "daily") s.lastDay = game.day;
    return s;
  }

  // A daily streak is broken once a whole day passes without a result.
  function currentStreak(stats, mode, today) {
    if (mode !== "daily" || !stats.lastDay) return stats.streak;
    return stats.lastDay >= addDays(today, -1) ? stats.streak : 0;
  }

  function shareText(game, mode) {
    const moves = game.chain.length - 1;
    const title =
      mode === "daily" ? `Poople #${puzzleNumber(game.day)}` : "Poople (practice)";
    const score = game.won ? `${moves}/${MAX_MOVES}` : `X/${MAX_MOVES}`;
    const rows = game.chain.map((word, i) => {
      if (word === TARGET) return "💩💩💩💩";
      return [...word]
        .map((ch, j) => {
          if (i > 0 && ch !== game.chain[i - 1][j]) return "🟨";
          return ch === TARGET[j] ? "🟫" : "⬜";
        })
        .join("");
    });
    return `${title} ${score} · Par ${game.par} · ${resultName(game)}\n${rows.join("\n")}`;
  }

  const api = {
    TARGET,
    MAX_MOVES,
    LAUNCH_DAY,
    createDictionary,
    neighbors,
    shortestPath,
    solve,
    letterDiff,
    checkMove,
    dayKey,
    addDays,
    puzzleNumber,
    dailyStart,
    scoreKey,
    resultName,
    emptyStats,
    recordResult,
    currentStreak,
    shareText,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Poople = api;
})(this);
