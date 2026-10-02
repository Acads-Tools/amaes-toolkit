    // ==========================================
    // ==========================================
    // Welcome & Quick-Start Onboarding Modal
    // ==========================================

    function showWelcomeOnboardingModal(force = false, focusDev = false) {
        if (!force && localStorage.getItem('amaes_welcome_dismissed') === 'true') {
            return;
        }

        const existing = document.getElementById('amaes-welcome-modal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'amaes-welcome-modal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px);
            z-index: 100002; display: flex; align-items: center; justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            padding: 16px; box-sizing: border-box;
        `;

        const isLight = currentTheme === 'light';

        modal.innerHTML = `
            <div id="amaes-welcome-card" style="background: ${isLight ? '#ffffff' : '#1e293b'}; border: 1px solid ${isLight ? '#e2e8f0' : '#334155'}; border-radius: 16px; width: 100%; max-width: 500px; box-shadow: ${isLight ? '0 20px 40px -10px rgba(0,0,0,0.15)' : '0 25px 50px -12px rgba(0,0,0,0.6)'}; overflow: hidden; color: ${isLight ? '#0f172a' : '#f8fafc'}; display: flex; flex-direction: column; max-height: 88vh;">
                <!-- Header -->
                <div id="amaes-welcome-header" style="padding: 16px 20px; border-bottom: 1px solid ${isLight ? '#e2e8f0' : '#334155'}; background: ${isLight ? 'linear-gradient(135deg, #ffffff, #f1f5f9)' : 'linear-gradient(135deg, #1e293b, #0f172a)'}; display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; flex-direction: column;">
                        <h2 id="amaes-welcome-title" style="margin: 0; font-size: 17px; font-weight: 800; color: ${isLight ? '#0f172a' : '#fff'}; display: flex; align-items: center; gap: 8px;">
                            ${ICONS.zap} Welcome to AMAES Toolkit
                        </h2>
                        <span style="font-size: 11px; color: ${isLight ? '#64748b' : '#94a3b8'}; font-weight: 500; margin-top: 2px;">Your All-in-One Study & Quiz Companion</span>
                    </div>
                    ${force ? `<button id="btn-welcome-close" style="background:none; border:none; color:${isLight ? '#64748b' : '#94a3b8'}; font-size:22px; cursor:pointer; line-height:1; padding: 2px 6px;">&times;</button>` : ''}
                </div>
                
                <div id="amaes-welcome-scroll-container" style="padding: 18px 20px; font-size: 12px; line-height: 1.45; display: flex; flex-direction: column; gap: 12px; overflow-y: auto;">
                    
                    <!-- Core Highlights Summary Card -->
                    <div id="amaes-welcome-highlight-card" style="display: flex; flex-direction: column; gap: 8px; background: ${isLight ? '#f8fafc' : 'rgba(255, 255, 255, 0.03)'}; border: 1px solid ${isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.08)'}; border-radius: 10px; padding: 12px 14px;">
                        <!-- Auto-Answer -->
                        <div style="display: flex; align-items: flex-start; gap: 10px;">
                            <span style="color: #60a5fa; margin-top: 2px;">${ICONS.checkCircle}</span>
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="font-weight: 700; color: ${isLight ? '#0f172a' : '#f1f5f9'}; font-size: 12px;">Smart Auto-Answer & Highlighter</div>
                                    <span style="font-size: 9px; color: #60a5fa; font-weight: 700; background: rgba(59, 130, 246, 0.15); padding: 1px 6px; border-radius: 10px;">Background Capable</span>
                                </div>
                                <div style="color: ${isLight ? '#64748b' : '#94a3b8'}; font-size: 11px;">Identifies subjects, highlights verified answers, and Auto-Quiz runs autonomously in the background while you switch tabs or multitask in other applications.</div>
                            </div>
                        </div>

                        <!-- Community Sharing -->
                        <div style="display: flex; align-items: flex-start; gap: 10px; border-top: 1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}; padding-top: 8px;">
                            <span style="color: #34d399; margin-top: 2px;">${ICONS.upload}</span>
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="font-weight: 700; color: ${isLight ? '#0f172a' : '#f1f5f9'}; font-size: 12px;">Collect & Share Anonymously</div>
                                    <span style="font-size: 9px; color: #34d399; font-weight: 700; background: rgba(16, 185, 129, 0.15); padding: 1px 6px; border-radius: 10px;">100% Anonymous</span>
                                </div>
                                <div style="color: ${isLight ? '#64748b' : '#94a3b8'}; font-size: 11px;">Answers from completed quizzes are shared anonymously with classmates. No personal data is ever collected.</div>
                            </div>
                        </div>

                        <!-- Built-in Gemini AI -->
                        <div style="display: flex; align-items: flex-start; gap: 10px; border-top: 1px solid ${isLight ? '#e2e8f0' : 'rgba(255,255,255,0.06)'}; padding-top: 8px;">
                            <span style="color: #c084fc; margin-top: 2px;">${ICONS.zap}</span>
                            <div style="flex: 1;">
                                <div style="display: flex; align-items: center; justify-content: space-between;">
                                    <div style="font-weight: 700; color: ${isLight ? '#0f172a' : '#f1f5f9'}; font-size: 12px;">Built-in Google Gemini AI</div>
                                    <button id="welcome-btn-setup-ai" type="button" class="amaes-btn" style="background: rgba(139, 92, 246, 0.2); color: ${isLight ? '#7c3aed' : '#d8b4fe'}; border: 1px solid rgba(139, 92, 246, 0.4); font-size: 10px; padding: 2px 8px; border-radius: 4px; font-weight: 700; cursor: pointer;">
                                        ${geminiApiKey ? 'Key Configured' : 'Setup AI'}
                                    </button>
                                </div>
                                <div style="color: ${isLight ? '#64748b' : '#94a3b8'}; font-size: 11px;">Instant in-quiz AI solver for questions not yet in the community database.</div>
                            </div>
                        </div>
                    </div>

                    <!-- Community Sync Options (Compact Collapsible) -->
                    <details style="background: ${isLight ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)'}; border: 1px solid ${isLight ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'}; border-radius: 8px; padding: 8px 12px;">
                        <summary style="font-size: 11px; font-weight: 700; color: ${isLight ? '#059669' : '#34d399'}; cursor: pointer; display: flex; align-items: center; gap: 6px; user-select: none;">
                            ${ICONS.gear || '⚙️'} <span class="amaes-summary-chevron">${ICONS.chevronRight}</span>
                            <span>Community Sync Settings</span>
                        </summary>
                        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 8px; padding-top: 8px; border-top: 1px solid ${isLight ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.15)'};">
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: ${isLight ? '#334155' : '#cbd5e1'}; cursor: pointer;">
                                <input id="welcome-chk-harvest" type="checkbox" ${typeof autoHarvestGrades !== 'undefined' && autoHarvestGrades ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #10b981;" />
                                <span>Auto-collect confirmed answers from past quizzes</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: ${isLight ? '#334155' : '#cbd5e1'}; cursor: pointer;">
                                <input id="welcome-chk-sync" type="checkbox" ${autoCloudSync ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #10b981;" />
                                <span>Download verified answers when course opens</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: ${isLight ? '#334155' : '#cbd5e1'}; cursor: pointer;">
                                <input id="welcome-chk-scrape" type="checkbox" ${autoScrapeAmauoed ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #10b981;" />
                                <span>Auto-check online study guides (AMAUOED)</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: ${isLight ? '#334155' : '#cbd5e1'}; cursor: pointer;">
                                <input id="welcome-chk-share" type="checkbox" ${autoCommunityShare ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #10b981;" />
                                <span>Share verified answers with classmates (100% anonymous)</span>
                            </label>
                        </div>
                    </details>

                    <!-- Keyboard Shortcuts Cheatsheet (Comprehensive Collapsible) -->
                    <details style="background: ${isLight ? 'rgba(245, 158, 11, 0.08)' : 'rgba(245, 158, 11, 0.05)'}; border: 1px solid ${isLight ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.2)'}; border-radius: 8px; padding: 8px 12px;" id="welcome-shortcuts-section">
                        <summary id="welcome-shortcuts-title" style="font-size: 11px; font-weight: 700; color: ${isLight ? '#d97706' : '#fcd34d'}; cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none;" title="Double-click to toggle Developer Console">
                            <span style="display: flex; align-items: center; gap: 6px;">
                                ${ICONS.keyboard} <span class="amaes-summary-chevron">${ICONS.chevronRight}</span>
                                <span>Keyboard Shortcuts Cheatsheet (Comprehensive)</span>
                                <span id="amaes-secret-cheatsheet-trigger" style="display:none;">Cheatsheet</span>
                            </span>
                            <span style="font-size: 10px; color: ${isLight ? '#64748b' : '#94a3b8'}; font-weight: 400;">Press <kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; color: ${isLight ? '#0f172a' : '#fff'}; padding: 1px 4px; border-radius: 3px; font-size: 9px;">?</kbd> or <kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; color: ${isLight ? '#0f172a' : '#fff'}; padding: 1px 4px; border-radius: 3px; font-size: 9px;">K</kbd></span>
                        </summary>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 10px; font-size: 10.5px; color: ${isLight ? '#334155' : '#cbd5e1'}; margin-top: 8px; padding-top: 8px; border-top: 1px solid ${isLight ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)'};">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="min-width: 60px;"><kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; padding: 1px 4px; border-radius: 3px; font-weight: 700; color: ${isLight ? '#0f172a' : '#fff'}; font-family: monospace;">N</kbd> / <kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; padding: 1px 4px; border-radius: 3px; font-weight: 700; color: ${isLight ? '#0f172a' : '#fff'}; font-family: monospace;">Space</kbd></span>
                                <span>Next Question / Page</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="min-width: 60px;"><kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; padding: 1px 5px; border-radius: 3px; font-weight: 700; color: ${isLight ? '#0f172a' : '#fff'}; font-family: monospace;">C</kbd></span>
                                <span>Copy AI Prompt</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="min-width: 60px;"><kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; padding: 1px 5px; border-radius: 3px; font-weight: 700; color: ${isLight ? '#0f172a' : '#fff'}; font-family: monospace;">V</kbd></span>
                                <span>Paste AI Answer</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="min-width: 60px;"><kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; padding: 1px 5px; border-radius: 3px; font-weight: 700; color: ${isLight ? '#0f172a' : '#fff'}; font-family: monospace;">P</kbd></span>
                                <span>Pause / Resume Auto-Quiz</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="min-width: 60px;"><kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; padding: 1px 4px; border-radius: 3px; font-weight: 700; color: ${isLight ? '#0f172a' : '#fff'}; font-family: monospace;">1–4</kbd> / <kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; padding: 1px 4px; border-radius: 3px; font-weight: 700; color: ${isLight ? '#0f172a' : '#fff'}; font-family: monospace;">A–D</kbd></span>
                                <span>Select Choice 1 to 4</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="min-width: 60px;"><kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; padding: 1px 5px; border-radius: 3px; font-weight: 700; color: ${isLight ? '#0f172a' : '#fff'}; font-family: monospace;">H</kbd></span>
                                <span>Highlight Answers</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="min-width: 60px;"><kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; padding: 1px 4px; border-radius: 3px; font-weight: 700; color: ${isLight ? '#0f172a' : '#fff'}; font-family: monospace;">?</kbd> / <kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; padding: 1px 4px; border-radius: 3px; font-weight: 700; color: ${isLight ? '#0f172a' : '#fff'}; font-family: monospace;">K</kbd></span>
                                <span>Open Quick Guide</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="min-width: 60px;"><kbd style="background: ${isLight ? '#e2e8f0' : '#334155'}; padding: 1px 4px; border-radius: 3px; font-weight: 700; color: ${isLight ? '#0f172a' : '#fff'}; font-family: monospace;">Esc</kbd></span>
                                <span>Close Modal / Minimize</span>
                            </div>
                        </div>
                    </details>

                    <!-- Developer & Diagnostic Console Section -->
                    <div id="amaes-quick-dev-section" style="display: none; background: #15102a; border: 2px solid #a855f7; border-radius: 8px; padding: 12px; flex-direction: column; gap: 8px; box-shadow: 0 0 25px rgba(168, 85, 247, 0.25);">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <h3 style="margin: 0; font-size: 12px; color: #c084fc; display: flex; align-items: center; gap: 6px;">
                                    ${ICONS.debug} <span>Developer & Diagnostics Console</span>
                                </h3>
                                <span style="font-size: 9px; font-family: monospace; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); padding: 1px 5px; border-radius: 3px;">Active</span>
                            </div>
                            <button id="amaes-dev-btn-close" type="button" class="amaes-btn amaes-btn-outline" style="font-size: 9px; padding: 2px 7px; color: #94a3b8; border-color: #475569; cursor: pointer;" title="Collapse console">
                                Collapse
                            </button>
                        </div>

                        <!-- Community Mesh Telemetry Card -->
                        <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 5px 8px; display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <div style="font-size: 9px; font-family: monospace; color: #94a3b8; text-transform: uppercase;">Active Mesh Telemetry</div>
                                <div style="display: flex; align-items: baseline; gap: 4px; margin-top: 1px;">
                                    <span id="amaes-dev-mesh-count" style="font-size: 16px; font-weight: 800; font-family: monospace; color: #c084fc;">--</span>
                                    <span style="font-size: 10px; color: #94a3b8;">peers active</span>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <span style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #a855f7; box-shadow: 0 0 6px #a855f7;"></span>
                                <span style="font-size: 9px; color: #cbd5e1; font-family: monospace;">Mesh Connected</span>
                            </div>
                        </div>

                        <!-- Diagnostic Terminal Box -->
                        <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column; gap: 5px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: #94a3b8; font-family: monospace; text-transform: uppercase;">
                                <span>Terminal Command Line</span>
                                <span>Type 'help' for commands</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #c084fc;">&gt;</span>
                                <input id="amaes-dev-cmd-input" type="text" placeholder="status, ping, users, cache, logs, clear..." style="flex: 1; background: rgba(0, 0, 0, 0.3); border: 1px solid #475569; border-radius: 4px; padding: 3px 6px; font-family: monospace; font-size: 10px; color: #fff; outline: none;" />
                                <button id="amaes-dev-cmd-run" type="button" class="amaes-btn" style="padding: 3px 8px; font-size: 10px; font-family: monospace; cursor: pointer; background: #9333ea; color: #fff; border: none; border-radius: 4px; font-weight: 600;">
                                    Run
                                </button>
                            </div>
                            <div id="amaes-dev-cmd-output" style="background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 4px; padding: 7px 9px; height: 260px; min-height: 240px; overflow-y: auto; font-family: monospace; font-size: 10px; line-height: 1.45; color: #cbd5e1; display: flex; flex-direction: column; gap: 2px; user-select: text;">
                                <div style="color: #64748b;">Developer diagnostic terminal ready. Type 'help' for command suite.</div>
                            </div>
                        </div>
                    </div>

                    <!-- Links with Equal Flex-Grid Widths -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                        <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" style="font-size: 10.5px; padding: 6px 4px; justify-content: center; background: ${isLight ? '#f1f5f9' : 'rgba(0,0,0,0.25)'}; border: 1px solid ${isLight ? '#cbd5e1' : '#334155'}; border-radius: 6px; color: ${isLight ? '#334155' : '#cbd5e1'}; text-decoration: none; display: flex; align-items: center; gap: 4px; text-align: center;">${ICONS.github} <span>GitHub</span></a>
                        <a href="${GREASYFORK_URL}" target="_blank" rel="noopener noreferrer" style="font-size: 10.5px; padding: 6px 4px; justify-content: center; background: ${isLight ? '#f1f5f9' : 'rgba(0,0,0,0.25)'}; border: 1px solid ${isLight ? '#cbd5e1' : '#334155'}; border-radius: 6px; color: ${isLight ? '#334155' : '#cbd5e1'}; text-decoration: none; display: flex; align-items: center; gap: 4px; text-align: center;">${ICONS.greasyfork} <span>Greasy Fork</span></a>
                        <a href="${WEBSITE_URL}" target="_blank" rel="noopener noreferrer" style="font-size: 10.5px; padding: 6px 4px; justify-content: center; background: ${isLight ? '#f1f5f9' : 'rgba(0,0,0,0.25)'}; border: 1px solid ${isLight ? '#cbd5e1' : '#334155'}; border-radius: 6px; color: ${isLight ? '#334155' : '#cbd5e1'}; text-decoration: none; display: flex; align-items: center; gap: 4px; text-align: center;">${ICONS.globe} <span>Website</span></a>
                        <button id="welcome-btn-reinstall" type="button" class="amaes-btn" style="font-size: 10.5px; padding: 6px 4px; justify-content: center; background: ${isLight ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.12)'}; border: 1px solid ${isLight ? 'rgba(16, 185, 129, 0.4)' : 'rgba(16, 185, 129, 0.35)'}; border-radius: 6px; color: ${isLight ? '#059669' : '#a7f3d0'}; cursor: pointer; display: flex; align-items: center; gap: 4px; text-align: center; font-weight: 700;" title="Reinstall current toolkit in Violentmonkey / Tampermonkey">${ICONS.download} <span>Reinstall</span></button>
                    </div>

                    <!-- Toolkit Utilities & Preferences (Moved from header to declutter) -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                        <button id="amaes-theme-btn" type="button" class="amaes-btn" style="font-size: 10.5px; padding: 6px 4px; justify-content: center; background: ${isLight ? '#f1f5f9' : 'rgba(0,0,0,0.25)'}; border: 1px solid ${isLight ? '#cbd5e1' : '#334155'}; border-radius: 6px; color: ${isLight ? '#334155' : '#cbd5e1'}; cursor: pointer; display: flex; align-items: center; gap: 4px; text-align: center;" title="Switch between Dark and Light mode">
                            ${currentTheme === 'dark' ? ICONS.sun + ' <span>Light Mode</span>' : ICONS.moon + ' <span>Dark Mode</span>'}
                        </button>
                        <button id="amaes-bug-btn" type="button" class="amaes-btn" style="font-size: 10.5px; padding: 6px 4px; justify-content: center; background: ${isLight ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.1)'}; border: 1px solid ${isLight ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.25)'}; border-radius: 6px; color: ${isLight ? '#dc2626' : '#fca5a5'}; cursor: pointer; display: flex; align-items: center; gap: 4px; text-align: center;" title="Report a problem or bug to maintainers">
                            ${ICONS.bug || ICONS.alertTriangle} <span>Report Bug</span>
                        </button>
                        <button id="amaes-debug-btn" type="button" class="amaes-btn amaes-debug-btn" style="font-size: 10.5px; padding: 6px 4px; justify-content: center; background: ${isLight ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.1)'}; border: 1px solid ${isLight ? 'rgba(59, 130, 246, 0.3)' : 'rgba(59, 130, 246, 0.25)'}; border-radius: 6px; color: ${isLight ? '#2563eb' : '#93c5fd'}; cursor: pointer; display: flex; align-items: center; gap: 4px; text-align: center;" title="Copy diagnostic system report to clipboard">
                            ${ICONS.clipboard} <span>Copy Log</span>
                        </button>
                        <button id="amaes-reset-btn" type="button" class="amaes-btn" style="font-size: 10.5px; padding: 6px 4px; justify-content: center; background: ${isLight ? 'rgba(245, 158, 11, 0.12)' : 'rgba(245, 158, 11, 0.1)'}; border: 1px solid ${isLight ? 'rgba(245, 158, 11, 0.3)' : 'rgba(245, 158, 11, 0.25)'}; border-radius: 6px; color: ${isLight ? '#d97706' : '#fcd34d'}; cursor: pointer; display: flex; align-items: center; gap: 4px; text-align: center;" title="Reset installation: clear toolkit data and reopen welcome setup">
                            ${ICONS.rotateCcw} <span>Reset All</span>
                        </button>
                    </div>

                    <!-- Agreement Disclaimer -->
                    <label style="display: flex; align-items: flex-start; gap: 10px; background: ${isLight ? '#f0fdf4' : 'rgba(16, 185, 129, 0.04)'}; border: 1px solid ${isLight ? '#bbf7d0' : 'rgba(16, 185, 129, 0.2)'}; border-radius: 8px; padding: 10px 12px; cursor: pointer; transition: all 0.2s; margin-top: 2px;" id="welcome-terms-container">
                        <input id="welcome-chk-terms" type="checkbox" ${localStorage.getItem('amaes_terms_acknowledged') === 'true' ? 'checked' : ''} style="width: 18px; height: 18px; margin-top: 1px; cursor: pointer; accent-color: #10b981; flex-shrink: 0;" />
                        <span style="color: ${isLight ? '#1e293b' : '#cbd5e1'}; font-size: 11px; line-height: 1.4;">I understand this is an independent study aid. I agree to the <a href="https://github.com/Acads-Tools/amaes-toolkit#important-use-disclaimer" target="_blank" rel="noopener noreferrer" style="color: ${isLight ? '#2563eb' : '#93c5fd'}; font-weight: 600; text-decoration: underline; text-underline-offset: 2px;" onclick="event.stopPropagation();">Terms of Use & Disclaimer</a>, will use it responsibly, and agree to share verified answers anonymously to help classmates.</span>
                    </label>
                </div>

                <!-- Footer Action -->
                <div style="padding: 12px 20px; border-top: 1px solid ${isLight ? '#e2e8f0' : '#334155'}; background: ${isLight ? '#f8fafc' : '#0f172a'}; display: flex; justify-content: space-between; align-items: center;">
                    <a href="https://github.com/Acads-Tools/amaes-toolkit#frequently-asked-questions-faqs" target="_blank" rel="noopener noreferrer" style="color: ${isLight ? '#64748b' : '#94a3b8'}; font-size: 11px; text-decoration: none; display: flex; align-items: center; gap: 4px;" title="View FAQs & Guide">
                        📖 <span>FAQs & Guide</span>
                    </a>
                    <button id="btn-got-it-welcome" class="amaes-btn amaes-btn-green" ${localStorage.getItem('amaes_terms_acknowledged') === 'true' ? '' : 'disabled'} style="padding: 8px 20px; border-radius: 8px; font-weight: 700; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; opacity: ${localStorage.getItem('amaes_terms_acknowledged') === 'true' ? '1' : '0.5'};">
                        ${ICONS.zap} Get Started
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const bindWelcomeToggle = (id, storageKey, onToggle) => {
            const el = document.getElementById(id);
            if (el) {
                el.onchange = (e) => {
                    localStorage.setItem(storageKey, e.target.checked);
                    if (onToggle) onToggle(e.target.checked);
                };
            }
        };

        bindWelcomeToggle('welcome-chk-sync', 'amaes_auto_cloud_sync', (v) => { autoCloudSync = v; });
        bindWelcomeToggle('welcome-chk-share', 'amaes_auto_community_share', (v) => { autoCommunityShare = v; });
        bindWelcomeToggle('welcome-chk-harvest', 'amaes_auto_harvest_grades', (v) => { if (typeof autoHarvestGrades !== 'undefined') autoHarvestGrades = v; });
        bindWelcomeToggle('welcome-chk-scrape', 'amaes_auto_scrape_amauoed', (v) => { autoScrapeAmauoed = v; });

        // Developer Section Logic (Lock-Free Direct Console)
        const devSection = document.getElementById('amaes-quick-dev-section');
        const devCloseBtn = document.getElementById('amaes-dev-btn-close');
        const devCmdInput = document.getElementById('amaes-dev-cmd-input');
        const devCmdRunBtn = document.getElementById('amaes-dev-cmd-run');

        if (devCloseBtn) {
            devCloseBtn.onclick = () => {
                if (devSection) devSection.style.display = 'none';
                if (devMeshInterval) {
                    clearInterval(devMeshInterval);
                    devMeshInterval = null;
                }
            };
        }

        if (devCmdRunBtn) devCmdRunBtn.onclick = executeToolkitDevCommand;
        if (devCmdInput) {
            devCmdInput.onkeydown = (e) => {
                if (e.key === 'Enter') executeToolkitDevCommand();
            };
        }

        const revealDevSection = (forceOpen = false) => {
            const sec = document.getElementById('amaes-quick-dev-section');
            if (sec) {
                const isHidden = sec.style.display === 'none' || !sec.style.display;
                if (forceOpen || isHidden) {
                    sec.style.display = 'flex';
                    startDevMeshTelemetry();
                    setTimeout(() => {
                        try { sec.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {}
                        const cmdInp = document.getElementById('amaes-dev-cmd-input');
                        if (cmdInp && cmdInp.offsetParent !== null) {
                            cmdInp.focus();
                        }
                    }, 50);
                } else {
                    sec.style.display = 'none';
                    if (devMeshInterval) {
                        clearInterval(devMeshInterval);
                        devMeshInterval = null;
                    }
                }
            }
        };

        const attachSecretTrigger = (el) => {
            if (!el) return;
            el.ondblclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                revealDevSection();
            };
        };

        const secretCheatsheetTrigger = document.getElementById('amaes-secret-cheatsheet-trigger');
        attachSecretTrigger(secretCheatsheetTrigger);
        attachSecretTrigger(document.getElementById('welcome-shortcuts-title'));

        if (focusDev) {
            revealDevSection(true);
        }

        const termsCheck = document.getElementById('welcome-chk-terms');
        const gotItButton = document.getElementById('btn-got-it-welcome');
        const termsContainer = document.getElementById('welcome-terms-container');
        
        if (termsCheck && gotItButton && termsContainer) {
            termsCheck.onchange = () => {
                const checked = termsCheck.checked;
                localStorage.setItem('amaes_terms_acknowledged', checked ? 'true' : 'false');
                gotItButton.disabled = !checked;
                gotItButton.style.opacity = checked ? '1' : '0.5';
                termsContainer.style.borderColor = checked ? 'rgba(16, 185, 129, 0.5)' : 'rgba(16, 185, 129, 0.2)';
                if (typeof window._amaesUpdatePanelLockState === 'function') window._amaesUpdatePanelLockState();
                if (!checked) {
                    autoQuizMode = false;
                    localStorage.setItem('amaes_auto_quiz_mode', 'false');
                    showToast("Agreement unaccepted. Pausing tools and refreshing page...", 2500);
                    setTimeout(() => window.location.reload(), 500);
                }
            };
        }

        const welcomeAiBtn = document.getElementById('welcome-btn-setup-ai');
        if (welcomeAiBtn) {
            welcomeAiBtn.onclick = () => {
                showGeminiSetupModal();
            };
        }

        const welcomeReinstallBtn = document.getElementById('welcome-btn-reinstall');
        if (welcomeReinstallBtn) {
            welcomeReinstallBtn.onclick = (e) => {
                e.preventDefault();
                triggerScriptReinstall();
            };
        }

        const themeBtn = document.getElementById('amaes-theme-btn');
        if (themeBtn) {
            themeBtn.onclick = () => {
                const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
                applyTheme(nextTheme);
                showToast(`Theme switched to ${nextTheme} mode`);
                showWelcomeOnboardingModal(true);
            };
        }

        const bugBtn = document.getElementById('amaes-bug-btn');
        if (bugBtn) {
            bugBtn.onclick = () => {
                showBugReportModal();
            };
        }

        const debugBtn = document.getElementById('amaes-debug-btn');
        if (debugBtn) {
            debugBtn.onclick = async () => {
                logDebug("Exporting debug diagnostic report...");
                const report = generateDebugReport();
                try {
                    await copyToClipboard(report);
                    debugBtn.innerHTML = `${ICONS.check} <span>Copied!</span>`;
                    showToast("Diagnostic log copied to clipboard!");
                    setTimeout(() => {
                        if (debugBtn) {
                            debugBtn.innerHTML = `${ICONS.clipboard} <span>Copy Log</span>`;
                        }
                    }, 2000);
                } catch (err) {
                    showToast("Failed to copy log");
                }
            };
        }

        const resetBtn = document.getElementById('amaes-reset-btn');
        if (resetBtn) {
            resetBtn.onclick = () => {
                const ok = confirm(
                    "Reset AMAES Toolkit to a brand-new installation?\n\n" +
                    "This clears toolkit settings, cached answer databases, anonymous sharing history, update state, and welcome-page acceptance. " +
                    "It does not uninstall Violentmonkey or delete Moodle data.\n\n" +
                    "The welcome setup will reopen after reset. Continue?"
                );
                if (ok) {
                    resetToolkitInstallation();
                }
            };
        }

        const btnCopyInstallGuide = document.getElementById('btn-copy-install-guide');
        if (btnCopyInstallGuide) {
            btnCopyInstallGuide.onclick = () => {
                const guideText = `AMAES Moodle Toolkit - Setup & Installation Guide\n\n` +
                    `Step 1: Install Violentmonkey (Recommended Userscript Manager):\n` +
                    `• Chrome / Brave: https://chromewebstore.google.com/detail/violentmonkey/jinjaccalgkegednnccohejagnlnfdag\n` +
                    `• Firefox: https://addons.mozilla.org/en-US/firefox/addon/violentmonkey/\n` +
                    `• Edge: https://microsoftedge.microsoft.com/addons/detail/violentmonkey/eeagobfjfgddacbcigncyclcoaebeent\n\n` +
                    `Step 2 (CRITICAL for Chrome / Brave / Edge / Opera):\n` +
                    `• Open chrome://extensions (or edge://extensions) in your browser.\n` +
                    `• Turn ON "Developer mode" in the top-right corner.\n` +
                    `(Without Developer mode, modern Chromium browsers block all userscripts from running!)\n\n` +
                    `Step 3: Install the Script:\n` +
                    `• Direct Install: ${SCRIPT_RAW_URL}\n` +
                    `• Greasy Fork: ${GREASYFORK_URL}\n` +
                    `• GitHub Repo: ${GITHUB_REPO_URL}\n` +
                    `• Violentmonkey will open a tab — click "Confirm installation".\n\n` +
                    `Step 4: Go to https://semestral.amaes.com/ (e.g. /2612/ or your semester's term path) and log in!\n` +
                    `The toolkit panel will automatically appear in the bottom-right corner!`;

                if (typeof GM_setClipboard !== 'undefined') {
                    GM_setClipboard(guideText);
                } else if (navigator.clipboard) {
                    navigator.clipboard.writeText(guideText);
                }
                showToast("Setup & install guide copied to clipboard!");
            };
        }

        let modalBacktickCount = 0;
        let modalBacktickTimer = null;

        const handleModalEsc = (e) => {
            if (e.key === 'Escape' || e.key === 'Esc') {
                e.preventDefault();
                e.stopPropagation();
                closeModalClean();
                showToast("Closed Quick Start (Esc)");
                return;
            }
            if (e.key === '`' || e.code === 'Backquote') {
                const active = document.activeElement;
                if (active && active.id !== 'amaes-dev-cmd-input' && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) {
                    return;
                }
                modalBacktickCount++;
                clearTimeout(modalBacktickTimer);
                modalBacktickTimer = setTimeout(() => { modalBacktickCount = 0; }, 1200);
                if (modalBacktickCount >= 3) {
                    modalBacktickCount = 0;
                    e.preventDefault();
                    e.stopPropagation();
                    revealDevSection();
                }
            }
        };

        const closeModalClean = () => {
            window.removeEventListener('keydown', handleModalEsc);
            if (devMeshInterval) {
                clearInterval(devMeshInterval);
                devMeshInterval = null;
            }
            modal.remove();
        };
        window.addEventListener('keydown', handleModalEsc);

        modal.onclick = (e) => {
            if (e.target === modal) {
                closeModalClean();
            }
        };

        const dismiss = () => {
            if (localStorage.getItem('amaes_terms_acknowledged') !== 'true') {
                showToast("Please acknowledge the terms before proceeding.");
                return;
            }
            closeModalClean();
            localStorage.setItem('amaes_welcome_dismissed', 'true');
            if (typeof window._amaesUpdatePanelLockState === 'function') window._amaesUpdatePanelLockState();
            showToast("Terms accepted! Toolkit unlocked. Refreshing to activate...", 2500);
            setTimeout(() => window.location.reload(), 500);
        };

        if (gotItButton) gotItButton.onclick = dismiss;
        
        const closeBtn = document.getElementById('btn-welcome-close');
        if (closeBtn) closeBtn.onclick = closeModalClean;
    }

    // UI Panel Construction
