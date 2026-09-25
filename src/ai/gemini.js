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
        return keys.length > 0 ? keys[0] : (localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || geminiApiKey || '');
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
        const isConfigured = keys.length > 0;

        const badge = document.getElementById('gemini-status-badge');
        if (badge) {
            const activeModel = cachedWorkingEndpoint ? cachedWorkingEndpoint.model : 'Gemini Flash';
            badge.style.color = isConfigured ? 'var(--accent-green)' : 'var(--text-muted)';
            if (isConfigured) {
                badge.innerHTML = keys.length > 1
                    ? `Ready (${keys.length} keys)`
                    : `Ready (${activeModel})`;
            } else {
                badge.innerHTML = '● Not Configured';
            }
        }

        const setupBtn = document.getElementById('btn-open-gemini-setup');
        if (setupBtn) {
            setupBtn.innerHTML = `<span>            ${isConfigured ? (keys.length > 1 ? `Configure AI keys (${keys.length})` : 'Configure AI key') : 'Setup Free AI Assistant'}</span>`;
        }

        const quizAiBlock = document.getElementById('amaes-ai-quiz-settings-block');
        if (quizAiBlock) {
            quizAiBlock.style.display = isConfigured ? 'flex' : 'none';
        }
    }

    // Ultra-Compact Prompt Builder: 0 fluff, max token efficiency (~60-120 tokens total)
    function buildGeminiCompactPrompt(qData, courseCode = '', que = null) {
        const lines = [];
        if (courseCode) {
            lines.push(`[Course: ${courseCode}]`);
        }
        lines.push(`Question: ${qData.qText || ''}`);

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
            lines.push(`Reply with ONLY the exact, concise word or phrase (typically 1 to 3 words) that directly answers the question or fills the blank. No explanation. No quotes.`);
            return lines.join('\n');
        }

        lines.push(`Choices:`);

        const eliminatedSet = getEliminatedChoicesForQuestion(que, qData, courseCode);

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

        // Dropdown / Select matching questions MUST fall back to manual copy
        if (que.querySelectorAll('select').length > 0) return false;
        if (qData.matchPairs && qData.matchPairs.length > 0) return false;

        // Text inputs / Essay questions MUST fall back to manual copy
        if (qData.isShortAnswer || qData.isEssay) return false;
        if (que.querySelectorAll('input[type="text"]:not([type="hidden"]), textarea').length > 0) return false;

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
            if (!response.ok) throw new Error(data.error || `Shared AI HTTP ${response.status}`);
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
        }
    }

    // Fallback bar with dynamic failure reason, Configure Key (if auth error), Retry AI, and Copy for AI
    function showAiFallbackBar(que, qData, promptText, onRetry, { reason = '', isAuthError = false, isRateLimit = false, waitSeconds = 0 } = {}) {
        que.querySelectorAll('.amaes-ai-fallback-bar').forEach(el => el.remove());
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

            let secLeft = waitSeconds;
            const timerEl = bar.querySelector('#amaes-ratelimit-countdown');
            const retryBtn = bar.querySelector('.amaes-ai-retry-btn');
            const copyBtn = bar.querySelector('.amaes-ai-copy-btn');

            if (copyBtn) {
                copyBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    copyToClipboard(promptText).then(() => {
                        showToast('Question copied for AI.');
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

        // Standard fallback bar
        bar.innerHTML = `
            <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 200px;">
                <span style="font-weight: 700;">Warning</span>
                <span style="font-weight: 600;">${displayReason}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                ${isAuthError ? `
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
                ">⚙ Configure Key</button>
                ` : ''}
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
                showGeminiSetupModal();
            };
        }

        const retryBtn = bar.querySelector('.amaes-ai-retry-btn');
        if (retryBtn && typeof onRetry === 'function') {
            retryBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                bar.remove();
                onRetry();
            };
        }

        const copyBtn = bar.querySelector('.amaes-ai-copy-btn');
        if (copyBtn) {
            copyBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                copyToClipboard(promptText).then(() => {
                    showToast('Question copied for AI.');
                }).catch(() => {});
            };
        }
    }

    // Handles thinking indicator, watchdog timeout, configurable retries, wrong choice elimination guard, session caching, and auto-copy on fail
    async function handleGeminiQuestionInference({ que, qData, promptText, onSuccess, onFallback }) {
        que.querySelectorAll('.amaes-ai-thinking-indicator, .amaes-ai-fallback-bar').forEach(el => el.remove());

        // A retry button or cooldown callback can outlive the question's
        // fallback UI. Never spend another request after the student answered.
        const existingAiChoiceBeforeRequest = que.querySelector('.amaes-ai-suggested-choice');
        if (isQuestionAnswered(que) && !existingAiChoiceBeforeRequest) {
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
        if (cachedAns && cachedAns.choiceText) {
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

        // 0.1 Rate Limit Guard: If user is on Free Tier and 15 RPM cap is reached or cooling down from 429:
        const rateLimitStatus = getAiRateLimitStatus();
        if (rateLimitStatus.isLimited) {
            if (getAiAutoCopyOnFail()) {
                copyToClipboard(promptText).catch(() => {});
            }
            const rlMsg = `Google is temporarily limiting AI requests. Available again in about ${rateLimitStatus.remainingSec} seconds.`;
            setLog(`[AI Rate Limit] Question #${qData ? qData.qNum : ''}: ${rlMsg} (Prompt copied)`, "var(--accent-amber)");
            showToast(`AI rate limit: available in ${rateLimitStatus.remainingSec}s`, 3500);

            showAiFallbackBar(que, qData, promptText, async () => {
                await handleGeminiQuestionInference({ que, qData, promptText, onSuccess, onFallback });
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

        while (attempt < maxAttempts && !answerText && !isAborted && !timedOut) {
            if (isQuestionAnswered(que) && !que.querySelector('.amaes-ai-suggested-choice')) {
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
                const res = await callGeminiApi({
                    apiKey: getAvailableGeminiKey(),
                    prompt: promptText,
                    maxOutputTokens: 64,
                    signal: abortCtrl.signal
                });
                if (res && res.text) {
                    answerText = res.text;
                    break;
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
                    if (!sharedFallbackAttempted && isSharedAiFallbackEnabled()) {
                        sharedFallbackAttempted = true;
                        const sharedStatusTextEl = thinkingEl.querySelector('.amaes-ai-status-text');
                        if (sharedStatusTextEl) {
                            sharedStatusTextEl.textContent = 'Your personal key is temporarily busy. Checking limited shared AI help...';
                        }
                        setLog('[AI Assistant] Your personal key is temporarily busy. Checking limited shared AI help; this may take a few seconds.', "var(--accent-blue)");
                        try {
                            const sharedResult = await callSharedAiFallback({
                                prompt: promptText,
                                maxOutputTokens: 64,
                                signal: abortCtrl.signal
                            });
                            if (sharedResult && sharedResult.text) {
                                answerText = sharedResult.text;
                                setLog('[AI Assistant] Shared AI help responded. The answer is still a suggestion—please review it.', "var(--accent-blue)");
                                break;
                            }
                        } catch (sharedError) {
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
                    setLog(`[AI Suggestion] Gemini suggested <b>${escapeHtml(cleaned)}</b> for #${qData ? qData.qNum : ''}. (Paused for review)`, "var(--accent-purple)");
                    showToast(`Gemini suggested: "${cleaned}" for #${qData ? qData.qNum : ''}.`, 3000);
                    if (typeof onSuccess === 'function') {
                        await onSuccess({ choiceText: cleaned, input: textInput });
                    }
                    return;
                }
            }

            // Check for Dropdown / Select elements (gapselect / matching)
            const selectInputs = Array.from(que.querySelectorAll('select'));
            if (selectInputs.length > 0 && (!qData.choices || qData.choices.length === 0)) {
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
                            copyToClipboard(promptText).catch(() => {});
                        }
                        showAiFallbackBar(que, qData, promptText, async () => {
                            await handleGeminiQuestionInference({ que, qData, promptText, onSuccess, onFallback });
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
                        mergeAnswersIntoCache(sCode, [{
                            qRaw: qData.qText,
                            qNorm: normalizeText(qData.qText),
                            ansRaw: rawAns,
                            ansNorm: normalizeChoice(rawAns),
                            choices: qData.choices,
                            verified: false,
                            isAiSuggestion: true,
                            source: 'Google Gemini AI'
                        }], 'Google Gemini AI');
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
                    copyToClipboard(promptText).catch(() => {});
                }
                showAiFallbackBar(que, qData, promptText, async () => {
                    await handleGeminiQuestionInference({ que, qData, promptText, onSuccess, onFallback });
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
            copyToClipboard(promptText).then(() => {
                showToast('Question copied to clipboard for external AI solving.', 3500);
            }).catch(() => {});
        }

        // Failure or timeout: inject fallback bar with clear reason and direct configure button if auth error
        showAiFallbackBar(que, qData, promptText, async () => {
            await handleGeminiQuestionInference({ que, qData, promptText, onSuccess, onFallback });
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
        badge.innerHTML = `${ICONS.sparkles} <span>AI Suggestion: <strong>${escapeHtml(answerText)}</strong></span>`;

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
            showToast("Gemini AI is not configured. Please set your free Google AI Studio key.", 3500);
            showGeminiSetupModal();
            return;
        }

        const qData = extractQuestionData(que);
        if (!qData) {
            showToast("Could not extract question content.", 3000);
            return;
        }

        que.dataset.amaesAiAttempted = 'true';

        // Update button text to loading state
        const cardAiBtn = que.querySelector('.amaes-ask-ai-card-btn');
        const blockageAiBtn = que.querySelector('#btn-blockage-ask-ai');
        if (cardAiBtn) cardAiBtn.innerHTML = `<span>Asking AI...</span>`;
        if (blockageAiBtn) blockageAiBtn.innerHTML = `<span>Asking AI...</span>`;

        const courseInfo = detectCourseInfo();
        const courseCode = courseInfo.subjectCode || '';
        const promptText = buildGeminiCompactPrompt(qData, courseCode, que);

        await handleGeminiQuestionInference({
            que,
            qData,
            promptText,
            onSuccess: async (matched) => {
                if (matched && matched.choiceText) {
                    recordAttemptAnswerEvidence(que, matched.choiceText, 'ai_inference');
                }
                que.querySelectorAll('.amaes-blockage-hud, .amaes-unanswered-hint').forEach(el => el.remove());
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

                if (cardAiBtn) cardAiBtn.innerHTML = `${ICONS.sparkles} <span>Retry AI</span>`;
                if (blockageAiBtn) blockageAiBtn.innerHTML = `${ICONS.sparkles} <span>Retry AI</span>`;
                showToast(`Gemini resolved Question #${qData ? qData.qNum : ''}!`, 3000);
            },
            onFallback: () => {
                if (cardAiBtn) cardAiBtn.innerHTML = `${ICONS.sparkles} <span>Retry AI</span>`;
                if (blockageAiBtn) blockageAiBtn.innerHTML = `${ICONS.sparkles} <span>Retry AI</span>`;
            }
        });

        if (cardAiBtn && cardAiBtn.innerHTML.includes('Asking AI...')) {
            cardAiBtn.innerHTML = `${ICONS.sparkles} <span>Retry AI</span>`;
        }
        if (blockageAiBtn && blockageAiBtn.innerHTML.includes('Asking AI...')) {
            blockageAiBtn.innerHTML = `${ICONS.sparkles} <span>Retry AI</span>`;
        }
    }

    // Non-tech student setup modal for Google AI Studio API key
    function showGeminiSetupModal() {
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
                        <span style="font-weight: 800; font-size: 13.5px; color: #f8fafc;">Setup Free Google Gemini AI</span>
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
                    <div style="font-size: 11.5px; color: var(--text-secondary, #cbd5e1); line-height: 1.45;">
                        Get instant answers on uncertain questions directly in your quiz.
                        <span style="color: #34d399; font-weight: 600;">100% Free</span> with your personal Google account. 
                        <span style="color: #a78bfa; font-weight: 600;">0 tokens used</span> on questions already in the verified database.
                    </div>

                    <!-- 4 Steps -->
                    <div style="display: flex; flex-direction: column; gap: 10px; background: var(--bg, #0f172a); padding: 12px; border-radius: 8px; border: 1px solid var(--border-subtle, #334155);">
                        <div style="display: flex; align-items: flex-start; gap: 8px;">
                            <span style="background: #7c3aed; color: #fff; font-weight: 800; font-size: 10px; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">1</span>
                            <div>
                                <span style="font-weight: 600; color: #f8fafc;">Open Google AI Studio</span>
                                <div style="margin-top: 4px;">
                                    <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" style="
                                        display: inline-flex;
                                        align-items: center;
                                        gap: 5px;
                                        background: #4f46e5;
                                        color: #fff;
                                        text-decoration: none;
                                        padding: 5px 10px;
                                        border-radius: 5px;
                                        font-size: 11px;
                                        font-weight: 700;
                                    ">
                                        ${ICONS.external} <span>Open Google AI Studio (Free)</span>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <div style="display: flex; align-items: flex-start; gap: 8px;">
                            <span style="background: #7c3aed; color: #fff; font-weight: 800; font-size: 10px; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">2</span>
                            <div style="color: var(--text-secondary, #cbd5e1); font-size: 11.5px;">Sign in with any standard Google or Gmail account.</div>
                        </div>

                        <div style="display: flex; align-items: flex-start; gap: 8px;">
                            <span style="background: #7c3aed; color: #fff; font-weight: 800; font-size: 10px; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">3</span>
                            <div style="color: var(--text-secondary, #cbd5e1); font-size: 11.5px;">
                                Click <b>"Create API Key"</b> and copy your key.<br>
                                <span style="font-size: 10.5px; color: #a78bfa;">(Tip: If prompted, select "Create API key in new project" for automatic free setup)</span>
                            </div>
                        </div>

                        <div style="display: flex; align-items: flex-start; gap: 8px;">
                            <span style="background: #7c3aed; color: #fff; font-weight: 800; font-size: 10px; border-radius: 50%; width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px;">4</span>
                            <div style="flex: 1;">
                                <span style="font-weight: 600; color: #f8fafc;">Paste your key(s) here:</span>
                                <!-- Speed explanation box -->
                                <div id="amaes-multikey-explain" style="margin: 6px 0; padding: 7px 10px; background: rgba(124,58,237,0.10); border: 1px solid rgba(168,85,247,0.35); border-radius: 6px; font-size: 10px; color: #c4b5fd; line-height: 1.5;">
                                    <b style="color:#e9d5ff;">Optional backup key</b><br>
                                    You normally need only one key. Add another key that you own if Google temporarily limits the first one. The toolkit tries keys one at a time and respects Google's limits; adding keys is optional and does not bypass Google's rules.
                                </div>
                                <!-- Dynamic key rows rendered by JS -->
                                <div id="amaes-gemini-key-rows" style="display: flex; flex-direction: column; gap: 5px; margin-top: 4px;"></div>
                                <button id="amaes-gemini-btn-add-key" type="button" style="
                                    margin-top: 6px;
                                    background: transparent;
                                    border: 1px dashed rgba(168,85,247,0.5);
                                    color: #a78bfa;
                                    border-radius: 5px;
                                    font-size: 10px;
                                    font-weight: 700;
                                    padding: 4px 10px;
                                    cursor: pointer;
                                    width: 100%;
                                ">+ Add Optional Backup Key</button>
                            </div>
                        </div>

                        <div style="display: flex; align-items: center; justify-content: space-between; padding: 6px 10px; background: rgba(0,0,0,0.2); border-radius: 6px; border: 1px solid var(--border-subtle, #334155);">
                            <div>
                                <span style="font-weight: 600; color: #f8fafc; font-size: 11px;">Google AI plan:</span>
                                <div style="font-size: 9.5px; color: var(--text-muted, #94a3b8);">Choose the plan that matches your Google AI Studio account. The toolkit handles waiting automatically.</div>
                            </div>
                            <select id="amaes-gemini-plan-select" style="
                                background: var(--surface, #1e293b);
                                color: #f8fafc;
                                border: 1px solid var(--border, #334155);
                                padding: 4px 8px;
                                border-radius: 5px;
                                font-size: 10.5px;
                                cursor: pointer;
                            ">
                                <option value="free" ${getAiPlanTier() === 'free' ? 'selected' : ''}>Free plan</option>
                                <option value="paid" ${getAiPlanTier() === 'paid' ? 'selected' : ''}>Paid plan</option>
                            </select>
                        </div>

                        <label style="display:flex; gap:9px; align-items:flex-start; padding:9px 10px; background:rgba(16,185,129,0.08); border:1px solid rgba(16,185,129,0.3); border-radius:6px; cursor:pointer;">
                            <input id="amaes-shared-ai-fallback" type="checkbox" ${isSharedAiFallbackEnabled() ? 'checked' : ''} style="margin-top:2px; accent-color:#10b981;">
                            <span style="font-size:10.5px; color:#d1fae5; line-height:1.5;">
                                <b style="color:#6ee7b7;">Use shared AI help if my key is temporarily busy</b><br>
                                This is turned on by default. If Google temporarily limits your personal key, the toolkit may try a small, project-managed shared pool so you do not have to wait. This does <b>not</b> upload or share your personal key. Shared capacity is limited, so it may still be unavailable. Your personal key is always tried first. Turn this off if you do not want shared AI fallback.
                            </span>
                        </label>
                        <label style="display:flex; gap:9px; align-items:flex-start; padding:9px 10px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.35); border-radius:6px; cursor:pointer;">
                            <input id="amaes-contributor-sharing" type="checkbox" ${isContributorSharingEnabled() ? 'checked' : ''} style="margin-top:2px; accent-color:#f59e0b;">
                            <span style="font-size:10.5px; color:#fef3c7; line-height:1.5;">
                                <b style="color:#fbbf24;">Share my key when I am inactive (optional)</b><br>
                                If checked, saving this key is your consent to encrypted contributor sharing. It stays reserved for you while you are using AMAES, may help another user only after your short inactive grace period, and is automatically deleted after 30 days without activity. You can turn this off and delete it anytime.
                                <a href="https://github.com/Acads-Tools/database/blob/main/relay/README.md#contributor-key-sharing" target="_blank" rel="noopener noreferrer" style="color:#fcd34d; text-decoration:underline; margin-left:3px;">Read sharing details</a>
                            </span>
                        </label>
                    </div>

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
                            ">Test & Save Key</button>
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
                    ${idx > 0 ? `<button type="button" class="amaes-key-remove-btn" style="background:transparent; border:1px solid rgba(239,68,68,0.35); color:#f87171; border-radius:5px; padding:4px 8px; font-size:10px; cursor:pointer;">✕</button>` : ''}
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

        if (removeBtn) {
            removeBtn.onclick = () => {
                deleteContributorKey().catch(() => {});
                setGeminiApiKeys([]);
                showToast('Gemini API key removed.');
                closeModal();
            };
        }

        if (testSaveBtn && feedback) {
            testSaveBtn.onclick = async () => {
                const allKeyVals = Array.from(keyRowsContainer.querySelectorAll('.amaes-key-row input'))
                    .map(inp => inp.value.trim())
                    .filter(Boolean);
                const rawKey = allKeyVals[0] || '';
                if (!rawKey) {
                    feedback.style.display = 'block';
                    feedback.style.background = 'rgba(239, 68, 68, 0.15)';
                    feedback.style.color = '#f87171';
                    feedback.style.border = '1px solid rgba(239, 68, 68, 0.3)';
                    feedback.innerText = 'Please paste or type your Gemini API key first.';
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

