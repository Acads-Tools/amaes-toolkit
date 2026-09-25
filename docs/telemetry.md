# Privacy-Preserving Usage & Network Telemetry

This document outlines the architecture, data model, and strict privacy guarantees of the anonymous usage and mesh telemetry pipeline in **AMAES Moodle Toolkit**.

---

## 1. Core Principles & Privacy Guarantees

The telemetry system strictly enforces the following invariants:
* **Zero Personally Identifiable Information (PII):** No student names, student IDs, emails, LMS usernames, or system usernames are ever transmitted.
* **Zero Session / Token Leakage:** No Moodle cookies, authorization tokens, or session IDs are ever collected or stored.
* **Zero Academic Surveillance:** No question contents, course titles, or student grades are tracked in telemetry payloads.
* **Session-Only Quiz Metrics:** The count of completed quizzes is maintained only within the browser's temporary `sessionStorage` (`session_quizzes_solved`), which resets every time the student closes their browser.

---

## 2. Telemetry Payload Schema

Client pings to `/telemetry` adhere strictly to the following lightweight JSON schema:

```json
{
  "anon_id": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "version": "1.7.6",
  "event": "heartbeat",
  "session_quizzes_solved": 3,
  "fast_mode_enabled": true
}
```

| Field | Type | Description |
| :--- | :--- | :--- |
| `anon_id` | `UUID v4` | Random anonymous installation identifier stored locally in `localStorage`. Regenerated upon reinstall. |
| `version` | `string` | Current version of the userscript (e.g. `1.7.6`). Used for update adoption metrics. |
| `event` | `string` | Event type: `heartbeat` (sent at most once every 6 hours) or `quiz_completed`. |
| `session_quizzes_solved` | `integer` | Count of quizzes completed in the current browser session only (`sessionStorage`). |
| `fast_mode_enabled` | `boolean` | Whether ⚡ Fast Answer (Turbo) Mode is currently toggled on. |

---

## 3. Serverless Storage Architecture

Telemetry pings are ingested and processed via **Cloudflare Workers** and backed by **Cloudflare D1 / Supabase**:

1. **Ingress Gateway (`POST /telemetry`)**:
   - Hosted on `https://amaes-community-relay.acads-tools.workers.dev/telemetry`.
   - Validates that the payload contains a valid anonymous UUID and sanitized event fields.
   - Writes directly to Cloudflare D1 `telemetry_events` table (or Supabase Postgres with strict Row Level Security).
2. **Aggregated Metrics (`GET /telemetry/stats`)**:
   - Calculates 24-hour active unique users: `COUNT(DISTINCT anon_id)`.
   - Calculates version distribution: percentage of community members on latest version.
   - Calculates total quizzes solved reported across the network.
   - Exposed to developers via the built-in Developer Console (`stats` command).
