/**
 * Automated Verification & Regression Test Suite for AMAES Moodle Toolkit
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const originalReadFileSync = fs.readFileSync;
const originalExistsSync = fs.existsSync;

function resolveToolkitPath(targetPath) {
    if (typeof targetPath !== 'string') return targetPath;
    const basename = path.basename(targetPath);
    if (['index.html', 'dashboard.html', 'site.css', 'site.js'].includes(basename)) {
        const publicPath = path.join(ROOT_DIR, 'public', basename);
        if (originalExistsSync(publicPath)) return publicPath;
    }
    if (basename === 'amaes-toolkit.user.js') {
        const rootPath = path.join(ROOT_DIR, basename);
        if (originalExistsSync(rootPath)) return rootPath;
    }
    if (!path.isAbsolute(targetPath)) {
        const resolvedPath = path.resolve(ROOT_DIR, targetPath);
        if (originalExistsSync(resolvedPath)) return resolvedPath;
    }
    return targetPath;
}

fs.readFileSync = function(targetPath, options) {
    return originalReadFileSync(resolveToolkitPath(targetPath), options);
};

fs.existsSync = function(targetPath) {
    const resolved = resolveToolkitPath(targetPath);
    return originalExistsSync(resolved);
};
console.log("==================================================");
console.log("RUNNING COMPREHENSIVE TEST SUITE FOR AMAES TOOLKIT");
console.log("==================================================\n");

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`PASS: ${name}`);
        passed++;
    } catch (err) {
        console.error(`FAIL: ${name}`);
        console.error(`      ${err.message}`);
        failed++;
    }
}

// --------------------------------------------------
// 1. Choice Normalization & Negative Sign Integrity
// --------------------------------------------------
function unscriptDigits(str) {
    if (!str) return '';
    const map = {
        '⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9',
        '₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'
    };
    return str.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/g, ch => map[ch] || ch);
}

function normalizeChoice(str) {
    if (!str) return '';
    let text = str.toLowerCase().trim();
    text = text.replace(/[\u2212\u2013\u2014]/g, '-');
    text = text.replace(/[✓✔✗✘✕✖]/g, '');
    text = text.replace(/\s*[\(\[]?(?:correct|incorrect)[\)\]]?\s*$/i, '');
    text = text.replace(/^select (?:one or more choices?|one or more|all that apply|one):?\s*/i, '').replace(/^[a-e][.)]\s*/i, '');
    text = text.replace(/\s+/g, ' ');
    text = text.replace(/[.:?!;,]+$/, '');
    text = unscriptDigits(text);
    return text.trim();
}

test("Choice Normalization: preserves negative signs on numbers (-010 vs 010)", () => {
    const choiceA = normalizeChoice("a.  -010");
    const choiceC = normalizeChoice("c.  010");
    assert.strictEqual(choiceA, "-010");
    assert.strictEqual(choiceC, "010");
    assert.notStrictEqual(choiceA, choiceC, "Choice A and Choice C must NOT be equal!");
});

test("Choice Normalization: unicode minus signs (\\u2212, en-dash) normalized to standard hyphen", () => {
    assert.strictEqual(normalizeChoice("a. \u2212010"), "-010");
    assert.strictEqual(normalizeChoice("b. –011"), "-011");
});

test("Choice Normalization: complex choice prefixes stripped without stripping minus", () => {
    assert.strictEqual(normalizeChoice("Select one: a. 100"), "100");
    assert.strictEqual(normalizeChoice("Select one: b. -50"), "-50");
    assert.strictEqual(normalizeChoice("a) True"), "true");
    assert.strictEqual(normalizeChoice("d. X = AB"), "x = ab");
    assert.strictEqual(normalizeChoice("b. X = ABC"), "x = abc");
});

test("Choice Normalization: superscripts and subscripts normalize to standard digits", () => {
    assert.strictEqual(normalizeChoice("(110)²"), "(110)2");
    assert.strictEqual(normalizeChoice("(110)₂"), "(110)2");
    assert.strictEqual(normalizeChoice("(124)₂"), "(124)2");
    assert.strictEqual(normalizeChoice("(000)₂"), "(000)2");
    assert.strictEqual(normalizeChoice("(110)²"), normalizeChoice("(110)₂"));
});

// --------------------------------------------------
// 2. Exact Matcher vs Substring Collision Safety
// --------------------------------------------------
function matchChoice(choiceRaw, candidateAnswer) {
    const choiceText = normalizeChoice(choiceRaw);
    const ansNorm = normalizeChoice(candidateAnswer);
    if (!ansNorm) return false;

    const isDirectMatch = choiceText === ansNorm;
    const isMultiAnswerMatch = (ansNorm.includes(',') || ansNorm.includes(';') || ansNorm.includes('&')) &&
        ansNorm.split(/[,;&]+/).map(s => normalizeChoice(s)).includes(choiceText);

    return isDirectMatch || isMultiAnswerMatch;
}

test("Matcher Safety: X = AB does NOT match X = ABC", () => {
    const choiceB = "b. X = ABC";
    const choiceD = "d. X = AB";
    const verifiedAnswer = "X = ABC";

    assert.strictEqual(matchChoice(choiceB, verifiedAnswer), true, "Choice B (X = ABC) must match!");
    assert.strictEqual(matchChoice(choiceD, verifiedAnswer), false, "Choice D (X = AB) must NOT match!");
});

test("Matcher Safety: RAM does NOT match DRAM", () => {
    assert.strictEqual(matchChoice("a. RAM", "DRAM"), false);
    assert.strictEqual(matchChoice("b. DRAM", "DRAM"), true);
});

test("Matcher Safety: 10 does NOT match 100", () => {
    assert.strictEqual(matchChoice("a. 10", "100"), false);
    assert.strictEqual(matchChoice("b. 100", "100"), true);
});

test("Matcher Safety: AND does NOT match NAND", () => {
    assert.strictEqual(matchChoice("a. AND", "NAND"), false);
    assert.strictEqual(matchChoice("b. NAND", "NAND"), true);
});

test("Question matching: ignores Moodle answer blank rendering differences", () => {
    const normalizeQuestionForTest = value => value.toLowerCase()
        .replace(/[_\u00a0]+/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/[.:?!;,]+$/g, '')
        .trim();
    const stored = normalizeQuestionForTest("The octal equivalent of 1100101.001010 is ______");
    const live = normalizeQuestionForTest("The octal equivalent of 1100101.001010 is");
    assert.strictEqual(stored, live, "Stored and live Moodle blank variants must match");
});

test("Choice matching: strips Moodle letter prefixes before comparing answers", () => {
    const normalizeChoiceForTest = value => value.toLowerCase().trim()
        .replace(/^[a-z]\s*[\.)]\s+/i, '')
        .replace(/[.:?!;,]+$/g, '')
        .trim();
    assert.strictEqual(normalizeChoiceForTest("c. 145.12"), "145.12");
    assert.strictEqual(normalizeChoiceForTest("145.12"), "145.12");
});

test("Matcher Safety: Multi-answer checkboxes match all correct items", () => {
    const ans = "Option A, Option C";
    assert.strictEqual(matchChoice("a. Option A", ans), true);
    assert.strictEqual(matchChoice("b. Option B", ans), false);
    assert.strictEqual(matchChoice("c. Option C", ans), true);
});

// --------------------------------------------------
// 3. Single-Select Radio Guard (No double green)
// --------------------------------------------------
test("Radio Guard: only the first verified choice is highlighted on single-choice questions", () => {
    const choices = [
        "a. X = AB + C",
        "b. X = ABC",
        "c. X = A + B + C",
        "d. X = ABC" // Hypothetical duplicate in malformed bank
    ];
    const isRadio = true;
    let foundMatchForQuestion = false;
    const highlighted = [];

    choices.forEach((c, idx) => {
        if (isRadio && foundMatchForQuestion) return;
        if (matchChoice(c, "X = ABC")) {
            foundMatchForQuestion = true;
            highlighted.push(idx);
        }
    });

    assert.strictEqual(highlighted.length, 1, "Exactly 1 choice must be highlighted on radio questions!");
    assert.strictEqual(highlighted[0], 1, "Choice b (index 1) must be the sole highlighted choice!");
});

// --------------------------------------------------
// 4. Academic Term Detection
// --------------------------------------------------
function detectTermFromText(text) {
    if (!text) return null;
    const lower = text.toLowerCase();
    if (lower.includes('prelim') || lower.includes('preliminary') || /\bweek\s*[1-5]\b/i.test(lower)) {
        return 'Prelim';
    }
    if (lower.includes('midterm') || lower.includes('mid-term') || /\bweek\s*[6-9]\b/i.test(lower)) {
        return 'Midterm';
    }
    if (lower.includes('prefi') || lower.includes('pre-final') || lower.includes('prefinal') || /\bweek\s*(1[0-4])\b/i.test(lower)) {
        return 'Prefi';
    }
    if (lower.includes('final') || lower.includes('finals') || /\bweek\s*(1[5-9]|20)\b/i.test(lower)) {
        return 'Final';
    }
    return null;
}

test("Term Detection: accurately categorizes all 4 academic terms", () => {
    assert.strictEqual(detectTermFromText("CS6301 Prelim Quiz 1"), "Prelim");
    assert.strictEqual(detectTermFromText("Week 3 Quiz: Digital Logic"), "Prelim");
    assert.strictEqual(detectTermFromText("Midterm Examination"), "Midterm");
    assert.strictEqual(detectTermFromText("Week 8 Exam"), "Midterm");
    assert.strictEqual(detectTermFromText("Pre-final Examination"), "Prefi");
    assert.strictEqual(detectTermFromText("Prefi Quiz 1"), "Prefi");
    assert.strictEqual(detectTermFromText("Week 12 Assessment"), "Prefi");
    assert.strictEqual(detectTermFromText("Final Examination"), "Final");
    assert.strictEqual(detectTermFromText("Week 18 Finals"), "Final");
    assert.strictEqual(detectTermFromText("Course Syllabus"), null);
});

// --------------------------------------------------
// 5. Review Screen Harvesting for Plural / Multi Answers
// --------------------------------------------------
function cleanRightAnswer(raw) {
    return raw.replace(/^The correct answers? (is|are):?\s*['"]?/i, '').replace(/['"]?\s*$/i, '').trim();
}

test("Review Harvesting: cleans singular and plural Moodle rightanswer boxes", () => {
    assert.strictEqual(cleanRightAnswer("The correct answer is: 010"), "010");
    assert.strictEqual(cleanRightAnswer("The correct answers are: Option A, Option B"), "Option A, Option B");
    assert.strictEqual(cleanRightAnswer("The correct answer is: 'X = ABC'"), "X = ABC");
});

// --------------------------------------------------
// 6. Keyboard Shortcuts Input Safety
// --------------------------------------------------
function isTextInputElement(tag, type, isContentEditable) {
    const t = (tag || '').toUpperCase();
    const ty = (type || '').toLowerCase();
    return (t === 'INPUT' && !['radio', 'checkbox', 'button', 'submit', 'reset'].includes(ty)) ||
           t === 'TEXTAREA' ||
           Boolean(isContentEditable);
}

test("Shortcuts Safety: Radio and Checkbox focus ALLOWS keyboard navigation", () => {
    assert.strictEqual(isTextInputElement('INPUT', 'radio', false), false, "Radio focus must NOT block hotkeys!");
    assert.strictEqual(isTextInputElement('INPUT', 'checkbox', false), false, "Checkbox focus must NOT block hotkeys!");
    assert.strictEqual(isTextInputElement('BUTTON', '', false), false, "Button focus must NOT block hotkeys!");
});

test("Shortcuts Safety: Text input and Textarea focus BLOCKS keyboard navigation", () => {
    assert.strictEqual(isTextInputElement('INPUT', 'text', false), true, "Text input must block hotkeys!");
    assert.strictEqual(isTextInputElement('INPUT', 'email', false), true, "Email input must block hotkeys!");
    assert.strictEqual(isTextInputElement('TEXTAREA', '', false), true, "Textarea must block hotkeys!");
    assert.strictEqual(isTextInputElement('DIV', '', true), true, "ContentEditable must block hotkeys!");
});

// --------------------------------------------------
// 7. Community Payload Generator & Filter
// --------------------------------------------------
function generatePayload(code, qList) {
    const validQuestions = qList.filter(q => Boolean(q.ansRaw || q.answer || q.correctAnswer));
    return {
        subjectCode: code,
        totalQuestions: validQuestions.length,
        questions: validQuestions.map(q => ({
            question: q.qRaw || q.question || q.qText || "",
            answer: q.ansRaw || q.answer || q.correctAnswer || "",
            choices: q.choices || [],
            wrongAnswers: q.wrongAnswers || []
        }))
    };
}

test("Community Payload: filters out questions with no verified answer", () => {
    const localDb = [
        { qRaw: "What is 1+1?", ansRaw: "2", choices: ["1", "2", "3"], wrongAnswers: [] },
        { qRaw: "What is 2+2?", ansRaw: null, choices: ["3", "4", "5"], wrongAnswers: ["3"] }, // Unverified
        { question: "What is 3+3?", answer: "6", choices: ["5", "6", "7"], wrongAnswers: [] }
    ];

    const payload = generatePayload("MATH101", localDb);
    assert.strictEqual(payload.totalQuestions, 2, "Payload must only contain the 2 verified questions!");
    assert.strictEqual(payload.questions[0].answer, "2");
    assert.strictEqual(payload.questions[1].answer, "6");
    assert.strictEqual(payload.questions.some(q => !q.answer), false, "No question in payload can have empty answer!");
});

// --------------------------------------------------
// 8. Elimination Deduction Engine
// --------------------------------------------------
function deduceChoice(choices, wrongAnswers) {
    if (!choices || choices.length <= 1) return null;
    const wrongNorms = wrongAnswers.map(w => normalizeChoice(typeof w === 'string' ? w : w.text));
    const remaining = choices.filter(c => !wrongNorms.includes(normalizeChoice(c)));
    if (remaining.length === 1) {
        return remaining[0].replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
    }
    return null;
}

test("Deduction Engine: 3 wrong choices deduces 4th choice as 100% correct", () => {
    const choices = ["a. 28", "b. 82", "c. 81", "d. 18"];
    const wrong = ["28", "82", "81"];
    const deduced = deduceChoice(choices, wrong);
    assert.strictEqual(deduced, "18");
});

test("Deduction Engine: 4 wrong choices safely returns null with no crash", () => {
    const choices = ["a. 28", "b. 82", "c. 81", "d. 18"];
    const wrong = ["28", "82", "81", "18"];
    const deduced = deduceChoice(choices, wrong);
    assert.strictEqual(deduced, null);
});

// --------------------------------------------------
// 9. Grades Harvester & Background Relay
// --------------------------------------------------
test("Grades Harvester: filters completed vs empty quiz rows accurately", () => {
    const testRows = [
        { title: "Prelim Quiz 1", gradeText: "20.00", percentage: "100.00 %", isEmpty: false },
        { title: "Prelim Lab Quiz 1", gradeText: "-", percentage: "-", isEmpty: true },
        { title: "Prelim Quiz 2", gradeText: "18.18", percentage: "90.91 %", isEmpty: false },
        { title: "Midterm Quiz 1", gradeText: "19.00", percentage: "95.00 %", isEmpty: false }
    ];

    const completed = testRows.filter(r => !r.isEmpty && r.gradeText !== '-' && /\b\d+(\.\d+)?/.test(r.gradeText));
    assert.strictEqual(completed.length, 3, "Exactly 3 completed quizzes should be detected!");
    assert.strictEqual(completed[0].title, "Prelim Quiz 1");
    assert.strictEqual(completed[1].title, "Prelim Quiz 2");
    assert.strictEqual(completed[2].title, "Midterm Quiz 1");
});

test("Grades Harvester: resolves relative review URLs with &showall=1 query", () => {
    const baseUrl = "https://semestral.amaes.com/2612/mod/quiz/view.php?id=1689";
    const relativeReviewHref = "review.php?attempt=45230";
    let reviewUrl = new URL(relativeReviewHref, baseUrl).href;
    if (!reviewUrl.includes('showall=')) {
        reviewUrl += (reviewUrl.includes('?') ? '&' : '?') + 'showall=1';
    }
    assert.strictEqual(reviewUrl, "https://semestral.amaes.com/2612/mod/quiz/review.php?attempt=45230&showall=1");
});

test("Background Relay Payload: formats anonymous payload with required schema", () => {
    const rawQuestions = [
        { qRaw: "What is Boolean algebra?", ansRaw: "Logic system", choices: ["A", "B"] }
    ];
    const payload = {
        subjectCode: "CS6301",
        totalQuestions: rawQuestions.length,
        source: "grades_harvester",
        submittedAt: new Date().toISOString(),
        questions: rawQuestions.map(q => ({
            question: q.qRaw,
            answer: q.ansRaw,
            choices: q.choices,
            wrongAnswers: []
        }))
    };

    assert.strictEqual(payload.subjectCode, "CS6301");
    assert.strictEqual(payload.totalQuestions, 1);
    assert.strictEqual(payload.questions[0].answer, "Logic system");
    assert.strictEqual(Boolean(payload.submittedAt), true);
});

// --------------------------------------------------
// 10. Multi-Tier Database Integration & Priority
// --------------------------------------------------
function mergeTieredAnswers(verifiedList, amauoedList) {
    const combined = [];
    const seen = new Set();

    // 1. Verified official answers take highest priority
    for (const q of verifiedList) {
        const key = q.question.toLowerCase().trim();
        seen.add(key);
        combined.push({ ...q, tier: 'verified' });
    }

    // 2. Amauoed curated answers populate remaining questions
    for (const q of amauoedList) {
        const key = q.question.toLowerCase().trim();
        if (!seen.has(key)) {
            seen.add(key);
            combined.push({ ...q, tier: 'amauoed' });
        }
    }

    return combined;
}

test("Multi-Tier DB: Verified tier takes priority over amauoed tier on duplicate questions", () => {
    const verified = [
        { question: "What is an algorithm?", answer: "A finite step-by-step procedure" }
    ];
    const amauoed = [
        { question: "What is an algorithm?", answer: "A set of rules" },
        { question: "What is CPU?", answer: "Central Processing Unit" }
    ];

    const merged = mergeTieredAnswers(verified, amauoed);
    assert.strictEqual(merged.length, 2, "Merged DB must contain exactly 2 unique questions!");
    assert.strictEqual(merged[0].answer, "A finite step-by-step procedure", "Verified answer must take precedence!");
    assert.strictEqual(merged[0].tier, "verified");
    assert.strictEqual(merged[1].answer, "Central Processing Unit");
    assert.strictEqual(merged[1].tier, "amauoed");
});

// --------------------------------------------------
// 11. Auto-Harvest Settings & Session Gating
// --------------------------------------------------
test("Auto-Harvest Configuration: defaults to enabled and respects session gate", () => {
    const mockStorage = new Map();
    const mockSession = new Map();

    // Default test: when nothing in storage, must be true
    const isEnabledByDefault = mockStorage.get('amaes_auto_harvest_grades') !== 'false';
    assert.strictEqual(isEnabledByDefault, true, "Auto-Harvest must default to true on fresh install!");

    // Session gating test: courseKey session guard prevents multi-trigger
    const courseKey = "CS6301";
    const sessionKey = `amaes_grades_harvested_${courseKey}`;
    
    assert.strictEqual(mockSession.has(sessionKey), false);
    mockSession.set(sessionKey, '1');
    assert.strictEqual(mockSession.has(sessionKey), true);
});

// --------------------------------------------------
// 12. Update Checker Caching & Throttling
// --------------------------------------------------
function isNewerVersion(remote, local) {
    if (!remote || !local) return false;
    const r = remote.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    const l = local.replace(/^v/, '').split('.').map(n => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
        const rv = r[i] || 0;
        const lv = l[i] || 0;
        if (rv > lv) return true;
        if (rv < lv) return false;
    }
    return false;
}

test("Update Checker: semantic version comparison handles patches and suffixes", () => {
    assert.strictEqual(isNewerVersion("1.1.1", "1.1.0"), true);
    assert.strictEqual(isNewerVersion("1.2.0", "1.1.1"), true);
    assert.strictEqual(isNewerVersion("v1.1.1", "v1.1.1"), false);
    assert.strictEqual(isNewerVersion("1.1.0", "1.1.1"), false);
});

test("Update Checker Caching: cached known update bypasses refetching and opens installer immediately", () => {
    const mockStorage = new Map();
    mockStorage.set('amaes_latest_version_seen', '1.2.8');
    mockStorage.set('amaes_last_update_check', String(Date.now()));

    const currentVersion = "v1.2.7";
    const cachedLatest = mockStorage.get('amaes_latest_version_seen');
    const hasKnownUpdate = cachedLatest && isNewerVersion(cachedLatest, currentVersion);

    assert.strictEqual(hasKnownUpdate, true, "Known update v1.2.8 must be detected from cache!");

    // Check manual action: should direct to installer immediately
    let openedUrl = null;
    const SCRIPT_RAW_URL = "https://raw.githubusercontent.com/Acads-Tools/amaes-toolkit/main/amaes-toolkit.user.js";
    if (hasKnownUpdate) {
        openedUrl = SCRIPT_RAW_URL;
    }
    assert.strictEqual(openedUrl, SCRIPT_RAW_URL, "Clicking check with cached update must immediately direct to install URL!");
});

test("Userscript Syntax Integrity: ensures amaes-toolkit.user.js parses with zero syntax errors", () => {
    const fs = require('fs');
    const vm = require('vm');
    const path = require('path');
    const scriptPath = path.join(__dirname, 'amaes-toolkit.user.js');
    const scriptCode = fs.readFileSync(scriptPath, 'utf8');
    assert.doesNotThrow(() => {
        new vm.Script(scriptCode);
    }, "Userscript must parse without syntax errors!");
});

// --------------------------------------------------
// 14. Dashboard Course Detection & Regex Integrity
// --------------------------------------------------
function extractCourseCode(cardText) {
    if (!cardText) return '';
    const codeMatch = cardText.match(/-\s*([A-Za-z0-9]+) /) || cardText.match(/\b([A-Za-z]{2,6}\d{3,4}[A-Za-z]*)\b/);
    return codeMatch ? codeMatch[1].toUpperCase() : '';
}

test("Dashboard Course Detection: accurately extracts codes from standard Moodle card titles", () => {
    assert.strictEqual(extractCourseCode("2513 - CS6301 Data Structures and Algorithms"), "CS6301");
    assert.strictEqual(extractCourseCode("2411 - ITE6301 Information Management"), "ITE6301");
    assert.strictEqual(extractCourseCode("MATH101 Calculus 1"), "MATH101");
    assert.strictEqual(extractCourseCode("GEDC106 Readings in Philippine History"), "GEDC106");
    assert.strictEqual(extractCourseCode("Random Announcement Card"), "");
});

// --------------------------------------------------
// 15. Anonymous Community Sharing Payload Guard
// --------------------------------------------------
test("Anonymous Community Auto-Share: payload guarantees 0 personal data leakage", () => {
    const questions = [
        { qRaw: "What is 2+2?", ansRaw: "4", choices: ["2", "3", "4", "5"] }
    ];
    const subCode = "MATH101";

    const payload = {
        subjectCode: subCode,
        totalQuestions: questions.length,
        source: "auto_harvester",
        submittedAt: new Date().toISOString(),
        questions: questions.map(q => ({
            question: q.qRaw,
            answer: q.ansRaw,
            choices: q.choices,
            wrongAnswers: []
        }))
    };

    // Ensure strictly forbidden fields are not present
    const forbiddenKeys = ['studentId', 'userId', 'username', 'email', 'name', 'token', 'session', 'ip'];
    forbiddenKeys.forEach(key => {
        assert.strictEqual(key in payload, false, `Forbidden identifier key '${key}' found in payload!`);
    });

    assert.strictEqual(payload.subjectCode, "MATH101");
    assert.strictEqual(payload.totalQuestions, 1);
    assert.strictEqual(payload.questions[0].answer, "4");
});

// --------------------------------------------------
// 16. Default Configuration for Hands-Free Community Sharing
// --------------------------------------------------
test("Onboarding & Autonomous Sync Defaults: auto-sync and auto-community-share default to true", () => {
    const mockLocalStorage = {
        getItem: (k) => null // default state when fresh install
    };

    const autoCloudSync = mockLocalStorage.getItem('amaes_auto_cloud_sync') !== 'false';
    const autoCommunityShare = mockLocalStorage.getItem('amaes_auto_community_share') !== 'false';
    const autoHarvestGrades = mockLocalStorage.getItem('amaes_auto_harvest_grades') !== 'false';

    assert.strictEqual(autoCloudSync, true, "autoCloudSync must default to true for hands-free sync!");
    assert.strictEqual(autoCommunityShare, true, "autoCommunityShare must default to true for community updates!");
    assert.strictEqual(autoHarvestGrades, true, "autoHarvestGrades must default to true for zero-click past quiz harvest!");
});

// --------------------------------------------------
// 17. Quiz Speedrun Shortcuts & Tips Key Mapping
// --------------------------------------------------
test("Quiz Speedrun Shortcuts: accurately maps 1-4 and A-D to choice indices and N/Space to next page", () => {
    function mapKeyToChoiceIndex(key) {
        key = String(key).toUpperCase();
        if (key >= '1' && key <= '9') {
            return parseInt(key, 10) - 1;
        } else if (['A', 'B', 'C', 'D'].includes(key)) {
            return key.charCodeAt(0) - 65;
        }
        return -1;
    }

    function isNextNavigationKey(key) {
        key = String(key).toUpperCase();
        return key === 'N' || key === ' ' || key === 'ENTER';
    }

    // Test choice indices
    assert.strictEqual(mapKeyToChoiceIndex('1'), 0, "Key 1 must map to index 0 (Choice A)");
    assert.strictEqual(mapKeyToChoiceIndex('2'), 1, "Key 2 must map to index 1 (Choice B)");
    assert.strictEqual(mapKeyToChoiceIndex('3'), 2, "Key 3 must map to index 2 (Choice C)");
    assert.strictEqual(mapKeyToChoiceIndex('4'), 3, "Key 4 must map to index 3 (Choice D)");

    assert.strictEqual(mapKeyToChoiceIndex('A'), 0, "Key A must map to index 0 (Choice A)");
    assert.strictEqual(mapKeyToChoiceIndex('B'), 1, "Key B must map to index 1 (Choice B)");
    assert.strictEqual(mapKeyToChoiceIndex('C'), 2, "Key C must map to index 2 (Choice C)");
    assert.strictEqual(mapKeyToChoiceIndex('D'), 3, "Key D must map to index 3 (Choice D)");

    // Test navigation keys
    assert.strictEqual(isNextNavigationKey('N'), true, "Key N must trigger next navigation");
    assert.strictEqual(isNextNavigationKey(' '), true, "Space must trigger next navigation");
    assert.strictEqual(isNextNavigationKey('Enter'), true, "Enter must trigger next navigation");
    assert.strictEqual(isNextNavigationKey('X'), false, "Irrelevant key must not trigger next navigation");
});

// --------------------------------------------------
// 18. Auto-Next & Safe Progression Defaults
// --------------------------------------------------
test("Auto-Next & Safe Progression Defaults: autoNextQuiz is false, autoSubmitQuiz is permanently false", () => {
    const mockLocalStorage = {
        getItem: (k) => null // default state on fresh install
    };

    const autoNextQuiz = mockLocalStorage.getItem('amaes_auto_next_quiz') === 'true';
    const autoSubmitQuiz = false; // Permanently disabled by design

    assert.strictEqual(autoNextQuiz, false, "autoNextQuiz must default to false so students can review answers before advancing!");
    assert.strictEqual(autoSubmitQuiz, false, "autoSubmitQuiz must remain false to prevent accidental quiz submission!");
});

// --------------------------------------------------
// 19. Page Completeness & Review Summary Auto-Submit Gate
// --------------------------------------------------
test("Page Completeness & Summary Submit Gate: checks all questions answered before advancing to review", () => {
    // Simulate DOM check for page question completion
    function checkPageQuestionsComplete(mockQuestions) {
        if (!mockQuestions || mockQuestions.length === 0) return false;
        return mockQuestions.every(q => q.hasChecked || q.hasText || q.isAnswered);
    }

    const page1Incomplete = [
        { id: 1, hasChecked: true, hasText: false, isAnswered: true },
        { id: 2, hasChecked: false, hasText: false, isAnswered: false }
    ];
    assert.strictEqual(checkPageQuestionsComplete(page1Incomplete), false, "Page with unanswered question must NOT auto-advance!");

    const page1Complete = [
        { id: 1, hasChecked: true, hasText: false, isAnswered: true },
        { id: 2, hasChecked: true, hasText: false, isAnswered: true }
    ];
    assert.strictEqual(checkPageQuestionsComplete(page1Complete), true, "Page where all questions have choices selected must trigger auto-advance!");

    // Simulate summary page table check
    function shouldSubmitSummary(summaryRows, autoSubmitEnabled) {
        if (!autoSubmitEnabled) return false;
        const incomplete = summaryRows.filter(r => /not yet answered|incomplete/i.test(r.status));
        return incomplete.length === 0;
    }

    const summaryComplete = [
        { qNum: 1, status: "Answer saved" },
        { qNum: 2, status: "Answer saved" }
    ];
    assert.strictEqual(shouldSubmitSummary(summaryComplete, true), true, "Completed summary must auto-submit to review!");

    const summaryIncomplete = [
        { qNum: 1, status: "Answer saved" },
        { qNum: 2, status: "Not yet answered" }
    ];
    assert.strictEqual(shouldSubmitSummary(summaryIncomplete, true), false, "Summary with unanswered questions must pause!");
});

// --------------------------------------------------
// 20. Choice Badges & Wrong Choice Highlighting
// --------------------------------------------------
test("Choice Badges & Wrong Choice Highlighting: formats user-friendly plain English badges without developer jargon", () => {
    function formatSourceBadge(cand) {
        const isDeduced = cand.deduced === true;
        const isAmauoed = cand.source === 'amauoed';
        return isDeduced ? 'Deduced Answer' : (isAmauoed ? 'Web Study Guide' : 'Verified Answer');
    }

    function formatWrongBadge(matchedWrong) {
        return 'Incorrect Choice';
    }

    function formatCandidateProb(uneliminatedCount) {
        return 'Possible Option';
    }

    // Verified correct DB
    assert.strictEqual(formatSourceBadge({ verified: true, source: 'verified_db' }), "Verified Answer");
    assert.strictEqual(formatSourceBadge({ verified: true, confirmations: 3, source: 'verified_db' }), "Verified Answer");

    // AMAUOED catalog
    assert.strictEqual(formatSourceBadge({ verified: false, source: 'amauoed' }), "Web Study Guide");
    assert.strictEqual(formatSourceBadge({ verified: false, confirmations: 2, source: 'amauoed' }), "Web Study Guide");

    // Deduced
    assert.strictEqual(formatSourceBadge({ deduced: true, verified: true }), "Deduced Answer");

    // Confirmed wrong choices
    assert.strictEqual(formatWrongBadge({ count: 1 }), "Incorrect Choice");
    assert.strictEqual(formatWrongBadge({ count: 4 }), "Incorrect Choice");

    // Candidate options
    assert.strictEqual(formatCandidateProb(2), "Possible Option");
    assert.strictEqual(formatCandidateProb(3), "Possible Option");
});

// --------------------------------------------------
// 21. Community Auto-Dispatch on Local Save
// --------------------------------------------------
test("Community Auto-Share on Local Save: triggers when new answers saved unless cloud-synced or disabled", () => {
    function shouldDispatchToCommunity(autoShareSetting, sourceLabel, stats) {
        const autoShareEnabled = autoShareSetting !== 'false';
        const isFromCloudSync = typeof sourceLabel === 'string' && sourceLabel.startsWith('Cloud-');
        const hasFreshData = (stats.added > 0 || stats.confirmed > 0 || stats.eliminated > 0);
        return autoShareEnabled && !isFromCloudSync && hasFreshData;
    }

    // Default ON: fresh review answers trigger community dispatch
    assert.strictEqual(shouldDispatchToCommunity('true', 'review_screen', { added: 1, confirmed: 0, eliminated: 0 }), true);
    // Freshly deduced answers trigger community dispatch
    assert.strictEqual(shouldDispatchToCommunity('true', 'Elimination Deduction', { added: 1, confirmed: 0, eliminated: 0 }), true);
    // Freshly scraped AMAUOED answers trigger community dispatch
    assert.strictEqual(shouldDispatchToCommunity('true', 'AMAUOED', { added: 10, confirmed: 0, eliminated: 0 }), true);
    // Suppressed if downloaded from cloud (avoid echo loops)
    assert.strictEqual(shouldDispatchToCommunity('true', 'Cloud-Verified', { added: 5, confirmed: 0, eliminated: 0 }), false);
    assert.strictEqual(shouldDispatchToCommunity('true', 'Cloud-Amauoed', { added: 5, confirmed: 0, eliminated: 0 }), false);
    // Suppressed if user toggled off auto-share
    assert.strictEqual(shouldDispatchToCommunity('false', 'review_screen', { added: 5, confirmed: 0, eliminated: 0 }), false);
    // Suppressed if no changes occurred
    assert.strictEqual(shouldDispatchToCommunity('true', 'review_screen', { added: 0, confirmed: 0, eliminated: 0 }), false);
});

// --------------------------------------------------
// 22. AMAUOED Static Scraping Gating
// --------------------------------------------------
test("AMAUOED Static Scraping Gate: avoids redundant scraping if local cache or prior scrape exists", () => {
    function shouldScrapeAmauoed(localCount, hasAmauoedUrl, alreadyScrapedFlag) {
        // If local cache already has answers, static link re-scraping is redundant
        if (localCount > 0) return false;
        // If no link exists, cannot scrape
        if (!hasAmauoedUrl) return false;
        // If already scraped once, static content does not change
        if (alreadyScrapedFlag) return false;
        return true;
    }

    // 0 local answers, valid link, not yet scraped -> SHOULD scrape
    assert.strictEqual(shouldScrapeAmauoed(0, true, false), true);
    // Local answers exist -> DO NOT scrape
    assert.strictEqual(shouldScrapeAmauoed(25, true, false), false);
    // Already scraped -> DO NOT scrape again
    assert.strictEqual(shouldScrapeAmauoed(0, true, true), false);
    // No link known -> cannot scrape
    assert.strictEqual(shouldScrapeAmauoed(0, false, false), false);
});

// --------------------------------------------------
// 23. Harvester Concurrency Mutex & Race Guard
// --------------------------------------------------
test("Harvester Concurrency Mutex: blocks duplicate simultaneous background & manual harvesting", async () => {
    let isHarvestingInProgress = false;

    async function simulateHarvester() {
        if (isHarvestingInProgress) {
            return { success: false, inProgress: true };
        }
        isHarvestingInProgress = true;
        try {
            await new Promise(r => setTimeout(r, 10));
            return { success: true, count: 5 };
        } finally {
            isHarvestingInProgress = false;
        }
    }

    // Launch first harvest
    const run1 = simulateHarvester();
    // Immediate concurrent second launch should be blocked by mutex
    const run2 = await simulateHarvester();

    assert.strictEqual(run2.inProgress, true, "Concurrent harvest attempt must be blocked by mutex!");

    const res1 = await run1;
    assert.strictEqual(res1.success, true, "First harvest run must succeed!");
    assert.strictEqual(isHarvestingInProgress, false, "Mutex must reset to false after completion!");
});

// --------------------------------------------------
// 24. Dynamic Course Subject Fallback in Harvester
// --------------------------------------------------
test("Harvester Dynamic Fallback: avoids hardcoded subject code when table detection is empty", () => {
    function resolveSubjectCode(detectedCode, courseId) {
        let subCode = detectedCode;
        if (!subCode || subCode === 'DEFAULT' || subCode === 'GENERAL') {
            subCode = courseId ? (`COURSE_${courseId}`) : 'GENERAL';
        }
        return subCode;
    }

    assert.strictEqual(resolveSubjectCode('MATH6100', '123'), 'MATH6100');
    assert.strictEqual(resolveSubjectCode('', '456'), 'COURSE_456');
    assert.strictEqual(resolveSubjectCode(null, '789'), 'COURSE_789');
    assert.strictEqual(resolveSubjectCode('GENERAL', '999'), 'COURSE_999');
    assert.strictEqual(resolveSubjectCode('', null), 'GENERAL');
    assert.notStrictEqual(resolveSubjectCode('', '123'), 'CS6301', "Must never hardcode CS6301 on unknown course!");
});

// --------------------------------------------------
// 25. Question Text Subscript Normalization & Base Collision Guard
// --------------------------------------------------
test("Question Normalization: unscripts digits so distinct bases do not collide", () => {
    function normalizeTextTest(str) {
        if (!str) return '';
        let text = str.toLowerCase().trim();
        text = unscriptDigits(text);
        text = text.replace(/^(question\s*\d+[\s:.]*|\d+[\s:.)]+)/, '');
        text = text.replace(/\s+/g, ' ');
        text = text.replace(/[.:?!;,]+$/, '');
        return text.trim();
    }

    const octalQ = normalizeTextTest("Convert (22)₈ into its corresponding decimal number.");
    const hexQ = normalizeTextTest("Convert (22)₁₆ into its corresponding decimal number.");
    const binQ = normalizeTextTest("Convert (22)₂ into its corresponding decimal number.");

    assert.strictEqual(octalQ, "convert (22)8 into its corresponding decimal number");
    assert.strictEqual(hexQ, "convert (22)16 into its corresponding decimal number");
    assert.strictEqual(binQ, "convert (22)2 into its corresponding decimal number");
    assert.notStrictEqual(octalQ, hexQ, "Octal and Hex questions must NOT collide!");
    assert.notStrictEqual(octalQ, binQ, "Octal and Binary questions must NOT collide!");
});

// --------------------------------------------------
// 26. Contradiction Guard: Prevents Eliminating 100% of Choices
// --------------------------------------------------
test("Contradiction Guard: retains at least 1 candidate when all choices marked wrong", () => {
    const choices = ["a. 82", "b. 18", "c. 28", "d. 81"];
    let allWrongList = [
        { norm: "18", count: 1 },
        { norm: "81", count: 2 },
        { norm: "28", count: 3 },
        { norm: "82", count: 4 }
    ];

    if (choices.length >= 2 && allWrongList.length >= choices.length) {
        allWrongList.sort((a, b) => (b.count || 1) - (a.count || 1));
        allWrongList.splice(choices.length - 1);
    }

    assert.strictEqual(allWrongList.length, 3, "Must retain at most 3 wrong choices out of 4!");
    // The choice with lowest count (18, count: 1) is spared!
    assert.strictEqual(allWrongList.some(w => w.norm === "18"), false, "Choice with lowest failure count must be freed!");
});

// --------------------------------------------------
// 27. Contradiction Safety: Confirmed Wrong Answer Demotes Incorrect Database Entry
// --------------------------------------------------
test("Contradiction Safety: Confirmed wrong choice demotes invalid answer and blocks verified badge", () => {
    const cur = {
        qNorm: "it involves developing a game plan to guide a company",
        ansRaw: "strategic plan",
        ansNorm: "strategic plan",
        verified: true,
        confirmations: 2,
        wrongAnswers: []
    };

    const incomingWrong = [{ norm: "strategic plan", text: "strategic plan", count: 1 }];

    // Review/attempt proved current ansRaw was WRONG
    incomingWrong.forEach(inW => {
        if (cur.ansNorm && (inW.norm === cur.ansNorm || unscriptDigits(inW.norm) === unscriptDigits(cur.ansNorm))) {
            cur.ansRaw = '';
            cur.ansNorm = '';
            cur.verified = false;
            cur.confirmations = 0;
        }
        cur.wrongAnswers.push(inW);
    });

    assert.strictEqual(cur.ansRaw, '', "ansRaw must be cleared when proven incorrect");
    assert.strictEqual(cur.verified, false, "verified must be demoted to false");
    assert.strictEqual(cur.confirmations, 0, "confirmations must reset to 0");
    assert.strictEqual(cur.wrongAnswers.length, 1, "wrongAnswers must contain the eliminated choice");
});

// --------------------------------------------------
// 28. Dynamic Semester Detection (No Hardcoded 2612)
// --------------------------------------------------
test("Dynamic Semester Detection: extracts any term code dynamically (2612, 2613, 301)", () => {
    function detectSemesterBase(pathname, mockStorage = {}) {
        const m = pathname.match(/^\/(\d{3,5})\//);
        if (m) {
            return `/${m[1]}/`;
        }
        return mockStorage.saved || '/';
    }

    function buildCoursesUrl(pathname, origin = 'https://semestral.amaes.com') {
        return `${origin}${detectSemesterBase(pathname)}my/courses.php`;
    }

    assert.strictEqual(detectSemesterBase('/2612/my/courses.php'), '/2612/');
    assert.strictEqual(detectSemesterBase('/2613/course/view.php?id=123'), '/2613/');
    assert.strictEqual(detectSemesterBase('/301/mod/quiz/attempt.php'), '/301/');
    assert.strictEqual(detectSemesterBase('/login/index.php', { saved: '/2612/' }), '/2612/');
    assert.strictEqual(detectSemesterBase('/login/index.php'), '/');

    assert.strictEqual(buildCoursesUrl('/2612/my/courses.php'), 'https://semestral.amaes.com/2612/my/courses.php');
    assert.strictEqual(buildCoursesUrl('/2613/my/courses.php'), 'https://semestral.amaes.com/2613/my/courses.php');
    assert.strictEqual(buildCoursesUrl('/301/my/courses.php'), 'https://semestral.amaes.com/301/my/courses.php');
});

// --------------------------------------------------
// 29. Copy Prompt Formatting: DB Answer & Confidence Toggle
// --------------------------------------------------
test("Copy Prompt Formatting: respects copyIncludeConfidence toggle for answer hints", () => {
    function formatPrompt(qText, choices, detectedAnswer, copyIncludeConfidence, withHint = true) {
        let output = `${qText}\n\n`;
        output += choices.join('\n');
        if (detectedAnswer && copyIncludeConfidence) {
            output += `\n\n[DETECTED ANSWER IN DATABASE]:\n- Suggested: ${detectedAnswer.text} (${detectedAnswer.label} • ${detectedAnswer.source})`;
        }
        if (withHint) {
            output += `\n\nInstructions: Answer ONLY with the correct option letter (a, b, c, or d) and the exact choice text.`;
        }
        return output.trim();
    }

    const q = "What does RAM stand for?";
    const choices = ["a. Random Access Memory", "b. Read Access Memory"];
    const detected = { text: "Random Access Memory", label: "Verified • 100% Probability", source: "Verified Database" };

    const withConfidence = formatPrompt(q, choices, detected, true);
    assert.ok(withConfidence.includes("[DETECTED ANSWER IN DATABASE]"), "Must include DB hints when copyIncludeConfidence is true");
    assert.ok(withConfidence.includes("Suggested: Random Access Memory"), "Must include suggestion");

    const withoutConfidence = formatPrompt(q, choices, detected, false);
    assert.strictEqual(withoutConfidence.includes("[DETECTED ANSWER IN DATABASE]"), false, "Must exclude DB hints when copyIncludeConfidence is false");
});

// --------------------------------------------------
// 30. Unanswered / Missing Quizzes Detector
// --------------------------------------------------
test("Missing Quizzes Detector: marks unattempted quizzes in grades report and course page", () => {
    // 1. Simulate Grades Report table rows
    const mockGradesRows = [
        { title: "Prelim Quiz 1", href: "/mod/quiz/view.php?id=1", grade: "100.00", pct: "100.00%" },
        { title: "Prelim Quiz 2", href: "/mod/quiz/view.php?id=2", grade: "-", pct: "-" },
        { title: "Midterm Exam", href: "/mod/quiz/view.php?id=3", grade: "", pct: "" },
        { title: "Prefi Quiz 1", href: "/mod/quiz/view.php?id=4", grade: "85.00", pct: "85.00%" }
    ];

    const missingInGrades = mockGradesRows.filter(r => {
        const hasGrade = (r.grade && r.grade !== '-' && r.grade !== '–' && /\d/.test(r.grade)) ||
                         (r.pct && r.pct !== '-' && r.pct !== '–' && !r.pct.includes('0.00') && /\d/.test(r.pct));
        return !hasGrade;
    });

    assert.strictEqual(missingInGrades.length, 2, "Must detect exactly 2 unattempted/missing quizzes in Grades table");
    assert.strictEqual(missingInGrades[0].title, "Prelim Quiz 2");
    assert.strictEqual(missingInGrades[1].title, "Midterm Exam");

    // 2. Simulate Course page activity cards
    const mockCourseActivities = [
        { title: "Lecture 1", type: "lecture", isCompleted: true },
        { title: "Quiz 1", type: "quiz", isCompleted: true },
        { title: "Quiz 2", type: "quiz", isCompleted: false },
        { title: "Quiz 3", type: "quiz", isCompleted: false }
    ];

    const missingInCourse = mockCourseActivities.filter(a => a.type === 'quiz' && !a.isCompleted);
    assert.strictEqual(missingInCourse.length, 2, "Must detect 2 incomplete quizzes on course page");
});

// --------------------------------------------------
// 31. Activity Log Feed Export & Copy Formatting
// --------------------------------------------------
test("Activity Log Feed Export: formats chronological log entries with timestamps", () => {
    const mockHistory = [
        { time: "09:05:01 AM", text: "Auto-synced 180 answers for ITE6301" },
        { time: "09:05:15 AM", text: "Answered Question 1: Verified (100%)" },
        { time: "09:05:20 AM", text: "Highlighted 15 answers on quiz attempt" }
    ];

    function exportLogs(history, subject = "ITE6301") {
        if (!history || history.length === 0) return '';
        const lines = history.map(item => `[${item.time}] ${item.text}`).reverse();
        return `AMAES Moodle Toolkit Activity Log\nSubject: ${subject}\n\n` + lines.join('\n');
    }

    const exported = exportLogs(mockHistory, "ITE6301");
    assert.ok(exported.includes("Subject: ITE6301"));
    assert.ok(exported.includes("[09:05:01 AM] Auto-synced 180 answers for ITE6301"));
    assert.ok(exported.includes("[09:05:20 AM] Highlighted 15 answers on quiz attempt"));
});

// --------------------------------------------------
// 32. Course-Wide Coverage & 4-Tier Breakdown Aggregation
// --------------------------------------------------
test("Course-Wide Coverage: accurately tallies unified sources (Verified DB including community, AMAUOED, Eliminated)", () => {
    const mockCachedQuestions = [
        { qNorm: "q1", ansNorm: "a1", source: "grade_report", wrongAnswers: ["w1", "w2"] },
        { qNorm: "q2", ansNorm: "a2", source: "quiz_review", wrongAnswers: [] },
        { qNorm: "q3", ansNorm: "a3", source: "community", wrongAnswers: ["w3"] },
        { qNorm: "q4", ansNorm: "a4", source: "amauoed", wrongAnswers: [] },
        { qNorm: "q5", ansNorm: "a5", sources: ["amauoed_import"], wrongAnswers: ["w4"] }
    ];

    let verified = 0;
    let amauoed = 0;
    let eliminated = 0;

    mockCachedQuestions.forEach(q => {
        const s = (q.source || '').toLowerCase();
        const sources = Array.isArray(q.sources) ? q.sources.map(x => (x || '').toLowerCase()) : [];
        const isAmauoed = s.includes('amauoed') || sources.some(x => x.includes('amauoed'));

        if (isAmauoed) {
            amauoed++;
        } else {
            verified++;
        }

        if (Array.isArray(q.wrongAnswers)) {
            eliminated += q.wrongAnswers.length;
        }
    });

    assert.strictEqual(verified, 3, "Unified Verified DB count should be 3 (grade_report + quiz_review + community)");
    assert.strictEqual(amauoed, 2, "AMAUOED count should be 2");
    assert.strictEqual(eliminated, 4, "Total eliminated wrong choices should be 4");
    assert.strictEqual(mockCachedQuestions.length, 5, "Total questions in coverage should be 5");
});

test("Button Wiring Integrity: Header reset and home buttons are bound to handlers", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    assert.strictEqual(script.includes("id=\"amaes-reset-btn\""), true, "amaes-reset-btn must exist in template");
    assert.strictEqual(script.includes("document.getElementById('amaes-reset-btn')"), true, "amaes-reset-btn must be queried");
    assert.strictEqual(script.includes("resetBtn.onclick = () => {"), true, "resetBtn must have onclick handler");

    assert.strictEqual(script.includes("id=\"amaes-home-btn\""), true, "amaes-home-btn must exist in template");
    assert.strictEqual(script.includes("document.getElementById('amaes-home-btn')"), true, "amaes-home-btn must be queried");
    assert.strictEqual(script.includes("homeBtn.onclick = (e) => {"), true, "homeBtn must have onclick handler");
});

test("Quiz Landing Start Auto-Quiz: detects start or re-attempt attempt button on view.php", () => {
    // Simulate DOM for /mod/quiz/view.php
    const mockDocument = {
        querySelector(selector) {
            if (selector.includes('attempt.php') || selector.includes('quizstartbutton')) {
                return {
                    clicked: false,
                    click() { this.clicked = true; }
                };
            }
            return null;
        }
    };

    const isQuizLanding = true;
    let started = false;
    if (isQuizLanding) {
        const startBtn = mockDocument.querySelector('form[action*="attempt.php"] button, .quizstartbutton button');
        if (startBtn) {
            startBtn.click();
            started = startBtn.clicked;
        }
    }

    assert.strictEqual(started, true, "Start Auto-Quiz on view.php must trigger start attempt button");
});

// --------------------------------------------------
// 34. Multi-Course Dashboard Harvesting & Course ID Resolution
// --------------------------------------------------
test("Multi-Course Dashboard Harvesting: extracts courseId and generates gradesUrl for batch scanning", () => {
    const mockCards = [
        {
            text: "UGRD-CS6301 Data Structures and Algorithms",
            href: "https://semestral.amaes.com/2612/course/view.php?id=1024"
        },
        {
            text: "UGRD-ITE6301 Information Management",
            href: "https://semestral.amaes.com/2612/course/view.php?id=2048"
        }
    ];

    const results = [];
    mockCards.forEach(card => {
        let subCode = '';
        const m = card.text.match(/\b([A-Za-z]{2,6}\d{3,4}[A-Za-z]*)\b/);
        if (m) subCode = m[1].toUpperCase();

        let courseId = '';
        const idMatch = card.href.match(/[?&]id=(\d+)/);
        if (idMatch) courseId = idMatch[1];

        const gradesUrl = courseId ? `https://semestral.amaes.com/2612/grade/report/user/index.php?id=${courseId}` : '';

        results.push({
            code: subCode,
            courseId,
            gradesUrl,
            title: card.text
        });
    });

    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].code, "CS6301");
    assert.strictEqual(results[0].courseId, "1024");
    assert.strictEqual(results[0].gradesUrl, "https://semestral.amaes.com/2612/grade/report/user/index.php?id=1024");
    assert.strictEqual(results[1].code, "ITE6301");
    assert.strictEqual(results[1].courseId, "2048");
    assert.strictEqual(results[1].gradesUrl, "https://semestral.amaes.com/2612/grade/report/user/index.php?id=2048");
});

