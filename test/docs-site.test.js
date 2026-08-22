// Checks that the GitHub Pages landing page (docs/index.html) stays agent-readable:
// the text and <h1> sit inside <main>, and the Markdown twin that
// <link rel="alternate" type="text/markdown"> points at mirrors the page.
// Also checks the custom 404 page (docs/404.html), which GitHub Pages serves with a real
// 404 status for every missing path under /yapui/: it must carry short Markdown guidance.
// Run with: npm test (node --test test/docs-site.test.js)
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");

const SLUG = "yapui";
const HTML = fs.readFileSync(path.join(ROOT, "docs", "index.html"), "utf8");
const MD = fs.readFileSync(path.join(ROOT, "docs", "index.md"), "utf8");
const NOT_FOUND = fs.readFileSync(path.join(ROOT, "docs", "404.html"), "utf8");

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
    if (next !== ">" && next !== " " && next !== "\n") {
      from = open + 1; // a longer tag name (e.g. <pre> while looking for <p>): keep scanning
      continue;
    }
    const close = gt === -1 ? -1 : html.indexOf("</" + tag + ">", gt);
    if (close === -1) break;
    found.push(html.slice(gt + 1, close));
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
// Names of every opening tag in the fragment (lower-case), found by a character walk.
function tagNames(fragment) {
  const names = [];
  let tag = null;
  for (const ch of fragment) {
    if (tag !== null) {
      if (ch === ">") {
        const name = tag.trim().split(/[\s/]/)[0].toLowerCase();
        if (name && !name.startsWith("/") && !name.startsWith("!")) names.push(name);
        tag = null;
      } else {
        tag += ch;
      }
    } else if (ch === "<") {
      tag = "";
    }
  }
  return names;
}
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
  // Boilerplate-stripping extractors drop <header>/<nav>/<aside>/<footer> elements before counting.
  const boilerplate = tagNames(main).filter((t) => ["header", "nav", "aside", "footer"].includes(t));
  assert.deepEqual(boilerplate, [], "boilerplate element(s) inside <main> would hide content from agents");
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

test("custom 404 page is a real 404 with Markdown guidance for agents", () => {
  const [title] = innerOf(NOT_FOUND, "title");
  assert.ok(title && title.includes("404"), "the title must say 404");
  assert.ok(NOT_FOUND.includes('<meta name="robots" content="noindex">'), "a 404 must not be indexed");
  for (const rel of ['rel="canonical"', 'rel="alternate"']) {
    assert.ok(!NOT_FOUND.includes(rel), `a 404 page has no ${rel} link`);
  }
  const [main] = innerOf(NOT_FOUND, "main");
  assert.ok(main, "expected a <main>");
  const boilerplate = tagNames(main).filter((t) => ["header", "nav", "aside", "footer"].includes(t));
  assert.deepEqual(boilerplate, [], "boilerplate element(s) inside <main> would hide the guidance from agents");
  assert.ok(blockText(main).length < 1500, "the 404 page should stay short");
  assert.ok(main.includes('<pre class="md"'), 'expected a <pre class="md"> Markdown block inside <main>');
  const pres = innerOf(main, "pre");
  assert.equal(pres.length, 1, "exactly one <pre> inside <main>");
  // The block as an agent reads it: entities decoded, the newline after <pre> dropped.
  const md = decode(pres[0]).trim();
  assert.ok(md.startsWith("# 404"), "the Markdown block must start with an H1 naming the 404");
  for (const needle of [
    "## Where to look next",
    "- [Site map](https://tatendaz.github.io/sitemap.xml)",
    "- [llms.txt](https://tatendaz.github.io/llms.txt)",
    `https://tatendaz.github.io/${SLUG}/`,
  ]) {
    assert.ok(md.includes(needle), `the Markdown block is missing: ${needle}`);
  }
  assert.ok(md.length < 700, "the Markdown block must stay short");
  assert.deepEqual(tagNames(md), [], "the Markdown block must be plain text, not HTML");
  // The page is served at any depth (/yapui/a/b/c), so a relative href would break.
  const hrefs = [...NOT_FOUND.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(hrefs.length >= 6, "expected the navigation links");
  for (const href of hrefs) {
    const absolute = href.startsWith(`/${SLUG}/`) || /^(https?:|mailto:|data:|#)/.test(href);
    assert.ok(absolute, `relative href on a page served at any depth: ${href}`);
  }
});
