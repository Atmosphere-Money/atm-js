# Atmosphere Money JavaScript SDKs

Public JavaScript and TypeScript SDK packages for apps integrating with
Atmosphere Money.

This repository contains only public SDK code, examples, fixtures, tests, and
release workflows. The Atmosphere Money dashboard, checkout processor,
AppView, hosted business logic, and private platform services remain in the
private ATM monorepo.

## Packages

- `@atmosphere-money/app-node`: server-side helpers for ATM app checkout,
  webhooks, service-auth receivers, and Tickets calls.
- `@atmosphere-money/testing`: dev-only signed fixtures, replay helpers, and
  idempotency assertions for app integration tests.

Install the closed beta packages with:

```sh
npm install @atmosphere-money/app-node@beta
npm install -D @atmosphere-money/testing@beta
```

## Development

```sh
npm run sdk:check
```

That command builds both packages, checks public API snapshots, runs package
tests, validates README snippets, and smoke-tests packed tarballs.

## Publishing

Publishing is handled through GitHub Actions and npm trusted publishing.

The workflows are manual:

- `.github/workflows/publish-app-node.yml`
- `.github/workflows/publish-testing.yml`

Use the `beta` dist-tag until ATM app onboarding is open beyond invited
developers. Use `latest` only after a stable release is intentionally promoted.

Because this repository is public and package-only, npm provenance can be
enabled for publish workflows.

## License

MIT. See [LICENSE](./LICENSE).

