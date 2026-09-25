(function () {
    'use strict';

    const SCRIPT_VERSION = "v1.8.2";
    const CLIENT_VERSION = SCRIPT_VERSION.replace(/^v/i, '');
    const COMMUNITY_RELAY_URL = 'https://amaes-community-relay.acads-tools.workers.dev';
    const ANSWER_DB_SCHEMA_VERSION = 2;
    const CONTRIBUTOR_ID_STORAGE_KEY = 'amaes_anonymous_contributor_id';

    // The installer page uses a same-page event as a privacy-safe installation check.
    if (window.location.hostname === 'acads-tools.github.io' &&
        window.location.pathname.startsWith('/amaes-toolkit')) {
        document.documentElement.setAttribute(
            'data-amaes-toolkit-version',
            SCRIPT_VERSION.replace(/^v/, '')
        );
        document.dispatchEvent(new CustomEvent('amaes-toolkit-detected', {
            detail: { version: SCRIPT_VERSION.replace(/^v/, '') }
        }));
        return;
    }

    // STRICT DOMAIN LOCK: Ensure execution ONLY on semestral.amaes.com
    if (window.location.hostname !== 'semestral.amaes.com') {
        return;
    }

    function compareVersions(left, right) {
        const a = String(left || '').trim().replace(/^v/i, '').split('.').map(Number);
        const b = String(right || '').trim().replace(/^v/i, '').split('.').map(Number);
        if (a.length !== 3 || b.length !== 3 || a.some(Number.isNaN) || b.some(Number.isNaN)) return null;
        for (let i = 0; i < 3; i += 1) {
            if (a[i] !== b[i]) return a[i] > b[i] ? 1 : -1;
        }
        return 0;
    }

    function showCompatibilityBlock(reason, minimumVersion = null) {
        const required = minimumVersion || 'the latest supported version';
        document.getElementById('amaes-compat-banner')?.remove();

        // Close and remove any open toolkit panels, modals, quick info, settings, and HUDs
        const toolkitSelectors = [
            '#amaes-panel',
            '#amaes-welcome-modal',
            '#amaes-gemini-modal',
            '#amaes-contribute-modal',
            '#amaes-dev-modal',
            '#amaes-quiz-hud',
            '#amaes-capability-tip',
            '#amaes-full-qr-modal',
            '.amaes-blockage-hud'
        ];
        toolkitSelectors.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => el.remove());
        });

        const banner = document.createElement('div');
        banner.id = 'amaes-compat-banner';
        banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999999;background:#0f172a;border-bottom:2px solid #ef4444;color:#f8fafc;padding:10px 16px;display:flex;align-items:center;justify-content:space-between;box-shadow:0 4px 12px rgba(0,0,0,0.3);font-family:system-ui,sans-serif;font-size:14px;';
        banner.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px">
                <span style="font-size:16px">⚠️</span>
                <span>Update to v${required} to use the tool</span>
            </div>
            <a href="${SCRIPT_RAW_URL}" target="_blank" rel="noopener noreferrer"
               style="padding:6px 14px;background:#2563eb;color:#ffffff;border-radius:6px;text-decoration:none;font-weight:600;font-size:13px;white-space:nowrap">
               Update Now
            </a>
        `;
        if (document.body) {
            document.body.prepend(banner);
        } else {
            document.addEventListener('DOMContentLoaded', () => document.body?.prepend(banner));
        }
    }

    async function verifyClientCompatibility() {
        try {
            const cachedMin = localStorage.getItem('amaes_cached_min_version');
            if (cachedMin) {
                const cachedComparison = compareVersions(CLIENT_VERSION, cachedMin);
                if (cachedComparison !== null && cachedComparison < 0) {
                    showCompatibilityBlock('version', cachedMin);
                    return false;
                }
            }
        } catch (_) {}

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        try {
            const relayUrl = (typeof communityRelayUrl !== 'undefined' && communityRelayUrl) ? communityRelayUrl : COMMUNITY_RELAY_URL;
            const response = await fetch(`${relayUrl}/version`, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal
            });
            if (!response.ok) throw new Error(`Compatibility endpoint returned ${response.status}`);
            const policy = await response.json();
            const minimum = policy.minimumVersion;
            if (minimum) {
                try {
                    localStorage.setItem('amaes_cached_min_version', String(minimum).trim());
                    if (policy.latestVersion) {
                        localStorage.setItem('amaes_cached_latest_version', String(policy.latestVersion).trim());
                    }
                } catch (_) {}
            }
            const comparison = compareVersions(CLIENT_VERSION, minimum);
            // ONLY block if comparison succeeded and client is strictly below minimum
            if (comparison !== null && comparison < 0) {
                showCompatibilityBlock('version', minimum);
                return false;
            }
            document.getElementById('amaes-compat-banner')?.remove();
            return true;
        } catch (error) {
            logDebug(`Client compatibility check failed: ${error.message}`);
            document.getElementById('amaes-compat-banner')?.remove();
            // Temporary network interruptions, worker cold starts, slow latency, or timeouts
            // must never lock out or wipe the screen of an active student session.
            return true;
        } finally {
            clearTimeout(timeout);
        }
    }

    const SCRIPT_RAW_URL = "https://raw.githubusercontent.com/Acads-Tools/amaes-toolkit/main/amaes-toolkit.user.js";
    const GITHUB_REPO_URL = "https://github.com/Acads-Tools/amaes-toolkit";
    const GREASYFORK_URL = "https://greasyfork.org/en/scripts/594744-amaes-toolkit";
    const WEBSITE_URL = "https://acads-tools.github.io/amaes-toolkit/";

    // Dynamic semester path detector (never hardcode e.g. /2612/ since term codes change every semester)
    function getSemesterBasePath() {
        if (typeof window !== 'undefined' && window.location) {
            const m = window.location.pathname.match(/^\/(\d{3,5})\//);
            if (m) {
                const path = `/${m[1]}/`;
                try {
                    sessionStorage.setItem('amaes_detected_sem_path', path);
                    localStorage.setItem('amaes_detected_sem_path', path);
                } catch (_) {}
                return path;
            }
            const anyDashLink = typeof document !== 'undefined' ? document.querySelector('a[href*="/my/courses.php"], a[href*="/my/"], a[href*="/course/"]') : null;
            if (anyDashLink) {
                const href = anyDashLink.getAttribute('href') || '';
                const lm = href.match(/\/(\d{3,5})\//);
                if (lm) {
                    const path = `/${lm[1]}/`;
                    try {
                        sessionStorage.setItem('amaes_detected_sem_path', path);
                        localStorage.setItem('amaes_detected_sem_path', path);
                    } catch (_) {}
                    return path;
                }
            }
            try {
                const saved = sessionStorage.getItem('amaes_detected_sem_path') || localStorage.getItem('amaes_detected_sem_path');
                if (saved) return saved;
            } catch (_) {}
        }
        return '/';
    }

    function getSemesterCoursesUrl() {
        const origin = (typeof window !== 'undefined' && window.location && window.location.origin) ? window.location.origin : 'https://semestral.amaes.com';
        return `${origin}${getSemesterBasePath()}my/courses.php`;
    }

    // DEBUG SWITCH: Toggle to enable/disable the debug export button
    const DEBUG_MODE = true;

    // In-memory debug log buffer for AI diagnosis
    const debugLogs = [];
    function logDebug(msg, data = null) {
        const entry = `[${new Date().toLocaleTimeString()}] ${msg}${data ? ' ' + JSON.stringify(data) : ''}`;
        debugLogs.push(entry);
        console.log(`[AMAES Toolkit] ${entry}`);
    }

    // User Action & Reproduction Breadcrumbs Tracker
    const userBreadcrumbs = [];
    function recordBreadcrumb(category, action, details = null) {
        try {
            const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const entry = {
                time: timeStr,
                category: category || 'action',
                action: String(action || '').slice(0, 140),
                ...(details ? { details: String(details).slice(0, 180) } : {})
            };
            userBreadcrumbs.push(entry);
            if (userBreadcrumbs.length > 50) userBreadcrumbs.shift();
        } catch (_) {}
    }

    // Activity State & Real-Time Logging Engine (Doing, Done, Plan)
    const activityHistory = [];
    let currentDoing = "Ready. Select a tool above.";
    let currentPlan = "Ready for action";

    function setLog(doingMsg, color = null, planMsg = null, addToHistory = true) {
        if (doingMsg) currentDoing = doingMsg;
        if (planMsg) currentPlan = planMsg;

        const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        if (addToHistory && doingMsg) {
            const cleanDoing = doingMsg.replace(/<[^>]*>?/gm, '');
            const cleanPlan = (planMsg || currentPlan).replace(/<[^>]*>?/gm, '');
            const last = activityHistory[0];
            if (!last || last.text !== cleanDoing) {
                activityHistory.unshift({
                    time: timeStr,
                    text: cleanDoing,
                    plan: cleanPlan,
                    color: color || "var(--text-secondary)"
                });
                if (activityHistory.length > 50) activityHistory.pop();
                recordBreadcrumb('toolkit', cleanDoing);
            }
        }

        const statusEl = document.getElementById('amaes-status');
        if (statusEl) {
            statusEl.innerHTML = currentDoing;
            statusEl.title = currentDoing.replace(/<[^>]*>?/gm, '');
            if (color) statusEl.style.color = color;
            else statusEl.style.color = "var(--text-primary)";
        }

        const planEl = document.getElementById('amaes-plan-text');
        if (planEl) {
            planEl.innerHTML = currentPlan;
            planEl.title = currentPlan.replace(/<[^>]*>?/gm, '');
        }

        const dotEl = document.getElementById('amaes-status-dot');
        if (dotEl) {
            dotEl.style.background = color || "var(--accent-green, #10b981)";
            dotEl.style.boxShadow = `0 0 8px ${color || 'rgba(16,185,129,0.7)'}`;
            dotEl.classList.remove('amaes-pulse');
            void dotEl.offsetWidth;
            dotEl.classList.add('amaes-pulse');
        }

        const countBadge = document.getElementById('amaes-log-count-badge');
        if (countBadge) {
            countBadge.innerText = `Log (${activityHistory.length})`;
        }

        const logsList = document.getElementById('amaes-logs-list');
        if (logsList && logsList.parentElement && logsList.parentElement.style.display !== 'none') {
            renderActivityLogs();
        }

        logDebug(`[${timeStr}] DOING: ${currentDoing.replace(/<[^>]*>?/gm, '')} | PLAN: ${currentPlan.replace(/<[^>]*>?/gm, '')}`);
    }

    function renderActivityLogs() {
        const logsList = document.getElementById('amaes-logs-list');
        if (!logsList) return;
        if (activityHistory.length === 0) {
            logsList.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">No recorded events yet.</span>';
            return;
        }
        logsList.innerHTML = activityHistory.slice(0, 15).map(item => `
            <div style="display: flex; gap: 6px; line-height: 1.35; padding: 2px 0; border-bottom: 1px dotted rgba(255,255,255,0.06); font-size: 9.5px;">
                <span style="color: var(--text-muted); font-family: monospace; white-space: nowrap; flex-shrink: 0;">${item.time}</span>
                <span style="color: ${item.color || 'var(--text-secondary)'}; word-break: break-word;">${item.text}</span>
            </div>
        `).join('');
    }

    logDebug(`Toolkit initialized. Version: ${SCRIPT_VERSION}, Host: ${window.location.hostname}`);

    // Auto-remove any old/duplicate panel version if still present in DOM
    const oldPanel = document.getElementById('amaes-toolkit-panel') || document.getElementById('amaes-helper-panel');
    if (oldPanel) oldPanel.remove();

    let isRunning = false;
    let shouldStop = false;

    // Remote GitHub Asset Loader
    const TOOLKIT_LOGO_URL = "https://raw.githubusercontent.com/Acads-Tools/amaes-toolkit/main/assets/amaes-toolkit-logo.png";

    // ==========================================
    // Unified Network Request Helper (Promise-based GM_xmlhttpRequest / fetch)
    // ==========================================
    function requestNetwork({ url, method = 'GET', headers = {}, data = null, responseType = 'text', timeout = 10000 }) {
        return new Promise((resolve, reject) => {
            const gmReq = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                          (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;
            if (gmReq) {
                try {
                    gmReq({
                        method,
                        url,
                        headers,
                        data,
                        responseType,
                        timeout,
                        onload: (res) => resolve(res),
                        onerror: (err) => reject(new Error(err && err.statusText ? err.statusText : 'Network request failed')),
                        ontimeout: () => reject(new Error('Network request timed out'))
                    });
                } catch (e) {
                    reject(e);
                }
            } else {
                const fetchOptions = {
                    method,
                    headers,
                    body: (method !== 'GET' && method !== 'HEAD') ? data : undefined
                };
                const controller = (typeof AbortController !== 'undefined') ? new AbortController() : null;
                let timer = null;
                if (controller && timeout) {
                    fetchOptions.signal = controller.signal;
                    timer = setTimeout(() => controller.abort(), timeout);
                }
                fetch(url, fetchOptions)
                    .then(async (res) => {
                        if (timer) clearTimeout(timer);
                        const text = (responseType === 'blob') ? await res.blob() : await res.text();
                        resolve({
                            status: res.status,
                            statusText: res.statusText,
                            responseText: typeof text === 'string' ? text : '',
                            response: text
                        });
                    })
                    .catch((err) => {
                        if (timer) clearTimeout(timer);
                        reject(err);
                    });
            }
        });
    }

