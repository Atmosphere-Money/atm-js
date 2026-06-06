import { cp, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "atm-starters-"));
const tarballDir = path.join(tmpRoot, "packages");
const npmCacheDir = path.join(tmpRoot, "npm-cache");

function run(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  });
}

async function copyExample(name) {
  const source = path.join(repoRoot, "examples", name);
  const target = path.join(tmpRoot, name);
  await cp(source, target, {
    recursive: true,
    filter: (sourcePath) =>
      path.basename(sourcePath) !== "node_modules" &&
      !sourcePath.includes(`${path.sep}node_modules${path.sep}`),
  });
  return target;
}

async function installPackedSdk(exampleDir, tarballPath) {
  const packagePath = path.join(exampleDir, "package.json");
  const pkg = JSON.parse(await readFile(packagePath, "utf8"));
  pkg.dependencies = {
    ...(pkg.dependencies ?? {}),
    "@atmosphere-money/app-node": `file:${tarballPath}`,
  };
  await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  run("npm", ["install"], { cwd: exampleDir });
}

await mkdir(tarballDir, { recursive: true });
run("npm", ["install", "--package-lock=false", "--prefix", "packages/app-node"]);
run("npm", ["run", "build", "--prefix", "packages/app-node"]);
const packOutput = execFileSync("npm", ["pack", "--pack-destination", tarballDir], {
  cwd: path.join(repoRoot, "packages", "app-node"),
  encoding: "utf8",
  env: {
    ...process.env,
    npm_config_cache: npmCacheDir,
  },
});
const tarballName = packOutput.trim().split(/\s+/).pop();
if (!tarballName) throw new Error("npm pack did not return a tarball name");
const tarballPath = path.join(tarballDir, tarballName);

const nodeStarter = await copyExample("atm-node-app");
await installPackedSdk(nodeStarter, tarballPath);
run("npm", ["run", "typecheck"], { cwd: nodeStarter });
run("npm", ["run", "smoke"], { cwd: nodeStarter });

console.log("Starter app external-install checks passed.");
