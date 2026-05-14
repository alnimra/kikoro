# Kikoro

A personal-use fork of [getpaseo/paseo](https://github.com/getpaseo/paseo) — a mobile-first iOS coding-agent orchestrator.

## What is this fork?

Kikoro is a kikoro-themed iOS app that speaks paseo's protocol. It tracks upstream paseo closely, with fork-specific iOS branding, EAS/TestFlight wiring, and the additive Kikoro features documented in `KIKORO_CHANGES.md`.

## Important — read this before trying to use it

You cannot run kikoro standalone. It requires:

- A running paseo daemon (install from [getpaseo/paseo](https://github.com/getpaseo/paseo))
- Your own Apple Developer account (for TestFlight)
- Your own Expo account (for EAS builds)

This is a personal-use fork. Issues and pull requests targeting fork-specific behavior will be redirected to upstream.

## Differences from upstream paseo

See [KIKORO_CHANGES.md](./KIKORO_CHANGES.md) for the full kikoro-vs-paseo divergence list. Short version:

- Branding: app name, bundle ID, slug, owner, scheme, Expo project ID, ASC App ID, and launch/onboarding screens are swapped to kikoro
- Icons + splash: kikoro art replaces paseo art
- EAS profiles: added `testflight` profile (paseo doesn't ship one)
- Fork features: subscription usage tracking and any future Kikoro-only behavior are listed in `KIKORO_CHANGES.md`

## Upstream merge protocol

Paseo iterates fast. Kikoro pins paseo monthly to a known-good version rather than merging head weekly. See [KIKORO_CHANGES.md](./KIKORO_CHANGES.md) for the merge cadence and the `.gitattributes` rules that protect kikoro values from upstream overwrites.

## Future direction

Kikoro will continue adding opinionated UX features paseo doesn't have (Kanban-style issue management, agent-delegated question answering, configurable approval gates). Features ship one at a time and each fork-specific divergence is recorded in `KIKORO_CHANGES.md`.

## Acknowledgments

This fork inherits everything paseo built — the 5,977-star, weekly-shipping orchestrator that makes coding-agent control on iOS actually work. Kikoro is the small kikoro-flavored garnish on top.

Upstream license: AGPL-3.0. This fork inherits AGPL-3.0.
