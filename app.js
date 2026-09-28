// Poople UI: rendering, input, persistence.
(function () {
  const P = window.Poople;
  const dict = P.createDictionary(VALID_WORDS, FAMILIAR_WORDS);
  const STORAGE_KEY = "poople:v1";
  const HISTORY_LIMIT = 100;

  const $ = (id) => document.getElementById(id);
  const board = $("board");
  const keyboard = $("keyboard");
  const statsDialog = $("stats-dialog");
  const helpDialog = $("help-dialog");

  let state = loadState();
  let current = ""; // letters typed on the active row
  let busy = false; // true while a reveal animation is running
  let giveUpTimer = null; // set while "I suck" is waiting for a second tap

  // --- Persistence -------------------------------------------------------

  function defaultState() {
    return { seenHelp: false, game: null, stats: P.emptyStats(), history: [] };
  }

  // Earlier versions kept separate daily and practice slots. Fold them into one.
  function migrate(saved) {
    if (!saved.daily && !saved.practice) return saved;
    const stats = P.emptyStats();
    for (const old of [saved.daily, saved.practice]) {
      if (!old || !old.stats) continue;
      stats.played += old.stats.played || 0;
      stats.wins += old.stats.wins || 0;
      stats.maxStreak = Math.max(stats.maxStreak, old.stats.maxStreak || 0);
      for (const k of Object.keys(stats.dist)) stats.dist[k] += (old.stats.dist || {})[k] || 0;
    }
    stats.streak = (saved.practice && saved.practice.stats && saved.practice.stats.streak) || 0;
    const inProgress = [saved.practice, saved.daily].find((o) => o && o.game && o.game.status === "playing");
    return {
      seenHelp: saved.seenHelp,
      game: inProgress ? inProgress.game : null,
      stats,
      history: saved.history || [],
    };
  }

  function loadState() {
    const base = defaultState();
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved && typeof saved === "object") {
        const migrated = migrate(saved);
        return { ...base, ...migrated, stats: { ...base.stats, ...migrated.stats } };
      }
    } catch (e) {
      // Storage unavailable or corrupt: start fresh.
    }
    return base;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      // Private mode or storage full: the game still works for this session.
    }
  }

  // --- Games -------------------------------------------------------------

  const today = () => P.dayKey(new Date());
  const game = () => state.game;

  function newGame(start) {
    const { par } = P.solve(start, dict);
    return { day: today(), start, par, chain: [start], status: "playing" };
  }

  // Pick a start word the player hasn't seen recently.
  function randomStart() {
    const recent = new Set(state.history.slice(0, START_WORDS.length - 1).map((h) => h.start));
    if (state.game) recent.add(state.game.start);
    const fresh = START_WORDS.filter((w) => !recent.has(w));
    const pool = fresh.length ? fresh : START_WORDS;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function ensureGame() {
    if (!state.game) state.game = newGame(randomStart());
    save();
  }

  // --- Rendering ---------------------------------------------------------

  function tile(letter, classes) {
    const el = document.createElement("div");
    el.className = "tile " + classes.join(" ");
    el.textContent = letter;
    return el;
  }

  function wordTiles(word, prev) {
    return [...word].map((ch, j) => {
      const classes = [ch === P.TARGET[j] ? "match" : "plain"];
      if (prev && prev[j] !== ch) classes.push("changed");
      return tile(ch, classes);
    });
  }

  function renderBoard() {
    const g = game();
    board.innerHTML = "";
    for (let i = 0; i <= P.MAX_MOVES; i++) {
      const row = document.createElement("div");
      row.className = "row";
      const step = document.createElement("span");
      step.className = "step";
      step.textContent = i === 0 ? "" : i;
      row.appendChild(step);

      if (i < g.chain.length) {
        const tiles = wordTiles(g.chain[i], g.chain[i - 1]);
        if (i === 0) tiles.forEach((t) => t.classList.add("start"));
        tiles.forEach((t) => row.appendChild(t));
      } else if (i === g.chain.length && g.status === "playing") {
        row.classList.add("active");
        const prev = g.chain[g.chain.length - 1];
        for (let j = 0; j < 4; j++) {
          row.appendChild(j < current.length ? tile(current[j], ["filled"]) : tile(prev[j], ["ghost"]));
        }
      } else {
        for (let j = 0; j < 4; j++) row.appendChild(tile("", []));
      }
      board.appendChild(row);
    }
  }

  function renderInfo() {
    const g = game();
    const moves = g.chain.length - 1;
    $("puzzle-info").innerHTML =
      `Par <strong>${g.par}</strong> · Moves <strong>${moves}/${P.MAX_MOVES}</strong>`;
    const playing = g.status === "playing";
    $("give-up-btn").hidden = !playing;
    $("result-btn").hidden = playing;
    $("new-game-btn").hidden = playing;
    disarmGiveUp();
  }

  function render() {
    renderInfo();
    renderBoard();
  }

  function buildKeyboard() {
    const rows = ["qwertyuiop", "asdfghjkl", "+zxcvbnm-"];
    rows.forEach((letters, r) => {
      const row = document.createElement("div");
      row.className = "kb-row";
      if (r === 1) row.appendChild(Object.assign(document.createElement("div"), { className: "kb-spacer" }));
      for (const ch of letters) {
        const key = document.createElement("button");
        key.className = "key";
        if (ch === "+") {
          key.textContent = "Enter";
          key.dataset.key = "Enter";
          key.classList.add("wide");
        } else if (ch === "-") {
          key.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="currentColor" d="M22 3H7c-.69 0-1.23.35-1.59.88L0 12l5.41 8.11c.36.53.9.89 1.59.89h15a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm-3 12.59L17.59 17 14 13.41 10.41 17 9 15.59 12.59 12 9 8.41 10.41 7 14 10.59 17.59 7 19 8.41 15.41 12 19 15.59z"/></svg>';
          key.setAttribute("aria-label", "Backspace");
          key.dataset.key = "Backspace";
          key.classList.add("wide");
        } else {
          key.textContent = ch;
          key.dataset.key = ch;
          if (P.TARGET.includes(ch)) key.classList.add("poop-letter");
        }
        row.appendChild(key);
      }
      if (r === 1) row.appendChild(Object.assign(document.createElement("div"), { className: "kb-spacer" }));
      keyboard.appendChild(row);
    });
  }

  // --- Feedback ----------------------------------------------------------

  function toast(message, ms = 1400, detail = "") {
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = message;
    if (detail) {
      const small = document.createElement("div");
      small.className = "toast-detail";
      small.textContent = detail;
      el.appendChild(small);
    }
    $("toasts").prepend(el);
    setTimeout(() => el.classList.add("fade"), ms);
    setTimeout(() => el.remove(), ms + 400);
  }

  function activeRow() {
    return board.querySelector(".row.active");
  }

  function shake() {
    const row = activeRow();
    if (!row) return;
    row.classList.remove("shake");
    void row.offsetWidth; // restart the animation
    row.classList.add("shake");
  }

  function poopRain() {
    const rain = $("rain");
    for (let i = 0; i < 40; i++) {
      const s = document.createElement("span");
      s.textContent = "💩";
      s.style.left = Math.random() * 100 + "vw";
      s.style.fontSize = 18 + Math.random() * 26 + "px";
      s.style.animationDuration = 1.8 + Math.random() * 2 + "s";
      s.style.animationDelay = Math.random() * 0.8 + "s";
      rain.appendChild(s);
    }
    setTimeout(() => (rain.innerHTML = ""), 5000);
  }

  // --- Input -------------------------------------------------------------

  function press(key) {
    const g = game();
    if (busy || g.status !== "playing") return;
    if (key === "Enter") return submit();
    if (key === "Backspace") {
      current = current.slice(0, -1);
    } else if (/^[a-z]$/.test(key) && current.length < 4) {
      current += key;
    } else {
      return;
    }
    renderBoard();
    // The fourth letter submits the move; Enter re-submits after a rejection.
    if (current.length === 4) submit();
  }

  function submit() {
    const g = game();
    const error = P.checkMove(current, g.chain, dict);
    if (error) {
      toast(error);
      shake();
      return;
    }

    g.chain.push(current);
    const moves = g.chain.length - 1;
    if (current === P.TARGET) g.status = "won";
    else if (moves >= P.MAX_MOVES) g.status = "lost";
    current = "";

    if (g.status !== "playing") recordFinish(g);
    save();

    render();
    const row = board.children[moves];
    row.classList.add("reveal");
    busy = true;
    setTimeout(() => {
      busy = false;
      if (g.status === "won") celebrate(row, g);
      else if (g.status === "lost") {
        toast("Out of moves!", 2000);
        setTimeout(openStats, 1600);
      }
    }, 750);
  }

  function recordFinish(g) {
    g.won = g.status === "won";
    state.stats = P.recordResult(state.stats, g);
    state.history.unshift({
      day: g.day,
      start: g.start,
      par: g.par,
      moves: g.chain.length - 1,
      won: g.won,
      gaveUp: Boolean(g.gaveUp),
      chain: g.chain.slice(),
    });
    state.history = state.history.slice(0, HISTORY_LIMIT);
  }

  function celebrate(row, g) {
    row.classList.add("win");
    poopRain();
    const praise = { Par: "Par! Perfect poop 🏆", Bogey: "Bogey! Nice.", "Double Bogey": "Made it!" };
    toast(praise[P.resultName(g)] || "Phew! Poop achieved.", 2000);
    setTimeout(openStats, 2200);
  }

  // --- Giving up ---------------------------------------------------------

  function disarmGiveUp() {
    clearTimeout(giveUpTimer);
    giveUpTimer = null;
    const btn = $("give-up-btn");
    btn.textContent = "I suck";
    btn.classList.remove("armed");
  }

  // First tap asks for confirmation; a second tap within 3s records a loss
  // and starts a new game.
  function giveUp() {
    const g = game();
    if (busy || g.status !== "playing") return;
    const btn = $("give-up-btn");
    if (!giveUpTimer) {
      btn.textContent = "Really? Tap again";
      btn.classList.add("armed");
      giveUpTimer = setTimeout(disarmGiveUp, 3000);
      return;
    }
    g.status = "lost";
    g.gaveUp = true;
    recordFinish(g);
    const { solution } = P.solve(g.start, dict);
    startNewGame();
    toast("Counted as a loss", 3500, `Best path: ${solution.join(" → ").toUpperCase()}`);
  }

  // --- Stats dialog ------------------------------------------------------

  function resultPanel() {
    const g = game();
    const panel = $("result-panel");
    panel.innerHTML = "";
    if (g.status === "playing") return;

    const { solution } = P.solve(g.start, dict);
    const moves = g.chain.length - 1;
    const wrap = document.createElement("div");
    wrap.className = "result";
    wrap.innerHTML = `
      <div class="big">${g.won ? "💩 " : ""}${P.resultName(g)}</div>
      <p class="sub">${g.won ? `Solved in ${moves} move${moves === 1 ? "" : "s"} · Par ${g.par}` : `Out of moves · Par ${g.par}`}</p>
      <div class="path">${g.chain.join(" → ")}</div>
      ${g.won && moves === g.par ? "" : `<p class="sub">Best path</p><div class="path">${solution.join(" → ")}</div>`}
    `;
    const buttons = document.createElement("div");
    buttons.className = "actions";
    buttons.style.justifyContent = "center";
    const share = Object.assign(document.createElement("button"), { className: "pill primary", textContent: "Share" });
    share.addEventListener("click", () => shareResult(g));
    buttons.appendChild(share);
    const again = Object.assign(document.createElement("button"), { className: "pill", textContent: "New game" });
    again.addEventListener("click", startNewGame);
    buttons.appendChild(again);
    wrap.appendChild(buttons);
    panel.appendChild(wrap);
  }

  function statsPanel() {
    const stats = state.stats;
    const winPct = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
    $("stat-row").innerHTML = [
      [stats.played, "Played"],
      [winPct, "Win %"],
      [stats.streak, "Win streak"],
      [stats.maxStreak, "Max streak"],
    ]
      .map(([n, l]) => `<div><div class="num">${n}</div><div class="lbl">${l}</div></div>`)
      .join("");

    const g = game();
    const currentKey = g.status === "playing" ? null : P.scoreKey(g);
    const buckets = [["0", "Par"], ["1", "Bogey"], ["2", "Double Bogey"], ["3", "Triple Bogey"], ["miss", "Miss"]];
    const max = Math.max(1, ...buckets.map(([k]) => stats.dist[k] || 0));
    $("dist").innerHTML = buckets
      .map(([k, label]) => {
        const n = stats.dist[k] || 0;
        const width = Math.max(7, (n / max) * 100);
        const cls = k === currentKey ? "dist-bar current" : "dist-bar";
        return `<div class="dist-row"><span>${label}</span><span class="${cls}" style="width:${width}%">${n}</span></div>`;
      })
      .join("");

    const recent = state.history.slice(0, 25);
    $("history").innerHTML = recent.length
      ? recent
          .map((h) => {
            const res = h.gaveUp ? "Gave up" : P.resultName({ won: h.won, chain: h.chain, par: h.par });
            return `<li><span><span class="word">${h.start}</span> · par ${h.par}</span>
              <span class="${h.won ? "" : "res-miss"}">${h.won ? `${h.moves} moves · ` : ""}${res}</span></li>`;
          })
          .join("")
      : `<li class="empty">No games yet</li>`;
  }

  function openStats() {
    resultPanel();
    statsPanel();
    if (!statsDialog.open) statsDialog.showModal();
  }

  async function shareResult(g) {
    const text = P.shareText(g) + "\n" + location.href.split("#")[0];
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied results to clipboard");
    } catch (e) {
      if (navigator.share) {
        navigator.share({ text }).catch(() => {});
      } else {
        toast("Couldn't copy results");
      }
    }
  }

  // --- Mode / lifecycle --------------------------------------------------

  function startNewGame() {
    state.game = newGame(randomStart());
    current = "";
    save();
    if (statsDialog.open) statsDialog.close();
    render();
  }

  function closeOnBackdrop(dialog) {
    dialog.addEventListener("click", (e) => {
      if (e.target === dialog || e.target.classList.contains("close")) dialog.close();
    });
  }

  function init() {
    buildKeyboard();
    ensureGame();
    render();

    keyboard.addEventListener("click", (e) => {
      const key = e.target.closest(".key");
      if (key) {
        press(key.dataset.key);
        key.blur();
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (statsDialog.open || helpDialog.open) return;
      if (e.key === "Enter" || e.key === "Backspace") {
        e.preventDefault();
        press(e.key);
      } else if (/^[a-zA-Z]$/.test(e.key)) {
        press(e.key.toLowerCase());
      }
    });


    $("help-btn").addEventListener("click", () => helpDialog.showModal());
    $("stats-btn").addEventListener("click", openStats);
    $("result-btn").addEventListener("click", openStats);
    $("new-game-btn").addEventListener("click", startNewGame);
    $("give-up-btn").addEventListener("click", giveUp);
    closeOnBackdrop(helpDialog);
    closeOnBackdrop(statsDialog);

    if (!state.seenHelp) {
      state.seenHelp = true;
      save();
      helpDialog.showModal();
    }
  }

  init();
})();
