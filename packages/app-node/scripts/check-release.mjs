import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
const readme = await readFile(path.join(root, "README.md"), "utf8");
const source = await readFile(path.join(root, "src", "index.ts"), "utf8");
const publishMode = process.env.ATM_SDK_PUBLISH === "1" || process.argv.includes("--publish");
const failures = [];

function expect(condition, message) {
  if (!condition) failures.push(message);
}

expect(pkg.name === "@atmosphere-money/app-node", "package name must be @atmosphere-money/app-node");
expect(pkg.type === "module", "package must be ESM");
expect(pkg.license === "MIT", "App Node SDK must use the MIT package license");
expect(pkg.sideEffects === false, "package must declare sideEffects: false");
expect(pkg.homepage === "https://atmosphere.money/docs/sdk-examples", "homepage must point at SDK docs");
expect(
  pkg.repository?.url === "https://github.com/Atmosphere-Money/atm-js.git" ||
    pkg.repository?.url === "git+https://github.com/Atmosphere-Money/atm-js.git",
  "repository.url must point at Atmosphere-Money/atm-js"
);
expect(pkg.repository?.directory === "packages/app-node", "repository.directory must point at packages/app-node");
expect(pkg.bugs?.url === "https://github.com/Atmosphere-Money/atm-js/issues", "bugs.url must point at atm-js issues");
expect(pkg.publishConfig?.access === "public", "publishConfig.access must be public");
expect(pkg.engines?.node === ">=22.0.0", "Node engine must be >=22.0.0");
expect(pkg.exports?.["."]?.types === "./dist/index.d.ts", "exports must expose dist typings");
expect(pkg.exports?.["."]?.import === "./dist/index.js", "exports must expose dist ESM");
expect(pkg.types === "./dist/index.d.ts", "types must point at dist/index.d.ts");
expect(pkg.main === "./dist/index.js", "main must point at dist/index.js");
expect(pkg.files?.includes("dist"), "package files must include dist");
expect(pkg.files?.includes("README.md"), "package files must include README.md");
expect(pkg.files?.includes("CHANGELOG.md"), "package files must include CHANGELOG.md");
expect(pkg.files?.includes("LICENSE"), "package files must include LICENSE");
expect(!pkg.dependencies, "package should stay dependency-free at runtime for closed beta");
expect(pkg.keywords?.includes("atproto"), "keywords should include atproto");
expect(pkg.keywords?.includes("payments"), "keywords should include payments");
expect(pkg.keywords?.includes("tickets"), "keywords should include tickets");
expect(existsSync(path.join(root, "dist", "index.js")), "dist/index.js is missing; run npm run build");
expect(existsSync(path.join(root, "dist", "index.d.ts")), "dist/index.d.ts is missing; run npm run build");
expect(existsSync(path.join(root, "CHANGELOG.md")), "CHANGELOG.md is required before release");
expect(existsSync(path.join(root, "RELEASE.md")), "RELEASE.md is required before release");
expect(existsSync(path.join(root, "LICENSE")), "package-local LICENSE is required before release");
expect(readme.includes("@atmosphere-money/app-node"), "README must document the package name");
expect(readme.includes("Server-side"), "README must clearly say the package is server-side");
expect(readme.includes("MIT licensed"), "README must document the MIT package license");
expect(
  readme.includes("does not license the rest of the ATM monorepo"),
  "README must make the package-only license boundary explicit"
);

for (const exported of [
  "createAtmAppClient",
  "createAtmCheckoutProduct",
  "createPaymentInitiateBody",
  "constructAtmWebhookEvent",
  "constructTypedAtmWebhookEvent",
  "createNodeWebhookHandler",
  "createNextWebhookRoute",
  "createHonoWebhookHandler",
  "createCloudflareWorkerWebhookHandler",
  "createExpressWebhookHandler",
  "createTicketHoldBody",
  "createFreeTicketClaimBody",
  "constructAtmXrpcReceiverEvent",
  "constructTypedAtmXrpcReceiverEvent",
  "verifyServiceAuthRequest",
  "createAtmXrpcReceiverAudience",
]) {
  expect(
    source.includes(`export function ${exported}`) ||
      source.includes(`export async function ${exported}`) ||
      source.includes(`export const ${exported}`),
    `export ${exported}`
  );
}

if (publishMode) {
  expect(pkg.private === false || pkg.private === undefined, "package must remain publishable");
  expect(pkg.license === "MIT", "published App Node SDK must remain MIT licensed");
}

if (failures.length) {
  console.error("App Node SDK release check failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  publishMode
    ? "App Node SDK publish check passed."
    : "App Node SDK release check passed."
);
