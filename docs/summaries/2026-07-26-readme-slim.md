# Session: review PR #6, then slim the README

**Branch:** docs/readme-slim
**Date:** 2026-07-26

## Prompts

1. "https://github.com/Tatendaz/yapui/pull/6 Can you run review of this PR. ANd
   additionally can you go through the read me to make sure its updated and no stale info
   and rework the readme itself The main goal is that someone reading the README should be
   able to tell what Yap UI is and be able to install it, either by themselves or using
   agents. Anything else that is not necessary in the README should be moved to another
   folder, or a folder should be created and then linked to in the README. We want to have
   a small README so that someone can quickly go through it and have an idea of what it is
   and how to install it within 15 to 20 seconds. Then, just add all of that in PR 6."

## Steps taken

- Pulled PR #6 and re-verified every factual claim in it against the relay source rather
  than taking the PR description at its word. The privacy rewrite checked out exactly:
  `relay/agent.js` `boot()` spawns the CLI, `itemMd()` really does pipe the picked
  element, cursor trail and spoken timeline plus screenshot and frame-sheet paths;
  `relay/server.js` really does cap clips at 200 MB; `widget.js` really does start the
  panel expanded (`var startOpen = true`) and really does still say "Lands in your
  terminal session" in the footer.
- Checked the install claims against the Claude Code docs, which is where the PR turned
  out to be wrong — see Decisions.
- Confirmed the skills.sh scope claim (`add` defaults to project, `-g` for global,
  `update`/`remove` need the same flag) against the vercel-labs/skills README.
- Ran `coderabbit review --agent --base main`. Three findings; two applied, one deferred.
- Wrote `docs/guide/{install,how-it-works,configuration,troubleshooting,privacy}.md`,
  rewrote the README around them, and validated links, anchors, JSON-LD and the
  visible-vs-schema FAQ match by script.
- Full suite green (29/29) before pushing.

## Decisions

- **Corrected the correction.** PR #6 replaced "Claude Code picks up new skills live" with
  "loads on the next session — not live." The docs say skill directories are watched and
  adding a skill takes effect in the current session; the *plugin* registration is what
  waits. Since YapUI ships only a skill, the original claim was closer to true than its
  replacement. The README now states the exception ("Not there? `/reload-plugins`, or
  restart once") rather than either absolute, because that sentence is right for all four
  routes and costs one line.
- **Split by audience, not by topic.** The README answers "what is this and how do I get
  it"; `docs/guide/` answers "I have it, now what". That is why `Tests` left the README
  even though it was only four lines — `CONTRIBUTING.md` already covers `npm test`, and a
  reader deciding whether to install doesn't run the suite first.
- **Kept install in the README** rather than linking out to it. The stated goal was that a
  reader could install unaided within twenty seconds, and a link is a round trip.
- **Landing-page FAQ gained a sixth question** instead of trimming the fifth. CodeRabbit
  flagged that "Is YapUI free?" never mentions the Claude usage being billed to your own
  account — true, and the answer had drifted into privacy content that belonged under its
  own question. Splitting them keeps each answer short enough to be lifted whole by an AI
  answer engine, which is the reason the FAQ exists.
- **Left `.github/CODEOWNERS` alone.** CodeRabbit is right that one code owner makes the
  required code-owner review unsatisfiable for @Tatendaz's own PRs, but that file came in
  with #7 and is already on `main`; folding an unrelated governance fix into a README PR
  is the grab-bag `CONTRIBUTING.md` warns against.
- **Did not touch `relay/widget.js`.** Its footer still contradicts the README's "you
  never go back to the terminal", and it is visible in every frame of the hero GIF. Still
  out of scope, still needs a re-record — carried forward from the original PR body rather
  than quietly dropped.
