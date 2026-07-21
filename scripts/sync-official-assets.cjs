"use strict";

const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const sourceDirectory = path.join(projectRoot, "public", "Pictures");
const targetDirectories = [
  path.join(projectRoot, "app", "Pictures"),
  path.join(projectRoot, "website", "Pictures")
];
const officialAssets = Object.freeze([
  "App Ikon V1.png",
  "App Logo v1.png",
  "Hero Logo v1.png"
]);

function requireOfficialAssets() {
  if (!fs.existsSync(sourceDirectory)) throw new Error(`Den officielle billedmappe mangler: ${sourceDirectory}`);
  for (const filename of officialAssets) {
    const filePath = path.join(sourceDirectory, filename);
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      throw new Error(`Det officielle asset mangler: ${filePath}`);
    }
  }
}

function syncDirectory(targetDirectory) {
  fs.mkdirSync(targetDirectory, { recursive: true });
  const allowed = new Set(officialAssets);
  for (const entry of fs.readdirSync(targetDirectory, { withFileTypes: true })) {
    if (entry.isFile() && !allowed.has(entry.name)) fs.rmSync(path.join(targetDirectory, entry.name));
  }
  for (const filename of officialAssets) {
    fs.copyFileSync(path.join(sourceDirectory, filename), path.join(targetDirectory, filename));
  }
}

requireOfficialAssets();
targetDirectories.forEach(syncDirectory);
console.log(`Officielle Work4it-assets synkroniseret: ${officialAssets.join(", ")}`);

module.exports = { officialAssets, projectRoot, sourceDirectory, targetDirectories };
