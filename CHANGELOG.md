# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- Missing open-source project files: `tsconfig`, `vitest`, `eslint`, `.gitignore`, `CODE_OF_CONDUCT`, issue/pr templates
- Tests for `Claw` and `Agent` behaviors with mock gateway fixtures
- Example snippets under `docs/examples/`
- Runtime adapter abstraction with built-in `openclaw` and `nanoclaw` adapters
- NanoClaw adapter implementation (`/v1/messages`, Anthropic-style SSE, `/v1/models`)
- `AdapterCapabilityError` for unsupported runtime capabilities

### Changed

- Reworked README and docs for complete, runnable API usage
- Improved SDK exports and typings (`RunOptions`, `ToolOptions`, `AgentInfo`, `Role`, `Runtime`, `RuntimeAdapter`)
- Enhanced runtime checks for required config values
- Added support for custom `fetch` injection in `ClawConfig`
- Improved stream parsing and error handling in `Agent`

### Fixed

- Type error in `Claw` caused by missing `AgentInfo` import
- Broken markdown blocks and incomplete docs content
