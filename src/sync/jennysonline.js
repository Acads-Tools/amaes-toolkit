// ==========================================
// Jenny's Online public study-guide sources
// ==========================================

const jennysonlineSessionCache = new Map();
const JENNYSONLINE_CACHE_TTL = 30 * 24 * 60 * 60 * 1000;
const JENNYSONLINE_SESSION_RECHECK_TTL = 2 * 60 * 1000;

function getJennysonlineCacheKey(code) {
    return `amaes_jennysonline_cache_v1_${code}`;
}

function readJennysonlinePersistentCache(code) {
    try {
        const raw = localStorage.getItem(getJennysonlineCacheKey(code));
        if (!raw) return null;
        const cached = JSON.parse(raw);
        if (!cached || !Number.isFinite(cached.savedAt) || Date.now() - cached.savedAt < 0 ||
            Date.now() - cached.savedAt >= JENNYSONLINE_CACHE_TTL ||
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

function writeJennysonlinePersistentCache(code, answers, savedAt = Date.now()) {
    try {
        localStorage.setItem(getJennysonlineCacheKey(code), JSON.stringify({
            savedAt,
            answers
        }));
    } catch (error) {
        if (typeof logDebug === 'function') logDebug(`Jenny's Online local cache write note: ${error.message}`);
    }
}

function queueStudyGuideRefresh(code) {
    try {
        const key = `amaes_study_guide_refresh_request_v1_${code}`;
        const requestedAt = Number(localStorage.getItem(key) || 0);
        if (Date.now() - requestedAt < 15 * 60 * 1000) return;
        localStorage.setItem(key, String(Date.now()));
        fetch(`${communityRelayUrl}/study-guides/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-AMAES-Installation': getAnonymousContributorId(),
                'X-AMAES-Client-Version': CLIENT_VERSION
            },
            body: JSON.stringify({ subjectCode: code })
        }).then(async response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const result = await response.json();
            logDebug(`Shared study-guide refresh for ${code}: ${result.queued ? 'queued' : 'not queued'}`);
        }).catch(error => {
            localStorage.removeItem(key);
            logDebug(`Shared study-guide refresh queue note for ${code}: ${error.message}`);
        });
    } catch (error) {
        logDebug(`Shared study-guide refresh queue note for ${code}: ${error.message}`);
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

async function loadJennysonlineAnswersForCourse(subjectCode) {
    const code = String(subjectCode || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || code === 'GENERAL' || code === 'DEFAULT') return [];
    const sessionEntry = jennysonlineSessionCache.get(code);
    if (sessionEntry) {
        if (typeof sessionEntry.then === 'function') return sessionEntry;
        if (sessionEntry.expiresAt > Date.now()) return sessionEntry.answers;
        jennysonlineSessionCache.delete(code);
    }
    const cachedAnswers = readJennysonlinePersistentCache(code);

    const loading = (async () => {
        let staleSharedAnswers = [];
        try {
            const registryUrl = `${CLOUD_DB_JENNYSONLINE_URL}${code}.json`;
            const registry = JSON.parse(await fetchJennysonlineText(registryUrl));
            if (registry.subjectCode !== code || registry.verified !== false) {
                throw new Error(`Invalid or unverified Jenny's Online snapshot for ${code}`);
            }
            const sharedAnswers = parseJennysonlineSharedSnapshot(registry);
            if (sharedAnswers.length > 0) {
                staleSharedAnswers = sharedAnswers;
                const updatedAt = Date.parse(registry.refreshedAt || registry.updatedAt || '');
                const age = Date.now() - updatedAt;
                if (Number.isFinite(updatedAt) && age >= 0 && age < JENNYSONLINE_CACHE_TTL) {
                    writeJennysonlinePersistentCache(code, sharedAnswers, updatedAt);
                    return {
                        answers: sharedAnswers,
                        expiresAt: updatedAt + JENNYSONLINE_CACHE_TTL
                    };
                }
            }
        } catch (error) {
            if (!/HTTP 404/.test(error.message)) {
                logDebug(`Jenny's Online shared snapshot note for ${code}: ${error.message}`);
            }
        }

        queueStudyGuideRefresh(code);
        const fallbackAnswers = staleSharedAnswers.length > 0
            ? staleSharedAnswers
            : cachedAnswers || [];
        return {
            answers: fallbackAnswers,
            expiresAt: Date.now() + JENNYSONLINE_SESSION_RECHECK_TTL
        };
    })();

    const pending = loading.then(result => {
        jennysonlineSessionCache.set(code, result);
        return result.answers;
    }).catch(error => {
        jennysonlineSessionCache.delete(code);
        throw error;
    });
    jennysonlineSessionCache.set(code, pending);
    return pending;
}
