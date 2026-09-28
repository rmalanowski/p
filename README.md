# Poople 💩

A Wordle-style word ladder game. You get a random four-letter word and have to turn it into **POOP**
by changing one letter at a time. Every step has to be a real English word, and you have 6 moves.

## Features

- **Daily puzzle.** Everyone gets the same puzzle each day (resets at local midnight), and your streak counts consecutive days solved.
- **Practice mode.** Unlimited random puzzles, with a streak that counts consecutive wins.
- **Golf scoring.** Every puzzle has a par, which is the fewest moves possible. Results are Par, Bogey, Double Bogey, Triple Bogey or Miss.
- **Stats and history** are saved in `localStorage` and kept separately for each mode, along with your recent games.
- **Shareable emoji results** and the best path shown after every game.
- Works with the on-screen or a physical keyboard, adapts to light and dark mode, and needs no dependencies.

## Guaranteed solvable

The starting words are common English words. Each one has a shortest path to POOP of 3–6 moves that
uses only familiar words. `tests/game.test.js` checks every starting word.

Moves are checked against the ENABLE dictionary (every 4-letter word, with slurs removed), so obscure
but real words are accepted.

## Running locally

Open `index.html` in a browser. There's no build step.

```sh
node --test tests/*.test.js   # run the tests
```

## Regenerating the word lists

`words.js` is generated. To regenerate it, download the two source lists named at the top of
`tools/build_words.py` into a working directory, then run the script from that directory and copy the
resulting `words.js` into the repo root.

## Deploying

`.github/workflows/pages.yml` runs the tests and publishes the site to GitHub Pages on every push to
`main`. To turn it on, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