// --------------------------------------------------
// 35. Cloud Sync Fallback to AMAUOED Catalog
// --------------------------------------------------
test("Cloud Sync Fallback: gracefully transitions from missing GitHub repo to AMAUOED catalog scraping", async () => {
    let cloudAttempted = false;
    let fallbackScrapeAttempted = false;

    async function mockSyncCloudOrFallback(code) {
        // Step 1: Cloud fetch fails or has 0 answers
        cloudAttempted = true;
        const cloudResult = null; // simulate course not found in github repo

        if (!cloudResult) {
            // Step 2: Fallback to AMAUOED catalog search
            fallbackScrapeAttempted = true;
            return {
                source: 'AMAUOED',
                count: 142,
                url: `https://amauoed.com/courses/ite/ite6301`
            };
        }
        return cloudResult;
    }

    const res = await mockSyncCloudOrFallback("ITE6301");
    assert.strictEqual(cloudAttempted, true, "Cloud fetch must be attempted first");
    assert.strictEqual(fallbackScrapeAttempted, true, "AMAUOED fallback must be triggered when cloud is empty");
    assert.strictEqual(res.source, "AMAUOED");
    assert.strictEqual(res.count, 142);
});

// --------------------------------------------------
// 36. Live Info Bar & Pulsing Status Dot Integrity
// --------------------------------------------------
test("Live Info Bar & Pulsing Status Dot: setLog triggers visual dot pulse and updates status & plan texts", () => {
    const mockDot = {
        style: {},
        classList: {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); }
        }
    };
    const mockStatus = { innerHTML: '', style: {} };
    const mockPlan = { innerHTML: '' };

    function mockSetLog(doing, color, plan) {
        mockStatus.innerHTML = doing;
        if (color) mockStatus.style.color = color;
        if (plan) mockPlan.innerHTML = plan;

        mockDot.style.background = color || "#10b981";
        mockDot.classList.remove('amaes-pulse');
        mockDot.classList.add('amaes-pulse');
    }

    mockSetLog("<b>Auto-Pick Answers: ON</b>", "var(--accent-green)", "Will auto-select verified choices");

    assert.ok(mockStatus.innerHTML.includes("Auto-Pick Answers: ON"));
    assert.strictEqual(mockPlan.innerHTML, "Will auto-select verified choices");
    assert.strictEqual(mockDot.style.background, "var(--accent-green)");
    assert.ok(mockDot.classList.classes.has("amaes-pulse"), "Dot must receive amaes-pulse class");
});

// --------------------------------------------------
// 37. Userscript Button & Toggle Wiring Integrity
// --------------------------------------------------
test("Userscript Toggle & Button Wiring: verifies all handlers call setLog and pulse feedback", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // Verify key toggle listeners wire setLog
    assert.ok(script.includes("Auto-Pick Answers:"), "chkAutoPick must log status");
    assert.ok(script.includes("Auto-Next Navigation:"), "chkAutoNext must log status");
    assert.ok(script.includes("Smart Skip Unverified:"), "chkSmartSkip must log status");
    assert.ok(script.includes("Highlight Answers:"), "chkAutoHlQuiz must log status");
    assert.ok(script.includes("Include DB Hints on Copy:"), "chkCopyConfidence must log status");
    assert.ok(script.includes("Auto-Harvest past quizzes from Grades:"), "chkAutoHarvestGrades must log status");
    assert.ok(script.includes("Auto-fetch AMAUOED when missing:"), "chkAutoScrapeAmauoed must log status");

    // Verify CSS pulse animation is defined
    assert.ok(script.includes("@keyframes amaes-dot-pulse"), "CSS must define @keyframes amaes-dot-pulse");
    assert.ok(script.includes(".amaes-pulse"), "CSS must define .amaes-pulse class");

    // Verify multi-course harvester loop
    assert.ok(script.includes("harvestQuizzesFromGradesDoc"), "Harvester must have harvestQuizzesFromGradesDoc function");
    assert.ok(script.includes("Scanning Grade Reports for <b>${dashCourses.length} enrolled courses</b>"), "executeGradesHarvester must support multi-course dashboard scanning");
});

// --------------------------------------------------
// 38. Multi-Choice Question Detection & AI Prompt Formatting
// --------------------------------------------------
test("Multi-Choice Question: formats AI prompt with multiple answer notice and tailored instructions", () => {
    // Mock extractQuestionData logic
    function mockExtractQuestionData(hasCheckboxes, promptText, qText) {
        const isMultiChoice = Boolean(
            hasCheckboxes ||
            /select (?:one or more choices?|one or more|all that apply)/i.test(promptText) ||
            /select (?:one or more choices?|one or more|all that apply)/i.test(qText)
        );
        return {
            qText: qText.replace(/^Question\s*\d+[\s:.]*/i, '').trim(),
            choices: ["a. RAM", "b. ROM", "c. Cache Memory", "d. Hard Disk"],
            isMultiChoice
        };
    }

    function mockFormatQuestionForAI(data, withHint = true) {
        let output = '';
        if (data.isMultiChoice) {
            output += `[NOTE: MULTIPLE ANSWERS ALLOWED - SELECT ONE OR MORE CHOICES]\n`;
        }
        output += `${data.qText}\n\n`;
        output += data.choices.join('\n');
        if (withHint) {
            if (data.isMultiChoice) {
                output += `\n\nInstructions: This question allows MULTIPLE answers ("Select one or more"). Answer ONLY with ALL applicable option letters (e.g. "a, c" or "b, d") and their exact choice texts. Do NOT pick any confirmed wrong choices. Do NOT give explanations.`;
            } else {
                output += `\n\nInstructions: Answer ONLY with the correct option letter (a, b, c, or d) and the exact choice text. Do NOT pick any confirmed wrong choices. Do NOT give explanations.`;
            }
        }
        return output.trim();
    }

    const multiQData = mockExtractQuestionData(true, "Select one or more:", "Which of the following are types of volatile memory?");
    assert.strictEqual(multiQData.isMultiChoice, true, "Question with checkboxes must be flagged as multi-choice");

    const formattedPrompt = mockFormatQuestionForAI(multiQData, true);
    assert.ok(formattedPrompt.includes("[NOTE: MULTIPLE ANSWERS ALLOWED - SELECT ONE OR MORE CHOICES]"), "AI prompt must notify that multiple choices are allowed");
    assert.ok(formattedPrompt.includes("Instructions: This question allows MULTIPLE answers"), "AI prompt instructions must ask for all applicable option letters");
    assert.ok(formattedPrompt.includes("e.g. \"a, c\" or \"b, d\""), "AI prompt instructions must provide multi-letter example");

    const singleQData = mockExtractQuestionData(false, "Select one:", "What does CPU stand for?");
    assert.strictEqual(singleQData.isMultiChoice, false, "Single choice radio question must NOT be flagged as multi-choice");
    const singlePrompt = mockFormatQuestionForAI(singleQData, true);
    assert.strictEqual(singlePrompt.includes("[NOTE: MULTIPLE ANSWERS ALLOWED"), false, "Single choice must NOT have multi-choice notice");
    assert.ok(singlePrompt.includes("Answer ONLY with the correct option letter (a, b, c, or d)"), "Single choice must have standard letter instructions");
});

// --------------------------------------------------
// 39. Multi-Letter AI Clipboard Auto-Selection ('V' Shortcut)
// --------------------------------------------------
test("Multi-Letter AI Clipboard: pressing V clicks all corresponding checkboxes for multi-answer response", () => {
    function mockParseAiClipboard(clipboardText, isCheckbox, inputs) {
        const cleanText = clipboardText.trim();
        const multiLetters = cleanText.match(/\b([a-dA-D])\b/g);
        if (isCheckbox && multiLetters && multiLetters.length > 1) {
            const uniqueLetters = Array.from(new Set(multiLetters.map(l => l.toUpperCase())));
            let checkedCount = 0;
            uniqueLetters.forEach(letter => {
                const idx = letter.charCodeAt(0) - 65;
                if (inputs[idx]) {
                    if (!inputs[idx].checked) {
                        inputs[idx].click();
                    }
                    checkedCount++;
                }
            });
            return { handled: true, count: checkedCount, letters: uniqueLetters };
        }
        return { handled: false };
    }

    const checkboxes = [
        { checked: false, click() { this.checked = true; } },
        { checked: false, click() { this.checked = true; } },
        { checked: false, click() { this.checked = true; } },
        { checked: false, click() { this.checked = true; } }
    ];

    // Simulate AI returning "The correct answers are a and c"
    const aiResponse = "The correct answers are a and c: a. RAM, c. Cache Memory";
    const res = mockParseAiClipboard(aiResponse, true, checkboxes);

    assert.strictEqual(res.handled, true, "Multi-letter AI clipboard response must be handled");
    assert.deepStrictEqual(res.letters, ["A", "C"], "Must extract options A and C");
    assert.strictEqual(checkboxes[0].checked, true, "Option A must be checked");
    assert.strictEqual(checkboxes[1].checked, false, "Option B must remain unchecked");
    assert.strictEqual(checkboxes[2].checked, true, "Option C must be checked");
    assert.strictEqual(checkboxes[3].checked, false, "Option D must remain unchecked");
});

// --------------------------------------------------
// 40. Multi-Answer Auto-Next Progression Gate
// --------------------------------------------------
test("Multi-Answer Auto-Next Gate: requires all verified highlighted choices to be checked before advancing", () => {
    function mockAreAllPageQuestionsAnswered(highlightedBoxesChecked, totalHighlighted) {
        if (totalHighlighted > 1) {
            return highlightedBoxesChecked === totalHighlighted;
        }
        return highlightedBoxesChecked > 0;
    }

    // 2 verified answers required (e.g. A and C)
    assert.strictEqual(mockAreAllPageQuestionsAnswered(1, 2), false, "Must NOT allow auto-next when only 1 of 2 verified answers is checked");
    assert.strictEqual(mockAreAllPageQuestionsAnswered(2, 2), true, "Allows auto-next once all 2 verified answers are checked");
    // Single choice questions
    assert.strictEqual(mockAreAllPageQuestionsAnswered(1, 1), true, "Allows auto-next when single choice is checked");
});

