"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const cloudSource = fs.readFileSync("app/firestore-cloud-service.js", "utf8");
const htmlSource = fs.readFileSync("app/index.html", "utf8");
const rulesSource = fs.readFileSync("firestore.rules", "utf8");
const configSource = fs.readFileSync("app/firebase-config.js", "utf8");

const inlineScripts = [...htmlSource.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map(match => match[1])
  .filter(Boolean);
inlineScripts.forEach(source => new Function(source));

assert.match(configSource, /initializeApp\(firebaseConfig\)/);
assert.match(configSource, /getAuth\(app\)/);
assert.match(configSource, /getFirestore\(app\)/);
assert.match(cloudSource, /await requireCloudUser\("Gem træningsprogrammer"\)/);
assert.doesNotMatch(htmlSource, /saved && window\.FirestoreDataService\?\.isCloudPrimary/);
assert.match(htmlSource, /cloudService\.saveProgramsToCloud\(programs\)/);
assert.match(htmlSource, /✔ Gemt i Cloud/);
assert.match(htmlSource, /isConnectivityError\?\.\(error\)/);
assert.match(cloudSource, /reportFirestoreError\("saveProgramsToCloud"/);
assert.match(cloudSource, /COLLECTIONS\.workouts/);
assert.match(rulesSource, /match \/workouts\/\{workoutId\}/);
assert.match(rulesSource, /allow read, create, update, delete: if isOwner\(userId\)/);
assert.ok(inlineScripts.length > 0);

console.log("Cloud storage initialization, direct-save, status and rules contracts OK");
