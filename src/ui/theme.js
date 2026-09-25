    // ==========================================
    // Theme Management
    // ==========================================

    const THEMES = {
        dark: {
            bg: "#18181b",
            surface: "#27272a",
            surfaceSubtle: "#202023",
            border: "#3f3f46",
            borderSubtle: "#2e2e33",
            textPrimary: "#f4f4f5",
            textSecondary: "#a1a1aa",
            textMuted: "#71717a",
            accentBlue: "#3b82f6",
            accentBlueHover: "#2563eb",
            accentPink: "#f43f5e",
            accentPinkHover: "#e11d48",
            accentPurple: "#a855f7",
            accentPurpleHover: "#9333ea",
            accentGreen: "#10b981",
            accentGreenHover: "#059669",
            accentAmber: "#f59e0b",
            accentGray: "#52525b",
            shadow: "0 14px 36px rgba(0, 0, 0, 0.45)",
            statusBg: "#111114"
        },
        light: {
            bg: "#ffffff",
            surface: "#f4f4f5",
            surfaceSubtle: "#fafafa",
            border: "#e4e4e7",
            borderSubtle: "#ececee",
            textPrimary: "#18181b",
            textSecondary: "#52525b",
            textMuted: "#71717a",
            accentBlue: "#2563eb",
            accentBlueHover: "#1d4ed8",
            accentPink: "#e11d48",
            accentPinkHover: "#be123c",
            accentPurple: "#7c3aed",
            accentPurpleHover: "#6d28d9",
            accentGreen: "#059669",
            accentGreenHover: "#047857",
            accentAmber: "#d97706",
            accentGray: "#e4e4e7",
            shadow: "0 14px 36px rgba(0, 0, 0, 0.12)",
            statusBg: "#f8fafc"
        }
    };

    let currentTheme = localStorage.getItem('amaes_toolkit_theme') || 'dark';
    if (!THEMES[currentTheme]) currentTheme = 'dark';

    let autoHighlightQuiz = localStorage.getItem('amaes_auto_highlight_quiz') !== 'false'; // default true
    let autoCopyQuizForAI = localStorage.getItem('amaes_auto_copy_ai') !== 'false'; // default true
    let autoQuizMode = localStorage.getItem('amaes_auto_quiz_mode') === 'true'; // default false (Master autonomous switch)
    let autoPickQuiz = localStorage.getItem('amaes_auto_pick_quiz') !== 'false'; // default true: auto-select verified answers
    let autoNextVerified = localStorage.getItem('amaes_auto_next_verified') !== 'false'; // default true: auto-advance when solver answers verified question
    let autoNextQuiz = localStorage.getItem('amaes_auto_next_quiz') === 'true'; // default false: manual answers do NOT auto-advance by default (safe review)
    let isWaitingForUserAnswer = false; // session state: true when paused on an unknown question waiting for student input
    const autoSubmitQuiz = false; // Permanently disabled by design: safe manual review before final submission
    let autoNextTimer = null;
    let pageLoadSolverTimer = null;
    let smartSkipQuiz = localStorage.getItem('amaes_smart_skip_quiz') !== 'false'; // default true: skip answered questions
    let autoCloudSync = localStorage.getItem('amaes_auto_cloud_sync') !== 'false'; // default true
    let autoScrapeAmauoed = localStorage.getItem('amaes_auto_scrape_amauoed') !== 'false'; // default true
    let autoHarvestGrades = localStorage.getItem('amaes_auto_harvest_grades') !== 'false'; // default true: auto-harvest past quizzes on course/grades open
    let storedCloudDbUrl = localStorage.getItem('amaes_cloud_db_url');
    if (storedCloudDbUrl && storedCloudDbUrl.includes('lms-study-hub')) {
        storedCloudDbUrl = storedCloudDbUrl.replace('lms-study-hub', 'Acads-Tools');
        localStorage.setItem('amaes_cloud_db_url', storedCloudDbUrl);
    }
    let cloudDbBaseUrl = storedCloudDbUrl || 'https://raw.githubusercontent.com/Acads-Tools/database/main/data/verified/';
    const communityDbBaseUrl = 'https://raw.githubusercontent.com/Acads-Tools/database/main/data/community/';
    const CLOUD_DB_FALLBACK_URL = 'https://raw.githubusercontent.com/Acads-Tools/database/main/data/';
    const CLOUD_DB_AMAUOED_URL = 'https://raw.githubusercontent.com/Acads-Tools/database/main/data/amauoed/';
    const DEFAULT_COMMUNITY_RELAY_URL = COMMUNITY_RELAY_URL;
    let storedRelayUrl = localStorage.getItem('amaes_community_relay_url');
    if (storedRelayUrl && (!storedRelayUrl.includes('acads-tools.workers.dev') || storedRelayUrl === 'https://amaes-community-relay.workers.dev')) {
        localStorage.removeItem('amaes_community_relay_url');
        storedRelayUrl = null;
    }
    let communityRelayUrl = storedRelayUrl || DEFAULT_COMMUNITY_RELAY_URL;

    // A random, non-identifying installation token lets the relay deduplicate
    // retries and count distinct contributors without receiving account data.
    function getAnonymousContributorId() {
        let contributorId = localStorage.getItem(CONTRIBUTOR_ID_STORAGE_KEY);
        if (!contributorId) {
            contributorId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
                ? crypto.randomUUID()
                : `anon-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            localStorage.setItem(CONTRIBUTOR_ID_STORAGE_KEY, contributorId);
        }
        return contributorId;
    }
    let aiPromptHint = localStorage.getItem('amaes_ai_prompt_hint') !== 'false'; // default true for clean a/b/c/d answers
    let copyIncludeConfidence = localStorage.getItem('amaes_copy_include_confidence') !== 'false'; // default true: include DB answer hints & confidence
    let showInQuestionAiBtns = localStorage.getItem('amaes_show_in_question_ai_btns') !== 'false'; // default true
    let enableKeyboardShortcuts = localStorage.getItem('amaes_enable_hotkeys') !== 'false'; // default true: N, Space, 1-4, C, P, H
    let autoCommunityShare = localStorage.getItem('amaes_auto_community_share') !== 'false'; // default true: auto-share on review / harvest
    let autoMinimizeQuiz = localStorage.getItem('amaes_auto_min_quiz') !== 'false'; // default true: smart pill in quiz
    let enableAudioAlerts = localStorage.getItem('amaes_enable_audio_alerts') !== 'false'; // default true: audio chime on quiz completion & intervention alert

    const GEMINI_API_KEY_STORAGE_KEY = 'amaes_gemini_api_key';
    const GEMINI_API_KEYS_STORAGE_KEY = 'amaes_gemini_api_keys';
    const GEMINI_MODEL = 'gemini-1.5-flash';
    const GEMINI_TIMEOUT_MS = 8000;
    const SHARED_AI_FALLBACK_STORAGE_KEY = 'amaes_shared_ai_fallback_enabled';
    const CONTRIBUTOR_KEY_ID_STORAGE_KEY = 'amaes_contributor_key_id';
    const CONTRIBUTOR_OWNER_TOKEN_STORAGE_KEY = 'amaes_contributor_owner_token';
    const CONTRIBUTOR_MODE_STORAGE_KEY = 'amaes_contributor_mode';
    const CONTRIBUTOR_KEY_FINGERPRINT_STORAGE_KEY = 'amaes_contributor_key_fingerprint';
    const CONTRIBUTOR_ACTIVITY_SENT_STORAGE_KEY = 'amaes_contributor_activity_sent';

    function getContributorValue(key) {
        try {
            if (typeof GM_getValue === 'function') return GM_getValue(key, '');
        } catch (_) {}
        return localStorage.getItem(key) || '';
    }

    function setContributorValue(key, value) {
        try {
            if (typeof GM_setValue === 'function') {
                GM_setValue(key, value);
                return;
            }
        } catch (_) {}
        localStorage.setItem(key, value);
    }

    function removeContributorValue(key) {
        try {
            if (typeof GM_deleteValue === 'function') {
                GM_deleteValue(key);
                return;
            }
        } catch (_) {}
        localStorage.removeItem(key);
    }

    function isContributorSharingEnabled() {
        return getContributorValue(CONTRIBUTOR_MODE_STORAGE_KEY) === 'contributor' &&
            Boolean(getContributorValue(CONTRIBUTOR_KEY_ID_STORAGE_KEY)) &&
            Boolean(getContributorValue(CONTRIBUTOR_OWNER_TOKEN_STORAGE_KEY));
    }

    function createContributorOwnerToken() {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async function contributorKeyFingerprint(value) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
        return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async function deleteContributorKey() {
        const keyId = getContributorValue(CONTRIBUTOR_KEY_ID_STORAGE_KEY);
        const ownerToken = getContributorValue(CONTRIBUTOR_OWNER_TOKEN_STORAGE_KEY);
        if (!keyId || !ownerToken) return;
        try {
            await fetch(`${communityRelayUrl}/keys/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-AMAES-Client-Version': CLIENT_VERSION,
                    'X-AMAES-Owner-Token': ownerToken
                },
                body: JSON.stringify({ keyId })
            });
        } catch (_) {
            // Local removal still prevents this installation from using the credential.
        }
        [CONTRIBUTOR_KEY_ID_STORAGE_KEY, CONTRIBUTOR_OWNER_TOKEN_STORAGE_KEY,
            CONTRIBUTOR_MODE_STORAGE_KEY, CONTRIBUTOR_KEY_FINGERPRINT_STORAGE_KEY,
            CONTRIBUTOR_ACTIVITY_SENT_STORAGE_KEY]
            .forEach(removeContributorValue);
    }

    async function registerContributorKey(geminiKey) {
        const ownerToken = createContributorOwnerToken();
        const response = await fetch(`${communityRelayUrl}/keys/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-AMAES-Client-Version': CLIENT_VERSION
            },
            body: JSON.stringify({
                geminiKey,
                ownerToken,
                consent: true,
                mode: 'contributor'
            })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.keyId) {
            throw new Error(data.error || `Contributor registration failed (${response.status})`);
        }
        setContributorValue(CONTRIBUTOR_KEY_ID_STORAGE_KEY, data.keyId);
        setContributorValue(CONTRIBUTOR_OWNER_TOKEN_STORAGE_KEY, ownerToken);
        setContributorValue(CONTRIBUTOR_MODE_STORAGE_KEY, 'contributor');
        setContributorValue(CONTRIBUTOR_KEY_FINGERPRINT_STORAGE_KEY, await contributorKeyFingerprint(geminiKey));
        return data;
    }

    async function noteContributorActivity() {
        if (!isContributorSharingEnabled()) return;
        const lastSent = Number(getContributorValue(CONTRIBUTOR_ACTIVITY_SENT_STORAGE_KEY) || 0);
        if (Date.now() - lastSent < 10 * 60 * 1000) return;
        const keyId = getContributorValue(CONTRIBUTOR_KEY_ID_STORAGE_KEY);
        const ownerToken = getContributorValue(CONTRIBUTOR_OWNER_TOKEN_STORAGE_KEY);
        try {
            const response = await fetch(`${communityRelayUrl}/keys/activity`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-AMAES-Client-Version': CLIENT_VERSION,
                    'X-AMAES-Owner-Token': ownerToken
                },
                body: JSON.stringify({ keyId })
            });
            if (response.ok) setContributorValue(CONTRIBUTOR_ACTIVITY_SENT_STORAGE_KEY, String(Date.now()));
        } catch (_) {
            // A failed activity update never affects the local personal-key request.
        }
    }

    function isSharedAiFallbackEnabled() {
        return localStorage.getItem(SHARED_AI_FALLBACK_STORAGE_KEY) !== 'false';
    }

    function setSharedAiFallbackEnabled(enabled) {
        localStorage.setItem(SHARED_AI_FALLBACK_STORAGE_KEY, enabled ? 'true' : 'false');
    }

    function getGeminiApiKeys() {
        try {
            const raw = localStorage.getItem(GEMINI_API_KEYS_STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    const clean = parsed.map(k => (k || '').trim()).filter(Boolean);
                    if (clean.length > 0) return clean;
                }
            }
        } catch (_) {}
        const single = (localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '').trim();
        return single ? [single] : [];
    }

    function setGeminiApiKeys(keys) {
        const clean = Array.isArray(keys) ? keys.map(k => (k || '').trim()).filter(Boolean) : [];
        if (clean.length > 0) {
            try {
                localStorage.setItem(GEMINI_API_KEYS_STORAGE_KEY, JSON.stringify(clean));
            } catch (_) {}
            localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, clean[0]);
            geminiApiKey = clean[0];
        } else {
            localStorage.removeItem(GEMINI_API_KEYS_STORAGE_KEY);
            localStorage.removeItem(GEMINI_API_KEY_STORAGE_KEY);
            geminiApiKey = '';
        }
        updateAiAssistantUI();
    }

    let geminiApiKey = (getGeminiApiKeys()[0] || '');
    let aiQuizEnabled = localStorage.getItem('amaes_ai_quiz_enabled') !== 'false'; // default true
    let aiAutoSelect = localStorage.getItem('amaes_ai_auto_select') !== 'false'; // default true: auto-select AI suggestion
    let aiRetryCount = parseInt(localStorage.getItem('amaes_ai_retry_count') || '2', 10);
    if (isNaN(aiRetryCount) || aiRetryCount < 1) aiRetryCount = 2;
    let aiAutoCopyOnFail = localStorage.getItem('amaes_ai_auto_copy_on_fail') !== 'false'; // default true: auto-copy on fail
    const aiAnswerSessionCache = new Map(); // In-memory session cache for instant reuse
    let activeAiAbortController = null;

    function getAiRetryCount() {
        const val = parseInt(localStorage.getItem('amaes_ai_retry_count') || '2', 10);
        return (isNaN(val) || val < 1) ? 2 : Math.min(5, val);
    }

    function setAiRetryCount(val) {
        aiRetryCount = Math.max(1, Math.min(5, parseInt(val, 10) || 2));
        localStorage.setItem('amaes_ai_retry_count', String(aiRetryCount));
    }

    function getAiAutoCopyOnFail() {
        return localStorage.getItem('amaes_ai_auto_copy_on_fail') !== 'false';
    }

    function setAiAutoCopyOnFail(val) {
        aiAutoCopyOnFail = Boolean(val);
        localStorage.setItem('amaes_ai_auto_copy_on_fail', aiAutoCopyOnFail ? 'true' : 'false');
    }

    let aiAutoNextOnAiAnswer = localStorage.getItem('amaes_ai_auto_next_on_ai') !== 'false'; // default true
    function getAiAutoNextOnAiAnswer() { return localStorage.getItem('amaes_ai_auto_next_on_ai') !== 'false'; }
    function setAiAutoNextOnAiAnswer(val) { aiAutoNextOnAiAnswer = Boolean(val); localStorage.setItem('amaes_ai_auto_next_on_ai', aiAutoNextOnAiAnswer ? 'true' : 'false'); }

    const GEMINI_FREE_RPM = 15; // 15 requests per minute limit on Google AI Studio Free Tier
    let aiPlanTier = localStorage.getItem('amaes_ai_plan_tier') || 'free'; // 'free' or 'paid'
    let aiRateLimitCooldownUntil = 0;
    try {
        const storedCooldown = parseInt(sessionStorage.getItem('amaes_ai_cooldown_until') || '0', 10);
        if (storedCooldown > Date.now()) aiRateLimitCooldownUntil = storedCooldown;
    } catch (_) {}
    let activeRateLimitTimerInterval = null;

    function getAiPlanTier() {
        return localStorage.getItem('amaes_ai_plan_tier') || 'free';
    }

    function setAiPlanTier(tier) {
        aiPlanTier = tier === 'paid' ? 'paid' : 'free';
        localStorage.setItem('amaes_ai_plan_tier', aiPlanTier);
    }

    function getAiKeyId(key) {
        if (!key) return 'primary';
        return key.length > 8 ? key.slice(-8) : key;
    }

    function getStoredRequestTimestamps() {
        const key = arguments[0] || null;
        try {
            const storageKey = key ? `amaes_ai_req_timestamps_${getAiKeyId(key)}` : 'amaes_ai_req_timestamps';
            const raw = sessionStorage.getItem(storageKey);
            if (raw) {
                const arr = JSON.parse(raw);
                if (Array.isArray(arr)) {
                    const cutoff = Date.now() - 60000;
                    return arr.filter(t => typeof t === 'number' && t > cutoff);
                }
            }
        } catch (_) {}
        return [];
    }

    function saveRequestTimestamps(arr, key = null) {
        try {
            const storageKey = key ? `amaes_ai_req_timestamps_${getAiKeyId(key)}` : 'amaes_ai_req_timestamps';
            sessionStorage.setItem(storageKey, JSON.stringify(arr));
        } catch (_) {}
    }

    function recordAiRequest() {
        const key = arguments[0] || null;
        const now = Date.now();
        const cutoff = now - 60000;
        
        // Always maintain global timestamps for backwards compatibility
        const currentGlobal = getStoredRequestTimestamps(null).filter(t => t > cutoff);
        currentGlobal.push(now);
        saveRequestTimestamps(currentGlobal, null);

        // Also record per-key if key provided
        if (key) {
            const currentPerKey = getStoredRequestTimestamps(key).filter(t => t > cutoff);
            currentPerKey.push(now);
            saveRequestTimestamps(currentPerKey, key);
        }
    }

    function triggerAiRateLimitCooldown(suggestedWaitSec = 20) {
        const key = arguments[1] || null;
        const waitSec = Math.max(5, Math.min(60, suggestedWaitSec));
        const cooldownUntil = Date.now() + (waitSec * 1000);
        aiRateLimitCooldownUntil = Math.max(aiRateLimitCooldownUntil, cooldownUntil);
        try {
            sessionStorage.setItem('amaes_ai_cooldown_until', String(aiRateLimitCooldownUntil));
            if (key) {
                sessionStorage.setItem(`amaes_ai_cooldown_${getAiKeyId(key)}`, String(cooldownUntil));
            }
        } catch (_) {}
        return Math.ceil((aiRateLimitCooldownUntil - Date.now()) / 1000);
    }

    function getKeyRateLimitStatus(key) {
        const now = Date.now();
        const keyId = getAiKeyId(key);
        let cooldownUntil = 0;
        try {
            const stored = parseInt(sessionStorage.getItem(`amaes_ai_cooldown_${keyId}`) || '0', 10);
            if (stored > now) cooldownUntil = stored;
        } catch (_) {}

        if (cooldownUntil > now) {
            const remainingSec = Math.max(1, Math.ceil((cooldownUntil - now) / 1000));
            return { isLimited: true, remainingSec, reason: 'cooldown', key };
        }

        if (getAiPlanTier() === 'free') {
            const timestamps = getStoredRequestTimestamps(key);
            if (timestamps.length >= GEMINI_FREE_RPM) {
                const oldest = timestamps[0];
                const remainingSec = Math.max(1, Math.ceil((oldest + 60000 - now) / 1000));
                return { isLimited: true, remainingSec, reason: 'rpm_cap', key };
            }
        }

        return { isLimited: false, remainingSec: 0, reason: null, key };
    }

    function getAiRateLimitStatus() {
        const now = Date.now();
        try {
            const storedCooldown = parseInt(sessionStorage.getItem('amaes_ai_cooldown_until') || '0', 10);
            if (storedCooldown > aiRateLimitCooldownUntil) aiRateLimitCooldownUntil = storedCooldown;
        } catch (_) {}

        const keys = typeof getGeminiApiKeys === 'function' ? getGeminiApiKeys() : [];

        // Single key or unconfigured: standard global behavior
        if (keys.length <= 1) {
            if (aiRateLimitCooldownUntil > now) {
                const remainingSec = Math.max(1, Math.ceil((aiRateLimitCooldownUntil - now) / 1000));
                return { isLimited: true, remainingSec, reason: 'cooldown', activeKey: keys[0] || null };
            }

            if (getAiPlanTier() === 'free') {
                const timestamps = getStoredRequestTimestamps();
                if (timestamps.length >= GEMINI_FREE_RPM) {
                    const oldest = timestamps[0];
                    const remainingSec = Math.max(1, Math.ceil((oldest + 60000 - now) / 1000));
                    return { isLimited: true, remainingSec, reason: 'rpm_cap', activeKey: keys[0] || null };
                }
            }

            return { isLimited: false, remainingSec: 0, reason: null, activeKey: keys[0] || null };
        }

        // Multiple keys: check each key individually
        const statuses = keys.map(k => getKeyRateLimitStatus(k));
        const available = statuses.filter(s => !s.isLimited);

        if (available.length > 0) {
            // Sort by request count in last 60s (least loaded key first for optimal load-balancing)
            available.sort((a, b) => {
                const countA = getStoredRequestTimestamps(a.key).length;
                const countB = getStoredRequestTimestamps(b.key).length;
                return countA - countB;
            });
            return {
                isLimited: false,
                remainingSec: 0,
                reason: null,
                activeKey: available[0].key,
                availableCount: available.length,
                totalKeys: keys.length
            };
        }

        // All keys limited: find soonest recovery time
        const minWait = Math.min(...statuses.map(s => s.remainingSec));
        return {
            isLimited: true,
            remainingSec: Math.max(1, minWait),
            reason: 'all_keys_limited',
            availableCount: 0,
            totalKeys: keys.length
        };
    }

    function getAvailableGeminiKey() {
        const keys = getGeminiApiKeys();
        if (keys.length === 0) return '';
        if (keys.length === 1) return keys[0];

        const status = getAiRateLimitStatus();
        if (!status.isLimited && status.activeKey) {
            return status.activeKey;
        }
        return keys[0];
    }

    function getAiSessionCacheStorageKey() {
        return `amaes_ai_session_cache_${getQuizSessionKey()}`;
    }

    function saveAiAnswerToCache(qData, matched) {
        if (!qData || !matched) return;
        const qKey = normalizeText(qData.qText || '');
        if (!qKey) return;
        const record = {
            choiceIndex: matched.choiceIndex,
            choiceText: matched.choiceText,
            timestamp: Date.now()
        };
        aiAnswerSessionCache.set(qKey, record);
        try {
            const raw = sessionStorage.getItem(getAiSessionCacheStorageKey());
            const cacheObj = raw ? JSON.parse(raw) : {};
            cacheObj[qKey] = record;
            sessionStorage.setItem(getAiSessionCacheStorageKey(), JSON.stringify(cacheObj));
        } catch (_) {}
    }

    function getCachedAiAnswer(qData) {
        if (!qData) return null;
        const qKey = normalizeText(qData.qText || '');
        if (!qKey) return null;
        if (aiAnswerSessionCache.has(qKey)) {
            return aiAnswerSessionCache.get(qKey);
        }
        try {
            const raw = sessionStorage.getItem(getAiSessionCacheStorageKey());
            if (raw) {
                const cacheObj = JSON.parse(raw);
                if (cacheObj && cacheObj[qKey]) {
                    aiAnswerSessionCache.set(qKey, cacheObj[qKey]);
                    return cacheObj[qKey];
                }
            }
        } catch (_) {}
        return null;
    }

    function isChoiceRowEliminated(row) {
        if (!row) return false;
        if (row.classList && row.classList.contains('amaes-eliminated-choice')) return true;
        if (row.querySelector && row.querySelector('.amaes-eliminated-badge')) return true;
        const label = row.querySelector ? (row.querySelector('label') || row) : row;
        if (label && label.style && label.style.textDecoration && label.style.textDecoration.includes('line-through')) return true;
        if (typeof hasChoiceCross === 'function' && (hasChoiceCross(row) || hasChoiceCross(label))) return true;
        return false;
    }

    function getEliminatedChoicesForQuestion(que, qData, courseCode = '') {
        const eliminatedTexts = new Set();
        if (que) {
            const choiceRows = que.querySelectorAll('.answer > div, .answer div.r0, .answer div.r1, .answer li, .answer tr, .answer label');
            choiceRows.forEach(r => {
                if (isChoiceRowEliminated(r)) {
                    const lbl = r.querySelector('label') || r;
                    const txt = normalizeChoice(cleanDOMToAI(lbl));
                    if (txt) eliminatedTexts.add(txt);
                }
            });
        }
        if (courseCode) {
            try {
                const cached = getCachedAnswers(courseCode);
                if (Array.isArray(cached) && qData && qData.qText) {
                    const qNorm = normalizeText(qData.qText);
                    const candidates = cached.filter(item => questionTextMatches(item.qNorm || item.qRaw || item.question, qNorm));
                    candidates.forEach(cand => {
                        if (Array.isArray(cand.wrongAnswers)) {
                            cand.wrongAnswers.forEach(w => {
                                const wNorm = typeof w === 'string' ? normalizeChoice(w) : (w.norm || normalizeChoice(w.text || ''));
                                if (wNorm) eliminatedTexts.add(wNorm);
                            });
                        }
                    });
                }
            } catch (_) {}
        }
        return eliminatedTexts;
    }