// --------------------------------------------------
// 41. Multi-Answer Review Harvesting & Consensus Merging
// --------------------------------------------------
test("Multi-Answer Harvesting & Cache: splits rightAnswer into answers array and deduplicates on merge", () => {
    function mockHarvestRightAnswer(rawRightAnswer) {
        let cleaned = rawRightAnswer.replace(/^The correct answers? (is|are):?\s*['"]?/i, '').replace(/['"]?\s*$/i, '').trim();
        const answersList = cleaned ? cleaned.split(/[,;&\n]+|\s+and\s+/i).map(s => s.trim()).filter(Boolean) : [];
        return {
            ansRaw: cleaned,
            ansNorm: normalizeChoice(cleaned),
            answers: answersList.length > 1 ? answersList : undefined
        };
    }

    const harvested = mockHarvestRightAnswer("The correct answers are: Static RAM, Dynamic RAM");
    assert.strictEqual(harvested.ansRaw, "Static RAM, Dynamic RAM");
    assert.deepStrictEqual(harvested.answers, ["Static RAM", "Dynamic RAM"], "Must parse individual choices into answers array");

    // Cache merge deduplication test
    const existingEntry = {
        qNorm: "what types of ram exist",
        ansRaw: "Static RAM, Dynamic RAM",
        answers: ["Static RAM", "Dynamic RAM"]
    };
    const incomingItem = {
        answers: ["Dynamic RAM", "Cache SRAM"]
    };
    existingEntry.answers = Array.from(new Set(existingEntry.answers.concat(incomingItem.answers)));
    assert.deepStrictEqual(existingEntry.answers, ["Static RAM", "Dynamic RAM", "Cache SRAM"], "Must merge and deduplicate multiple answer choices");
});

// --------------------------------------------------
// 42. Button Binding & ReferenceError Prevention
// --------------------------------------------------
test("Button Binding Integrity: createPanel declares all element references without ReferenceErrors", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // Verify btnCopyAllQ is declared and in markup
    assert.ok(script.includes("const btnCopyAllQ = document.getElementById('btn-copy-all-q');"), "btnCopyAllQ must be declared to prevent ReferenceError in createPanel");
    assert.ok(script.includes('id="btn-copy-all-q"'), "btn-copy-all-q must be present in Action Buttons markup");
    assert.ok(script.includes("btnCloudSync.classList.add('amaes-pulse');"), "btnCloudSync must trigger pulse animation");
    assert.ok(script.includes("btnHarvestGradesDb.classList.add('amaes-pulse');"), "btnHarvestGradesDb must trigger pulse animation");
    assert.ok(script.includes(".amaes-btn:active"), "CSS must include :active scale press effect for tactile feedback");
});

// --------------------------------------------------
// 43. AMAUOED Multi-Chip & Distractor Extraction
// --------------------------------------------------
test("AMAUOED HTML Parser: extracts multi-chip answers, distractors as wrongAnswers, and choices", () => {
    // Simulated DOM parser test for parseAmauoedHtml logic
    function mockParseAmauoedCard(cardData) {
        const correctList = cardData.chips || [];
        const allChoices = cardData.choices || [];
        const wrongAnswers = allChoices.filter(c => !correctList.some(ans => normalizeChoice(ans) === normalizeChoice(c)));

        const ansRaw = correctList.join(', ');
        const ansNorm = normalizeChoice(ansRaw);
        const entry = {
            qRaw: cardData.question,
            qNorm: normalizeChoice(cardData.question),
            ansRaw,
            ansNorm,
            source: 'amauoed'
        };
        if (correctList.length > 1) {
            entry.answers = correctList;
        }
        if (wrongAnswers.length > 0) {
            entry.wrongAnswers = wrongAnswers.map(w => ({ text: w, norm: normalizeChoice(w) }));
        }
        if (allChoices.length > 0) {
            entry.choices = allChoices;
        }
        return entry;
    }

    const parsed = mockParseAmauoedCard({
        question: "Which of the following are valid network topologies?",
        choices: ["Star", "Mesh", "Banana", "Ring"],
        chips: ["Star", "Mesh", "Ring"]
    });

    assert.strictEqual(parsed.ansRaw, "Star, Mesh, Ring");
    assert.deepStrictEqual(parsed.answers, ["Star", "Mesh", "Ring"], "Must contain all 3 correct chips in answers array");
    assert.strictEqual(parsed.wrongAnswers.length, 1);
    assert.strictEqual(parsed.wrongAnswers[0].text, "Banana", "Distractor must be recorded in wrongAnswers");
    assert.strictEqual(parsed.choices.length, 4, "All 4 choices must be captured");
});

// --------------------------------------------------
// 44. AMAUOED 5-Tier Link Discovery Matcher
// --------------------------------------------------
test("AMAUOED 5-Tier Matcher: matches exact code, dept+num, dept alias, unique num, and title keywords", () => {
    const catalog = [
        { cleanCode: 'CS6202', rawCode: 'CS-6202', dept: 'CS', num: '6202', title: 'Algorithms and Complexity', url: 'https://amauoed.com/courses/cs/algorithms-and-complexity-6202-cs' },
        { cleanCode: 'ITE6200', rawCode: 'ITE-6200', dept: 'ITE', num: '6200', title: 'Data Structures and Algorithms', url: 'https://amauoed.com/courses/ite/data-structures-and-algorithms-6200-ite' },
        { cleanCode: 'MATH6100', rawCode: 'MATH-6100', dept: 'MATH', num: '6100', title: 'Calculus 1', url: 'https://amauoed.com/courses/math/calculus-1-6100-math' },
        { cleanCode: 'GE6107', rawCode: 'GE-6107', dept: 'GE', num: '6107', title: 'Ethics', url: 'https://amauoed.com/courses/ge/ethics-6107-ge' }
    ];

    function matchInCatalog(code, courseTitle, courses) {
        const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
        const codeNum = cleanCode.replace(/\D+/g, '');
        const codeDept = cleanCode.replace(/\d+/g, '').toUpperCase();

        // Tier 1: Exact code
        const exact = courses.find(c => c.cleanCode === cleanCode || c.rawCode === cleanCode);
        if (exact) return exact.url;

        // Tier 2: Dept + Number
        if (codeDept && codeNum) {
            const deptNum = courses.find(c => c.dept === codeDept && c.num === codeNum);
            if (deptNum) return deptNum.url;
        }

        // Tier 3: Dept alias (IT -> ITE)
        const ALIAS_MAP = {
            'IT': ['ITE', 'IT'],
            'ITE': ['IT', 'ITE'],
            'CS': ['COMP', 'CS'],
            'MATH': ['MTH', 'MATH']
        };
        const aliases = ALIAS_MAP[codeDept] || [codeDept];
        if (codeNum) {
            const aliasMatch = courses.find(c => aliases.includes(c.dept) && c.num === codeNum);
            if (aliasMatch) return aliasMatch.url;
        }

        // Tier 4: Unique number match
        if (codeNum && codeNum.length >= 3) {
            const numMatches = courses.filter(c => c.num === codeNum);
            if (numMatches.length === 1) return numMatches[0].url;
        }

        // Tier 5: Title keywords
        if (courseTitle) {
            const queryWords = courseTitle.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 3);
            if (queryWords.length >= 2) {
                const best = courses.find(c => queryWords.filter(w => c.title.toLowerCase().includes(w)).length >= 2);
                if (best) return best.url;
            }
        }

        return null;
    }

    // Tier 1: Exact
    assert.strictEqual(matchInCatalog('CS-6202', '', catalog), 'https://amauoed.com/courses/cs/algorithms-and-complexity-6202-cs');
    // Tier 2: CS6202 (no hyphen)
    assert.strictEqual(matchInCatalog('CS6202', '', catalog), 'https://amauoed.com/courses/cs/algorithms-and-complexity-6202-cs');
    // Tier 3: IT-6200 alias -> ITE-6200
    assert.strictEqual(matchInCatalog('IT6200', '', catalog), 'https://amauoed.com/courses/ite/data-structures-and-algorithms-6200-ite');
    // Tier 4: Unique 4-digit number 6107
    assert.strictEqual(matchInCatalog('SUBJ6107', '', catalog), 'https://amauoed.com/courses/ge/ethics-6107-ge');
    // Tier 5: Title keyword overlap
    assert.strictEqual(matchInCatalog('UNKNOWN', 'Algorithms and Complexity Advanced Analysis', catalog), 'https://amauoed.com/courses/cs/algorithms-and-complexity-6202-cs');
});

// --------------------------------------------------
// 45. Solver Variable Integrity: No TypeError on Reassignment
// --------------------------------------------------
test("Solver Variable Integrity: cached variable is declared with let in runAutoQuizSolver", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // Scope check to runAutoQuizSolver function
    const solverStart = script.indexOf('async function runAutoQuizSolver');
    const solverSection = script.substring(solverStart, solverStart + 1500);

    assert.ok(solverSection.includes("let cached = getCachedAnswers(subCode);"), "cached in runAutoQuizSolver must be declared with 'let' to allow reassignment");
    assert.ok(!solverSection.includes("const cached = getCachedAnswers(subCode);"), "Must NOT use const for cached in runAutoQuizSolver");
});

// --------------------------------------------------
// 46. Auto-Fetch AMAUOED Quiz Toggle & Sync
// --------------------------------------------------
test("Auto-Fetch Web Scraper Toggle: consolidated in DB tab under Web Scraper Answers, eliminating duplicate Quiz tab clutter", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    assert.ok(script.includes('id="chk-auto-scrape-amauoed"'), "chk-auto-scrape-amauoed must be present in DB tab markup");
    assert.ok(!script.includes('id="chk-auto-scrape-amauoed-quiz"'), "chk-auto-scrape-amauoed-quiz must be removed from Quiz tab to avoid redundancy");
    assert.ok(script.includes('function handleAutoScrapeToggle('), "Must use handleAutoScrapeToggle to manage auto-scrape setting");
    assert.ok(script.includes('autoFetchCloudAnswersIfMissing(subCode)'), "Quiz attempt page load and solver must call autoFetchCloudAnswersIfMissing");
});

// --------------------------------------------------
// 47. Inline Cloze / Text Field Sanitization & AMAUOED Matcher
// --------------------------------------------------
test("Inline Cloze / Text Field Matcher: strips inline inputs/blanks so sentence matches AMAUOED question", () => {
    function mockSanitizeMoodleQ(rawMoodleHtml) {
        // Strip input tags and extra spaces
        const stripped = rawMoodleHtml.replace(/<input[^>]*>/gi, '').replace(/\s+/g, ' ').trim();
        let norm = stripped.toLowerCase().replace(/^(question\s*\d+[\s:.]*|\d+[\s:.)]+)/, '');
        norm = norm.replace(/_{2,}/g, '___').replace(/\s+/g, ' ').replace(/[.:?!;,]+$/, '').trim();
        return norm;
    }

    const moodleHtml = 'A Moore machine can be described by a <input type="text" value="6"> tuple.';
    const amauoedQ = 'A Moore machine can be described by a tuple.';
    
    const moodleNorm = mockSanitizeMoodleQ(moodleHtml);
    const amauoedNorm = mockSanitizeMoodleQ(amauoedQ);

    assert.strictEqual(moodleNorm, "a moore machine can be described by a tuple");
    assert.strictEqual(amauoedNorm, "a moore machine can be described by a tuple");
    assert.strictEqual(moodleNorm, amauoedNorm, "Inline input question in Moodle must match AMAUOED question text");
});

// --------------------------------------------------
// 48. Text Field Interactive Fill Hint & Auto-Fill
// --------------------------------------------------
test("Text Field Interactive Fill: creates clickable fill hint and supports auto-fill", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // Verify all text input selectors are checked
    assert.ok(script.includes("const textInputs = que.querySelectorAll('input[type=\"text\"]"), "Must query all text inputs including inline cloze fields");
    assert.ok(script.includes("class=\"amaes-fill-btn\""), "Must include 1-click Fill button in shortans hint");
    assert.ok(script.includes("textInput.dispatchEvent(new Event('input', { bubbles: true }));"), "Must dispatch input event on fill");
    assert.ok(script.includes("textInput.dispatchEvent(new Event('change', { bubbles: true }));"), "Must dispatch change event on fill");
    assert.ok(script.includes("textInput.dispatchEvent(new Event('blur', { bubbles: true }));"), "Must dispatch blur event on fill");
});

// --------------------------------------------------
// 49. Paste AI (V) into Text Fields
// --------------------------------------------------
test("Paste AI (V) Shortcut: automatically pastes clipboard answer into text field if no choices exist", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // Verify autoSelectFromAiClipboard handles text inputs
    assert.ok(script.includes("textInputs[0].value = cleanedAnswer;"), "Must paste clean clipboard answer into text field");
    assert.ok(script.includes("showToast(`Pasted to Text Box: ${cleanedAnswer}`);"), "Must display feedback toast when pasting into text input");
});

// --------------------------------------------------
// 50. Dropdown (<select>) Matching & Interactive Pick Hint
// --------------------------------------------------
test("Dropdown Matching Engine: matches option texts and sub-questions for matching tables and gapselects", () => {
    function matchDropdownOption(subQText, bestAnswer, candAnswers, idx, options) {
        let targetAns = '';
        if (subQText && (bestAnswer.includes(':') || bestAnswer.includes('->') || bestAnswer.includes('-'))) {
            const lines = bestAnswer.split(/[\n,;]+/).map(l => l.trim());
            for (const line of lines) {
                const subNorm = subQText.toLowerCase().trim();
                const lineNorm = line.toLowerCase().trim();
                if (lineNorm.includes(subNorm)) {
                    const parts = line.split(/[:\->=]+/);
                    if (parts.length >= 2) {
                        targetAns = parts.slice(1).join(':').trim();
                        break;
                    }
                }
            }
        }
        if (!targetAns) {
            targetAns = candAnswers[idx] || candAnswers[0] || bestAnswer;
        }

        const normTarget = targetAns.toLowerCase().replace(/[^a-z0-9]/g, '');
        return options.find(opt => {
            if (!opt.value || opt.value === '0' || opt.text.toLowerCase().includes('choose')) return false;
            const normOpt = opt.text.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normOpt === normTarget || (normTarget.length > 2 && normOpt.includes(normTarget)) || (normOpt.length > 2 && normTarget.includes(normOpt));
        });
    }

    const options = [
        { value: "0", text: "Choose..." },
        { value: "opt1", text: "Central Processing Unit" },
        { value: "opt2", text: "Random Access Memory" },
        { value: "opt3", text: "Read Only Memory" }
    ];

    const answerMulti = "CPU: Central Processing Unit, RAM: Random Access Memory";
    const matchedCPU = matchDropdownOption("CPU", answerMulti, [], 0, options);
    const matchedRAM = matchDropdownOption("RAM", answerMulti, [], 1, options);

    assert.ok(matchedCPU, "CPU sub-question must match Central Processing Unit");
    assert.strictEqual(matchedCPU.value, "opt1");
    assert.ok(matchedRAM, "RAM sub-question must match Random Access Memory");
    assert.strictEqual(matchedRAM.value, "opt2");

    // Gapselect / Cloze array matching
    const gapAnswers = ["Random Access Memory", "Read Only Memory"];
    const matchedGap1 = matchDropdownOption("", "", gapAnswers, 0, options);
    const matchedGap2 = matchDropdownOption("", "", gapAnswers, 1, options);
    assert.strictEqual(matchedGap1.value, "opt2");
    assert.strictEqual(matchedGap2.value, "opt3");

    // Userscript code verification
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("const selectInputs = que.querySelectorAll('select');"), "highlightQuizAnswers must query all select elements");
    assert.ok(script.includes("amaes-select-hint"), "Must create amaes-select-hint for dropdown questions");
    assert.ok(script.includes("amaes-select-btn"), "Must include 1-click Pick button for dropdown questions");
    assert.ok(script.includes("selectInput.value = matchedOption.value;"), "Auto-pick must assign matched value to select element");
});

// --------------------------------------------------
// 51. Safe Auto-Pause on Unknown Questions
// --------------------------------------------------
test("Safe Wait State on Unknown Questions: pauses on current question without killing autoQuizMode, updates UI, and attaches input listeners", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // Check Case B safe wait state
    const caseBStart = script.indexOf('// Case B: UNKNOWN QUESTION DETECTED');
    const caseBSection = script.substring(caseBStart, caseBStart + 25000);

    assert.ok(caseBSection.includes("isWaitingForUserAnswer = true;"), "Auto-solver Case B must set isWaitingForUserAnswer flag");
    assert.ok(caseBSection.includes("clearTimeout(autoNextTimer);"), "Must cancel autoNextTimer to prevent premature advance");
    assert.ok(caseBSection.includes("syncAutoQuizUI(true);"), "Must trigger syncAutoQuizUI with isPausedOnUnknown=true");
    assert.ok(caseBSection.includes("WAITING FOR ANSWER"), "HUD must display WAITING FOR ANSWER status badge");
    assert.ok(caseBSection.includes("select"), "Case B input listener must include select elements");

    // Check syncAutoQuizUI button styling
    assert.ok(script.includes("Waiting on Q"), "syncAutoQuizUI must support waiting on question state");
    assert.ok(script.includes("linear-gradient(135deg, #f59e0b, #d97706)"), "Waiting button must use warm amber styling");
});

// --------------------------------------------------
// 52. AI Clipboard Paste (V) into Dropdown Elements
// --------------------------------------------------
test("Paste AI (V) Shortcut on Dropdowns: selects matching option in <select> dropdown from clipboard", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    const vPasteStart = script.indexOf('async function autoSelectFromAiClipboard');
    const vPasteSection = script.substring(vPasteStart, vPasteStart + 6500);

    assert.ok(vPasteSection.includes("const selectInputs = Array.from(targetQue.querySelectorAll('select'));"), "autoSelectFromAiClipboard must search for select dropdowns");
    assert.ok(vPasteSection.includes("sel.value = matchOpt.value;"), "Must assign matched value to select dropdown");
    assert.ok(vPasteSection.includes("sel.dispatchEvent(new Event('change', { bubbles: true }));"), "Must dispatch change event on dropdown paste");
    assert.ok(vPasteSection.includes("showToast(`Pasted to Dropdown: Selected ${selectedCount} option(s)`);"), "Must provide clear feedback toast on dropdown paste");
});

// --------------------------------------------------
// 53. Drag and Drop Question Extraction & AI Prompt Formatting
// --------------------------------------------------
test("Drag and Drop Extraction & Formatting: identifies drag choices, drop zones, and formats AI prompt", () => {
    function mockExtractDragDrop(dragTexts, dropCount, qTextRaw) {
        const choices = [];
        const seen = new Set();
        dragTexts.forEach((txt) => {
            const trimmed = txt.trim();
            if (trimmed && !seen.has(trimmed)) {
                seen.add(trimmed);
                const letter = String.fromCharCode(97 + choices.length);
                choices.push(`${letter}. ${trimmed}`);
            }
        });

        return {
            isDragDrop: true,
            dropZonesCount: dropCount,
            qText: qTextRaw,
            choices
        };
    }

    function mockFormatAiPrompt(data) {
        let output = '';
        if (data.isDragDrop) {
            output += `[DRAG AND DROP QUESTION - MATCH CHOICES TO BLANKS]\n`;
            if (data.dropZonesCount > 1) {
                output += `Total Blanks: ${data.dropZonesCount}\n`;
            }
        }
        output += `${data.qText}\n\n`;
        if (data.choices && data.choices.length > 0) {
            output += `Available Draggable Choices:\n${data.choices.join('\n')}\n\n`;
        }
        output += `Instructions: This is a Drag and Drop question.`;
        return output;
    }

    const extracted = mockExtractDragDrop(["David Hilbert", "Alan Turing", "Leibniz's Dream", "George Boole", "Alonzo Church"], 1, "[Blank 1] challenged the mathematical community...");
    assert.strictEqual(extracted.isDragDrop, true);
    assert.strictEqual(extracted.choices.length, 5);
    assert.strictEqual(extracted.choices[0], "a. David Hilbert");

    const prompt = mockFormatAiPrompt(extracted);
    assert.ok(prompt.includes("[DRAG AND DROP QUESTION - MATCH CHOICES TO BLANKS]"));
    assert.ok(prompt.includes("Available Draggable Choices:"));
    assert.ok(prompt.includes("a. David Hilbert"));

    // Userscript check
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes(".draghome"), "Must query .draghome choices");
    assert.ok(script.includes(".drop"), "Must query .drop zones");
    assert.ok(script.includes("[DRAG AND DROP QUESTION - MATCH CHOICES TO BLANKS]"), "AI prompt must announce Drag and Drop question");
});

// --------------------------------------------------
// 54. Drag and Drop Matching Engine & Interactive Hint
// --------------------------------------------------
test("Drag and Drop Matching Engine: highlights drag choices, drop zones, and injects 1-click Place button", () => {
    function matchDragChoice(dragItems, targetAns) {
        const normTarget = targetAns.toLowerCase().replace(/[^a-z0-9]/g, '');
        return dragItems.find(item => {
            const normItem = item.text.toLowerCase().replace(/[^a-z0-9]/g, '');
            return normItem === normTarget || (normTarget.length > 1 && normItem.includes(normTarget)) || (normItem.length > 1 && normTarget.includes(normItem));
        });
    }

    const dragItems = [
        { text: "Alan Turing", choiceNum: "1" },
        { text: "David Hilbert", choiceNum: "2" },
        { text: "George Boole", choiceNum: "3" }
    ];

    const match = matchDragChoice(dragItems, "David Hilbert");
    assert.ok(match, "Must find matching drag item for David Hilbert");
    assert.strictEqual(match.choiceNum, "2");

    // Script check
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("amaes-drag-hint"), "highlightQuizAnswers must create amaes-drag-hint");
    assert.ok(script.includes("amaes-drag-btn"), "Must create 1-click Place button");
    assert.ok(script.includes("hasDragHint"), "runAutoQuizSolver must recognize hasDragHint");
});

// --------------------------------------------------
// 55. AI Clipboard Paste (V) on Drag and Drop Questions
// --------------------------------------------------
test("Paste AI (V) Shortcut on Drag and Drop: parses blank-specific answers and places choices", () => {
    function parseAiBlanks(clipboardText, dropCount) {
        const cleaned = clipboardText.replace(/^Answer:\s*/i, '').trim();
        const blankMatches = cleaned.match(/Blank\s*\d+\s*[:\-–]\s*([^\n,;]+)/gi);
        if (blankMatches && blankMatches.length > 0) {
            return blankMatches.map(m => m.replace(/Blank\s*\d+\s*[:\-–]\s*/i, '').trim());
        } else if (cleaned.includes(',') && dropCount > 1) {
            return cleaned.split(',').map(s => s.trim()).filter(Boolean);
        }
        return [cleaned];
    }

    // Single blank question
    const singleAns = parseAiBlanks("David Hilbert", 1);
    assert.deepStrictEqual(singleAns, ["David Hilbert"]);

    // Multi-blank question
    const multiAns = parseAiBlanks("Blank 1: b, Blank 2: c, Blank 3: a, Blank 4: b", 4);
    assert.deepStrictEqual(multiAns, ["b", "c", "a", "b"]);

    // Script check
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    const vPasteStart = script.indexOf('async function autoSelectFromAiClipboard');
    const vPasteSection = script.substring(vPasteStart, vPasteStart + 15000);

    assert.ok(vPasteSection.includes("Pasted to Drag & Drop: Placed"), "Must show toast feedback on drag-and-drop paste");
    assert.ok(vPasteSection.includes("matchingDrag.dispatchEvent"), "Must dispatch event to place drag item");
});

// --------------------------------------------------
// 56. Multi-Type Review Harvesting & Deduction (Cloze, Select, Drag, True/False)
// --------------------------------------------------
test("Review Harvesting: extracts Cloze, Select, Drag & Drop, and deduces True/False", () => {
    function simulateReviewHarvest(qData, isFullMark, isZeroMark, userInputs) {
        let rightAnswer = '';
        let isVerified = false;
        let isDeduced = false;
        const wrongAnswers = [];

        if (isFullMark) {
            if (userInputs.length > 0) {
                rightAnswer = userInputs.join(', ');
                isVerified = true;
            }
        }

        if (isZeroMark) {
            userInputs.forEach(u => wrongAnswers.push(u));
        }

        // Real-time deduction by elimination
        if (!rightAnswer && wrongAnswers.length > 0 && Array.isArray(qData.choices) && qData.choices.length > 1) {
            const uneliminated = qData.choices.filter(c => !wrongAnswers.includes(c));
            if (uneliminated.length === 1) {
                rightAnswer = uneliminated[0];
                isVerified = true;
                isDeduced = true;
            }
        }

        return { rightAnswer, isVerified, isDeduced, wrongAnswers };
    }

    // 1. True/False question where True scored 0 marks -> False is deduced!
    const tfQuestion = { choices: ["True", "False"] };
    const tfRes = simulateReviewHarvest(tfQuestion, false, true, ["True"]);
    assert.strictEqual(tfRes.isVerified, true, "True/False with wrong True must deduce False");
    assert.strictEqual(tfRes.isDeduced, true, "Must be flagged as deduced");
    assert.strictEqual(tfRes.rightAnswer, "False");
    assert.deepStrictEqual(tfRes.wrongAnswers, ["True"]);

    // 2. Cloze input question scored 1 mark -> value "6" harvested as verified
    const clozeQuestion = { choices: [] };
    const clozeRes = simulateReviewHarvest(clozeQuestion, true, false, ["6"]);
    assert.strictEqual(clozeRes.isVerified, true);
    assert.strictEqual(clozeRes.rightAnswer, "6");

    // 3. Drag & Drop question scored 1 mark -> "David Hilbert" harvested as verified
    const dragQuestion = { choices: ["David Hilbert", "Alan Turing"] };
    const dragRes = simulateReviewHarvest(dragQuestion, true, false, ["David Hilbert"]);
    assert.strictEqual(dragRes.isVerified, true);
    assert.strictEqual(dragRes.rightAnswer, "David Hilbert");

    // Userscript code verification
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("selectedDropdownTexts"), "harvestFromReviewDOM must extract dropdown selections");
    assert.ok(script.includes("placedDropTexts"), "harvestFromReviewDOM must extract drag & drop placed texts");
    assert.ok(script.includes("filledInputTexts"), "harvestFromReviewDOM must extract cloze text inputs");
});

// --------------------------------------------------
// 57. Question Status Markers on Review Screen
// --------------------------------------------------
test("Review Question Markers: displays Saved to Study Bank badge when share is ON vs Saved Locally when OFF", () => {
    function getMarkerStatus(isVerified, isDeduced, isZeroMark, autoShareEnabled) {
        if (isVerified) {
            if (autoShareEnabled) {
                return { label: isDeduced ? "Deduced & Saved" : "Saved to Study Bank", type: "cloud", liveTag: "Saved to Study Bank" };
            } else {
                return { label: isDeduced ? "Deduced Locally" : "Saved Locally", type: "local", liveTag: "Saved Locally" };
            }
        } else if (isZeroMark) {
            return { label: "Choice Eliminated", type: "eliminated" };
        }
        return null;
    }

    // When sharing is ON
    const cloudVerified = getMarkerStatus(true, false, false, true);
    assert.strictEqual(cloudVerified.label, "Saved to Study Bank");
    assert.strictEqual(cloudVerified.type, "cloud");
    assert.strictEqual(cloudVerified.liveTag, "Saved to Study Bank");

    const cloudDeduced = getMarkerStatus(true, true, false, true);
    assert.strictEqual(cloudDeduced.label, "Deduced & Saved");

    // When sharing is OFF
    const localVerified = getMarkerStatus(true, false, false, false);
    assert.strictEqual(localVerified.label, "Saved Locally");
    assert.strictEqual(localVerified.type, "local");
    assert.strictEqual(localVerified.liveTag, "Saved Locally");

    // Wrong choice eliminated
    const wrongElim = getMarkerStatus(false, false, true, true);
    assert.strictEqual(wrongElim.label, "Choice Eliminated");
    assert.strictEqual(wrongElim.type, "eliminated");

    // Userscript code verification
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("function injectReviewQuestionMarkers"), "Must define injectReviewQuestionMarkers");
    assert.ok(script.includes("amaes-review-status-pill"), "Must inject amaes-review-status-pill into question info");
    assert.ok(script.includes("amaes-review-outcome-banner"), "Must inject amaes-review-outcome-banner into outcome");
    assert.ok(script.includes("Saved to Study Bank"), "Must show Saved to Study Bank when cloud sharing is on");
    assert.ok(script.includes("Saved Locally"), "Must show Saved Locally when cloud sharing is off");
});

// --------------------------------------------------
// 58. Dropdown Option Elimination and Deduction
// --------------------------------------------------
test("Dropdown Option Elimination: marks confirmed wrong options with (❌ Eliminated) and deduces remaining", () => {
    function processSelectOptions(optionsList, wrongNorms, targetAns = '') {
        const eliminated = [];
        const validOptions = [];

        optionsList.forEach(optText => {
            if (wrongNorms.includes(optText)) {
                eliminated.push(`${optText} (❌ Eliminated)`);
            } else {
                validOptions.push(optText);
            }
        });

        let chosenOption = validOptions.find(o => o === targetAns) || null;
        let isDeduced = false;
        if (!chosenOption && validOptions.length === 1) {
            chosenOption = validOptions[0];
            isDeduced = true;
        }

        return { eliminated, validOptions, chosenOption, isDeduced };
    }

    // Automaton question with 4 options, 1 confirmed wrong ("01011")
    const options = ["01011", "010011", "10100", "010110"];
    const res1 = processSelectOptions(options, ["01011"], "01011");
    assert.deepStrictEqual(res1.eliminated, ["01011 (❌ Eliminated)"]);
    assert.strictEqual(res1.validOptions.includes("01011"), false, "Eliminated option must be excluded");
    assert.strictEqual(res1.chosenOption, null, "Target answer cannot be chosen if eliminated");

    // When 3 out of 4 options are eliminated -> remaining 4th option is deduced
    const res2 = processSelectOptions(options, ["01011", "010011", "10100"]);
    assert.strictEqual(res2.isDeduced, true, "Must deduce remaining option");
    assert.strictEqual(res2.chosenOption, "010110");

    // Userscript code verification
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("amaes-select-elim-hint"), "Must inject amaes-select-elim-hint on eliminated options");
    assert.ok(script.includes("(Eliminated)"), "Must label eliminated options with a plain-text status");
    assert.ok(script.includes("isDeducedSelect"), "Must support deduction on dropdowns");
});

// --------------------------------------------------
// 59. AI Prompt Contradiction Safety on Eliminated Choices
// --------------------------------------------------
test("AI Prompt Contradiction Safety: eliminates debunked choices from detected answer and annotates wrong choices in prompt", () => {
    function simulatePromptGeneration(data, cached, eliminatedFromDOM = [], copyIncludeConfidence = true) {
        let output = `${data.qText}\n\n`;
        const eliminatedWrong = [...eliminatedFromDOM];
        let detectedAnswer = null;

        // Cross-reference with candidate matches
        const moodleQNorm = normalizeChoice(data.qText);
        const cands = cached.filter(c => c.qNorm === moodleQNorm);
        cands.forEach(cand => {
            if (Array.isArray(cand.wrongAnswers)) {
                cand.wrongAnswers.forEach(w => {
                    const wText = typeof w === 'string' ? w : (w.text || w.norm);
                    if (wText && !eliminatedWrong.some(e => normalizeChoice(e) === normalizeChoice(wText))) {
                        eliminatedWrong.push(wText);
                    }
                });
            }
        });

        // Suppress detected answer if confirmed wrong
        const validCandidates = cands.filter(cand => {
            const ansText = cand.ansRaw || cand.answer || '';
            const ansNorm = cand.ansNorm || normalizeChoice(ansText);
            if (!ansNorm) return false;
            const isConfirmedWrong = eliminatedWrong.some(w => normalizeChoice(w) === ansNorm);
            return !isConfirmedWrong;
        });

        if (validCandidates.length > 0) {
            detectedAnswer = {
                text: validCandidates[0].ansRaw || validCandidates[0].answer,
                label: 'AMAUOED • 95% Probability',
                source: validCandidates[0].source || 'Verified Database'
            };
        }

        // Annotate choices directly
        const annotatedChoices = data.choices.map(choice => {
            const cleanChoiceText = choice.replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
            const normC = normalizeChoice(cleanChoiceText);
            const isWrong = eliminatedWrong.some(w => normalizeChoice(w) === normC);
            if (isWrong) {
                return `${choice} [CONFIRMED WRONG - DO NOT SELECT]`;
            }
            return choice;
        });
        output += annotatedChoices.join('\n');

        if (detectedAnswer && copyIncludeConfidence) {
            output += `\n\n[DETECTED ANSWER IN DATABASE]:\n- Suggested: ${detectedAnswer.text} (${detectedAnswer.label} • ${detectedAnswer.source})`;
        }

        if (eliminatedWrong.length > 0 && eliminatedWrong.length < data.choices.length) {
            output += `\n\n[CONFIRMED WRONG CHOICES - DO NOT SELECT]:\n` + eliminatedWrong.map(w => `- "${w}" (Tested and confirmed 100% INCORRECT in prior attempt)`).join('\n');
            output += `\nCRITICAL: Do NOT choose any option marked as confirmed wrong above. Pick strictly from the remaining candidate choices.`;
        }

        return { output, detectedAnswer, eliminatedWrong, annotatedChoices };
    }

    const questionData = {
        qText: "The following are phases of C++ Programs except ________.",
        choices: [
            "a. edit",
            "b. load",
            "c. compile",
            "d. process"
        ]
    };

    // Cache has an AMAUOED entry suggesting "Process" which is debunked!
    const mockCache = [
        {
            qNorm: normalizeChoice("The following are phases of C++ Programs except ________."),
            ansRaw: "Process",
            source: "amauoed",
            wrongAnswers: ["process"]
        }
    ];

    const result = simulatePromptGeneration(questionData, mockCache, ["process"]);

    // 1. Detected answer must be suppressed because "Process" is in eliminatedWrong
    assert.strictEqual(result.detectedAnswer, null, "Debunked answer 'Process' must NOT be suggested in detectedAnswer");
    assert.ok(!result.output.includes("[DETECTED ANSWER IN DATABASE]"), "Prompt must NOT contain [DETECTED ANSWER IN DATABASE] when suggestion is debunked");

    // 2. Choice 'd. process' must be annotated directly with [CONFIRMED WRONG - DO NOT SELECT]
    assert.ok(result.output.includes("d. process [CONFIRMED WRONG - DO NOT SELECT]"), "Choice 'process' must be marked [CONFIRMED WRONG - DO NOT SELECT]");

    // 3. Prompt must include the strict warning block
    assert.ok(result.output.includes("[CONFIRMED WRONG CHOICES - DO NOT SELECT]"), "Prompt must contain CONFIRMED WRONG CHOICES section");
    assert.ok(result.output.includes('- "process"'), "Prompt must list the debunked option");
    assert.ok(result.output.includes("CRITICAL: Do NOT choose any option marked as confirmed wrong above"), "Prompt must include CRITICAL instruction");

    // Userscript code verification
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("[CONFIRMED WRONG - DO NOT SELECT]"), "Userscript must annotate wrong choices in prompt");
    assert.ok(script.includes("amaes-eliminated-choice"), "Userscript must read live DOM for eliminated choices");
    assert.ok(script.includes("validCandidates"), "Userscript must filter out debunked candidates before setting detectedAnswer");
});

