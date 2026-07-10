# Session: landing FAQ for Gemini/AI-Overview grounding

**Branch:** docs/landing-faq
**Date:** 2026-07-10

## Prompts

1. "how to come up in gemini searches for yapui? basically I want when someone
   searches on google 'yapui' gemini ai result refrences my project"
2. "yes go" — green light for the FAQ + FAQPage schema PR.

## Steps taken

- Checked the live "yapui" SERP: the project isn't indexed yet (hours old) and
  the query is held by name-collisions (npm `yapui` React package, Urban
  Dictionary, a Peruvian festival). Compound queries ("what is yapui claude
  code") return nothing yapui-related yet.
- Explained the AI Overview mechanism (Gemini grounded on the search index;
  cites 2-4 corroborating domains; prefers question-shaped, definitional text).
- Added the FAQ section + FAQPage JSON-LD to `docs/index.html`, verified the
  render via headless Chrome and validated both JSON-LD blocks parse.
- Ran the pre-push gate and opened the PR.

## Decisions

- Five questions only, each answered in one liftable sentence — matching
  visible text and schema verbatim (Google guideline; also what grounded LLMs
  quote).
- "vs live-server" question included deliberately: it's the highest-intent
  comparison query and defines the category gap YapUI fills.
- Corroboration work (Show HN, dev.to, Reddit, YouTube demo) deliberately left
  to the owner — third-party sources are the other half of AI-answer inclusion
  and can't come from first-party pages.
