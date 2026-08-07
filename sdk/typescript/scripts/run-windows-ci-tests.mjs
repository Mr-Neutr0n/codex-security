import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const testsDirectory = new URL("../tests-ts/", import.meta.url);
const packageDirectory = fileURLToPath(new URL("../", import.meta.url));
const tests = (await readdir(testsDirectory))
  .filter((file) => file.endsWith(".test.ts"))
  .sort();
const shardSeeds = [
  ["api.test.ts"],
  ["runtime.test.ts"],
  ["cli-authentication.test.ts", "scan-recovery.test.ts"],
  [],
];
const assigned = new Set(shardSeeds.flat());
for (const file of assigned) {
  if (!tests.includes(file)) {
    throw new Error("Windows CI test shard references a missing file: " + file);
  }
}
for (const file of tests) {
  if (!assigned.has(file)) shardSeeds[3].push(file);
}

const shards = shardSeeds.map((files) =>
  files.map((file) => "./tests-ts/" + file),
);
if (
  shards.flat().length !== tests.length ||
  new Set(shards.flat()).size !== tests.length
) {
  throw new Error("Windows CI test shards must run every test file once.");
}

const results = await Promise.all(
  shards.map(
    (files, index) =>
      new Promise((resolve, reject) => {
        console.log(
          "Windows CI test shard " +
            (index + 1) +
            "/" +
            shards.length +
            ": " +
            files.join(" "),
        );
        const child = spawn("bun", ["test", "--timeout", "30000", ...files], {
          cwd: packageDirectory,
          stdio: "inherit",
          windowsHide: true,
        });
        child.once("error", reject);
        child.once("close", (code) => {
          resolve(code ?? 1);
        });
      }),
  ),
);

if (results.some((code) => code !== 0)) {
  process.exitCode = 1;
}
