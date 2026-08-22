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

// Tags are removed by a character walk rather than a regex: CodeQL treats regex-based
// HTML filtering as a sanitizer bug (js/bad-tag-filter), and a loop is clearer anyway.
// A <br> becomes a space; every other tag vanishes.
function stripTags(fragment) {
  let out = "";
  let tag = null;
  for (const ch of fragment) {
    if (tag !== null) {
      if (ch === ">") {
        if (tag.toLowerCase().startsWith("br")) out += " ";
        tag = null;
      } else {
        tag += ch;
      }
    } else if (ch === "<") {
      tag = "";
    } else {
      out += ch;
    }
  }
  return out;
}
// One pass over the entities, so an "&amp;lt;" can never be unescaped twice.
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", nbsp: " " };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m, name) => ENTITIES[name]);
// Collapse whitespace and drop the characters Markdown adds for emphasis/code.
const squash = (s) => s.replace(/[*`\\]/g, "").replace(/\s+/g, " ").trim();
const blockText = (fragment) => squash(decode(stripTags(fragment)));
// Inner HTML of every <tag ...>...</tag> element, located with indexOf (tag name must end there).
function innerOf(html, tag) {
  const found = [];
  let from = 0;
  for (;;) {
    const open = html.indexOf("<" + tag, from);
    if (open === -1) break;
    const next = html[open + tag.length + 1];
    const gt = html.indexOf(">", open);
    const close = gt === -1 ? -1 : html.indexOf("</" + tag + ">", gt);
    if (close === -1) break;
    if (next === ">" || next === " " || next === "\n") found.push(html.slice(gt + 1, close));
    from = close + tag.length + 3;
  }
  return found;
}
function section(tag) {
  const found = innerOf(HTML, tag);
  assert.equal(found.length, 1, `expected exactly one <${tag}>`);
  return found[0];
}
const count = (html, needle) => html.split(needle).length - 1;
// The Markdown twin as plain text: no code blocks, links and images reduced to their text.
const twinPlain = (md) => squash(
  md.replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^>\s?/gm, ""),
);

test("h1 and content live inside <main>", () => {
  const main = section("main");
  assert.equal(count(HTML, "<h1"), 1, "exactly one <h1>");
  assert.equal(count(main, "<h1"), 1, "the <h1> must be inside <main>");
  assert.ok(blockText(main).length >= 500, "500+ chars of text inside <main>");
});

test("head advertises the Markdown twin and llms.txt", () => {
  const head = section("head");
  assert.ok(head.includes(`<link rel="alternate" type="text/markdown" href="/${SLUG}/index.md"`));
  assert.ok(head.includes('<link rel="describedby" href="/llms.txt">'));
  assert.ok(section("footer").includes('href="https://tatendaz.github.io/llms.txt"'));
});

test("Markdown twin mirrors the page", () => {
  assert.ok(MD.startsWith("# "), "twin must start with an H1");
  assert.equal(MD.split("\n")[0].slice(2).trim(), blockText(section("h1")));
  for (const h2 of innerOf(HTML, "h2")) {
    const heading = "## " + blockText(h2);
    assert.ok(MD.includes(heading), `twin is missing "${heading}"`);
  }
  assert.ok(MD.includes(`HTML version: https://tatendaz.github.io/${SLUG}/`));
  assert.ok(MD.includes("https://tatendaz.github.io/llms.txt"));
  for (const tag of ["<div", "<span", "<script", "<style"]) {
    assert.ok(!MD.includes(tag), `twin must be plain Markdown (found ${tag})`);
  }
});

test("Markdown twin carries every paragraph and list item", () => {
  const main = section("main");
  const blocks = [...innerOf(main, "p"), ...innerOf(main, "li")].map(blockText).filter(Boolean);
  assert.ok(blocks.length >= 10, "expected 10+ text blocks inside <main>");
  const plain = twinPlain(MD);
  for (const block of blocks) {
    assert.ok(plain.includes(block), `twin is missing the text: ${block.slice(0, 80)}`);
  }
});
