import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
const out = join(root, "public", "vendor", "maplibre");

mkdirSync(out, { recursive: true });
for (const name of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(join(dist, name), join(out, name));
}
console.log("Copied MapLibre worker files to public/vendor/maplibre/");
