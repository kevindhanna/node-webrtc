/* eslint-disable no-console */
"use strict";
const fs = require("fs");
const path = require("path");

function extractScriptsFromHtml(htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const scripts = [];

  // Extract src references (handles quoted and unquoted attributes)
  const srcRegex =
    /<script\s+src=(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*><\/script>/g;
  let match;
  while ((match = srcRegex.exec(html)) !== null) {
    const src = match[1] || match[2] || match[3];
    let resolved;
    const wptRoot = path.join(__dirname, "..");
    if (src.startsWith("/")) {
      // Absolute WPT path — resolve from wpt root
      resolved = path.join(wptRoot, src.slice(1));
    } else {
      resolved = path.join(path.dirname(htmlPath), src);
    }
    if (fs.existsSync(resolved)) {
      scripts.push({ type: "file", path: resolved });
    } else {
      console.warn(`WARNING: script not found: ${resolved} (from ${src})`);
    }
  }

  // Extract inline scripts
  const inlineRegex = /<script>([^]*?)<\/script>/g;
  while ((match = inlineRegex.exec(html)) !== null) {
    scripts.push({ type: "inline", content: match[1] });
  }

  return scripts;
}

module.exports = { extractScriptsFromHtml };
