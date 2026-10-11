    // ==========================================
    // Jev Decision Provider (System One AI)
    // https://jevplayground.com/ | TypeSafe AI
    // ==========================================

    const JEV_DIRECT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
    const JEV_DEFAULT_MODEL = 'jev-latest';
    const JEV_DEFAULT_TIMEOUT_MS = 6000;
    const JEV_API_KEY_STORAGE_KEY = 'amaes_jev_api_key';
    const JEV_ENDPOINT_STORAGE_KEY = 'amaes_jev_endpoint';
    const JEV_ENABLED_STORAGE_KEY = 'amaes_jev_enabled';
    const JEV_MIN_CONFIDENCE_THRESHOLD = 0.70;

    function getJevApiKey() {
        try {
            if (typeof GM_getValue === 'function') {
                const val = GM_getValue(JEV_API_KEY_STORAGE_KEY, '');
                if (val) return String(val).trim();
            }
        } catch (_) {}
        return (localStorage.getItem(JEV_API_KEY_STORAGE_KEY) || '').trim();
    }

    function setJevApiKey(key) {
        const clean = (key || '').trim();
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(JEV_API_KEY_STORAGE_KEY, clean);
            }
        } catch (_) {}
        if (clean) {
            localStorage.setItem(JEV_API_KEY_STORAGE_KEY, clean);
        } else {
            localStorage.removeItem(JEV_API_KEY_STORAGE_KEY);
        }
    }

    function getJevEndpoint() {
        try {
            if (typeof GM_getValue === 'function') {
                const ep = GM_getValue(JEV_ENDPOINT_STORAGE_KEY, '');
                if (ep) return String(ep).trim();
            }
        } catch (_) {}
        const local = (localStorage.getItem(JEV_ENDPOINT_STORAGE_KEY) || '').trim();
        if (local) return local;
        // Default to direct TypeSafe API if key exists, otherwise community relay proxy
        if (getJevApiKey()) return JEV_DIRECT_ENDPOINT;
        return typeof COMMUNITY_RELAY_URL !== 'undefined'
            ? `${COMMUNITY_RELAY_URL}/ai/jev`
            : JEV_DIRECT_ENDPOINT;
    }

    function setJevEndpoint(url) {
        const clean = (url || '').trim();
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(JEV_ENDPOINT_STORAGE_KEY, clean);
            }
        } catch (_) {}
        if (clean) {
            localStorage.setItem(JEV_ENDPOINT_STORAGE_KEY, clean);
        } else {
            localStorage.removeItem(JEV_ENDPOINT_STORAGE_KEY);
        }
    }

    function isJevConfigured() {
        return Boolean(getJevApiKey() || (getJevEndpoint() && !getJevEndpoint().includes('api.typesafe.ai')));
    }

    function isJevEnabled() {
        return localStorage.getItem(JEV_ENABLED_STORAGE_KEY) === 'true';
    }

    function setJevEnabled(enabled) {
        localStorage.setItem(JEV_ENABLED_STORAGE_KEY, enabled ? 'true' : 'false');
    }

    /**
     * Formats structured TypeSafe Jev System One evaluation request payload.
     * Supported question types: 'choice', 'noul' (boolean), 'score'
     */
    function formatJevPayload({ state, questionType = 'choice', instructions = '', choices = [], criteria = null }) {
        const isBool = questionType === 'boolean' || questionType === 'noul';
        const type = isBool ? 'noul' : (questionType === 'score' ? 'score' : 'choice');

        let formattedCriteria = criteria;
        if (!formattedCriteria && !isBool && Array.isArray(choices) && choices.length > 0) {
            formattedCriteria = {};
            choices.forEach((choiceText, idx) => {
                const label = `opt_${idx}`;
                formattedCriteria[label] = String(choiceText || '').trim();
            });
        }

        const questionDef = {
            type: type,
            instructions: instructions || (isBool ? 'Is this statement true?' : 'Select the single best answer.')
        };
        if (formattedCriteria) {
            questionDef.criteria = formattedCriteria;
        }

        return {
            model: JEV_DEFAULT_MODEL,
            state: typeof state === 'string' ? state.trim() : JSON.stringify(state),
            questions: {
                decision: questionDef
            }
        };
    }

    /**
     * Low-level network executor for Jev evaluations.
     * Handles Bearer auth for direct TypeSafe calls or proxy relay headers.
     */
    function executeJevRequest({ apiKey = null, endpoint = null, payload, signal = null, timeoutMs = JEV_DEFAULT_TIMEOUT_MS }) {
        return new Promise((resolve, reject) => {
            const targetUrl = endpoint || getJevEndpoint();
            const key = apiKey !== null ? apiKey : getJevApiKey();
            const bodyStr = typeof payload === 'string' ? payload : JSON.stringify(payload);

            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            };
            if (key) {
                headers['Authorization'] = `Bearer ${key}`;
            }
            if (typeof CLIENT_VERSION !== 'undefined') {
                headers['X-AMAES-Client-Version'] = CLIENT_VERSION;
            }

            const gmReq = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                          (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

            let aborted = false;
            let timerId = null;

            if (signal) {
                if (signal.aborted) return reject(new Error('Request aborted'));
                signal.addEventListener('abort', () => {
                    aborted = true;
                    if (timerId) clearTimeout(timerId);
                    reject(new Error('Request aborted'));
                }, { once: true });
            }

            if (gmReq) {
                let reqHandle = null;
                timerId = setTimeout(() => {
                    if (!aborted) {
                        aborted = true;
                        try { reqHandle?.abort?.(); } catch (_) {}
                        reject(new Error(`Jev evaluation timed out after ${timeoutMs}ms`));
                    }
                }, timeoutMs);

                reqHandle = gmReq({
                    method: 'POST',
                    url: targetUrl,
                    headers: headers,
                    data: bodyStr,
                    timeout: timeoutMs,
                    onload: (res) => {
                        if (timerId) clearTimeout(timerId);
                        if (aborted) return;
                        if (res.status >= 200 && res.status < 300) {
                            try {
                                const parsed = JSON.parse(res.responseText);
                                resolve(parsed);
                            } catch (e) {
                                reject(new Error(`Failed to parse Jev response: ${e.message}`));
                            }
                        } else {
                            reject(new Error(`Jev request failed with HTTP ${res.status}: ${res.responseText.slice(0, 160)}`));
                        }
                    },
                    onerror: (err) => {
                        if (timerId) clearTimeout(timerId);
                        if (!aborted) reject(new Error(err?.statusText || 'Jev network error'));
                    },
                    ontimeout: () => {
                        if (timerId) clearTimeout(timerId);
                        if (!aborted) reject(new Error(`Jev evaluation timed out after ${timeoutMs}ms`));
                    }
                });
            } else {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

                fetch(targetUrl, {
                    method: 'POST',
                    headers: headers,
                    body: bodyStr,
                    signal: controller.signal
                }).then(async (res) => {
                    clearTimeout(timeoutId);
                    if (!res.ok) {
                        const errText = await res.text().catch(() => '');
                        throw new Error(`Jev request failed with HTTP ${res.status}: ${errText.slice(0, 160)}`);
                    }
                    return res.json();
                }).then(resolve).catch(reject);
            }
        });
    }

    /**
     * Parses Jev API / Vercel Gateway response into clean decision result.
     */
    function parseJevResponse(data, { questionType = 'choice', choices = [], criteria = null } = {}) {
        if (!data || typeof data !== 'object') {
            throw new Error('Empty or invalid Jev response object');
        }

        const answer = data.answers?.decision || data.answer || data;
        const isBool = questionType === 'boolean' || questionType === 'noul';

        if (isBool) {
            const rawProb = typeof answer.noul === 'number' ? answer.noul :
                            typeof answer.probability === 'number' ? answer.probability : null;
            if (rawProb === null) {
                throw new Error('Jev boolean answer missing probability/noul score');
            }
            const isTrue = rawProb >= 0.50;
            const confidence = Math.abs(rawProb - 0.50) * 2; // scale 0.5-1.0 to 0.0-1.0
            return {
                ok: true,
                type: 'boolean',
                isTrue: isTrue,
                probability: rawProb,
                confidence: Number(confidence.toFixed(3)),
                choiceText: isTrue ? 'True' : 'False',
                choiceIndex: isTrue ? 0 : 1,
                raw: answer
            };
        }

        // Choice evaluation
        const selectedKey = answer.choice || answer.selected || null;
        const probabilities = answer.probabilities || {};
        const confidence = typeof answer.confidence === 'number' ? answer.confidence : (probabilities[selectedKey] || 0.5);

        let resolvedText = '';
        let resolvedIndex = -1;

        if (criteria && selectedKey && criteria[selectedKey]) {
            resolvedText = criteria[selectedKey];
            if (Array.isArray(choices)) {
                resolvedIndex = choices.findIndex(c => normalizeChoice(c) === normalizeChoice(resolvedText));
            }
        } else if (typeof selectedKey === 'string' && selectedKey.startsWith('opt_')) {
            const idx = parseInt(selectedKey.replace('opt_', ''), 10);
            if (!isNaN(idx) && choices && choices[idx]) {
                resolvedIndex = idx;
                resolvedText = choices[idx];
            }
        } else if (selectedKey) {
            resolvedText = String(selectedKey).trim();
            if (Array.isArray(choices)) {
                resolvedIndex = choices.findIndex(c => normalizeChoice(c) === normalizeChoice(resolvedText));
            }
        }

        return {
            ok: true,
            type: 'choice',
            selectedKey: selectedKey,
            choiceText: resolvedText,
            choiceIndex: resolvedIndex,
            probability: probabilities[selectedKey] ?? confidence,
            confidence: Number(confidence.toFixed(3)),
            probabilities: probabilities,
            raw: answer
        };
    }

    /**
     * High-level solver using Jev decision model for Moodle questions.
     * Evaluates Multiple Choice, True/False, or Matching row.
     */
    async function evaluateQuestionWithJev({ que, qData, courseCode = '', signal = null }) {
        if (!que || !qData) return null;

        const isBool = Boolean(
            qData.isTrueFalse ||
            (Array.isArray(qData.choices) && qData.choices.length === 2 &&
             qData.choices.some(c => /^(true|tama)$/i.test(normalizeChoice(c))) &&
             qData.choices.some(c => /^(false|mali)$/i.test(normalizeChoice(c))))
        );

        const choices = Array.isArray(qData.choices) ? qData.choices.map(c => cleanDOMToAI(c)) : [];
        if (!isBool && choices.length < 2) return null;

        // Build state context
        const stateLines = [];
        if (courseCode) stateLines.push(`Course: ${courseCode}`);
        stateLines.push(`Question: ${qData.qText || ''}`);

        // Include confirmed eliminated choices in the state so Jev knows about past failure ground truths
        const eliminatedSet = typeof getEliminatedChoicesForQuestion === 'function'
            ? getEliminatedChoicesForQuestion(que, qData, courseCode)
            : new Set();
        const wrongList = choices.filter(c => eliminatedSet.has(normalizeChoice(c)));
        if (wrongList.length > 0) {
            stateLines.push(`Confirmed wrong choices (do NOT pick): ${wrongList.join(' | ')}`);
        }

        const criteria = {};
        choices.forEach((c, idx) => {
            criteria[`opt_${idx}`] = c;
        });

        const payload = formatJevPayload({
            state: stateLines.join('\n'),
            questionType: isBool ? 'boolean' : 'choice',
            instructions: isBool
                ? 'Evaluate whether the statement is factually true or false in the context of this course.'
                : 'Choose the single most accurate option that correctly answers the academic question.',
            choices: choices,
            criteria: isBool ? null : criteria
        });

        const rawRes = await executeJevRequest({ payload, signal });
        const result = parseJevResponse(rawRes, {
            questionType: isBool ? 'boolean' : 'choice',
            choices: choices,
            criteria: criteria
        });

        if (!result || !result.choiceText) return null;

        // Map choice back to DOM radio/checkbox input
        const choiceRows = que.querySelectorAll('.answer > div, .answer div.r0, .answer div.r1, .answer li, .answer tr, .answer label');
        let matchedInput = null;
        let matchedRow = null;

        if (result.choiceIndex >= 0 && choiceRows[result.choiceIndex]) {
            matchedRow = choiceRows[result.choiceIndex];
            matchedInput = matchedRow.querySelector('input[type="radio"], input[type="checkbox"]');
        } else {
            // Text matching fallback across rows
            for (let i = 0; i < choiceRows.length; i++) {
                const row = choiceRows[i];
                const rowText = cleanDOMToAI(row);
                if (normalizeChoice(rowText).includes(normalizeChoice(result.choiceText)) ||
                    normalizeChoice(result.choiceText).includes(normalizeChoice(rowText))) {
                    matchedRow = row;
                    matchedInput = row.querySelector('input[type="radio"], input[type="checkbox"]');
                    break;
                }
            }
        }

        return {
            provider: 'jev',
            choiceText: result.choiceText,
            choiceIndex: result.choiceIndex,
            probability: result.probability,
            confidence: result.confidence,
            isConfident: (result.confidence >= JEV_MIN_CONFIDENCE_THRESHOLD),
            input: matchedInput,
            row: matchedRow,
            raw: result.raw
        };
    }

    /**
     * Test helper for diagnostic console and setup checks
     */
    async function testJevConnection(customApiKey = null, customEndpoint = null) {
        const testPayload = formatJevPayload({
            state: 'Academic Test Context: Computer Science Fundamentals',
            questionType: 'choice',
            instructions: 'What does CPU stand for?',
            choices: ['Central Processing Unit', 'Central Program Utility', 'Computer Personal Unit']
        });

        const started = Date.now();
        const res = await executeJevRequest({
            apiKey: customApiKey,
            endpoint: customEndpoint,
            payload: testPayload,
            timeoutMs: 5000
        });
        const parsed = parseJevResponse(res, {
            questionType: 'choice',
            choices: ['Central Processing Unit', 'Central Program Utility', 'Computer Personal Unit']
        });
        const duration = Date.now() - started;

        return {
            ok: Boolean(parsed.choiceText),
            durationMs: duration,
            decision: parsed.choiceText,
            confidence: parsed.confidence,
            raw: res
        };
    }
