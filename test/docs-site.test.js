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

// Tag stripping by a character walk rather than a regex: CodeQL treats regex-based
// HTML filtering as a sanitizer bug (js/bad-tag-filter), and a loop is clearer anyway.
function stripTags(fragment, separator) {
  let out = "";
  let inTag = false;
  for (const ch of fragment) {
    if (inTag) {
      if (ch === ">") { inTag = false; out += separator; }
    } else if (ch === "<") {
      inTag = true;
    } else {
      out += ch;
    }
  }
  return out;
}
// One pass over the entities, so an "&amp;lt;" can never be unescaped twice.
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, name) => ENTITIES[name]);
const collapse = (s) => decode(s).replace(/\s+/g, " ").trim();
const visibleText = (fragment) => collapse(stripTags(fragment, " "));
const inlineText = (fragment) => collapse(stripTags(fragment, ""));
// Inner HTML of every <tag ...>...</tag> element, located with indexOf.
function innerOf(html, tag) {
  const found = [];
  let from = 0;
  for (;;) {
    const open = html.indexOf("<" + tag, from);
    if (open === -1) break;
    const gt = html.indexOf(">", open);
    const close = gt === -1 ? -1 : html.indexOf("</" + tag + ">", gt);
    if (close === -1) break;
    found.push(html.slice(gt + 1, close));
    from = close + tag.length + 3;
  }
  return found;
}
const count = (html, needle) => html.split(needle).length - 1;

test("h1 and content live inside <main>", () => {
  const mains = innerOf(HTML, "main");
  assert.equal(mains.length, 1, "exactly one <main>");
  assert.equal(count(HTML, "<h1"), 1, "exactly one <h1>");
  assert.equal(count(mains[0], "<h1"), 1, "the <h1> must be inside <main>");
  assert.ok(visibleText(mains[0]).length >= 500, "500+ chars of text inside <main>");
});

test("head advertises the Markdown twin and llms.txt", () => {
  assert.ok(HTML.includes(`<link rel="alternate" type="text/markdown" href="/${SLUG}/index.md"`));
  assert.ok(HTML.includes('<link rel="describedby" href="/llms.txt">'));
  assert.ok(HTML.includes('href="https://tatendaz.github.io/llms.txt"'));
});

test("Markdown twin mirrors the page", () => {
  assert.ok(MD.startsWith("# "), "twin must start with an H1");
  const h1 = inlineText(innerOf(HTML, "h1")[0]);
  assert.equal(MD.split("\n")[0].slice(2).trim(), h1);
  for (const h2 of innerOf(HTML, "h2")) {
    const heading = "## " + inlineText(h2);
    assert.ok(MD.includes(heading), `twin is missing "${heading}"`);
  }
  assert.ok(MD.length >= 500);
  assert.ok(MD.includes(`HTML version: https://tatendaz.github.io/${SLUG}/`));
  assert.ok(MD.includes("https://tatendaz.github.io/llms.txt"));
  for (const tag of ["<div", "<span", "<script", "<style"]) {
    assert.ok(!MD.includes(tag), `twin must be plain Markdown (found ${tag})`);
  }
});
