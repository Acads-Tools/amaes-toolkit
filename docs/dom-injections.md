# DOM Injections & UI Overlay Catalog

This document details every user interface element, HUD overlay, action button, and status indicator injected by the **AMAES Moodle Toolkit** into the Moodle DOM.

---

## 1. Overview & Architectural Principles

The toolkit follows strict DOM injection guidelines to maintain performance, stability, and aesthetics:
- **Non-Destructive**: Never deletes or mutates native Moodle form structures, hidden token inputs, or session tokens.
- **Strictly Scoped**: All injected classes and IDs are prefixed with `amaes-` to prevent collisions with Moodle's Boost/Classic themes.
- **Automatic Lifecycle Cleanup**: Transient indicators (stray badges, duplicate pills) are purged upon navigation or re-render.
- **Passive Accessibility**: Informational badges default to `pointer-events: none; cursor: default;` so they never block underlying card links.

---

## 2. Global Injections (All Moodle Pages)

These components are loaded across all matched Moodle pages when logged in.

### A. Floating Glassmorphism Panel
- **DOM ID**: `#amaes-toolkit-panel`
- **Purpose**: The primary HUD co-pilot providing tabbed navigation across:
  - **Quiz Solver**: Control auto-quiz modes, safe vs. aggressive progression, and question prompts.
  - **Study Database**: Search cached questions, view term breakdown, toggle community sharing.
  - **Activity Feed**: Live status dot, chronological logs, and system plan readout.
  - **Settings & Shortcuts**: Keyboard cheatsheet, hotkeys, and quick reset tools.
- **Interactivity**: Fully draggable across the viewport with position persisted to `localStorage`. Pressing <kbd>Esc</kbd> minimizes or closes the panel.

### B. Minimized Floating Dock
- **DOM ID**: `#amaes-toolkit-dock`
- **Purpose**: Compact floating pill shown when the main HUD is minimized. Displays current status icon and can be clicked to restore the panel.

### C. Quick Start & Shortcuts Modal
- **DOM ID**: `#amaes-welcome-modal`
- **Trigger**: Appears on first installation or when pressing hotkeys <kbd>?</kbd> or <kbd>K</kbd>.
- **Dismissal**: Closes via the top-right button, clicking the backdrop overlay, or pressing <kbd>Esc</kbd>.

### D. Top Navbar Update Notification
- **DOM ID**: `#amaes-topnav-update-item`
- **Location**: Injected beside Moodle's top navbar notification/user icons (`.nav.navbar-nav`).
- **Behavior**: Appears **only** when a newer userscript version is published on GitHub. Displays a direct update button (`#amaes-topnav-update-btn`) that links to the latest script release.

---

## 3. Dashboard & Course List (`/my/` & `courses.php`)

### A. Course Database Readiness Pill
- **Class**: `.amaes-home-db-badge-wrapper` / `.amaes-home-db-badge`
- **Target Container**: Appended inside `.course-info-container, .card-body, [data-region="course-content"]`.
- **States**:
  - `All Terms Ready • [N] Qs`: Complete coverage across Prelim, Midterm, Prefi, and Final (or $\ge 100$ verified questions). Emerald border and background.
  - `[Terms] Ready • [N] Qs`: Partial term coverage with question tally. Green tint.
  - `Verified DB • [N] Qs`: Verified questions cached without explicit term grouping.
  - `[CODE] • No Local DB`: Subject detected but no answers stored yet. Neutral slate styling.
- **Design Constraint**: Lightweight, single-pill deduplicated per card, non-interactive (`pointer-events: none`).

### B. Dashboard Onboarding Banner
- **DOM ID**: `#amaes-dashboard-guide-banner`
- **Location**: Preceded above `#region-main` or `.dashboard-card-deck`.
- **Condition**: Renders on dashboard for new users with fewer than 50 cached questions.
- **Dismissal**: Dismissible with a single click, saving state in `localStorage` (`amaes_guide_banner_dismissed`).

---

## 4. Active Quiz Pages (`attempt.php`)

Injections here provide real-time assistance during active assessments.

### A. Verified Choice Highlights
- **Class**: `.amaes-verified-badge`
- **Location**: Applied to the correct choice row (`.answer div.r0, .answer div.r1, .answer label`).
- **Visuals**: Soft emerald background (`rgba(16, 185, 129, 0.12)`), green border, and an inline verified checkmark icon.

### B. Eliminated / Wrong Choice Markers
- **Class**: `.amaes-eliminated-badge`
- **Location**: Applied to choices confirmed wrong from previous attempts.
- **Visuals**: Text strikethrough, dim opacity (`0.45`), and a red `(❌ Eliminated)` badge.

### C. Targeted AI Prompt Buttons
- **`[Copy AI]`**: `.amaes-copy-ai-card-btn`
  - Injected into the header/footer of each `.que` card.
  - Formats clean question text, instructions, and choices into a prompt ready for ChatGPT / Claude / Gemini.
- **`[Paste AI]`**: `.amaes-paste-ai-card-btn`
  - Reads clipboard content and automatically checks the corresponding radio button, checkbox, or fills the input for that specific question card.

### D. In-Question Stop / Resume Control
- **Class**: `.amaes-in-question-stop-btn`
- **Location**: Docked in the upper right corner of the currently active question card during Auto-Quiz runs.
- **Purpose**: Instantly pauses automated progression on the active question to give the student manual control without closing the solver.

### E. Interactive Question Type Hints
- **Drag-and-Drop 1-Click Placement**: `.amaes-drag-hint`
  - Added to `.drop` / `.droptarget` blanks for `ddwtos` and `ddimageortext` questions.
  - Clicking snaps the verified draggable tile directly into position.
- **Short-Answer Auto-Fill Pill**: `.amaes-shortans-hint`
  - Placed beside text input fields and textareas.
  - Displays the verified answer with a 1-click button to insert the text.

### F. Blockage & Safety HUD
- **Class**: `.amaes-blockage-hud`
- **Location**: Injected above the active question when Auto-Quiz halts.
- **Triggers**:
  - Question has no match in any database tier.
  - Multi-answer question requires student confirmation before advancing.

---

## 5. Quiz Review Pages (`review.php`)

Harvesting occurs on review pages immediately after quiz submission.

### A. Review Status Harvest Badge
- **Class**: `.amaes-review-status-pill`
- **Location**: Injected into the info header of each reviewed question card (`.que .info`).
- **States**:
  - **`Uploaded to DB`**: Displayed when *"Collect & Share Anonymously"* is enabled. Indicates verified answer was queued and transmitted to the community relay.
  - **`Saved Locally`**: Displayed when anonymous sharing is disabled or offline. Indicates answer was saved exclusively to local browser storage.

---

## 6. Grades & Subject Navigation (`user.php` / Gradebook)

### A. Missing Quiz Markers
- **Class**: `.amaes-unattempted-badge`
- **Location**: Injected into gradebook activity rows (`.grade-report-user`).
- **Purpose**: Highlights unattempted or pending quizzes to ensure students never miss an open quiz deadline.
