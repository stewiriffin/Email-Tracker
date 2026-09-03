import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionDir = path.join(rootDir, "extension");
const outputFile = path.join(rootDir, "extension.zip");

function shouldExclude(relativePath) {
  const parts = relativePath.split(path.sep);
  const filename = parts[parts.length - 1];

  if (parts.some((part) => part.startsWith("."))) return true;
  if (filename.endsWith(".md") || filename.endsWith(".map")) return true;
  if (filename.endsWith("~") || filename.endsWith(".log")) return true;
  return false;
}

function collectFiles(directory, base = directory, collected = []) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;

    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(base, absolutePath);

    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      collectFiles(absolutePath, base, collected);
      continue;
    }

    if (entry.isFile() && !shouldExclude(relativePath)) {
      collected.push(relativePath.split(path.sep).join("/"));
    }
  }

  return collected;
}

if (!existsSync(extensionDir)) {
  console.error("extension/ directory not found");
  process.exit(1);
}

if (existsSync(outputFile)) {
  rmSync(outputFile);
}

const files = collectFiles(extensionDir);
if (!files.length) {
  console.error("No extension files found to package");
  process.exit(1);
}

const zip = spawnSync("zip", ["-q", "-X", outputFile, ...files], {
  cwd: extensionDir,
  encoding: "utf8",
});

if (zip.status !== 0) {
  const python = spawnSync(
    "python3",
    [
      "-c",
      `
import zipfile
from pathlib import Path
root = Path(${JSON.stringify(extensionDir)})
out = Path(${JSON.stringify(outputFile)})
files = ${JSON.stringify(files)}
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
    for name in files:
        archive.write(root / name, name)
`,
    ],
    { encoding: "utf8" }
  );

  if (python.status !== 0) {
    console.error(zip.stderr || python.stderr || "Failed to create extension.zip");
    process.exit(1);
  }
}

const size = statSync(outputFile).size;
console.log(`Wrote ${path.relative(rootDir, outputFile)} (${files.length} files, ${size} bytes)`);
