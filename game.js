// Pure game logic for Poople: word graph, validation, puzzles, scoring.
// No DOM access here so it can be tested under Node.
(function (root) {
  const TARGET = "poop";
  const MAX_MOVES = 6;

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
      dist: { 0: 0, 1: 0, 2: 0, 3: 0, miss: 0 },
    };
  }

  // The streak counts consecutive wins.
  function recordResult(stats, game) {
    const s = JSON.parse(JSON.stringify(stats));
    s.played++;
    s.dist[scoreKey(game)] = (s.dist[scoreKey(game)] || 0) + 1;
    if (game.won) {
      s.wins++;
      s.streak++;
      s.maxStreak = Math.max(s.maxStreak, s.streak);
    } else {
      s.streak = 0;
    }
    return s;
  }

  function shareText(game) {
    const moves = game.chain.length - 1;
    const title = `Poople: ${game.start.toUpperCase()}`;
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
    createDictionary,
    neighbors,
    shortestPath,
    solve,
    letterDiff,
    checkMove,
    dayKey,
    scoreKey,
    resultName,
    emptyStats,
    recordResult,
    shareText,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Poople = api;
})(this);
