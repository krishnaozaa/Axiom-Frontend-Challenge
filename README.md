# Axiom — Front End Programming Challenge

Welcome to the Axiom front end challenge.

Axiom is a real-time trading terminal. Traders watch thousands of tokens at
once, and the data behind every one of them is moving constantly — prices,
market caps, volume, all updating sub-second. Rendering that much live data
without the UI grinding to a halt is the everyday reality of building Axiom.

This challenge is a small, honest slice of that problem.

## The starting point

This repo contains a **working** React + TypeScript app: a feed of ~10,000
tokens that update live, a search box, a sort control, and a detail sidebar
that reflects the selected token in real time.

It also happens to be **slow**. Scroll it, sort it, or just let it sit and
update — you'll feel the jank immediately. That's intentional. The naive
implementation is correct but does not scale.

```bash
npm install
npm run dev
```

Open the app, scroll the list, click some rows, and watch the live updates.
Profile it. Get a feel for where the time is going before you change anything.

## Your task

**Refactor this app into an efficient, virtualized implementation — without
changing what it does.**

Everything that works today must still work when you're done:

- A list of **all** tokens that scrolls smoothly, even under live updates.
- Live data continues to update in place (no freezing the feed to make it fast).
- Clicking a row selects it and shows its detail in the sidebar; the sidebar
  keeps updating live for the selected token.
- The search box filters by name/ticker, and the sort control re-orders the
  feed.
- The responsive layout holds: sidebar to the right on desktop, below the feed
  on mobile.

How you get there is up to you. Virtualization library or hand-rolled
windowing, how you tame the update loop, how you structure state and memoize —
those are your calls to make. We care more about *why* you made them than about
which specific tool you reached for.

### Ground rules

- Stay in React + TypeScript. Keep it type-safe.
- You may add dependencies, but be deliberate about it.
- You may restructure components, data flow, and the mock data/stream layer as
  needed — just keep the behavior above intact.
- Don't fake performance by quietly dropping data (e.g. only ever keeping a few
  hundred tokens, or pausing updates while scrolling). The feed represents all
  tokens and stays live.

## What we're looking for

This is the part that matters most. We are looking for **clear, intentional
engineering** — people who take pride in their code. We are explicitly *not*
looking for a pile of generic, unexplained, AI-generated changes.

Include a short [**`DESIGN.md`**](./DESIGN.md) with your submission covering:

- How you diagnosed the bottlenecks. What was actually slow, and how did you
  confirm it?
- Your approach to virtualization and to the high-frequency update loop, and why
  you chose it over the alternatives you considered.
- The trade-offs you made and anything you deliberately left out.
- What you'd do next with more time.

A focused, well-reasoned submission with a thoughtful writeup beats a
feature-stuffed one every time.

## How we evaluate

- **Performance under load** — smooth scrolling and interaction with 10k
  live-updating rows.
- **Correctness** — all the existing behavior still works, including during
  live updates.
- **Code quality** — clear structure, readable, the kind of code you'd be happy
  to maintain.
- **The writeup** — the quality of your reasoning in `DESIGN.md`.

## Submitting

1. Fork this repository.
2. Commit your changes along with your `DESIGN.md`.
3. Send us a link to your fork.

## Project layout

```
src/
  App.tsx                  # composes the feed + sidebar, owns filter/sort/selection state
  types.ts                 # the Token data shape
  format.ts                # display formatting helpers
  data/
    generateTokens.ts      # seeds ~10k tokens
    useTokenStream.ts      # simulated live market feed
  components/
    Controls.tsx           # search + sort
    TokenList.tsx          # the feed (renders every row today)
    TokenRow.tsx           # a single row
    Sidebar.tsx            # detail panel for the selected token
```

You're free to change any of it.

## Questions & Feedback

Reach out to Som (som@axiom.trading) with any questions about the
challenge.
