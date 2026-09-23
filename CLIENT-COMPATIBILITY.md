# Client compatibility

The current AMAES Toolkit client version is **1.7.8**. The relay currently
allows version **1.7.5 or newer**.

Clients below the configured minimum, clients with a missing or invalid
version, and unsupported clients are blocked before the toolkit starts. They
cannot load the answer database, use quiz automation, harvest answers, or
submit contributions until the official userscript is updated.

The userscript checks the relay's `/version` endpoint at startup. The relay
also enforces the same policy on contribution requests and returns
`426 Upgrade Required` for rejected clients. The server-side check remains
authoritative because a modified userscript cannot be trusted.

## Changing the minimum version

For a breaking client, payload, or database-schema change:

1. Release the compatible userscript and update its `@version`.
2. Update `LATEST_VERSION` and `MIN_CLIENT_VERSION` in `database/relay`.
3. Update this document and the relay README.
4. Run the userscript syntax/tests and relay syntax checks.
5. Deploy the relay before relying on the new minimum.

Keep `amaes-toolkit.user.js` at the repository root. Its raw GitHub URL is
used by existing userscript managers, the installer, and the relay update
response.
