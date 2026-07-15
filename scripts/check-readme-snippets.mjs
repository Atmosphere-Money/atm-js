import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const snippetSources = [
  "README.md",
  "packages/app-node/README.md",
  "packages/testing/README.md",
  "examples/atm-node-app/README.md",
];
const packagePaths = {
  "@atmosphere-money/app-node": path.join(repoRoot, "packages", "app-node", "src", "index.ts"),
  "@atmosphere-money/testing": path.join(repoRoot, "packages", "testing", "src", "index.ts"),
};

const snippets = [];
for (const relativePath of snippetSources) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) continue;
  const markdown = await readFile(absolutePath, "utf8");
  let index = 0;
  for (const code of extractTypeScriptFences(markdown)) {
    if (code.includes("@atm-docs-skip")) continue;
    snippets.push({
      relativePath,
      index: ++index,
      code,
    });
  }
}

if (snippets.length === 0) {
  console.log("No TypeScript README snippets found.");
  process.exit(0);
}

const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "atm-readme-snippets-"));
try {
  for (const [index, snippet] of snippets.entries()) {
    const fileName = `${index + 1}-${slug(snippet.relativePath)}-${snippet.index}.mts`;
    await writeFile(path.join(tmpRoot, fileName), buildSnippetModule(snippet.code));
  }
  await writeFile(
    path.join(tmpRoot, "tsconfig.json"),
    JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          lib: ["ES2022", "DOM"],
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
          esModuleInterop: true,
          types: ["node"],
          typeRoots: [
            path.join(repoRoot, "node_modules", "@types"),
            path.join(repoRoot, "packages", "app-node", "node_modules", "@types"),
            path.join(repoRoot, "packages", "testing", "node_modules", "@types"),
          ],
          baseUrl: ".",
          paths: {
            "@atmosphere-money/app-node": [packagePaths["@atmosphere-money/app-node"]],
            "@atmosphere-money/testing": [packagePaths["@atmosphere-money/testing"]],
          },
        },
        include: ["*.mts"],
      },
      null,
      2
    )
  );

  runTsc(tmpRoot);
  console.log(`README TypeScript snippet check passed for ${snippets.length} snippets.`);
} finally {
  await rm(tmpRoot, { recursive: true, force: true });
}

function extractTypeScriptFences(markdown) {
  const snippets = [];
  const re = /```(ts|typescript|tsx)\n([\s\S]*?)```/g;
  let match;
  while ((match = re.exec(markdown))) {
    snippets.push(match[2].trim());
  }
  return snippets;
}

function buildSnippetModule(code) {
  const { imports, body } = splitImports(code);
  const bodySource = body.trim();
  const needsWrapper = /\breturn\b/.test(bodySource) && !/\bexport\s+/.test(bodySource);
  const compiledBody = needsWrapper
    ? `async function __atmDocsSnippet() {\n${indent(bodySource)}\n}\nvoid __atmDocsSnippet;`
    : bodySource;
  return `${imports.join("\n")}

${snippetPrelude(code)}

${compiledBody}

export {};
`;
}

function splitImports(code) {
  const imports = [];
  const body = [];
  let collectingImport = false;
  let currentImport = [];
  for (const line of code.split("\n")) {
    if (!collectingImport && /^\s*import\s+/.test(line)) {
      collectingImport = true;
      currentImport = [line];
      if (line.includes(";")) {
        imports.push(currentImport.join("\n"));
        collectingImport = false;
      }
      continue;
    }
    if (collectingImport) {
      currentImport.push(line);
      if (line.includes(";")) {
        imports.push(currentImport.join("\n"));
        collectingImport = false;
      }
      continue;
    }
    body.push(line);
  }
  return { imports, body: body.join("\n") };
}

function snippetPrelude(code) {
  const declarations = [
    `import type { AtmVerifiedServiceAuthClaims } from "@atmosphere-money/app-node";`,
    "",
    `declare const rawBody: string;`,
    `declare const input: Parameters<ReturnType<typeof import("@atmosphere-money/app-node").createAtmAppClient>["initiatePayment"]>[0];`,
    `declare const atm: ReturnType<typeof import("@atmosphere-money/app-node").createAtmAppClient>;`,
    "",
    `declare function mintMyAppServiceAuthJwt(input: { lxm: string; aud: string }): Promise<string>;`,
    `declare function claimWebhookDelivery(deliveryId: string): Promise<{ status: "claimed"; claimId: string } | { status: "completed" } | { status: "busy" }>;`,
    `declare function completeWebhookDelivery(deliveryId: string, claimId: string): Promise<void>;`,
    `declare function releaseWebhookDelivery(deliveryId: string, claimId: string): Promise<void>;`,
    `declare function markOrderPaid(orderId: string, paymentId?: string): Promise<void>;`,
    `declare function fulfillPaidOrder(data: unknown): Promise<void>;`,
    `declare function syncSubscription(data: unknown): Promise<void>;`,
    `declare function syncTickets(data: unknown): Promise<void>;`,
    `declare function showSetupRequiredState(): unknown;`,
    `declare function routeHandler(request: Request): Promise<Response>;`,
    `declare function verifyServiceAuthJwtWithYourAtprotoStack(input: {`,
    `  token: string;`,
    `  expectedIss: string;`,
    `  expectedAud: string;`,
    `  expectedLxm: string;`,
    `}): Promise<AtmVerifiedServiceAuthClaims>;`,
  ];

  if (!/\b(?:const|let|var)\s+request\b/.test(code)) {
    declarations.splice(3, 0, `declare const request: Request;`);
  }
  for (const exported of [
    "constructAtmWebhookEvent",
    "constructTypedAtmWebhookEvent",
    "createAtmEventFixture",
    "createAtmWebhookRequest",
  ]) {
    if (
      new RegExp(`\\b${exported}\\b`).test(code) &&
      !new RegExp(`import[\\s\\S]*\\b${exported}\\b[\\s\\S]*from`).test(code)
    ) {
      const helperPackage =
        exported === "createAtmEventFixture" || exported === "createAtmWebhookRequest"
          ? "@atmosphere-money/testing"
          : "@atmosphere-money/app-node";
      declarations.push(
        `declare const ${exported}: typeof import("${helperPackage}")["${exported}"];`
      );
    }
  }
  return declarations.join("\n");
}

function runTsc(cwd) {
  const tscPath = [
    path.join(repoRoot, "node_modules", "typescript", "bin", "tsc"),
    path.join(repoRoot, "packages", "app-node", "node_modules", "typescript", "bin", "tsc"),
    path.join(repoRoot, "packages", "testing", "node_modules", "typescript", "bin", "tsc"),
  ].find((candidate) => existsSync(candidate));
  if (!tscPath) {
    throw new Error(
      "TypeScript is not installed. Run npm install in the repo root, app/, or an SDK package before checking snippets."
    );
  }
  execFileSync(process.execPath, [tscPath, "-p", "tsconfig.json"], {
    cwd,
    stdio: "inherit",
  });
}

function indent(input) {
  return input
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function slug(input) {
  return input.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase();
}
