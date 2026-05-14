# Kikoro

A personal-use fork of [getpaseo/paseo](https://github.com/getpaseo/paseo) — a mobile-first iOS coding-agent orchestrator.

## What is this fork?

Kikoro is a kikoro-themed iOS app that speaks paseo's protocol. Backend (daemon, server, relay, Mac app, CLI) runs vanilla paseo unchanged — only the iOS client is replaced.

## Important — read this before trying to use it

You cannot run kikoro standalone. It requires:

- A running paseo daemon (install from [getpaseo/paseo](https://github.com/getpaseo/paseo))
- Your own Apple Developer account (for TestFlight)
- Your own Expo account (for EAS builds)

This is a personal-use fork. Issues and pull requests targeting fork-specific behavior will be redirected to upstream.

## Differences from upstream paseo

See [KIKORO_CHANGES.md](./KIKORO_CHANGES.md) for the full kikoro-vs-paseo divergence list. Short version:

- Branding: app name, bundle ID, slug, owner, scheme, Expo project ID, ASC App ID all swapped to kikoro
- Icons + splash: kikoro art replaces paseo art
- EAS profiles: added `testflight` profile (paseo doesn't ship one)
- Everything else: vanilla paseo

## Upstream merge protocol

Paseo iterates fast. Kikoro pins paseo monthly to a known-good version rather than merging head weekly. See [KIKORO_CHANGES.md](./KIKORO_CHANGES.md) for the merge cadence and the `.gitattributes` rules that protect kikoro values from upstream overwrites.

## What's shipped beyond paseo

Features unique to kikoro, in order shipped:

- **Codex + Claude subscription tracking (v1.1.0, v1.2.0)** — Settings → Subscriptions renders Session/Weekly quota bars per provider, with `% left`, reset countdowns, plan tier, and account. Always-visible header chip shows the lowest quota across providers, tappable into the screen. Powered by the daemon polling CodexBar.app's `CodexBarCLI usage --format json` and broadcasting over the existing WebSocket. Requires `CodexBar.app` installed on the Mac and a one-time keychain ACL grant for Chrome Safe Storage.

See [KIKORO_CHANGES.md](./KIKORO_CHANGES.md) for the full per-version implementation notes.

## Future direction

Planned opinionated UX features paseo doesn't have:

- Kanban-style issue management with sub-issue spawning
- Agent-delegated question answering
- Configurable approval gates
- Home Screen widget for at-a-glance subscription quotas
- Bundling CodexBar.app's quota-fetching logic into `packages/desktop` (Electron) so only kikoro needs to be running on the Mac

Features ship one at a time. See KIKORO_CHANGES.md for the most-recent ship.

## Acknowledgments

This fork inherits everything paseo built — the 5,977-star, weekly-shipping orchestrator that makes coding-agent control on iOS actually work. Kikoro is the small kikoro-flavored garnish on top.

Upstream license: AGPL-3.0. This fork inherits AGPL-3.0.
