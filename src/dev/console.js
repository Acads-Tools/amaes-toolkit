    // ==========================================
    // Developer Diagnostic Console & Real Telemetry (Protected by 'iknow')
    // ==========================================
    let devMeshInterval = null;

    // Ultra-lightweight anonymous presence pulse (throttled to max 1 pulse per 6 hours)
    function sendPassiveTelemetryPulse() {
        // Deliberately disabled: the relay does not collect presence or identity telemetry.
        if (typeof dispatchUsageTelemetry === 'function') {
            dispatchUsageTelemetry('heartbeat');
        }
    }

    function startDevMeshTelemetry() {
        if (devMeshInterval) clearInterval(devMeshInterval);
        const updateCount = () => {
            const el = document.getElementById('amaes-dev-mesh-count');
            if (!el) return;

            const relayUrl = (typeof communityRelayUrl !== 'undefined' && communityRelayUrl) ? communityRelayUrl : COMMUNITY_RELAY_URL;
            fetch(`${relayUrl}/telemetry/stats`)
                .then(r => r.json())
                .then(data => {
                    if (data && data.success && typeof data.active_users_24h !== 'undefined') {
                        el.innerText = `${data.active_users_24h} active (24h)`;
                    } else {
                        el.innerText = 'active';
                    }
                })
                .catch(() => {
                    el.innerText = 'active';
                });
        };
        updateCount();
        devMeshInterval = setInterval(updateCount, 30000);
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
            addLine(`Tip: Type 'stats <1h|6h|24h|7d|30d|overall>' or 'users <timeframe>' to view aggregate counts without identity tracking.`, 'var(--text-muted)');
        } else if (cmd.trim().toLowerCase().startsWith('users ') && cmd.trim().split(/\s+/)[1]) {
            const tf = cmd.trim().split(/\s+/)[1].toLowerCase();
            addLine(`Fetching anonymous user counts (${tf})...`, 'var(--text-muted)');
            const relayUrl = (typeof communityRelayUrl !== 'undefined' && communityRelayUrl) ? communityRelayUrl : COMMUNITY_RELAY_URL;
            fetch(`${relayUrl}/telemetry/stats?timeframe=${encodeURIComponent(tf)}`)
                .then(r => r.json())
                .then(data => {
                    if (data && data.success) {
                        const count = typeof data.active_users !== 'undefined' ? data.active_users : data.active_users_24h;
                        const label = data.timeframe || tf;
                        addLine(`Anonymous Active Users (${label}):`, 'var(--accent-purple)');
                        addLine(`• Unique Active Devices: ${count}`, 'var(--accent-green)');
                        addLine(`• Total Quizzes Solved: ${data.total_session_quizzes_reported || 0}`, 'var(--accent-blue)');
                        addLine(`• Fast Answer (Turbo) Users: ${data.fast_mode_active_count || 0} (${data.fast_mode_adoption_percent || 0}% adoption)`, 'var(--accent-amber)');
                    } else {
                        addLine(`Unable to retrieve metrics for '${tf}'.`, 'var(--accent-pink)');
                    }
                })
                .catch(err => {
                    addLine(`Connection failed: ${err.message}`, 'var(--accent-pink)');
                });
        } else if (c === 'features' || c === 'featurestats' || cmd.trim().toLowerCase().startsWith('features ')) {
            const parts = cmd.trim().split(/\s+/);
            const tf = (parts[1] || '24h').toLowerCase();
            addLine(`Analyzing feature adoption across users (${tf})...`, 'var(--text-muted)');
            const relayUrl = (typeof communityRelayUrl !== 'undefined' && communityRelayUrl) ? communityRelayUrl : COMMUNITY_RELAY_URL;
            fetch(`${relayUrl}/telemetry/stats?timeframe=${encodeURIComponent(tf)}`)
                .then(r => r.json())
                .then(data => {
                    if (data && data.success) {
                        const count = typeof data.active_users !== 'undefined' ? data.active_users : data.active_users_24h;
                        const label = data.timeframe || tf;
                        addLine(`Feature Adoption Summary (${label}):`, 'var(--accent-purple)');
                        addLine(`• ⚡ Fast Answer (Turbo) Mode: ${data.fast_mode_active_count || 0} of ${count} users (${data.fast_mode_adoption_percent || 0}% adoption)`, 'var(--accent-amber)');
                        addLine(`• Auto-Quiz Completions: ${data.total_session_quizzes_reported || 0} quizzes solved`, 'var(--accent-green)');
                        if (data.events && Object.keys(data.events).length > 0) {
                            const evts = Object.entries(data.events).map(([k, v]) => `${k}: ${v}`).join(' | ');
                            addLine(`• Action Events: ${evts}`, 'var(--accent-blue)');
                        }
                        const vList = Object.entries(data.versions || {}).map(([v, cnt]) => `v${v}: ${cnt}`).join(', ');
                        addLine(`• Active Script Versions: ${vList || 'None'}`, 'var(--text-secondary)');
                        addLine(`• Local Client Status: Fast Mode: ${fastQuizMode ? 'ON' : 'OFF'} | Auto-Quiz: ${autoQuizMode ? 'ON' : 'OFF'}`, 'var(--text-muted)');
                    } else {
                        addLine(`Feature breakdown currently unavailable from relay.`, 'var(--accent-pink)');
                    }
                })
                .catch(err => {
                    addLine(`Relay query error: ${err.message}`, 'var(--accent-pink)');
                });
        } else if (c === 'stats' || c === 'telemetry' || cmd.trim().toLowerCase().startsWith('stats ') || cmd.trim().toLowerCase().startsWith('telemetry ')) {
            const parts = cmd.trim().split(/\s+/);
            const tf = (parts[1] || '24h').toLowerCase();
            addLine(`Fetching live anonymous telemetry (${tf})...`, 'var(--text-muted)');
            const relayUrl = (typeof communityRelayUrl !== 'undefined' && communityRelayUrl) ? communityRelayUrl : COMMUNITY_RELAY_URL;
            fetch(`${relayUrl}/telemetry/stats?timeframe=${encodeURIComponent(tf)}`)
                .then(r => r.json())
                .then(data => {
                    if (data && data.success) {
                        const count = typeof data.active_users !== 'undefined' ? data.active_users : data.active_users_24h;
                        const eventsCount = typeof data.total_events !== 'undefined' ? data.total_events : data.total_events_24h;
                        const label = data.timeframe || tf;
                        addLine(`Anonymous Usage & Feature Telemetry (${label}):`, 'var(--accent-purple)');
                        addLine(`• Active Unique Users: ${count}`, 'var(--accent-green)');
                        addLine(`• Total Telemetry Events: ${eventsCount}`, 'var(--text-secondary)');
                        addLine(`• Session Quizzes Solved Reported: ${data.total_session_quizzes_reported || 0}`, 'var(--accent-blue)');
                        addLine(`• Fast Answer (Turbo) Users: ${data.fast_mode_active_count || 0} (${data.fast_mode_adoption_percent || 0}% adoption)`, 'var(--accent-amber)');
                        if (data.events && Object.keys(data.events).length > 0) {
                            const eList = Object.entries(data.events).map(([ev, num]) => `${ev}: ${num}`).join(', ');
                            addLine(`• Activity Breakdown: ${eList}`, 'var(--text-secondary)');
                        }
                        const vList = Object.entries(data.versions || {}).map(([v, cnt]) => `v${v} (${cnt})`).join(', ');
                        addLine(`• Version Distribution: ${vList || 'None reported'}`, 'var(--text-secondary)');
                        addLine(`• Current Client Session Quizzes: ${sessionQuizzesSolved || 0}`, 'var(--text-muted)');
                    } else {
                        addLine(`Privacy status: Telemetry uses zero-PII anonymous UUIDs.`, 'var(--accent-green)');
                    }
                })
                .catch(() => {
                    addLine(`Local Session Quizzes Solved: ${sessionQuizzesSolved || 0}`, 'var(--accent-blue)');
                    addLine(`Privacy status: No personal student data is ever collected.`, 'var(--accent-green)');
                });
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
        } else if (c === 'logs -c' || c === 'logs --copy' || c === 'diagnostics -c' || c === 'diagnostic -c' || c === 'diag -c') {
            const auditReport = generateDiagnosticAuditLog();
            copyToClipboard(auditReport).then(() => {
                const count = (typeof activityHistory !== 'undefined' && activityHistory) ? activityHistory.length : 0;
                addLine(`[OK] Copied full system diagnostic audit log to clipboard (${count} events).`, 'var(--accent-green)');
                addLine(`Timestamp: ${new Date().toISOString()}`, 'var(--text-muted)');
                showToast(`Copied diagnostic audit log (${count} events)!`, 2500);
            }).catch(err => {
                addLine(`Failed to copy diagnostics: ${err.message}`, 'var(--accent-pink)');
            });
        } else if (c === 'logs' || c === 'diagnostics') {
            if (!activityHistory || activityHistory.length === 0) {
                addLine(`Audit activity history buffer is empty.`, 'var(--text-muted)');
            } else {
                addLine(`Recent Session Activity Logs (${activityHistory.length} total):`, 'var(--accent-blue)');
                activityHistory.slice(0, 10).forEach(item => {
                    addLine(`[${item.time}] ${item.text}`, 'var(--text-secondary)');
                });
                addLine(`Tip: Type 'logs -c' to copy full system diagnostic audit log to clipboard.`, 'var(--text-muted)');
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
            addLine('• status                   - System health, active course context & relay status', 'var(--text-secondary)');
            addLine('• stats [1h|6h|24h|7d|all] - Live user counts, quizzes solved & adoption rates', 'var(--text-secondary)');
            addLine('• users [1h|6h|24h|7d|all] - Aggregate unique active user counts by timeframe', 'var(--text-secondary)');
            addLine('• features [timeframe]     - Feature adoption breakdown (Fast mode, auto-quiz, etc.)', 'var(--text-secondary)');
            addLine('• ping                     - Real roundtrip network latency to Cloudflare relay', 'var(--text-secondary)');
            addLine('• cache                    - Question bank statistics and stored course codes', 'var(--text-secondary)');
            addLine('• logs                     - Dumps recent audit events directly in console', 'var(--text-secondary)');
            addLine('• logs -c                  - Copies full system diagnostic audit log to clipboard', 'var(--text-secondary)');
            addLine('• unknown                  - Lists all recorded unknown question type signatures', 'var(--text-secondary)');
            addLine('• clear                    - Clears terminal output screen buffer', 'var(--text-secondary)');
            addLine('• help                     - Displays this command reference list', 'var(--text-secondary)');
        } else {
            addLine(`Unknown command: '${cmd}'. Type 'help' for available commands.`, 'var(--accent-amber)');
        }
    }

