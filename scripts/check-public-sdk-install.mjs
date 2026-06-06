import { mkdtemp, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "atm-public-sdk-"));
const npmCacheDir = path.join(tmpRoot, "npm-cache");

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: options.cwd ?? tmpRoot,
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? "pipe",
    env: {
      ...process.env,
      npm_config_cache: npmCacheDir,
    },
  });
}

run("npm", ["init", "-y"]);
run("npm", [
  "install",
  "@atmosphere-money/app-node@beta",
  "@atmosphere-money/testing@beta",
]);

const smokePath = path.join(tmpRoot, "smoke.mjs");
await writeFile(
  smokePath,
  `import {
  createAtmAppClient,
  createAtmCheckoutProduct,
  constructTypedAtmWebhookEvent,
} from "@atmosphere-money/app-node";
import {
  ATM_TEST_WEBHOOK_SECRET,
  createAtmWebhookRequest,
  createPaymentCompletedFixture,
} from "@atmosphere-money/testing";

const atm = createAtmAppClient({
  brokerUrl: "https://checkout.atmosphere.money",
  getServiceAuthToken: ({ lxm, aud }) => \`jwt:\${lxm}:\${aud}\`,
});

const product = createAtmCheckoutProduct({
  recipient: "did:plc:creator",
  amount: 1200,
  currency: "usd",
  paymentType: "shop",
  environment: "test",
});

const fixture = createPaymentCompletedFixture({
  payment: { id: "pay_public_ci_smoke" },
});
const request = createAtmWebhookRequest(fixture);
const event = constructTypedAtmWebhookEvent({
  rawBody: fixture.rawBody,
  secret: ATM_TEST_WEBHOOK_SECRET,
  expectedType: "payment.completed",
  now: fixture.event.created,
  headers: {
    signature: request.headers.get("atm-signature"),
    deliveryId: request.headers.get("atm-delivery-id"),
    event: request.headers.get("atm-event"),
    apiVersion: request.headers.get("atm-api-version"),
    environment: request.headers.get("atm-environment"),
  },
});

if (typeof atm.initiatePayment !== "function") {
  throw new Error("createAtmAppClient did not expose initiatePayment");
}
if (!product.startsWith("atm.checkout.v1:")) {
  throw new Error("checkout product did not use the ATM envelope prefix");
}
if (event.data.payment.id !== "pay_public_ci_smoke") {
  throw new Error("published testing fixture did not verify correctly");
}

console.log("Public ATM SDK install smoke passed.");
`,
);

const output = run("node", [smokePath]);
process.stdout.write(output);
