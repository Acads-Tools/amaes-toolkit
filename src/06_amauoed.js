    // ==========================================
    // AMAUOED Engine (Fetch, Cache & Match)
    // ==========================================

    // Cross-origin safe HTTP fetch using GM_xmlhttpRequest
    function fetchAmauoedPage(url) {
        return new Promise((resolve, reject) => {
            const gmReq = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                          (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

            if (gmReq) {
                gmReq({
                    method: "GET",
                    url: url,
                    headers: {
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    },
                    onload: function (res) {
                        if (res.status >= 200 && res.status < 300) {
                            resolve(res.responseText);
                        } else {
                            reject(new Error(`HTTP ${res.status}: ${res.statusText}`));
                        }
                    },
                    onerror: function (err) {
                        reject(err);
                    }
                });
            } else {
                fetch(url)
                    .then(r => {
                        if (!r.ok) throw new Error(`HTTP ${r.status}`);
                        return r.text();
                    })
                    .then(resolve)
                    .catch(reject);
            }
        });
    }

    // Extract questions and correct answers from AMAUOED HTML
    // Extract questions, choices, distractors, and correct answers from AMAUOED HTML
    function parseAmauoedHtml(html) {
        const results = [];
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        let cards = Array.from(doc.querySelectorAll('.card.mb-2, .card'));
        if (cards.length === 0) {
            cards = Array.from(doc.querySelectorAll('.card-body'));
        }

        cards.forEach(card => {
            const qElem = card.querySelector('.mb-2, h5, .card-title, p.card-text');
            if (!qElem) return;

            const qRaw = qElem.innerText.trim();
            const qNorm = normalizeText(qRaw);
            if (!qNorm) return;

            // Extract all correct answer chips (supports multi-choice questions)
            const correctList = [];
            const correctChips = card.querySelectorAll('.chip.bg-success, span.bg-success, .badge.bg-success, .badge-success');
            if (correctChips.length > 0) {
                correctChips.forEach(ch => {
                    const li = ch.closest('li') || ch.parentElement;
                    if (li) {
                        const clone = li.cloneNode(true);
                        clone.querySelectorAll('.chip, span, .badge').forEach(c => c.remove());
                        const txt = clone.innerText.trim();
                        if (txt && !correctList.includes(txt)) {
                            correctList.push(txt);
                        }
                    }
                });
            } else {
                // Fallback: check strong tag inside li
                const strongs = card.querySelectorAll('li strong');
                strongs.forEach(st => {
                    const txt = st.innerText.trim();
                    if (txt && !correctList.includes(txt)) {
                        correctList.push(txt);
                    }
                });
            }

            // Extract choices and wrong answers (distractors)
            const allChoices = [];
            const wrongAnswers = [];
            const liElements = card.querySelectorAll('li');
            liElements.forEach(li => {
                const clone = li.cloneNode(true);
                clone.querySelectorAll('.chip, span, .badge').forEach(c => c.remove());
                const choiceTxt = clone.innerText.trim();
                if (choiceTxt) {
                    allChoices.push(choiceTxt);
                    const isCorrect = correctList.some(ans => normalizeChoice(ans) === normalizeChoice(choiceTxt));
                    if (!isCorrect && !wrongAnswers.includes(choiceTxt)) {
                        wrongAnswers.push(choiceTxt);
                    }
                }
            });

            if (correctList.length > 0) {
                const ansRaw = correctList.join(', ');
                const ansNorm = normalizeChoice(ansRaw);
                const entry = {
                    qRaw,
                    qNorm,
                    ansRaw,
                    ansNorm,
                    source: 'amauoed'
                };
                if (correctList.length > 1) {
                    entry.answers = correctList;
                }
                if (wrongAnswers.length > 0) {
                    entry.wrongAnswers = normalizeWrongAnswers(wrongAnswers);
                }
                if (allChoices.length > 0) {
                    entry.choices = allChoices;
                }

                const existingIdx = results.findIndex(r => r.qNorm === qNorm);
                if (existingIdx >= 0) {
                    if (entry.answers && Array.isArray(entry.answers)) {
                        const curAnswers = results[existingIdx].answers || [results[existingIdx].ansRaw];
                        results[existingIdx].answers = Array.from(new Set(curAnswers.concat(entry.answers)));
                        results[existingIdx].ansRaw = results[existingIdx].answers.join(', ');
                        results[existingIdx].ansNorm = normalizeChoice(results[existingIdx].ansRaw);
                    }
                } else {
                    results.push(entry);
                }
            }
        });

        return results;
    }

    // Crawl all pages of an AMAUOED course URL
    async function loadAllAmauoedAnswers(baseUrl, onProgress) {
        // Strip query params to get clean base URL
        const cleanBase = baseUrl.split('?')[0];
        let allQuestions = [];
        let page = 1;
        let hasMore = true;
        const maxPages = 40; // High limit to cover 500+ question banks

        while (hasMore && page <= maxPages) {
            const pageUrl = page === 1 ? cleanBase : `${cleanBase}?page=${page}`;
            if (onProgress) onProgress(page, allQuestions.length);

            try {
                logDebug(`Fetching amauoed page ${page}: ${pageUrl}`);
                const html = await fetchAmauoedPage(pageUrl);
                const questions = parseAmauoedHtml(html);

                if (questions.length === 0) {
                    hasMore = false;
                    break;
                }

                // Merge and deduplicate questions on append
                questions.forEach(newQ => {
                    const existing = allQuestions.find(q => q.qNorm === newQ.qNorm);
                    if (!existing) {
                        allQuestions.push(newQ);
                    } else if (newQ.answers && Array.isArray(newQ.answers)) {
                        const curAnswers = existing.answers || [existing.ansRaw];
                        existing.answers = Array.from(new Set(curAnswers.concat(newQ.answers)));
                        existing.ansRaw = existing.answers.join(', ');
                        existing.ansNorm = normalizeChoice(existing.ansRaw);
                    }
                });

                // DOM-based pagination check with string fallback
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const nextLink = doc.querySelector(`.pagination .page-item:not(.disabled) a[href*="page="], a[rel="next"], .pagination a.page-link[href*="page=${page + 1}"]`);
                const hasNextPage = !!nextLink || html.includes(`page=${page + 1}`) || html.includes(`page=${page + 1}"`);

                if (!hasNextPage) {
                    hasMore = false;
                } else {
                    page++;
                    // Polite delay between pages
                    await new Promise(r => setTimeout(r, 400));
                }
            } catch (err) {
                console.error("Error loading page:", err);
                hasMore = false;
            }
        }

        return allQuestions;
    }

    // Automatic Subject Matcher for AMAUOED Course Links
    function checkUrlCourseMatch(url, courseInfo) {
        if (!url || !url.trim()) {
            return {
                status: 'empty',
                html: '<span style="color:var(--text-muted);">Paste the amauoed.com link for this subject above.</span>'
            };
        }

        const cleanUrl = url.trim().toLowerCase();
        if (!cleanUrl.includes('amauoed.com/courses/')) {
            return {
                status: 'invalid',
                html: '<span style="color:var(--accent-pink); font-weight:600;">Invalid link: Must start with https://amauoed.com/courses/...</span>'
            };
        }

        const currentCode = (courseInfo && courseInfo.subjectCode ? courseInfo.subjectCode.toUpperCase() : '');
        const currentCodeNum = currentCode.replace(/\D+/g, '');
        const currentCodePrefix = currentCode.replace(/\d+/g, '').trim().toLowerCase();

        // Extract department and slug from amauoed URL
        const match = cleanUrl.match(/\/courses\/([a-z0-9_-]+)\/([^/?#]+)/i);
        if (!match) {
            return {
                status: 'unknown',
                html: '<span style="color:var(--accent-amber);">Unable to parse course slug from link.</span>'
            };
        }

        const dept = match[1].toLowerCase();
        const slug = match[2].toLowerCase();
        const numMatch = slug.match(/(\d{3,4})/);
        const urlNum = numMatch ? numMatch[1] : '';
        const urlCode = (dept + urlNum).toUpperCase();

        const presetUrl = getStoredAmauoedUrl(currentCode);
        const numMatches = Boolean(currentCodeNum && urlNum && currentCodeNum === urlNum);
        const deptMatches = Boolean(currentCodePrefix && dept && (currentCodePrefix === dept || dept.includes(currentCodePrefix) || currentCodePrefix.includes(dept)));

        if (numMatches && deptMatches) {
            return {
                status: 'match',
                html: `<span style="color:var(--accent-green); font-weight:600;">Verified Match: Link belongs to ${currentCode}!</span>`
            };
        }

        let fixBtn = '';
        if (presetUrl && presetUrl !== cleanUrl) {
            fixBtn = ` <a href="#" id="btn-fix-amauoed-url" style="color:var(--accent-blue); text-decoration:underline; margin-left:4px; font-weight:700;">Switch to ${currentCode} Link</a>`;
        }

        if (numMatches && !deptMatches) {
            return {
                status: 'mismatch',
                html: `<span style="color:var(--accent-pink); font-weight:600;">Subject Mismatch: Link is for <b>${urlCode}</b>, but you are in <b>${currentCode}</b>!</span>${fixBtn}`
            };
        }

        return {
            status: 'mismatch',
            html: `<span style="color:var(--accent-pink); font-weight:600;">Subject Mismatch: Link (${urlCode || slug.substring(0, 16)}) doesn't match <b>${currentCode || 'current course'}</b>.</span>${fixBtn}`
        };
    }

    // Storage helpers & Known AMAUOED Catalog
    const KNOWN_AMAUOED_COURSES = {
        'CS6301': 'https://amauoed.com/courses/cs/logic-design-and-digital-computer-circuits-6301-cs',
        'ITE6301': 'https://amauoed.com/courses/ite/technopreneurship-6301-ite',
        'ITE6300': 'https://amauoed.com/courses/ite/cloud-computing-and-the-internet-of-things-6300-ite',
        'ITE6200': 'https://amauoed.com/courses/ite/application-development-and-emerging-technology-6200-ite',
        'ITE6201': 'https://amauoed.com/courses/ite/data-structures-and-algorithm-analysis-6201-ite',
        'ITE6100': 'https://amauoed.com/courses/ite/introduction-to-computing-6100-ite',
        'ITE6102': 'https://amauoed.com/courses/ite/computer-programming-1-6102-ite',
        'ITE6104': 'https://amauoed.com/courses/ite/computer-programming-2-6104-ite',
        'ITE6220': 'https://amauoed.com/courses/ite/information-management-6220-ite',
        'CS6202': 'https://amauoed.com/courses/cs/algorithms-and-complexity-6202-cs',
        'CS6204': 'https://amauoed.com/courses/cs/computer-architecture-and-organization-6204-cs',
        'CS6205': 'https://amauoed.com/courses/cs/automata-theory-and-formal-language-6205-cs',
        'CS6206': 'https://amauoed.com/courses/cs/principles-of-operating-systems-and-its-applications-6206-cs',
        'CS6209': 'https://amauoed.com/courses/cs/software-engineering-1-6209-cs',
        'CS6300': 'https://amauoed.com/courses/cs/software-engineering-2-6300-cs',
        'CS6309': 'https://amauoed.com/courses/cs/introduction-to-machine-learning-6309-cs',
        'CS6326': 'https://amauoed.com/courses/cs/mobile-application-development-6326-cs',
        'MATH6100': 'https://amauoed.com/courses/math/calculus-1-6100-math',
        'GE6107': 'https://amauoed.com/courses/ge/ethics-6107-ge',
        'GE6115': 'https://amauoed.com/courses/ge/art-appreciation-6115-ge',
        'ETHNS6101': 'https://amauoed.com/courses/ethns/euthenics-1-6101-ethns',
        'ETHNS6102': 'https://amauoed.com/courses/ethns/euthenics-2-6102-ethns'
    };

    function getStoredAmauoedUrl(code) {
        if (!code) return "";
        const clean = code.toUpperCase().trim();
        const stored = localStorage.getItem(`amaes_amauoed_url_${clean}`);
        if (stored) return stored;

        if (KNOWN_AMAUOED_COURSES[clean]) {
            return KNOWN_AMAUOED_COURSES[clean];
        }

        // Check dynamic directory cache if populated
        try {
            const dir = JSON.parse(localStorage.getItem('amaes_known_amauoed_directory') || '{}');
            if (dir[clean]) return dir[clean];
        } catch (e) {}

        const num = clean.replace(/\D+/g, '');
        for (const [k, url] of Object.entries(KNOWN_AMAUOED_COURSES)) {
            if (num && k.includes(num)) {
                if (clean.includes('CS') && k.includes('CS')) return url;
                if (clean.includes('ITE') && k.includes('ITE')) return url;
            }
        }
        return "";
    }

    function setStoredAmauoedUrl(code, url) {
        localStorage.setItem(`amaes_amauoed_url_${code}`, url);
    }

    // Auto-Search & Discover AMAUOED Link from Online Directory with DOM Card Parsing & 5-Tier Matching
    async function autoFindAmauoedLink(code, courseTitle = '') {
        if (!code) {
            setLog('No subject code detected to search', 'var(--accent-pink)', 'Plan: Open a course or quiz page first');
            return null;
        }

        const cleanCode = code.toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
        const codeNum = cleanCode.replace(/\D+/g, '');
        const codeDept = cleanCode.replace(/\d+/g, '').toUpperCase();

        setLog(`Searching amauoed.com catalog for <b>${cleanCode}</b>...`, 'var(--accent-blue)', 'Plan: Discover course directory and harvest question bank');

        // Check stored or built-in first
        const direct = getStoredAmauoedUrl(cleanCode);
        if (direct) {
            setStoredAmauoedUrl(cleanCode, direct);
            setLog(`Auto-matched known link for <b>${cleanCode}</b>!`, 'var(--accent-green)', 'Plan: Ready to fetch and sync question database');
            return direct;
        }

        // Helper to match catalog entries
        function matchInCatalog(courses) {
            if (!Array.isArray(courses) || courses.length === 0) return null;

            // Tier 1: Exact code match (e.g. CS6202 matches CS-6202 or CS6202)
            const exact = courses.find(c => c.cleanCode === cleanCode || c.rawCode === cleanCode);
            if (exact) return exact.url;

            // Tier 2: Dept + Number exact match
            if (codeDept && codeNum) {
                const deptNum = courses.find(c => c.dept === codeDept && c.num === codeNum);
                if (deptNum) return deptNum.url;
            }

            // Tier 3: Dept alias match + Number match
            const ALIAS_MAP = {
                'IT': ['ITE', 'IT'],
                'ITE': ['IT', 'ITE'],
                'CS': ['COMP', 'CSC', 'CS'],
                'COMP': ['CS', 'COMP'],
                'MATH': ['MTH', 'MATH'],
                'MTH': ['MATH', 'MTH'],
                'ACTG': ['ACC', 'IA', 'ACTG'],
                'ACC': ['ACTG', 'ACC'],
                'IA': ['ACTG', 'IA'],
                'ENG': ['ENGL', 'ENG'],
                'ENGL': ['ENG', 'ENGL'],
                'PED': ['PE', 'PATHFIT', 'PED'],
                'PE': ['PED', 'PATHFIT', 'PE'],
                'PATHFIT': ['PE', 'PED', 'PATHFIT'],
                'GE': ['GEC', 'GE'],
                'GEC': ['GE', 'GEC'],
                'NSTP': ['CWTS', 'NSTP'],
                'CWTS': ['NSTP', 'CWTS']
            };
            const aliases = ALIAS_MAP[codeDept] || [codeDept];
            if (codeNum) {
                const aliasMatch = courses.find(c => aliases.includes(c.dept) && c.num === codeNum);
                if (aliasMatch) return aliasMatch.url;
            }

            // Tier 4: Unique 4-digit number match (if exactly 1 course in catalog has this number)
            if (codeNum && codeNum.length >= 3) {
                const numMatches = courses.filter(c => c.num === codeNum);
                if (numMatches.length === 1) return numMatches[0].url;
            }

            // Tier 5: Course title keyword overlap
            if (courseTitle) {
                const queryWords = courseTitle.toLowerCase()
                    .replace(/[^a-z0-9\s]/g, '')
                    .split(/\s+/)
                    .filter(w => w.length > 3 && !['college', 'university', 'education', 'online', 'bachelor', 'science'].includes(w));
                if (queryWords.length >= 2) {
                    let bestMatch = null;
                    let bestHits = 0;
                    courses.forEach(c => {
                        const titleLower = (c.title || '').toLowerCase();
                        const hits = queryWords.filter(w => titleLower.includes(w)).length;
                        if (hits > bestHits && hits >= 2) {
                            bestHits = hits;
                            bestMatch = c;
                        }
                    });
                    if (bestMatch && (bestHits >= queryWords.length * 0.5 || bestHits >= 2)) {
                        return bestMatch.url;
                    }
                }
            }

            return null;
        }

        // Check local catalog cache (valid for 24 hours)
        try {
            const rawCat = localStorage.getItem('amaes_amauoed_catalog_v2');
            if (rawCat) {
                const parsedCat = JSON.parse(rawCat);
                if (parsedCat && Array.isArray(parsedCat.courses) && (Date.now() - parsedCat.timestamp < 86400000)) {
                    const found = matchInCatalog(parsedCat.courses);
                    if (found) {
                        setStoredAmauoedUrl(cleanCode, found);
                        setLog(`Auto-matched link for <b>${cleanCode}</b> from catalog!`, 'var(--accent-green)', 'Plan: Ready to fetch and sync question database');
                        return found;
                    }
                }
            }
        } catch (e) {
            logDebug(`Catalog cache check error: ${e.message}`);
        }

        // Live crawl of amauoed.com/courses directory
        try {
            const html = await fetchAmauoedPage('https://amauoed.com/courses');
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            const parsedCourses = [];
            const linkElements = doc.querySelectorAll('a[href*="/courses/"]');
            linkElements.forEach(a => {
                let href = a.getAttribute('href') || '';
                if (!href) return;
                if (href.startsWith('/')) href = 'https://amauoed.com' + href;
                if (!href.includes('/courses/')) return;

                const card = a.closest('.card') || a.parentElement || a;
                const titleElem = card.querySelector('.card-title') || a;
                const subElem = card.querySelector('.card-subtitle');

                const title = (titleElem ? titleElem.innerText : a.innerText || '').trim();
                const subtitle = subElem ? subElem.innerText.trim() : '';

                // Extract code from subtitle (e.g. "CS-6202 - 107 answers") or slug
                let rawCode = '';
                const subMatch = subtitle.match(/([A-Za-z]+[- ]?\d{3,4})/);
                if (subMatch) {
                    rawCode = subMatch[1];
                } else {
                    const slug = href.split('/').pop() || '';
                    const slugMatch = slug.match(/([a-zA-Z]+[- ]?\d{3,4}|\d{3,4}[- ]?[a-zA-Z]+)/);
                    if (slugMatch) rawCode = slugMatch[1];
                }

                const clean = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '');
                const num = clean.replace(/\D+/g, '');
                const dept = clean.replace(/\d+/g, '').toUpperCase();

                if (href && !parsedCourses.some(c => c.url === href)) {
                    parsedCourses.push({
                        url: href,
                        title,
                        subtitle,
                        rawCode,
                        cleanCode: clean,
                        dept,
                        num
                    });
                }
            });

            // Save refreshed catalog to cache
            if (parsedCourses.length > 0) {
                localStorage.setItem('amaes_amauoed_catalog_v2', JSON.stringify({
                    timestamp: Date.now(),
                    courses: parsedCourses
                }));
            }

            const match = matchInCatalog(parsedCourses);
            if (match) {
                setStoredAmauoedUrl(cleanCode, match);
                setLog(`Found & verified link for <b>${cleanCode}</b>!`, 'var(--accent-green)', 'Plan: Saved to database. Ready to fetch.');
                return match;
            } else {
                setLog(`No exact amauoed link found for <b>${cleanCode}</b>`, 'var(--accent-amber)', 'Plan: Paste link manually or check Google');
                return null;
            }
        } catch (err) {
            console.error('AMAUOED auto-find error:', err);
            setLog(`Auto-search failed: Network error`, 'var(--accent-pink)', 'Plan: Check internet connection or enter link manually');
            return null;
        }
    }

    function getCachedAnswers(code) {
        const raw = localStorage.getItem(`amaes_amauoed_cache_${code}`);
        if (!raw) return null;
        try {
            const storedSchema = Number(localStorage.getItem(`amaes_cache_schema_${code}`) || 1);
            if (Number.isFinite(storedSchema) && storedSchema > ANSWER_DB_SCHEMA_VERSION) {
                logDebug(`Ignoring newer answer cache schema ${storedSchema} for ${code}; current schema is ${ANSWER_DB_SCHEMA_VERSION}.`);
                return null;
            }
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) {
                logDebug(`Ignoring incompatible answer cache for ${code}.`);
                return null;
            }
            const normalized = parsed
                .filter(item => item && typeof item === 'object')
                .map(item => ({
                    ...item,
                    qNorm: item.qNorm || normalizeText(item.qRaw || item.question || '')
                }))
                .filter(item => Boolean(item.qNorm));
            if (storedSchema < ANSWER_DB_SCHEMA_VERSION) {
                localStorage.setItem(`amaes_cache_schema_${code}`, String(ANSWER_DB_SCHEMA_VERSION));
            }
            return normalized;
        } catch (e) {
            logDebug(`Ignoring unreadable answer cache for ${code}.`);
            return null;
        }
    }

    function setCachedAnswers(code, questions) {
        if (!Array.isArray(questions)) {
            throw new TypeError('Answer cache must be an array');
        }
        localStorage.setItem(`amaes_amauoed_cache_${code}`, JSON.stringify(questions));
        localStorage.setItem(`amaes_cache_schema_${code}`, String(ANSWER_DB_SCHEMA_VERSION));
    }

