import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const readme = await readFile(path.join(root, "README.md"), "utf8");
const changelog = await readFile(path.join(root, "CHANGELOG.md"), "utf8");
const source = await readFile(path.join(root, "src", "index.ts"), "utf8");
const publishMode = process.env.ATM_TESTING_PUBLISH === "1" || process.argv.includes("--publish");

const missing = [];

if (pkg.name !== "@atmosphere-money/testing") missing.push("package name");
if (pkg.private !== false && pkg.private !== undefined) missing.push("publishable package guard");
if (pkg.license !== "MIT") missing.push("MIT license");
if (pkg.type !== "module") missing.push("ESM package type");
if (pkg.sideEffects !== false) missing.push("sideEffects false");
if (pkg.homepage !== "https://atmosphere.money/docs/testing-package") missing.push("homepage");
if (
  pkg.repository?.url !== "https://github.com/Atmosphere-Money/atm-js.git" &&
  pkg.repository?.url !== "git+https://github.com/Atmosphere-Money/atm-js.git"
) {
  missing.push("repository url");
}
if (pkg.repository?.directory !== "packages/testing") missing.push("repository directory");
if (pkg.bugs?.url !== "https://github.com/Atmosphere-Money/atm-js/issues") missing.push("bugs url");
if (pkg.publishConfig?.access !== "public") missing.push("publishConfig access");
if (pkg.engines?.node !== ">=22.0.0") missing.push("Node engine");
if (pkg.exports?.["."]?.types !== "./dist/index.d.ts") missing.push("exports types");
if (pkg.exports?.["."]?.import !== "./dist/index.js") missing.push("exports import");
if (pkg.types !== "./dist/index.d.ts") missing.push("types entry");
if (pkg.main !== "./dist/index.js") missing.push("main entry");
for (const file of ["dist", "README.md", "CHANGELOG.md", "LICENSE"]) {
  if (!pkg.files?.includes(file)) missing.push(`package files ${file}`);
}
if (pkg.dependencies) missing.push("runtime dependencies");
if (!existsSync(path.join(root, "dist", "index.js"))) missing.push("dist/index.js");
if (!existsSync(path.join(root, "dist", "index.d.ts"))) missing.push("dist/index.d.ts");
if (!readme.includes("@atmosphere-money/testing")) missing.push("README package name");
if (!readme.includes("MIT")) missing.push("README MIT license");
if (!changelog.includes(pkg.version)) missing.push("CHANGELOG current version");
if (!existsSync(path.join(root, "RELEASE.md"))) missing.push("RELEASE.md");

for (const exported of [
  "createAtmEventFixture",
  "createPaymentCompletedFixture",
  "createPaymentFailedFixture",
  "createPaymentRefundedFixture",
  "createPaymentDisputedFixture",
  "createProductArchivedFixture",
  "createSubscriptionUpdatedFixture",
  "createTicketCheckedInFixture",
  "createTicketsIssuedFixture",
  "signAtmFixture",
  "createMemoryDeliveryStore",
  "createMemoryReplayStore",
  "createAtmWebhookRequest",
  "assertFreshDelivery",
  "createAtmIdempotencyKey",
]) {
  if (
    !source.includes(`export function ${exported}`) &&
    !source.includes(`export async function ${exported}`) &&
    !source.includes(`export const ${exported}`)
  ) {
    missing.push(`export ${exported}`);
  }
}

if (publishMode && pkg.private !== false && pkg.private !== undefined) {
  missing.push("package must remain publishable");
}

if (missing.length) {
  console.error("Testing package release check failed:");
  for (const item of missing) console.error(`- ${item}`);
  process.exit(1);
}

console.log("Testing package release check passed.");