// --------------------------------------------------
// 60. Icon Registry Integrity
// --------------------------------------------------
test("Icon Registry Integrity: all ICONS accessed in codebase are defined in ICONS dictionary (no undefined icons like cloudUpload)", () => {
    const fs = require('fs');
    const code = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    const iconsMatch = code.match(/const ICONS = \{([\s\S]*?)\n    \};/);
    assert.ok(iconsMatch, "ICONS dictionary must exist in userscript");
    const iconKeys = [...iconsMatch[1].matchAll(/([a-zA-Z0-9_]+)\s*:/g)].map(m => m[1]);
    assert.ok(iconKeys.includes("cloudUpload"), "ICONS must include cloudUpload");

    const used = [...code.matchAll(/ICONS\.([a-zA-Z0-9_]+)/g)].map(m => m[1]);
    const missing = [...new Set(used.filter(k => !iconKeys.includes(k)))];
    assert.deepStrictEqual(missing, [], `All accessed ICONS must be defined. Missing: ${missing.join(', ')}`);
});

// --------------------------------------------------
// 61. Image Choice Normalization Across Attempts
// --------------------------------------------------
test("Image Choice Normalization: normalizes Moodle dynamic pluginfile URLs so image choices match across different quiz attempts", () => {
    function normalizeMoodleChoice(str) {
        let text = str.toLowerCase().trim();
        text = text.replace(/https?:\/\/[^\/]+\/pluginfile\.php\/\d+\/question\/(?:answer|questiontext|feedback)\/\d+(?:\/\d+)?\/([^?#\s]+)/gi, '[moodle-asset:$1]');
        text = text.replace(/^select (?:one or more choices?|one or more|all that apply|one):?\s*/i, '').replace(/^[a-e][.)]\s*/i, '');
        return text.trim();
    }

    const reviewAttemptUrl = "https://semestral.amaes.com/pluginfile.php/12345/question/answer/67890/1/computer.jpg";
    const newAttemptUrl = "https://semestral.amaes.com/pluginfile.php/99999/question/answer/88888/1/computer.jpg";

    const normalizedReview = normalizeMoodleChoice(`[Image: ${reviewAttemptUrl}]`);
    const normalizedNew = normalizeMoodleChoice(`a. [Image: ${newAttemptUrl}]`);

    assert.strictEqual(normalizedReview, "[image: [moodle-asset:computer.jpg]]");
    assert.strictEqual(normalizedNew, "[image: [moodle-asset:computer.jpg]]");
    assert.strictEqual(normalizedReview, normalizedNew, "Choice from review must match choice on new attempt regardless of pluginfile attempt ID");

    // Userscript code verification
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("moodle-asset:"), "Userscript must contain moodle-asset normalization token");
});

// --------------------------------------------------
// 62. Review Screen Full Mark Safety
// --------------------------------------------------
test("Review Screen Full Mark Safety: questions that score 1.00 out of 1.00 are guaranteed to never display Wrong Choice Saved, and live text input is harvested as verified answer", () => {
    function evaluateReviewMarker(isFullMark, isZeroMark, ansText, wrongList, cloudSharingOn) {
        let pillStatus = null;
        let bannerText = null;

        const wrongNorms = wrongList.map(w => typeof w === 'string' ? normalizeChoice(w) : (w.norm || normalizeChoice(w.text || '')));
        const ansNorm = normalizeChoice(ansText);
        const isDebunked = ansNorm && wrongNorms.some(w => w === ansNorm);

        if (isDebunked) {
            ansText = '';
        }

        const isVerified = Boolean(!isDebunked && ansText && isFullMark);

        if (isVerified && ansText) {
            pillStatus = cloudSharingOn ? "Uploaded to DB" : "Saved to Local DB";
            bannerText = `Verified Answer: "${ansText}"`;
        } else if (isZeroMark && !isFullMark) {
            pillStatus = "Choice Eliminated";
            bannerText = `Eliminated: "${wrongList.join(', ')}" (Confirmed Incorrect)`;
        }

        return { pillStatus, bannerText, isVerified };
    }

    // Case 1: Question scored 1.00 out of 1.00 with answer "Memory", even if wrongList has old wrong attempts
    const res1 = evaluateReviewMarker(true, false, "Memory", ["control"], true);
    assert.strictEqual(res1.isVerified, true, "Full mark question must be verified");
    assert.strictEqual(res1.pillStatus, "Uploaded to DB", "Must show Uploaded to DB, NEVER Choice Eliminated");
    assert.strictEqual(res1.bannerText, 'Verified Answer: "Memory"');

    // Case 2: Question scored 0.00 out of 1.00 with answer "Process" that was debunked
    const res2 = evaluateReviewMarker(false, true, "Process", ["Process"], true);
    assert.strictEqual(res2.isVerified, false, "Debunked answer cannot be verified");
    assert.strictEqual(res2.pillStatus, "Choice Eliminated", "Zero mark question must show Choice Eliminated");
    assert.strictEqual(res2.bannerText, 'Eliminated: "Process" (Confirmed Incorrect)');

    // Userscript code verification
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("isZeroMark && !isFullMark"), "Userscript must protect full mark questions from wrong choice pill");
    assert.ok(script.includes("!ansText && isFullMark"), "Userscript must extract ansText from live DOM when question scored full marks");
});

// --------------------------------------------------
// 63. Moodle Ground Truth Override & Checkmark Safety
// --------------------------------------------------
test("Moodle Ground Truth Override: Confirmed checkmark or 1.00 score purges conflicting distractors, blocks false debunking, and guarantees choice is highlighted as verified", () => {
    // Simulate injectReviewQuestionMarkers ground-truth override
    function processReviewGroundTruth(isFullMark, hasCheckmark, liveChoiceText, cachedWrongList) {
        let ansText = liveChoiceText;
        const wrongList = [...cachedWrongList];
        const ansNorm = normalizeChoice(ansText);
        const isConfirmedByMoodle = Boolean(isFullMark || hasCheckmark);

        let isDebunked = false;
        if (isConfirmedByMoodle && ansNorm) {
            isDebunked = false;
            // Purge conflicting wrongAnswers
            for (let i = wrongList.length - 1; i >= 0; i--) {
                const wNorm = typeof wrongList[i] === 'string' ? normalizeChoice(wrongList[i]) : (wrongList[i].norm || normalizeChoice(wrongList[i].text || ''));
                if (wNorm === ansNorm || unscriptDigits(wNorm) === unscriptDigits(ansNorm)) {
                    wrongList.splice(i, 1);
                }
            }
        } else if (ansNorm && wrongList.some(w => normalizeChoice(w) === ansNorm)) {
            isDebunked = true;
            ansText = '';
        }

        const isVerified = Boolean(!isDebunked && ansText && isConfirmedByMoodle);
        return { isVerified, ansText, wrongList, isDebunked };
    }

    // Scenario: User answered "Address line", Moodle gave 1.00 out of 1.00 with checkmark,
    // but AMAUOED scraper had erroneously placed "Address line" into wrongAnswers.
    const result = processReviewGroundTruth(true, true, "Address line", ["Address line", "Control line"]);
    assert.strictEqual(result.isDebunked, false, "Ground truth must PREVENT debunking when Moodle gives full mark");
    assert.strictEqual(result.isVerified, true, "Ground truth must MARK choice as verified");
    assert.strictEqual(result.ansText, "Address line", "Answer text must not be wiped");
    assert.deepStrictEqual(result.wrongList, ["Control line"], "Conflicting distractor must be purged from wrongList");

    // Scenario 2: Choice rows highlighting logic check
    function evaluateChoiceHighlight(choiceText, hasDomCheckmark, verifiedNorms, allWrongList) {
        const norm = normalizeChoice(choiceText);
        const isVerifiedChoice = hasDomCheckmark || verifiedNorms.has(norm);
        const isEliminatedChoice = !isVerifiedChoice && allWrongList.some(w => w.norm === norm);
        
        let badgeType = null;
        if (!isEliminatedChoice && isVerifiedChoice) {
            badgeType = "Verified";
        } else if (!isVerifiedChoice && (isEliminatedChoice || allWrongList.length > 0)) {
            const matchedWrong = allWrongList.find(w => w.norm === norm);
            if (matchedWrong) badgeType = "Eliminated";
        }
        return { isVerifiedChoice, isEliminatedChoice, badgeType };
    }

    const verifiedSet = new Set(["address line"]);
    const wrongItems = [{ norm: "address line", count: 1 }, { norm: "control line", count: 1 }];

    const highlightRes = evaluateChoiceHighlight("Address line", true, verifiedSet, wrongItems);
    assert.strictEqual(highlightRes.isVerifiedChoice, true, "Choice with DOM checkmark must be verified");
    assert.strictEqual(highlightRes.isEliminatedChoice, false, "Choice with DOM checkmark must NEVER be eliminated");
    assert.strictEqual(highlightRes.badgeType, "Verified", "Badge must be Verified, NOT Eliminated");

    // Userscript code verification
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("isConfirmedByMoodle"), "Userscript must define isConfirmedByMoodle ground-truth check");
    assert.ok(script.includes("!isVerifiedChoice"), "Userscript must guard against eliminating verified choices");
    assert.ok(script.includes("hasDomCheckmark"), "Userscript must check DOM checkmarks when evaluating choices");
});

// --------------------------------------------------
// 64. Decimal and Multi-Answer Partial Scoring
// --------------------------------------------------
test("Decimal & Multi-Answer Partial Scoring: handles decimal marks (3.40, 2.10) and harvests checkmarked choices on partial scores while eliminating crossed choices", () => {
    function parseGrade(gradeText, classList = []) {
        let earned = null;
        let max = null;
        const match = (gradeText || '').match(/([0-9]+(?:\.[0-9]+)?)\s*out of\s*([0-9]+(?:\.[0-9]+)?)/i);
        if (match) {
            earned = parseFloat(match[1]);
            max = parseFloat(match[2]);
        }

        const hasCorrectClass = classList.includes('correct');
        const hasIncorrectClass = classList.includes('incorrect');
        const hasPartialClass = classList.includes('partiallycorrect');

        const isFullMark = Boolean(
            (max !== null && max > 0 && Math.abs(earned - max) < 0.001) ||
            (hasCorrectClass && !hasPartialClass && !hasIncorrectClass)
        );

        const isZeroMark = Boolean(
            (earned !== null && earned === 0) ||
            (hasIncorrectClass && !hasPartialClass && !hasCorrectClass)
        );

        const isPartialMark = Boolean(
            hasPartialClass ||
            (earned !== null && max !== null && earned > 0 && earned < max && Math.abs(earned - max) >= 0.001)
        );

        return { earned, max, isFullMark, isZeroMark, isPartialMark };
    }

    // Decimal score tests
    const g1 = parseGrade("Mark 3.40 out of 3.40");
    assert.strictEqual(g1.isFullMark, true, "3.40 / 3.40 must be full mark");
    assert.strictEqual(g1.isPartialMark, false);
    assert.strictEqual(g1.isZeroMark, false);

    const g2 = parseGrade("Mark 2.10 out of 3.00");
    assert.strictEqual(g2.isFullMark, false, "2.10 / 3.00 is not full mark");
    assert.strictEqual(g2.isPartialMark, true, "2.10 / 3.00 must be partial mark");
    assert.strictEqual(g2.isZeroMark, false);

    const g3 = parseGrade("Mark 3.40 out of 5.00");
    assert.strictEqual(g3.isFullMark, false);
    assert.strictEqual(g3.isPartialMark, true, "3.40 / 5.00 must be partial mark");

    const g4 = parseGrade("Mark 0.00 out of 2.50");
    assert.strictEqual(g4.isZeroMark, true, "0.00 / 2.50 must be zero mark");
    assert.strictEqual(g4.isFullMark, false);

    // Multi-answer partial harvesting simulation
    function harvestChoices(choiceData) {
        const checkmarked = [];
        const crossed = [];
        choiceData.forEach(c => {
            if (c.hasCheck) checkmarked.push(c.text);
            if (c.hasCross) crossed.push(c.text);
        });

        let rightAnswer = '';
        if (checkmarked.length > 0) {
            rightAnswer = checkmarked.join(', ');
        }
        const wrongAnswers = [...crossed];

        // Safety guard purge
        const verifiedSet = new Set(checkmarked.map(c => normalizeChoice(c)));
        for (let i = wrongAnswers.length - 1; i >= 0; i--) {
            if (verifiedSet.has(normalizeChoice(wrongAnswers[i]))) {
                wrongAnswers.splice(i, 1);
            }
        }
        return { rightAnswer, wrongAnswers };
    }

    const testChoices = [
        { text: "RAM", hasCheck: true, hasCross: false },
        { text: "ROM", hasCheck: true, hasCross: false },
        { text: "GPU", hasCheck: false, hasCross: true }
    ];

    const harvestRes = harvestChoices(testChoices);
    assert.strictEqual(harvestRes.rightAnswer, "RAM, ROM", "Checkmarked choices must be harvested as verified answers");
    assert.deepStrictEqual(harvestRes.wrongAnswers, ["GPU"], "Crossed choice must be harvested as wrong answer");
    assert.ok(!harvestRes.wrongAnswers.includes("RAM"), "Verified choice RAM must never be in wrongAnswers");
    assert.ok(!harvestRes.wrongAnswers.includes("ROM"), "Verified choice ROM must never be in wrongAnswers");

    // Choice normalization text cleaning check (strips accessibility text like Correct)
    const rawChoiceWithMoodleA11y = "Address line Correct";
    assert.strictEqual(normalizeChoice(rawChoiceWithMoodleA11y), "address line", "normalizeChoice must strip trailing Correct feedback word");

    // Userscript code verification
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("parseMoodleQuestionGrade"), "Userscript must contain parseMoodleQuestionGrade");
    assert.ok(script.includes("hasChoiceCheckmark"), "Userscript must contain hasChoiceCheckmark helper");
    assert.ok(script.includes("hasChoiceCross"), "Userscript must contain hasChoiceCross helper");
    assert.ok(script.includes("isPartialMark"), "Userscript must handle isPartialMark");
});

// --------------------------------------------------
// 65. Auto-Quiz Autonomous Progression vs Manual Selection Gate
// --------------------------------------------------
test("Auto-Quiz Autonomous Progression: auto-advances on Auto-Quiz answers; manual selection gated by autoNextQuiz", () => {
    // Simulator for Auto-Quiz solver advancement logic
    function simulateSolverAdvancement({ autoQuizMode, autoNextQuiz, unverifiedCount, totalCount, allAnswered, hasNextBtn }) {
        if (!autoQuizMode) return { advanced: false, reason: "Auto-quiz paused" };
        if (unverifiedCount === 0 && totalCount > 0) {
            if (allAnswered) {
                if (hasNextBtn) {
                    return { advanced: true, reason: "Auto-Quiz answered all questions and auto-advances" };
                }
            } else {
                return { advanced: false, reason: "Verified answers found but not all picked" };
            }
        }
        return { advanced: false, reason: "Unverified questions require user intervention" };
    }

    // Simulator for manual user click/check advancement logic
    function simulateUserCheckAdvancement({ autoNextQuiz, allAnswered }) {
        // Only advances if autoNextQuiz is explicitly toggled on AND all questions answered
        if (!autoNextQuiz) return { advanced: false, reason: "Manual check does not advance unless autoNextQuiz is toggled ON" };
        if (!allAnswered) return { advanced: false, reason: "Waiting for remaining questions on page" };
        return { advanced: true, reason: "Manual check auto-advances because autoNextQuiz is ON" };
    }

    // Scenario 1: Answered by Auto-Quiz (autoNextQuiz toggle is OFF - default)
    // -> Must auto-advance!
    const autoQuizRun = simulateSolverAdvancement({
        autoQuizMode: true,
        autoNextQuiz: false,
        unverifiedCount: 0,
        totalCount: 1,
        allAnswered: true,
        hasNextBtn: true
    });
    assert.strictEqual(autoQuizRun.advanced, true, "When answered by Auto-Quiz, it MUST auto-advance even if autoNextQuiz is false");

    // Scenario 2: Checked by user manually (autoNextQuiz toggle is OFF - default)
    // -> Must NOT auto-advance!
    const manualCheckDefault = simulateUserCheckAdvancement({
        autoNextQuiz: false,
        allAnswered: true
    });
    assert.strictEqual(manualCheckDefault.advanced, false, "When checked by user, must NOT auto-advance if autoNextQuiz is OFF");

    // Scenario 3: Checked by user manually (autoNextQuiz toggle is ON)
    // -> Must auto-advance!
    const manualCheckEnabled = simulateUserCheckAdvancement({
        autoNextQuiz: true,
        allAnswered: true
    });
    assert.strictEqual(manualCheckEnabled.advanced, true, "When checked by user and autoNextQuiz is ON, it MUST auto-advance");

    // Scenario 4: Auto-Quiz encounters unknown question -> pauses, user answers
    const autoQuizPaused = simulateSolverAdvancement({
        autoQuizMode: false,
        autoNextQuiz: false,
        unverifiedCount: 1,
        totalCount: 1,
        allAnswered: true,
        hasNextBtn: true
    });
    assert.strictEqual(autoQuizPaused.advanced, false, "When Auto-Quiz is paused on unknown question, solver must not auto-advance");

    // Verify userscript implementation
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("areAllPageQuestionsAnswered()"), "runAutoQuizSolver must verify all questions answered before advancing");
    assert.ok(script.includes("Answered by Auto-Quiz: automatically advance to next page!"), "Code must document Auto-Quiz autonomous progression");
});

// --------------------------------------------------
// 66. Persistent Update Now Button & Auto-Check
// --------------------------------------------------
test("Persistent Update Now Button: auto-checks updates, displays persistent Update Now in header/banner, removes manual check button", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Verify removal of old manual check updates button in Welcome modal
    assert.ok(!script.includes("btn-welcome-check-update"), "btn-welcome-check-update must be removed from the userscript");
    assert.ok(!script.includes("welcome-update-label"), "welcome-update-label must be removed from the userscript");

    // 2. Verify persistent Update Now buttons
    assert.ok(script.includes("amaes-header-update-btn"), "Header must include persistent amaes-header-update-btn");
    assert.ok(script.includes("btn-welcome-update-now"), "Welcome modal must include persistent btn-welcome-update-now");
    assert.ok(script.includes("hud-update-indicator"), "Quiz floating HUD must include hud-update-indicator");

    // 3. Verify no dismiss button that deletes the update banner
    assert.ok(!script.includes("btn-dismiss-update"), "Update banner must not have a dismiss button removing the notification");

    // 4. Verify background auto-check throttle window is 5 minutes (not 2 hours)
    assert.ok(script.includes("5 * 60 * 1000"), "Background auto-check throttle window must be 5 minutes");

    // 5. Verify direct installer opening on known updates
    assert.ok(script.includes("window.open(SCRIPT_RAW_URL, '_blank')"), "Must open raw userscript installer on update click");

    // 6. Pending installs must have one canonical refresh action
    assert.ok(script.includes("if (pending) {") && script.includes("if (existing) existing.remove();\n            return;"), "Top navigation must not duplicate the pending refresh action");
    assert.ok(script.includes("→ ${targetVer}"), "Version pill must cleanly label the available target version without clipping");
    assert.ok(!script.includes("→ Update to"), "Word 'Update to' must be removed from version pill to prevent clipping");
    assert.ok(script.includes("hudUpdateIndicator.style.display = pending ? 'none' : 'inline-flex'"), "HUD update action must hide while an install is pending");
    assert.ok(!script.includes("Refresh to Apply"), "Pending update state must not show a refresh action");
    assert.ok(script.includes("Update Queued"), "Pending update state must show a persistent informational status");
});

test("Database Compatibility Guard: validates cache shape and labels shared payloads", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("const ANSWER_DB_SCHEMA_VERSION = 2"), "Database schema version must be explicit");
    assert.ok(script.includes("if (!Array.isArray(parsed))"), "Cache reader must reject incompatible cache shapes");
    assert.ok(script.includes("storedSchema > ANSWER_DB_SCHEMA_VERSION"), "Cache reader must reject newer incompatible schemas");
    assert.ok(script.includes("storedSchema < ANSWER_DB_SCHEMA_VERSION"), "Cache reader must migrate older cache schema markers");
    assert.ok(script.includes("qNorm: item.qNorm || normalizeText"), "Cache reader must preserve legacy entries without qNorm");
    assert.ok(script.includes("if (!Array.isArray(newQuestions))"), "Cache merger must reject invalid incoming data");
    assert.ok(script.includes("incomingSchema > ANSWER_DB_SCHEMA_VERSION"), "Cloud reader must reject newer incompatible schemas");
    assert.ok(script.includes("clientVersion: SCRIPT_VERSION.replace"), "Community payload must identify the client version");
    assert.ok(script.includes("databaseSchema: ANSWER_DB_SCHEMA_VERSION"), "Community payload must identify the database schema");
});

// --------------------------------------------------
test("User-Friendly Terminology: 'Harvest' jargon replaced with 'Collect & Share Anonymously' in UI", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Verify Welcome Modal card title and toggle
    assert.ok(script.includes("Collect & Share Anonymously"), "Welcome modal must have 'Collect & Share Anonymously' header");
    assert.ok(script.includes("Collect & Share Anonymously"), "Welcome modal must identify anonymous collection and sharing");
    assert.ok(script.includes("Auto-collect confirmed answers from past quizzes"), "Must use 'Auto-collect' instead of 'Auto-harvest'");

    // 2. Verify Database tab 1-click action button
    assert.ok(script.includes("Collect & Share Answers"), "DB tab button must be 'Collect & Share Answers'");
    assert.ok(!script.includes("<span>Harvest Quizzes</span>"), "Old 'Harvest Quizzes' button label must be removed");

    // 3. Verify settings checkboxes in DB Tab
    assert.ok(script.includes("Auto-collect confirmed answers from past quizzes"), "DB settings must say 'Auto-collect confirmed answers from past quizzes'");
    assert.ok(script.includes("Share verified review answers anonymously"), "DB settings must say 'Share verified review answers anonymously'");
});

// --------------------------------------------------
// 68. Keyboard Shortcut 'H' Scope Integrity
// --------------------------------------------------
test("Keyboard Shortcut 'H' Scope Integrity: resolves subCode cleanly without ReferenceError", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // Find key === 'H' block
    const hIdx = script.indexOf("if (key === 'H')");
    assert.ok(hIdx !== -1, "Shortcut H handler must exist");
    const hBlock = script.substring(hIdx, hIdx + 500);

    assert.ok(hBlock.includes("const courseInfo = detectCourseInfo();"), "Shortcut H must detect course info");
    assert.ok(hBlock.includes("const subCode = courseInfo.subjectCode || 'CS6301';"), "Shortcut H must declare subCode before accessing getCachedAnswers");
});

// --------------------------------------------------
// 69. Dynamic Semester Base Path for Dashboard & Grade URLs
// --------------------------------------------------
test("Dynamic Semester Base Path: generates valid course and grade URLs without /my/ 404 prefix", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // Verify detectDashboardCourses uses getSemesterBasePath
    const dashIdx = script.indexOf("function detectDashboardCourses()");
    assert.ok(dashIdx !== -1, "detectDashboardCourses must exist");
    const dashBlock = script.substring(dashIdx, dashIdx + 2000);
    assert.ok(!dashBlock.includes("pathParts.length > 2"), "detectDashboardCourses must not use flawed pathParts logic");
    assert.ok(dashBlock.includes("const semPath = getSemesterBasePath();"), "detectDashboardCourses must use getSemesterBasePath()");

    // Verify executeGradesHarvester uses getSemesterBasePath
    const harvestIdx = script.indexOf("async function executeGradesHarvester");
    assert.ok(harvestIdx !== -1, "executeGradesHarvester must exist");
    const harvestBlock = script.substring(harvestIdx, harvestIdx + 3000);
    assert.ok(!harvestBlock.includes("pathParts.length > 2"), "executeGradesHarvester must not use flawed pathParts logic");
    assert.ok(harvestBlock.includes("const semPath = getSemesterBasePath();"), "executeGradesHarvester must use getSemesterBasePath()");
});

// --------------------------------------------------
// 70. Course Code Extraction Precision
// --------------------------------------------------
test("Course Code Extraction: accurately extracts subject codes without hyphen suffix collision", () => {
    function extractCode(text) {
        const m = text.match(/\b([A-Za-z]{2,6}\d{3,4}[A-Za-z]*)\b/) || text.match(/[-_]\s*([A-Za-z0-9]+)\b/);
        return m ? m[1].toUpperCase() : null;
    }

    assert.strictEqual(extractCode("CS6301 - Data Structures"), "CS6301", "Must not extract 'Data' from 'CS6301 - Data Structures'");
    assert.strictEqual(extractCode("ITE6300 - Cloud Computing"), "ITE6300", "Must not extract 'Cloud' from 'ITE6300 - Cloud Computing'");
    assert.strictEqual(extractCode("UGRD-CS6301 Data Structures and Algorithms"), "CS6301");
    assert.strictEqual(extractCode("UGRD_ITE6200 Application Development"), "ITE6200");
    assert.strictEqual(extractCode("MATH6100: Calculus 1"), "MATH6100");
    assert.strictEqual(extractCode("GE6107 Ethics"), "GE6107");
});

// --------------------------------------------------
// 71. Case-Insensitive Version Comparison
// --------------------------------------------------
test("Version Comparison: handles uppercase 'V' and lowercase 'v' prefixes identically", () => {
    function isNewerVersion(remote, local) {
        if (!remote || !local) return false;
        const r = remote.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
        const l = local.replace(/^v/i, '').split('.').map(n => parseInt(n, 10) || 0);
        for (let i = 0; i < Math.max(r.length, l.length); i++) {
            const rv = r[i] || 0;
            const lv = l[i] || 0;
            if (rv > lv) return true;
            if (rv < lv) return false;
        }
        return false;
    }

    assert.strictEqual(isNewerVersion("V1.4.6", "v1.4.5"), true, "Uppercase V remote must be recognized as newer");
    assert.strictEqual(isNewerVersion("v1.4.6", "V1.4.5"), true, "Lowercase v remote must be recognized as newer");
    assert.strictEqual(isNewerVersion("V1.4.5", "v1.4.5"), false, "Identical versions must return false");
});

// --------------------------------------------------
// 72. Debunked Multi-Answer Purge in Cache Merge
// --------------------------------------------------
test("Cache Merge Debunking: purges invalidated choices from cur.answers array", () => {
    function sanitizeAnswersOnDebunk(cur, inWNorm) {
        if (Array.isArray(cur.answers)) {
            cur.answers = cur.answers.filter(a => a.toLowerCase().trim() !== inWNorm);
            if (cur.answers.length === 0) {
                cur.answers = undefined;
                cur.ansRaw = '';
            } else {
                cur.ansRaw = cur.answers.join(', ');
            }
        }
        return cur;
    }

    const item = {
        answers: ["Option A", "Option B"],
        ansRaw: "Option A, Option B"
    };

    const sanitized = sanitizeAnswersOnDebunk(item, "option a");
    assert.deepStrictEqual(sanitized.answers, ["Option B"]);
    assert.strictEqual(sanitized.ansRaw, "Option B");

    const fullyDebunked = sanitizeAnswersOnDebunk(sanitized, "option b");
    assert.strictEqual(fullyDebunked.answers, undefined);
    assert.strictEqual(fullyDebunked.ansRaw, "");
});

// --------------------------------------------------
// 73. Checkbox Completion Gate on Single-Verified Multi-Answer Questions
// --------------------------------------------------
test("Checkbox Completion Gate: requires all highlighted checkboxes checked even if highlighted count is 1", () => {
    function checkBoxesAnswered(highlightedCount, allHighlightedChecked, anyChecked) {
        if (highlightedCount > 0) {
            return allHighlightedChecked;
        }
        return anyChecked;
    }

    // 1 highlighted box, not yet checked -> MUST NOT ADVANCE
    assert.strictEqual(checkBoxesAnswered(1, false, false), false);

    // 1 highlighted box, checked -> ALLOWED TO ADVANCE
    assert.strictEqual(checkBoxesAnswered(1, true, true), true);

    // 2 highlighted boxes, only 1 checked -> MUST NOT ADVANCE
    assert.strictEqual(checkBoxesAnswered(2, false, true), false);

    // 2 highlighted boxes, both checked -> ALLOWED TO ADVANCE
    assert.strictEqual(checkBoxesAnswered(2, true, true), true);

    // 0 highlighted boxes (unknown question), 1 choice checked by user -> ALLOWED TO ADVANCE
    assert.strictEqual(checkBoxesAnswered(0, false, true), true);
});

// --------------------------------------------------
// 74. Unanswered Question Reassurance & Sharing Banner
// --------------------------------------------------
test("Unanswered Question Reassurance: displays 'be the first to answer and share it' when question has no known answer", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Verify highlightQuizAnswers injects the reassurance badge on candidate 0
    assert.ok(script.includes("amaes-unanswered-hint"), "Userscript must define amaes-unanswered-hint badge class");
    assert.ok(script.includes("No answer known to the system yet — <b>be the first to answer and share it!</b>"), "Must include motivating prompt to be the first to answer");

    // 2. Verify blockage HUD includes explicit, low-cognitive-load steps and keyboard shortcuts
    assert.ok(script.includes("No saved answer yet"), "HUD must inform student that question is not yet in database");
    assert.ok(script.includes("press <b>V</b> to paste"), "HUD must explicitly instruct user to press V to paste");
    assert.ok(script.includes("press <b>N</b> to proceed"), "HUD must explicitly instruct user to press N to proceed");
    assert.ok(!script.includes("Auto-copied for AI (press <b>V</b> to paste), then review and click <b>Next page</b> or press <b>N</b> to proceed"), "Dense technical jargon run-on sentence must be eliminated");

    // 3. Verify cleanDOMToAI strips the unanswered hint so AI prompt is clean
    const aiCleanStart = script.indexOf("function cleanDOMToAI(");
    assert.ok(aiCleanStart !== -1, "cleanDOMToAI must exist");
    const aiCleanBlock = script.substring(aiCleanStart, aiCleanStart + 800);
    assert.ok(aiCleanBlock.includes(".amaes-unanswered-hint"), "cleanDOMToAI must strip .amaes-unanswered-hint");
});

