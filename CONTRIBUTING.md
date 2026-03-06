# Contributing

Thanks for contributing to `claw-sdk`.

## Setup

```bash
git clone https://github.com/Panda-Intelligence/claw-sdk.git
cd claw-sdk
pnpm install
```

## Local checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Run optional real gateway integration tests:

```bash
cp .env.real.example .env.real
pnpm test:real
```

## Pull requests

1. Create a branch from `main`.
2. Add or update tests for your changes.
3. Keep commits focused and readable.
4. Open a PR with clear context and validation output.

## Commit style

Conventional Commits are recommended:

- `feat: add adapter option for custom fetch`
- `fix: handle empty SSE line safely`
- `docs: update API reference for send options`

## Reporting issues

Use issue templates for bug reports and feature requests.
