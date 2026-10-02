# AMAES Toolkit Documentation

Welcome to the technical documentation hub for the **AMAES Moodle Toolkit** and its decentralized study database ecosystem.

---

## 📚 Technical & Architecture Guides

| Document | Topic | Description |
| :--- | :--- | :--- |
| **[DOM Injections & UI Overlays](dom-injections.md)** | UI & DOM Elements | Catalog of injected DOM nodes: glassmorphic HUD panel, 1-click auto-view badges, readiness pills, AI prompts, and in-question action bars. |
| **[Quiz Lifecycle & Answer Harvesting](quiz-lifecycle-and-harvesting.md)** | Automation Engine | Detailed breakdown of all 4 quiz stages (`view.php`, `attempt.php`, `summary.php`, `review.php`), 1-click auto-view, auto-submit, and 4-tier ground truth harvesting. |
| **[Community Pipeline & Cloud Architecture](pipeline-and-cloud-architecture.md)** | Infrastructure | Deep dive into the serverless sync architecture: Cloudflare Worker relay, GitHub issues gateway, Python anti-sabotage merge engine, and automated deployments. |
| **[Privacy-Preserving Usage & Network Telemetry](telemetry.md)** | Telemetry & Metrics | Complete schema and privacy guarantees for anonymous, ephemeral telemetry, session quiz counting, and mesh health telemetry. |

---

## ⚖️ Governance, Policies & Legal Safety

| Document | Topic | Description |
| :--- | :--- | :--- |
| **[Client Compatibility & Lifecycle](CLIENT-COMPATIBILITY.md)** | Versioning Policy | Supported client matrix (`v1.9.0`), minimum version enforcement (`v1.8.2`), relay HTTP 426 gates, and release procedures. |
| **[Terms of Use & Disclaimer](TERMS.md)** | Legal & Compliance | Independent status, student sole responsibility for academic integrity, "AS IS" warranty disclaimers, limitation of liability, and MIT license governance. |
| **[Contributor Identity Rules](AGENTS.md)** | Privacy & Git Rules | Strict zero-linkage policy: mandatory `AcademicContributor` git author and committer identity across all commits and connected repositories. |
| **[Security Policy](../SECURITY.md)** | Security & Vulnerabilities | Privacy audit checklists, vulnerability reporting workflow, and responsible disclosure guidelines. |

---

## 🚀 Key Repository & Ecosystem Links

- **Userscript Source**: [Acads-Tools/amaes-toolkit](https://github.com/Acads-Tools/amaes-toolkit)
- **Install / Update Userscript**: [amaes-toolkit.user.js](https://raw.githubusercontent.com/Acads-Tools/amaes-toolkit/main/amaes-toolkit.user.js)
- **Web Portal**: [acads-tools.github.io/amaes-toolkit](https://acads-tools.github.io/amaes-toolkit/)
- **Study Database**: [Acads-Tools/database](https://github.com/Acads-Tools/database)
- **Cloudflare Serverless Relay**: `https://amaes-community-relay.acads-tools.workers.dev`
