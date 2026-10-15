    // ==========================================
    // Google Gemini AI Assistant (Experimental)
    // ==========================================


    /**
     * Feature 4: Moodle Database Error / Empty Question Guard
     * Returns true if the question appears to have failed to load from the Moodle database
     * (e.g. empty formulation text, or page shows database error indicators).
     */
    function detectMoodleServerError(que) {
        if (!que) return false;
        const formulation = que.querySelector('.formulation');
        const qText = formulation ? (formulation.innerText || '').trim() : '';
        if (qText.length < 5) return true;
        const pageText = document.body ? (document.body.innerText || '').toLowerCase() : '';
        if (pageText.includes('error reading from database') || pageText.includes('a database error has occurred')) return true;
        return false;
    }

    function getGeminiApiKey() {
        const keys = getGeminiApiKeys();
        return keys.length > 0 ? keys[0] : (toolkitStorage.get(GEMINI_API_KEY_STORAGE_KEY) || geminiApiKey || '');
    }

    function setGeminiApiKey(key) {
        const trimmed = (key || '').trim();
        if (trimmed) {
            setGeminiApiKeys([trimmed]);
        } else {
            setGeminiApiKeys([]);
        }
    }

    function isGeminiConfigured() {
        return getGeminiApiKeys().length > 0;
    }

    function updateAiAssistantUI() {
        const keys = getGeminiApiKeys();
        const isGeminiSet = keys.length > 0;
        const isJevSet = typeof isJevConfigured === 'function' && isJevConfigured() && isJevEnabled();
        const isConfigured = isGeminiSet || isJevSet;

        const badge = document.getElementById('gemini-status-badge');
        if (badge) {
            const activeModel = cachedWorkingEndpoint ? cachedWorkingEndpoint.model : 'Gemini Flash';
            badge.style.color = isConfigured ? 'var(--accent-green)' : 'var(--text-muted)';
            if (isGeminiSet && isJevSet) {
                badge.innerHTML = `Ready (${activeModel} + Jev)`;
            } else if (isJevSet) {
                badge.innerHTML = `Ready (TypeSafe Jev)`;
            } else if (isGeminiSet) {
                badge.innerHTML = keys.length > 1
                    ? `Ready (${keys.length} keys)`
                    : `Ready (${activeModel})`;
            } else {
                badge.innerHTML = '● Not Configured';
            }
        }

        const setupBtn = document.getElementById('btn-open-gemini-setup');
        if (setupBtn) {
            setupBtn.innerHTML = `<span>${isConfigured ? 'Configure AI keys' : 'Setup Free AI Assistant'}</span>`;
        }

        const quizAiPill = document.getElementById('amaes-ai-quiz-status-pill');
        if (quizAiPill) {
            quizAiPill.textContent = isConfigured ? 'Active' : 'Not Set';
            quizAiPill.style.color = isConfigured ? '#34d399' : 'var(--text-muted)';
            quizAiPill.style.background = isConfigured ? 'rgba(52, 211, 153, 0.1)' : 'rgba(255, 255, 255, 0.05)';
            quizAiPill.style.borderColor = isConfigured ? 'rgba(52, 211, 153, 0.3)' : 'rgba(255, 255, 255, 0.15)';
        }

        const quizConfigBtn = document.getElementById('btn-quiz-config-ai');
        if (quizConfigBtn) {
            quizConfigBtn.innerHTML = `${ICONS.gear} <span>${isConfigured ? (keys.length > 1 ? `Configure AI Keys (${keys.length})` : 'Configure AI Key') : 'Setup Free AI Key'}</span>`;
        }
    }

    function getMatchingAiRows(que) {
        if (!que) return [];
        return Array.from(que.querySelectorAll('.answer table tr, .answer tr, .answer .r0, .answer .r1, .answer [class*="r"], .answer > div, .answer li'))
            .map(row => {
                const promptCell = row.querySelector('td.text, td:first-child, .text, [class*="text"]');
                const select = row.querySelector('td.control select, select');
                const prompt = promptCell ? cleanDOMToAI(promptCell).trim() : '';
                return prompt && select ? { row, select, prompt } : null;
            })
            .filter(Boolean);
    }

    function parseMatchingAiResponse(answerText, matchingRows) {
        if (!answerText || !Array.isArray(matchingRows) || matchingRows.length === 0) return [];
        const byIndex = new Map();
        const ambiguousIndexes = new Set();
        const lines = answerText
            .replace(/```(?:text|json)?/gi, '')
            .split(/\r?\n/)
            .map(line => line.replace(/^\s*(?:[-*]|\d+[.)])\s*/, '').replace(/\*\*/g, '').trim())
            .filter(Boolean);

        lines.forEach(line => {
            const match = line.match(/^(?:row\s*)?(\d+)\s*[:.)-]\s*(.+)$/i);
            if (!match) return;
            const rowIndex = Number(match[1]) - 1;
            if (!Number.isInteger(rowIndex) || rowIndex < 0 || rowIndex >= matchingRows.length) return;
            const target = match[2].trim().replace(/^["']|["']$/g, '');
            const matchingRow = matchingRows[rowIndex];
            const options = Array.from(matchingRow.select.options || []);
            const option = options.find(candidate =>
                candidate.value && candidate.value !== '0' &&
                !candidate.text.toLowerCase().includes('choose') &&
                normalizeChoice(candidate.text) === normalizeChoice(target)
            );
            if (!option) return;

            let wrongAnswers = [];
            try {
                wrongAnswers = JSON.parse(matchingRow.select.dataset.amaesKnownWrongAnswers || '[]');
            } catch (error) {
                console.warn('Could not read matching-row AI answer evidence:', error);
                return;
            }
            const optionNorm = normalizeChoice(option.text);
            if (wrongAnswers.some(wrong =>
                wrong && (wrong.norm === optionNorm || normalizeChoice(wrong.text || wrong.answer || '') === optionNorm)
            )) return;

            const previous = byIndex.get(rowIndex);
            if (previous && previous.option.value !== option.value) {
                ambiguousIndexes.add(rowIndex);
                byIndex.delete(rowIndex);
                return;
            }
            if (!ambiguousIndexes.has(rowIndex)) byIndex.set(rowIndex, { ...matchingRow, option, rowIndex });
        });
        return Array.from(byIndex.values()).sort((left, right) => left.rowIndex - right.rowIndex);
    }

    function applyMatchingRowAiSuggestion(row, select, option, autoApply = false) {
        if (!row || !select || !option) return;
        row.querySelectorAll('.amaes-ai-matching-suggestion').forEach(el => el.remove());
        const badge = document.createElement('div');
        badge.className = 'amaes-ai-matching-suggestion';
        badge.setAttribute('role', 'status');
        badge.style.cssText = 'display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin: 4px 0; color: #7e22ce; font-size: 11px; font-weight: 700;';
        const label = document.createElement('span');
        label.textContent = `AI suggestion (unverified): ${option.text.trim()}`;
        const useButton = document.createElement('button');
        useButton.type = 'button';
        useButton.textContent = autoApply ? 'Selected' : 'Use suggestion';
        useButton.disabled = autoApply;
        useButton.style.cssText = 'padding: 2px 7px; border: 1px solid #c084fc; border-radius: 4px; background: #faf5ff; color: #7e22ce; font-size: 10px; font-weight: 700; cursor: pointer;';

        const applyOption = () => {
            select.value = option.value;
            select.dispatchEvent(new Event('input', { bubbles: true }));
            select.dispatchEvent(new Event('change', { bubbles: true }));
            select.dispatchEvent(new Event('blur', { bubbles: true }));
            select.style.outline = '2px solid #a855f7';
            select.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
            useButton.textContent = 'Selected';
            useButton.disabled = true;
        };

        useButton.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            applyOption();
        });

        if (autoApply) {
            applyOption();
        }

        badge.append(label, useButton);
        select.insertAdjacentElement('afterend', badge);
    }

    async function solveMatchingRowWithAi({ que, row, selectInput, subQText, autoApply = false }) {
        if (!selectInput || !subQText) return null;
        const options = Array.from(selectInput.options || []).filter(option =>
            option.value && option.value !== '0' && !option.text.toLowerCase().includes('choose')
        );
        if (options.length === 0) return null;

        const sessionCacheKey = `amaes_ai_match_${normalizeText(subQText)}`;
        const cachedAns = sessionStorage.getItem(sessionCacheKey);
        if (cachedAns) {
            const cachedOpt = options.find(o => normalizeChoice(o.text) === normalizeChoice(cachedAns));
            if (cachedOpt) {
                applyMatchingRowAiSuggestion(row, selectInput, cachedOpt, autoApply);
                return cachedOpt;
            }
        }

        const courseInfo = detectCourseInfo();
        const courseCode = courseInfo.subjectCode || '';
        const lines = [];
        if (courseCode) lines.push(`[Course: ${courseCode}]`);
        lines.push(`Question: ${subQText}`);
        lines.push(`Options: ${options.map(o => o.text.trim()).join(' | ')}`);
        lines.push(`Reply with ONLY the exact option text from the list above that best answers the question. No explanation.`);
        const prompt = lines.join('\n');

        const apiKey = getAvailableGeminiKey();
        if (!apiKey && !isSharedAiFallbackEnabled()) {
            showToast("Gemini AI is not configured. Please set your free Google AI Studio key.", 3500);
            return null;
        }

        try {
            let resText = null;
            if (apiKey) {
                const res = await callGeminiAPI(prompt, 64);
                resText = res ? res.text : null;
            } else {
                const sharedResult = await callSharedAiFallback({ prompt, maxOutputTokens: 64 });
                resText = sharedResult ? (sharedResult.text || sharedResult.answer) : null;
            }
            if (!resText) return null;

            const cleanAns = resText.replace(/```(?:text|json)?/gi, '').replace(/^answer:\s*/i, '').replace(/^['"]|['"]$/g, '').trim();
            const cleanNorm = normalizeChoice(cleanAns);
            let matchedOpt = options.find(o => normalizeChoice(o.text) === cleanNorm);
            if (!matchedOpt) {
                matchedOpt = options.find(o => {
                    const oNorm = normalizeChoice(o.text);
                    return (oNorm.length > 2 && cleanNorm.includes(oNorm)) || (cleanNorm.length > 2 && oNorm.includes(cleanNorm));
                });
            }

            if (matchedOpt) {
                sessionStorage.setItem(sessionCacheKey, matchedOpt.text.trim());
                applyMatchingRowAiSuggestion(row, selectInput, matchedOpt, autoApply);
                return matchedOpt;
            }
        } catch (err) {
            logDebug(`Single-row matching AI error: ${err.message}`);
        }
        return null;
    }

    // Ultra-Compact Prompt Builder: 0 fluff, max token efficiency (~60-120 tokens total)
    function buildGeminiCompactPrompt(qData, courseCode = '', que = null) {
        const lines = [];
        if (courseCode) {
            lines.push(`[Course: ${courseCode}]`);
        }
        lines.push(`Question: ${qData.qText || ''}`);

        if (qData.questionType === 'match' && Array.isArray(qData.matchPairs) && qData.matchPairs.length > 0) {
            const matchingRows = getMatchingAiRows(que);
            lines.push('[Matching rows: choose one listed option for each row]');
            matchingRows.forEach((matchingRow, index) => {
                const options = Array.from(matchingRow.select.options || [])
                    .filter(option => option.value && option.value !== '0' && !option.text.toLowerCase().includes('choose'))
                    .map(option => option.text.trim());
                lines.push(`Row ${index + 1}: ${matchingRow.prompt}`);
                lines.push(`Options: ${options.join(' | ')}`);
                try {
                    const wrongAnswers = JSON.parse(matchingRow.select.dataset.amaesKnownWrongAnswers || '[]');
                    const wrongTexts = wrongAnswers.filter(item => item && item.text).map(item => item.text);
                    if (wrongTexts.length > 0) {
                        lines.push(`Confirmed wrong for this row; do not use: ${wrongTexts.join(' | ')}`);
                    }
                } catch (error) {
                    console.warn('Could not read matching-row AI prompt evidence:', error);
                }
            });
            lines.push('Reply with one line per row in exactly this format: Row 1: exact option text. Use each row number and an exact option from that row. Do not add explanations.');
            return lines.join('\n');
        }

        // Handle Gapselect / Inline Dropdowns
        if (qData.isGapSelect || (que && que.querySelectorAll('select').length > 0 && (!qData.choices || qData.choices.length === 0))) {
            const selects = que ? Array.from(que.querySelectorAll('select')) : [];
            lines.push(`[Dropdown Pick / Fill Blank]`);
            if (selects.length > 0) {
                selects.forEach((sel, idx) => {
                    const options = Array.from(sel.querySelectorAll('option'))
                        .map(o => (o.innerText || o.textContent || '').trim())
                        .filter(o => o && !o.toLowerCase().includes('choose'));
                    if (options.length > 0) {
                        lines.push(`Dropdown ${idx + 1} options: ${options.join(', ')}`);
                    }
                });
            } else if (qData.gapSelectOptions && qData.gapSelectOptions.length > 0) {
                qData.gapSelectOptions.forEach(g => {
                    lines.push(`Dropdown ${g.index} options: ${g.options.join(', ')}`);
                });
            }
            if (selects.length <= 1) {
                lines.push(`Reply with ONLY the exact option text that completes the statement. No explanation.`);
            } else {
                lines.push(`Reply with the exact option text for each dropdown (e.g. "Dropdown 1: OptionText, Dropdown 2: OptionText"). No explanation.`);
            }
            return lines.join('\n');
        }

        // Handle Short Answer / Fill-in-the-Blank text inputs
        if (qData.isShortAnswer || (!qData.choices || qData.choices.length === 0)) {
            lines.push(`[Fill-in-the-Blank / Short Answer]`);

            // Include confirmed wrong answers so AI won't re-suggest them
            const shortEliminatedSet = getEliminatedChoicesForQuestion(que, qData, courseCode);
            if (shortEliminatedSet && shortEliminatedSet.size > 0) {
                const wrongList = Array.from(shortEliminatedSet).join('", "');
                lines.push(`[CONFIRMED WRONG - DO NOT USE THESE]: "${wrongList}"`);
                lines.push(`CRITICAL: Do NOT suggest any answer in the list above. They have been tested and confirmed incorrect.`);
            }

            // Include verified answer hint from DB if available and not eliminated
            if (que) {
                const courseInfoSA = detectCourseInfo();
                const subCodeSA = courseInfoSA.subjectCode || courseCode || 'GENERAL';
                const cachedSA = getCachedAnswers(subCodeSA);
                if (cachedSA && cachedSA.length > 0) {
                    const mQNorm = normalizeText(qData.qText || '');
                    const candsSA = cachedSA.filter(c => questionTextMatches(c.qNorm || c.qRaw || c.question, mQNorm));
                    const verifiedSA = candsSA.filter(c => {
                        if (c.isAiSuggestion) return false;
                        const src = (c.source || '').toLowerCase();
                        if (src.includes('gemini') || src.includes('ai assistant')) return false;
                        const ansN = c.ansNorm || normalizeChoice(c.ansRaw || c.answer || '');
                        if (!ansN) return false;
                        // Only suggest if not in confirmed wrong list
                        return !shortEliminatedSet.has(ansN) && !shortEliminatedSet.has(unscriptDigits(ansN));
                    });
                    if (verifiedSA.length > 0) {
                        verifiedSA.sort((a, b) => ((b.verified ? 10 : 0) + (b.confirmations || 1)) - ((a.verified ? 10 : 0) + (a.confirmations || 1)));
                        const bestSA = verifiedSA[0];
                        const hintAns = bestSA.ansRaw || bestSA.answer;
                        if (hintAns) {
                            lines.push(`[DATABASE HINT: Strong evidence suggests the answer is "${hintAns}" — verify this is correct before accepting]`);
                        }
                    }
                }
            }

            lines.push(`Reply with ONLY the exact, concise word or phrase (typically 1 to 3 words) that directly answers the question or fills the blank. No explanation. No quotes.`);
            return lines.join('\n');
        }

        lines.push(`Choices:`);

        const eliminatedSet = getEliminatedChoicesForQuestion(que, qData, courseCode);
        const unreviewed = typeof getUnreviewedAttemptEntry === 'function' ? getUnreviewedAttemptEntry(qData.qText, courseCode) : null;
        if (unreviewed && unreviewed.selectedAnswer) {
            lines.push(`[PREVIOUS UNREVIEWED ATTEMPT]: In a prior attempt that scored only ${unreviewed.percentage}%, "${unreviewed.selectedAnswer}" was chosen. Because that attempt had errors and review was not permitted, that answer might be INCORRECT. Re-evaluate all options critically and choose the best alternative if "${unreviewed.selectedAnswer}" is questionable.`);
        }

        if (Array.isArray(qData.choices)) {
            qData.choices.forEach((c, idx) => {
                const normC = normalizeChoice(c);
                let isElim = false;
                if (eliminatedSet.has(normC) || eliminatedSet.has(unscriptDigits(normC))) {
                    isElim = true;
                } else if (que) {
                    const choiceRows = que.querySelectorAll('.answer > div, .answer div.r0, .answer div.r1, .answer li, .answer tr, .answer label');
                    if (choiceRows.length > idx && isChoiceRowEliminated(choiceRows[idx])) {
                        isElim = true;
                    }
                }
                if (isElim) {
                    lines.push(`${c} [CONFIRMED WRONG - DO NOT SELECT]`);
                } else {
                    lines.push(c);
                }
            });
        }
        lines.push(``);
        lines.push(`Reply with ONLY the correct option letter and exact text (e.g., "b. ROM"). Do NOT choose options marked [CONFIRMED WRONG - DO NOT SELECT]. No explanations.`);
        return lines.join('\n');
    }

    // Question Type Eligibility Guard: ONLY Multiple Choice & True/False are eligible for auto-AI
    function isEligibleForAiSolver(que, qData) {
        if (!que || !qData) return false;
        // Drag and drop questions MUST fall back to manual copy
        if (qData.isDragDrop) return false;
        if (que.classList.contains('ddwtos') || que.classList.contains('ddimageortext') || que.classList.contains('ddmarker')) return false;
        if (que.querySelectorAll('.draghome, .drop, .dropzone, span.droptarget, .droppable').length > 0) return false;

        // Text inputs / Essay questions MUST fall back to manual copy
        if (qData.isShortAnswer || qData.isEssay) return false;
        if (que.querySelectorAll('input[type="text"]:not([type="hidden"]), textarea').length > 0) return false;

        if (qData.questionType === 'match') {
            const matchingRows = getMatchingAiRows(que);
            return Array.isArray(qData.matchPairs) && matchingRows.length > 0 &&
                matchingRows.length === qData.matchPairs.length &&
                matchingRows.every(item => Array.from(item.select.options || []).filter(option =>
                    option.value && option.value !== '0' && !option.text.toLowerCase().includes('choose')
                ).length >= 2);
        }

        // Gapselect, essay, and unsupported dropdown questions stay on the manual-copy path.
        if (que.querySelectorAll('select').length > 0) return false;
        if (qData.matchPairs && qData.matchPairs.length > 0) return false;

        // Must have at least 2 choices
        if (!Array.isArray(qData.choices) || qData.choices.length < 2) return false;

        // Must have radio or checkbox inputs
        const choiceInputs = que.querySelectorAll('.answer input[type="radio"], .answer input[type="checkbox"]');
        if (choiceInputs.length === 0) return false;

        return true;
    }

    // Multi-Model Fallback Registry: Google AI Studio accounts support different versions and models
    const GEMINI_CANDIDATES = [
        { version: 'v1beta', model: 'gemini-2.5-flash' },
        { version: 'v1beta', model: 'gemini-2.0-flash' },
        { version: 'v1', model: 'gemini-2.0-flash' },
        { version: 'v1beta', model: 'gemini-2.5-flash-lite' },
        { version: 'v1beta', model: 'gemini-1.5-flash' },
        { version: 'v1', model: 'gemini-1.5-flash' }
    ];

    let cachedWorkingEndpoint = null;
    try {
        const savedEp = localStorage.getItem('amaes_gemini_working_endpoint');
        if (savedEp) cachedWorkingEndpoint = JSON.parse(savedEp);
    } catch (_) {}

    // Low-level request executor for a specific candidate version and model
    function executeGeminiRequest({ apiKey, prompt, maxOutputTokens = 64, signal, version = 'v1beta', model = GEMINI_MODEL }) {
        return new Promise((resolve, reject) => {
            if (!apiKey) return reject(new Error('Missing Gemini API key'));
            // Use standard clean endpoint without query parameter to prevent multiple auth credential rejections
            const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent`;
            const payload = JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: maxOutputTokens
                }
            });

            const gmReq = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                          (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

            if (gmReq) {
                let aborted = false;
                let reqHandle = null;

                if (signal) {
                    if (signal.aborted) {
                        return reject(new Error('Request aborted'));
                    }
                    signal.addEventListener('abort', () => {
                        aborted = true;
                        if (reqHandle && typeof reqHandle.abort === 'function') {
                            try { reqHandle.abort(); } catch (_) {}
                        }
                        reject(new Error('Request aborted'));
                    });
                }

                reqHandle = gmReq({
                    method: "POST",
                    url: url,
                    headers: {
                        "Content-Type": "application/json",
                        "x-goog-api-key": apiKey
                    },
                    data: payload,
                    timeout: GEMINI_TIMEOUT_MS,
                    onload: function (res) {
                        if (aborted) return;
                        try {
                            const data = JSON.parse(res.responseText || '{}');
                            if (res.status >= 200 && res.status < 300) {
                                const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                                resolve({ success: true, text: text.trim(), data, modelUsed: model, versionUsed: version });
                            } else {
                                const errMsg = data?.error?.message || `HTTP ${res.status}: ${res.statusText}`;
                                reject(new Error(errMsg));
                            }
                        } catch (e) {
                            reject(new Error(`Failed to parse response: ${e.message}`));
                        }
                    },
                    ontimeout: function () {
                        if (aborted) return;
                        reject(new Error('Request timed out after 8 seconds'));
                    },
                    onerror: function (err) {
                        if (aborted) return;
                        reject(new Error(err?.error || err?.statusText || 'Network connection error'));
                    }
                });
            } else {
                fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-goog-api-key': apiKey
                    },
                    body: payload,
                    signal: signal
                })
                .then(async res => {
                    const data = await res.json().catch(() => ({}));
                    if (res.ok) {
                        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
                        resolve({ success: true, text: text.trim(), data, modelUsed: model, versionUsed: version });
                    } else {
                        reject(new Error(data?.error?.message || `HTTP ${res.status}`));
                    }
                })
                .catch(reject);
            }
        });
    }

    // Cross-origin and test-runner compatible Gemini API request executor with multi-endpoint fallback
    async function callGeminiApi({ apiKey, prompt, maxOutputTokens = 64, signal }) {
        if (!apiKey) throw new Error('Missing Gemini API key');

        const candidates = [...GEMINI_CANDIDATES];
        if (cachedWorkingEndpoint && cachedWorkingEndpoint.model && cachedWorkingEndpoint.version) {
            const idx = candidates.findIndex(c => c.model === cachedWorkingEndpoint.model && c.version === cachedWorkingEndpoint.version);
            if (idx > -1) {
                const [known] = candidates.splice(idx, 1);
                candidates.unshift(known);
            } else {
                candidates.unshift(cachedWorkingEndpoint);
            }
        }

        let lastError = null;

        for (const candidate of candidates) {
            if (signal && signal.aborted) {
                throw new Error('Request aborted');
            }

            try {
                recordAiRequest(apiKey);
                const res = await executeGeminiRequest({
                    apiKey,
                    prompt,
                    maxOutputTokens,
                    signal,
                    version: candidate.version,
                    model: candidate.model
                });

                cachedWorkingEndpoint = candidate;
                try {
                    localStorage.setItem('amaes_gemini_working_endpoint', JSON.stringify(candidate));
                } catch (_) {}

                noteContributorActivity().catch(() => {});
                return res;
            } catch (err) {
                lastError = err;
                const errLower = (err.message || '').toLowerCase();
                const isModelUnavailable = errLower.includes('not found') || 
                                           errLower.includes('not supported') || 
                                           errLower.includes('404') ||
                                           errLower.includes('does not exist');

                if (isModelUnavailable) {
                    logDebug(`Gemini model ${candidate.version}/${candidate.model} unavailable (${err.message}). Trying fallback candidate...`);
                    continue;
                }

                // If quota exhausted or rate limit, trigger cooldown and fast fail instead of burning other candidate endpoints
                if (errLower.includes('quota') || 
                    errLower.includes('429') || 
                    errLower.includes('rate limit') || 
                    errLower.includes('resource_exhausted')) {
                    const delayMatch = (err.message || '').match(/retry\s*(?:in|delay)?\s*[:\s]*(\d+)\s*s/i) || (err.message || '').match(/(\d+)\s*seconds?/i);
                    const waitSec = delayMatch ? parseInt(delayMatch[1], 10) : 20;
                    triggerAiRateLimitCooldown(waitSec, apiKey);
                    throw err;
                }

                // If authentication is rejected (wrong key, blocked, or unauthenticated) or user aborted, fail fast
                if (errLower.includes('api key not valid') || 
                    errLower.includes('unauthenticated') || 
                    errLower.includes('api_key_service_blocked') || 
                    errLower.includes('access_token_type_unsupported') || 
                    errLower.includes('aborted')) {
                    throw err;
                }
            }
        }

        throw lastError || new Error('No available Gemini model found for this key.');
    }

    let sharedAiPoolExhaustedUntil = 0;

    function isSharedAiPoolTemporarilyExhausted() {
        return Date.now() < sharedAiPoolExhaustedUntil;
    }

    function markSharedAiPoolExhausted(cooldownSec = 60) {
        sharedAiPoolExhaustedUntil = Date.now() + (cooldownSec * 1000);
    }

    async function callSharedAiFallback({ prompt, maxOutputTokens = 64, signal }) {
        if (!isSharedAiFallbackEnabled()) {
            throw new Error('Shared AI fallback is disabled');
        }
        const installationHeaders = {
            'Content-Type': 'application/json',
            'X-AMAES-Client-Version': CLIENT_VERSION,
            'X-AMAES-Installation': getAnonymousContributorId()
        };
        const requestFallback = async (mode, owner = false) => {
            const headers = { ...installationHeaders };
            const keyId = getContributorValue(CONTRIBUTOR_KEY_ID_STORAGE_KEY);
            const ownerToken = getContributorValue(CONTRIBUTOR_OWNER_TOKEN_STORAGE_KEY);
            if (owner && keyId && ownerToken) {
                headers['X-AMAES-Owner-Token'] = ownerToken;
            }
            const response = await fetch(`${communityRelayUrl}/ai`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ prompt, maxOutputTokens, mode, ...(owner ? { keyId } : {}) }),
                signal
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
                if (response.status === 429 || response.status === 503 || (data.error && /rate limit|quota|full|busy|exhausted/i.test(data.error))) {
                    markSharedAiPoolExhausted(60);
                }
                throw new Error(data.error || `Shared AI HTTP ${response.status}`);
            }
            return data;
        };

        if (isContributorSharingEnabled()) {
            try {
                return await requestFallback('contributor', true);
            } catch (ownerError) {
                logDebug(`Contributor fallback unavailable: ${ownerError.message}`);
            }
        }

        return requestFallback('community');
    }

    // Match AI answer text to the correct choice option in the question
    function matchAiAnswerToChoice(aiResponseText, que, qData) {
        if (!aiResponseText || !que || !qData || !qData.choices) return null;
        const cleanAi = aiResponseText.trim();

        // 1. Match by choice prefix letter (e.g. "b. ROM", "b) ROM", "Option B", or standalone "b")
        const letterMatch = cleanAi.match(/^(?:option\s+|choice\s+)?\(?([a-eA-E])\)?(?:\b|[.:\)\-–\s]|$)/i) || cleanAi.match(/^([a-eA-E])[.:\)\-–\s]/);
        let matchedChoiceIndex = -1;
        if (letterMatch) {
            const letter = letterMatch[1].toLowerCase();
            const charCode = letter.charCodeAt(0) - 97; // 'a' -> 0, 'b' -> 1
            if (charCode >= 0 && charCode < qData.choices.length) {
                matchedChoiceIndex = charCode;
            }
        }

        // 2. Match normalized choice content text
        const cleanAnswerText = normalizeChoice(cleanAi.replace(/^(?:option\s+|choice\s+)?\(?[a-eA-E]\)?(?:\b|[.:\)\-–\s]|$)/i, ''));
        if (matchedChoiceIndex === -1 && cleanAnswerText) {
            for (let i = 0; i < qData.choices.length; i++) {
                const normChoice = normalizeChoice(qData.choices[i]);
                if (!normChoice) continue;
                if (normChoice === cleanAnswerText) {
                    matchedChoiceIndex = i;
                    break;
                }
                // Guard against short substring false matches (require at least 4 chars)
                if (cleanAnswerText.length >= 4 && (normChoice.includes(cleanAnswerText) || cleanAnswerText.includes(normChoice))) {
                    matchedChoiceIndex = i;
                    break;
                }
            }
        }

        // 3. True / False matching
        if (matchedChoiceIndex === -1) {
            const lowerAi = cleanAi.toLowerCase();
            if (lowerAi.includes('true')) {
                matchedChoiceIndex = qData.choices.findIndex(c => normalizeChoice(c).includes('true'));
            } else if (lowerAi.includes('false')) {
                matchedChoiceIndex = qData.choices.findIndex(c => normalizeChoice(c).includes('false'));
            }
        }

        if (matchedChoiceIndex === -1) return null;

        // Resolve DOM element corresponding to matched choice index
        let choiceRows = que.querySelectorAll('.answer > div, .answer div.r0, .answer div.r1, .answer li, .answer tr');
        if (choiceRows.length === 0) {
            choiceRows = que.querySelectorAll('.answer div.r0, .answer div.r1, .answer li, .answer tr');
        }
        if (choiceRows.length === 0) {
            choiceRows = que.querySelectorAll('.answer label');
        }

        let targetRow = null;
        let targetInput = null;

        if (choiceRows.length > matchedChoiceIndex) {
            targetRow = choiceRows[matchedChoiceIndex];
            targetInput = targetRow.querySelector('input[type="radio"], input[type="checkbox"]');
        }

        if (!targetInput) {
            const allInputs = que.querySelectorAll('.answer input[type="radio"], .answer input[type="checkbox"]');
            if (allInputs.length > matchedChoiceIndex) {
                targetInput = allInputs[matchedChoiceIndex];
                targetRow = targetInput.closest('label, div.r0, div.r1, tr, li, div') || targetInput.parentElement;
            }
        }

        return {
            choiceIndex: matchedChoiceIndex,
            choiceText: qData.choices[matchedChoiceIndex],
            row: targetRow,
            input: targetInput
        };
    }

    // Injects a prominent, clean card-level pill indicating the question was answered by Google Gemini AI
    function setQuestionAiTag(que, isAi = true) {
        if (!que) return;
        que.querySelectorAll('.amaes-ai-question-tag').forEach(el => el.remove());
        if (!isAi) return;

        // Clean up any "No answer known yet" hint since AI answered it
        que.querySelectorAll('.amaes-unanswered-hint').forEach(el => el.remove());

        const formulation = que.querySelector('.formulation, .content') || que;
        const tag = document.createElement('div');
        tag.className = 'amaes-ai-question-tag';
        tag.style.cssText = `
            display: inline-flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 8px;
            padding: 4px 10px;
            background: rgba(139, 92, 246, 0.09);
            border: 1px solid rgba(139, 92, 246, 0.32);
            border-left: 3px solid #8b5cf6;
            border-radius: 6px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            line-height: 1.35;
            box-sizing: border-box;
            transition: all 0.2s ease;
        `;
        tag.title = 'This question was answered using Google Gemini AI. Please verify before submitting.';
        tag.innerHTML = `
            <div style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span class="amaes-ai-tag-pill" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: #ffffff !important; padding: 2px 7px; border-radius: 4px; font-weight: 800; font-size: 9.5px; letter-spacing: 0.4px; display: inline-flex; align-items: center; gap: 3px;">
                    AI-SOLVED
                </span>
                <span style="color: #6d28d9; font-weight: 700; font-size: 11px;">
                    Answered by Google Gemini AI
                </span>
                <span style="color: #7c3aed; font-size: 10px; opacity: 0.85;">
                    (Unverified Suggestion — Review before submitting)
                </span>
            </div>
        `;

        const qtextElem = que.querySelector('.qtext, .formulation .qtext');
        if (qtextElem && qtextElem.parentNode === formulation) {
            formulation.insertBefore(tag, qtextElem);
        } else {
            const toolbar = formulation.querySelector('.amaes-que-top-toolbar');
            if (toolbar && toolbar.nextSibling) {
                formulation.insertBefore(tag, toolbar.nextSibling);
            } else {
                formulation.insertBefore(tag, formulation.firstChild);
            }
        }
    }

    // Apply purple outline and AI Suggestion (Gemini) badge
    function applyAiChoiceHighlight(targetRow) {
        if (!targetRow) return;
        targetRow.classList.add('amaes-ai-suggested-choice');
        targetRow.style.outline = '2px solid rgba(139, 92, 246, 0.85)';
        targetRow.style.backgroundColor = 'rgba(139, 92, 246, 0.09)';
        targetRow.style.boxShadow = '0 0 0 1px rgba(139, 92, 246, 0.2)';
        targetRow.style.borderRadius = '6px';
        targetRow.style.padding = '5px 10px';

        let badge = targetRow.querySelector('.amaes-ai-suggested-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'amaes-ai-suggested-badge';
            badge.innerHTML = `<span>AI Suggestion (Gemini)</span>`;
            badge.style.cssText = `
                background: #7c3aed;
                color: #ffffff !important;
                font-size: 10px;
                font-weight: 700;
                padding: 2px 7px;
                border-radius: 4px;
                margin-left: auto;
                display: inline-flex;
                align-items: center;
                gap: 4px;
                box-shadow: 0 1px 3px rgba(124, 58, 237, 0.3);
                white-space: nowrap;
                flex-shrink: 0;
            `;
            targetRow.appendChild(badge);
        }

        const que = targetRow.closest('.que');
        if (que) {
            setQuestionAiTag(que, true);
            que.dataset.amaesAiFailed = 'false';
            if (typeof updateQuestionAiDrawerState === 'function') {
                updateQuestionAiDrawerState(que, false);
            }
        }
    }

    // Fallback bar with dynamic failure reason, Configure Key (if auth error), Retry AI, and Copy for AI
    function showAiFallbackBar(que, qData, promptText, onRetry, { reason = '', isAuthError = false, isRateLimit = false, waitSeconds = 0 } = {}) {
        que.querySelectorAll('.amaes-ai-fallback-bar').forEach(el => el.remove());
        que.querySelectorAll('.amaes-blockage-hud').forEach(el => el.remove());
        que.dataset.amaesAiFailed = 'true';
        if (typeof updateQuestionAiDrawerState === 'function') {
            updateQuestionAiDrawerState(que, true);
        }
        if (activeRateLimitTimerInterval) {
            clearInterval(activeRateLimitTimerInterval);
            activeRateLimitTimerInterval = null;
        }

        const formulation = que.querySelector('.formulation, .content') || que;
        const bar = document.createElement('div');
        bar.className = 'amaes-ai-fallback-bar';
        bar.style.cssText = `
            margin-bottom: 12px;
            padding: 8px 12px;
            background: ${isRateLimit ? '#fff7ed' : '#fdf4ff'};
            border: 1.5px solid ${isRateLimit ? '#f97316' : '#d946ef'};
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            color: ${isRateLimit ? '#9a3412' : '#86198f'};
            box-sizing: border-box;
            flex-wrap: wrap;
        `;
        const displayReason = reason || 'AI took too long or was unavailable.';
        const retryCount = Number(que.dataset.amaesAiRetryCount) || 0;
        const showConfig = isAuthError || retryCount >= 2;

        if (isRateLimit && waitSeconds > 0) {
            bar.innerHTML = `
                <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 200px;">
                    <span style="font-weight: 700;">Status</span>
                    <div>
                        <div style="font-weight: 700; color: #9a3412;">Google AI is temporarily busy</div>
                        <div style="font-size: 10.5px; color: #c2410c;">
                            Next request available in <strong id="amaes-ratelimit-countdown">${waitSeconds}s</strong>... (Prompt copied)
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                    ${showConfig ? `
                    <button type="button" class="amaes-ai-config-btn" style="
                        background: #ea580c;
                        color: #ffffff;
                        border: none;
                        padding: 4px 10px;
                        border-radius: 5px;
                        font-size: 10.5px;
                        font-weight: 700;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 3px;
                    " title="Add another free Google Gemini API key for higher rate limits">${ICONS.gear} Configure AI</button>
                    ` : ''}
                    <button type="button" class="amaes-ai-retry-btn" style="
                        background: #ea580c;
                        color: #ffffff;
                        border: none;
                        padding: 4px 10px;
                        border-radius: 5px;
                        font-size: 10.5px;
                        font-weight: 700;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 3px;
                        transition: all 0.2s ease;
                    ">Retry in ${waitSeconds}s</button>
                    <button type="button" class="amaes-ai-copy-btn" style="
                        background: #ffedd5;
                        color: #9a3412;
                        border: 1px solid #fdba74;
                        padding: 4px 10px;
                        border-radius: 5px;
                        font-size: 10.5px;
                        font-weight: 700;
                        cursor: pointer;
                        display: inline-flex;
                        align-items: center;
                        gap: 3px;
                    ">Copy for AI</button>
                </div>
            `;

            formulation.insertBefore(bar, formulation.firstChild);

            const configBtn = bar.querySelector('.amaes-ai-config-btn');
            if (configBtn) {
                configBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showGeminiSetupModal("Rate limited or busy? Add another free Google Gemini API key below to increase your capacity and keep solving without waiting.");
                };
            }

            let secLeft = waitSeconds;
            const timerEl = bar.querySelector('#amaes-ratelimit-countdown');
            const retryBtn = bar.querySelector('.amaes-ai-retry-btn');
            const copyBtn = bar.querySelector('.amaes-ai-copy-btn');

            if (copyBtn) {
                copyBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyQuestionWithOptionalImage(que, promptText).then((res) => {
                        showToast(res && res.withImage ? 'Visual snippet & question copied for AI.' : 'Question copied for AI.');
                    }).catch(() => {});
                };
            }

            activeRateLimitTimerInterval = setInterval(() => {
                secLeft--;
                if (secLeft > 0) {
                    if (timerEl) timerEl.textContent = `${secLeft}s`;
                    if (retryBtn) retryBtn.textContent = `Retry in ${secLeft}s`;
                } else {
                    clearInterval(activeRateLimitTimerInterval);
                    activeRateLimitTimerInterval = null;
                    if (timerEl) timerEl.textContent = 'Ready!';
                    if (retryBtn) {
                        retryBtn.textContent = 'Retry AI now';
                        retryBtn.style.background = '#16a34a';
                    }
                    if (autoQuizMode && typeof onRetry === 'function') {
                        showToast('Rate limit wait finished. Retrying AI...', 2500);
                        bar.remove();
                        onRetry();
                    }
                }
            }, 1000);

            if (retryBtn) {
                retryBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    clearInterval(activeRateLimitTimerInterval);
                    activeRateLimitTimerInterval = null;
                    bar.remove();
                    if (typeof onRetry === 'function') onRetry();
                };
            }
            return;
        }

        // Standard fallback bar (Clean, single-line alert without redundant web AI pills)
        bar.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px;">
                <span style="background: #a21caf; color: #ffffff; padding: 2px 7px; border-radius: 4px; font-weight: 800; font-size: 10px; letter-spacing: 0.5px; flex-shrink: 0;">AI WARNING</span>
                <span style="font-weight: 600;">${displayReason}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                <button type="button" class="amaes-ai-retry-btn" style="
                    background: #a21caf;
                    color: #ffffff;
                    border: none;
                    padding: 4px 10px;
                    border-radius: 5px;
                    font-size: 10.5px;
                    font-weight: 700;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                ">Retry AI</button>
                ${showConfig ? `
                <button type="button" class="amaes-ai-config-btn" style="
                    background: #7c3aed;
                    color: #ffffff;
                    border: none;
                    padding: 4px 10px;
                    border-radius: 5px;
                    font-size: 10.5px;
                    font-weight: 700;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                " title="Add another free Google Gemini API key for higher rate limits">${ICONS.gear} Configure AI</button>
                ` : ''}
                <button type="button" class="amaes-ai-copy-btn" style="
                    background: #fae8ff;
                    color: #86198f;
                    border: 1px solid #e879f9;
                    padding: 4px 10px;
                    border-radius: 5px;
                    font-size: 10.5px;
                    font-weight: 700;
                    cursor: pointer;
                    display: inline-flex;
                    align-items: center;
                    gap: 3px;
                ">Copy for AI</button>
            </div>
        `;

        formulation.insertBefore(bar, formulation.firstChild);

        const configBtn = bar.querySelector('.amaes-ai-config-btn');
        if (configBtn) {
            configBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                showGeminiSetupModal("Rate limited or busy? Add another free Google Gemini API key below to increase your capacity and keep solving without waiting.");
            };
        }

        const retryBtn = bar.querySelector('.amaes-ai-retry-btn');
        if (retryBtn && typeof onRetry === 'function') {
            retryBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                que.dataset.amaesAiRetryCount = String((Number(que.dataset.amaesAiRetryCount) || 0) + 1);
                bar.remove();
                onRetry();
            };
        }

        const copyBtn = bar.querySelector('.amaes-ai-copy-btn');
        if (copyBtn) {
            copyBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                copyQuestionWithOptionalImage(que, promptText).then((res) => {
                    showToast(res && res.withImage ? 'Visual snippet & question copied for AI.' : 'Question copied for AI.');
                }).catch(() => {});
            };
        }
    }

    // Handles thinking indicator, watchdog timeout, configurable retries, wrong choice elimination guard, session caching, and auto-copy on fail
    async function handleGeminiQuestionInference({ que, qData, promptText, onSuccess, onFallback, allowAnswered = false }) {
        que.querySelectorAll('.amaes-ai-thinking-indicator, .amaes-ai-fallback-bar').forEach(el => el.remove());

        if (typeof isFeatureDisabledByAdmin === 'function' && isFeatureDisabledByAdmin('aiSolver')) {
            setLog("[Admin Notice] AI Solver is temporarily disabled by administrator.", "var(--accent-amber)");
            showToast("AI Solver is temporarily disabled by administrator.", 4000);
            if (typeof onFallback === 'function') onFallback({ reason: 'Disabled by administrator', isAuthError: false, isRateLimit: false });
            return;
        }

        // A retry button or cooldown callback can outlive the question's
        // fallback UI. Never spend another request after the student answered.
        const existingAiChoiceBeforeRequest = que.querySelector('.amaes-ai-suggested-choice');
        if (!allowAnswered && isQuestionAnswered(que) && !existingAiChoiceBeforeRequest) {
            setLog(`[AI Guard] Question #${qData ? qData.qNum : ''} already has an answer; no request sent.`, "var(--accent-green)");
            return;
        }

        // 0. Cache Check: If this question was already solved by AI in this session or on-screen, reuse it with 0 API requests!
        const existingAiChoice = que.querySelector('.amaes-ai-suggested-choice');
        if (existingAiChoice && !isChoiceRowEliminated(existingAiChoice)) {
            const lbl = existingAiChoice.querySelector('label') || existingAiChoice;
            const choiceText = cleanDOMToAI(lbl);
            const input = existingAiChoice.querySelector('input[type="radio"], input[type="checkbox"]');
            setLog(`[AI Cache] Reusing existing AI suggestion for Question #${qData ? qData.qNum : ''} (0 API requests)`, "var(--accent-purple)");
            if (typeof onSuccess === 'function') {
                await onSuccess({ row: existingAiChoice, choiceText, input });
            }
            return;
        }

        const cachedAns = getCachedAiAnswer(qData);
        if (cachedAns && cachedAns.choiceText && qData.questionType !== 'match') {
            const textInput = que.querySelector('input[type="text"].form-control, input.form-control, input[type="text"], input[type="number"], textarea');
            if (textInput && (qData.isShortAnswer || (!qData.choices || qData.choices.length === 0)) && !qData.isGapSelect) {
                textInput.value = cachedAns.choiceText;
                applyAiTextHighlight(que, textInput, cachedAns.choiceText);
                setLog(`[AI Cache] Reusing previously solved answer for Question #${qData ? qData.qNum : ''} (0 API requests)`, "var(--accent-purple)");
                showToast(`Reused cached AI answer for #${qData ? qData.qNum : ''}.`, 2000);
                if (typeof onSuccess === 'function') {
                    await onSuccess({ choiceText: cachedAns.choiceText, input: textInput });
                }
                return;
            }

            const selectInputs = Array.from(que.querySelectorAll('select'));
            if (selectInputs.length > 0 && (!qData.choices || qData.choices.length === 0)) {
                let reselected = 0;
                selectInputs.forEach((sel, sIdx) => {
                    const options = Array.from(sel.options);
                    const matchOpt = options.find(opt => {
                        if (!opt.value || opt.value === '0' || opt.text.toLowerCase().includes('choose')) return false;
                        const optNorm = normalizeText(opt.text);
                        const targetNorm = normalizeText(cachedAns.choiceText);
                        return optNorm === targetNorm || (targetNorm.length > 2 && optNorm.includes(targetNorm)) || (optNorm.length > 2 && targetNorm.includes(optNorm));
                    });
                    if (matchOpt) {
                        sel.value = matchOpt.value;
                        sel.dispatchEvent(new Event('input', { bubbles: true }));
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                        sel.dispatchEvent(new Event('blur', { bubbles: true }));
                        sel.style.outline = '2px solid #a855f7';
                        sel.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                        reselected++;
                    }
                });
                if (reselected > 0) {
                    setLog(`[AI Cache] Reusing previously solved dropdown option for Question #${qData ? qData.qNum : ''} (0 API requests)`, "var(--accent-purple)");
                    showToast(`Reused cached AI dropdown choice for #${qData ? qData.qNum : ''}.`, 2000);
                    if (typeof onSuccess === 'function') {
                        await onSuccess({ choiceText: cachedAns.choiceText, selects: selectInputs });
                    }
                    return;
                }
            }
            const matched = matchAiAnswerToChoice(cachedAns.choiceText, que, qData);
            if (matched && matched.row && !isChoiceRowEliminated(matched.row)) {
                applyAiChoiceHighlight(matched.row);
                setLog(`[AI Cache] Reusing previously solved answer for Question #${qData ? qData.qNum : ''} (0 API requests)`, "var(--accent-purple)");
                showToast(`Reused cached AI choice for #${qData ? qData.qNum : ''}.`, 2000);
                if (typeof onSuccess === 'function') {
                    await onSuccess(matched);
                }
                return;
            }
        }

        // Jev Decision Provider: If configured and enabled, evaluate with Jev System One first
        if (typeof isJevConfigured === 'function' && typeof isJevEnabled === 'function' && isJevConfigured() && isJevEnabled()) {
            try {
                const courseInfo = detectCourseInfo();
                const courseCode = courseInfo.subjectCode || '';
                const jevResult = await evaluateQuestionWithJev({ que, qData, courseCode });
                if (jevResult && jevResult.row && jevResult.choiceText) {
                    applyAiChoiceHighlight(jevResult.row);
                    saveAiAnswerToCache(qData, jevResult);
                    const probPct = Math.round((jevResult.probability || jevResult.confidence || 0.5) * 100);
                    setLog(`[Jev AI] Suggested <b>${escapeHtml(jevResult.choiceText)}</b> (${probPct}% probability) for #${qData ? qData.qNum : ''}.`, "var(--accent-purple)");
                    showToast(`Jev suggested: "${jevResult.choiceText}" (${probPct}%)`, 3000);
                    if (typeof onSuccess === 'function') {
                        await onSuccess(jevResult);
                    }
                    return;
                }
            } catch (jevErr) {
                logDebug(`Jev evaluation fallback: ${jevErr.message}`);
            }
        }

        // 0.1 Rate Limit Guard: If user is on Free Tier and 15 RPM cap is reached or cooling down from 429:
        const rateLimitStatus = getAiRateLimitStatus();
        if (rateLimitStatus.isLimited) {
            if (getAiAutoCopyOnFail()) {
                copyQuestionWithOptionalImage(que, promptText).catch(() => {});
            }
            const rlMsg = `Google is temporarily limiting AI requests. Available again in about ${rateLimitStatus.remainingSec} seconds.`;
            setLog(`[AI Rate Limit] Question #${qData ? qData.qNum : ''}: ${rlMsg} (Prompt copied)`, "var(--accent-amber)");
            showToast(`AI rate limit: available in ${rateLimitStatus.remainingSec}s`, 3500);

            showAiFallbackBar(que, qData, promptText, async () => {
                await handleGeminiQuestionInference({ que, qData, promptText, onSuccess, onFallback, allowAnswered });
            }, {
                reason: rlMsg,
                isRateLimit: true,
                waitSeconds: rateLimitStatus.remainingSec
            });

            if (typeof onFallback === 'function') onFallback();
            return;
        }

        const formulation = que.querySelector('.formulation, .content') || que;
        const thinkingEl = document.createElement('div');
        thinkingEl.className = 'amaes-ai-thinking-indicator';
        thinkingEl.style.cssText = `
            margin-bottom: 12px;
            padding: 10px 14px;
            background: linear-gradient(135deg, rgba(124, 58, 237, 0.08), rgba(99, 102, 241, 0.08));
            border: 1.5px solid #a855f7;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 2px 8px rgba(168, 85, 247, 0.12);
        `;
        thinkingEl.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="amaes-ai-spin" style="display: inline-block; width: 14px; height: 14px; color: #9333ea;"></span>
                    <span class="amaes-ai-status-text" style="font-weight: 700; color: #7e22ce; font-size: 12px;">Gemini is analyzing Question #${qData ? qData.qNum : ''}...</span>
                </div>
                <button type="button" class="amaes-ai-cancel-btn" style="
                    background: #f3e8ff;
                    color: #7e22ce;
                    border: 1px solid #d8b4fe;
                    padding: 3px 8px;
                    border-radius: 5px;
                    font-size: 10.5px;
                    font-weight: 700;
                    cursor: pointer;
                ">Cancel AI</button>
            </div>
            <div style="width: 100%; height: 5px; background: rgba(168, 85, 247, 0.2); border-radius: 3px; overflow: hidden; position: relative;">
                <div class="amaes-ai-progress-bar" style="width: 35%; height: 100%; background: linear-gradient(90deg, #9333ea, #6366f1); border-radius: 3px;"></div>
            </div>
        `;
        formulation.insertBefore(thinkingEl, formulation.firstChild);

        let isAborted = false;
        let timedOut = false;
        const abortCtrl = new AbortController();
        activeAiAbortController = abortCtrl;

        const cancelBtn = thinkingEl.querySelector('.amaes-ai-cancel-btn');
        if (cancelBtn) {
            cancelBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                isAborted = true;
                abortCtrl.abort();
                thinkingEl.remove();
                showToast('AI analysis cancelled.');
                if (typeof onFallback === 'function') onFallback();
            };
        }

        setLog(`[AI Assistant] Asking Gemini for Question #${qData ? qData.qNum : ''}...`, "var(--accent-purple)");

        let timeoutId = setTimeout(() => {
            timedOut = true;
            abortCtrl.abort();
        }, GEMINI_TIMEOUT_MS);

        let answerText = null;
        let attempt = 0;
        let lastError = null;
        const retryAttempts = getAiRetryCount();
        const maxAttempts = 1 + retryAttempts; // 1 initial request + configurable retries (default: 1 + 2 = 3)
        let sharedFallbackAttempted = false;
        const maxOutputTokens = qData && qData.questionType === 'match'
            ? Math.max(256, (qData.matchPairs || []).length * 32)
            : 64;

        while (attempt < maxAttempts && !answerText && !isAborted && !timedOut) {
            if (!allowAnswered && isQuestionAnswered(que) && !que.querySelector('.amaes-ai-suggested-choice')) {
                abortCtrl.abort();
                break;
            }
            attempt++;
            try {
                if (attempt > 1) {
                    const statusTextEl = thinkingEl.querySelector('.amaes-ai-status-text');
                    if (statusTextEl) {
                        statusTextEl.textContent = `Gemini is analyzing Question #${qData ? qData.qNum : ''}... (Attempt ${attempt}/${maxAttempts})`;
                    }
                    setLog(`[AI Assistant] Retrying Gemini (Attempt ${attempt}/${maxAttempts}) for Question #${qData ? qData.qNum : ''}...`, "var(--accent-purple)");
                }
                const apiKey = getAvailableGeminiKey();
                if (!apiKey) {
                    if (isSharedAiFallbackEnabled() && !isSharedAiPoolTemporarilyExhausted()) {
                        const sharedStatusTextEl = thinkingEl.querySelector('.amaes-ai-status-text');
                        if (sharedStatusTextEl) {
                            sharedStatusTextEl.textContent = 'Using community shared AI pool...';
                        }
                        setLog('[AI Assistant] No personal key configured. Using community shared AI pool...', "var(--accent-blue)");
                        try {
                            const sharedResult = await callSharedAiFallback({
                                prompt: promptText,
                                maxOutputTokens,
                                signal: abortCtrl.signal
                            });
                            if (sharedResult && sharedResult.text) {
                                answerText = sharedResult.text;
                                setLog('[AI Assistant] Shared AI responded. The answer is still a suggestion—please review it.', "var(--accent-blue)");
                                break;
                            }
                        } catch (sharedError) {
                            markSharedAiPoolExhausted(60);
                            logDebug(`Shared AI fallback failed: ${sharedError.message}`);
                            showToast("Shared AI pool is unavailable. Please configure your free Gemini key.", 4000);
                            showGeminiSetupModal("The community shared AI pool is currently unavailable or exhausted. Add your free Google Gemini API key to continue solving questions instantly.");
                            lastError = sharedError;
                            break;
                        }
                    } else {
                        showToast("Gemini AI is not configured. Please set your free Google AI Studio key.", 3500);
                        showGeminiSetupModal("Gemini AI is not configured. Set up your free Google AI Studio key below to get started.");
                        lastError = new Error('Gemini AI is not configured');
                        break;
                    }
                } else {
                    const res = await callGeminiApi({
                        apiKey: apiKey,
                        prompt: promptText,
                        maxOutputTokens,
                        signal: abortCtrl.signal
                    });
                    if (res && res.text) {
                        answerText = res.text;
                        break;
                    }
                }
            } catch (err) {
                lastError = err;
                if (isAborted || timedOut) break;
                logDebug(`Gemini attempt ${attempt} error: ${err.message}`);
                const errLower = (err.message || '').toLowerCase();
                // If authentication is rejected, quota exhausted, or rate limit hit, fail fast instead of doing a pointless retry
                if (errLower.includes('api key not valid') || 
                    errLower.includes('unauthenticated') || 
                    errLower.includes('api_key_service_blocked') || 
                    errLower.includes('access_token_type_unsupported') || 
                    errLower.includes('quota') || 
                    errLower.includes('429') || 
                    errLower.includes('rate limit') || 
                    errLower.includes('resource_exhausted')) {
                    if (!sharedFallbackAttempted && isSharedAiFallbackEnabled() && !isSharedAiPoolTemporarilyExhausted()) {
                        sharedFallbackAttempted = true;
                        const sharedStatusTextEl = thinkingEl.querySelector('.amaes-ai-status-text');
                        if (sharedStatusTextEl) {
                            sharedStatusTextEl.textContent = 'Your personal key is temporarily busy. Checking limited shared AI help...';
                        }
                        setLog('[AI Assistant] Your personal key is temporarily busy. Checking limited shared AI help; this may take a few seconds.', "var(--accent-blue)");
                        try {
                            const sharedResult = await callSharedAiFallback({
                                prompt: promptText,
                                maxOutputTokens,
                                signal: abortCtrl.signal
                            });
                            if (sharedResult && sharedResult.text) {
                                answerText = sharedResult.text;
                                setLog('[AI Assistant] Shared AI help responded. The answer is still a suggestion—please review it.', "var(--accent-blue)");
                                break;
                            }
                        } catch (sharedError) {
                            markSharedAiPoolExhausted(60);
                            logDebug(`Shared AI fallback unavailable: ${sharedError.message}`);
                            if (sharedStatusTextEl) {
                                sharedStatusTextEl.textContent = 'Shared AI help is currently full. Returning to your personal-key options...';
                            }
                            setLog('[AI Assistant] Shared AI help is currently full or unavailable. No charge was made by this fallback.', "var(--accent-amber)");
                        }
                    }
                    // Authentication, quota, and rate-limit errors are not
                    // fixed by immediately repeating the same request. The
                    // shared fallback above is the only alternate path.
                    break;
                }
                if (attempt < maxAttempts) {
                    await new Promise(r => setTimeout(r, 800));
                }
            }
        }

        clearTimeout(timeoutId);
        thinkingEl.remove();

        if (isAborted) return;

        if (answerText) {
            // Check for Short-Answer / Fill-in-the-Blank text inputs
            const textInput = que.querySelector('input[type="text"].form-control, input.form-control, input[type="text"], input[type="number"], textarea');
            if (textInput && (qData.isShortAnswer || (!qData.choices || qData.choices.length === 0))) {
                const cleaned = answerText
                    .replace(/^Answer:\s*/i, '')
                    .replace(/^The correct answer is:\s*/i, '')
                    .replace(/^[a-e][.)]\s*/i, '')
                    .replace(/^["']|["']$/g, '')
                    .trim();
                if (cleaned) {
                    textInput.value = cleaned;
                    textInput.dispatchEvent(new Event('input', { bubbles: true }));
                    textInput.dispatchEvent(new Event('change', { bubbles: true }));
                    textInput.dispatchEvent(new Event('blur', { bubbles: true }));

                    applyAiTextHighlight(que, textInput, cleaned);
                    saveAiAnswerToCache(qData, { choiceText: cleaned });
                    recordAttemptAnswerEvidence(que, cleaned, 'ai_inference');
                    try {
                        const courseInfo = detectCourseInfo();
                        const sCode = courseInfo.subjectCode || 'GENERAL';
                        if (cleaned && qData && qData.qText) {
                            const aiEntry = {
                                qRaw: qData.qText,
                                qNorm: normalizeText(qData.qText),
                                ansRaw: cleaned,
                                ansNorm: normalizeChoice(cleaned),
                                questionType: 'shortanswer',
                                choices: [],
                                wrongAnswers: Array.from(getEliminatedChoicesForQuestion(que, qData, sCode) || []),
                                verified: false,
                                isAiSuggestion: true,
                                source: 'Google Gemini AI',
                                confirmations: 1
                            };
                            mergeAnswersIntoCache(sCode, [aiEntry], 'Google Gemini AI');
                            if (typeof queueCommunityContribution === 'function') {
                                queueCommunityContribution(sCode, [aiEntry], { source: 'gemini_ai_suggestion', isAiSuggestion: true });
                            }
                        }
                    } catch (_) {}
                    setLog(`[AI Suggestion] Gemini suggested <b>${escapeHtml(cleaned)}</b> for #${qData ? qData.qNum : ''}. (Paused for review)`, "var(--accent-purple)");
                    showToast(`Gemini suggested: "${cleaned}" for #${qData ? qData.qNum : ''}.`, 3000);
                    if (typeof onSuccess === 'function') {
                        await onSuccess({ choiceText: cleaned, input: textInput });
                    }
                    return;
                }
            }

            if (qData.questionType === 'match' && Array.isArray(qData.matchPairs) && qData.matchPairs.length > 0) {
                const matchingRows = getMatchingAiRows(que);
                const suggestions = parseMatchingAiResponse(answerText, matchingRows);
                if (suggestions.length > 0) {
                    suggestions.forEach(suggestion => {
                        suggestion.row.querySelectorAll('.amaes-ai-matching-suggestion').forEach(el => el.remove());
                        const badge = document.createElement('div');
                        badge.className = 'amaes-ai-matching-suggestion';
                        badge.setAttribute('role', 'status');
                        badge.style.cssText = 'display: flex; align-items: center; gap: 7px; flex-wrap: wrap; margin: 4px 0; color: #7e22ce; font-size: 11px; font-weight: 700;';
                        const label = document.createElement('span');
                        label.textContent = `AI suggestion (unverified): ${suggestion.option.text.trim()}`;
                        const useButton = document.createElement('button');
                        useButton.type = 'button';
                        useButton.textContent = 'Use suggestion';
                        useButton.style.cssText = 'padding: 2px 7px; border: 1px solid #c084fc; border-radius: 4px; background: #faf5ff; color: #7e22ce; font-size: 10px; font-weight: 700; cursor: pointer;';
                        useButton.addEventListener('click', event => {
                            event.preventDefault();
                            event.stopPropagation();
                            suggestion.select.value = suggestion.option.value;
                            suggestion.select.dispatchEvent(new Event('input', { bubbles: true }));
                            suggestion.select.dispatchEvent(new Event('change', { bubbles: true }));
                            suggestion.select.dispatchEvent(new Event('blur', { bubbles: true }));
                            suggestion.select.style.outline = '2px solid #a855f7';
                            suggestion.select.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                            useButton.textContent = 'Selected';
                            useButton.disabled = true;
                        });
                        badge.append(label, useButton);
                        suggestion.select.insertAdjacentElement('afterend', badge);
                    });
                    const summary = suggestions.map(item => `Row ${item.rowIndex + 1}: ${item.option.text.trim()}`).join('; ');
                    const partial = suggestions.length < matchingRows.length;
                    setLog(`[AI Suggestion] Gemini suggested ${suggestions.length} of ${matchingRows.length} matching rows${partial ? '; unmatched rows were left unchanged' : ''}. Review each unverified row before continuing.`, "var(--accent-purple)");
                    showToast(`Gemini suggested ${suggestions.length} matching answer${suggestions.length === 1 ? '' : 's'}; review before continuing.`, 3500);
                    if (typeof onSuccess === 'function') {
                        await onSuccess({ choiceText: summary, matchingRows: suggestions });
                    }
                    return;
                }

                // If bulk matching output was refused or unparseable, fall back to solving row-by-row
                setLog(`[AI Matching Fallback] Bulk AI response unconfirmed; analyzing matching items row-by-row...`, "var(--accent-purple)");
                let solvedCount = 0;
                for (let i = 0; i < matchingRows.length; i++) {
                    const mRow = matchingRows[i];
                    const opt = await solveMatchingRowWithAi({
                        que,
                        row: mRow.row,
                        selectInput: mRow.select,
                        subQText: mRow.prompt,
                        autoApply: false
                    });
                    if (opt) solvedCount++;
                }
                if (solvedCount > 0) {
                    showToast(`Gemini suggested ${solvedCount} matching answers row-by-row; review before continuing.`, 3500);
                    if (typeof onSuccess === 'function') {
                        await onSuccess({ choiceText: `Solved ${solvedCount} rows`, matchingRows });
                    }
                    return;
                }
                const mismatchReason = "AI could not match these items. Use the inline AI button on each row to solve individually.";
                showAiFallbackBar(que, qData, promptText, async () => {
                    await handleGeminiQuestionInference({ que, qData, promptText, onSuccess, onFallback, allowAnswered });
                }, { reason: mismatchReason, isAuthError: false });
                showToast(mismatchReason, 4500);
                if (typeof onFallback === 'function') onFallback();
                return;
            }

            // Check for Dropdown / Select elements (gapselect)
            const selectInputs = Array.from(que.querySelectorAll('select'));
            if (qData.questionType !== 'match' && selectInputs.length > 0 && (!qData.choices || qData.choices.length === 0)) {
                const cleaned = answerText
                    .replace(/^Answer:\s*/i, '')
                    .replace(/^The correct answer is:\s*/i, '')
                    .replace(/^[a-e][.)]\s*/i, '')
                    .replace(/^["']|["']$/g, '')
                    .trim();
                let selectedCount = 0;
                selectInputs.forEach((sel, sIdx) => {
                    const options = Array.from(sel.options);
                    let targetText = cleaned;
                    if (selectInputs.length > 1) {
                        const lines = cleaned.split(/[\n,;]+/).map(s => s.trim());
                        for (const line of lines) {
                            const matchPrefix = line.match(/(?:dropdown|blank)\s*(\d+)[:\-\s]+(.*)/i);
                            if (matchPrefix && parseInt(matchPrefix[1], 10) === sIdx + 1) {
                                targetText = matchPrefix[2].trim();
                                break;
                            }
                        }
                        if (!targetText && lines[sIdx]) {
                            targetText = lines[sIdx].replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                        }
                    }

                    const matchOpt = options.find(opt => {
                        if (!opt.value || opt.value === '0' || opt.text.toLowerCase().includes('choose')) return false;
                        const optNorm = normalizeText(opt.text);
                        const targetNorm = normalizeText(targetText);
                        return optNorm === targetNorm || (targetNorm.length > 2 && optNorm.includes(targetNorm)) || (optNorm.length > 2 && targetNorm.includes(optNorm));
                    });

                    if (matchOpt) {
                        sel.value = matchOpt.value;
                        sel.dispatchEvent(new Event('input', { bubbles: true }));
                        sel.dispatchEvent(new Event('change', { bubbles: true }));
                        sel.dispatchEvent(new Event('blur', { bubbles: true }));
                        selectedCount++;
                        sel.style.outline = '2px solid #a855f7';
                        sel.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                    }
                });

                if (selectedCount > 0) {
                    saveAiAnswerToCache(qData, { choiceText: cleaned });
                    recordAttemptAnswerEvidence(que, cleaned, 'ai_inference');
                    setLog(`[AI Suggestion] Gemini selected <b>${selectedCount}</b> dropdown option(s) for #${qData ? qData.qNum : ''}.`, "var(--accent-purple)");
                    showToast(`Gemini selected dropdown option for #${qData ? qData.qNum : ''}.`, 3000);
                    if (typeof onSuccess === 'function') {
                        await onSuccess({ choiceText: cleaned, selects: selectInputs });
                    }
                    return;
                }
            }

            const matched = matchAiAnswerToChoice(answerText, que, qData);
            if (matched && matched.row) {
                // Hard Safety Guard: Check if the AI returned a confirmed WRONG choice!
                if (isChoiceRowEliminated(matched.row)) {
                    logDebug(`Gemini suggested eliminated choice "${matched.choiceText}". Guard rejecting.`);
                    // Deduction: Check if only 1 uneliminated choice remains!
                    const choiceRows = Array.from(que.querySelectorAll('.answer > div, .answer div.r0, .answer div.r1, .answer li, .answer tr, .answer label'));
                    const validRows = choiceRows.filter(r => !isChoiceRowEliminated(r));
                    if (validRows.length === 1) {
                        const deducedRow = validRows[0];
                        const deducedInput = deducedRow.querySelector('input[type="radio"], input[type="checkbox"]');
                        const deducedText = cleanDOMToAI(deducedRow.querySelector('label') || deducedRow);
                        const deducedMatched = {
                            choiceIndex: choiceRows.indexOf(deducedRow),
                            choiceText: deducedText,
                            row: deducedRow,
                            input: deducedInput
                        };
                        applyAiChoiceHighlight(deducedRow);
                        saveAiAnswerToCache(qData, deducedMatched);
                        setLog(`[AI Deduction] AI suggested confirmed wrong choice "${escapeHtml(matched.choiceText)}". Deduced remaining valid choice: <b>${escapeHtml(deducedText)}</b>`, "var(--accent-purple)");
                        showToast('AI correction applied: one valid choice remained.', 3000);
                        if (typeof onSuccess === 'function') {
                            await onSuccess(deducedMatched);
                        }
                        return;
                    } else {
                        // More than 1 uneliminated choices remain; do NOT select the wrong answer!
                        const wrongReason = `AI suggested "${matched.choiceText}", but it is confirmed INCORRECT by database.`;
                        if (getAiAutoCopyOnFail()) {
                            copyQuestionWithOptionalImage(que, promptText).catch(() => {});
                        }
                        showAiFallbackBar(que, qData, promptText, async () => {
                            await handleGeminiQuestionInference({ que, qData, promptText, onSuccess, onFallback, allowAnswered });
                        }, { reason: wrongReason, isAuthError: false });
                        showToast(wrongReason, 4500);
                        setLog(`[AI Wrong Answer Blocked] Question #${qData ? qData.qNum : ''}: ${wrongReason}`, "var(--accent-pink)");
                        if (typeof onFallback === 'function') onFallback();
                        return;
                    }
                }

                // Valid answer that is NOT eliminated
                saveAiAnswerToCache(qData, matched);
                applyAiChoiceHighlight(matched.row);

                // Cache as unverified AI suggestion in course study bank
                try {
                    const courseInfo = detectCourseInfo();
                    const sCode = courseInfo.subjectCode || 'GENERAL';
                    const rawAns = (matched.choiceText || '').replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                    if (rawAns && qData && qData.qText) {
                        const aiEntry = {
                            qRaw: qData.qText,
                            qNorm: normalizeText(qData.qText),
                            ansRaw: rawAns,
                            ansNorm: normalizeChoice(rawAns),
                            questionType: qData.questionType || (typeof identifyQuestionType === 'function' ? identifyQuestionType(que) : (Array.isArray(qData.choices) && qData.choices.length > 0 ? 'multichoice' : 'shortanswer')),
                            choices: qData.choices || [],
                            wrongAnswers: Array.from(getEliminatedChoicesForQuestion(que, qData, sCode) || []),
                            verified: false,
                            isAiSuggestion: true,
                            source: 'Google Gemini AI',
                            confirmations: 1
                        };
                        mergeAnswersIntoCache(sCode, [aiEntry], 'Google Gemini AI');
                        if (typeof queueCommunityContribution === 'function') {
                            queueCommunityContribution(sCode, [aiEntry], { source: 'gemini_ai_suggestion', isAiSuggestion: true });
                        }
                    }
                } catch (_) {}

                if (typeof onSuccess === 'function') {
                    await onSuccess(matched);
                }
                return;
            } else {
                logDebug(`Gemini returned "${answerText}" but could not be mapped to choices.`);
                const cleanSnippet = answerText.trim().replace(/\s+/g, ' ').slice(0, 32);
                const mismatchReason = `AI suggested "${cleanSnippet}", but it couldn't be matched to any option.`;
                if (getAiAutoCopyOnFail()) {
                    copyQuestionWithOptionalImage(que, promptText).catch(() => {});
                }
                showAiFallbackBar(que, qData, promptText, async () => {
                    await handleGeminiQuestionInference({ que, qData, promptText, onSuccess, onFallback, allowAnswered });
                }, { reason: mismatchReason, isAuthError: false });
                showToast(mismatchReason, 4500);
                setLog(`[AI Choice Mismatch] Question #${qData ? qData.qNum : ''}: ${mismatchReason}`, "var(--accent-amber)");
                if (typeof onFallback === 'function') onFallback();
                return;
            }
        }

        // Categorize the true failure reason for clear feedback
        let failureReason = 'AI was unavailable.';
        let isAuthError = false;
        let isRateLimit = false;
        let waitSeconds = 0;

        if (timedOut) {
            failureReason = 'AI took too long to respond (timed out after 8s).';
        } else if (lastError) {
            const errMsg = lastError.message || '';
            const errLower = errMsg.toLowerCase();
            if (errLower.includes('unauthenticated') || 
                errLower.includes('invalid authentication') || 
                errLower.includes('api key not valid') || 
                errLower.includes('api_key_service_blocked') || 
                errLower.includes('access_token_type_unsupported')) {
                failureReason = 'Google rejected API key. Check key in Course Tools.';
                isAuthError = true;
            } else if (errLower.includes('quota') || errLower.includes('429') || errLower.includes('rate limit') || errLower.includes('resource_exhausted')) {
                isRateLimit = true;
                const status = getAiRateLimitStatus();
                waitSeconds = status.isLimited ? status.remainingSec : 20;
                failureReason = `AI Studio rate limit / quota exceeded. (Available in ${waitSeconds}s)`;
            } else if (errLower.includes('not found') || errLower.includes('no available gemini model') || errLower.includes('404')) {
                failureReason = 'Gemini model unavailable. Check key permissions.';
            } else {
                failureReason = `AI Error: ${errMsg.slice(0, 48)}`;
            }
        }

        // Auto-copy question to clipboard if enabled on failure
        if (getAiAutoCopyOnFail()) {
            copyQuestionWithOptionalImage(que, promptText).then((res) => {
                showToast(res && res.withImage ? 'Visual snippet & question copied to clipboard for external AI solving.' : 'Question copied to clipboard for external AI solving.', 3500);
            }).catch(() => {});
        }

        // Failure or timeout: inject fallback bar with clear reason and direct configure button if auth error
        showAiFallbackBar(que, qData, promptText, async () => {
            await handleGeminiQuestionInference({ que, qData, promptText, onSuccess, onFallback, allowAnswered });
        }, {
            reason: failureReason,
            isAuthError: isAuthError,
            isRateLimit: isRateLimit,
            waitSeconds: waitSeconds
        });

        showToast(failureReason, 4500);
        setLog(`[AI Fallback] Question #${qData ? qData.qNum : ''}: ${failureReason}`, "var(--accent-amber)");

        if (typeof onFallback === 'function') {
            onFallback();
        }
    }

    // Visual highlight & suggestion badge for Short-Answer / text input questions
    function applyAiTextHighlight(que, textInput, answerText) {
        if (!que || !textInput) return;
        textInput.style.borderColor = '#8b5cf6';
        textInput.style.boxShadow = '0 0 0 2px rgba(139, 92, 246, 0.2)';
        textInput.style.borderRadius = '5px';

        que.querySelectorAll('.amaes-ai-text-badge').forEach(el => el.remove());
        const badge = document.createElement('div');
        badge.className = 'amaes-ai-text-badge';
        badge.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-top: 6px;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 11px;
            font-weight: 600;
            background: rgba(139, 92, 246, 0.12);
            color: #7c3aed;
            border: 1px solid rgba(139, 92, 246, 0.3);
        `;
        badge.innerHTML = `${ICONS.gemini} <span>AI Suggestion: <strong>${escapeHtml(answerText)}</strong></span>`;

        const parent = textInput.parentElement || textInput;
        if (parent.nextSibling) {
            parent.parentNode.insertBefore(badge, parent.nextSibling);
        } else {
            parent.parentNode.appendChild(badge);
        }
    }

    // Manual on-demand AI solver trigger (invoked by clicking "Ask AI" or "Retry AI" on question card or blockage HUD)
    async function manualSolveWithAi(que, triggerBtn = null) {
        if (!que) return;
        setActiveQuestion(que, true);

        const keys = getGeminiApiKeys();
        if (keys.length === 0) {
            if (!isSharedAiFallbackEnabled()) {
                showToast("Gemini AI is not configured. Please set your free Google AI Studio key.", 3500);
                showGeminiSetupModal("Gemini AI is not configured. Set up your free Google AI Studio key below to get started.");
                return;
            }
            if (isSharedAiPoolTemporarilyExhausted()) {
                showToast("Shared AI pool is temporarily busy. Add your own free key for instant answers.", 3500);
                showGeminiSetupModal("The community shared AI pool is currently busy or rate-limited. Please configure your own free Gemini key below to solve questions without waiting.");
                return;
            }
        }

        const qData = extractQuestionData(que);
        if (!qData) {
            showToast("Could not extract question content.", 3000);
            return;
        }

        que.dataset.amaesAiAttempted = 'true';
        que.dataset.amaesAiRetryCount = String((Number(que.dataset.amaesAiRetryCount) || 0) + 1);

        // Update button text to loading state
        const cardAiBtn = que.querySelector('.amaes-ask-ai-card-btn');
        const blockageAiBtn = que.querySelector('#btn-blockage-ask-ai');
        if (cardAiBtn) cardAiBtn.innerHTML = `<span>Asking AI...</span>`;
        if (blockageAiBtn) blockageAiBtn.innerHTML = `<span>Asking AI...</span>`;

        const courseInfo = detectCourseInfo();
        const courseCode = courseInfo.subjectCode || '';

        if (qData.questionType === 'match') {
            const matchingRows = getMatchingAiRows(que);
            if (matchingRows.length > 0) {
                if (cardAiBtn) cardAiBtn.innerHTML = `<span>AI solving rows...</span>`;
                let solvedCount = 0;
                for (let i = 0; i < matchingRows.length; i++) {
                    const mRow = matchingRows[i];
                    if (cardAiBtn) cardAiBtn.innerHTML = `<span>AI item ${i + 1}/${matchingRows.length}...</span>`;
                    const opt = await solveMatchingRowWithAi({
                        que,
                        row: mRow.row,
                        selectInput: mRow.select,
                        subQText: mRow.prompt,
                        autoApply: false
                    });
                    if (opt) solvedCount++;
                }
                que.querySelectorAll('.amaes-blockage-hud, .amaes-ai-fallback-bar, .amaes-unanswered-hint').forEach(el => el.remove());
                que.style.outline = '2px solid rgba(139, 92, 246, 0.7)';
                que.style.borderRadius = '8px';
                setQuestionAiTag(que, true);
                if (cardAiBtn) cardAiBtn.innerHTML = `${ICONS.gemini} <span>Retry AI</span>`;
                if (blockageAiBtn) blockageAiBtn.innerHTML = `${ICONS.gemini} <span>Retry AI</span>`;
                showToast(`Gemini suggested ${solvedCount} of ${matchingRows.length} matching rows. Review suggestions!`, 3500);
                setLog(`[AI Matching] Gemini suggested <b>${solvedCount} of ${matchingRows.length}</b> matching items.`, "var(--accent-purple)");
                return;
            }
        }

        const promptText = buildGeminiCompactPrompt(qData, courseCode, que);

        await handleGeminiQuestionInference({
            que,
            qData,
            promptText,
            onSuccess: async (matched) => {
                if (matched && matched.choiceText) {
                    recordAttemptAnswerEvidence(que, matched.choiceText, 'ai_inference');
                }
                que.querySelectorAll('.amaes-blockage-hud, .amaes-ai-fallback-bar, .amaes-unanswered-hint').forEach(el => el.remove());
                que.querySelectorAll('.amaes-que-top-toolbar').forEach(toolbar => {
                    toolbar.style.display = 'flex';
                });
                que.style.outline = '2px solid rgba(139, 92, 246, 0.7)';
                que.style.borderRadius = '8px';
                setQuestionAiTag(que, true);

                if (matched && matched.input) {
                    if (matched.input.type === 'radio' || matched.input.type === 'checkbox') {
                        matched.input.checked = true;
                        matched.input.click();
                        if (matched.input.parentElement) matched.input.parentElement.click();
                        matched.input.dispatchEvent(new Event('input', { bubbles: true }));
                        matched.input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }

                if (cardAiBtn) cardAiBtn.innerHTML = `${ICONS.gemini} <span>Retry AI</span>`;
                if (blockageAiBtn) blockageAiBtn.innerHTML = `${ICONS.gemini} <span>Retry AI</span>`;
                showToast(`Gemini resolved Question #${qData ? qData.qNum : ''}!`, 3000);
            },
            onFallback: () => {
                if (cardAiBtn) cardAiBtn.innerHTML = `${ICONS.gemini} <span>Retry AI</span>`;
                if (blockageAiBtn) blockageAiBtn.innerHTML = `${ICONS.gemini} <span>Retry AI</span>`;
            }
        });

        if (cardAiBtn && cardAiBtn.innerHTML.includes('Asking AI...')) {
            cardAiBtn.innerHTML = `${ICONS.gemini} <span>Retry AI</span>`;
        }
        if (blockageAiBtn && blockageAiBtn.innerHTML.includes('Asking AI...')) {
            blockageAiBtn.innerHTML = `${ICONS.gemini} <span>Retry AI</span>`;
        }
    }

    // Non-tech student setup modal for Google AI Studio API key
    function showGeminiSetupModal() {
        const initialNotice = arguments[0] || '';
        let modal = document.getElementById('amaes-gemini-modal');
        if (modal) modal.remove();

        const currentKey = getGeminiApiKey();

        modal = document.createElement('div');
        modal.id = 'amaes-gemini-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.65);
            backdrop-filter: blur(4px);
            z-index: 10000000;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        `;

        modal.innerHTML = `
            <div style="
                background: var(--surface, #1e293b);
                border: 1px solid var(--border, #334155);
                border-radius: 12px;
                width: 90%;
                max-width: 490px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                overflow: hidden;
                color: var(--text-primary, #f8fafc);
                font-size: 12px;
            ">
                <!-- Modal Header -->
                <div style="
                    padding: 14px 18px;
                    background: linear-gradient(135deg, rgba(124, 58, 237, 0.2), rgba(79, 70, 229, 0.2));
                    border-bottom: 1px solid var(--border, #334155);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                ">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-weight: 700; color: #c084fc;">AI</span>
                        <span style="font-weight: 800; font-size: 13.5px; color: var(--text-primary, #f8fafc);">Setup Free Google Gemini AI</span>
                    </div>
                    <button id="amaes-gemini-modal-close" type="button" style="
                        background: transparent;
                        border: none;
                        color: var(--text-muted, #94a3b8);
                        font-size: 18px;
                        cursor: pointer;
                        line-height: 1;
                        padding: 4px;
                    ">&times;</button>
                </div>

                <!-- Modal Content -->
                <div style="padding: 18px; display: flex; flex-direction: column; gap: 14px; max-height: 75vh; overflow-y: auto;">
                    ${initialNotice ? `
                    <div id="amaes-gemini-modal-notice" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.35); color: #fca5a5; padding: 10px 12px; border-radius: 8px; font-size: 11.5px; line-height: 1.45; display: flex; align-items: flex-start; gap: 8px;">
                        <span style="display: inline-flex; align-items: center; color: #f87171; flex-shrink: 0; margin-top: 1px;">${ICONS.alertTriangle}</span>
                        <div>${escapeHtml(initialNotice)}</div>
                    </div>
                    ` : ''}

                    <!-- 1. Quick 3-Step Setup Card for Students -->
                    <div style="display: flex; flex-direction: column; gap: 10px; background: var(--bg, #0f172a); padding: 14px; border-radius: 8px; border: 1px solid var(--border-subtle, #334155);">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <div style="font-weight: 700; color: var(--text-primary, #f8fafc); font-size: 12px;">Google Gemini API Key</div>
                                <div style="font-size: 10.5px; color: var(--text-muted, #94a3b8); margin-top: 1px;">Solves unknown quiz questions instantly for free.</div>
                            </div>
                            <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="
                                display: inline-flex;
                                align-items: center;
                                gap: 4px;
                                color: #a78bfa;
                                font-size: 11px;
                                text-decoration: none;
                                font-weight: 700;
                                background: rgba(168, 85, 247, 0.12);
                                border: 1px solid rgba(168, 85, 247, 0.3);
                                padding: 3px 8px;
                                border-radius: 5px;
                            ">
                                ${ICONS.external} <span>Get Free Key</span>
                            </a>
                        </div>

                        <!-- Dynamic Gemini key rows -->
                        <div id="amaes-gemini-key-rows" style="display: flex; flex-direction: column; gap: 6px;"></div>

                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; padding-top: 6px; border-top: 1px solid var(--border-subtle, #334155);">
                            <button id="amaes-gemini-btn-add-key" type="button" style="
                                background: transparent;
                                border: 1px dashed rgba(168,85,247,0.4);
                                color: #a78bfa;
                                border-radius: 5px;
                                font-size: 10px;
                                font-weight: 600;
                                padding: 4px 10px;
                                cursor: pointer;
                            ">+ Add Backup Key</button>

                            <div style="display: flex; align-items: center; gap: 5px;">
                                <span style="font-size: 10px; color: var(--text-muted, #94a3b8);">Plan:</span>
                                <select id="amaes-gemini-plan-select" style="
                                    background: var(--surface, #1e293b);
                                    color: var(--text-primary, #f8fafc);
                                    border: 1px solid var(--border, #334155);
                                    padding: 2px 6px;
                                    border-radius: 4px;
                                    font-size: 10px;
                                    cursor: pointer;
                                ">
                                    <option value="free" ${getAiPlanTier() === 'free' ? 'selected' : ''}>Free plan</option>
                                    <option value="paid" ${getAiPlanTier() === 'paid' ? 'selected' : ''}>Paid plan</option>
                                </select>
                            </div>
                        </div>
                        <div id="amaes-multikey-explain" style="padding: 6px 10px; background: rgba(124,58,237,0.1); border: 1px solid rgba(168,85,247,0.25); border-radius: 6px; font-size: 10px; color: #d8b4fe; line-height: 1.4;">
                            <b style="color: #ffffff;">Higher Limits with Multiple Keys:</b> Add backup keys to automatically rotate between your keys and bypass rate limits.
                        </div>
                    </div>

                    <!-- Collapsible Advanced Settings (Non-Tech Friendly) -->
                    <details style="padding: 0; margin: 0;">
                        <summary style="font-size: 11px; font-weight: 600; color: var(--text-muted, #94a3b8); cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                            <span>Advanced Settings (TypeSafe Jev Classifier & Sharing)</span>
                        </summary>
                        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 10px; padding-left: 4px;">

                            <!-- 2. TypeSafe Jev Decision Engine Card -->
                            <div style="display: flex; flex-direction: column; gap: 8px; background: var(--bg, #0f172a); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle, #334155);">
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="display: flex; align-items: center; gap: 6px;">
                                        <span style="font-weight: 700; color: #60a5fa; font-size: 11.5px;">TypeSafe Jev</span>
                                        <span style="font-size: 9px; background: rgba(59, 130, 246, 0.25); color: #bfdbfe; padding: 1px 5px; border-radius: 4px; font-weight: 600;">Fast Classifier</span>
                                    </div>
                                    <a href="https://console.typesafe.ai" target="_blank" rel="noopener noreferrer" style="color: #93c5fd; font-size: 10.5px; text-decoration: none; font-weight: 600;">Get Key</a>
                                </div>

                                <label style="display: flex; align-items: center; gap: 6px; font-size: 10.5px; color: var(--text-primary, #f8fafc); cursor: pointer;">
                                    <input id="amaes-jev-enable-checkbox" type="checkbox" ${typeof isJevEnabled === 'function' && isJevEnabled() ? 'checked' : ''} style="cursor: pointer; accent-color: #3b82f6;" />
                                    <span>Enable for Multiple Choice & True/False questions</span>
                                </label>

                                <div style="display: flex; gap: 5px; align-items: center;">
                                    <input id="amaes-jev-input-key" type="password" placeholder="TypeSafe API key (or leave empty if using relay)..." value="${escapeHtml(typeof getJevApiKey === 'function' ? getJevApiKey() : '')}" style="flex:1; background:var(--surface,#1e293b); color:var(--text-primary,#f8fafc); border:1px solid var(--border,#334155); padding:5px 8px; border-radius:5px; font-size:11px; outline:none; font-family:monospace;" />
                                    <button id="amaes-jev-btn-paste" type="button" style="background:var(--surface,#1e293b); border:1px solid var(--border,#334155); color:#60a5fa; border-radius:5px; padding:4px 8px; font-size:10px; cursor:pointer;">Paste</button>
                                    <button id="amaes-jev-btn-test" type="button" style="background:rgba(59,130,246,0.2); border:1px solid rgba(59,130,246,0.4); color:#93c5fd; border-radius:5px; padding:4px 9px; font-size:10px; font-weight:600; cursor:pointer;">Test Jev</button>
                                </div>
                                <div id="amaes-jev-status-feedback" style="display: none; padding: 5px 8px; border-radius: 4px; font-size: 10.5px; font-weight: 600;"></div>
                            </div>

                            <!-- 3. Community Options -->
                            <div style="display: flex; flex-direction: column; gap: 7px; padding: 10px; background: var(--bg, #0f172a); border-radius: 8px; border: 1px solid var(--border-subtle, #334155);">
                                <label style="display: flex; gap: 7px; align-items: center; cursor: pointer;">
                                    <input id="amaes-shared-ai-fallback" type="checkbox" ${isSharedAiFallbackEnabled() ? 'checked' : ''} style="accent-color: #10b981;" />
                                    <span style="font-size: 10.5px; color: var(--text-primary, #f8fafc);">Use shared community AI if personal key is busy</span>
                                </label>
                                <label style="display: flex; gap: 7px; align-items: center; cursor: pointer;">
                                    <input id="amaes-contributor-sharing" type="checkbox" ${isContributorSharingEnabled() ? 'checked' : ''} style="accent-color: #f59e0b;" />
                                    <span style="font-size: 10.5px; color: var(--text-muted, #94a3b8);">Share key with community when idle (If checked, saving this key is your consent. <a href="https://github.com/Acads-Tools/database/blob/main/relay/README.md#contributor-key-sharing" target="_blank" rel="noopener noreferrer" style="color: #fcd34d; text-decoration: underline;">Details</a>)</span>
                                </label>
                            </div>
                        </div>
                    </details>

                    <!-- Status Feedback -->
                    <div id="amaes-gemini-status-feedback" style="display: none; padding: 8px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;"></div>

                    <!-- Action Buttons -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 4px;">
                        <div>
                            ${currentKey ? `
                            <button id="amaes-gemini-btn-remove" type="button" class="amaes-btn" style="
                                background: transparent;
                                color: #ef4444;
                                border: 1px solid rgba(239, 68, 68, 0.4);
                                padding: 6px 12px;
                                font-size: 11px;
                            ">Remove Key</button>
                            ` : ''}
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button id="amaes-gemini-btn-cancel" type="button" class="amaes-btn amaes-btn-outline" style="padding: 6px 14px;">Cancel</button>
                            <button id="amaes-gemini-btn-test-save" type="button" class="amaes-btn amaes-btn-blue" style="
                                background: linear-gradient(135deg, #7c3aed, #4f46e5);
                                padding: 6px 16px;
                                font-weight: 700;
                            ">Save & Activate AI</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => modal.remove();
        modal.querySelector('#amaes-gemini-modal-close').onclick = closeModal;
        modal.querySelector('#amaes-gemini-btn-cancel').onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        // inputKey kept for backward compat (returns null since element removed from DOM)
        const inputKey = modal.querySelector('#amaes-gemini-input-key');
        const feedback = modal.querySelector('#amaes-gemini-status-feedback');
        const testSaveBtn = modal.querySelector('#amaes-gemini-btn-test-save');
        const removeBtn = modal.querySelector('#amaes-gemini-btn-remove');
        const sharedFallbackCheckbox = modal.querySelector('#amaes-shared-ai-fallback');
        const contributorSharingCheckbox = modal.querySelector('#amaes-contributor-sharing');

        // Feature 3: Multi-key UI
        const existingKeys = getGeminiApiKeys();
        const keyRowsContainer = modal.querySelector('#amaes-gemini-key-rows');
        const addKeyBtn = modal.querySelector('#amaes-gemini-btn-add-key');

        const KEY_LABELS = ['Key #1 (Primary)', 'Key #2 (Backup)', 'Key #3 (Backup)', 'Key #4', 'Key #5'];
        const MAX_KEYS = 5;

        function renderKeyRowsWithVals(vals) {
            keyRowsContainer.innerHTML = '';
            vals.forEach((val, idx) => {
                const row = document.createElement('div');
                row.className = 'amaes-key-row';
                row.style.cssText = 'display: flex; gap: 5px; align-items: center;';
                row.innerHTML = `
                    <span style="font-size:9.5px; color:#a78bfa; min-width:90px; font-weight:600;">${KEY_LABELS[idx] || ('Key #' + (idx+1))}</span>
                    <input type="password" placeholder="AIzaSy..." value="${val.replace(/"/g, '&quot;')}" style="flex:1; background:var(--surface,#1e293b); color:#f8fafc; border:1px solid var(--border,#334155); padding:5px 8px; border-radius:5px; font-size:11px; outline:none; font-family:monospace;" />
                    <button type="button" class="amaes-key-paste-btn" style="background:var(--surface,#1e293b); border:1px solid var(--border,#334155); color:#a78bfa; border-radius:5px; padding:4px 8px; font-size:10px; cursor:pointer;">Paste</button>
                    <button type="button" class="amaes-key-test-btn" style="background:rgba(124,58,237,0.15); border:1px solid rgba(168,85,247,0.35); color:#d8b4fe; border-radius:5px; padding:4px 8px; font-size:10px; font-weight:600; cursor:pointer;" title="Test this specific API key">Test</button>
                    ${idx > 0 ? `<button type="button" class="amaes-key-remove-btn" style="background:transparent; border:1px solid rgba(239,68,68,0.35); color:#f87171; border-radius:5px; padding:4px 8px; font-size:10px; cursor:pointer;" title="Remove key">Remove</button>` : ''}
                `;
                row.querySelector('.amaes-key-paste-btn').onclick = async () => {
                    const inp = row.querySelector('input');
                    try {
                        if (navigator.clipboard && navigator.clipboard.readText) {
                            const t = await navigator.clipboard.readText();
                            if (t) inp.value = t.trim();
                        } else { inp.focus(); inp.select(); }
                    } catch (_) { inp.focus(); }
                };
                const testBtn = row.querySelector('.amaes-key-test-btn');
                if (testBtn) {
                    testBtn.onclick = async () => {
                        const inpVal = row.querySelector('input').value.trim();
                        if (!inpVal) {
                            showToast('Paste or type an API key first to test.', 2500);
                            return;
                        }
                        testBtn.disabled = true;
                        testBtn.textContent = 'Testing...';
                        try {
                            const res = await callGeminiApi({
                                apiKey: inpVal,
                                prompt: 'Ping',
                                maxOutputTokens: 2
                            });
                            if (res && res.success) {
                                testBtn.textContent = 'Valid';
                                testBtn.style.background = 'rgba(16, 185, 129, 0.2)';
                                testBtn.style.borderColor = 'rgba(16, 185, 129, 0.4)';
                                testBtn.style.color = '#34d399';
                                showToast(`${KEY_LABELS[idx] || ('Key #' + (idx+1))} is valid!`);
                            } else {
                                testBtn.textContent = 'Failed';
                                testBtn.style.background = 'rgba(239, 68, 68, 0.2)';
                                testBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                                testBtn.style.color = '#f87171';
                                const errMsg = res?.error || 'Validation error';
                                showToast(`Key error: ${errMsg.slice(0, 60)}`, 3500);
                            }
                        } catch (err) {
                            testBtn.textContent = 'Failed';
                            testBtn.style.background = 'rgba(239, 68, 68, 0.2)';
                            testBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
                            testBtn.style.color = '#f87171';
                            showToast(`Key error: ${(err.message || err).slice(0, 60)}`, 3500);
                        } finally {
                            setTimeout(() => {
                                testBtn.disabled = false;
                            }, 500);
                        }
                    };
                }
                const removeRowBtn = row.querySelector('.amaes-key-remove-btn');
                if (removeRowBtn) {
                    removeRowBtn.onclick = () => {
                        const current = Array.from(keyRowsContainer.querySelectorAll('.amaes-key-row'))
                            .map(r => r.querySelector('input').value.trim())
                            .filter((_, i) => i !== idx);
                        if (current.length === 0) current.push('');
                        renderKeyRowsWithVals(current);
                        if (addKeyBtn) addKeyBtn.style.display = current.length >= MAX_KEYS ? 'none' : 'block';
                    };
                }
                keyRowsContainer.appendChild(row);
            });
            if (addKeyBtn) addKeyBtn.style.display = vals.length >= MAX_KEYS ? 'none' : 'block';
        }

        // Initial render
        renderKeyRowsWithVals(existingKeys.length > 0 ? existingKeys : ['']);

        if (addKeyBtn) {
            addKeyBtn.onclick = () => {
                const currentVals = Array.from(keyRowsContainer.querySelectorAll('.amaes-key-row'))
                    .map(r => r.querySelector('input').value.trim());
                if (currentVals.length < MAX_KEYS) {
                    currentVals.push('');
                    renderKeyRowsWithVals(currentVals);
                }
            };
        }

        // Jev Decision Engine elements
        const jevInput = modal.querySelector('#amaes-jev-input-key');
        const jevPasteBtn = modal.querySelector('#amaes-jev-btn-paste');
        const jevTestBtn = modal.querySelector('#amaes-jev-btn-test');
        const jevCheckbox = modal.querySelector('#amaes-jev-enable-checkbox');
        const jevFeedback = modal.querySelector('#amaes-jev-status-feedback');

        if (jevPasteBtn && jevInput) {
            jevPasteBtn.onclick = async () => {
                try {
                    if (navigator.clipboard && navigator.clipboard.readText) {
                        const t = await navigator.clipboard.readText();
                        if (t) jevInput.value = t.trim();
                    } else { jevInput.focus(); jevInput.select(); }
                } catch (_) { jevInput.focus(); }
            };
        }

        if (jevTestBtn && jevInput && jevFeedback) {
            jevTestBtn.onclick = async () => {
                const testKey = jevInput.value.trim();
                jevTestBtn.disabled = true;
                jevTestBtn.textContent = 'Testing...';
                jevFeedback.style.display = 'block';
                jevFeedback.style.background = 'rgba(59, 130, 246, 0.15)';
                jevFeedback.style.color = '#60a5fa';
                jevFeedback.style.border = '1px solid rgba(59, 130, 246, 0.3)';
                jevFeedback.textContent = 'Testing TypeSafe Jev System One endpoint...';

                try {
                    const testRes = await testJevConnection(testKey || null);
                    jevFeedback.style.background = 'rgba(16, 185, 129, 0.15)';
                    jevFeedback.style.color = '#34d399';
                    jevFeedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                    jevFeedback.textContent = `Jev Connected! Decision: "${testRes.decision}" (${Math.round((testRes.confidence || 0.9) * 100)}% conf in ${testRes.durationMs}ms)`;
                } catch (e) {
                    jevFeedback.style.background = 'rgba(239, 68, 68, 0.15)';
                    jevFeedback.style.color = '#f87171';
                    jevFeedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                    jevFeedback.textContent = `Jev Error: ${e.message.slice(0, 100)}`;
                } finally {
                    jevTestBtn.disabled = false;
                    jevTestBtn.textContent = 'Test Jev';
                }
            };
        }

        if (removeBtn) {
            removeBtn.onclick = () => {
                deleteContributorKey().catch(() => {});
                setGeminiApiKeys([]);
                if (typeof setJevApiKey === 'function') setJevApiKey('');
                if (typeof setJevEnabled === 'function') setJevEnabled(false);
                showToast('AI API keys removed.');
                closeModal();
            };
        }

        if (testSaveBtn && feedback) {
            testSaveBtn.onclick = async () => {
                const allKeyVals = Array.from(keyRowsContainer.querySelectorAll('.amaes-key-row input'))
                    .map(inp => inp.value.trim())
                    .filter(Boolean);
                const rawKey = allKeyVals[0] || '';
                const jevKeyVal = jevInput ? jevInput.value.trim() : '';

                if (jevInput && typeof setJevApiKey === 'function') {
                    setJevApiKey(jevKeyVal);
                }
                if (jevCheckbox && typeof setJevEnabled === 'function') {
                    setJevEnabled(jevCheckbox.checked);
                }

                if (!rawKey) {
                    if (jevKeyVal || (jevCheckbox && jevCheckbox.checked)) {
                        feedback.style.display = 'block';
                        feedback.style.background = 'rgba(16, 185, 129, 0.15)';
                        feedback.style.color = '#34d399';
                        feedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                        feedback.innerText = 'TypeSafe Jev settings saved successfully!';
                        showToast('TypeSafe Jev settings saved.');
                        updateAiAssistantUI();
                        setTimeout(closeModal, 1000);
                        return;
                    }
                    feedback.style.display = 'block';
                    feedback.style.background = 'rgba(239, 68, 68, 0.15)';
                    feedback.style.color = '#f87171';
                    feedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                    feedback.innerText = 'Please paste or type your Gemini API key or TypeSafe Jev key.';
                    return;
                }

                testSaveBtn.disabled = true;
                testSaveBtn.innerText = 'Testing Key...';
                feedback.style.display = 'block';
                feedback.style.background = 'rgba(59, 130, 246, 0.15)';
                feedback.style.color = '#60a5fa';
                feedback.style.border = '1px solid rgba(59, 130, 246, 0.3)';
                feedback.innerText = 'Testing connection with Google Gemini...';

                try {
                    const res = await callGeminiApi({
                        apiKey: rawKey,
                        prompt: 'Ping',
                        maxOutputTokens: 2
                    });
                    if (res && res.success) {
                        setGeminiApiKeys(allKeyVals);
                        if (sharedFallbackCheckbox) {
                            setSharedAiFallbackEnabled(sharedFallbackCheckbox.checked);
                        }
                        if (contributorSharingCheckbox) {
                            let wantsContributorSharing = contributorSharingCheckbox.checked;
                            const currentFingerprint = await contributorKeyFingerprint(rawKey);
                            const registeredFingerprint = getContributorValue(CONTRIBUTOR_KEY_FINGERPRINT_STORAGE_KEY);
                            if (wantsContributorSharing && isContributorSharingEnabled() && currentFingerprint !== registeredFingerprint) {
                                await deleteContributorKey();
                            }
                            if (wantsContributorSharing && !isContributorSharingEnabled()) {
                                await registerContributorKey(rawKey);
                            } else if (!wantsContributorSharing && isContributorSharingEnabled()) {
                                await deleteContributorKey();
                            }
                        }
                        const planSelect = modal.querySelector('#amaes-gemini-plan-select');
                        if (planSelect) {
                            setAiPlanTier(planSelect.value);
                            const quizPlanSel = document.getElementById('sel-ai-plan-tier');
                            if (quizPlanSel) quizPlanSel.value = getAiPlanTier();
                            const coursePlanSel = document.getElementById('sel-course-ai-plan-tier');
                            if (coursePlanSel) coursePlanSel.value = getAiPlanTier();
                        }
                        const modelName = res.modelUsed || 'Gemini Flash';
                        feedback.style.background = 'rgba(16, 185, 129, 0.15)';
                        feedback.style.color = '#34d399';
                        feedback.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                        feedback.innerHTML = `API key verified and saved. Connected via ${modelName}.` +
                            (isContributorSharingEnabled()
                                ? ` <a href="https://github.com/Acads-Tools/database/blob/main/relay/README.md#contributor-key-sharing" target="_blank" rel="noopener noreferrer" style="color:#a7f3d0; text-decoration:underline;">Manage sharing</a>`
                                : '');
                        showToast(`Google Gemini connected (${modelName}).`);
                        updateAiAssistantUI();
                        setTimeout(closeModal, 1200);
                    }
                } catch (err) {
                    testSaveBtn.disabled = false;
                    testSaveBtn.innerText = 'Test & Save Key';
                    feedback.style.background = 'rgba(239, 68, 68, 0.15)';
                    feedback.style.color = '#f87171';
                    feedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                    const msg = err.message || 'Invalid API key or network error.';
                    const msgLower = msg.toLowerCase();
                    if (msgLower.includes('api_key_service_blocked') || 
                        msgLower.includes('unauthenticated') || 
                        msgLower.includes('access_token_type_unsupported')) {
                        feedback.innerText = `Validation Failed: Key was rejected by Google. In Google AI Studio, ensure you click "Create API key in new project" so the Generative Language API is automatically enabled.`;
                    } else if (msgLower.includes('quota') || msgLower.includes('429') || msgLower.includes('rate limit') || msgLower.includes('resource_exhausted')) {
                        setGeminiApiKeys(allKeyVals);
                        logDebug(`Gemini validation quota response: ${msg}`);
                        feedback.style.background = 'rgba(245, 158, 11, 0.15)';
                        feedback.style.color = '#fbbf24';
                        feedback.style.border = '1px solid rgba(245, 158, 11, 0.3)';
                        const retryMatch = msg.match(/retry in\s+([0-9]+(?:\.[0-9]+)?)s/i);
                        const retryText = retryMatch ? ` Try again in about ${Math.ceil(Number(retryMatch[1]))} seconds.` : '';
                        feedback.innerText = `Your key was saved. Google is temporarily limiting AI requests.${retryText} You can continue using verified database answers while waiting.`;
                        showToast('Gemini key saved; free-tier quota is temporarily exhausted.', 4500);
                        updateAiAssistantUI();
                    } else {
                        logDebug(`Gemini validation failed: ${msg}`);
                        feedback.innerText = `We could not connect to Google with this key. Check that it was copied correctly, then try again.`;
                    }
                }
            };
        }
    }