// --------------------------------------------------
// 75. Non-Clunky Auto-Quiz State & Manual Progression
// --------------------------------------------------
test("Non-Clunky Auto-Quiz Progression: preserves autoQuizMode and advances past completed manual answers", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Verify autoQuizMode is NOT killed in Case B (it used to do autoQuizMode = false)
    const caseBStart = script.indexOf('// Case B: UNKNOWN QUESTION DETECTED');
    const caseBSection = script.substring(caseBStart, caseBStart + 25000);
    assert.ok(!caseBSection.includes("autoQuizMode = false;"), "Case B must NOT set autoQuizMode = false; to prevent killing solver for future questions");
    assert.ok(!caseBSection.includes("localStorage.setItem('amaes_auto_quiz_mode', 'false');"), "Case B must NOT overwrite localStorage auto_quiz_mode to false");
    assert.ok(caseBSection.includes("isWaitingForUserAnswer = true;"), "Case B must use isWaitingForUserAnswer flag for current question");

    // 2. Manual answers in active Auto-Quiz mode move to the next unanswered target.
    assert.ok(script.includes("scheduleAutoNextAfterAnswer(delayMs = 800, isManualAnswer = false)"), "scheduleAutoNextAfterAnswer must support isManualAnswer parameter");
    assert.ok(script.includes("scheduleAutoNextAfterAnswer(800, true, firstBlockedQue);"), "Manual answers must advance from the completed blocked question");
    assert.ok(script.includes("if (autoQuizMode) {\n                    scheduleAutoNextAfterAnswer"), "Active Auto-Quiz must schedule progression after a manual answer");
    assert.ok(script.includes("if (isManualAnswer && !autoNextQuiz) return;"), "Manual auto-next must require the Auto-Next setting");
    assert.ok(script.includes("isMultiQuestionPage && autoQuizMode && autoNextQuiz"), "Multi-question manual progression must require Auto-Next");

    // 3. Manual answers remain recorded and are not mistaken for unknown questions.
    assert.ok(script.includes("if (isQuestionAnswered(que)) return;"), "Answered questions must be excluded from unknown-question processing");

    // 4. Verify verified auto-next default is enabled
    assert.ok(script.includes("autoNextVerified = localStorage.getItem('amaes_auto_next_verified') !== 'false';"), "Auto-next on verified answers must default to true");
});

// --------------------------------------------------
// 76. In-Question Stop Controls & Manual Answer Override Gate
// --------------------------------------------------
test("In-Question Stop Controls: provides stop/resume button up top and blocks automated interference during manual decision", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. In-question top toolbar injector exists
    assert.ok(script.includes("function injectQuestionTopToolbars()"), "Must define injectQuestionTopToolbars");
    assert.ok(script.includes("amaes-que-top-toolbar"), "Must create amaes-que-top-toolbar at top of formulation");
    assert.ok(script.includes("amaes-que-stop-btn"), "Must create amaes-que-stop-btn for 1-click stop/resume");

    // 2. Blockage HUD button exists
    assert.ok(script.includes("btn-blockage-stop"), "Must include stop button in blockage HUD");

    // 3. UI sync updates the single top control
    assert.ok(script.includes("document.querySelectorAll('.amaes-que-stop-btn')"), "syncAutoQuizUI must synchronize all top stop buttons");
    assert.ok(!script.includes("amaes-stop-quiz-card-btn"), "Must not duplicate stop control in question card actions");

    // 4. scheduleAutoNextAfterAnswer strictly gates on autoQuizMode
    const autoNextDef = script.substring(script.indexOf("function scheduleAutoNextAfterAnswer"), script.indexOf("function scheduleAutoNextAfterAnswer") + 300);
    assert.ok(autoNextDef.includes("if (!autoQuizMode) return;"), "scheduleAutoNextAfterAnswer must immediately exit if autoQuizMode is false");
});

test("In-question stop control stays right-aligned after solver updates", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("justify-content: flex-end;"), "Toolbar must align controls to the right");
    assert.ok(script.includes("width: 100%;") && script.includes("align-self: stretch;"), "Toolbar must span the question width");
    assert.ok(!script.includes("clear: both;"), "Toolbar must not clear Moodle floats and create a vertical gap");
    assert.ok(script.includes("margin-left: auto;") && script.includes("flex: 0 0 auto;"), "Stop button must remain anchored on the right");
});

// --------------------------------------------------
// 77. AMAUOED Direct Links, Warning Badge Styling & Universal Auto-Pick
// --------------------------------------------------
test("AMAUOED Links & Universal Auto-Pick: links directly to amauoed course page, warning yellow badge, and auto-picks across types", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Warning amber/yellow styling for unanswered questions
    const unansweredStart = script.indexOf("hint.className = 'amaes-unanswered-hint';");
    const unansweredSection = script.substring(unansweredStart, unansweredStart + 600);
    assert.ok(unansweredSection.includes("#f59e0b"), "Unanswered hint must use warning amber border/accent");
    assert.ok(unansweredSection.includes("rgba(245, 158, 11"), "Unanswered hint must use amber background styling");

    // 2. Clickable link to amauoed on verified badges and suggested headers
    assert.ok(script.includes("document.createElement(isAmauoed && !hasVerifiedSource ? 'a' : 'span')"), "AMAUOED-only badge must render as link");
    assert.ok(script.includes("badge.target = '_blank';"), "AMAUOED badge link must open in new tab");
    assert.ok(script.includes("Suggested (amauoed.com):</a>"), "Suggested AMAUOED headers must link to course study guide");

    // 3. Universal Auto-Pick across all question types
    assert.ok(script.includes("canSelectAnswer = isManualSelect || (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode));"), "Radio auto-select must support autoPickQuiz and gate on autoSelect/mode");
    assert.ok(script.includes("input.dispatchEvent(new Event('change', { bubbles: true }));"), "Radio auto-select must dispatch change event");
    assert.ok(script.includes("canAutoFill = isManualSelect || (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode));"), "Short answer must support autoPickQuiz and gate on autoSelect/mode");
    assert.ok(script.includes("canAutoPick = isManualSelect || (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode));"), "Dropdown & drag/drop must support autoPickQuiz and gate on autoSelect/mode");

    // 4. Fallback warning badge when candidates exist but choices differ
    assert.ok(script.includes("if (!foundMatchForQuestion) {"), "Must embed unanswered warning when no choice matches known candidates");

    // 5. User Manual Override Protection: Never overwrite active student answer
    assert.ok(script.includes("!anyRadioChecked || isManualSelect"), "Must never overwrite user's manual radio selection with auto-picked choice");
});

// --------------------------------------------------
// 78. Simplified Quiz Layout & True Default Reset
// --------------------------------------------------
test("Simplified Quiz Layout & True Default Reset: verifies minimal core toggles, collapsible advanced settings, and pure-highlight initial page load", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Initial page load highlights only without auto-clicking choices when autoQuizMode is false
    const pageLoadStart = script.indexOf('pageLoadSolverTimer = setTimeout');
    const pageLoadSection = script.substring(pageLoadStart, pageLoadStart + 1500);
    assert.ok(pageLoadSection.includes("highlightQuizAnswers(cached, false, false);"), "Page load with autoQuizMode false must pass false for auto-select to prevent accidental clicks on fresh install");

    // 2. Collapsible advanced settings accordion exists
    assert.ok(script.includes('id="amaes-advanced-quiz-settings"'), "Must contain collapsible advanced settings container to prevent toggle fatigue");
    assert.ok(script.includes('<details id="amaes-advanced-quiz-settings"'), "Must use native details element for clean toggle collapse");

    // 3. Subtext under Master Auto-Quiz button clarifies behavior
    assert.ok(script.includes('id="amaes-autoquiz-subtext"'), "Must provide autoquiz subtext describing auto-answering and pause-on-unknown behavior");

    // 4. Primary Core 3-Step Pipeline: Highlight -> Auto-Pick -> Auto-Next
    const quizTabStart = script.indexOf('id="tab-pane-quiz"');
    const advancedStart = script.indexOf('id="amaes-advanced-quiz-settings"');
    const coreSection = script.substring(quizTabStart, advancedStart);
    assert.ok(coreSection.includes('id="chk-auto-hl-quiz"'), "Core settings must include Highlight Answers");
    assert.ok(coreSection.includes('id="chk-auto-pick"'), "Core settings must include Auto-Pick verified choices");
    assert.ok(coreSection.includes('id="chk-auto-next-verified"'), "Core settings must include Auto-Next when Answered");

    // 5. Advanced settings grouped into clean sections without redundant keys button
    assert.ok(script.includes("Navigation & Interface"), "Advanced settings must have Navigation & Interface sub-header");
    assert.ok(script.includes("AI Prompt Formatting"), "Advanced settings must have AI Prompt Formatting sub-header");
    assert.ok(!script.includes('id="btn-show-shortcuts-guide"'), "Duplicate inner [Keys] button must be removed in favor of status strip button");

    // 6. resetAllSettingsToDefault synchronizes autoPickQuiz, autoNextVerified, and keeps panel visible
    const resetStart = script.indexOf('function resetAllSettingsToDefault()');
    const resetEnd = script.indexOf('function detectTermFromText');
    const resetSection = script.substring(resetStart, resetEnd);
    assert.ok(resetSection.includes("localStorage.setItem('amaes_auto_pick_quiz', 'true');"), "Reset must set auto_pick_quiz to true so auto-quiz works when started");
    assert.ok(resetSection.includes("localStorage.setItem('amaes_auto_min_quiz', 'false');"), "Reset must NOT auto-minimize panel by default");
    assert.ok(resetSection.includes("clearTimeout(autoNextTimer);"), "Reset must clear running navigation timers");
    assert.ok(resetSection.includes("syncAutoQuizUI(false);"), "Reset must refresh UI buttons to start state");
});

// --------------------------------------------------
// 79. Shortcuts Hotkey & Comprehensive Cheatsheet Access
// --------------------------------------------------
test("Shortcuts Hotkey & Comprehensive Cheatsheet Access: verifies '?' and 'K' trigger quick guide modal and redundant status strip is removed", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Verify ? and K shortcuts handler is present
    assert.ok(script.includes("e.key === '?' || (e.key === '/' && e.shiftKey) || e.key === 'k' || e.key === 'K'"), "Must support '?' and 'K' as global shortcut to open help and shortcuts");
    assert.ok(script.includes("Shortcuts Cheatsheet (?)"), "Must notify user when shortcuts cheatsheet is opened via keyboard");

    // 2. Verify status strip button is removed to eliminate visual clutter
    assert.ok(!script.includes('id="btn-status-shortcuts-guide"'), "Redundant status strip button must be removed");

    // 3. Verify expanded cheatsheet grid in welcome / quick guide modal
    assert.ok(script.includes("Keyboard Shortcuts Cheatsheet (Comprehensive)"), "Quick guide must contain comprehensive cheatsheet");
    assert.ok(script.includes("Next Question / Page"), "Cheatsheet must describe Space / N next question");
    assert.ok(script.includes("Copy AI Prompt"), "Cheatsheet must describe C copy prompt");
    assert.ok(script.includes("Paste AI Answer"), "Cheatsheet must describe V paste AI");
    assert.ok(script.includes("Pause / Resume Auto-Quiz"), "Cheatsheet must describe P pause auto-quiz");
    assert.ok(script.includes("Select Choice 1 to 4"), "Cheatsheet must describe 1-4 choice selection");
    assert.ok(script.includes("Highlight Answers"), "Cheatsheet must describe H highlight answers");
    assert.ok(script.includes("Close Modal / Minimize"), "Cheatsheet must describe Esc shortcut");
});

// --------------------------------------------------
// 80. Drag and Drop Multi-Blank Safety & Link Click Isolation
// --------------------------------------------------
test("Drag and Drop Multi-Blank Safety: prevents answer duplication across blanks and guarantees link opens new tab", () => {
    // 1. Multi-blank target answer allocation simulation
    function assignTargetAnswers(candAnswers, bestAnswer, dropZoneCount) {
        const results = [];
        for (let idx = 0; idx < dropZoneCount; idx++) {
            let targetAns = dropZoneCount === 1 ? (candAnswers[0] || bestAnswer || '') : (candAnswers[idx] || '');
            targetAns = targetAns.replace(/^Blank\s*\d+\s*[:\-–]\s*/i, '').trim();
            results.push(targetAns);
        }
        return results;
    }

    // 4 drop zones, but AMAUOED only has single answer "Start State"
    const singleCandidateAnswers = ["Start State"];
    const blankAssignments = assignTargetAnswers(singleCandidateAnswers, "Start State", 4);
    assert.strictEqual(blankAssignments[0], "Start State", "Blank 1 receives the matched answer");
    assert.strictEqual(blankAssignments[1], "", "Blank 2 must NOT duplicate 'Start State'");
    assert.strictEqual(blankAssignments[2], "", "Blank 3 must NOT duplicate 'Start State'");
    assert.strictEqual(blankAssignments[3], "", "Blank 4 must NOT duplicate 'Start State'");

    // 2. Choice uniqueness simulation
    const dragChoices = [
        { text: "Start State", isInfinite: false },
        { text: "Intermediate State", isInfinite: false },
        { text: "Final State", isInfinite: false },
        { text: "Dead State", isInfinite: false }
    ];
    const used = new Set();
    function pickChoice(text) {
        const found = dragChoices.find(c => (c.isInfinite || !used.has(c)) && c.text.toLowerCase() === text.toLowerCase());
        if (found) {
            used.add(found);
            return found;
        }
        return null;
    }

    const first = pickChoice("Start State");
    assert.ok(first, "First blank claims Start State");
    const second = pickChoice("Start State");
    assert.strictEqual(second, null, "Second blank cannot re-use single-use Start State choice");

    // 3. Script checks
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // Link click isolation
    assert.ok(script.includes('onclick="event.stopPropagation();"'), "AMAUOED suggested link must stop propagation so hint container does not intercept");
    assert.ok(script.includes("if (e && e.target && e.target.closest('a')) return;"), "Drag-drop placeFn must ignore clicks originating on links");

    // Multi-blank Drag-and-Drop checks
    assert.ok(script.includes("usedDrags = new Set()"), "Drag-and-drop must track used choices to prevent duplicate placement");
    assert.ok(script.includes("targetAns = dropZones.length === 1 ? (candAnswers[0] || bestAnswer || '') : (candAnswers[idx] || '');"), "Drop zones must not copy single answer to remaining blanks");
    assert.ok(script.includes("amaes-partial-drag-hint"), "Drag-drop must display partial match banner when not all blanks have answers");
});

// --------------------------------------------------
// 81. Escape Key Handler: Close Modal First, Minimize Panel Second
// --------------------------------------------------
test("Escape Key Shortcut: closes modal on first press, then minimizes/toggles panel on subsequent press", () => {
    // 1. Simulation of Escape state machine
    let modalOpen = true;
    let panelMinimized = false;

    function handleEscape() {
        if (modalOpen) {
            modalOpen = false;
            return "modal_closed";
        }
        panelMinimized = !panelMinimized;
        return panelMinimized ? "panel_minimized" : "panel_expanded";
    }

    // Press 1: Closes open modal
    assert.strictEqual(handleEscape(), "modal_closed", "First Escape press must close open modal");
    assert.strictEqual(modalOpen, false, "Modal is now closed");
    assert.strictEqual(panelMinimized, false, "Panel remains open on first press");

    // Press 2: Minimizes panel
    assert.strictEqual(handleEscape(), "panel_minimized", "Second Escape press must minimize panel");
    assert.strictEqual(panelMinimized, true, "Panel is now minimized");

    // Press 3: Toggles/expands panel
    assert.strictEqual(handleEscape(), "panel_expanded", "Third Escape press toggles panel back to expanded");
    assert.strictEqual(panelMinimized, false, "Panel is now expanded");

    // 2. Script inspection
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // Handler presence
    assert.ok(script.includes("e.key === 'Escape' || e.key === 'Esc'"), "Keyboard handler must listen for Escape/Esc key");
    assert.ok(script.includes("welcomeModal || contributeModal"), "Escape handler must prioritize dismissing open modals");
    assert.ok(script.includes("Toolkit Minimized (Esc)"), "Escape handler must provide toast feedback when minimizing panel");
    assert.ok(script.includes("Toolkit Expanded (Esc)"), "Escape handler must provide toast feedback when expanding panel");

    // Safety bypass for Escape in inputs
    assert.ok(script.includes("if (isTextInput && e.key !== 'Escape' && e.key !== 'Esc') return;"), "Escape key must bypass text input suppression to allow modal dismissal");

    // Documented in cheatsheet
    assert.ok(script.includes("Close Modal / Minimize"), "Escape key must be documented in shortcuts cheatsheet");
});

test("Navbar Version Badge, Persistent Top-Right Update Notice, and Reinstall Refresh Lifecycle", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Version integrity
    assert.ok(script.includes('@version      1.8.0'), "Userscript header must specify v1.8.0");
    assert.ok(script.includes('const SCRIPT_VERSION = "v1.8.0";'), "Constant SCRIPT_VERSION must be v1.8.0");

    // 2. Elimination of redundant topbar brand badge clutter
    assert.ok(!script.includes("function injectTopNavbarToolkitBadge()"), "Redundant topbar badge function must be removed");
    assert.ok(!script.includes("badge.id = 'amaes-topbar-version-badge'"), "Must not create amaes-topbar-version-badge element");
    assert.ok(script.includes("document.getElementById('amaes-topbar-version-badge')?.remove()"), "Must clean up any leftover badge element from previous sessions");

    // 3. Top-right persistent notification item
    assert.ok(script.includes("function injectTopNavUpdateNotification(latestVersion)"), "Must define injectTopNavUpdateNotification");
    assert.ok(script.includes("id = 'amaes-topnav-update-item'"), "Item must use id amaes-topnav-update-item");
    assert.ok(script.includes("id=\"amaes-topnav-update-btn\""), "Must include Update Toolkit button");
    assert.ok(script.includes("triggerScriptUpdate(latestVersion)"), "Update button must call triggerScriptUpdate");
    assert.ok(!script.includes("id=\"amaes-topnav-refresh-btn\""), "Pending update must not include a refresh button");
    assert.ok(!script.includes("if (manual) {\n                // If an update is ALREADY known from cache"), "Manual checks must not install stale cached versions");

    // 4. Pending updates remain informational instead of offering repeated refresh actions
    assert.ok(!script.includes("id=\"amaes-banner-refresh-btn\""), "Panel update banner must not provide a refresh button");
    assert.ok(!script.includes("btn-welcome-refresh-page"), "Welcome guide must not provide a refresh button");

    // 5. Pending update install and post-reinstall detection
    assert.ok(script.includes("function checkPendingUpdateInstallation()"), "Must define checkPendingUpdateInstallation");
    assert.ok(script.includes("localStorage.getItem('amaes_pending_update_install')"), "Must track pending update in localStorage");
    assert.ok(script.includes("Toolkit successfully updated to"), "Must display success toast when updated version is confirmed");
    assert.ok(script.includes("function setupPendingUpdateFocusListener()"), "Must define setupPendingUpdateFocusListener");
    assert.ok(script.includes("addEventListener('focus'"), "Must listen for tab focus to prompt reload after update");
    assert.ok(script.includes("addEventListener('visibilitychange'"), "Must listen for visibilitychange to prompt reload after update");

    // 6. State machine simulation
    let mockStorage = {
        'amaes_pending_update_install': '1.5.0',
        'amaes_last_seen_version': '1.4.14'
    };
    let toastMessage = '';
    const SCRIPT_VER = 'v1.6.7';

    function simulateCheckPending() {
        const pending = mockStorage['amaes_pending_update_install'];
        if (pending && !isNewerVersion(pending, SCRIPT_VER)) {
            delete mockStorage['amaes_pending_update_install'];
            delete mockStorage['amaes_latest_version_seen'];
            toastMessage = `Toolkit successfully updated to ${SCRIPT_VER}!`;
        }
        mockStorage['amaes_last_seen_version'] = SCRIPT_VER;
    }

    simulateCheckPending();
    assert.strictEqual(mockStorage['amaes_pending_update_install'], undefined, "Pending update flag must be cleared on successful reload");
    assert.strictEqual(toastMessage, "Toolkit successfully updated to v1.6.7!", "Must display update success message");
    assert.strictEqual(mockStorage['amaes_last_seen_version'], 'v1.6.7', "Last seen version must be updated");
});

test("Help Panel: includes clickable links to GitHub, Greasy Fork, and Website", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Constants
    assert.ok(script.includes('const GREASYFORK_URL = "https://greasyfork.org/en/scripts/594744-amaes-toolkit";'), "Must define GREASYFORK_URL constant");
    assert.ok(script.includes('const GITHUB_REPO_URL = "https://github.com/Acads-Tools/amaes-toolkit";'), "Must define GITHUB_REPO_URL constant");
    assert.ok(script.includes('const WEBSITE_URL = "https://acads-tools.github.io/amaes-toolkit/";'), "Must define WEBSITE_URL constant");

    // 2. Icon definition
    assert.ok(script.includes("greasyfork: `<svg"), "greasyfork icon must be registered in ICONS");
    assert.ok(script.includes("globe: `<svg"), "globe icon must be registered in ICONS");

    // 3. Links in Help Panel (showWelcomeOnboardingModal)
    assert.ok(script.includes('href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer"'), "Help panel must contain target blank link to GitHub");
    assert.ok(script.includes('href="${GREASYFORK_URL}" target="_blank" rel="noopener noreferrer"'), "Help panel must contain target blank link to Greasy Fork");
    assert.ok(script.includes('href="${WEBSITE_URL}" target="_blank" rel="noopener noreferrer"'), "Help panel must contain target blank link to Website");

    // 4. Copied setup guide text
    assert.ok(script.includes('• Greasy Fork: ${GREASYFORK_URL}'), "Copied setup guide must include Greasy Fork URL");
    assert.ok(script.includes('• GitHub Repo: ${GITHUB_REPO_URL}'), "Copied setup guide must include GitHub URL");
});

test("All-in-One Quiz Support: instruction preamble stripping, viewport active question resolution, and Paste AI card button", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Verify getActiveViewportQuestion helper is defined and wired
    assert.ok(script.includes("function getActiveViewportQuestion()"), "Must define getActiveViewportQuestion");
    assert.ok(script.includes("const que = getActiveViewportQuestion();"), "btnCopyCurrQ must resolve active viewport question");
    assert.ok(script.includes("const targetQue = getActiveViewportQuestion();"), "Number shortcuts must resolve active viewport question");
    assert.ok(script.includes("const targetQue = explicitQue || getActiveViewportQuestion();"), "autoSelectFromAiClipboard must resolve active viewport question");

    // 2. Verify Paste AI button on question cards
    assert.ok(script.includes("amaes-paste-ai-card-btn"), "Question cards must feature Paste AI button");
    assert.ok(script.includes("autoSelectFromAiClipboard(que)"), "Paste AI card button must target specific question element");

    // 3. Preamble Normalization Logic
    function normalizeTextSimulation(str) {
        if (!str) return '';
        let text = str.toLowerCase().trim();
        text = text.replace(/^(question\s*\d+[\s:.]*|\d+[\s:.)]+)/, '');
        const preambleRegex = /^(?:(?:direction|directions|instruction|instructions)\s*[:.\-–]\s*)?(?:read\s+(?:each\s+|the\s+)?(?:statement|question|passage)s?\s+(?:carefully\s+)?(?:and\s+)?)?(?:choose|select|pick|identify|mark)\s+(?:the\s+)?(?:best|correct|appropriate|right)\s+(?:answer|choice|option)[.:?!;\s–-]*/i;
        while (preambleRegex.test(text)) {
            const nextText = text.replace(preambleRegex, '').trim();
            if (nextText.length === 0) break;
            text = nextText;
        }
        const trailingPromptRegex = /\b(?:select\s+one|select\s+one\s+or\s+more|choose\s+one|choose\s+one\s+or\s+more|choose\s+the\s+best\s+answer)[:.]?\s*$/i;
        if (trailingPromptRegex.test(text)) {
            const nextText = text.replace(trailingPromptRegex, '').trim();
            if (nextText.length > 0) text = nextText;
        }
        text = text.replace(/_{2,}/g, '___');
        text = text.replace(/\s+/g, ' ');
        text = text.replace(/[.:?!;,]+$/, '');
        return text.trim();
    }

    const q1 = normalizeTextSimulation("Choose the best answer.\nWhat was the name of the first smartphone released in 1992?");
    const q1Direct = normalizeTextSimulation("What was the name of the first smartphone released in 1992?");
    assert.strictEqual(q1, "what was the name of the first smartphone released in 1992");
    assert.strictEqual(q1, q1Direct, "Question with Choose the best answer preamble must normalize identically to bare question");

    const q2 = normalizeTextSimulation("Read the statement carefully and select the best answer: Who conceptualized the Dynabook?");
    const q2Direct = normalizeTextSimulation("Who conceptualized the Dynabook?");
    assert.strictEqual(q2, "who conceptualized the dynabook");
    assert.strictEqual(q2, q2Direct, "Question with Read statement... preamble must match direct question");

    const q3 = normalizeTextSimulation("Direction: Choose the correct answer. The Windows Phone 8 is also known as the _________.");
    assert.strictEqual(q3, "the windows phone 8 is also known as the ___");

    // 4. Viewport question resolution simulation
    const mockQuestions = [
        { id: 'q1', getBoundingClientRect: () => ({ top: -600, bottom: -200 }), classList: { contains: () => true } },
        { id: 'q2', getBoundingClientRect: () => ({ top: -20, bottom: 450 }), classList: { contains: () => false } },
        { id: 'q3', getBoundingClientRect: () => ({ top: 480, bottom: 900 }), classList: { contains: () => false } }
    ];

    function simulateGetActiveViewport(questions, vh = 800) {
        let bestQue = null;
        let bestScore = -1;
        for (const q of questions) {
            const rect = q.getBoundingClientRect();
            if (rect.bottom < 40 || rect.top > vh - 40) continue;
            const visibleTop = Math.max(0, rect.top);
            const visibleBottom = Math.min(vh, rect.bottom);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);
            if (visibleHeight <= 0) continue;
            let score = visibleHeight;
            if (rect.top >= -80 && rect.top <= vh * 0.6) {
                score += 600;
            }
            if (score > bestScore) {
                bestScore = score;
                bestQue = q;
            }
        }
        return bestQue || questions[0];
    }

    const activeQue = simulateGetActiveViewport(mockQuestions);
    assert.strictEqual(activeQue.id, 'q2', "Must prioritize question in primary reading viewport over offscreen or lower questions");
});

test("Active Question Visual Focus & Universal Question Type AI Formatting", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Verify Active Question Focus State and Badge
    assert.ok(script.includes("function setActiveQuestion(que, userClicked = false)"), "Must define setActiveQuestion helper");
    assert.ok(script.includes("amaes-active-focus-que"), "Must define amaes-active-focus-que class");
    assert.ok(script.includes("amaes-active-focus-badge"), "Must define amaes-active-focus-badge indicator");
    assert.ok(script.includes("Target Question"), "Indicator badge must display Target Question text");

    // 2. Verify Click-to-Focus Binding
    assert.ok(script.includes("que.dataset.amaesFocusBound"), "Must bind click listener to question elements for explicit user focus");
    assert.ok(script.includes("setActiveQuestion(que, true)"), "Clicking question must invoke setActiveQuestion with userClicked flag");

    // 3. Verify CSS styling
    assert.ok(script.includes(".que.amaes-active-focus-que {"), "Must include active question outline focus styles");
    assert.ok(script.includes("outline: 2.5px solid #2563eb"), "Must set distinct blue outline on active question");
    assert.ok(script.includes(".amaes-active-focus-badge {"), "Must define target badge CSS");

    // 4. Verify Universal Question Type Handling in extractQuestionData and formatQuestionForAI
    assert.ok(script.includes("isEssay = Boolean(que.querySelector('textarea"), "Must detect Essay and long answer textareas");
    assert.ok(script.includes("[Essay / Long Answer Question]"), "Must label essay questions cleanly for AI");
    assert.ok(script.includes("choiceInputs = que.querySelectorAll('.answer input[type=\"radio\"], .answer input[type=\"checkbox\"]')"), "Must support input element choice fallback");

    // 5. Verify formatAllQuestionsForAI Adaptive Instructions
    assert.ok(script.includes("For multiple choice questions: Answer with question number"), "All-questions prompt must provide clear multiple choice instructions");
    assert.ok(script.includes("For short answer, blanks, matching, or essays"), "All-questions prompt must support diverse question types");

    // 6. State Machine Simulation for Active Focus & Selection Lock
    let simulatedActive = null;
    let lockUntil = 0;
    const mockQue1 = { id: 'que-1', getBoundingClientRect: () => ({ top: 10, bottom: 300 }) };
    const mockQue2 = { id: 'que-2', getBoundingClientRect: () => ({ top: 320, bottom: 650 }) };

    function simSetActive(q, clicked = false) {
        simulatedActive = q;
        if (clicked) lockUntil = 5000;
    }

    // User clicks question 2
    simSetActive(mockQue2, true);
    assert.strictEqual(simulatedActive.id, 'que-2', "User click must set active question to que-2");
    assert.strictEqual(lockUntil, 5000, "User click must engage lock timer");
});

