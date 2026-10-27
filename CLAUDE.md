# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```powershell
npm install
npm run typecheck                  # tsc --noEmit (strict) over miniprogram/**/*.ts and typings/
npm test -- --runInBand            # Jest (ts-jest, Node env, WeChat API stubs)
npx jest path/to/File.test.ts      # single test file
npx jest -t "test name"            # single test by name
npm run test:coverage
```

There is no build/lint script: the app is run by opening the repo root in WeChat DevTools (`project.config.json` sets the mini program root to `miniprogram/`). Jest only covers `miniprogram/src/tests` and `miniprogram/hardware-sdk/src/tests`; passing tests do not prove DevTools preview, server integration, or real BLE behavior.

## Architecture

TypeScript migration (gradual) of the native mini program in the sibling `wx_InBodyProgram-new_master`; pages, assets and backend contracts are kept from it. README.md (in Chinese) has the detailed migration notes — read it before touching session/measurement logic.

Layers under `miniprogram/`:
- `pages/`, `components/` — native WeChat pages/components, `setData` and interaction only.
- `src/application/` — `services/` (login, report, measurement, device settings use cases), `stores/` (identity, report, measurement session), and `AppContainer.ts`, which wires dependencies, performs one-shot cold-start session restore (`initializeSession()`, shared by `app.onLaunch` and the splash page) and owns the setup session handed over to measurement.
- `src/domain/` — types, metric rules, date/device-visibility rules, ports. Must not call WeChat APIs. Prefer plain types/pure functions over aggregates/repositories/event buses.
- `src/infrastructure/` — WeChat API adapters, data mappers, Canvas rendering (`renderers/`; share-poster data shaping is in `ReportShareModel.ts`, drawing in `ReportSharePoster2D.ts`, which re-exports the model and keeps its `module.exports` list), the BLE transport/codec for the setup flow.
- `hardware-sdk/` — device services, communication engine, frame parsing/building, per-model state machines (H20 / 120 / H30 / H40). New code accesses external capabilities via application services.

### Invariants to preserve
- **Session version** increments on identity switch/logout; stale profile/login responses and late BLE scan/connect results must be discarded (late physical connections are disconnected). Each measurement pins identity, device and session version at start.
- Logout/account switch clears in-memory reports, report cache and identity-related storage. Report cache carries `report:historyOwner`; cache without it is not displayed.
- Measurement completion is handled once; the SDK's public completion payload strips transport fields, so the app validates a valid weight. Upload success and history refresh are independent — a refresh failure must not mark upload failed or re-upload. Retries reuse the original payload and DATETIMES.
- A completed measurement is persisted under `measure:pendingUpload` (keyed by `uid`) before upload and removed once the server confirms. `AppContainer` calls `MeasurementWorkflowService.resumePendingUpload()` whenever an account is authenticated (cold start and login), re-sending the original payload only for the matching `uid`. Logout intentionally does not clear it. Server idempotency is unconfirmed, so a lost response can create a duplicate record.
- Cold start accepts both `auth:profile` and legacy `InBodyUID / UserTelHP / InBodyUserInfo` storage.

### BLE boundary
Only the SDK's `WxBluetoothAdapter` calls native `wx` BLE APIs or registers native listeners — keep it that way. The device-setup flow (Wi-Fi provisioning, nickname, user list, OTA) is `src/application/services/H30SetupSession.ts`: the original `processCase` state machine, now with no `wx` calls. Radio access goes through `H30Transport`, which subscribes to the SDK's shared adapter (`getSetupBluetoothAdapter()`); page effects (dialogs, navigation, sounds, storage, the direct upload, the firmware file picker) go through the `ISetupPlatform` port (`WxSetupPlatform`); OTA uses the SDK's `H30OtaService`. `AppContainer.setupSession` owns the instance and `app.ts` exposes it as `globalData.BluetoothH30`, so setup pages are unchanged. Before unified measurement the container calls `setupSession.pauseForMeasurement()`: it detaches the transport, stops scanning, disconnects, and bumps `epoch` so connects started earlier are abandoned. `infrastructure/ble/InBodyH30Protocol` is only a command/response codec over the SDK's `H30ProtocolParser` (plus the firmware-version HTTP check). The SDK creates fresh broadcaster/parser per init, and a destroyed Runner rejects further commands.

No file carries `@ts-nocheck` any more, but legacy pages rely on explicit `any` (callback params, `Record<string, any>`), `globalData`, and `any` in platform typings; strict passing ≠ fully typed. Legacy measurement components/protocols were removed; backups live outside the repo under `.backup/2026-10-27-legacy-ble/`.
