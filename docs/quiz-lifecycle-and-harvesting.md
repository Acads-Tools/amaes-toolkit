# Quiz Lifecycle & Answer Harvesting Engine

This document provides an in-depth explanation of how the **AMAES Moodle Toolkit** detects, solves, and harvests quiz questions across the Moodle quiz lifecycle.

---

## 1. The Three Stages of the Quiz Lifecycle

The quiz workflow traverses three standard Moodle endpoints:

```
[view.php] Landing Page ──► [attempt.php] Active Quiz Attempt ──► [review.php] Answer Harvesting & Sync
```

### Stage 1: Landing Page (`view.php`)
- **Subject Extraction**: The toolkit identifies the course code (e.g., `CS6204`, `ITE6100`) from breadcrumb links, course title strings, or URL parameters.
- **Database Readiness Verification**: Local `localStorage` and the central verified GitHub cache are checked to evaluate readiness.
- **Badge Status**: Displays the readiness pill directly on the course card (e.g., `All Terms Ready • 120 Qs`).
- **One-Click Launch**: Pressing *"Start Auto-Quiz"* on the landing page automatically clicks *"Attempt quiz now"* or *"Re-attempt quiz"* to initiate the attempt.

---

### Stage 2: Active Attempt (`attempt.php`)

During an active quiz attempt, the toolkit's DOM watcher processes each question container (`.que`).

#### 1. DOM Sanitization & Preamble Stripping
Raw Moodle questions frequently include dynamic session noise that prevents direct matching:
- **Preamble Removal**: Strips `"Select one:"`, `"Choose one:"`, `"Answer the following:"`, and question numbering (`"Question 1"`).
- **HTML Cleaning**: Removes inline styling, dynamic plugin file URLs (`@@PLUGINFILE@@` session tokens), non-breaking spaces, and excessive linebreaks.
- **Normalized Key Generation**: Strips punctuation and casing to produce a normalized key used for instant lookup.

#### 2. Three-Tier Question Matching Engine
The question is evaluated against three confidence tiers:

1. **Tier 1: Local Verified Database (100% Confidence)**:
   - Contains questions previously harvested on your browser from 100% full-mark attempts or verified checkmarks.
2. **Tier 2: Community Verified Database (High Confidence)**:
   - Synced from the central community repository (`Acads-Tools/database`). Answers verified by multiple student submissions.
3. **Tier 3: Web Scraper Catalog (AMAUOED Fallback)**:
   - Matches against public quiz archives using a 5-tier matching strategy (Exact Code $\rightarrow$ Dept+Num $\rightarrow$ Alias $\rightarrow$ Unique Num $\rightarrow$ Keyword).

#### 3. Visual Highlighting & Interaction
- **Verified Answers**: The matched choice row receives `.amaes-verified-badge` with a green highlight and checkmark.
- **Eliminated Choices**: Debunked choices receive `.amaes-eliminated-badge` with a strikethrough and red cross.
- **Deduction Engine**: If 3 of 4 multiple-choice options are marked eliminated, the remaining option is automatically promoted to verified.

#### 4. Auto-Quiz Progression
- **Safe Mode**: Highlights the answer and waits for user confirmation before navigating.
- **Aggressive Mode**: Selects the verified radio button or checkbox and immediately triggers Moodle's *"Next page"* or *"Finish attempt..."* button.
- **Unknown Question Safety Gate**: If a question has no known answer in any tier, the solver **pauses safely**. It displays a reassurance notice (*"Be the first to answer and share it!"*) and waits for the student to make a manual choice or use `[Copy AI]`.

---

### Stage 3: Review & Harvesting (`review.php`)

Harvesting occurs automatically the instant the student submits the quiz and lands on the review page.

#### The 4-Tier Ground Truth Deduction Engine

The harvester audits Moodle's review DOM using four distinct verification signals:

```
┌───────────────────────────────────────────────────────────┐
│ 1. Explicit Feedback (.rightanswer box)                  │
├───────────────────────────────────────────────────────────┤
│ 2. Per-Choice Checkmarks (fa-check) & Crosses (fa-remove) │
├───────────────────────────────────────────────────────────┤
│ 3. Full Mark Score (e.g. 1.00 out of 1.00)                │
├───────────────────────────────────────────────────────────┤
│ 4. Zero Mark Score (e.g. 0.00 out of 1.00) ──► Eliminated │
└───────────────────────────────────────────────────────────┘
```

