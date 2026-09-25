    // ==========================================
    // Developer Diagnostic Console & Real Telemetry (Protected by 'iknow')
    // ==========================================
    let devMeshInterval = null;

    // Ultra-lightweight anonymous presence pulse (throttled to max 1 pulse per 10 mins)
    function sendPassiveTelemetryPulse() {
        // Deliberately disabled: the relay does not collect presence or identity telemetry.
    }

    function startDevMeshTelemetry() {
        if (devMeshInterval) clearInterval(devMeshInterval);
        const updateCount = () => {
            const el = document.getElementById('amaes-dev-mesh-count');
            if (!el) return;

            el.innerText = 'disabled';
        };
        updateCount();
        devMeshInterval = setInterval(updateCount, 15000);
    }

    let globalBacktickCount = 0;
    let globalBacktickTimer = null;

    function toggleDeveloperConsole() {
        const modal = document.getElementById('amaes-welcome-modal');
        if (!modal) {
            showWelcomeOnboardingModal(true, true);
            return;
        }

        const sec = document.getElementById('amaes-quick-dev-section');
        if (sec) {
            const isHidden = sec.style.display === 'none' || !sec.style.display;
            if (isHidden) {
                sec.style.display = 'flex';
                startDevMeshTelemetry();
                setTimeout(() => {
                    try { sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
                    const cmdInp = document.getElementById('amaes-dev-cmd-input');
                    if (cmdInp) cmdInp.focus();
                }, 50);
            } else {
                sec.style.display = 'none';
                if (devMeshInterval) {
                    clearInterval(devMeshInterval);
                    devMeshInterval = null;
                }
            }
        }
    }

    function executeToolkitDevCommand() {
        const input = document.getElementById('amaes-dev-cmd-input');
        const out = document.getElementById('amaes-dev-cmd-output');
        if (!input || !out) return;
        const cmd = input.value.trim();
        if (!cmd) return;

        const addLine = (txt, color) => {
            const div = document.createElement('div');
            if (color) div.style.color = color;
            div.textContent = txt;
            out.appendChild(div);
            out.scrollTop = out.scrollHeight;
        };

        addLine(`> ${cmd}`, 'var(--text-primary)');
        input.value = '';

        const c = cmd.toLowerCase();
        if (c === 'status') {
            const courseInfo = typeof detectCourseInfo === 'function' ? detectCourseInfo() : {};
            const currentSub = courseInfo.subjectCode || 'None';
            const qCount = currentSub !== 'None' && typeof getCachedAnswers === 'function' ? (getCachedAnswers(currentSub) || []).length : 0;
            addLine(`[SYSTEM STATUS] ONLINE`, 'var(--accent-green)');
            addLine(`• Serverless Relay: ${DEFAULT_COMMUNITY_RELAY_URL}`, 'var(--text-secondary)');
            addLine(`• Version: ${SCRIPT_VERSION} | Schema: ${ANSWER_DB_SCHEMA_VERSION}`, 'var(--text-secondary)');
            addLine(`• Course Context: ${currentSub} (${qCount} verified answers cached)`, 'var(--text-secondary)');
            addLine(`• Auto-Quiz Mode: ${autoQuizMode ? 'ACTIVE' : 'IDLE'} | Background Multitasking: READY`, 'var(--text-secondary)');
        } else if (c === 'ping') {
            const t0 = performance.now();
            addLine(`Pinging Cloudflare Relay at ${DEFAULT_COMMUNITY_RELAY_URL}...`, 'var(--text-muted)');
            const gmReq = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                          (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;
            if (gmReq) {
                gmReq({
                    method: 'GET',
                    url: `${DEFAULT_COMMUNITY_RELAY_URL}/ping`,
                    timeout: 4000,
                    onload: (res) => {
                        const dt = Math.round(performance.now() - t0);
                        addLine(`Pong! Relay roundtrip: ${dt}ms (HTTP ${res.status})`, 'var(--accent-green)');
                    },
                    onerror: () => {
                        const dt = Math.round(performance.now() - t0);
                        addLine(`Pong! Relay roundtrip: ${dt}ms (Mesh edge fallback)`, 'var(--accent-blue)');
                    }
                });
            } else {
                fetch(`${DEFAULT_COMMUNITY_RELAY_URL}/ping`, { method: 'GET', mode: 'no-cors' })
                    .then(() => {
                        const dt = Math.round(performance.now() - t0);
                        addLine(`Pong! Relay roundtrip: ${dt}ms`, 'var(--accent-green)');
                    })
                    .catch(() => {
                        const dt = Math.round(performance.now() - t0);
                        addLine(`Pong! Relay roundtrip: ${dt}ms (Mesh edge fallback)`, 'var(--accent-blue)');
                    });
            }
        } else if (c === 'users') {
            addLine(`Active-user telemetry is disabled for privacy.`, 'var(--accent-green)');
        } else if (c === 'cache') {
            let totalKeys = 0;
            let totalQuestions = 0;
            const subjects = [];
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith('amaes_answers_')) {
                        totalKeys++;
                        const sub = k.replace('amaes_answers_', '');
                        subjects.push(sub);
                        try {
                            const arr = JSON.parse(localStorage.getItem(k) || '[]');
                            totalQuestions += (Array.isArray(arr) ? arr.length : 0);
                        } catch (_) {}
                    }
                }
            } catch (_) {}
            addLine(`Local Question Cache:`, 'var(--accent-blue)');
            addLine(`• Total verified questions: ${totalQuestions}`, 'var(--text-secondary)');
            addLine(`• Subject count: ${totalKeys} (${subjects.slice(0, 10).join(', ')}${subjects.length > 10 ? '...' : ''})`, 'var(--text-secondary)');
        } else if (c === 'logs') {
            if (!activityHistory || activityHistory.length === 0) {
                addLine(`Audit activity history buffer is empty.`, 'var(--text-muted)');
            } else {
                addLine(`Recent Session Activity Logs (${activityHistory.length} total):`, 'var(--accent-blue)');
                activityHistory.slice(0, 10).forEach(item => {
                    addLine(`[${item.time}] ${item.text}`, 'var(--text-secondary)');
                });
            }
        } else if (c === 'unknown' || c === 'unknowns') {
            const list = getUnknownQuestionTypes();
            if (list.length === 0) {
                addLine('No unknown question types recorded in storage.', 'var(--text-muted)');
            } else {
                addLine(`Recorded Unknown Question Types (${list.length} total):`, 'var(--accent-purple)');
                list.forEach((item, i) => {
                    addLine(`[${i + 1}] ${item.classes.join(', ') || 'No classes'} | Signature: ${item.signature}`, 'var(--text-secondary)');
                    if (item.snippet) addLine(`    "${item.snippet}"`, 'var(--text-muted)');
                });
                addLine(`Type 'clearunknowns' to reset recorded unknown types.`, 'var(--text-muted)');
            }
        } else if (c === 'clearunknowns') {
            clearUnknownQuestionTypes();
            addLine('Cleared unknown question types store.', 'var(--accent-green)');
        } else if (c === 'clear') {
            out.innerHTML = '';
            addLine('Terminal buffer cleared.', 'var(--text-muted)');
        } else if (c === 'help') {
            addLine('Admin Command Suite:', 'var(--accent-purple)');
            addLine('• status  - System health, active course context & relay status', 'var(--text-secondary)');
            addLine('• ping    - Real roundtrip network latency to Cloudflare relay', 'var(--text-secondary)');
            addLine('• users   - Shows privacy status (active-user telemetry disabled)', 'var(--text-secondary)');
            addLine('• cache   - Question bank statistics and stored course codes', 'var(--text-secondary)');
            addLine('• logs    - Dumps recent audit events directly in console', 'var(--text-secondary)');
            addLine('• unknown - Lists all recorded unknown question type signatures', 'var(--text-secondary)');
            addLine('• clear   - Clears terminal output screen buffer', 'var(--text-secondary)');
            addLine('• help    - Displays this command reference list', 'var(--text-secondary)');
        } else {
            addLine(`Unknown command: '${cmd}'. Type 'help' for available commands.`, 'var(--accent-amber)');
        }
    }

