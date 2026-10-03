// ==========================================
// Jenny's Online public study-guide sources
// ==========================================

const jennysonlineSessionCache = new Map();
const JENNYSONLINE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;

function getJennysonlineCacheKey(code) {
    return `amaes_jennysonline_cache_v1_${code}`;
}

function readJennysonlinePersistentCache(code) {
    try {
        const raw = localStorage.getItem(getJennysonlineCacheKey(code));
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (!cached || !Number.isFinite(cached.savedAt) || Date.now() - cached.savedAt >= JENNYSONLINE_CACHE_TTL ||
            !Array.isArray(cached.answers) || cached.answers.length > 5000 ||
            cached.answers.some(answer => !answer || answer.verified !== false ||
                answer.source !== 'jennysonline' || answer.evidenceType !== 'study_guide_candidate')) {
            localStorage.removeItem(getJennysonlineCacheKey(code));
            return null;
        }
        return cached.answers;
    } catch (error) {
        if (typeof logDebug === 'function') logDebug(`Jenny's Online local cache read note: ${error.message}`);
        return null;
    }
}

function writeJennysonlinePersistentCache(code, answers) {
    try {
        localStorage.setItem(getJennysonlineCacheKey(code), JSON.stringify({
            savedAt: Date.now(),
            answers
        }));
    } catch (error) {
        if (typeof logDebug === 'function') logDebug(`Jenny's Online local cache write note: ${error.message}`);
    }
}

function fetchJennysonlineText(url) {
    return new Promise((resolve, reject) => {
        const gmReq = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
            (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;
        if (!gmReq) {
            fetch(url).then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                return response.text();
            }).then(resolve).catch(reject);
            return;
        }
        gmReq({
            method: 'GET',
            url,
            onload: response => {
                if (response.status >= 200 && response.status < 300) {
                    resolve(response.responseText);
                } else {
                    reject(new Error(`HTTP ${response.status}: ${response.statusText || 'Request failed'}`));
                }
            },
            onerror: () => reject(new Error(`Network error fetching ${new URL(url).hostname}`))
        });
    });
}

function parseJennysonlineCsv(csv, sourceUrl) {
    const rows = [];
    let row = [];
    let cell = '';
    let quoted = false;

    for (let i = 0; i < csv.length; i++) {
        const char = csv[i];
        if (quoted) {
            if (char === '"' && csv[i + 1] === '"') {
                cell += '"';
                i++;
            } else if (char === '"') {
                quoted = false;
            } else {
                cell += char;
            }
        } else if (char === '"') {
            quoted = true;
        } else if (char === ',') {
            row.push(cell);
            cell = '';
        } else if (char === '\n' || char === '\r') {
            if (char === '\r' && csv[i + 1] === '\n') i++;
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
        } else {
            cell += char;
        }
    }
    if (cell || row.length > 0) {
        row.push(cell);
        rows.push(row);
    }

    const answers = [];
    const seen = new Set();
    rows.forEach(cells => {
        if (cells.length < 2) return;
        const answer = String(cells[0] || '').replace(/\s+/g, ' ').trim();
        const question = String(cells[1] || '').replace(/\s+/g, ' ').trim();
        if (!answer || !question || /^(?:answer|correct answer)$/i.test(answer) || /^(?:question|prompt)$/i.test(question)) return;
        const qNorm = normalizeText(question);
        const ansNorm = normalizeChoice(answer);
        if (!qNorm || !ansNorm) return;
        const identity = `${qNorm}::${ansNorm}`;
        if (seen.has(identity)) return;
        seen.add(identity);
        answers.push({
            qRaw: question,
            qNorm,
            ansRaw: answer,
            ansNorm,
            choices: [],
            verified: false,
            confirmations: 1,
            source: 'jennysonline',
            evidenceType: 'study_guide_candidate',
            sourceUrl
        });
    });
    return answers;
}

function getJennysonlineEntryUrl(entry) {
    const alternate = (entry && Array.isArray(entry.link) ? entry.link : [])
        .find(link => link && link.rel === 'alternate' && link.href);
    if (!alternate) return '';
    try {
        const url = new URL(alternate.href);
        return url.protocol === 'https:' && url.hostname === 'jennysonline.blogspot.com' ? url.href : '';
    } catch (_) {
        return '';
    }
}

