# SDK Publishing

This repo is the public package-only release home for Atmosphere Money's
JavaScript and TypeScript SDKs.

## Packages

```text
@atmosphere-money/app-node
@atmosphere-money/testing
```

The SDK packages are MIT licensed. The ATM platform, dashboard, checkout
processor, AppView, and private business logic are not part of this repo.

## npm Trusted Publishing

Configure npm trusted publishing in package settings for each package:

```text
Package: @atmosphere-money/app-node
Owner/repo: Atmosphere-Money/atm-js
Workflow: .github/workflows/publish-app-node.yml
Environment: npm

Package: @atmosphere-money/testing
Owner/repo: Atmosphere-Money/atm-js
Workflow: .github/workflows/publish-testing.yml
Environment: npm
```

The publish workflows use GitHub OIDC trusted publishing and publish with npm
provenance. Provenance is supported here because this SDK repo is public.

## Release Checklist

1. Bump the package version.
2. Update the package changelog.
3. Run `npm run sdk:check`.
4. Commit and push.
5. Trigger the appropriate publish workflow with `dry_run=true`.
6. Trigger the publish workflow with `dry_run=false`.
7. Verify npm dist-tags and run `npm run sdk:public-install:check`.
8. Review the package pages on npmx:
   - `https://npmx.dev/package/@atmosphere-money/app-node`
   - `https://npmx.dev/package/@atmosphere-money/testing`

Use npmx as a package-health review surface for README, changelog, source,
license, repository links, OSV vulnerability warnings, install/package size,
and npm provenance indicators. Do not treat npmx as a second registry or a CI
dependency; npm remains canonical.

Keep `beta` as the recommended install tag until the SDKs are ready for stable
app developers.

