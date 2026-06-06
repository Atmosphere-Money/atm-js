import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageDirArg = process.argv[2];
const writeMode = process.argv.includes("--write");

if (!packageDirArg) {
  console.error("Usage: node scripts/check-sdk-api-snapshot.mjs <package-dir> [--write]");
  process.exit(1);
}

const packageRoot = path.resolve(repoRoot, packageDirArg);
const packageJsonPath = path.join(packageRoot, "package.json");
const sourcePath = path.join(packageRoot, "src", "index.ts");
const snapshotPath = path.join(packageRoot, "api-snapshot.json");

if (!existsSync(packageJsonPath) || !existsSync(sourcePath)) {
  console.error(`Package source not found for ${packageDirArg}`);
  process.exit(1);
}

const pkg = JSON.parse(await readFile(packageJsonPath, "utf8"));
const source = await readFile(sourcePath, "utf8");
const snapshot = {
  packageName: pkg.name,
  version: pkg.version,
  generatedFrom: path.relative(repoRoot, sourcePath),
  exports: exportRows(source),
  clientMethods: clientMethodRows(source),
};

const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;

if (writeMode) {
  await mkdir(path.dirname(snapshotPath), { recursive: true });
  await writeFile(snapshotPath, serialized);
  console.log(`Wrote API snapshot for ${pkg.name}.`);
  process.exit(0);
}

if (!existsSync(snapshotPath)) {
  console.error(`Missing API snapshot: ${path.relative(repoRoot, snapshotPath)}`);
  console.error(`Run: node scripts/check-sdk-api-snapshot.mjs ${packageDirArg} --write`);
  process.exit(1);
}

const existing = await readFile(snapshotPath, "utf8");
if (existing !== serialized) {
  console.error(`API snapshot changed for ${pkg.name}.`);
  console.error(`Review the public API change, then run:`);
  console.error(`  node scripts/check-sdk-api-snapshot.mjs ${packageDirArg} --write`);
  process.exit(1);
}

console.log(`API snapshot check passed for ${pkg.name}.`);

function exportRows(input) {
  const rows = [];
  const re = /^export\s+(?:declare\s+)?(?:async\s+)?(const|type|interface|function|class)\s+([A-Za-z0-9_]+)/gm;
  let match;
  while ((match = re.exec(input))) {
    rows.push({ kind: match[1], name: match[2] });
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind));
}

function clientMethodRows(input) {
  const clientStart = input.indexOf("export function createAtmAppClient");
  if (clientStart < 0) return [];
  const clientSource = input.slice(clientStart);
  const bodyMatch = clientSource.match(/return \{(?<body>[\s\S]*?)\n  \};\n\}/);
  const body = bodyMatch?.groups?.body ?? "";
  const rows = [];
  const re = /^\s{4}([A-Za-z0-9_]+)\(/gm;
  let match;
  while ((match = re.exec(body))) {
    rows.push(match[1]);
  }
  return rows.sort((a, b) => a.localeCompare(b));
}
