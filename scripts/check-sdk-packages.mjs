import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "atm-sdk-pack-"));
const tarballDir = path.join(tmpRoot, "tarballs");
const npmCacheDir = path.join(tmpRoot, "npm-cache");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? "pipe",
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  });
}

function runInherit(command, args, options = {}) {
  execFileSync(command, args, {
    cwd: options.cwd ?? repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  });
}

function packPackage(packageDir) {
  runInherit("npm", ["install", "--package-lock=false", "--prefix", packageDir]);
  runInherit("npm", ["run", "build", "--prefix", packageDir]);
  const output = run("npm", ["pack", "--json", "--pack-destination", tarballDir], {
    cwd: path.join(repoRoot, packageDir),
  });
  const rows = JSON.parse(output);
  const tarball = rows?.[0]?.filename;
  if (!tarball) {
    throw new Error(`npm pack did not return a tarball for ${packageDir}`);
  }
  const fileCount = rows?.[0]?.files?.length ?? 0;
  if (fileCount < 4) {
    throw new Error(`npm pack for ${packageDir} looked incomplete`);
  }
  return path.join(tarballDir, tarball);
}

await mkdir(tarballDir, { recursive: true });

const appNodeTarball = packPackage("packages/app-node");
const testingTarball = packPackage("packages/testing");

runInherit("npm", ["init", "-y"], { cwd: tmpRoot });
runInherit("npm", ["install", appNodeTarball, testingTarball], { cwd: tmpRoot });

const smokePath = path.join(tmpRoot, "smoke.mjs");
await writeFile(
  smokePath,
  `import {
  ATM_CHECKOUT_PRODUCT_PREFIX,
  createAtmCheckoutProduct,
  createCloudflareWorkerWebhookHandler,
  createFreeTicketClaimBody,
  createHonoWebhookHandler,
  createTicketHoldBody,
  verifyServiceAuthRequest,
} from "@atmosphere-money/app-node";
import {
  ATM_TEST_WEBHOOK_SECRET,
  createAtmWebhookRequest,
  createPaymentCompletedFixture,
} from "@atmosphere-money/testing";

const product = createAtmCheckoutProduct({
  recipient: "did:plc:creator",
  amount: 1200,
  currency: "usd",
  paymentType: "shop",
  environment: "test",
});
if (!product.startsWith(ATM_CHECKOUT_PRODUCT_PREFIX)) {
  throw new Error("checkout product prefix missing");
}

const fixture = createPaymentCompletedFixture();
const request = createAtmWebhookRequest(fixture);
const hono = createHonoWebhookHandler({
  secret: ATM_TEST_WEBHOOK_SECRET,
  expectedType: "payment.completed",
  now: fixture.event.created,
  onEvent: (event) => ({ body: { paymentId: event.data.payment.id } }),
});
const honoResponse = await hono({ req: { raw: request } });
if (honoResponse.status !== 200) throw new Error("Hono helper failed");

const worker = createCloudflareWorkerWebhookHandler({
  secret: ATM_TEST_WEBHOOK_SECRET,
  expectedType: "payment.completed",
  now: fixture.event.created,
  onEvent: () => ({ body: { ok: true } }),
});
const workerResponse = await worker.fetch(createAtmWebhookRequest(fixture));
if (workerResponse.status !== 200) throw new Error("Workers helper failed");

const claims = await verifyServiceAuthRequest({
  request: new Request("https://app.example/xrpc/money.atmosphere.event.receive", {
    headers: { authorization: "Bearer jwt_fixture" },
  }),
  expectedIss: "did:plc:atm",
  expectedAud: "did:plc:app#AtmEventReceiver",
  expectedLxm: "money.atmosphere.event.receive",
  verifyServiceAuthJwt: ({ expectedIss, expectedAud, expectedLxm }) => ({
    iss: expectedIss,
    aud: expectedAud,
    lxm: expectedLxm,
    jti: "jti_fixture",
  }),
});
if (claims.jti !== "jti_fixture") throw new Error("service-auth helper failed");

createTicketHoldBody({
  eventUri: "at://did:plc:organizer/community.lexicon.calendar.event/demo",
  items: [{ ticketTierId: "tier_demo", quantity: 1 }],
});
createFreeTicketClaimBody({
  ticketTierId: "tier_free",
  buyerDid: "did:plc:buyer",
  buyerAssertionJwt: "buyer.assertion.jwt",
});

console.log("ATM SDK tarball smoke passed.");
`,
);

process.stdout.write(run("node", [smokePath], { cwd: tmpRoot }));
