# AMAES Toolkit

[![Version](https://img.shields.io/badge/version-1.6.6-blue.svg)](https://raw.githubusercontent.com/Acads-Tools/amaes-toolkit/main/amaes-toolkit.user.js)
[![Platform](https://img.shields.io/badge/platform-Violentmonkey%20%7C%20Tampermonkey-darkblue.svg)](https://acads-tools.github.io/amaes-toolkit/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> A smart, privacy-preserving study companion and autonomous quiz assistant for AMA Education System and ACLC College students on Moodle (`semestral.amaes.com`).

<p align="center">
  <img src="assets/amaes-toolkit-live-demo.gif" alt="AMAES Toolkit Live Interface Demo" width="100%" style="border-radius: 8px;">
</p>

---

## Features

* **1-Click Auto-Answer & Smart Auto-Next:** Automatically highlights verified answers, selects correct choices, and advances to the next question.
* **Autonomous Web-Scraper Rescue:** Searches and parses online study guides in the background when database entries are missing.
* **100% Anonymous Community Sync:** Pulls verified community answers on course open from the [Community Question Database](https://github.com/Acads-Tools/database) and shares confirmed quiz reviews with zero personal data transmitted.
* **AI Prompt Formatter & 1-Click Paste:** Instantly copy formatted questions (`C`) and paste AI solutions (`V`) directly onto quiz inputs.
* **Batch Course Productivity:** 1-click lecture auto-marker and missing quiz detector across all enrolled subjects.

---

## Quick Start

1. **Install:** Get the script via the **[AMAES Toolkit Installer Website](https://acads-tools.github.io/amaes-toolkit/)**.
2. **Open Moodle:** Go to [semestral.amaes.com](https://semestral.amaes.com/) (the setup window appears automatically).
3. **Done:** Check the agreement box and click **Initialize Database & Start**!

---

## Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| `Space` / `N` | Advance to Next Question / Page |
| `C` | 1-Click Copy Question for AI |
| `V` | Paste AI Answer (Auto-Selects Choice) |
| `P` | Pause / Resume Autonomous Auto-Quiz |
| `1` – `4` / `A` – `D` | Select Choice Option 1 through 4 |
| `H` | Highlight Answers Immediately |
| `?` / `K` | Open Quick Guide & Shortcuts Modal |
| `Esc` | Close Modal / Minimize Toolkit Panel |

---

## Technical Documentation

Comprehensive guides covering system architecture, DOM injections, and quiz harvesting are available in the **[`docs/`](docs/)** directory:

* **[DOM Injections & UI Overlays](docs/dom-injections.md)**: Complete catalog of every injected element, HUD component, action button, and status badge.
* **[Quiz Lifecycle & Answer Harvesting](docs/quiz-lifecycle-and-harvesting.md)**: Complete guide to question detection, solver matching tiers, 4-tier ground truth harvesting on review pages, and all real-world scenarios.
* **[Community Pipeline & Cloud Architecture](docs/pipeline-and-cloud-architecture.md)**: Deep dive into the serverless pipeline (Cloudflare Worker Relay, GitHub Issues, GitHub Actions, and Python anti-sabotage merge engine).

## Frequently Asked Questions

<details>
<summary><b>Clicking the install link just shows raw JavaScript code?</b></summary>
Install a userscript manager first (such as <a href="https://violentmonkey.github.io/">Violentmonkey</a> or Tampermonkey), or visit our <a href="https://acads-tools.github.io/amaes-toolkit/">Quick Install Site</a> for a guided 1-click installation.
</details>

<details>
<summary><b>Does this tool transmit any of my personal student information?</b></summary>
<b>No.</b> The toolkit never transmits your name, student ID, email address, password, grades, or Moodle session tokens. All community contributions are strictly anonymous question-and-answer pairs validated against official review grading keys.
</details>

<details>
<summary><b>What happens on questions that have no known answer yet?</b></summary>
The solver safely pauses, displays a <i>"No answer known yet — be the first to answer and share it!"</i> banner, and lets you review manually or use AI. It never guesses blindly.
</details>

---

<a id="important-use-disclaimer"></a>

## Important Use Disclaimer

AMAES Toolkit is an independent, unofficial assistive study tool. It is **not affiliated with, endorsed by, sponsored by, or operated by** AMA Education System, ACLC, Moodle, Violentmonkey, Tampermonkey, or any browser vendor. Product names and trademarks belong to their respective owners.

Use the toolkit only where permitted by your institution, instructor, assessment rules, and applicable law. Do not use it to cheat, impersonate another person, bypass access controls or proctoring, interfere with a service, or submit work that violates academic-integrity policies. You are solely responsible for your use of the software, your account, your data, and anything you submit through Moodle. You must obtain any permission required before using it.

The software and website are provided **“as is” and “as available,”** without warranties or guarantees of any kind, including accuracy, availability, security, fitness for a particular purpose, or non-infringement. The developer and contributors are not responsible for lost data, service interruptions, account actions, academic outcomes, disciplinary action, legal claims, or other direct, indirect, incidental, or consequential losses arising from use or misuse, to the maximum extent permitted by applicable law. Nothing here excludes liability that cannot legally be excluded.

By downloading, installing, accessing, or using the toolkit, you agree to these terms and agree, to the maximum extent permitted by law, to defend and hold harmless the developer and contributors from claims, losses, liabilities, costs, and expenses arising from your violation of these terms, applicable law, or third-party rights. If you do not agree, do not use or install the toolkit. This notice is not legal advice; consult a qualified lawyer about your jurisdiction and circumstances. Review the [Terms of Use](TERMS.md) and [MIT License](LICENSE) before using the project.

---

**Links:** [GitHub Repository](https://github.com/Acads-Tools/amaes-toolkit) • [Quick Install Site](https://acads-tools.github.io/amaes-toolkit/) • [Question Database](https://github.com/Acads-Tools/database) • [Terms of Use](TERMS.md) • [Security Policy](SECURITY.md) • [Greasy Fork](https://greasyfork.org/en/scripts/594744-amaes-toolkit) • [Report a Bug / Request Feature](https://github.com/Acads-Tools/amaes-toolkit/issues)