function selectJennysonlineCourseEntries(feed, subjectCode, courseTitle) {
    const entries = feed && feed.feed && Array.isArray(feed.feed.entry) ? feed.feed.entry : [];
    const code = String(subjectCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const title = String(courseTitle || '').replace(/\b[A-Z]{2,6}\d{3,4}[A-Z]*\b/ig, ' ').toLowerCase();
    const titleTokens = title.match(/[a-z]{3,}|\d+/g) || [];
    const stopWords = new Set(['and', 'the', 'for', 'with', 'from', 'course']);
    const requiredTokens = titleTokens.filter(token => !stopWords.has(token));

    return entries.map((entry, index) => {
        const entryTitle = String(entry && entry.title && entry.title.$t || '');
        const content = String(entry && entry.content && entry.content.$t || '');
        const haystack = `${entryTitle} ${content}`.toUpperCase();
        const exactCodeMatch = Boolean(code && haystack.replace(/[^A-Z0-9]/g, '').includes(code));
        const titleCodeMatch = Boolean(code && entryTitle.toUpperCase().replace(/[^A-Z0-9]/g, '').includes(code));
        const titleTokensInEntry = new Set(entryTitle.toLowerCase().match(/[a-z]{3,}|\d+/g) || []);
        if (!exactCodeMatch && requiredTokens.length === 0) return null;
        if (!exactCodeMatch && requiredTokens.some(token => /^\d+$/.test(token) && !titleTokensInEntry.has(token))) return null;
        const overlap = requiredTokens.filter(token => titleTokensInEntry.has(token)).length;
        const titleScore = requiredTokens.length ? overlap / requiredTokens.length : 0;
        if (requiredTokens.length > 0 && !titleCodeMatch &&
            (requiredTokens.some(token => /^\d+$/.test(token) && !titleTokensInEntry.has(token)) || titleScore < 0.8)) return null;
        const score = titleCodeMatch ? 2 : (titleScore || (exactCodeMatch ? 1 : 0));
        if (!titleCodeMatch && !exactCodeMatch && score < 0.8) return null;
        const url = getJennysonlineEntryUrl(entry);
        return url ? { url, score, index } : null;
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.index - b.index)
        .filter((candidate, index, matches) => {
            if (index === 0 || candidate.score === 2) return true;
            return matches[0].score - candidate.score < 0.15;
        })
        .map(candidate => candidate.url);
}

async function fetchJennysonlineSheetAnswers(pageUrl) {
    const pageHtml = await fetchJennysonlineText(pageUrl);
    const page = new DOMParser().parseFromString(pageHtml, 'text/html');
    const sheetFrame = Array.from(page.querySelectorAll('iframe[src]')).find(frame => {
        try {
            const url = new URL(frame.src, pageUrl);
            return url.hostname === 'docs.google.com' && /\/spreadsheets\/d\/e\/[^/]+\/pubhtml$/.test(url.pathname);
        } catch (_) {
            return false;
        }
    });
    if (!sheetFrame) return [];

    const csvUrl = new URL(sheetFrame.src, pageUrl);
    if (csvUrl.protocol !== 'https:' || csvUrl.hostname !== 'docs.google.com' || csvUrl.username || csvUrl.password) {
        throw new Error('Unapproved public spreadsheet URL');
    }
    csvUrl.pathname = csvUrl.pathname.replace(/\/pubhtml$/, '/pub');
    csvUrl.search = '?output=csv';
    const csv = await fetchJennysonlineText(csvUrl.href);
    return parseJennysonlineCsv(csv, pageUrl);
}

async function searchJennysonlineForCourse(subjectCode, courseTitle) {
    const code = String(subjectCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const queries = Array.from(new Set([code, String(courseTitle || '').trim()].filter(Boolean)));
    const candidateUrls = [];
    for (const query of queries) {
        const feedUrl = new URL('https://jennysonline.blogspot.com/feeds/posts/default');
        feedUrl.searchParams.set('q', query);
        feedUrl.searchParams.set('alt', 'json');
        feedUrl.searchParams.set('max-results', '100');
        const feed = JSON.parse(await fetchJennysonlineText(feedUrl.href));
        selectJennysonlineCourseEntries(feed, code, courseTitle).forEach(url => {
            if (!candidateUrls.includes(url)) candidateUrls.push(url);
        });
    }

    for (const pageUrl of candidateUrls.slice(0, 5)) {
        const answers = await fetchJennysonlineSheetAnswers(pageUrl);
        if (answers.length > 0) return answers;
    }

    return [];
}

function parseJennysonlineSharedSnapshot(registry) {
    if (!Array.isArray(registry.questions) || registry.questions.length === 0) return [];
    return registry.questions
        .filter(question => question && question.verified === false)
        .map(question => {
            const qRaw = question.question || question.qRaw || '';
            const ansRaw = question.answer || question.ansRaw || '';
            return {
                qRaw,
                qNorm: normalizeText(qRaw),
                ansRaw,
                ansNorm: normalizeChoice(ansRaw),
                answers: Array.isArray(question.answers) ? question.answers : undefined,
                choices: Array.isArray(question.choices) ? question.choices : [],
                verified: false,
                confirmations: 1,
                source: 'jennysonline',
                evidenceType: 'study_guide_candidate',
                sourceUrl: question.sourceUrl || registry.sourceUrl
            };
        })
        .filter(question => question.qNorm && question.ansNorm);
}

async function loadJennysonlineAnswersForCourse(subjectCode, courseTitle = '') {
    const code = String(subjectCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || code === 'GENERAL' || code === 'DEFAULT') return [];
    if (jennysonlineSessionCache.has(code)) return jennysonlineSessionCache.get(code);
    const cachedAnswers = readJennysonlinePersistentCache(code);

    const loading = (async () => {
        try {
            let matchedTitle = String(courseTitle || '').trim();
            if (!matchedTitle && typeof detectCourseInfo === 'function') {
                const info = detectCourseInfo();
                if (String(info.subjectCode || '').toUpperCase() === code) matchedTitle = info.subjectName || '';
            }

            let registeredUrl = '';
            try {
                const registryUrl = `${CLOUD_DB_JENNYSONLINE_URL}${code}.json`;
                const registry = JSON.parse(await fetchJennysonlineText(registryUrl));
                if (registry.subjectCode !== code || registry.verified !== false) {
                    throw new Error(`Invalid or unverified Jenny's Online registry for ${code}`);
                }
                if (Array.isArray(registry.questions) && registry.questions.length > 0) {
                    const sharedAnswers = parseJennysonlineSharedSnapshot(registry);
                    if (sharedAnswers.length > 0) return sharedAnswers;
                    throw new Error(`Jenny's Online snapshot for ${code} contains no valid unconfirmed rows`);
                }
                registeredUrl = registry.sourceUrl;
            } catch (error) {
                if (!/HTTP 404/.test(error.message)) {
                    throw new Error(`Could not load Jenny's Online registry for ${code}: ${error.message}`);
                }
            }

            if (registeredUrl) {
                let pageUrl;
                try {
                    pageUrl = new URL(registeredUrl);
                } catch (_) {
                    throw new Error(`Invalid Jenny's Online source URL registered for ${code}`);
                }
                if (pageUrl.protocol !== 'https:' || pageUrl.hostname !== 'jennysonline.blogspot.com' || pageUrl.port || pageUrl.username || pageUrl.password) {
                    throw new Error(`Unapproved Jenny's Online source host for ${code}`);
                }
                const registeredAnswers = await fetchJennysonlineSheetAnswers(pageUrl.href);
                if (registeredAnswers.length > 0) return registeredAnswers;
            }

            const liveAnswers = await searchJennysonlineForCourse(code, matchedTitle);
            return liveAnswers.length > 0 ? liveAnswers : (cachedAnswers || []);
        } catch (error) {
            if (cachedAnswers) return cachedAnswers;
            throw error;
        }
    })();

    jennysonlineSessionCache.set(code, loading);
    try {
        const answers = await loading;
        jennysonlineSessionCache.set(code, answers);
        writeJennysonlinePersistentCache(code, answers);
        return answers;
    } catch (error) {
        jennysonlineSessionCache.delete(code);
        throw error;
    }
}
