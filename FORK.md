# FORK.md: the household fork

This is a hardened, single-household fork of Home Assistant Matter Hub. It
runs as a Home Assistant add-on and exposes a handful of Home Assistant
entities to Amazon Echo Dots (3rd and 4th gen) over Matter. It is not a
general-purpose release: it builds one image, for one architecture, for one
house.

- **Base:** `t0bst4r/home-assistant-matter-hub` at `bf6af34d` (v3.0.4 plus
  the end-of-maintenance README changes). Upstream is archived.
- **Reference only:** `RiDDiX/home-assistant-matter-hub` v2.0.59
  (`664575af`), a much larger continuation. A few small fixes are ported from
  it, each cited below. Nothing else from it is used.
- **Target:** Home Assistant OS 18.4 on aarch64, add-on with
  `host_network: true`, `homeassistant_api: true`, `ingress: true`, one
  bridge on UDP port 5540.
- **Branch:** `douglas` is the default branch and the only one that is
  built. Nothing here is published to npm, and there are no releases or tags.

## What the fork exposes, and what it may call

Only entities of these eight domains can ever become Matter endpoints:
`light`, `switch`, `input_boolean`, `script`, `scene`, `automation`,
`button`, `input_button`. This is enforced in code, whatever the bridge's
filter says:

- `packages/backend/src/services/home-assistant/household-allow-list.ts`
  holds both lists.
- `services/bridges/bridge-registry.ts` drops every other domain before
  anything is subscribed to, and an **empty include filter exposes nothing**
  (upstream exposed everything).
- `matter/endpoints/legacy/create-legacy-endpoint-type.ts` refuses to build
  a device type for any other domain, as a second stop.

The device types for the other domains (lock, cover, climate, fan,
media_player, vacuum, humidifier, sensor, binary_sensor) are still in the
tree, unreachable, to keep the diff against upstream small.

Every Matter command reaches Home Assistant through
`HomeAssistantActions.callAction`, the single `callService` site, which
allows exactly these services, each only on entities of its own domain,
with no device, area, floor or label targets:

| Service | Data it may carry |
|---|---|
| `light.turn_on` | `brightness`, `color_temp_kelvin`, `hs_color` |
| `light.turn_off` | none |
| `switch.turn_on`, `switch.turn_off` | none |
| `input_boolean.turn_on`, `input_boolean.turn_off` | none |
| `script.turn_on` | none |
| `scene.turn_on` | none |
| `automation.trigger` | none |
| `button.press`, `input_button.press` | none |

Anything else is refused and logged at warn level; nothing is thrown into
the Matter stack. One step earlier,
`matter/behaviors/home-assistant-entity-behavior.ts` refuses an action for
an entity the bridge no longer exposes.

## Changes, with reasons

### CI and build

- **CI** (`.github/workflows/ci.yml`): lint (biome), tests (vitest) and the
  package builds on every push to `douglas`, Node 22 from `engines`, pnpm at
  the `packageManager` version via corepack, `--frozen-lockfile`, actions
  pinned to commit SHAs, `contents: read`, no dependency cache. The docs site
  is not built (it is not shipped, and its builder downloads a theme and runs
  an npm install).
- **Image** (`.github/workflows/image.yml`, `apps/home-assistant-matter-hub/addon.Dockerfile`):
  see "Build and verify" below. The upstream release, pull-request and
  composite-action workflows, and `standalone.Dockerfile`, are deleted.
- **Base digests** (`.github/workflows/base-digests.yml`): a manual job that
  prints the linux/arm64 digests to pin.

### Security

- **Bind address.** New `--http-host` (or `HAMH_HTTP_HOST`); the server
  listens on that address only and defaults to `127.0.0.1`. The add-on
  passes `172.30.32.1`, where the Supervisor's ingress proxy reaches a
  host-network add-on, and keeps the `172.30.32.2` IP allow-list.
- **The IP allow-list is the boundary, and it runs first.** With host
  networking, 172.30.32.1 is the host's own address, which the host also
  accepts from other interfaces and from other add-ons, so the bind alone
  is not a boundary. The allow-list (then basic auth, if configured) now
  runs before the access logger, the proxy-header handling, body parsing
  and the static files, so none of them sees a refused client.
- **A malformed URL could kill the process.** The access logger's
  `decodeURI("/%ff")` threw in a `finish` listener: an uncaught exception
  from one request, before the allow-list. It now falls back to the raw URL.
- **Service allow-list and domain allow-list**, as above. `switch` and
  `input_boolean` now call their own services instead of the generic
  `homeassistant.turn_on/off`; `input_boolean` has its own small endpoint
  (`matter/endpoints/legacy/input-boolean/`).
- **Factory reset is POST**, not GET (and the one frontend call with it).
- **HTTP hardening:** `X-Content-Type-Options: nosniff` on every response,
  no `X-Powered-By`, a 64 KB JSON body limit, the `X-Ingress-Path` value
  HTML-escaped (and inserted without `$` expansion) in the page's
  `<base href>`, and `NODE_ENV=production` in the image so error pages carry
  no stack traces.
