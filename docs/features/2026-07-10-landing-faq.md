# Feature: landing-page FAQ with FAQPage schema (AI-answer grounding)

**Branch:** docs/landing-faq
**Date:** 2026-07-10

## Summary
Adds a five-question FAQ section to `docs/index.html` with matching `FAQPage`
JSON-LD, giving search engines and AI answer systems (Google AI Overviews /
Gemini, Copilot, ChatGPT browsing) definitional sentences to lift and cite.

## Motivation
AI Overviews trigger mostly on question-form queries ("what is yapui") and quote
pages whose sentences already answer the question. The landing page had
descriptive sections but no question-shaped content, and the "yapui" SERP is
currently occupied by unrelated name-collisions (an abandoned npm React package,
a dictionary entry) — definitional Q&A content is the strongest on-page signal
that this YapUI is the live, relevant entity.

## What changed
- `docs/index.html` — new FAQ section (5 Q&As: what is it, vs live-server,
  Claude Code relationship, license/cost, install) placed before the footer;
  visible text matches the JSON-LD verbatim per Google's structured-data
  guidelines; small `.faq` styles consistent with the page.
- Second JSON-LD block (`FAQPage`) alongside the existing
  `SoftwareApplication` schema; both validated as parseable JSON.

## Notes
No relay code touched. Page remains fully self-contained (no external assets).
