# Releasing `@atmosphere-money/testing`

The testing package is published to npm for closed-beta app developers. Use
this checklist before publishing a new beta.

## One-time npm setup

1. npm organization `@atmosphere-money` is claimed.
2. Require 2FA for publishing and org membership.
3. Add trusted publishers for the public `Atmosphere-Money/atm-js` GitHub
   release workflow.
4. Keep the package dev-only and scoped:
   - `@atmosphere-money/testing`

See [`../../SDK_PUBLISHING.md`](../../SDK_PUBLISHING.md) for the package
boundary, npm org setup, trusted publishing, provenance, and tarball checklist.

## Pre-release checks

```sh
cd packages/testing
npm run check
npm run publish:check
```

`npm run check` builds TypeScript, checks the public API snapshot, runs fixture
tests, validates release metadata, and performs a dry-run pack. `npm run
publish:check` additionally verifies the package is publishable with public npm
metadata.

When a public fixture/helper export intentionally changes, review the API
surface and update the snapshot:

```sh
npm run api:snapshot
```

## Versioning

- Use beta tags until app onboarding opens beyond invited testers.
- Treat fixture event shapes, exported helper names, and signature-generation
  behavior as semver-significant.
- Add dedicated fixture factories when they reduce meaningful app-test
  boilerplate; otherwise use `createAtmEventFixture`.
- Keep fixtures fake and safe to commit.

## Publish shape

1. Update `CHANGELOG.md`.
2. Run `npm run check`.
3. Run the repo-level SDK/docs checks:

```sh
cd ../..
npm run sdk:check
npm run sdk:pack:check
npm run sdk:public-install:check
```

4. Run `npm pack --dry-run` and inspect the file list.
5. Run `npm run publish:check`.
6. Trigger the GitHub publish workflow in dry-run mode for the `beta` tag.
7. Publish with public access and the beta dist-tag through the GitHub workflow:

```sh
gh workflow run publish-testing.yml --repo Atmosphere-Money/atm-js \
  -f tag=beta -f dry_run=false
```

8. Install the package into a clean example app test suite and verify signed
   fixture handling.