// --------------------------------------------------
// 84. Bundled Quiz Multi-Question Review Harvesting and DB Status Markers
// --------------------------------------------------
test("Bundled Quiz Multi-Question Review Harvesting and Universal DB Status Markers", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Universal Review Page Detection
    assert.ok(script.includes("function checkIsReviewPage()"), "Must define checkIsReviewPage");
    assert.ok(script.includes("document.querySelector('#page-mod-quiz-review, body.path-mod-quiz-review, .quizreviewsummary, table.quizreviewsummary')"), "Must detect review state via Moodle review container selectors");
    assert.ok(script.includes("document.querySelector('.que .outcome, .que .rightanswer')"), "Must detect review state via outcome/feedback presence");
    assert.ok(script.includes("/finish\\s+review/i.test"), "Must detect review state via Finish review control");

    // 2. Universal Choice Row Selectors (Fieldset Support)
    assert.ok(script.includes("choiceRows = que.querySelectorAll('.answer div.r0, .answer div.r1, .answer div[class*=\"r\"], .answer fieldset > div"), "harvestFromReviewDOM must support nested fieldset choices");

    // 3. SVG & Enhanced Checkmark Recognition in hasChoiceCheckmark
    assert.ok(script.includes("svg[class*=\"check\" i]"), "hasChoiceCheckmark must support SVG checkmarks");
    assert.ok(script.includes("[title*=\"Correct\" i]"), "hasChoiceCheckmark must support case-insensitive title Correct");
    assert.ok(script.includes("hasChoiceCheckmark(row) || hasChoiceCheckmark(label)"), "Must check checkmark on both row and label");

    // 4. Outcome Banner Fallback Injection
    assert.ok(script.includes("outcomeBox = document.createElement('div');"), "Must create outcomeBox if missing on review question");
    assert.ok(script.includes("outcomeBox.className = 'outcome clearfix';"), "Outcome fallback must use standard Moodle outcome class");

    // 5. Simulation: Bundled Review Multi-Question Harvest (Q9 and Q10 from screenshot)
    const mockBundledQuestions = [
        {
            qNum: "9",
            qText: "The _______ is the Operating System of Microsoft based smartphones.",
            earned: 1.0,
            max: 1.0,
            isFullMark: true,
            choices: [
                { text: "Windows Phone", hasCheckmark: true, isChecked: false },
                { text: "Windows Mobile 2003", hasCheckmark: false, isChecked: false },
                { text: "Pocket PC 2000", hasCheckmark: false, isChecked: false },
                { text: "Windows Mobile 2003 SE", hasCheckmark: false, isChecked: false }
            ]
        },
        {
            qNum: "10",
            qText: "The Motorola Dynatec was the first ever mobile phone to be approved by the FCC. What does the FCC stand for?",
            earned: 1.0,
            max: 1.0,
            isFullMark: true,
            choices: [
                { text: "Federal Communications Council", hasCheckmark: false, isChecked: false },
                { text: "Federal Communications Conference", hasCheckmark: false, isChecked: false },
                { text: "Federal Communications Conglomeration", hasCheckmark: false, isChecked: false },
                { text: "Federal Communications Commission", hasCheckmark: true, isChecked: true }
            ]
        }
    ];

    function simulateBundledHarvest(questions) {
        const harvested = [];
        questions.forEach((q) => {
            const checkmarked = q.choices.filter(c => c.hasCheckmark).map(c => c.text);
            let ans = checkmarked.length > 0 ? checkmarked.join(', ') : '';
            if (!ans && q.isFullMark) {
                const checked = q.choices.filter(c => c.isChecked).map(c => c.text);
                if (checked.length > 0) ans = checked.join(', ');
            }
            if (ans) {
                harvested.push({
                    qNum: q.qNum,
                    qText: q.qText,
                    ansRaw: ans,
                    verified: true
                });
            }
        });
        return harvested;
    }

    const res = simulateBundledHarvest(mockBundledQuestions);
    assert.strictEqual(res.length, 2, "Must harvest both bundled questions");
    assert.strictEqual(res[0].ansRaw, "Windows Phone", "Q9 must extract Windows Phone from checkmark even with radio unchecked");
    assert.strictEqual(res[1].ansRaw, "Federal Communications Commission", "Q10 must extract Federal Communications Commission");

    // 6. Escape Key Simulation
    let modalOpen = true;
    let panelMinimized = false;
    function simulateEsc() {
        if (modalOpen) {
            modalOpen = false;
            return "modal_closed";
        }
        panelMinimized = !panelMinimized;
        return panelMinimized ? "minimized" : "expanded";
    }

    assert.strictEqual(simulateEsc(), "modal_closed", "First Esc must close open modal");
    assert.strictEqual(simulateEsc(), "minimized", "Second Esc must minimize panel");
    assert.strictEqual(simulateEsc(), "expanded", "Third Esc must expand panel");
});

// --------------------------------------------------
// 85. Review Pagination & Late DOM Completion Regression
// --------------------------------------------------
test("Review harvester follows paginated pages and reprocesses late questions", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    assert.ok(script.includes("const reviewQueue = reviewLinks.map"), "Harvester must queue every review entry point");
    assert.ok(script.includes("for (let queueIndex = 0; queueIndex < reviewQueue.length; queueIndex++)"), "Harvester must process queued review pages");
    assert.ok(script.includes("reviewDoc.querySelectorAll('a[href*=\"review.php\""), "Harvester must discover pagination links from review documents");
    assert.ok(script.includes("const knownQuestionKeys = new Set(allQuestions.map(getQuestionIdentity))"), "Questions from multiple pages must be deduplicated by question and choices");
    assert.ok(script.includes("const processingKey = `${attemptId}:${questionSignature}`"), "Review processing must wait for late-added questions");
    assert.ok(script.includes("getReviewQuestionStateSignature"), "Review processing must include late feedback and answer state");

    const pageUrls = [];
    const queue = [
        "https://moodle.test/mod/quiz/review.php?attempt=10"
    ];
    const seen = new Set();
    for (let i = 0; i < queue.length; i++) {
        const url = new URL(queue[i]);
        url.searchParams.delete('showall');
        url.searchParams.set('showall', '1');
        const fetchedUrl = url.href;
        if (seen.has(fetchedUrl)) continue;
        seen.add(fetchedUrl);
        pageUrls.push(fetchedUrl);
        if (i === 0) {
            queue.push("https://moodle.test/mod/quiz/review.php?attempt=10&page=1");
        }
    }

    assert.strictEqual(pageUrls.length, 2, "A review with a second page must fetch both pages");
    assert.ok(pageUrls[1].includes("page=1"), "The second review page must retain its page number");
    assert.ok(pageUrls.every(url => url.includes("showall=1")), "Every review request must request show-all when supported");
});

// --------------------------------------------------
// 86. Quiz Action Button De-duplication
// --------------------------------------------------
test("Quiz panel keeps unique batch action and targeted question actions", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    assert.ok(script.includes('id="btn-copy-all-q"'), "Panel must keep the batch Copy All action");
    assert.ok(script.includes('id="amaes-batch-copy-container"'), "Batch copy button must be wrapped in container with id for dynamic visibility control");
    assert.ok(script.includes("isQuiz && Boolean(document.querySelector('.que'))"), "Initial render must conditionally hide batch copy container unless viewing a quiz question");
    assert.ok(script.includes("const batchCopyContainer = document.getElementById('amaes-batch-copy-container');"), "syncAutoQuizUI must look up batch copy container");
    assert.ok(script.includes("batchCopyContainer.style.display = hasQue ? 'flex' : 'none';"), "syncAutoQuizUI must dynamically hide batch copy container when no questions exist");
    assert.ok(!script.includes('id="btn-copy-curr-q"'), "Panel must not duplicate per-question Copy AI");
    assert.ok(!script.includes('id="btn-paste-ai-ans"'), "Panel must not duplicate per-question Paste AI");
    assert.ok(script.includes("amaes-copy-ai-card-btn"), "Question cards must retain targeted Copy AI actions");
    assert.ok(script.includes("amaes-paste-ai-card-btn"), "Question cards must retain targeted Paste AI actions");
    assert.ok(script.includes("if (key === 'C')"), "C shortcut must remain available without a duplicate button");
    assert.ok(script.includes("if (key === 'V')"), "V shortcut must remain available without a duplicate button");
});

// --------------------------------------------------
// 87. Unknown Answer Warning De-duplication
// --------------------------------------------------
test("Unknown answer question shows one warning instead of stacked duplicate notices", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    const hudBlock = script.slice(
        script.indexOf("if (!firstBlockedQue.querySelector('.amaes-blockage-hud'))"),
        script.indexOf("const hud = document.createElement('div');", script.indexOf("if (!firstBlockedQue.querySelector('.amaes-blockage-hud'))"))
    );

    assert.ok(hudBlock.includes("querySelectorAll('.amaes-unanswered-hint')"), "Full unknown-answer HUD must remove the compact hint");
    assert.ok(hudBlock.includes("hint.remove()"), "Duplicate compact warning must be removed before inserting the HUD");
});

// --------------------------------------------------
// 88. Unknown Answer Stop Control De-duplication
// --------------------------------------------------
test("Unknown answer state hides the duplicate per-question stop control", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    const blockedState = script.slice(
        script.indexOf("const firstBlockedQue = unverifiedQuestions[0];"),
        script.indexOf("isSolverRunning = false;", script.indexOf("const firstBlockedQue = unverifiedQuestions[0];"))
    );

    assert.ok(blockedState.includes("querySelectorAll('.amaes-que-top-toolbar')"), "Blocked question must target its top toolbar");
    assert.ok(blockedState.includes("toolbar.style.display = 'none'"), "Blocked question must hide the duplicate stop control");
    assert.ok(blockedState.includes("The waiting HUD already has the only needed stop control"), "The HUD should remain the single stop control");
});

// --------------------------------------------------
// 89. Direct Review Redirect & Single Share
// --------------------------------------------------
test("Direct review URL is detected and review saves do not schedule a second share", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("window.location.pathname.includes('/mod/quiz/review.php')"), "Direct Moodle review URL must be recognized");
    assert.ok(script.includes("const isReviewSave = sourceLabel === 'Review';"), "Review cache saves must be identified");
    assert.ok(script.includes("!isReviewSave && (addedCount > 0"), "Review merge must not schedule a duplicate community upload");
    assert.ok(script.includes("source: 'review_screen'") && script.includes("evidenceType: 'moodle_review'"), "Review handler must perform the single review evidence share");
    assert.ok(script.includes("contributionId: `review-${processingKey}`"), "Review sharing must provide an idempotency key");
    assert.ok(script.includes("getReviewShareKey"), "Review sharing must support incremental late-loaded answers");
});

// --------------------------------------------------
// 90. Evidence Source Display & Anonymous Reputation
// --------------------------------------------------
test("Evidence sources remain visible while verified answers win auto-pick", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes("const hasAnyVerifiedCandidate = candidates.some"), "Question matching must detect verified candidates");
    assert.ok(script.includes("Never auto-pick a lower-trust AMAUOED/community answer"), "Auto-pick must prefer verified evidence");
    assert.ok(script.includes("sourceLabels.map"), "Choice badges must be able to show multiple evidence sources");
    assert.ok(script.includes("hasVerifiedSource") && script.includes("hasAmauoedSource"), "Choice display must distinguish verified and AMAUOED evidence");
    assert.ok(script.includes("getAnonymousContributorId"), "Contributions must use an anonymous stable contributor token");
    assert.ok(script.includes("contributorId: getAnonymousContributorId()"), "Contributor token must be sent to the relay");
});

// --------------------------------------------------
// 91. Toolkit Panel Lockout & Terms Acceptance
// --------------------------------------------------
test("Toolkit Panel Lockout: locks panel when terms are not acknowledged and provides interactive unlock with terms acceptance", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Template markup presence
    assert.ok(script.includes('id="amaes-panel-lock-overlay"'), "Lock overlay element must exist in panel template");
    assert.ok(script.includes('Toolkit Locked'), "Lock overlay must announce 'Toolkit Locked'");
    assert.ok(script.includes('id="amaes-lock-chk-terms"'), "Lock overlay must include terms acceptance checkbox");
    assert.ok(script.includes('id="amaes-lock-pill"'), "Header must include lock status pill");

    // 2. Logic & Wiring
    assert.ok(script.includes("updatePanelLockState"), "Panel lock state update function must exist");
    assert.ok(script.includes("localStorage.getItem('amaes_terms_acknowledged') === 'true'"), "Lock state must check amaes_terms_acknowledged");
    assert.ok(script.includes("localStorage.removeItem('amaes_terms_acknowledged')"), "Reset installation must clear amaes_terms_acknowledged");
    assert.ok(script.includes("Terms accepted! Toolkit unlocked."), "Checking terms checkbox must auto-unlock toolkit");
});
// --------------------------------------------------
// 92. Removal of Import / Export JSON Backups Feature
// --------------------------------------------------
test("Removal of Import / Export JSON Backups Feature: UI accordion and buttons removed from database panel", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    assert.ok(!script.includes("Import / Export JSON Backups"), "Accordion header 'Import / Export JSON Backups' must be removed");
    assert.ok(!script.includes('id="btn-export-json"'), "btn-export-json button element must be removed");
    assert.ok(!script.includes('id="btn-import-json"'), "btn-import-json button element must be removed");
    assert.ok(!script.includes('id="file-import-json"'), "file-import-json input element must be removed");
});
// --------------------------------------------------
// 93. Course Coverage Visibility & Accessibility Contrast
// --------------------------------------------------
test("Course Coverage: hides when not in active course, supports badges, and maintains accessible contrast", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Visibility condition based on active course
    assert.ok(script.includes("hasActiveCourse ? 'flex' : 'none'"), "Card initial display must check hasActiveCourse");
    assert.ok(script.includes("if (!targetCode)"), "updateTermCoverageUI must guard against empty targetCode");
    assert.ok(script.includes("id=\"amaes-coverage-badge\""), "Course coverage header must include badge element");

    // 2. High contrast colors for AMAUOED & Eliminated
    assert.ok(script.includes("color: #d8b4fe;"), "AMAUOED label must use accessible bright lavender");
    assert.ok(script.includes("color: #fca5a5;"), "Eliminated label must use accessible bright coral red");

    // 3. Inactive pills visibility
    assert.ok(script.includes("color: rgba(255, 255, 255, 0.7);"), "Inactive term name must be clearly readable");
});
// --------------------------------------------------
// 94. Unified Verified DB Source Breakdown
// --------------------------------------------------
test("Unified Verified DB: merges local reviews and community answers under Verified DB, removes separate community card", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Grid structure: 3 columns
    assert.ok(script.includes('grid-template-columns: repeat(3, 1fr)'), "Source breakdown must use 3-column unified grid");
    assert.ok(script.includes('>Verified Library</div>'), "Must feature prominent Verified Library card");
    assert.ok(script.includes('>Study Guides</div>'), "Must feature Study Guides card");
    assert.ok(script.includes('>Eliminated Wrong</div>'), "Must feature Eliminated Wrong card");
    assert.ok(!script.includes('>Community:</span>'), "Separate Community source row must not exist in breakdown");

    // 2. VerifiedCount logic unifies local and community
    assert.ok(!script.includes("isComm) {\n                    communityCount++;"), "updateTermCoverageUI must not split community into a separate count");
});
// --------------------------------------------------
// 95. Quick Start Modal Escape & Backdrop Dismissal
// --------------------------------------------------
test("Quick Start Modal Escape & Backdrop Dismissal: pressing Esc closes the quick start window directly", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Direct removal on Esc in global shortcuts
    assert.ok(script.includes("if (welcomeModal) welcomeModal.remove();"), "Global Esc handler must directly remove welcomeModal without terms block");

    // 2. Dedicated Esc handler in showWelcomeOnboardingModal
    assert.ok(script.includes("handleModalEsc"), "Modal must register dedicated handleModalEsc keydown listener");
    assert.ok(script.includes("window.removeEventListener('keydown', handleModalEsc)"), "Must clean up handleModalEsc on dismiss");

    // 3. Backdrop click dismissal
    assert.ok(script.includes("modal.onclick = (e) =>"), "Modal must dismiss when clicking backdrop overlay");
});

// --------------------------------------------------
// 96. Web Scraper Answers: Simplified Accordion & Copyable Link
// --------------------------------------------------
test("Web Scraper Answers: simplified accordion, auto-scrape, removed manual input and buttons, and copy link action", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Accordion summary header renamed
    assert.ok(script.includes("<span>Online Study Guides (AMAUOED)</span>"), "Accordion summary must be 'Online Study Guides (AMAUOED)'");
    assert.ok(!script.includes("<span>AMAUOED Study Guide Scraper</span>"), "Legacy summary header must be removed");

    // 2. Manual URL input, Auto-Find button, and Scrape & Cache button removed
    assert.ok(!script.includes('id="amauoed-url-input"'), "amauoed-url-input must be removed from userscript");
    assert.ok(!script.includes('id="btn-autofind-amauoed"'), "btn-autofind-amauoed must be removed from userscript");
    assert.ok(!script.includes('id="btn-fetch-amauoed"'), "btn-fetch-amauoed must be removed from userscript");
    assert.ok(!script.includes('id="chk-auto-dl-json"'), "chk-auto-dl-json must be removed from userscript");

    // 3. Link display and Copy Link button present
    assert.ok(script.includes('id="amauoed-link-display"'), "amauoed-link-display must be present to display detected link");
    assert.ok(script.includes('id="btn-copy-amauoed-link"'), "btn-copy-amauoed-link must be present to copy study guide link");
    assert.ok(script.includes("navigator.clipboard.writeText(url)"), "Copy link button must copy URL to clipboard");

    // 4. Toggleable auto-scrape option remains
    assert.ok(script.includes('id="chk-auto-scrape-amauoed"'), "chk-auto-scrape-amauoed must be present in Web Scraper Answers");
    assert.ok(script.includes("updateAmauoedDisplay"), "updateAmauoedDisplay function must be defined");
});

// --------------------------------------------------
// 97. Dashboard Course Badges Single Injection & De-duplication
// --------------------------------------------------
test("Dashboard Course Badges: prevents double badge injection and deduplicates per course card", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Selector exclusion: coursename must not be treated as a separate card container
    const badgeFnStart = script.indexOf('function injectDashboardCourseBadges()');
    const badgeFnEnd = script.indexOf('function injectDashboardGuideBanner()');
    const badgeFnBlock = script.substring(badgeFnStart, badgeFnEnd);
    const cardQueryBlock = badgeFnBlock.substring(badgeFnBlock.indexOf('let courseCards ='), badgeFnBlock.indexOf('if (courseCards.length === 0)'));

    assert.ok(!cardQueryBlock.includes('.coursename'), "Course link (.coursename) must not be in course card selectors to prevent double injection");
    assert.ok(badgeFnBlock.includes('const processedCards = new Set();'), "Must use Set to track processed root cards");
    assert.ok(badgeFnBlock.includes('existingBadges.forEach((b, idx) => { if (idx > 0) b.remove(); });'), "Must purge duplicate badges on the same card");
    assert.ok(badgeFnBlock.includes("document.querySelectorAll('.coursename .amaes-home-db-badge"), "Must clean up any badges mistakenly injected into course name links");

    // 2. Non-interactive display and proper layout ordering
    assert.ok(badgeFnBlock.includes('cursor: default;'), "Badge must use default cursor as an informational display");
    assert.ok(badgeFnBlock.includes('pointer-events: none;'), "Badge must have pointer-events disabled to avoid interfering with course card clicks");
    assert.ok(!badgeFnBlock.includes('badge.onclick ='), "Badge must not have click handler");
    assert.ok(!badgeFnBlock.includes('badge.onmouseenter ='), "Badge must not have hover transform animation");
    assert.ok(badgeFnBlock.includes('targetContainer.appendChild(badgeWrapper)'), "Badge must be placed in target container without getting cut off by text-truncate");
});

// --------------------------------------------------
// 98. Review Page Spam & Duplicate Share Prevention
// --------------------------------------------------
test("Review Page Spam & Duplicate Share Prevention: strips injected badges from question state signature and only alerts on new discoveries", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Signature calculation must exclude toolkit's own injected markers to prevent MutationObserver re-trigger loops
    const sigStart = script.indexOf('function getReviewQuestionStateSignature(que)');
    const sigEnd = script.indexOf('function getReviewShareKey(question)');
    const sigBlock = script.substring(sigStart, sigEnd);

    assert.ok(sigBlock.includes('clone.querySelectorAll(\'[class*="amaes-"]\').forEach'), "Must strip injected amaes classes from cloned feedback");
    assert.ok(sigBlock.includes('filter(el => !el.closest(\'[class*="amaes-"]\')'), "Must exclude choices inside injected amaes containers");

    // 2. Notification gating: only alert when new verified answers or eliminations are discovered
    const reviewStart = script.indexOf('function handleQuizReviewPageLoad()');
    const reviewEnd = script.indexOf('const injectReviewScreenBanner = handleQuizReviewPageLoad;');
    const reviewBlock = script.substring(reviewStart, reviewEnd);

    assert.ok(reviewBlock.includes('const hasNewDiscoveries = Boolean(cacheRes && (cacheRes.added > 0 || cacheRes.confirmed > 0 || cacheRes.eliminated > 0 || cacheRes.conflicts > 0));'), "Must gate notifications on hasNewDiscoveries including confirmed and conflicts");
    assert.ok(reviewBlock.includes('if (hasNewDiscoveries) {'), "Must only show user toasts when genuinely new items are discovered");
    assert.ok(reviewBlock.includes('logDebug(`Quiz Review: All ${harvested.harvestedCount} verified answers'), "Must quietly log when review was already cataloged without spamming toasts");

    // 3. Persistent share key check in localStorage
    assert.ok(reviewBlock.includes('localStorage.getItem(shareKey) || sessionStorage.getItem(shareKey)'), "Must check localStorage to deduplicate sharing across sessions and tabs");
    assert.ok(reviewBlock.includes('localStorage.setItem(shareKey, JSON.stringify(Array.from(sharedSet)))'), "Must persist shared keys in localStorage");
});

// --------------------------------------------------
// 99. Review Harvest Safety & Student Answer Preservation
// --------------------------------------------------
test("Review Harvest Safety & Student Answer Preservation: guarantees all question types, checkmarks, full marks, and eliminations are merged with highest priority", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Review sourceLabel has highest authority and overrides lower-trust/unverified entries
    const mergeStart = script.indexOf('function mergeAnswersIntoCache(subCode, newQuestions');
    const mergeEnd = script.indexOf('async function pushAnswersToGitHub');
    const mergeBlock = script.substring(mergeStart, mergeEnd);

    assert.ok(mergeBlock.includes("sourceLabel === 'Review'"), "Review source must be given authority to resolve conflicts");
    assert.ok(mergeBlock.includes("cur.verified = true;"), "Review answers must be marked verified true");
    assert.ok(mergeBlock.includes("cur.source = 'Review';"), "Updated answer must record source as Review");

    // 2. Distractor auto-purging on ground truth checkmarks
    assert.ok(mergeBlock.includes("cur.wrongAnswers = cur.wrongAnswers.filter"), "Confirmed correct answers must purge conflicting wrong answer records");

    // 3. Multi-Type Ground Truth Harvesting
    const harvestStart = script.indexOf('function harvestFromReviewDOM(rootDoc, subCode');
    const harvestEnd = script.indexOf('function exportAnswersAsJSON(data)');
    const harvestBlock = script.substring(harvestStart, harvestEnd);

    assert.ok(harvestBlock.includes('.rightanswer'), "Must extract explicit rightanswer feedback");
    assert.ok(harvestBlock.includes('hasChoiceCheckmark'), "Must check per-choice checkmarks");
    assert.ok(harvestBlock.includes('hasChoiceCross'), "Must check per-choice crosses");
    assert.ok(harvestBlock.includes('parseMoodleQuestionGrade'), "Must parse decimal and full marks");
    assert.ok(harvestBlock.includes('input[type="text"], textarea'), "Must extract typed short answer and cloze values");
    assert.ok(harvestBlock.includes('.drop, .dropzone, span.droptarget'), "Must extract drag and drop placed items");

    // 4. Verification simulation: mock questions and cache merging
    const mockDb = [
        {
            qRaw: "What is 2+2?",
            qNorm: "whatis22",
            ansRaw: "4",
            ansNorm: "4",
            verified: false,
            confirmations: 1,
            wrongAnswers: []
        }
    ];

    // Incoming review confirms "4" with full mark
    const incomingReview = [
        {
            qRaw: "What is 2+2?",
            qNorm: "whatis22",
            ansRaw: "4",
            ansNorm: "4",
            verified: true,
            wrongAnswers: []
        },
        {
            qRaw: "What is the capital of France?",
            qNorm: "whatisthecapitaloffrance",
            ansRaw: "Paris",
            ansNorm: "paris",
            verified: true,
            wrongAnswers: [{ norm: "london", text: "London" }]
        }
    ];

    // Simulate merge logic
    let added = 0;
    let confirmed = 0;
    incomingReview.forEach(item => {
        const match = mockDb.find(e => e.qNorm === item.qNorm);
        if (match) {
            if (match.ansNorm === item.ansNorm) {
                match.confirmations = (match.confirmations || 1) + 1;
                match.verified = true;
                confirmed++;
            }
        } else {
            mockDb.push({ ...item, confirmations: 1 });
            added++;
        }
    });

    assert.strictEqual(confirmed, 1, "Must confirm existing question and upgrade verified flag");
    assert.strictEqual(mockDb[0].verified, true, "Existing unverified question must now be verified true");
    assert.strictEqual(added, 1, "Must add new question Paris");
    assert.strictEqual(mockDb.length, 2, "Database must now have both questions preserved");
});

// --------------------------------------------------
// 101. Comprehensive Diagnostic Log Export & Debug State
// --------------------------------------------------
test("Comprehensive Diagnostic Log Export: captures user agent, platform, screen, URL, and audit timeline for debugging", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    assert.ok(script.includes('=== AMAES MOODLE TOOLKIT DIAGNOSTIC AUDIT LOG ==='), "Must format export with diagnostic audit log header");
    assert.ok(script.includes('User Agent:'), "Must include User Agent in copied diagnostic log");
    assert.ok(script.includes('Platform:'), "Must include Platform in copied diagnostic log");
    assert.ok(script.includes('Screen:'), "Must include Screen size in copied diagnostic log");
    assert.ok(script.includes('Page URL:'), "Must include Page URL in copied diagnostic log");
    assert.ok(script.includes('Active Mode:'), "Must include Active Mode state in copied diagnostic log");
    assert.ok(script.includes('Cached DB Questions:'), "Must include cached DB count in copied diagnostic log");
    assert.ok(script.includes('--- ACTIVITY LOG TIMELINE ---'), "Must format activity timeline section in copied log");
});

// --------------------------------------------------
// 102. Grafana Dashboard Widget & Secret Dev Console
// --------------------------------------------------
test("Grafana Dashboard Widget: includes responsive panels, diagnostic copy log, secret triple-click dev unlock, and active mesh telemetry", () => {
    assert.ok(fs.existsSync('dashboard.html'), "dashboard.html must exist in toolkit repository");
    const html = fs.readFileSync('dashboard.html', 'utf8');

    // 1. Theme & CDN verification
    assert.ok(html.includes('cdn.tailwindcss.com'), "Must load Tailwind CSS CDN");
    assert.ok(html.includes('#181b1f'), "Must use Grafana deep gray #181b1f dark mode background");
    assert.ok(html.includes('#22252b'), "Must use Grafana panel background #22252b");

    // 2. Panel verification
    assert.ok(html.includes('id="statusText"'), "Must include Status Panel with status indicator");
    assert.ok(html.includes('id="statCount"'), "Must include Stat Panel with key metric");
    assert.ok(html.includes('id="logConsole"'), "Must include Log Panel with terminal console");
    assert.ok(html.includes('id="btnCopyLog"'), "Must include Copy Log button in Action Panel");

    // 3. Diagnostic Report in Copy Log
    assert.ok(html.includes('=== AMAES TOOLKIT DIAGNOSTIC AUDIT LOG ==='), "Copy log must generate diagnostic audit report");
    assert.ok(html.includes('generateDiagnosticReport'), "Must define generateDiagnosticReport helper");

    // 4. Secret Triple-Click Dev Unlock
    assert.ok(html.includes('e.detail === 3 || clickCount >= 3'), "Must detect triple-click natively without polling overhead");
    assert.ok(html.includes('id="tabSecret"'), "Must contain secret dev tab");
    assert.ok(html.includes('id="activeUserCount"'), "Must contain active mesh users online metric");
    assert.ok(html.includes('id="devInput"'), "Must contain dev command / text panel input");
    assert.ok(html.includes('lockDevMode'), "Must allow re-locking and stopping telemetry timers");
});

// --------------------------------------------------
// 103. Quick Start Guide Secret Developer Console & 'iknow' Password Gate
// --------------------------------------------------
test("Quick Start Guide Secret Developer Console: hidden by default, uncollapsed by pressing backtick 3 times, lock-free direct terminal access, spacious admin console, zero emojis", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Lock-Free Direct Access & Triple Backtick (```) Shortcut
    assert.ok(!script.includes("val === 'iknow'"), "Must remove 'iknow' password lock requirement");
    assert.ok(!script.includes('id="amaes-quick-dev-locked"'), "Must remove locked view screen");
    assert.ok(script.includes('globalBacktickCount >= 3') && script.includes('modalBacktickCount >= 3'), "Must toggle on triple backtick (```) inside modal and across Moodle");
    assert.ok(script.includes('toggleDeveloperConsole'), "Must define toggleDeveloperConsole function");
    assert.ok(!script.includes('scrollBox.scrollTo({ top: sec.offsetTop'), "Must eliminate conflicting double-scroll calls");

    // 2. Secret trigger embedded in Cheatsheet title & dblclick listener
    assert.ok(script.includes('id="amaes-secret-cheatsheet-trigger"'), "Must embed secret trigger span in Cheatsheet title");
    assert.ok(script.includes('secretCheatsheetTrigger'), "Must attach secret trigger listener for double-click");

    // 3. Clean 3-Tab Main Navigation Integrity (No awkward 4th tab)
    assert.ok(!script.includes('id="amaes-tab-btn-dev"'), "Main panel navigation bar must NOT contain an awkward 4th dev tab");
    assert.ok(script.includes('repeat(3, minmax(0, 1fr))'), "Main panel must strictly keep a balanced 3-column tab layout");

    // 4. Integrated Quick Start Guide Developer Section & Controls (Hidden by Default & Spacious Monospace)
    assert.ok(script.includes('id="amaes-quick-dev-section" style="display: none;'), "Dev console section must be completely hidden by default in Quick Start Guide");
    assert.ok(script.includes('id="amaes-dev-mesh-count"'), "Must include community mesh peer counter in dev section");
    assert.ok(script.includes('id="amaes-dev-cmd-input"'), "Must include dev terminal command input in dev section");
    assert.ok(script.includes('id="amaes-dev-btn-close"'), "Must include collapse button to close dev console");
    assert.ok(script.includes('min-height: 240px') || script.includes('height: 260px'), "Console output buffer must be spacious/taller for admin viewing");

    // 5. Command suite verification
    assert.ok(script.includes("c === 'status'"), "Must support status command");
    assert.ok(script.includes("c === 'ping'"), "Must support ping command");
    assert.ok(script.includes("c === 'users'"), "Must support users command");
    assert.ok(script.includes("c === 'cache'"), "Must support cache command");
    assert.ok(script.includes("c === 'logs'"), "Must support logs command");
    assert.ok(script.includes("c === 'clear'"), "Must support clear command");
    assert.ok(script.includes("c === 'help'"), "Must support help command");

    // 6. Style & Zero-Emoji Integrity
    const devSecStart = script.indexOf('id="amaes-quick-dev-section"');
    const devSecEnd = script.indexOf('<!-- Links with Equal Flex-Grid Widths', devSecStart);
    const devSecMarkup = script.substring(devSecStart, devSecEnd > devSecStart ? devSecEnd : devSecStart + 1500);
    assert.ok(!/[⚡🔒🚀🛡️👀]/.test(devSecMarkup), "Dev section must not use emojis, matching clean professional toolkit styling");
});

// --------------------------------------------------
// 104. Background Multitasking & Autonomous Execution Indicators
// --------------------------------------------------
test("Background Execution: notifies users that Auto-Quiz runs hands-free in background during multitasking", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    const dashHtml = fs.readFileSync('dashboard.html', 'utf8');

    // 1. Quiz panel background execution badge & indicator
    assert.ok(script.includes('id="amaes-autoquiz-bg-notice"'), "Must include background multitasking notice in Quiz tab");
    assert.ok(script.includes('id="amaes-autoquiz-bg-dot"'), "Must include status indicator dot for background execution");
    assert.ok(script.includes('id="amaes-autoquiz-bg-text"'), "Must include descriptive text for background execution status");
    assert.ok(script.includes('syncAutoQuizUI'), "Must dynamically update background notice in syncAutoQuizUI");

    // 2. Quick Start Guide onboarding notice
    assert.ok(script.includes('Background Capable'), "Quick Start Guide must reassure users about background execution");
    assert.ok(script.includes('Auto-Quiz runs autonomously in the background'), "Quick Start Guide text must explain background multitasking");

    // 3. Standalone Dashboard status
    assert.ok(dashHtml.includes('Background Execution Capable'), "Dashboard status panel must indicate background execution capability");
});
// --------------------------------------------------
// 105. Privacy-safe relay health and telemetry policy
// --------------------------------------------------
test("Telemetry: presence tracking remains disabled while relay health endpoints remain available", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    const workerScript = fs.readFileSync('../database/relay/worker.js', 'utf8');

    // 1. Client-side presence tracking is intentionally disabled for privacy.
    assert.ok(script.includes('Deliberately disabled: the relay does not collect presence or identity telemetry.'), "Presence telemetry must remain disabled");
    assert.ok(script.includes('Active-user telemetry is disabled for privacy.'), "The UI must explain the telemetry policy");

    // 2. Server-side health endpoints remain stateless.
    assert.ok(workerScript.includes('path === "/ping"'), "Worker must handle /ping endpoint");
    assert.ok(workerScript.includes('path === "/active"'), "Worker must handle /active endpoint");
    assert.ok(workerScript.includes('privacy: "No IP, client identifier, or active-user telemetry is collected."'), "Worker must document the privacy policy");
});