- **Token off argv.** The entrypoint passes the Supervisor token as
  `HAMH_HOME_ASSISTANT_ACCESS_TOKEN`; the CLI already read `HAMH_*` options
  through yargs, so no code change was needed.
- **Non-root.** node runs as the unprivileged user `hamh` through
  `s6-setuidgid`; the entrypoint (root, under s6) makes `/config/data` that
  user's, mode 0700, before dropping privileges.
- **Dependencies:** express 5.2.1 → 5.3.0, which brings body-parser 2.4.0
  (GHSA-27r3-jxmh-p828, a process-ending crash from a compressed body;
  reachable through ingress) and, as a side effect, proxy-addr 2.0.8 and qs
  6.17.1. `rxjs` and `strip-color`, never imported, are removed.

### Reliability

- **Unhandled rejections no longer end the process.** Upstream had five
  places where a rejected promise went unhandled, and Node 22 exits on that.
  A Home Assistant Core restart (every update) or a command during one was
  enough to take every bridge down:
  - a failed service call (`home-assistant-actions.ts`; the same `.catch`
    RiDDiX added at `services/home-assistant/home-assistant-actions.ts:138-154`);
  - the 30 s registry refresh, now caught, logged and non-overlapping (ported
    from RiDDiX `services/home-assistant/home-assistant-registry.ts:103-130`,
    without its restart stamp and change detection);
  - a failed endpoint state update, now logged instead of rethrown;
  - a service that fails to initialise, which now logs and exits 1 so the
    watchdog restarts the add-on;
  - a taken port, which Express 5 hands to the listen callback; start-up now
    fails instead of claiming to listen.
