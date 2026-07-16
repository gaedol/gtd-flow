import esbuild from "esbuild";
import process from "process";
import { readFileSync } from "node:fs";
import { builtinModules } from "node:module";

const prod = process.argv[2] === "production";
// version-stamp the bundle so every release's main.js is byte-unique
// (attestation digests must map 1:1 to a single release's attestation)
const version = JSON.parse(readFileSync("manifest.json", "utf8")).version;

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  banner: { js: `/* gtd-flow ${version} */` },
  bundle: true,
  external: [
    "obsidian",
    "electron",
    "@codemirror/*",
    "@lezer/*",
    ...builtinModules,
    ...builtinModules.map((m) => `node:${m}`),
  ],
  format: "cjs",
  target: "es2021",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
