# Client Compatibility & Version Lifecycle

The current AMAES Toolkit client version is **1.11.16**. The relay currently
allows version **1.8.2 or newer**.

Clients below the configured minimum, clients with a missing or invalid
version, and unsupported clients are blocked before the toolkit starts. They
cannot load the answer database, use quiz automation, harvest answers, or
submit contributions until the official userscript is updated.

The userscript checks the relay's `/version` endpoint at startup. The relay
also enforces the same policy on contribution and telemetry requests and returns
`426 Upgrade Required` for rejected clients. The server-side check remains
authoritative because a modified userscript cannot be trusted.

---

## Supported Version Matrix

| Version Range | Status | Support Level | Actions Required |
| :--- | :--- | :--- | :--- |
| **`v1.11.16`** | Active Release | Full support | None. Recommended version. |
| **`v1.8.2` – `v1.11.15`** | Supported Legacy | Core features active | Strongly encouraged to update to v1.11.16. |
| **`< v1.8.2`** | Deprecated / Blocked | Inactive (Startup Lockout) | Must update via Violentmonkey or GitHub. |

---

## Version Enforcement Architecture

1. **Client-Side Startup Check (`verifyClientCompatibility`)**:
   - Queries `GET /version` on the community relay at toolkit initialization.
   - If the local client version is strictly lower than `minimumVersion`, an update blocking banner is mounted, pausing all quiz automation, database sync, and harvest features.
2. **Server-Side Request Gate (`X-AMAES-Client-Version`)**:
   - All authenticated or crowdsourced requests transmit the client version header.
   - The Cloudflare Worker relay verifies `semver(clientVersion) >= semver(MIN_CLIENT_VERSION)`.
   - Rejections return `426 Upgrade Required` with JSON payload `{ error: "Upgrade required", minimumVersion, latestVersion }`.

---

## Changing the Minimum Version

For a breaking client, payload, or database-schema change:

1. Release the compatible userscript and update its `@version` (e.g. `src/meta.js`, `src/core/config.js`, `package.json`, `README.md`).
2. Update `LATEST_VERSION` and `MIN_CLIENT_VERSION` in `database/relay` (`worker.js` and `wrangler.toml`).
3. Update this document and the relay README.
4. Run `npm test` and relay syntax checks.
5. Deploy the relay (`npx wrangler deploy`) before relying on the new minimum.

Keep `amaes-toolkit.user.js` at the repository root. Its raw GitHub URL is
used by existing userscript managers, the installer, and the relay update
response.
