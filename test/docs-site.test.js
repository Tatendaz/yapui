// Checks that the GitHub Pages landing page (docs/index.html) stays agent-readable:
// the text and <h1> sit inside <main>, and the Markdown twin that
// <link rel="alternate" type="text/markdown"> points at mirrors the page.
// Run with: npm test (node --test test/docs-site.test.js)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const SLUG = "yapui";
const HTML = fs.readFileSync(path.join(ROOT, "docs", "index.html"), "utf8");
const MD = fs.readFileSync(path.join(ROOT, "docs", "index.md"), "utf8");

const decode = (s) => s
  .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
const visibleText = (f) => decode(
  f.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "").replace(/<[^>]+>/g, " "),
).replace(/\s+/g, " ").trim();
const inlineText = (f) => decode(f.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();

test("h1 and content live inside <main>", () => {
  const mains = [...HTML.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main>/gi)];
  assert.equal(mains.length, 1, "exactly one <main>");
  assert.equal((HTML.match(/<h1\b/gi) || []).length, 1, "exactly one <h1>");
  assert.equal((mains[0][1].match(/<h1\b/gi) || []).length, 1, "the <h1> must be inside <main>");
  assert.ok(visibleText(mains[0][1]).length >= 500, "500+ chars of text inside <main>");
});

test("head advertises the Markdown twin and llms.txt", () => {
  assert.ok(HTML.includes(`<link rel="alternate" type="text/markdown" href="/${SLUG}/index.md"`));
  assert.ok(HTML.includes('<link rel="describedby" href="/llms.txt">'));
  assert.ok(HTML.includes('href="https://tatendaz.github.io/llms.txt"'));
});

test("Markdown twin mirrors the page", () => {
  assert.ok(MD.startsWith("# "), "twin must start with an H1");
  const h1 = inlineText(HTML.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)[1]);
  assert.equal(MD.split("\n")[0].slice(2).trim(), h1);
  for (const m of HTML.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)) {
    assert.ok(MD.includes("## " + inlineText(m[1])), `twin is missing "## ${inlineText(m[1])}"`);
  }
  assert.ok(MD.length >= 500);
  assert.ok(MD.includes(`HTML version: https://tatendaz.github.io/${SLUG}/`));
  assert.ok(MD.includes("https://tatendaz.github.io/llms.txt"));
  assert.ok(!/<(div|span|script|style)\b/.test(MD), "twin must be plain Markdown");
});
