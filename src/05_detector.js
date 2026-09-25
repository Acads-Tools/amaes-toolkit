    // ==========================================
    // Course & Activity Detection
    // ==========================================

    const KNOWN_COURSES = {
        // Computer Science
        "CS6202": "Algorithms and Complexity",
        "CS6204": "Computer Architecture and Organization",
        "CS6205": "Automata Theory and Formal Languages",
        "CS6206": "Principles of Operating Systems",
        "CS6209": "Software Engineering 1",
        "CS6300": "Software Engineering 2",
        "CS6301": "Logic Design and Digital Computer Circuits",
        "CS6309": "Introduction to Machine Learning",
        "CS6326": "Mobile Application Development",
        // Information Technology
        "IT6201": "Data Structures and Algorithm Analysis",
        "IT6202": "Data Structures and Algorithms",
        "IT6203": "Web Systems and Technologies 1",
        "IT6204": "Web Systems and Technologies 2",
        "IT6205": "Information Assurance and Security 1",
        "IT6205A": "Information Assurance and Security 1",
        "IT6206": "Information Assurance and Security 2",
        "IT6207": "Database Systems 1",
        "IT6208": "System Integration and Architecture 1",
        "IT6209": "Introduction to Multimedia",
        "IT6210": "Systems Administration and Maintenance",
        "IT6220": "Information Management",
        "IT6221": "Data Communications and Networking 1",
        "IT6222": "Data Communications and Networking 2",
        "IT6224": "Data Communications and Networking 3",
        "IT6224B": "Data Communications and Networking 3",
        "IT6300": "Cloud Computing",
        "IT6301": "Technopreneurship",
        "IT6302": "System Analysis and Design",
        "IT6310": "Network Security",
        "IT6320": "Social and Professional Issues",
        "IT6322": "Mobile Application Development",
        "IT6322A": "Mobile Application Development",
        "IT6323": "Human Computer Interaction",
        "IT6324": "Information Assurance and Security",
        // Information Technology Education Core
        "ITE6100": "Introduction to Computing",
        "ITE6101": "Computer Programming 1",
        "ITE6102": "Computer Programming 1",
        "ITE6103": "Computer Programming 2",
        "ITE6104": "Computer Programming 2",
        "ITE6200": "Application Development and Emerging Technology",
        "ITE6201": "Data Structures and Algorithm Analysis",
        "ITE6220": "Information Management",
        "ITE6300": "Cloud Computing and Internet of Things",
        "ITE6301": "Technopreneurship",
        // Mathematics & Sciences
        "MATH6100": "Calculus 1",
        "MATH6101": "Calculus 2",
        "MATH6102": "Discrete Mathematics",
        // General Education & Institutional
        "GE6100": "Understanding the Self",
        "GE6101": "Readings in Philippine History",
        "GE6102": "The Contemporary World",
        "GE6103": "Mathematics in the Modern World",
        "GE6104": "Purposive Communication",
        "GE6105": "Art Appreciation",
        "GE6106": "Science, Technology and Society",
        "GE6107": "Ethics",
        "GE6108": "Rizal's Life and Works",
        "GE6115": "Art Appreciation",
        "ETHNS6101": "Euthenics 1",
        "ETHNS6102": "Euthenics 2",
        "NSTP6101": "National Service Training Program 1",
        "NSTP6102": "National Service Training Program 2",
        "PE6101": "Physical Education 1",
        "PE6102": "Physical Education 2",
        "PE6103": "Physical Education 3",
        "PE6104": "Physical Education 4"
    };

    function resolveKnownCourseName(code) {
        if (!code) return "";
        const clean = String(code).trim().toUpperCase();
        if (KNOWN_COURSES[clean]) return KNOWN_COURSES[clean];
        const base = clean.replace(/[A-Za-z]+$/, '');
        if (base && KNOWN_COURSES[base]) return KNOWN_COURSES[base];
        return clean;
    }

    function detectCourseInfo() {
        let fullTitle = '';
        const codeRegex = /\b([A-Za-z]{2,6}\d{3,4}[A-Za-z]*)\b/;

        const candidates = [];
        const heading = document.querySelector('.page-header-headings h1, #page-header h1, .page-header-title');
        if (heading && heading.innerText.trim()) candidates.push(heading.innerText.trim());

        const breadcrumbLinks = document.querySelectorAll('.breadcrumb-item a, nav.breadcrumb a, .breadcrumb a');
        for (const link of breadcrumbLinks) {
            const text = link.innerText.trim();
            if (text) candidates.push(text);
        }
        if (document.title) candidates.push(document.title);

        let bestCandidate = '';
        for (const cand of candidates) {
            if (codeRegex.test(cand)) {
                bestCandidate = cand;
                break;
            }
        }
        if (!bestCandidate && candidates.length > 0) {
            bestCandidate = candidates[0];
        }
        fullTitle = bestCandidate;

        let subjectCode = '';
        let subjectName = '';

        const codeMatch = fullTitle.match(codeRegex) || fullTitle.match(/[-_]\s*([A-Za-z0-9]+)\b/);
        if (codeMatch) {
            subjectCode = codeMatch[1].toUpperCase();

            const codeIndex = fullTitle.indexOf(codeMatch[1]);
            if (codeIndex !== -1) {
                const after = fullTitle.substring(codeIndex + codeMatch[1].length).trim().replace(/^[:\-–\s]+/, '').split('|')[0].trim();
                const before = fullTitle.substring(0, codeIndex).trim().replace(/[:\-–\s]+$/, '').split('|')[0].trim();
                if (after && after.length > 2) {
                    subjectName = after;
                } else if (before && before.length > 2) {
                    subjectName = before;
                }
            } else {
                subjectName = fullTitle.replace(codeMatch[1], '').replace(/^[:\-–\s]+/, '').trim();
            }
        }

        if (!subjectName || subjectName.toUpperCase() === subjectCode) {
            const fallback = resolveKnownCourseName(subjectCode);
            if (fallback && fallback !== subjectCode) {
                subjectName = fallback;
            }
        }

        let currentActivityTitle = '';
        if (window.location.pathname.includes('/mod/quiz/')) {
            const quizHeader = document.querySelector('.page-header-headings h1, #region-main h2, #region-main h3');
            if (quizHeader) {
                currentActivityTitle = quizHeader.innerText.trim();
            }
        }

        let courseId = '';
        if (window.location.pathname.includes('/course/view.php') || window.location.pathname.includes('/grade/report/')) {
            courseId = new URLSearchParams(window.location.search).get('id') || '';
        }
        if (!courseId) {
            const courseBreadcrumb = document.querySelector('a[href*="/course/view.php?id="]');
            if (courseBreadcrumb && courseBreadcrumb.href) {
                const m = courseBreadcrumb.href.match(/[?&]id=(\d+)/);
                if (m) courseId = m[1];
            }
        }
        if (!courseId) {
            const gradeLink = document.querySelector('a[href*="/grade/report/user/index.php?id="]');
            if (gradeLink && gradeLink.href) {
                const m = gradeLink.href.match(/[?&]id=(\d+)/);
                if (m) courseId = m[1];
            }
        }
        if (!courseId) {
            const bodyMatch = document.body.className ? document.body.className.match(/\bcourse-(\d+)\b/) : null;
            if (bodyMatch && bodyMatch[1] !== '1') {
                courseId = bodyMatch[1];
            }
        }

        return {
            fullTitle,
            subjectCode,
            subjectName,
            courseId,
            currentActivityTitle
        };
    }

    function checkIsCoursePage() {
        return window.location.pathname.includes('/course/view.php') ||
               window.location.pathname.includes('/mod/') ||
               Boolean(document.querySelector('.course-content, .course-section, #region-main .activity, .activity-item, .que'));
    }

    function checkIsQuizPage() {
        return window.location.pathname.includes('/mod/quiz/attempt.php') ||
               window.location.pathname.includes('/mod/quiz/summary.php') ||
               window.location.pathname.includes('/mod/quiz/review.php') ||
               Boolean(document.querySelector('.que, .quizsummarytable, #region-main .summarytable'));
    }

    function checkIsReviewPage() {
        if (window.location.pathname.includes('/mod/quiz/review.php')) return true;
        if (document.querySelector('#page-mod-quiz-review, body.path-mod-quiz-review, .quizreviewsummary, table.quizreviewsummary')) return true;
        if (document.querySelector('.que .outcome, .que .rightanswer')) return true;
        if (Array.from(document.querySelectorAll('a, button, input[type="submit"], .submitbtns a')).some(el => /finish\s+review/i.test(el.textContent || el.value || ''))) return true;
        return false;
    }

    function checkIsQuizAttemptPage() {
        return window.location.pathname.includes('/mod/quiz/attempt.php');
    }

    function checkIsQuizSummaryPage() {
        return window.location.pathname.includes('/mod/quiz/summary.php') ||
               Boolean(document.querySelector('.quizsummarytable, #region-main .summarytable'));
    }

    // String Normalization for Question & Answer Matching
    function normalizeText(str) {
        if (!str) return '';
        // Unescape HTML entities
        const doc = new DOMParser().parseFromString(str, 'text/html');
        let text = doc.body.textContent || '';
        text = text.toLowerCase().trim();
        text = unscriptDigits(text);
        // Remove question numbering like "1.", "question 1:"
        text = text.replace(/^(question\s*\d+[\s:.]*|\d+[\s:.)]+)/, '');
        // Strip common question instructions / preambles:
        // e.g. "Choose the best answer.", "Select the correct answer.", "Read the statement carefully and select the best answer."
        const preambleRegex = /^(?:(?:direction|directions|instruction|instructions)\s*[:.\-–]\s*)?(?:read\s+(?:each\s+|the\s+)?(?:statement|question|passage)s?\s+(?:carefully\s+)?(?:and\s+)?)?(?:choose|select|pick|identify|mark)\s+(?:the\s+)?(?:best|correct|appropriate|right)\s+(?:answer|choice|option)[.:?!;\s–-]*/i;
        while (preambleRegex.test(text)) {
            const nextText = text.replace(preambleRegex, '').trim();
            if (nextText.length === 0) break;
            text = nextText;
        }
        // Strip trailing prompt instructions like "select one:", "choose one:", etc.
        const trailingPromptRegex = /\b(?:select\s+one|select\s+one\s+or\s+more|choose\s+one|choose\s+one\s+or\s+more|choose\s+the\s+best\s+answer)[:.]?\s*$/i;
        if (trailingPromptRegex.test(text)) {
            const nextText = text.replace(trailingPromptRegex, '').trim();
            if (nextText.length > 0) text = nextText;
        }
        // Strip multiple underscores down to single placeholder
        text = text.replace(/_{2,}/g, '___');
        // Strip extra whitespace
        text = text.replace(/\s+/g, ' ');
        // Strip trailing punctuation
        text = text.replace(/[.:?!;,]+$/, '');
        return text.trim();
    }

    function questionTextMatches(left, right) {
        const leftNorm = normalizeText(left);
        const rightNorm = normalizeText(right);
        if (!leftNorm || !rightNorm) return false;
        if (leftNorm === rightNorm) return true;

        // Moodle may render answer blanks as underscores, inputs, or spacing
        // that is absent from the stored question text.
        const stripBlanks = text => text
            .replace(/[_\u00a0]+/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[.:?!;,]+$/g, '')
            .trim();
        const leftClean = stripBlanks(leftNorm);
        const rightClean = stripBlanks(rightNorm);
        if (leftClean === rightClean) return true;

        // Permit harmless prompt markup differences, but never short-token matches.
        return leftClean.length > 20 &&
            (leftClean.includes(rightClean) || rightClean.includes(leftClean));
    }

    // Helper to unscript unicode superscript and subscript digits to standard digits
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
        let text = str;
        if (typeof DOMParser !== 'undefined' && /<[a-z][\s\S]*>/i.test(str)) {
            try {
                const doc = new DOMParser().parseFromString(str, 'text/html');
                const imgs = doc.body.querySelectorAll('img');
                let extracted = doc.body.textContent || '';
                if (!extracted.trim() && imgs.length > 0) {
                    extracted = Array.from(imgs).map(img => {
                        const m = (img.src || '').match(/\/pluginfile\.php\/\d+\/question\/(?:answer|questiontext|feedback)\/\d+(?:\/\d+)?\/([^?#\s]+)/i);
                        return img.alt || (m ? `[moodle-asset:${m[1]}]` : img.src) || '';
                    }).join(' ');
                }
                text = extracted || str;
            } catch (_) {}
        }
        text = text.toLowerCase().trim();
        // Moodle answer labels commonly include "a.", "b)", etc.; the
        // stored answer value normally contains only the choice text.
        text = text.replace(/^[a-z]\s*[\.)]\s+/i, '');
        // Normalize Moodle pluginfile image URLs to stable image asset tokens across quiz attempts
        text = text.replace(/https?:\/\/[^\/]+\/pluginfile\.php\/\d+\/question\/(?:answer|questiontext|feedback)\/\d+(?:\/\d+)?\/([^?#\s]+)/gi, '[moodle-asset:$1]');
        // Normalize unicode dashes/minus signs to standard hyphen
        text = text.replace(/[\u2212\u2013\u2014]/g, '-');
        // Remove prefix like "select one: ", "select one or more: ", "a. ", "b) " safely without stripping negative signs
        // Strip unicode checkmarks/crosses and trailing feedback words
        text = text.replace(/[✓✔✗✘✕✖]/g, '');
        text = text.replace(/\s*[\(\[]?(?:correct|incorrect)[\)\]]?\s*$/i, '');
        text = text.replace(/\s+/g, ' ');
        text = text.replace(/[.:?!;,]+$/, '');
        text = unscriptDigits(text);
        return text.trim();
    }

    // Normalize and structure eliminated wrong choices with weighting & deduplication
    function normalizeWrongAnswers(rawWrong) {
        if (!rawWrong || !Array.isArray(rawWrong)) return [];
        return rawWrong.map(item => {
            if (typeof item === 'string') {
                const clean = item.replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                const norm = normalizeChoice(clean);
                if (!norm) return null;
                return { text: clean, norm: norm, count: 1, sources: [] };
            }
            if (typeof item === 'object' && item) {
                const txt = (item.text || item.ansRaw || item.choice || '').replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                const norm = item.norm || normalizeChoice(txt);
                if (!norm) return null;
                return {
                    text: txt,
                    norm: norm,
                    count: typeof item.count === 'number' ? item.count : (typeof item.weight === 'number' ? item.weight : 1),
                    sources: Array.isArray(item.sources) ? item.sources : []
                };
            }
            return null;
        }).filter(Boolean);
    }

