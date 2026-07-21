"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const officialDirectory = path.join(root, "public", "Pictures");
const filenames = ["App Ikon V1.png", "App Logo v1.png", "Hero Logo v1.png"];
const files = {
  appHtml: fs.readFileSync(path.join(root, "app", "index.html"), "utf8"),
  appManifest: fs.readFileSync(path.join(root, "app", "manifest.webmanifest"), "utf8"),
  appWorker: fs.readFileSync(path.join(root, "app", "service-worker.js"), "utf8"),
  rootHtml: fs.readFileSync(path.join(root, "index.html"), "utf8"),
  rootManifest: fs.readFileSync(path.join(root, "manifest.webmanifest"), "utf8"),
  rootWorker: fs.readFileSync(path.join(root, "service-worker.js"), "utf8"),
  websiteHtml: fs.readdirSync(path.join(root, "website")).filter(name => name.endsWith(".html"))
    .map(name => fs.readFileSync(path.join(root, "website", name), "utf8")).join("\n")
};

function listStaticImages(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules"].includes(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) listStaticImages(fullPath, output);
    else if (/\.(?:png|jpe?g|webp|gif|svg|ico)$/i.test(entry.name) && !fullPath.includes(`${path.sep}app${path.sep}vendor${path.sep}`)) output.push(fullPath);
  }
  return output;
}

function assertLocalReferencesExist(content, baseDirectory, label) {
  const references = [...content.matchAll(/["']([^"']+\.(?:png|jpe?g|webp|gif|svg|ico)(?:\?[^"']*)?)["']/gi)].map(match => match[1]);
  for (const reference of references) {
    if (/^(?:https?:|data:|blob:)/i.test(reference)) continue;
    const cleanPath = decodeURIComponent(reference.split("?")[0]).replace(/^\.\//, "");
    const resolved = path.resolve(baseDirectory, cleanPath.replace(/^\/+/, ""));
    assert.ok(fs.existsSync(resolved), `${label} has no dead image link: ${reference}`);
  }
}

const digest = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
for (const filename of filenames) {
  const official = path.join(officialDirectory, filename);
  assert.ok(fs.existsSync(official), `official asset exists: ${filename}`);
  for (const mirror of [path.join(root, "app", "Pictures", filename), path.join(root, "website", "Pictures", filename)]) {
    assert.ok(fs.existsSync(mirror), `deploy mirror exists: ${mirror}`);
    assert.equal(digest(mirror), digest(official), `${filename} mirror must be byte-identical`);
  }
}

const allRuntimeReferences = Object.values(files).join("\n");
assert.doesNotMatch(allRuntimeReferences, /work4it-(?:app-icon|hero-logo|logo|icon)|\/assets\/(?:app-icon|hero-logo)/i);
assert.match(files.appHtml, /Pictures\/App%20Ikon%20V1\.png/);
assert.match(files.appHtml, /Pictures\/App%20Logo%20v1\.png/);
assert.match(files.appHtml, /Pictures\/Hero%20Logo%20v1\.png/);
assert.match(files.appWorker, /work4it-shell-v127-official-assets1/);
assert.match(files.appManifest, /Pictures\/App Ikon V1\.png/);

for (const [relativeFile, baseDirectory] of [
  ["app/index.html", path.join(root, "app")],
  ["app/manifest.webmanifest", path.join(root, "app")],
  ["app/service-worker.js", path.join(root, "app")],
  ["index.html", root],
  ["manifest.webmanifest", root],
  ["service-worker.js", root]
]) assertLocalReferencesExist(fs.readFileSync(path.join(root, relativeFile), "utf8"), baseDirectory, relativeFile);
for (const filename of fs.readdirSync(path.join(root, "website")).filter(name => /\.(?:html|css)$/i.test(name))) {
  assertLocalReferencesExist(fs.readFileSync(path.join(root, "website", filename), "utf8"), path.join(root, "website"), `website/${filename}`);
}

const allowedImageFiles = new Set(filenames.flatMap(filename => [
  path.join(officialDirectory, filename),
  path.join(root, "app", "Pictures", filename),
  path.join(root, "website", "Pictures", filename)
]).map(file => path.normalize(file).toLowerCase()));
const unexpectedImages = listStaticImages(root).filter(file => !allowedImageFiles.has(path.normalize(file).toLowerCase()));
assert.deepEqual(unexpectedImages, [], `unexpected static images outside official Pictures structure: ${unexpectedImages.join(", ")}`);

console.log("Official Pictures source, deploy mirrors and runtime references OK");
