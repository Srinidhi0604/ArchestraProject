import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const sourceBase = path.join(root, "node_modules", "cesium", "Build", "Cesium");
const targetBase = path.join(root, "public", "cesium");

const folders = ["Workers", "Assets", "ThirdParty", "Widgets"];

if (!fs.existsSync(sourceBase)) {
  console.warn("Cesium build directory not found. Skipping asset copy.");
  process.exit(0);
}

fs.mkdirSync(targetBase, { recursive: true });

for (const folder of folders) {
  const src = path.join(sourceBase, folder);
  const dest = path.join(targetBase, folder);

  if (!fs.existsSync(src)) {
    console.warn(`Cesium folder missing: ${src}`);
    continue;
  }

  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`Copied Cesium ${folder} -> public/cesium/${folder}`);
}