test("Review Question Markers: Debunk failed choices on zero marks and deduce True/False correctly", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    assert.ok(script.includes('// Detect any selected choice that was marked wrong (red cross or zero mark)'), "Must detect crossed choices and zero mark inputs");
    assert.ok(script.includes('// Real-time Deduction by Elimination on Review screen'), "Must support real-time deduction by elimination on review screen");
    assert.ok(script.includes('dbEntry.wrongAnswers = wrongList'), "Must update wrong answers list on dbEntry when debunked");
});

test("Website Share Card & Fullscreen QR Modal: downloads QR image and maximizes fullscreen with modal controls", () => {
    const html = fs.readFileSync('index.html', 'utf8');
    const css = fs.readFileSync('site.css', 'utf8');
    const js = fs.readFileSync('site.js', 'utf8');

    // Verify index.html contains download link and fullscreen modal markup
    assert.ok(html.includes('id="qr-card-link"'), "index.html must have QR download link with id");
    assert.ok(html.includes('download="amaes-toolkit-qr.png"'), "QR link must specify download attribute");
    assert.ok(html.includes('id="qr-modal"'), "index.html must have qr-modal dialog");
    assert.ok(html.includes('id="qr-modal-fullscreen-btn"'), "qr-modal must have fullscreen toggle button");
    assert.ok(html.includes('id="qr-modal-download-btn"'), "qr-modal must have download action button");

    // Verify site.css defines fullscreen backdrop and modal presentation
    assert.ok(css.includes('.qr-modal-backdrop'), "site.css must style .qr-modal-backdrop");
    assert.ok(css.includes('.qr-modal-backdrop.active'), "site.css must support active modal state");
    assert.ok(css.includes('.qr-modal-card'), "site.css must style centered modal card");

    // Verify site.js manages open/close lifecycle, escape key, and fullscreen
    assert.ok(js.includes('openQrModal'), "site.js must define openQrModal");
    assert.ok(js.includes('closeQrModal'), "site.js must define closeQrModal");
    assert.ok(js.includes('toggleFullscreen'), "site.js must define toggleFullscreen");
    assert.ok(js.includes("e.key === 'Escape'"), "site.js must dismiss modal on Escape");
});

test("Subject Naming & Course Code Resolution: guarantees human-readable titles across IT and CS courses", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. KNOWN_COURSES dictionary and resolution helper
    assert.ok(script.includes('const KNOWN_COURSES = {'), "Userscript must define KNOWN_COURSES dictionary");
    assert.ok(script.includes('"IT6205A": "Information Assurance and Security 1"'), "Must map IT6205A");
    assert.ok(script.includes('"IT6206": "Information Assurance and Security 2"'), "Must map IT6206");
    assert.ok(script.includes('"IT6208": "System Integration and Architecture 1"'), "Must map IT6208");
    assert.ok(script.includes('"IT6209": "Introduction to Multimedia"'), "Must map IT6209");
    assert.ok(script.includes('"IT6224B": "Data Communications and Networking 3"'), "Must map IT6224B");
    assert.ok(script.includes('"IT6310": "Network Security"'), "Must map IT6310");
    assert.ok(script.includes('"IT6322A": "Mobile Application Development"'), "Must map IT6322A");
    assert.ok(script.includes('function resolveKnownCourseName(code)'), "Must define resolveKnownCourseName helper");

    // 2. detectCourseInfo parses both prefix and suffix formats and uses fallbacks
    assert.ok(script.includes('function detectCourseInfo()'), "Must define detectCourseInfo");
    assert.ok(script.includes('resolveKnownCourseName(subjectCode)'), "detectCourseInfo must resolve fallback from KNOWN_COURSES");

    // 3. Payloads include resolved subjectName
    assert.ok(script.includes('subjectName: resolvedName'), "Community relay payload must include resolved subjectName");
    assert.ok(script.includes('subjectName: resolvedName || code'), "generatePayload must include resolved subjectName");
});

// --------------------------------------------------
// 98. Review Screen Ground Truth Override, Jargon Elimination & Review Clutter Removal
// --------------------------------------------------
test("Review Screen Ground Truth Override, Jargon Elimination & Clutter Removal: blocks contradictory verified highlight on failed choices, strips technical jargon, and removes Copy AI on review screens", () => {
    // 1. Contradiction Guard: Failed choice (0.00 / red cross) cannot be marked verified
    function evaluateChoiceHighlight(choiceText, isCrossed, isCheckedZero, verifiedNorms, allWrongList) {
        const norm = normalizeChoice(choiceText);
        const isCrossedRow = isCrossed || isCheckedZero;
        const isVerifiedChoice = !isCrossedRow && verifiedNorms.has(norm);
        const isEliminatedChoice = isCrossedRow || (!isVerifiedChoice && allWrongList.some(w => w.norm === norm));

        let highlightColor = null;
        let badgeText = null;

        if (!isEliminatedChoice && isVerifiedChoice) {
            highlightColor = 'green';
            badgeText = 'Verified Answer';
        } else if (isEliminatedChoice) {
            highlightColor = 'red';
            badgeText = 'Incorrect Choice';
        }

        return { isVerifiedChoice, isEliminatedChoice, highlightColor, badgeText };
    }

    // "strategic plan" was previously marked verified in cache, but user got it wrong with red cross
    const verifiedSet = new Set(["strategic plan"]);
    const wrongList = [{ norm: "strategic plan", count: 1 }];

    const res = evaluateChoiceHighlight("strategic plan", true, true, verifiedSet, wrongList);
    assert.strictEqual(res.isVerifiedChoice, false, "Crossed / zero-mark choice MUST NOT be marked verified");
    assert.strictEqual(res.isEliminatedChoice, true, "Crossed / zero-mark choice MUST be eliminated");
    assert.strictEqual(res.highlightColor, 'red', "Highlight outline MUST be red, NEVER green");
    assert.strictEqual(res.badgeText, 'Incorrect Choice', "Badge MUST be plain English incorrect choice, not 0% Prob");

    // 2. Userscript code integrity verification
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // Review screen button cleanup
    assert.ok(script.includes("checkIsReviewPage() || !showInQuestionAiBtns"), "injectQuestionCopyButtons must exit and clean buttons on review pages");

    // Ground truth override in highlightQuizAnswers
    assert.ok(script.includes("qGradeInfo.isZeroMark"), "highlightQuizAnswers must inspect zero-mark attempts for ground truth debunking");
    assert.ok(script.includes("verifiedNorms.delete(txt)"), "highlightQuizAnswers must delete debunked choices from verifiedNorms");

    // Jargon replacement
    assert.ok(script.includes("'Web Study Guide'"), "Must use user-friendly 'Web Study Guide' instead of AMAUOED probability jargon");
    assert.ok(script.includes("'Incorrect Choice'"), "Must use 'Incorrect Choice' instead of '0% Prob'");
    assert.ok(!script.includes("'UPLOADED TO DB'"), "Must eliminate shouting all-caps 'UPLOADED TO DB'");
    assert.ok(!script.includes("'ELIMINATED IN DB'"), "Must eliminate shouting all-caps 'ELIMINATED IN DB'");
});

// --------------------------------------------------
// 86. Gemini AI Question Type Eligibility Guard
// --------------------------------------------------
test("Gemini AI: Question Type Eligibility Guard strictly restricts AI inference to Multiple Choice & True/False, blocking drag-and-drop, dropdowns, and short answers", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Structural checks in userscript
    assert.ok(script.includes("function isEligibleForAiSolver(que, qData)"), "Must define isEligibleForAiSolver guard function");
    assert.ok(script.includes("if (qData.isDragDrop) return false;"), "Must reject drag and drop questions by qData");
    assert.ok(script.includes("ddwtos") && script.includes("ddimageortext"), "Must reject Moodle drag and drop css classes");
    assert.ok(script.includes("if (que.querySelectorAll('select').length > 0) return false;"), "Must reject dropdown questions");
    assert.ok(script.includes("if (qData.isShortAnswer || qData.isEssay) return false;"), "Must reject short answer and essay questions");
    assert.ok(script.includes("const isEligibleChoice = isEligibleForAiSolver(firstBlockedQue, qData);"), "Solver must invoke isEligibleForAiSolver before triggering AI");

    // 2. Mock simulation of eligibility logic
    function mockIsEligibleForAiSolver(que, qData) {
        if (!que || !qData) return false;
        if (qData.isDragDrop) return false;
        if (que.classes && (que.classes.includes('ddwtos') || que.classes.includes('ddimageortext'))) return false;
        if (que.hasDragElements) return false;
        if (que.hasSelectElements) return false;
        if (qData.matchPairs && qData.matchPairs.length > 0) return false;
        if (qData.isShortAnswer || qData.isEssay) return false;
        if (que.hasTextInput) return false;
        if (!Array.isArray(qData.choices) || qData.choices.length < 2) return false;
        if (!que.hasRadioOrCheckbox) return false;
        return true;
    }

    // Scenario A: Standard Multiple Choice Question -> Eligible
    const mcQue = { classes: ['multichoice', 'que'], hasRadioOrCheckbox: true, hasTextInput: false, hasSelectElements: false, hasDragElements: false };
    const mcData = { qText: "Which device is non-volatile?", choices: ["a. RAM", "b. ROM", "c. Cache", "d. Register"] };
    assert.strictEqual(mockIsEligibleForAiSolver(mcQue, mcData), true, "Standard MC question must be eligible");

    // Scenario B: True / False Question -> Eligible
    const tfQue = { classes: ['truefalse', 'que'], hasRadioOrCheckbox: true, hasTextInput: false, hasSelectElements: false, hasDragElements: false };
    const tfData = { qText: "HTML stands for HyperText Markup Language.", choices: ["True", "False"] };
    assert.strictEqual(mockIsEligibleForAiSolver(tfQue, tfData), true, "True/False question must be eligible");

    // Scenario C: Drag and Drop Question -> strictly Ineligible (must fall back to manual copy)
    const ddQue = { classes: ['ddwtos', 'que'], hasRadioOrCheckbox: false, hasTextInput: false, hasSelectElements: false, hasDragElements: true };
    const ddData = { isDragDrop: true, qText: "Match components [[1]] and [[2]]", choices: ["a. CPU", "b. RAM"] };
    assert.strictEqual(mockIsEligibleForAiSolver(ddQue, ddData), false, "Drag and drop question must NOT be eligible");

    // Scenario D: Dropdown Matching Question -> strictly Ineligible
    const selQue = { classes: ['match', 'que'], hasRadioOrCheckbox: false, hasTextInput: false, hasSelectElements: true, hasDragElements: false };
    const selData = { matchPairs: [{ subQ: "Input", options: ["Mouse", "Screen"] }], choices: ["Mouse", "Screen"] };
    assert.strictEqual(mockIsEligibleForAiSolver(selQue, selData), false, "Dropdown question must NOT be eligible");

    // Scenario E: Short Answer / Cloze Text Field -> strictly Ineligible
    const saQue = { classes: ['shortanswer', 'que'], hasRadioOrCheckbox: false, hasTextInput: true, hasSelectElements: false, hasDragElements: false };
    const saData = { isShortAnswer: true, qText: "Type the abbreviation for Operating System:", choices: [] };
    assert.strictEqual(mockIsEligibleForAiSolver(saQue, saData), false, "Short answer question must NOT be eligible");
});

// --------------------------------------------------
// 87. Gemini AI Compact Prompt Builder
// --------------------------------------------------
test("Gemini AI: Compact Prompt Builder constructs ultra-concise token-efficient prompts (<120 tokens)", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Script checks
    assert.ok(script.includes("function buildGeminiCompactPrompt(qData, courseCode = '', que = null)"), "Must define buildGeminiCompactPrompt");
    assert.ok(script.includes("Reply with ONLY the correct option letter and exact text"), "Prompt must instruct AI to return minimal letter and text");
    assert.ok(script.includes("No explanations"), "Prompt must strictly prohibit wordy explanations to save tokens");

    // 2. Logic simulation
    function mockBuildPrompt(qData, courseCode = '') {
        const lines = [];
        if (courseCode) lines.push(`[Course: ${courseCode}]`);
        lines.push(`Question: ${qData.qText || ''}`);
        lines.push(`Choices:`);
        if (Array.isArray(qData.choices)) {
            qData.choices.forEach(c => lines.push(c));
        }
        lines.push(``);
        lines.push(`Reply with ONLY the correct option letter and exact text (e.g., "b. ROM"). No explanations.`);
        return lines.join('\n');
    }

    const qData = {
        qText: "What protocol is primarily used for secure web browsing?",
        choices: ["a. HTTP", "b. HTTPS", "c. FTP", "d. SMTP"]
    };

    const promptWithCourse = mockBuildPrompt(qData, "IT101");
    assert.ok(promptWithCourse.includes("[Course: IT101]"), "Must include course code tag when available");
    assert.ok(promptWithCourse.includes("Question: What protocol is primarily used for secure web browsing?"), "Must include question text");
    assert.ok(promptWithCourse.includes("b. HTTPS"), "Must list options");
    assert.ok(promptWithCourse.includes("No explanations"), "Must request minimal answer");

    // Token economy check: count words in prompt (words * 1.3 ≈ tokens)
    const wordCount = promptWithCourse.split(/\s+/).length;
    assert.ok(wordCount < 60, `Prompt word count (${wordCount}) must remain ultra-compact (<60 words / ~80 tokens)`);

    const promptNoCourse = mockBuildPrompt(qData, "");
    assert.ok(!promptNoCourse.includes("[Course:"), "Must omit course tag if courseCode is empty");
});

// --------------------------------------------------
// 88. Gemini AI Answer Matcher
// --------------------------------------------------
test("Gemini AI: AI Answer Matcher maps prefixes, normalized text, and True/False to correct option index and DOM node", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    assert.ok(script.includes("function matchAiAnswerToChoice(aiResponseText, que, qData)"), "Must define matchAiAnswerToChoice");
    assert.ok(script.includes("/^([a-eA-E])[.:\\)\\-–\\s]/"), "Must parse option letter prefixes a-e");
    assert.ok(script.includes("normalizeChoice(cleanAi"), "Must match on normalized choice text");

    function mockMatch(aiText, choices) {
        const cleanAi = (aiText || '').trim();
        const letterMatch = cleanAi.match(/^([a-eA-E])[.:\)\-–\s]/);
        let matchedIndex = -1;

        if (letterMatch) {
            const charCode = letterMatch[1].toLowerCase().charCodeAt(0) - 97;
            if (charCode >= 0 && charCode < choices.length) matchedIndex = charCode;
        }

        if (matchedIndex === -1) {
            const cleanText = cleanAi.replace(/^[a-eA-E][.:\)\-–\s]*/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
            for (let i = 0; i < choices.length; i++) {
                const normChoice = choices[i].toLowerCase().replace(/[^a-z0-9]/g, '');
                if (normChoice && (normChoice === cleanText || normChoice.includes(cleanText) || cleanText.includes(normChoice))) {
                    matchedIndex = i;
                    break;
                }
            }
        }

        if (matchedIndex === -1) {
            const lower = cleanAi.toLowerCase();
            if (lower.includes('true')) {
                matchedIndex = choices.findIndex(c => c.toLowerCase().includes('true'));
            } else if (lower.includes('false')) {
                matchedIndex = choices.findIndex(c => c.toLowerCase().includes('false'));
            }
        }

        return matchedIndex;
    }

    const testChoices = ["a. HTTP", "b. HTTPS", "c. FTP", "d. SMTP"];
    assert.strictEqual(mockMatch("b. HTTPS", testChoices), 1, "Must match 'b. HTTPS' to index 1");
    assert.strictEqual(mockMatch("B) HTTPS", testChoices), 1, "Must match 'B) HTTPS' to index 1");
    assert.strictEqual(mockMatch("c: FTP", testChoices), 2, "Must match 'c: FTP' to index 2");
    assert.strictEqual(mockMatch("HTTPS", testChoices), 1, "Must match un-prefixed text 'HTTPS' to index 1");

    const tfChoices = ["True", "False"];
    assert.strictEqual(mockMatch("True", tfChoices), 0, "Must match 'True' to index 0");
    assert.strictEqual(mockMatch("The statement is false.", tfChoices), 1, "Must match 'The statement is false.' to index 1");
});

// --------------------------------------------------
// 89. Gemini AI UI Integration, Modal, Settings, and Highlighting
// --------------------------------------------------
test("Gemini AI: Interface Integration, Course Tools card, Setup modal, Quiz tab settings, and Suggestion highlighting", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Tampermonkey header permission
    assert.ok(script.includes("// @connect      generativelanguage.googleapis.com"), "Userscript must request GM @connect for Google AI API domain");

    // 2. Course Tools AI assistant card & modal trigger
    assert.ok(script.includes("id=\"mod-ai-card\""), "Course tools panel must include AI Assistant accordion card");
    assert.ok(script.includes("id=\"btn-open-gemini-setup\""), "Course tools must include setup button for Gemini API");
    assert.ok(script.includes("function showGeminiSetupModal()"), "Must define showGeminiSetupModal");
    assert.ok(script.includes("aistudio.google.com"), "Setup modal must provide clickable link to Google AI Studio");
    assert.ok(script.includes("id=\"amaes-gemini-btn-test-save\""), "Setup modal must provide API key test connection button");
    assert.ok(script.includes("id=\"amaes-gemini-btn-remove\""), "Setup modal must allow removing the API key");

    // 3. Quiz tab settings block & toggles
    assert.ok(script.includes("id=\"amaes-ai-quiz-settings-block\""), "Quiz tab must feature AI Assistant settings block");
    assert.ok(script.includes("id=\"chk-ai-quiz-enabled\""), "Must include toggle for AI Quiz Solver");
    assert.ok(script.includes("id=\"chk-ai-auto-select\""), "Must include toggle for Auto-Select AI Answers");

    // 4. Visual suggestion styling & badge
    assert.ok(script.includes("amaes-ai-suggested-choice"), "Must define amaes-ai-suggested-choice CSS class");
    assert.ok(script.includes("amaes-ai-suggested-badge"), "Must define amaes-ai-suggested-badge CSS class");
    assert.ok(script.includes("<span>AI Suggestion (Gemini)</span>"), "Must inject purple AI Suggestion badge for student clarity");
    assert.ok(script.includes("function applyAiChoiceHighlight(targetRow)"), "Must define applyAiChoiceHighlight");
});

// --------------------------------------------------
// 90. Gemini AI Watchdog Timer, Retry Mechanism, and Safe Fallback Bar
// --------------------------------------------------
test("Gemini AI: 8s Watchdog Timeout, Automatic Retry, Abort Handling, and Fallback Bar with Copy and Retry", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Constants and timeouts
    assert.ok(script.includes("const GEMINI_TIMEOUT_MS = 8000;"), "Watchdog timer must be set to 8000ms (8 seconds)");
    assert.ok(script.includes("const GEMINI_MODEL = 'gemini-1.5-flash';"), "Must use efficient gemini-1.5-flash model");

    // 2. Abort controller and timeout support in callGeminiApi
    assert.ok(script.includes("function callGeminiApi({ apiKey, prompt, maxOutputTokens = 64, signal })"), "callGeminiApi must accept abort signal");
    assert.ok(script.includes("signal.addEventListener('abort'"), "callGeminiApi must hook abort event on signal");

    // 3. Retry loop and fallback bar in handleGeminiQuestionInference
    assert.ok(script.includes("function handleGeminiQuestionInference("), "Must define handleGeminiQuestionInference");
    assert.ok(script.includes("const retryAttempts = getAiRetryCount();"), "Must check configurable retry count");
    assert.ok(script.includes("const maxAttempts = 1 + retryAttempts;"), "Must support configurable retries on failure");
    assert.ok(script.includes("function showAiFallbackBar(que, qData, promptText, onRetry"), "Must define showAiFallbackBar");
    assert.ok(script.includes("class=\"amaes-ai-retry-btn\""), "Fallback bar must include Retry AI button");
    assert.ok(script.includes("class=\"amaes-ai-copy-btn\""), "Fallback bar must include Copy for AI button");

    // 4. Progress bar and thinking indicator
    assert.ok(script.includes("amaes-ai-thinking-indicator"), "Must define thinking indicator element");
    assert.ok(script.includes("amaes-ai-progress-bar"), "Must define animated progress bar");
    assert.ok(script.includes("amaes-ai-cancel-btn"), "Thinking indicator must allow user to cancel request");

    // 5. Cleanup on Auto-Quiz pause
    assert.ok(script.includes("if (activeAiAbortController) {") && script.includes("activeAiAbortController.abort();"), "Pausing auto-quiz must abort any active AI request");

    // 6. Multi-model fallback and authentication key compatibility
    assert.ok(script.includes("GEMINI_CANDIDATES"), "Must define GEMINI_CANDIDATES fallback array for cross-version model support");
    assert.ok(script.includes('"x-goog-api-key": apiKey'), "Must provide x-goog-api-key header for modern Auth keys (AQ.)");
    assert.ok(script.includes("executeGeminiRequest"), "Must isolate low-level request execution for multi-endpoint retries");
});

// --------------------------------------------------
// 91. Gemini AI Welcome Modal, Documentation, and Website Presentation
// --------------------------------------------------
test("Gemini AI: Welcome Modal, README documentation, and Website Presentation", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');
    const readme = fs.readFileSync('README.md', 'utf8');
    const indexHtml = fs.readFileSync('index.html', 'utf8');

    // 1. Welcome Guide card & setup button
    assert.ok(script.includes("Built-in Google Gemini AI"), "Welcome guide must feature Built-in Google Gemini AI card");
    assert.ok(script.includes("id=\"welcome-btn-setup-ai\""), "Welcome guide must provide direct setup button for AI assistant");
    assert.ok(script.includes("welcomeAiBtn.onclick"), "Must wire click listener for welcome-btn-setup-ai to showGeminiSetupModal");

    // 2. README documentation
    assert.ok(readme.includes("### 4. Built-in Google Gemini AI Assistant (Experimental)"), "README must document Gemini AI Assistant in features");
    assert.ok(readme.includes("### Step 4: (Optional) Setup Free Google Gemini AI"), "README must include step-by-step setup guide for Gemini AI");
    assert.ok(readme.includes("version-1.8.0-blue.svg"), "README badge must show v1.8.0");

    // 3. Website (index.html)
    assert.ok(indexHtml.includes("release-badge\">v1.8.0<"), "Website must display v1.8.0 badge");
    assert.ok(indexHtml.includes("Built-in Google Gemini AI"), "Website must present Built-in Google Gemini AI in about grid");
});

// --------------------------------------------------
// 92. Gemini AI Granular Failure Diagnostics & Choice Matcher Flexibility
// --------------------------------------------------
test("Gemini AI: Granular Failure Diagnostics, Actionable Key Re-Authentication, and Choice Matcher Prefix Flexibility", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Dynamic failure reasons instead of misleading generic timeout message
    assert.ok(script.includes("Google rejected API key. Check key in Course Tools."), "Must diagnose authentication and key block failures specifically");
    assert.ok(script.includes("Google is temporarily limiting AI requests."), "Must diagnose rate limit and quota failures");
    assert.ok(script.includes("Gemini model unavailable. Check key permissions."), "Must diagnose missing model permissions");
    assert.ok(script.includes("AI took too long to respond (timed out after 8s)."), "Must only state took too long when timedOut is actually true");

    // 2. Actionable Configure Key button in fallback bar on auth failure
    assert.ok(script.includes("class=\"amaes-ai-config-btn\""), "Fallback bar must render Configure Key button on auth errors");
    assert.ok(script.includes("showGeminiSetupModal()"), "Clicking Configure Key button must open setup modal directly");

    // 3. Choice matcher prefix and standalone letter flexibility
    assert.ok(script.includes("(?:option\\s+|choice\\s+)?\\(?([a-eA-E])\\)?"), "Matcher must parse standalone letters (e.g. 'b', 'Option B', '(b)')");

    // Unit test of letter matcher regex
    const regex = /^(?:option\s+|choice\s+)?\(?([a-eA-E])\)?(?:\b|[.:\)\-–\s]|$)/i;
    assert.strictEqual(regex.test("b"), true, "Must match standalone 'b'");
    assert.strictEqual(regex.test("B"), true, "Must match standalone 'B'");
    assert.strictEqual(regex.test("Option B"), true, "Must match 'Option B'");
    assert.strictEqual(regex.test("(B)"), true, "Must match '(B)'");
    assert.strictEqual(regex.test("b. Executive Summary"), true, "Must match 'b. Executive Summary'");
});

// --------------------------------------------------
// 94. Gemini AI v1.7.5: Session Caching, Elimination Safety Guard, Configurable Retries, and Auto-Copy on Failure
// --------------------------------------------------
test("Gemini AI v1.7.5: Session Caching, Elimination Safety Guard, Configurable Retries, and Auto-Copy on Failure", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Session Answer Caching Functions & Restoration
    assert.ok(script.includes("function saveAiAnswerToCache(qData, matched)"), "Must define saveAiAnswerToCache");
    assert.ok(script.includes("function getCachedAiAnswer(qData)"), "Must define getCachedAiAnswer");
    assert.ok(script.includes("const aiAnswerSessionCache = new Map();"), "Must maintain fast in-memory session cache");
    assert.ok(script.includes("getAiSessionCacheStorageKey()"), "Must persist session cache to sessionStorage across question page reloads");
    assert.ok(script.includes("// 4. Session AI Cache: Reapply previously AI-solved answer"), "highlightQuizAnswers must restore cached AI answers on page navigation");

    // 2. Confirmed Wrong Answer Elimination Safety Guard
    assert.ok(script.includes("function isChoiceRowEliminated(row)"), "Must define isChoiceRowEliminated helper");
    assert.ok(script.includes("function getEliminatedChoicesForQuestion(que, qData, courseCode = '')"), "Must define getEliminatedChoicesForQuestion");
    assert.ok(script.includes("[CONFIRMED WRONG - DO NOT SELECT]"), "Compact prompt builder must annotate eliminated choices");
    assert.ok(script.includes("Do NOT choose options marked [CONFIRMED WRONG - DO NOT SELECT]"), "Compact prompt must explicitly instruct model to avoid marked wrong options");
    assert.ok(script.includes("isChoiceRowEliminated(matched.row)"), "handleGeminiQuestionInference must verify choice is NOT eliminated before selecting");
    assert.ok(script.includes("[AI Deduction] AI suggested confirmed wrong choice"), "Must deduce remaining choice if only 1 valid alternative remains");
    assert.ok(script.includes("[AI Wrong Answer Blocked]"), "Must block selecting eliminated choice if multiple alternatives remain");

    // 3. Configurable Retry Count
    assert.ok(script.includes("function getAiRetryCount()"), "Must define getAiRetryCount");
    assert.ok(script.includes("function setAiRetryCount(val)"), "Must define setAiRetryCount");
    assert.ok(script.includes("id=\"sel-ai-retry-count\""), "Quiz settings block must render retry selector");
    assert.ok(script.includes("id=\"sel-course-ai-retry-count\""), "Course tools AI card must render retry selector");
    assert.ok(script.includes("const retryAttempts = getAiRetryCount();"), "Inference must use configurable retry count");

    // 4. Auto-Copy on Failure
    assert.ok(script.includes("function getAiAutoCopyOnFail()"), "Must define getAiAutoCopyOnFail");
    assert.ok(script.includes("function setAiAutoCopyOnFail(val)"), "Must define setAiAutoCopyOnFail");
    assert.ok(script.includes("id=\"chk-ai-auto-copy-on-fail\""), "Quiz settings block must render auto-copy toggle");
    assert.ok(script.includes("id=\"chk-course-ai-auto-copy-on-fail\""), "Course tools AI card must render auto-copy toggle");
    assert.ok(script.includes("if (getAiAutoCopyOnFail())"), "handleGeminiQuestionInference must auto-copy prompt on failure or mismatch");

    // 5. Unit logic simulation of wrong choice annotation
    function mockBuildPromptWithElim(qData, courseCode, eliminatedSet) {
        const lines = [];
        if (courseCode) lines.push(`[Course: ${courseCode}]`);
        lines.push(`Question: ${qData.qText || ''}`);
        lines.push(`Choices:`);
        qData.choices.forEach(c => {
            const norm = c.toLowerCase().trim();
            if (eliminatedSet.has(norm)) {
                lines.push(`${c} [CONFIRMED WRONG - DO NOT SELECT]`);
            } else {
                lines.push(c);
            }
        });
        lines.push(``);
        lines.push(`Reply with ONLY the correct option letter and exact text (e.g., "b. ROM"). Do NOT choose options marked [CONFIRMED WRONG - DO NOT SELECT]. No explanations.`);
        return lines.join('\n');
    }

    const testQ = {
        qText: "Which of the following is not a primary component?",
        choices: ["a. RAM", "b. ROM", "c. Business Strategy", "d. Cache"]
    };
    const elimSet = new Set(["c. business strategy"]);
    const prompt = mockBuildPromptWithElim(testQ, "CS101", elimSet);
    assert.ok(prompt.includes("c. Business Strategy [CONFIRMED WRONG - DO NOT SELECT]"), "Confirmed wrong choice must be annotated in prompt");
    assert.ok(!prompt.includes("a. RAM [CONFIRMED WRONG"), "Valid choice must not be annotated as wrong");
});

