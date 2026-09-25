# Contributing to WiFiSense Lab

This platform was built one phase at a time, compiled and tested after each. These rules
keep it stable as it grows.

## The build rules

1. **Build incrementally.** One phase at a time. Compile, test, and stabilize before the
   next phase begins. Do not rewrite working modules unnecessarily.
2. **Preserve the architecture.** The telemetry contract (`TelemetryPoint`, `SensorSim`,
   `RoomSim`) is sacred — every data source emits it, every consumer reads it.
3. **Keep hardware modular.** Real devices attach through adapters/parsers/backends.
   Never bake transport assumptions into the UI or detection layers.
4. **Never fabricate.** Simulated data is labeled `SIMULATED`; live hardware data is never
   relabeled. When an estimate is unreliable, say so — don't guess.
5. **Never invent protocols.** The esp-csi binary frame layout is *not supplied*. Parsers
   are placeholders that refuse unknown formats until it is.

## Honesty contract

- Every realtime chart carries axis labels, units, a legend, a timestamp and a
  `SRC:` tag stating the data source.
- Exports carry an explicit `provenance` block.
- Confidence values are labeled **algorithmic estimates**, not physical truth.
- Respiration output is bannered `EXPERIMENTAL · NOT A MEDICAL DEVICE`.
- Person positions on the map are **approximate** — never claimed localization.

## Conventions

- **No `alert()` / `confirm()` / `prompt()`.** Use the modal components in
  `src/components/sensorModals.tsx`.
- **Pure processing functions** live in `src/processing/` and are mirrored in
  `python-service/processors/` for parity — keep both in sync.
- **New telemetry fields** go through `src/types.ts` and the simulation engine; add a
  self-test before wiring UI.
- **Status colors:** green = healthy, yellow = warning, red = error, blue = informational.
- **Type discipline:** the build must pass `tsc` with zero errors before a phase is done.

## Testing

The self-test suite (`src/tests/selftest.ts`) runs at boot and from
**Settings → Self-Test Suite**. When you add a pure function or detector, add a
deterministic test case in the same change. Run `npm run build` to verify — the suite is
type-checked and bundled with the app.

## Adding a new phase

1. Add types to `src/types.ts`.
2. Implement pure logic in `src/processing/` or a service in `src/services/`.
3. Add self-test cases.
4. Build the page in `src/pages/`, register it in `src/nav.ts`, `src/App.tsx` and
   `src/components/TopNav.tsx`.
5. Bump `PHASE` / `APP_VERSION` in `src/state/store.ts`.
6. `npm run build` until green, then update this file's phase table.

## Commit style

```
phase(N): short imperative summary
```

e.g. `phase(6): add occupancy engine with empty-room baselines`.

## Reporting issues

Include: browser, seed (Settings), and whether you were in **Simulation** or **Live**
mode. Reproducibility hinges on the seed — a deterministic engine means a failing case
can always be replayed.