1. **Explicit Moodle Feedback (`.rightanswer`)**:
   - Captures Moodle's feedback block (`"The correct answer is: [XYZ]"`).
   - Handles both single answers and comma-delimited multi-choice sets.
2. **Ground-Truth Checkmarks & Crosses**:
   - Inspects Moodle's `fa-check` (green tick) and `fa-remove` (red cross) icons next to individual options.
   - Any option bearing a checkmark is marked verified, even in partial-scoring questions (e.g., $3.40 / 5.00$).
   - Any option bearing a cross is cataloged into `wrongAnswers`.
3. **Full Mark Score Confirmation**:
   - If the question score parses as $1.00 / 1.00$ (or maximum attainable marks), whatever choice was submitted is verified as correct:
     - **Radio / Checkbox**: Text of the selected input.
     - **Text Field / Cloze**: Value of the input field.
     - **Select Dropdown**: Text of the selected `<option>`.
     - **Drag & Drop**: Text of placed tiles in blanks.
4. **Zero Mark Deduction (Elimination)**:
   - If the question scored $0.00$, the submitted choice is recorded under `wrongAnswers`. In future attempts, this option is crossed out in red. In a True/False question, eliminating one option automatically confirms the other!

---

## 2. Supported Question Types

| Question Type | Moodle Class | How Matching & Answering Works |
| :--- | :--- | :--- |
| **Multiple Choice (Single)** | `.multichoice` (radio) | Highlighting, 1-click select, auto-advance. |
| **Multiple Choice (Multi)** | `.multichoice` (checkbox) | Checks all verified choices; enforces completion gate before advancing. |
| **True / False** | `.truefalse` | Highlighting; bidirectional elimination (wrong False proves True). |
| **Short Answer / Cloze** | `.shortanswer`, `.cloze` | Injects 1-click fill pill (`.amaes-shortans-hint`); auto-types into text input. |
| **Dropdown Matching** | `.match`, `.gapselect` | Matches `<select>` options against prompt and sets `selectedIndex`. |
| **Drag-and-Drop Text** | `.ddwtos`, `.ddimageortext` | Injects 1-click `[Place]` buttons on drop blanks (`.amaes-drag-hint`). |

---

## 3. Real-World Scenarios Walkthrough

### Scenario A: First Student on a New Subject (Empty Database)
1. Student opens quiz $\rightarrow$ No answers exist in local cache or community relay.
2. Question cards show `[Copy AI]` button and prompt: *"Be the first to answer and share it!"*
3. Student uses AI or course notes to answer and submits.
4. On `review.php`, the harvester runs automatically:
   - Correct choices are saved to `localStorage`.
   - If anonymous sharing is ON, answers are queued and transmitted to the Cloudflare relay.
   - Question cards display `Uploaded to DB` badges.

### Scenario B: Second Attempt (or Another Student Takes the Quiz)
1. Student opens quiz $\rightarrow$ Questions match against previously harvested data.
2. Verified answers immediately light up with **green highlights** and checkmarks.
3. In Auto-Quiz mode, answers are selected autonomously with 100% accuracy.

### Scenario C: Incorrect Guess on Previous Attempt
1. On Attempt 1, the student guessed Option B and received $0.00 / 1.00$.
2. The harvester recorded Option B into `wrongAnswers`.
3. On Attempt 2, Option B is **crossed out in red strikethrough** with `(❌ Eliminated)`.
4. If it was True/False: The other option lights up in green as the verified correct answer.
5. If it had 4 choices: The search space is reduced to 3 choices.

### Scenario D: Multi-Answer Checkbox Questions
1. Question requires multiple checkboxes to be ticked.
2. The harvester extracts all checked choices into a unified answer array.
3. On the next attempt, all valid checkboxes are highlighted.
4. Pressing <kbd>V</kbd> or running Auto-Quiz checks all valid checkboxes simultaneously.
5. The auto-next gate ensures all verified checkboxes are checked before the solver clicks *"Next page"*.

### Scenario E: Private / Offline Mode
1. Student turns OFF *"Collect & Share Anonymously"* in the Database tab.
2. On `review.php`, questions display `Saved Locally`.
3. No outbound network requests are made to Cloudflare or GitHub; all data remains in the student's browser.