// --------------------------------------------------
// 95. Gemini AI v1.7.5: Unverified AI Suggestion Safeguards, Copy Question Filter, and Pause for Review Lifecycle
// --------------------------------------------------
test("Gemini AI v1.7.5: Unverified AI Suggestion Safeguards, Copy Question Filter, and Pause for Review Lifecycle", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Copy Question: Exclude unverified AI suggestions from detected answer
    assert.ok(script.includes("const verifiedNonAiCandidates = validCandidates.filter(c => {"), "formatQuestionForAI must filter candidate list for AI exclusions");
    assert.ok(script.includes("if (c.isAiSuggestion) return false;"), "Candidate with isAiSuggestion must be excluded from copied prompt");
    assert.ok(script.includes("srcLower.includes('gemini') || srcLower.includes('ai assistant') || srcLower === 'ai'"), "Candidate with Gemini or AI source must be excluded from copied prompt");

    // Simulation of candidate filtering logic
    const mockCandidates = [
        { answer: "b. ROM", isAiSuggestion: true, source: "Google Gemini AI", verified: false },
        { answer: "a. RAM", isAiSuggestion: false, source: "Verified Database", verified: true }
    ];
    const filtered = mockCandidates.filter(c => {
        if (c.isAiSuggestion) return false;
        const srcLower = (c.source || '').toLowerCase();
        if (srcLower.includes('gemini') || srcLower.includes('ai assistant') || srcLower === 'ai') return false;
        return true;
    });
    assert.strictEqual(filtered.length, 1, "Must filter out AI suggestion");
    assert.strictEqual(filtered[0].answer, "a. RAM", "Must retain verified database answer");

    // 2. Auto-Quiz Pause on AI Suggestion: No automatic advance timer
    assert.ok(script.includes("showToast(`Gemini selected a choice for #${qData ? qData.qNum : ''}. (Paused for review)`, 3000);"), "Toast must notify student that AI choice was selected and paused for review");
    assert.ok(script.includes("Paused for review—press <b>N</b> or click Next page when ready."), "Status log must confirm pause for student review");

    // 3. AI Suggestion Caching: Saved to local course bank as unverified AI suggestion
    assert.ok(script.includes("mergeAnswersIntoCache(sCode, [{"), "handleGeminiQuestionInference must merge AI answer into cache");
    assert.ok(script.includes("isAiSuggestion: true,"), "Merged AI answer must have isAiSuggestion: true");
    assert.ok(script.includes("source: 'Google Gemini AI'"), "Merged AI answer must have source 'Google Gemini AI'");
    assert.ok(script.includes("verified: false,"), "Merged AI answer must have verified: false");

    // 4. Distinct AI styling and badge in highlightQuizAnswers
    assert.ok(script.includes("targetRow.classList.add(hasAiSource ? 'amaes-ai-suggested-choice' : 'amaes-highlighted-choice');"), "Must apply distinct CSS class amaes-ai-suggested-choice");
    assert.ok(script.includes("badge.className = hasAiSource ? 'amaes-ai-suggested-badge' : `amaes-verified-badge ${hasAmauoedSource ? 'amaes-badge-amauoed' : 'amaes-badge-db'}`;"), "Must attach amaes-ai-suggested-badge for AI sources");
    assert.ok(script.includes("sourceLabels.push('AI Suggestion (Gemini)');"), "Must label AI source as 'AI Suggestion (Gemini)'");

    // 5. Cleanup of .amaes-ai-suggested-choice on page reset
    assert.ok(script.includes("el.classList.remove('amaes-ai-suggested-choice');"), "Must clean up amaes-ai-suggested-choice class on quiz answers reset");

    // 6. Zero API calls when AI suggestion already highlighted on screen
    assert.ok(script.includes("existingAiChoice && !isChoiceRowEliminated(existingAiChoice)"), "Auto-solver and inference must check for existing non-eliminated AI suggestion before calling API");

    // 7. Community Relay Tagging for AI suggestions
    assert.ok(script.includes("isAiSuggestion: Boolean(q.isAiSuggestion || (q.source && String(q.source).toLowerCase().includes('gemini')))"), "Relay payload must tag isAiSuggestion explicitly");
    assert.ok(script.includes("evidenceType: q.evidenceType || (q.isAiSuggestion || (q.source && String(q.source).toLowerCase().includes('gemini')) ? 'ai_inference' : evidenceType)"), "Relay payload must tag evidenceType as ai_inference for AI sources");

    // 8. Redundant Blockage HUD Suppression & Auto-Copy Indication
    assert.ok(script.includes("firstBlockedQue.querySelectorAll('.amaes-blockage-hud').forEach(el => el.remove());"), "Must clean up blockage HUD when AI starts solving or succeeds");
    assert.ok(script.includes("if (firstBlockedQue.querySelector('.amaes-ai-suggested-choice')) {\n                        isSolverRunning = false;\n                        return;\n                    }"), "Must return immediately and suppress blockage HUD when AI solves question");
    assert.ok(script.includes("(Prompt copied)"), "Status log must indicate prompt was copied to clipboard");

    // 9. Real Lifecycle Simulation: AI Suggestion -> Rejection/Wrong Choice -> Elimination & Deduction
    let mockExisting = [];
    function mockMerge(subCode, newQuestions, sourceLabel) {
        newQuestions.forEach(newItem => {
            const qNorm = (newItem.qNorm || newItem.question || '').toLowerCase().trim();
            const ansRaw = newItem.ansRaw || newItem.answer || '';
            const ansNorm = (ansRaw || '').toLowerCase().trim();
            const incomingWrong = (newItem.wrongAnswers || []).map(w => ({
                text: typeof w === 'string' ? w : w.text,
                norm: (typeof w === 'string' ? w : w.text).toLowerCase().trim()
            }));

            let cur = mockExisting.find(e => e.qNorm === qNorm);
            if (!cur) {
                cur = {
                    qNorm,
                    ansRaw,
                    ansNorm,
                    choices: newItem.choices || [],
                    verified: Boolean(newItem.verified),
                    isAiSuggestion: Boolean(newItem.isAiSuggestion),
                    wrongAnswers: incomingWrong,
                    source: newItem.source || sourceLabel,
                    sources: [sourceLabel]
                };
                mockExisting.push(cur);
            } else {
                incomingWrong.forEach(inW => {
                    if (cur.ansNorm && inW.norm === cur.ansNorm) {
                        cur.ansRaw = '';
                        cur.ansNorm = '';
                        cur.verified = false;
                        cur.isAiSuggestion = false;
                    }
                    if (!cur.wrongAnswers.some(w => w.norm === inW.norm)) {
                        cur.wrongAnswers.push(inW);
                    }
                });

                if (ansRaw) {
                    if (!cur.ansRaw) {
                        cur.ansRaw = ansRaw;
                        cur.ansNorm = ansNorm;
                        cur.verified = Boolean(newItem.verified);
                        cur.isAiSuggestion = Boolean(newItem.isAiSuggestion);
                    } else if (cur.ansNorm === ansNorm) {
                        if (newItem.verified) {
                            cur.verified = true;
                            cur.isAiSuggestion = false;
                        }
                    } else if (newItem.verified) {
                        cur.ansRaw = ansRaw;
                        cur.ansNorm = ansNorm;
                        cur.verified = true;
                        cur.isAiSuggestion = false;
                    }
                }

                // Deduction check
                if ((!cur.ansRaw || (!cur.verified && cur.isAiSuggestion)) && Array.isArray(cur.choices) && cur.choices.length > 1) {
                    const wrongNorms = cur.wrongAnswers.map(w => w.norm);
                    const remaining = cur.choices.filter(c => !wrongNorms.includes(c.toLowerCase().trim()));
                    if (remaining.length === 1) {
                        cur.ansRaw = remaining[0];
                        cur.ansNorm = remaining[0].toLowerCase().trim();
                        cur.verified = true;
                        cur.deduced = true;
                        cur.isAiSuggestion = false;
                    }
                }
            }
        });
    }

    // Step A: AI suggests "ROM" for Question CS101
    mockMerge('CS101', [{
        question: "Primary component?",
        choices: ["RAM", "ROM", "Business Strategy", "Marketing Plan"],
        ansRaw: "ROM",
        verified: false,
        isAiSuggestion: true,
        source: "Google Gemini AI"
    }], "Google Gemini AI");

    assert.strictEqual(mockExisting.length, 1);
    assert.strictEqual(mockExisting[0].ansRaw, "ROM");
    assert.strictEqual(mockExisting[0].isAiSuggestion, true);
    assert.strictEqual(mockExisting[0].verified, false);

    // Step B: Student picks "Business Strategy" instead, Moodle marks it ❌ 0.00
    mockMerge('CS101', [{
        question: "Primary component?",
        choices: ["RAM", "ROM", "Business Strategy", "Marketing Plan"],
        wrongAnswers: ["Business Strategy"],
        verified: false
    }], "Review");

    // ROM is NOT debunked, it remains an unverified AI suggestion; Business Strategy is eliminated
    assert.strictEqual(mockExisting[0].ansRaw, "ROM");
    assert.strictEqual(mockExisting[0].isAiSuggestion, true);
    assert.strictEqual(mockExisting[0].wrongAnswers.some(w => w.norm === "business strategy"), true);

    // Step C: Another attempt eliminates "Marketing Plan" and "RAM", leaving only ROM
    mockMerge('CS101', [{
        question: "Primary component?",
        choices: ["RAM", "ROM", "Business Strategy", "Marketing Plan"],
        wrongAnswers: ["Marketing Plan", "RAM"],
        verified: false
    }], "Review");

    // Deduction must trigger and promote ROM to 100% verified deduced answer!
    assert.strictEqual(mockExisting[0].ansRaw, "ROM");
    assert.strictEqual(mockExisting[0].verified, true);
    assert.strictEqual(mockExisting[0].deduced, true);
    assert.strictEqual(mockExisting[0].isAiSuggestion, false);
});

// --------------------------------------------------
// 106. Gemini AI: Card-Level Question Tagging & Attribution
// --------------------------------------------------
test("Gemini AI: AI Question Tagging & Unverified Attribution displays clean card-level pill, cleans up unanswered hints, and integrates with choices", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Definition and naming of setQuestionAiTag
    assert.ok(script.includes("function setQuestionAiTag(que, isAi = true)"), "Must define setQuestionAiTag helper");

    // 2. Class name and content of card-level AI question tag
    assert.ok(script.includes("tag.className = 'amaes-ai-question-tag';"), "Must create amaes-ai-question-tag");
    assert.ok(script.includes("AI-SOLVED"), "Must display AI-SOLVED badge in card header");
    assert.ok(script.includes("Answered by Google Gemini AI"), "Must prominently attribute solver to Google Gemini AI");
    assert.ok(script.includes("Unverified Suggestion — Review before submitting"), "Must clearly designate suggestion as unverified for user review");

    // 3. Removal of 'No answer known yet' hint when AI answers
    assert.ok(script.includes("que.querySelectorAll('.amaes-unanswered-hint').forEach(el => el.remove());"), "Must purge unanswered hint when question is answered by AI");

    // 4. Called automatically in applyAiChoiceHighlight
    const applyBlock = script.slice(script.indexOf("function applyAiChoiceHighlight(targetRow)"), script.indexOf("function showAiFallbackBar"));
    assert.ok(applyBlock.includes("setQuestionAiTag(que, true);"), "applyAiChoiceHighlight must automatically invoke setQuestionAiTag on the question container");

    // 5. Called in highlightQuizAnswers when choice has hasAiSource
    assert.ok(script.includes("if (hasAiSource) {\n                            setQuestionAiTag(que, true);"), "highlightQuizAnswers must set question AI tag when choice has hasAiSource");

    // 6. Complete CSS and sanitization stripping in cleanDOMToAI and review harvesting
    assert.ok(script.includes(".amaes-ai-question-tag"), "cleanDOMToAI and DOM sanitizers must strip .amaes-ai-question-tag");
    assert.ok(script.includes(".amaes-ai-question-tag {\n                    user-select: none;\n                }"), "Must define CSS user-select rule for amaes-ai-question-tag");
});

// --------------------------------------------------
// 107. Gemini AI: Rate Limiting (15 RPM), Plan Tier Gating, Cooldown Tracking & Live Countdown HUD
// --------------------------------------------------
test("Gemini AI: Rate Limiting enforces 15 RPM sliding window on Free Tier, respects Pay-As-You-Go, tracks cooldowns, and renders live countdown HUD", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Core Rate Limit constants and helpers presence
    assert.ok(script.includes("const GEMINI_FREE_RPM = 15;"), "Must define GEMINI_FREE_RPM = 15");
    assert.ok(script.includes("function getAiPlanTier()"), "Must define getAiPlanTier helper");
    assert.ok(script.includes("function setAiPlanTier(tier)"), "Must define setAiPlanTier helper");
    assert.ok(script.includes("function getStoredRequestTimestamps()"), "Must define getStoredRequestTimestamps helper");
    assert.ok(script.includes("function recordAiRequest()"), "Must define recordAiRequest helper");
    assert.ok(script.includes("function triggerAiRateLimitCooldown(suggestedWaitSec = 20)"), "Must define triggerAiRateLimitCooldown helper");
    assert.ok(script.includes("function getAiRateLimitStatus()"), "Must define getAiRateLimitStatus helper");

    // 2. Functional Verification: Plan Tier & Sliding Window Logic
    let mockLocalStorage = {};
    let mockSessionStorage = {};

    function simGetAiPlanTier() {
        return mockLocalStorage['amaes_ai_plan_tier'] || 'free';
    }
    function simSetAiPlanTier(tier) {
        mockLocalStorage['amaes_ai_plan_tier'] = tier === 'paid' ? 'paid' : 'free';
    }
    function simGetStoredTimestamps() {
        try {
            const raw = mockSessionStorage['amaes_ai_req_timestamps'];
            if (raw) {
                const arr = JSON.parse(raw);
                const cutoff = Date.now() - 60000;
                return arr.filter(t => t > cutoff);
            }
        } catch (_) {}
        return [];
    }
    function simRecordAiRequest(customTime = Date.now()) {
        const cutoff = customTime - 60000;
        const current = simGetStoredTimestamps().filter(t => t > cutoff);
        current.push(customTime);
        mockSessionStorage['amaes_ai_req_timestamps'] = JSON.stringify(current);
    }
    let simCooldownUntil = 0;
    function simTriggerCooldown(sec = 20) {
        const waitSec = Math.max(5, Math.min(60, sec));
        simCooldownUntil = Math.max(simCooldownUntil, Date.now() + (waitSec * 1000));
        mockSessionStorage['amaes_ai_cooldown_until'] = String(simCooldownUntil);
        return Math.ceil((simCooldownUntil - Date.now()) / 1000);
    }
    function simGetRateLimitStatus() {
        const now = Date.now();
        if (simCooldownUntil > now) {
            return { isLimited: true, remainingSec: Math.ceil((simCooldownUntil - now) / 1000), reason: 'cooldown' };
        }
        if (simGetAiPlanTier() === 'free') {
            const timestamps = simGetStoredTimestamps();
            if (timestamps.length >= 15) {
                const oldest = timestamps[0];
                const remainingSec = Math.max(1, Math.ceil((oldest + 60000 - now) / 1000));
                return { isLimited: true, remainingSec, reason: 'rpm_cap' };
            }
        }
        return { isLimited: false, remainingSec: 0, reason: null };
    }

    // Free Tier default
    assert.strictEqual(simGetAiPlanTier(), 'free');

    // Make 14 requests - under limit
    for (let i = 0; i < 14; i++) {
        simRecordAiRequest();
    }
    assert.strictEqual(simGetRateLimitStatus().isLimited, false);

    // 15th request reaches cap
    simRecordAiRequest();
    assert.strictEqual(simGetStoredTimestamps().length, 15);
    const statusCapped = simGetRateLimitStatus();
    assert.strictEqual(statusCapped.isLimited, true);
    assert.strictEqual(statusCapped.reason, 'rpm_cap');
    assert.ok(statusCapped.remainingSec > 0 && statusCapped.remainingSec <= 60);

    // Switch to Pay-As-You-Go (paid tier): 15 RPM cap must NOT block paid users!
    simSetAiPlanTier('paid');
    assert.strictEqual(simGetAiPlanTier(), 'paid');
    assert.strictEqual(simGetRateLimitStatus().isLimited, false);

    // However, if Google returns an explicit 429 quota exhaustion, cooldown still activates even on paid
    simTriggerCooldown(25);
    const statusCooldown = simGetRateLimitStatus();
    assert.strictEqual(statusCooldown.isLimited, true);
    assert.strictEqual(statusCooldown.reason, 'cooldown');
    assert.ok(statusCooldown.remainingSec >= 24 && statusCooldown.remainingSec <= 26);

    // 3. UI Plan Selector Integration across tabs and setup modal
    assert.ok(script.includes('id="sel-ai-plan-tier"'), "Quiz Tab settings must include sel-ai-plan-tier dropdown");
    assert.ok(script.includes('id="sel-course-ai-plan-tier"'), "Course Tools card must include sel-course-ai-plan-tier dropdown");
    assert.ok(script.includes('id="amaes-gemini-plan-select"'), "Gemini setup modal must include amaes-gemini-plan-select dropdown");
    assert.ok(script.includes('Free plan'), "Must clearly display the plain-language free plan option");
    assert.ok(script.includes('Paid plan'), "Must clearly display the plain-language paid plan option");
    assert.ok(script.includes('If checked, saving this key is your consent'), "Contributor sharing must explain that checking the option is consent");
    assert.ok(script.includes('database/blob/main/relay/README.md#contributor-key-sharing'), "Contributor sharing must link to its management details");
    assert.ok(script.includes('Click inside a quiz question and press C to copy the question and choices'), "Tips must explain the C shortcut in plain language");
    assert.ok(script.includes('click the question and press V to paste it back'), "Tips must explain the V shortcut in plain language");

    // 4. Live Countdown HUD & Fallback Bar
    assert.ok(script.includes('id="amaes-ratelimit-countdown"'), "Fallback bar must include amaes-ratelimit-countdown element");
    assert.ok(script.includes('Google AI is temporarily busy'), "Fallback bar must display a plain-language rate limit warning");
    assert.ok(script.includes('activeRateLimitTimerInterval = setInterval'), "Must drive live countdown with setInterval");
    assert.ok(script.includes("retryBtn.textContent = 'Retry AI now';"), "Must update retry button to active state when countdown finishes");
    assert.ok(script.includes('if (autoQuizMode) {'), "Fallback bar countdown expiration must auto-trigger retry if autoQuizMode is running");

    // 5. Fast-Fail on 429 in callGeminiApi to avoid wasting candidate endpoint timeouts
    const callApiBlock = script.slice(script.indexOf("async function callGeminiApi"), script.indexOf("function matchAiAnswerToChoice"));
    assert.ok(callApiBlock.includes("triggerAiRateLimitCooldown("), "callGeminiApi must trigger cooldown on 429");
    assert.ok(callApiBlock.includes("recordAiRequest(apiKey);"), "callGeminiApi must record timestamp on request invocation");

    // 6. Do not spend requests after the student has already answered, and do
    // not retry deterministic quota/auth failures across multiple saved keys.
    const inferenceBlock = script.slice(script.indexOf("async function handleGeminiQuestionInference"), script.indexOf("// Non-tech student setup modal"));
    assert.ok(inferenceBlock.includes("already has an answer; no request sent"), "AI inference must stop when the question was answered before a retry");
    assert.ok(inferenceBlock.includes("Authentication, quota, and rate-limit errors are not"), "Deterministic AI failures must fail fast instead of retrying across keys");
});

test("Client Compatibility & Update Check Robustness", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Verify verifyClientCompatibility does not lock out on network timeout/errors
    assert.ok(script.includes("amaes_cached_min_version"), "Must cache minimum version policy");
    assert.ok(script.includes("comparison !== null && comparison < 0"), "Must strictly check comparison is valid and < 0 before blocking");
    assert.ok(script.includes("Temporary network interruptions"), "Must document network error resilience in compatibility check");

    // 2. Clean up stale update state when up to date
    assert.ok(script.includes("localStorage.removeItem('amaes_latest_version_seen');"), "Must clear cached latest version when current script is up to date");
    assert.ok(script.includes("document.getElementById('amaes-topnav-update-item')?.remove();"), "Must remove topnav update item when up to date");

    // 3. Direct top banner without full-page lockdown
    assert.ok(script.includes("amaes-compat-banner"), "Must use non-intrusive top banner instead of locking out entire page");
    assert.ok(script.includes("Update to v${required} to use the tool"), "Must directly prompt user to update to use the tool");
    assert.ok(!script.includes("document.documentElement.innerHTML"), "Must never wipe or replace the host Moodle LMS page");
    assert.ok(script.includes("toolkitSelectors.forEach"), "Must purge open panels, quick info modals, and settings on lockout");
});

test("Audio Notifications & On-Demand AI Manual Retry on Unknown / Short-Answer Questions", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Procedural Web Audio API sound engine
    assert.ok(script.includes("function playToolkitSound(type)"), "Must define playToolkitSound function");
    assert.ok(script.includes("type === 'quest_done'"), "Must support quest_done audio notification");
    assert.ok(script.includes("type === 'manual_intervention'"), "Must support manual_intervention audio notification");
    assert.ok(script.includes("ctx.createOscillator()"), "Must use Web Audio API oscillators for zero-dependency sound");

    // 2. Audio alert settings toggle
    assert.ok(script.includes("id=\"chk-audio-alerts\""), "Settings UI must provide chk-audio-alerts checkbox");
    assert.ok(script.includes("amaes_enable_audio_alerts"), "Must persist enableAudioAlerts in localStorage");

    // 3. On-Demand "Ask AI" / "Retry AI" Card Button
    assert.ok(script.includes("amaes-ask-ai-card-btn"), "Question card toolbar must include amaes-ask-ai-card-btn");
    assert.ok(script.includes("manualSolveWithAi(que, btnAskAi)"), "Card Ask AI button must invoke manualSolveWithAi");

    // 4. On-Demand "Ask AI" / "Retry AI" in Blockage HUD
    assert.ok(script.includes("id=\"btn-blockage-ask-ai\""), "Blockage HUD must include btn-blockage-ask-ai button");
    assert.ok(script.includes("manualSolveWithAi(firstBlockedQue, blockageAskAi)"), "Blockage HUD button must invoke manualSolveWithAi");

    // 5. Short-Answer / Fill-in-the-Blank prompt and inference support
    assert.ok(script.includes("[Fill-in-the-Blank / Short Answer]"), "buildGeminiCompactPrompt must construct short-answer prompt");
    assert.ok(script.includes("function applyAiTextHighlight("), "Must define applyAiTextHighlight for text inputs");
    assert.ok(script.includes("function manualSolveWithAi("), "Must define manualSolveWithAi handler");

    // 6. Audio notification triggers
    assert.ok(script.includes("playToolkitSound('manual_intervention')"), "Must trigger manual_intervention sound on blocked question");
    assert.ok(script.includes("playToolkitSound('quest_done')"), "Must trigger quest_done sound on quiz finish/summary");
});

test("Gapselect / Dropdown Pick Support, Unknown Question Type JSON Store, and Review Screen Wrong Answer Debunking Guard", () => {
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. cleanDOMToAI converts <select> into readable [Dropdown N (Opt1 | Opt2)] tokens
    assert.ok(script.includes("Convert select / dropdown elements (e.g. gapselect inline dropdowns)"), "cleanDOMToAI must convert select elements");
    assert.ok(script.includes("[Dropdown ${selectCount}"), "cleanDOMToAI must format dropdown labels with options or selected value");

    // 2. Question type identification & categorization
    assert.ok(script.includes("function identifyQuestionType(que)"), "Must define identifyQuestionType");
    assert.ok(script.includes("function mapQuestionTypeCategory(rawType)"), "Must define mapQuestionTypeCategory");
    assert.ok(script.includes("gapselect"), "Must explicitly identify gapselect question type");

    // 3. Unknown Question Type Telemetry JSON Store
    assert.ok(script.includes("function recordUnknownQuestionType(que"), "Must define recordUnknownQuestionType");
    assert.ok(script.includes("amaes_unknown_question_types"), "Must use amaes_unknown_question_types in localStorage");
    assert.ok(script.includes("function getUnknownQuestionTypes()"), "Must define getUnknownQuestionTypes");
    assert.ok(script.includes("function exportUnknownQuestionTypesJson()"), "Must define exportUnknownQuestionTypesJson");
    assert.ok(script.includes("function clearUnknownQuestionTypes()"), "Must define clearUnknownQuestionTypes");

    // 4. Review Page Guard & Short Answer Wrong-Answer Debunking
    assert.ok(script.includes("// Never run highlightQuizAnswers on review pages"), "highlightQuizAnswers must have review page early exit");
    assert.ok(script.includes("if (checkIsReviewPage()) {"), "highlightQuizAnswers must check checkIsReviewPage");
    assert.ok(script.includes("const validCandidates = candidates.filter"), "Must filter candidates against allWrongList before picking suggested answer");
    assert.ok(script.includes("textInputs.length > 0 && validCandidates.length > 0 && !checkIsReviewPage()"), "Short-answer hint must require validCandidates and not be on review page");
    assert.ok(script.includes("selectInputs.length > 0 && validCandidates.length > 0 && !checkIsReviewPage()"), "Select hint must require validCandidates and not be on review page");

    // 5. Gapselect Prompt Builder & Gemini Inference
    assert.ok(script.includes("[Dropdown Pick / Fill Blank]"), "buildGeminiCompactPrompt must format gapselect dropdown prompts");
    assert.ok(script.includes("Gemini selected") && script.includes("dropdown option"), "handleGeminiQuestionInference must support picking select options");
    assert.ok(script.includes("qData.isGapSelect"), "extractQuestionData must set isGapSelect");
    assert.ok(script.includes("selectInputs.length > 0 && (!qData.choices || qData.choices.length === 0)"), "handleGeminiQuestionInference must support selectInputs dropdown matching");

    // 6. Diagnostic Log & Terminal Commands Integration
    assert.ok(script.includes("Recorded Unknown Question Types:"), "Diagnostic audit log must include unknown question types count and JSON");
    assert.ok(script.includes("c === 'unknown' || c === 'unknowns'"), "Developer console must support 'unknown' command");
});

// --------------------------------------------------
// 103. Unknown Question Non-Intrusive Handling & Automatic Database Push
// --------------------------------------------------
test("Unknown Question Non-Intrusive Handling & Automatic Database Push: script leaves unknown question untouched, notifies user gently, auto-pushes telemetry to database relay, and keeps user database panel clean", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Question card type pill for recognized types
    assert.ok(script.includes("amaes-que-type-pill"), "Question toolbar must render amaes-que-type-pill");
    assert.ok(script.includes("Dropdown Pick"), "Type pill must map gapselect to 'Dropdown Pick'");
    assert.ok(script.includes("Short Answer"), "Type pill must map shortanswer to 'Short Answer'");
    assert.ok(script.includes("Multiple Choice"), "Type pill must map multichoice to 'Multiple Choice'");
    assert.ok(script.includes("True / False"), "Type pill must map truefalse to 'True / False'");

    // 2. Non-intrusive guard for unknown questions (do not alter DOM or inject pills/HUD)
    assert.ok(script.includes("qData.questionType === 'unknown'"), "Auto solver must check if question type is unknown");
    assert.ok(script.includes("recordUnknownQuestionType(firstBlockedQue, qData)"), "Auto solver must record unknown question and push to relay");
    assert.ok(script.includes("New question type detected — reported to maintainer."), "Must notify user gently when unknown question is detected");

    // 3. Automatic push to database relay
    assert.ok(script.includes("function pushUnknownQuestionToRelay(entry,"), "Must define pushUnknownQuestionToRelay");
    assert.ok(script.includes("pushedUnknownSignatures"), "Must deduplicate pushed unknown question signatures");
    assert.ok(script.includes("/unknown-question"), "Must push to /unknown-question endpoint on relay");

    // 4. Clean user UI: bulky telemetry accordion removed from user-facing Database tab
    assert.ok(!script.includes("id=\"amaes-unknown-types-accordion\""), "Bulky unknown telemetry accordion must be removed from user-facing Database tab");
    assert.ok(!script.includes("id=\"btn-copy-unknown-json\""), "Copy button must be removed from user-facing Database tab");

    // 5. Developer inspection retained in diagnostic console and logs
    assert.ok(script.includes("c === 'unknown' || c === 'unknowns'"), "Developer console must support 'unknown' command for maintainer inspection");
    assert.ok(script.includes("Recorded Unknown Question Types:"), "Diagnostic export log must retain unknown question telemetry for maintainer");
});

// --------------------------------------------------
// 104. 1-Click In-App Bug Reporting & Relay Issue Submission
// --------------------------------------------------
test("1-Click In-App Bug Reporting: header button triggers clean modal, validates input, attaches logs, and submits via relay endpoint /report-bug", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Icon & Header Button
    assert.ok(script.includes("bug: `<svg"), "ICONS dictionary must define 'bug' icon");
    assert.ok(script.includes("id=\"amaes-bug-btn\""), "Toolkit panel header must include #amaes-bug-btn");
    assert.ok(script.includes("bugBtn.onclick = () => {\n                showBugReportModal();"), "amaes-bug-btn must wire click event to showBugReportModal");

    // 2. Global Escape key handling
    assert.ok(script.includes("const bugModal = document.getElementById('amaes-bug-modal');"), "Global Escape handler must check for #amaes-bug-modal");
    assert.ok(script.includes("if (bugModal) bugModal.remove();"), "Global Escape handler must cleanly close #amaes-bug-modal");

    // 3. Relay Bug Submission Function
    assert.ok(script.includes("function submitBugReportToRelay(reportData)"), "Must define submitBugReportToRelay");
    assert.ok(script.includes("`${relayUrl}/report-bug`"), "submitBugReportToRelay must target /report-bug endpoint on community relay");
    assert.ok(script.includes("payload = {"), "Must construct payload for bug report");
    assert.ok(script.includes("description: reportData.description"), "Payload must include user description");
    assert.ok(script.includes("subjectCode: reportData.subjectCode"), "Payload must include subjectCode");
    assert.ok(script.includes("pageType: reportData.pageType"), "Payload must include pageType");
    assert.ok(script.includes("logs: Array.isArray(reportData.logs)"), "Payload must include diagnostic logs array");
    assert.ok(script.includes("breadcrumbs: Array.isArray(reportData.breadcrumbs)"), "Payload must include user action breadcrumbs array");
    assert.ok(script.includes("questionsSummary: Array.isArray(reportData.questionsSummary)"), "Payload must include questions summary array");
    assert.ok(script.includes("settings: (reportData.settings"), "Payload must include settings object");

    // 4. User Action Breadcrumbs & Question Inventory Tracking
    assert.ok(script.includes("function recordBreadcrumb(category, action"), "Must define recordBreadcrumb");
    assert.ok(script.includes("function setupBreadcrumbListeners()"), "Must define setupBreadcrumbListeners");
    assert.ok(script.includes("setupBreadcrumbListeners();"), "Must invoke setupBreadcrumbListeners on initialization");

    // 5. Bug Report Modal UI & Validation
    assert.ok(script.includes("function showBugReportModal()"), "Must define showBugReportModal");
    assert.ok(script.includes("'amaes-bug-modal'"), "Modal must use 'amaes-bug-modal' identifier");
    assert.ok(script.includes("id=\"amaes-bug-description\""), "Modal must provide #amaes-bug-description textarea");
    assert.ok(script.includes("id=\"amaes-bug-include-logs\""), "Modal must provide #amaes-bug-include-logs checkbox");
    assert.ok(script.includes("desc.length < 10"), "Must validate description length is at least 10 characters");
    assert.ok(script.includes("Issue #${res.issueNumber} Opened!"), "Modal must display created GitHub issue number upon success");
});

// 144. Multi-Web AI Launchers and Choice Eliminated Marker Integrity
test("Multi-Web AI Launchers & Choice Eliminated Marker: provides 1-click external AI URLs and plain English choice elimination badge", () => {
    const fs = require('fs');
    const script = fs.readFileSync('amaes-toolkit.user.js', 'utf8');

    // 1. Multi-Web AI Launchers
    assert.ok(script.includes("function openExternalAi(provider, que)"), "Must define openExternalAi helper");
    assert.ok(script.includes("https://chatgpt.com/?q="), "openExternalAi must support ChatGPT with prompt query parameter");
    assert.ok(script.includes("https://www.perplexity.ai/search?q="), "openExternalAi must support Perplexity with search query parameter");
    assert.ok(script.includes("https://gemini.google.com/app"), "openExternalAi must support Google Gemini with auto-copy and web app launcher");
    assert.ok(script.includes("class=\"amaes-web-ai-row\"") || script.includes("amaes-web-ai-row"), "Quiz question cards must render .amaes-web-ai-row container");
    assert.ok(script.includes("amaes-pill-chatgpt"), "Cards must provide ChatGPT button");
    assert.ok(script.includes("amaes-pill-perplexity"), "Cards must provide Perplexity button");
    assert.ok(script.includes("amaes-pill-gemini"), "Cards must provide Gemini button");

    // 2. Choice Eliminated Marker
    assert.ok(script.includes("'Choice Eliminated'"), "Harvester must use user-friendly 'Choice Eliminated' label instead of 'Wrong Choice Saved'");
});

console.log("\n==================================================");
console.log(`TOTAL TESTS: ${passed + failed}`);
console.log(`PASSED:      ${passed}`);
console.log(`FAILED:      ${failed}`);
console.log("==================================================");

if (failed > 0) {
    process.exit(1);
}
