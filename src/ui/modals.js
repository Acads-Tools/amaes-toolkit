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

        modal.innerHTML = `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 16px; width: 100%; max-width: 520px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden; color: #f8fafc; display: flex; flex-direction: column; max-height: 90vh;">
                <div style="padding: 20px 24px; text-align: center; border-bottom: 1px solid #334155; background: linear-gradient(135deg, #1e293b, #0f172a); display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; flex-direction: column; align-items: flex-start;">
                        <h2 style="margin: 0; font-size: 20px; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px;">
                            ${ICONS.zap} Welcome to AMAES Toolkit
                        </h2>
                        <span style="font-size: 11px; color: #94a3b8; font-weight: 600; margin-top: 4px;">Your All-in-One Study & Quiz Companion</span>
                    </div>
                    ${force ? `<button id="btn-welcome-close" style="background:none; border:none; color:#94a3b8; font-size:24px; cursor:pointer; line-height:1; padding: 4px;">&times;</button>` : ''}
                </div>
                
                <div id="amaes-welcome-scroll-container" style="padding: 24px; font-size: 13px; line-height: 1.5; display: flex; flex-direction: column; gap: 16px; overflow-y: auto;">
                    
                    <!-- Core Features -->
                    <div style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 8px; padding: 12px 14px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                            <h3 style="margin: 0; font-size: 13.5px; color: #60a5fa; display: flex; align-items: center; gap: 6px;">${ICONS.checkCircle} Smart Auto-Answer & Highlighter</h3>
                            <span style="font-size: 9px; font-family: monospace; color: #93c5fd; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.35); padding: 1px 6px; border-radius: 3px;">Background Capable</span>
                        </div>
                        <p style="margin: 0; color: #cbd5e1; font-size: 11.5px; line-height: 1.45;">Automatically recognizes your subject, finds verified answers shared by students, and highlights the right choices. Auto-Quiz runs autonomously in the background while you switch tabs or multitask in other applications.</p>
                    </div>

                    <div style="background: rgba(167, 139, 250, 0.1); border: 1px solid rgba(167, 139, 250, 0.2); border-radius: 8px; padding: 12px 14px;">
                        <h3 style="margin: 0 0 4px; font-size: 13.5px; color: #c4b5fd; display: flex; align-items: center; gap: 6px;">${ICONS.search} Online Study Guide Backup</h3>
                        <p style="margin: 0; color: #cbd5e1; font-size: 11.5px; line-height: 1.45;">Automatically checks online student study guides (AMAUOED) to find answers whenever a question isn't in your saved library yet.</p>
                    </div>

                    <!-- Built-in Gemini AI Assistant -->
                    <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.25); border-radius: 8px; padding: 12px 14px;">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
                            <h3 style="margin: 0; font-size: 13.5px; color: #c084fc; display: flex; align-items: center; gap: 6px;">${ICONS.zap} Built-in Google Gemini AI</h3>
                            <span style="font-size: 9px; font-family: monospace; color: #d8b4fe; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.35); padding: 1px 6px; border-radius: 3px;">100% Free · Experimental</span>
                        </div>
                        <p style="margin: 0 0 8px; color: #cbd5e1; font-size: 11.5px; line-height: 1.45;">Direct in-quiz AI solving for uncertain Multiple Choice and True/False questions. Features <b>in-session answer caching</b> (0 duplicate API requests), <b>elimination safety guards</b> against known wrong choices, <b>configurable retries</b>, and <b>auto-copy on failure</b>.</p>
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <button id="welcome-btn-setup-ai" type="button" class="amaes-btn" style="background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; font-size: 11px; padding: 4px 10px; border-radius: 5px; font-weight: 700; cursor: pointer; border: none; display: inline-flex; align-items: center; gap: 4px;">
                                <span>${geminiApiKey ? 'Configure AI key' : 'Setup Free AI Assistant'}</span>
                            </button>
                        </div>
                    </div>

                    <!-- Collect & Share Anonymously -->
                    <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 12px 14px;">
                        <h3 style="margin: 0 0 4px; font-size: 13.5px; color: #34d399; display: flex; align-items: center; gap: 6px;">${ICONS.upload} Collect & Share Anonymously</h3>
                        <p style="margin: 0 0 6px; color: #cbd5e1; font-size: 11.5px; line-height: 1.45;">Help your fellow students! Confirmed answers from completed quizzes are automatically saved and shared <b>100% anonymously</b>. No names, IDs, or personal info are ever shared.</p>
                        
                        <!-- Mini Toggles with Comfortable Touch Spacing -->
                        <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 10px; background: rgba(0, 0, 0, 0.2); padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.05);">
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #e2e8f0; cursor: pointer; padding: 1px 0;">
                                <input id="welcome-chk-harvest" type="checkbox" ${typeof autoHarvestGrades !== 'undefined' && autoHarvestGrades ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #10b981;" />
                                <span>Automatically save confirmed answers from completed quizzes</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #e2e8f0; cursor: pointer; padding: 1px 0;">
                                <input id="welcome-chk-sync" type="checkbox" ${autoCloudSync ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #10b981;" />
                                <span>Automatically download verified answers on course open</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #e2e8f0; cursor: pointer; padding: 1px 0;">
                                <input id="welcome-chk-scrape" type="checkbox" ${autoScrapeAmauoed ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #10b981;" />
                                <span>Auto-check online study guides when missing</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 11px; color: #e2e8f0; cursor: pointer; padding: 1px 0;">
                                <input id="welcome-chk-share" type="checkbox" ${autoCommunityShare ? 'checked' : ''} style="cursor: pointer; width: 14px; height: 14px; accent-color: #10b981;" />
                                <span>Share verified answers with classmates (100% anonymous)</span>
                            </label>
                        </div>
                    </div>

                    <!-- Keyboard Shortcuts Cheatsheet (Comprehensive) -->
                    <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 8px; padding: 12px 14px;" id="welcome-shortcuts-section">
                        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                            <h3 id="welcome-shortcuts-title" style="margin: 0; font-size: 13.5px; color: #fcd34d; display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none;" title="Double-click to toggle Developer Console">
                                ${ICONS.zap} <span>Keyboard Shortcuts</span> <span id="amaes-secret-cheatsheet-trigger" style="cursor: pointer; user-select: none; border-bottom: 1px dotted #fcd34d;" title="Double-click to toggle Developer Console">Cheatsheet</span>
                            </h3>
                            <span style="font-size: 10px; color: #94a3b8; font-weight: 600;">Press <kbd style="background: #334155; color: #fff; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 9px;">?</kbd> or <kbd style="background: #334155; color: #fff; padding: 1px 5px; border-radius: 3px; font-family: monospace; font-size: 9px;">K</kbd> anywhere</span>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px 12px; font-size: 11px; color: #cbd5e1;">
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="min-width: 65px;"><kbd style="background: #334155; padding: 2px 5px; border-radius: 4px; font-weight: 700; color: #fff; font-family: monospace;">N</kbd> / <kbd style="background: #334155; padding: 2px 5px; border-radius: 4px; font-weight: 700; color: #fff; font-family: monospace;">Space</kbd></span>
                                <span>Next Question / Page</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="min-width: 65px;"><kbd style="background: #334155; padding: 2px 6px; border-radius: 4px; font-weight: 700; color: #fff; font-family: monospace;">C</kbd></span>
                                <span>Copy AI Prompt</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="min-width: 65px;"><kbd style="background: #334155; padding: 2px 6px; border-radius: 4px; font-weight: 700; color: #fff; font-family: monospace;">V</kbd></span>
                                <span>Paste AI Answer</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="min-width: 65px;"><kbd style="background: #334155; padding: 2px 6px; border-radius: 4px; font-weight: 700; color: #fff; font-family: monospace;">P</kbd></span>
                                <span>Pause / Resume Auto-Quiz</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="min-width: 65px;"><kbd style="background: #334155; padding: 2px 5px; border-radius: 4px; font-weight: 700; color: #fff; font-family: monospace;">1–4</kbd> / <kbd style="background: #334155; padding: 2px 5px; border-radius: 4px; font-weight: 700; color: #fff; font-family: monospace;">A–D</kbd></span>
                                <span>Select Choice 1 to 4</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="min-width: 65px;"><kbd style="background: #334155; padding: 2px 6px; border-radius: 4px; font-weight: 700; color: #fff; font-family: monospace;">H</kbd></span>
                                <span>Highlight Answers</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="min-width: 65px;"><kbd style="background: #334155; padding: 2px 5px; border-radius: 4px; font-weight: 700; color: #fff; font-family: monospace;">?</kbd> / <kbd style="background: #334155; padding: 2px 5px; border-radius: 4px; font-weight: 700; color: #fff; font-family: monospace;">K</kbd></span>
                                <span>Open Quick Guide</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <span style="min-width: 65px;"><kbd style="background: #334155; padding: 2px 5px; border-radius: 4px; font-weight: 700; color: #fff; font-family: monospace;">Esc</kbd></span>
                                <span>Close Modal / Minimize</span>
                            </div>
                        </div>
                    </div>

                    <!-- Developer & Diagnostic Console Section (Zero Emojis, Direct Terminal Access, Placed Directly Below Cheatsheet) -->
                    <div id="amaes-quick-dev-section" style="display: none; background: #15102a; border: 2px solid #a855f7; border-radius: 8px; padding: 14px; flex-direction: column; gap: 10px; box-shadow: 0 0 25px rgba(168, 85, 247, 0.25);">
                        <div style="display: flex; align-items: center; justify-content: space-between;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <h3 style="margin: 0; font-size: 13px; color: #c084fc; display: flex; align-items: center; gap: 6px;">
                                    ${ICONS.debug} <span>Developer & Diagnostics Console</span>
                                </h3>
                                <span style="font-size: 9px; font-family: monospace; background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); padding: 1px 5px; border-radius: 3px;">Active</span>
                            </div>
                            <button id="amaes-dev-btn-close" type="button" class="amaes-btn amaes-btn-outline" style="font-size: 9.5px; padding: 2px 8px; color: #94a3b8; border-color: #475569; cursor: pointer;" title="Collapse console">
                                Collapse
                            </button>
                        </div>

                        <!-- Community Mesh Telemetry Card -->
                        <div style="background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; justify-content: space-between;">
                            <div>
                                <div style="font-size: 9px; font-family: monospace; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Active Mesh Telemetry</div>
                                <div style="display: flex; align-items: baseline; gap: 5px; margin-top: 2px;">
                                    <span id="amaes-dev-mesh-count" style="font-size: 18px; font-weight: 800; font-family: monospace; color: #c084fc;">--</span>
                                    <span style="font-size: 10.5px; color: #94a3b8;">peers active</span>
                                </div>
                            </div>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #a855f7; box-shadow: 0 0 6px #a855f7;"></span>
                                <span style="font-size: 9.5px; color: #cbd5e1; font-family: monospace;">Mesh Connected</span>
                            </div>
                        </div>

                        <!-- Diagnostic Terminal Box (Admin Friendly, Spacious Monospace) -->
                        <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 6px; padding: 6px 8px; display: flex; flex-direction: column; gap: 5px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: #94a3b8; font-family: monospace; text-transform: uppercase;">
                                <span>Terminal Command Line</span>
                                <span>Type 'help' for commands</span>
                            </div>
                            <div style="display: flex; align-items: center; gap: 4px;">
                                <span style="font-family: monospace; font-size: 11px; font-weight: 700; color: #c084fc;">&gt;</span>
                                <input id="amaes-dev-cmd-input" type="text" placeholder="status, ping, users, cache, logs, clear..." style="flex: 1; background: rgba(0, 0, 0, 0.3); border: 1px solid #475569; border-radius: 4px; padding: 4px 7px; font-family: monospace; font-size: 10.5px; color: #fff; outline: none;" />
                                <button id="amaes-dev-cmd-run" type="button" class="amaes-btn" style="padding: 4px 10px; font-size: 10px; font-family: monospace; cursor: pointer; background: #9333ea; color: #fff; border: none; border-radius: 4px; font-weight: 600;">
                                    Run
                                </button>
                            </div>
                            <div id="amaes-dev-cmd-output" style="background: rgba(0, 0, 0, 0.5); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 4px; padding: 7px 9px; height: 260px; min-height: 240px; overflow-y: auto; font-family: monospace; font-size: 10.5px; line-height: 1.5; color: #cbd5e1; display: flex; flex-direction: column; gap: 3px; user-select: text;">
                                <div style="color: #64748b;">Developer diagnostic terminal ready. Type 'help' for command suite.</div>
                            </div>
                        </div>
                    </div>

                    <!-- Links with Equal Flex-Grid Widths: GitHub, Greasy Fork, Website, Reinstall -->
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px;">
                        <a href="${GITHUB_REPO_URL}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; padding: 7px 4px; justify-content: center; background: rgba(0,0,0,0.3); border: 1px solid #334155; border-radius: 6px; color: #cbd5e1; text-decoration: none; display: flex; align-items: center; gap: 5px; text-align: center;">${ICONS.github} <span>GitHub</span></a>
                        <a href="${GREASYFORK_URL}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; padding: 7px 4px; justify-content: center; background: rgba(0,0,0,0.3); border: 1px solid #334155; border-radius: 6px; color: #cbd5e1; text-decoration: none; display: flex; align-items: center; gap: 5px; text-align: center;">${ICONS.greasyfork} <span>Greasy Fork</span></a>
                        <a href="${WEBSITE_URL}" target="_blank" rel="noopener noreferrer" style="font-size: 11px; padding: 7px 4px; justify-content: center; background: rgba(0,0,0,0.3); border: 1px solid #334155; border-radius: 6px; color: #cbd5e1; text-decoration: none; display: flex; align-items: center; gap: 5px; text-align: center;">${ICONS.globe} <span>Website</span></a>
                        <button id="welcome-btn-reinstall" type="button" class="amaes-btn" style="font-size: 11px; padding: 7px 4px; justify-content: center; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 6px; color: #a7f3d0; cursor: pointer; display: flex; align-items: center; gap: 5px; text-align: center; font-weight: 700;" title="Reinstall current toolkit in Violentmonkey / Tampermonkey">${ICONS.download} <span>Reinstall</span></button>
                    </div>

                    <!-- Agreement with High-Contrast Link -->
                    <label style="display: flex; align-items: flex-start; gap: 12px; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 8px; padding: 14px; cursor: pointer; transition: all 0.2s; margin-top: 2px;" id="welcome-terms-container">
                        <input id="welcome-chk-terms" type="checkbox" ${localStorage.getItem('amaes_terms_acknowledged') === 'true' ? 'checked' : ''} style="width: 20px; height: 20px; margin-top: 2px; cursor: pointer; accent-color: #10b981; flex-shrink: 0;" />
                        <span style="color: #e2e8f0; font-size: 11.5px; line-height: 1.45;">I understand this is an independent study aid. I agree to the <a href="https://github.com/Acads-Tools/amaes-toolkit#important-use-disclaimer" target="_blank" rel="noopener noreferrer" style="color: #93c5fd; font-weight: 600; text-decoration: underline; text-underline-offset: 2px;" onclick="event.stopPropagation();">Terms of Use & Disclaimer</a>, will use it responsibly, and agree to share verified answers anonymously to help classmates.</span>
                    </label>
                </div>

                <div style="padding: 16px 24px; border-top: 1px solid #334155; background: #0f172a; display: flex; justify-content: flex-end; gap: 12px;">
                    <button id="btn-got-it-welcome" class="amaes-btn amaes-btn-green" ${localStorage.getItem('amaes_terms_acknowledged') === 'true' ? '' : 'disabled'} style="padding: 10px 24px; border-radius: 8px; font-weight: 700; font-size: 14px; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; opacity: ${localStorage.getItem('amaes_terms_acknowledged') === 'true' ? '1' : '0.5'};">
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