- **matter.js 0.16.7 → 0.16.11**, the last 0.16 patch (session and
  subscription fixes; it does not close a peer's older CASE sessions).
- **Replaced CASE sessions are closed** once silent
  (`services/bridges/close-replaced-sessions.ts`). Ported from RiDDiX commit
  `c899c918` (issue #105: Alexa "not responding" after hours, because
  matter.js 0.16 leaves a peer's abandoned sessions open), with the two
  refinements v2.0.59 made to that path
  (`services/bridges/session-supervisor.ts:415-449`, `626-676`;
  `session-rotation.ts:28-57`, `74-110`): when a peer opens a session, its
  other sessions on that fabric are re-checked every minute (the old one
  usually still holds its subscription at that moment, and matter.js
  cancels it shortly after), and one is closed only once it has no
  subscription and five minutes without traffic, so a session still
  priming (#424) or still in use (#287/#398) is never cut short.
- **Sessions are closed before the bridge stops** (same file), so an Echo
  can drop its session at once instead of holding a stale one. Ported from
  RiDDiX `session-supervisor.ts:72-87` and `735-763`, called before the
  server is cancelled as at `services/bridges/bridge.ts:347`. A close that
  fails is logged. RiDDiX's forced fallback is not ported: on matter.js 0.16
  a second close returns at once once one has started (`Session.ts:248`,
  `:275`), so it would do nothing.
- **Scripts are momentary; buttons always report off.** Upstream reported a
  script ON while it ran and OFF afterwards, so every run sent an Echo an
  on → off report pair, which RiDDiX found can wedge some Echos until they
  restart (#423, `docs-site/docs/faq.md:127-133`). Scripts now behave like
  scenes and automations already did (the shape of RiDDiX
  `matter/endpoints/legacy/script/index.ts:8-14`): ON calls
  `script.turn_on`, **OFF does nothing**, and the plug always reports OFF,
  so no flip is ever reported. RiDDiX's optimistic flip
  (`on-off-server.ts:136-165`) is deliberately not ported. A button's state
  is a timestamp, which read as permanently ON; it now always reports OFF
  (as RiDDiX `matter/endpoints/legacy/button/index.ts:15-42`, without the
  timer).
- **Fixed BasicInformation versions.** Hardware and software version were
  the current year, so they changed every 1 January; they are now 2026.

### Port and network

- The bridge port is set per bridge; the UI proposes 5540 for the first
  bridge. Alexa pairs only on 5540, so keep the one bridge there (a second
  bridge would get 5541).
- mDNS is IPv6 plus IPv4 on all interfaces unless the add-on option
  `mdns_network_interface` names one; upstream already had that option
  (`--mdns-network-interface`), so RiDDiX's version of it is not ported.

## Deliberately left out

- **matter.js 0.18.** This build stays on 0.16.11, the line this code was
  written for. Upgrading is a follow-up. What RiDDiX had to change for it,
  as far as this port saw: `initiateForceClose` takes `{ cause }`;
  `@matter/protocol` and `@matter/types` became direct dependencies; and its
  move to 0.18.0 came a day after that release (see the supply audit). Expect
  to re-check every matter.js call in `close-replaced-sessions.ts` and in the
  behaviours against the 0.18 types.
- **From RiDDiX, not ported:** the dead-session timer, the
  superseded-session sweep (#400), age-based session rotation, the wedge
  watchdog, the optimistic on/off update, and everything that came with its
  larger feature set (plugins, backup and restore, the WebSocket API, update
  checks, device images). None of those exist here.
- **The other domains' code** stays in the tree, unreachable (see above).
- **Other dependency advisories** in the lockfile (path-to-regexp, ws,
  fast-uri, ajv, lodash-es) are not reachable here (static routes, Node's own
  WebSocket, no `$data`, no `_.template`) and are left for a later pass.
- **Not fixed, noted:** `bridge-registry.ts` looks a device up by entity id,
  so device labels and device areas are never consulted (it fails closed);
  `DebounceContext.unregisterAll()` iterates the wrong object and clears
  nothing; the bridge API returns the pairing codes to any allow-listed
  client (only the ingress proxy).

## Known and accepted

- The bridge uses matter.js's **test vendor id 0xFFF1 and product id 0x8000**.
- **Fabric keys are stored unencrypted** under the add-on's config folder
  (`/config/data`), and are therefore inside Home Assistant backups. Encrypt
  backups.
- The **serial number sent to the controller is the entity id** (unchanged
  when 32 characters or fewer), and the node label is the friendly name.
  Amazon sees both.
- A bridge **removed from the Alexa app while the add-on keeps running**
  becomes commissionable again with its original pairing code. After
  removing it from Alexa, factory-reset the bridge.
- **Label filters must be on entities, not devices.** Device labels are
  ignored (and fail closed). The household filter is
  `include: [{ type: "label", value: "<label_id>" }]`, `exclude: []`.
- **Turn the add-on's Watchdog on**, so Home Assistant restarts it if it
  exits (which it now does on purpose when it cannot start).

## The add-on

The add-on repository is separate. Its `config.yaml` needs:
`image: ghcr.io/airdoogle/home-assistant-matter-hub-addon`, `version:`
set to an image tag below, `arch: [aarch64]`, `init: false` (the base runs
s6-overlay v3), `host_network: true`, `homeassistant_api: true`,
`ingress: true`, `ingress_port: 0`, `map: [addon_config:rw]`, and the options
the entrypoint reads: `app_log_level` (default `info`),
`disable_log_colors` (default `false`) and `mdns_network_interface`
(`str?`, optional). It needs no workflows. The ghcr package is private by
default: make it public, or add ghcr credentials in the Supervisor.

## Build and verify

The image workflow runs after CI passes on a push to `douglas` (and by
hand), on a native arm64 runner, for linux/arm64 only:

1. A build stage on `node:22-alpine3.24` (pinned by digest) runs
   `pnpm fetch` (the only download, checked against the lockfile's
   integrity hashes), then `pnpm install --frozen-lockfile --offline
   --ignore-scripts`, then the package builds.
2. A prod stage installs the app's production dependencies alone from the
   same lockfile and store (`--prod --filter home-assistant-matter-hub`,
   offline, no scripts).
3. The runtime is `ghcr.io/hassio-addons/base:21.0.10` (pinned by digest)
   with the node binary only: no npm, npx, corepack, pnpm or yarn.
4. The image is built once and smoke-tested (no package managers, the
   `hamh` user exists, the bundle loads all its dependencies as that user),
   then pushed as
   `ghcr.io/airdoogle/home-assistant-matter-hub-addon:<version>-dw.<sha7>`
   (never `latest`, never re-pushed) with BuildKit provenance (`mode=max`),
   an SBOM, and a GitHub artifact attestation. The BuildKit builder and the
   SBOM scanner images are pinned by digest too. The job summary prints the
   digest.

To check an image against a commit before putting its tag in the add-on:

```sh
gh attestation verify \
  oci://ghcr.io/airdoogle/home-assistant-matter-hub-addon@sha256:<digest> \
  --owner AirDoogle
docker buildx imagetools inspect \
  ghcr.io/airdoogle/home-assistant-matter-hub-addon:<tag>
```

The attestation names the workflow, the `douglas` ref and the commit; the
image's `org.opencontainers.image.revision` label is the same commit.

## Update procedure

1. **Dependencies:** edit the version in both `packages/backend/package.json`
   and `apps/home-assistant-matter-hub/package.json` (they must match; a test
   checks it), then regenerate the lockfile without running any package code:
   `npx -y pnpm@10.28.1 install --lockfile-only --ignore-scripts
   --config.engine-strict=false`. Review the lockfile diff, commit, push.
2. **Base images:** run the "Base image digests" workflow with the new
   tags, and replace the digests in `addon.Dockerfile` (node and add-on base)
   and `image.yml` (BuildKit and the SBOM scanner).
3. **Actions:** resolve a new release's commit with
   `gh api repos/<owner>/<action>/git/ref/tags/<tag>` and replace the SHA.
4. Push to `douglas`; wait for CI and then the image workflow to pass.
5. Verify the new image as above, then bump `version` in the add-on
   repository's `config.yaml` to the new tag in a reviewed commit, recording
   the digest in the commit message.
