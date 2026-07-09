# Feature: Google Search Console verification tag

**Branch:** docs/gsc-verification
**Date:** 2026-07-10

## Summary
Replaces the placeholder comment in `docs/index.html` with the real
`google-site-verification` meta tag for the `https://tatendaz.github.io/yapui/`
URL-prefix property.

## Motivation
Verifying the Pages site in Search Console is the only way to "submit yapui to
Google": it unlocks URL Inspection → Request indexing and search analytics for
the landing page. The tag is public by design (visible in the page source of
every verified site) — it grants nothing beyond proving site control to the
Google account that generated it.

## What changed
- `docs/index.html` — placeholder comment swapped for the live meta tag.

## Notes
After merge and Pages redeploy: verify the tag serves, then the owner clicks
Verify in Search Console and requests indexing. Bing Webmaster Tools can then
import the verified property from Search Console.
