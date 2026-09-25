    // ==========================================

    function createPanel() {
        if (document.getElementById('amaes-toolkit-panel')) return;

        const courseInfo = detectCourseInfo();
        const allLocalDbs = getAllSavedSubjectDatabases();
        const cachedCodes = Object.keys(allLocalDbs);
        const cardCodes = [];
        document.querySelectorAll('.coursebox, .dashboard-card, [data-course-id], .course-info-container').forEach(card => {
            const txt = card.innerText || '';
            const m = txt.match(/\b([A-Za-z]{2,4}\d{4})\b/);
            if (m && !cardCodes.includes(m[1].toUpperCase())) {
                cardCodes.push(m[1].toUpperCase());
            }
        });
        const detectedCodes = Array.from(new Set([...(courseInfo.subjectCode ? [courseInfo.subjectCode] : []), ...cachedCodes, ...cardCodes]));
        const hasActiveCourse = !!courseInfo.subjectCode;
        let subCode = courseInfo.subjectCode || detectedCodes[0] || '';
        const defaultAmauoedUrl = subCode ? getStoredAmauoedUrl(subCode) : '';
        const cachedQuestions = subCode ? getCachedAnswers(subCode) : null;
        const isQuiz = checkIsQuizPage();

        let initialKeyword = "";
        if (courseInfo.subjectCode) {
            initialKeyword = courseInfo.currentActivityTitle
                ? `${courseInfo.subjectCode} ${courseInfo.currentActivityTitle} answer key`
                : `${courseInfo.subjectCode} answer key`;
        }

        const panel = document.createElement('div');
        panel.id = 'amaes-toolkit-panel';

        panel.innerHTML = `
            <!-- Top App Bar (Overflow-Proof) -->
            <div id="amaes-header">
                <div id="amaes-brand">
                    <div id="amaes-title-group" style="display: flex; align-items: center; gap: 4px;">
                        <img id="amaes-logo-img" src="${TOOLKIT_LOGO_URL}" alt="" aria-hidden="true">
                        <span id="amaes-title">AMAES</span>
                        <span id="amaes-version-pill" title="${SCRIPT_VERSION}" style="display: inline-flex; align-items: center; max-width: 100%; overflow: visible; white-space: nowrap; font-size: 9px; font-weight: 700; color: var(--accent-blue, #3b82f6); background: rgba(59,130,246,0.12); padding: 1px 4px; border-radius: 4px; border: 1px solid rgba(59,130,246,0.25); cursor: pointer; user-select: none;">${SCRIPT_VERSION}</span>
                    </div>
                </div>
                
                <div id="amaes-actions">
                    <button id="amaes-reset-btn" class="amaes-icon-btn" title="Reset installation: clear toolkit data and reopen welcome setup">
                        ${ICONS.rotateCcw}
                    </button>

                    <button id="amaes-help-btn" class="amaes-icon-btn" title="Quick Start Guide & Documentation">
                        ${ICONS.help}
                    </button>

                    <a id="amaes-home-btn" class="amaes-icon-btn" href="${getSemesterCoursesUrl()}" title="Dashboard (My Courses)">
                        ${ICONS.home}
                    </a>

                    <button id="amaes-theme-btn" class="amaes-icon-btn" title="Toggle Dark / Light Theme">
                        ${currentTheme === 'dark' ? ICONS.sun : ICONS.moon}
                    </button>

                    <button id="amaes-bug-btn" class="amaes-icon-btn" title="Report a Problem / Bug to Maintainers">
                        ${ICONS.bug || ICONS.alertTriangle}
                    </button>

                    ${DEBUG_MODE ? `
                    <button id="amaes-debug-btn" class="amaes-icon-btn amaes-debug-btn" title="System Diagnostics & Report (Click to copy report)">
                        ${ICONS.debug}
                    </button>` : ''}

                    <button id="amaes-min-btn" class="amaes-icon-btn" title="Minimize / Expand">
                        ${ICONS.minimize}
                    </button>
                </div>
            </div>

            <!-- Lock Overlay (Displayed when terms are not acknowledged) -->
            <div id="amaes-panel-lock-overlay" style="display: none; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 10px; background: rgba(15, 23, 42, 0.96); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 10px; padding: 16px 14px; margin-top: 6px; box-sizing: border-box;">
                <div id="amaes-lock-big-icon" style="width: 44px; height: 44px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); display: flex; align-items: center; justify-content: center; color: #f87171; cursor: pointer; transition: transform 0.15s ease;" title="Click to view terms and conditions">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                </div>
                <div>
                    <div style="font-weight: 800; font-size: 13px; color: #f87171; display: flex; align-items: center; justify-content: center; gap: 5px;">
                        ${ICONS.lock} <span>Toolkit Locked</span>
                    </div>
                    <div style="font-size: 10.5px; color: var(--text-secondary, #cbd5e1); margin-top: 4px; line-height: 1.4;">
                        Please agree to the study disclaimer below to unlock the toolkit and quiz tools.
                    </div>
                </div>

                <label id="amaes-lock-terms-label" style="display: flex; align-items: flex-start; gap: 8px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 6px; padding: 10px; cursor: pointer; text-align: left; width: 100%; box-sizing: border-box; transition: border-color 0.2s;">
                    <input id="amaes-lock-chk-terms" type="checkbox" style="width: 16px; height: 16px; margin-top: 2px; cursor: pointer; accent-color: #10b981; flex-shrink: 0;" />
                    <span style="font-size: 10.5px; color: #cbd5e1; line-height: 1.35;">
                        I understand and accept the <a href="https://github.com/Acads-Tools/amaes-toolkit#important-use-disclaimer" target="_blank" rel="noopener noreferrer" style="color: #93c5fd; font-weight: 600; text-decoration: underline; text-underline-offset: 2px;" onclick="event.stopPropagation();">Terms of Use & Disclaimer</a>, and will use this toolkit responsibly.
                    </span>
                </label>

                <div style="display: flex; flex-direction: column; gap: 6px; width: 100%;">
                    <button id="amaes-btn-lock-view-terms" class="amaes-btn amaes-btn-outline" style="padding: 6px 10px; font-size: 10px; width: 100%; justify-content: center; cursor: pointer;">
                        ${ICONS.help} <span>Read Terms & Quick Start Guide</span>
                    </button>
                </div>
            </div>

            <!-- Main Panel Body -->
            <div id="amaes-panel-body">

                <!-- Dynamic Update Notification Container -->
                <div id="amaes-update-container"></div>

                <!-- Categorized Persona Navigation Tabs -->
                <div id="amaes-nav-tabs">
                    <button class="amaes-tab-btn active" data-tab="quiz" title="Automatic Quiz Solver, AI Prompts & In-Quiz Assistance">
                        ${ICONS.target} <span>Quiz</span>
                    </button>
                    <button class="amaes-tab-btn" data-tab="db" title="Saved Question Library, Verified Answers & Online Study Guides">
                        ${ICONS.database} <span>Study Library</span>
                    </button>
                    <button class="amaes-tab-btn" data-tab="course" title="Course Tools, Lecture Auto-Marker & Study Helpers">
                        ${ICONS.tools} <span>Course Tools</span>
                    </button>
                </div>

                <!-- TAB PANE 1: Quiz -->
                <div id="tab-pane-quiz" class="amaes-tab-pane" style="padding: 8px; display: flex; flex-direction: column; gap: 6px;">
                    <!-- Master Run / Pause Button with Clear Subtitle -->
                    <div style="display: flex; flex-direction: column; gap: 3px;">
                        <button id="btn-master-auto-quiz" class="amaes-btn" style="justify-content: center; padding: 8px 12px; font-weight: 800; font-size: 11.5px; border: none; border-radius: 6px; background: ${autoQuizMode ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #10b981, #059669)'}; color: #fff; cursor: pointer; box-shadow: 0 2px 6px rgba(0,0,0,0.25);" title="Toggle hands-free Autonomous Quiz Solver (Shortcut: P)">
                            ${autoQuizMode ? ICONS.stop + ' <span>Pause Auto-Quiz</span>' : ICONS.play + ' <span>Start Auto-Quiz</span>'}
                        </button>
                        <div id="amaes-autoquiz-subtext" style="font-size: 9.5px; color: var(--text-muted); text-align: center;">
                            ${autoQuizMode ? 'Auto-answering & advancing in background. Click to pause.' : 'Auto-answers & advances. Pauses & copies on unknown questions.'}
                        </div>
                    </div>

                    <!-- Background Multitasking Capability Notice -->
                    <div id="amaes-autoquiz-bg-notice" style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 6px; padding: 4px 8px; font-size: 9.5px; display: flex; align-items: center; justify-content: space-between; gap: 6px;" title="Auto-Quiz operates autonomously across questions and pages even when you minimize or switch to other windows">
                        <div style="display: flex; align-items: center; gap: 5px;">
                            <span id="amaes-autoquiz-bg-dot" style="display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: ${autoQuizMode ? 'var(--accent-green, #10b981)' : 'var(--text-muted, #94a3b8)'}; ${autoQuizMode ? 'box-shadow: 0 0 6px #10b981;' : ''}"></span>
                            <span style="font-weight: 600; color: var(--text-primary);">Background Capable:</span>
                            <span id="amaes-autoquiz-bg-text" style="color: var(--text-secondary);">${autoQuizMode ? 'Active in background (safe to switch tabs/apps)' : 'Runs while multitasking in other windows'}</span>
                        </div>
                    </div>

                    ${!isQuiz ? `
                    <div id="amaes-quiz-not-attempt-msg" style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.2); border-radius: 6px; padding: 6px 9px; font-size: 10px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">
                        ${ICONS.zap}
                        <span>Open any quiz attempt to auto-answer or copy questions.</span>
                    </div>
                    ` : ''}

                    <!-- Batch AI action: per-question cards provide targeted Copy/Paste actions (only visible when in a quiz question) -->
                    <div id="amaes-batch-copy-container" style="display: ${isQuiz && Boolean(document.querySelector('.que')) ? 'flex' : 'none'}; gap: 4px; margin-top: 2px;">
                        <button id="btn-copy-all-q" class="amaes-btn amaes-btn-outline" style="flex: 1; justify-content: center; padding: 5px 4px; cursor: pointer; font-size: 10px;" title="Copy all questions on current page formatted for AI batch prompt">
                            ${ICONS.copy} <span>Copy All</span>
                        </button>
                    </div>

                    <!-- Primary Core Settings (The 3-Step Pipeline) -->
                    <div style="margin-top: 2px; border-top: 1px solid var(--border-subtle); padding-top: 6px; display: flex; flex-direction: column; gap: 5px;">
                        <label style="display: flex; align-items: flex-start; gap: 6px; font-size: 10.5px; color: var(--accent-green); cursor: pointer; font-weight: 700;" title="Automatically highlight verified database and study guide answers">
                            <input id="chk-auto-hl-quiz" type="checkbox" ${autoHighlightQuiz ? 'checked' : ''} style="cursor: pointer; margin-top: 2px;" />
                            <div>
                                <span>Highlight Answers (Library & Study Guides)</span>
                                <div style="font-size: 9px; color: var(--text-muted); font-weight: normal; margin-top: 1px;">Color-coded verified answers, study guides & eliminated choices</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: flex-start; gap: 6px; font-size: 10.5px; color: #34d399; cursor: pointer; font-weight: 700;" title="Automatically selects choice inputs when verified answers are matched">
                            <input id="chk-auto-pick" type="checkbox" ${autoPickQuiz ? 'checked' : ''} style="cursor: pointer; margin-top: 2px;" />
                            <div>
                                <span>Auto-Pick verified choices on quiz attempts</span>
                                <div style="font-size: 9px; color: var(--text-muted); font-weight: normal; margin-top: 1px;">Picks radio, checkbox, or dropdown option if answer is verified</div>
                            </div>
                        </label>
                        <label style="display: flex; align-items: flex-start; gap: 6px; font-size: 10.5px; color: var(--accent-blue); cursor: pointer; font-weight: 700;" title="When enabled, advances smoothly to next question when answered (Default: ON)">
                            <input id="chk-auto-next-verified" type="checkbox" ${autoNextVerified ? 'checked' : ''} style="cursor: pointer; margin-top: 2px;" />
                            <div>
                                <span>Auto-Next when Answered (Smart Next)</span>
                                <div style="font-size: 9px; color: var(--text-muted); font-weight: normal; margin-top: 1px;">Advances automatically when answered; pauses on unknown questions</div>
                            </div>
                        </label>
                    </div>

                    <!-- Collapsible Google Gemini AI Settings (Collapsed by default for clean UX) -->
                    <details id="amaes-ai-quiz-settings-block" style="display: ${geminiApiKey ? 'block' : 'none'}; margin-top: 2px; border: 1px solid rgba(168, 85, 247, 0.28); border-radius: 6px; background: rgba(168, 85, 247, 0.05); overflow: hidden;">
                        <summary style="cursor: pointer; padding: 5px 8px; font-size: 10px; font-weight: 700; color: #c084fc; display: flex; align-items: center; justify-content: space-between; user-select: none;">
                            <span style="display: flex; align-items: center; gap: 4px; text-transform: uppercase; letter-spacing: 0.5px; font-size: 9.5px;">
                                <span>Google Gemini AI (Experimental)</span>
                            </span>
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span id="amaes-ai-quiz-status-pill" style="font-size: 8.5px; font-weight: 700; color: #34d399; background: rgba(52, 211, 153, 0.1); border: 1px solid rgba(52, 211, 153, 0.3); border-radius: 3px; padding: 1px 5px;">Active</span>
                                <span class="amaes-ai-toggle-hint" style="font-size: 8.5px; color: var(--text-muted);">Click to expand</span>
                            </div>
                        </summary>
                        <div style="display: flex; flex-direction: column; gap: 5px; padding: 6px 8px; border-top: 1px solid rgba(168, 85, 247, 0.2); background: rgba(0, 0, 0, 0.15);">
                            <label style="display: flex; align-items: flex-start; gap: 6px; font-size: 10.5px; color: #c084fc; cursor: pointer; font-weight: 700;" title="When question is not in DB, automatically ask Google Gemini 1.5 Flash for the answer">
                                <input id="chk-ai-quiz-enabled" type="checkbox" ${aiQuizEnabled ? 'checked' : ''} style="cursor: pointer; margin-top: 2px;" />
                                <div>
                                    <span>Get Answers from AI on Unknown Questions</span>
                                    <div style="font-size: 9px; color: var(--text-muted); font-weight: normal; margin-top: 1px;">Auto-answers uncertain multiple choice and true/false questions</div>
                                </div>
                            </label>
                            <label style="display: flex; align-items: flex-start; gap: 6px; font-size: 10.5px; color: #e9d5ff; cursor: pointer; font-weight: 600;" title="When enabled, automatically selects the option suggested by AI. When disabled, only highlights it with a purple badge">
                                <input id="chk-ai-auto-select" type="checkbox" ${aiAutoSelect ? 'checked' : ''} style="cursor: pointer; margin-top: 2px;" />
                                <div>
                                    <span>Auto-Select AI Answers</span>
                                    <div style="font-size: 9px; color: var(--text-muted); font-weight: normal; margin-top: 1px;">Automatically checks AI choice (if off, highlights in purple for manual review)</div>
                                </div>
                            </label>
                            <label style="display: flex; align-items: flex-start; gap: 6px; font-size: 10.5px; color: #e9d5ff; cursor: pointer; font-weight: 600;" title="When enabled, automatically copies unknown questions to clipboard if AI cannot solve or times out">
                                <input id="chk-ai-auto-copy-on-fail" type="checkbox" ${aiAutoCopyOnFail ? 'checked' : ''} style="cursor: pointer; margin-top: 2px;" />
                                <div>
                                    <span>Auto-Copy on AI Failure</span>
                                    <div style="font-size: 9px; color: var(--text-muted); font-weight: normal; margin-top: 1px;">Copies question to clipboard if AI fails or times out (Default: ON)</div>
                                </div>
                            </label>
                            <label style="display: flex; align-items: flex-start; gap: 6px; font-size: 10.5px; color: #e9d5ff; cursor: pointer; font-weight: 600;" title="When enabled, automatically moves to the next page 1.5s after AI selects a choice">
                                <input id="chk-ai-auto-next-on-ai" type="checkbox" ${aiAutoNextOnAiAnswer ? 'checked' : ''} style="cursor: pointer; margin-top: 2px;" />
                                <div>
                                    <span>Auto-Advance After AI Answer</span>
                                    <div style="font-size: 9px; color: var(--text-muted); font-weight: normal; margin-top: 1px;">Automatically moves to next page 1.5s after AI selects a choice (Default: ON)</div>
                                </div>
                            </label>
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 0;">
                                <span style="font-size: 10px; color: #e9d5ff; font-weight: 600;">Retry Attempts on Failure:</span>
                                <select id="sel-ai-retry-count" style="background: rgba(0,0,0,0.35); border: 1px solid #a855f7; border-radius: 4px; color: #f3e8ff; font-size: 10px; padding: 2px 6px; cursor: pointer;">
                                    <option value="1" ${aiRetryCount === 1 ? 'selected' : ''}>1 retry</option>
                                    <option value="2" ${aiRetryCount === 2 ? 'selected' : ''}>2 retries (Default)</option>
                                    <option value="3" ${aiRetryCount === 3 ? 'selected' : ''}>3 retries</option>
                                    <option value="4" ${aiRetryCount === 4 ? 'selected' : ''}>4 retries</option>
                                    <option value="5" ${aiRetryCount === 5 ? 'selected' : ''}>5 retries</option>
                                </select>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between; padding: 2px 0;">
                                <span style="font-size: 10px; color: #e9d5ff; font-weight: 600;">API Plan Tier:</span>
                                <select id="sel-ai-plan-tier" style="background: rgba(0,0,0,0.35); border: 1px solid #a855f7; border-radius: 4px; color: #f3e8ff; font-size: 10px; padding: 2px 6px; cursor: pointer;">
                                    <option value="free" ${getAiPlanTier() === 'free' ? 'selected' : ''}>Free plan</option>
                                    <option value="paid" ${getAiPlanTier() === 'paid' ? 'selected' : ''}>Paid plan</option>
                                </select>
                            </div>
                        </div>
                    </details>

                    <!-- Collapsible Advanced Settings (Collapsed by default for clean UX) -->
                    <details id="amaes-advanced-quiz-settings" style="margin-top: 2px; border: 1px solid var(--border-subtle); border-radius: 6px; background: rgba(0,0,0,0.12); overflow: hidden;">
                        <summary style="cursor: pointer; padding: 5px 8px; font-size: 10px; font-weight: 700; color: var(--text-secondary); display: flex; align-items: center; justify-content: space-between; user-select: none;">
                            <span style="display: flex; align-items: center; gap: 5px;">
                                ${ICONS.tools} <span>Advanced Settings</span>
                            </span>
                            <span class="amaes-adv-toggle-hint" style="font-size: 8.5px; color: var(--text-muted);">Click to expand</span>
                        </summary>
                        <div style="display: flex; flex-direction: column; gap: 6px; padding: 6px 8px; border-top: 1px solid var(--border-subtle); background: rgba(0,0,0,0.18);">
                            <!-- Section: Quiz Navigation & Behavior -->
                            <div style="font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; padding-bottom: 2px; border-bottom: 1px solid rgba(255,255,255,0.06);">Navigation & Interface</div>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: #a78bfa; cursor: pointer; font-weight: 600;" title="Keyboard shortcuts: Space / N for Next page, C for Copy AI, V for Paste AI, P for Pause/Start, 1-4 / A-D to pick choices, H to Highlight">
                                <input id="chk-keyboard-shortcuts" type="checkbox" ${enableKeyboardShortcuts ? 'checked' : ''} style="cursor: pointer;" />
                                <span>Keyboard Shortcuts (N, C, V, P, H, 1-4)</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Audio feedback: Plays a bright chime ding when the quiz is finished and a subtle alert chime when manual intervention is needed on an unknown question">
                                <input id="chk-audio-alerts" type="checkbox" ${enableAudioAlerts ? 'checked' : ''} style="cursor: pointer;" />
                                <span>Audio Notifications (Quest Finish Ding & Intervention Alert)</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Auto-minimize toolkit panel to floating smart pill during quiz attempts">
                                <input id="chk-auto-min-quiz" type="checkbox" ${autoMinimizeQuiz ? 'checked' : ''} style="cursor: pointer;" />
                                <span>Auto-minimize panel during quiz attempts</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--accent-blue); cursor: pointer;" title="Smart Navigation: Bypass questions already answered and jump straight to unanswered questions">
                                <input id="chk-smart-skip" type="checkbox" ${smartSkipQuiz ? 'checked' : ''} style="cursor: pointer;" />
                                <span>Smart Skip: Jump directly to unanswered questions</span>
                            </label>
                            <label style="display: flex; align-items: flex-start; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="When enabled, advances automatically after manual typing or choice selection on unknown questions (Default: OFF for safe review)">
                                <input id="chk-auto-next" type="checkbox" ${autoNextQuiz ? 'checked' : ''} style="cursor: pointer; margin-top: 2px;" />
                                <div>
                                    <span>Auto-advance on manual choice / AI paste (Default: OFF)</span>
                                    <div style="font-size: 8.5px; color: var(--text-muted);">Advance immediately after manual click or V shortcut</div>
                                </div>
                            </label>

                            <!-- Section: AI Prompt Formatter -->
                            <div style="font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; padding-top: 4px; padding-bottom: 2px; border-bottom: 1px solid rgba(255,255,255,0.06);">AI Prompt Formatting</div>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Inject convenient 'Copy Question' and 'Copy Image' buttons directly above question cards">
                                <input id="chk-show-in-q-btns" type="checkbox" ${showInQuestionAiBtns ? 'checked' : ''} style="cursor: pointer;" />
                                <span>Show 'Copy Question' buttons inside questions</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Appends strict directive 'Answer ONLY with option letter and exact text' to AI prompt">
                                <input id="chk-ai-prompt-hint" type="checkbox" ${aiPromptHint ? 'checked' : ''} style="cursor: pointer;" />
                                <span>Strict AI prompt format (a, b, c, d only)</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Include saved answer suggestion and confidence in copied prompt">
                                <input id="chk-copy-confidence" type="checkbox" ${copyIncludeConfidence ? 'checked' : ''} style="cursor: pointer;" />
                                <span>Include saved answer hint in copied prompt</span>
                            </label>
                        </div>
                    </details>
                </div>

                <!-- TAB PANE 2: Verified Answer Database -->
                <div id="tab-pane-db" class="amaes-tab-pane" style="display: none; padding: 8px; flex-direction: column; gap: 6px;">
                    <!-- Course Selector for Dashboard / Non-Course Pages -->
                    ${!courseInfo.subjectCode && detectedCodes.length > 0 ? `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px; background: var(--surface-subtle); padding: 5px 8px; border-radius: 6px; border: 1px solid var(--border-subtle); font-size: 11px;">
                            <span style="font-weight: 700; color: var(--text-secondary); display: flex; align-items: center; gap: 4px;">${ICONS.book} Current Subject:</span>
                            <select id="amaes-select-active-course" style="background: var(--surface); color: var(--text-primary); border: 1px solid var(--border); border-radius: 4px; padding: 2px 6px; font-weight: 700; font-size: 11px; cursor: pointer;">
                                ${detectedCodes.map(c => `<option value="${c}" ${c === subCode ? 'selected' : ''}>${c} (${(allLocalDbs[c] || []).length} Qs)</option>`).join('')}
                                <option value="_custom">+ Enter Custom Code...</option>
                            </select>
                        </div>
                    ` : ''}

                    <!-- Course-Wide Coverage Breakdown Card -->
                    <div id="amaes-term-coverage-card" style="background: rgba(0,0,0,0.2); padding: 7px 9px; border-radius: 6px; border: 1px solid var(--border-subtle); display: ${hasActiveCourse ? 'flex' : 'none'}; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; gap: 6px; padding-bottom: 3px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <div style="display: flex; align-items: center; gap: 5px; min-width: 0;">
                                <span style="display: inline-flex; color: var(--accent-blue);">${ICONS.database}</span>
                                <span style="font-size: 10px; font-weight: 700; color: var(--text-primary); white-space: nowrap;">Subject Questions</span>
                                <span id="amaes-coverage-badge" style="font-size: 9px; font-weight: 700; color: #60a5fa; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); padding: 1px 5px; border-radius: 4px; white-space: nowrap;">${subCode || ''}</span>
                                <span id="amaes-coverage-title" style="display: none;">Course Coverage (${subCode || 'General'}):</span>
                            </div>
                            <span id="amaes-term-summary" style="font-size: 9px; font-weight: 600; color: var(--accent-green); white-space: nowrap; text-align: right;">Loading...</span>
                        </div>
                        
                        <!-- Unified Source Breakdown: Verified Library, Study Guides, Eliminated Wrong -->
                        <div id="amaes-source-breakdown" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; font-size: 9.5px;">
                            <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(52, 211, 153, 0.35); border-radius: 4px; padding: 4px 2px; text-align: center;" title="Verified answers confirmed by quiz grading keys (includes your completed quizzes & community contributions)">
                                <div style="font-size: 8.5px; font-weight: 700; color: #34d399;">Verified Library</div>
                                <div id="amaes-stat-verified" style="font-size: 11px; font-weight: 800; color: #6ee7b7;">0</div>
                            </div>
                            <div style="background: rgba(168, 85, 247, 0.14); border: 1px solid rgba(192, 132, 252, 0.35); border-radius: 4px; padding: 4px 2px; text-align: center;" title="Online study guide answers found for this subject">
                                <div style="font-size: 8.5px; font-weight: 700; color: #d8b4fe;">Study Guides</div>
                                <div id="amaes-stat-amauoed" style="font-size: 11px; font-weight: 800; color: #f3e8ff;">0</div>
                            </div>
                            <div style="background: rgba(239, 68, 68, 0.14); border: 1px solid rgba(248, 113, 113, 0.35); border-radius: 4px; padding: 4px 2px; text-align: center;" title="Choices confirmed incorrect during reviews">
                                <div style="font-size: 8.5px; font-weight: 700; color: #fca5a5;">Eliminated Wrong</div>
                                <div id="amaes-stat-eliminated" style="font-size: 11px; font-weight: 800; color: #fee2e2;">0</div>
                            </div>
                        </div>

                        <!-- Term Pills -->
                        <div id="amaes-term-pills" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 2px;">
                            <!-- Populated dynamically by updateTermCoverageUI -->
                        </div>
                    </div>

                    <!-- Primary 1-Click Actions: Pull & Share -->
                    <div style="display: flex; gap: 6px;">
                        <button id="btn-cloud-sync" class="amaes-btn amaes-btn-blue" style="flex: 1; justify-content: center; padding: 7px; font-size: 11px; font-weight: 700;" title="Download verified answers from the shared community library">
                            ${ICONS.cloudDownload} <span>Download Answers</span>
                        </button>
                        <button id="btn-harvest-grades-db" class="amaes-btn amaes-btn-green" style="flex: 1; justify-content: center; padding: 7px; font-size: 11px; font-weight: 700;" title="Collect answers from completed quizzes and share them anonymously to help classmates">
                            ${ICONS.download} <span>Collect & Share Answers</span>
                        </button>
                    </div>


                    <!-- Online Study Guides (AMAUOED) -->
                    <details style="border: 1px solid var(--border-subtle); border-radius: 6px; padding: 5px 7px; background: rgba(0,0,0,0.15);">
                        <summary style="font-size: 10px; font-weight: 700; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: space-between; user-select: none;">
                            <span>Online Study Guides (AMAUOED)</span>
                            <span style="font-size: 9px; color: var(--text-muted);">Expand</span>
                        </summary>
                        <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Automatically check online study guides if questions are not yet in your library (Default: ON)">
                                <input id="chk-auto-scrape-amauoed" type="checkbox" ${autoScrapeAmauoed ? 'checked' : ''} style="cursor: pointer;" />
                                <span style="font-weight: 600; color: var(--accent-purple);">Auto-check study guides when missing</span>
                            </label>

                            <div style="display: flex; gap: 6px; align-items: center; background: var(--bg); border: 1px solid var(--border); border-radius: 5px; padding: 4px 6px;">
                                <a id="amauoed-link-display" href="${defaultAmauoedUrl || '#'}" target="_blank" rel="noopener noreferrer" style="
                                    flex: 1;
                                    min-width: 0;
                                    font-size: 10px;
                                    color: var(--accent-blue);
                                    text-decoration: underline;
                                    overflow: hidden;
                                    text-overflow: ellipsis;
                                    white-space: nowrap;
                                " title="${defaultAmauoedUrl || 'No link detected yet'}">${defaultAmauoedUrl || 'No study guide link detected'}</a>
                                <button id="btn-copy-amauoed-link" type="button" class="amaes-btn amaes-btn-outline" style="width: auto; padding: 3px 6px; font-size: 9.5px; font-weight: 600; white-space: nowrap; flex-shrink: 0; display: inline-flex; align-items: center; gap: 4px;" title="Copy study guide URL to clipboard" ${defaultAmauoedUrl ? '' : 'disabled'}>
                                    ${ICONS.copy} <span>Copy Link</span>
                                </button>
                            </div>
                            <div id="amauoed-url-match-badge" style="display: none; font-size: 10px; padding: 3px 5px; border-radius: 4px; line-height: 1.35; box-sizing: border-box;"></div>
                        </div>
                    </details>

                    <!-- Auto Settings for Sync & Sharing -->
                    <div style="display: flex; flex-direction: column; gap: 4px; background: var(--surface-subtle); padding: 6px 8px; border-radius: 6px; border: 1px solid var(--border-subtle);">
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Automatically scan and collect verified answers from completed quizzes on course or grade report load (Default: ON)">
                            <input id="chk-auto-harvest-grades" type="checkbox" ${autoHarvestGrades ? 'checked' : ''} style="cursor: pointer;" />
                            <span style="font-weight: 600; color: var(--accent-green);">Auto-collect confirmed answers from past quizzes</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Automatically download verified community answers when opening a course page">
                            <input id="chk-auto-cloud-sync" type="checkbox" ${autoCloudSync ? 'checked' : ''} style="cursor: pointer;" />
                            <span style="font-weight: 600; color: var(--text-primary);">Automatically download verified answers on course open</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Automatically & anonymously share verified correct answers to the community database on quiz review (Default: ON)">
                            <input id="chk-auto-community-share" type="checkbox" ${autoCommunityShare ? 'checked' : ''} style="cursor: pointer;" />
                            <span style="font-weight: 600; color: var(--accent-green);">Share verified review answers anonymously</span>
                        </label>
                    </div>
                </div>

                <!-- TAB PANE 3: Course Automation Tools -->
                <div id="tab-pane-course" class="amaes-tab-pane" style="display: none;">
                    <!-- MODULE 1: Auto-Marker & Undo -->
                <div id="mod-marker-card" class="amaes-card">
                    <div id="mod-marker-header" class="amaes-card-header">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${ICONS.check}
                            <span class="header-label">Activity Auto-Marker</span>
                        </div>
                        <span id="mod-marker-arrow" class="arrow-container">${ICONS.chevronRight}</span>
                    </div>

                    <div id="mod-marker-body" style="display: none; padding: 8px; flex-direction: column; gap: 6px;">
                        <div class="amaes-subcard">
                            <div id="sub-done-header" class="amaes-subcard-header">
                                <span class="sub-label" style="color: var(--accent-green);">${ICONS.check} Mark as Done</span>
                                <span id="sub-done-arrow" class="arrow-container">${ICONS.chevronRight}</span>
                            </div>
                            <div id="sub-done-body" style="display: none; padding: 6px; flex-direction: column; gap: 5px;">
                                <button id="btn-mark-lec" class="amaes-btn amaes-btn-blue">
                                    ${ICONS.book} <span>Mark Lectures & Vids</span>
                                </button>
                                <button id="btn-mark-quiz" class="amaes-btn amaes-btn-pink" title="Mark quizzes & exams with a passable grade (≥80%) as done (skips unattempted or failed quizzes)">
                                    ${ICONS.edit} <span>Mark Quizzes / Exams Only</span>
                                </button>
                                <button id="btn-mark-all" class="amaes-btn amaes-btn-gray" title="Mark all activities as done (quizzes must meet the passing grade threshold ≥80%)">
                                    ${ICONS.zap} <span>Mark ALL as Done</span>
                                </button>
                            </div>
                        </div>

                        <div class="amaes-subcard">
                            <div id="sub-undo-header" class="amaes-subcard-header">
                                <span class="sub-label" style="color: var(--accent-amber);">${ICONS.undo} Undo / Reset</span>
                                <span id="sub-undo-arrow" class="arrow-container">${ICONS.chevronRight}</span>
                            </div>
                            <div id="sub-undo-body" style="display: none; padding: 6px; flex-direction: column; gap: 5px;">
                                <button id="btn-undo-lec" class="amaes-btn amaes-btn-outline amaes-text-blue">
                                    ${ICONS.book} <span>Undo Lectures & Vids</span>
                                </button>
                                <button id="btn-undo-quiz" class="amaes-btn amaes-btn-outline amaes-text-pink">
                                    ${ICONS.edit} <span>Undo Quizzes / Exams</span>
                                </button>
                                <button id="btn-undo-all" class="amaes-btn amaes-btn-outline">
                                    ${ICONS.zap} <span>Undo ALL</span>
                                </button>
                            </div>
                        </div>

                    </div>
                </div>
                    <!-- MODULE 2: Activity Highlighter (Quiz / Lec / Vid) -->
                <div id="mod-highlighter-card" class="amaes-card">
                    <div id="mod-highlighter-header" class="amaes-card-header">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${ICONS.preview}
                            <span class="header-label">Activity Highlighter</span>
                        </div>
                        <span id="mod-highlighter-arrow" class="arrow-container">${ICONS.chevronRight}</span>
                    </div>

                    <div id="mod-highlighter-body" style="display: none; padding: 8px; flex-direction: column; gap: 6px;">
                        <div style="display: flex; gap: 5px;">
                            <button id="btn-hl-quiz" class="amaes-btn amaes-btn-outline amaes-text-pink" style="flex: 1; justify-content: center; padding: 5px 3px;" title="Highlight Quizzes & Exams">
                                ${ICONS.edit} <span>Quiz</span>
                            </button>
                            <button id="btn-hl-lec" class="amaes-btn amaes-btn-outline amaes-text-blue" style="flex: 1; justify-content: center; padding: 5px 3px;" title="Highlight Lectures & Lessons">
                                ${ICONS.book} <span>Lec</span>
                            </button>
                            <button id="btn-hl-vid" class="amaes-btn amaes-btn-outline amaes-text-purple" style="flex: 1; justify-content: center; padding: 5px 3px;" title="Highlight Video Lectures">
                                ${ICONS.video} <span>Vid</span>
                            </button>
                        </div>

                        <div style="display: flex; gap: 5px;">
                            <button id="btn-hl-all" class="amaes-btn amaes-btn-preview" style="flex: 2; justify-content: center; padding: 5px 6px;">
                                <span>Highlight All</span>
                            </button>
                            <button id="btn-hl-clear" class="amaes-btn amaes-btn-outline" style="flex: 1; justify-content: center; padding: 5px 6px;">
                                ${ICONS.clear} <span>Clear</span>
                            </button>
                        </div>

                        <button id="btn-hl-missing-quizzes" class="amaes-btn amaes-btn-outline amaes-text-pink" style="width: 100%; justify-content: center; padding: 5px 6px; font-size: 10.5px; font-weight: 700; margin-top: 2px;" title="Highlight unanswered, unattempted, or missing quizzes on Grades or Course page">
                            ${ICONS.alertTriangle || ICONS.preview} <span>Highlight Missing Quizzes</span>
                        </button>
                    </div>
                </div>
                    <!-- MODULE 3: Quick Search Helper -->
                <div id="mod-search-card" class="amaes-card">
                    <div id="mod-search-header" class="amaes-card-header">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            ${ICONS.search}
                            <span class="header-label">Search Helper</span>
                        </div>
                        <span id="mod-search-arrow" class="arrow-container">${ICONS.chevronRight}</span>
                    </div>

                    <div id="mod-search-body" style="display: none; padding: 8px; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 4px 6px; background: var(--bg); border-radius: 5px; border: 1px solid var(--border);">
                            <span style="color: var(--text-muted);">Subject Code:</span>
                            <span id="detected-code-badge" style="font-weight: 700; color: var(--accent-blue); background: var(--surface); padding: 1px 6px; border-radius: 4px; border: 1px solid var(--border);">
                                ${courseInfo.subjectCode || "None"}
                            </span>
                        </div>

                        <div style="display: flex; flex-direction: column; gap: 3px;">
                            <input id="search-keyword-input" type="text" value="${initialKeyword}" placeholder="Search query" style="
                                width: 100%;
                                background: var(--bg);
                                color: var(--text-primary);
                                border: 1px solid var(--border);
                                padding: 5px 8px;
                                border-radius: 5px;
                                font-size: 11px;
                                box-sizing: border-box;
                                outline: none;
                            " />
                        </div>

                        <div style="display: flex; gap: 6px;">
                            <button id="btn-copy-keyword" class="amaes-btn amaes-btn-outline" style="flex: 1; justify-content: center;">
                                ${ICONS.copy} <span>Copy</span>
                            </button>
                            <button id="btn-open-google" class="amaes-btn amaes-btn-blue" style="flex: 1; justify-content: center;">
                                ${ICONS.external} <span>Google</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- MODULE 4: Smart AI Assistant (Google Gemini) -->
                <div id="mod-ai-card" class="amaes-card">
                    <div id="mod-ai-header" class="amaes-card-header">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <span style="font-weight: 700; color: #a855f7;">AI</span>
                            <span class="header-label">Smart AI Assistant</span>
                            <span style="font-size: 8.5px; font-weight: 800; background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); padding: 1px 5px; border-radius: 4px;">EXPERIMENTAL</span>
                        </div>
                        <span id="mod-ai-arrow" class="arrow-container">${ICONS.chevronRight}</span>
                    </div>

                    <div id="mod-ai-body" style="display: none; padding: 8px; flex-direction: column; gap: 6px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; padding: 4px 6px; background: var(--bg); border-radius: 5px; border: 1px solid var(--border);">
                            <span style="color: var(--text-muted);">Status:</span>
                            <span id="gemini-status-badge" style="font-weight: 700; font-size: 10px; color: ${geminiApiKey ? 'var(--accent-green)' : 'var(--text-muted)'}; background: var(--surface); padding: 2px 7px; border-radius: 4px; border: 1px solid var(--border);">
                                ${geminiApiKey ? 'Ready (Gemini 2.5 / 2.0 Flash)' : 'Not configured'}
                            </span>
                        </div>

                        <p style="font-size: 10px; color: var(--text-secondary); line-height: 1.4; margin: 0;">
                            Answers unknown multiple-choice & true/false questions automatically using your free Google AI Studio key. 0 tokens used on questions already in DB.
                        </p>

                        <div style="display: flex; flex-direction: column; gap: 5px; border-top: 1px solid var(--border-subtle); padding-top: 5px;">
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Automatically copy question to clipboard if AI inference fails or times out">
                                <input id="chk-course-ai-auto-copy-on-fail" type="checkbox" ${aiAutoCopyOnFail ? 'checked' : ''} style="cursor: pointer;" />
                                <span>Auto-Copy Question on AI Failure (Default: ON)</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 10px; color: var(--text-secondary); cursor: pointer;" title="Automatically moves to next page 1.5s after AI selects a choice">
                                <input id="chk-course-ai-auto-next-on-ai" type="checkbox" ${aiAutoNextOnAiAnswer ? 'checked' : ''} style="cursor: pointer;" />
                                <span>Auto-Advance After AI Answer (Default: ON)</span>
                            </label>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 10px; color: var(--text-secondary);">AI Retry Attempts:</span>
                                <select id="sel-course-ai-retry-count" style="background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary); font-size: 10px; padding: 2px 5px; cursor: pointer;">
                                    <option value="1" ${aiRetryCount === 1 ? 'selected' : ''}>1 retry</option>
                                    <option value="2" ${aiRetryCount === 2 ? 'selected' : ''}>2 retries (Default)</option>
                                    <option value="3" ${aiRetryCount === 3 ? 'selected' : ''}>3 retries</option>
                                    <option value="4" ${aiRetryCount === 4 ? 'selected' : ''}>4 retries</option>
                                    <option value="5" ${aiRetryCount === 5 ? 'selected' : ''}>5 retries</option>
                                </select>
                            </div>
                            <div style="display: flex; align-items: center; justify-content: space-between;">
                                <span style="font-size: 10px; color: var(--text-secondary);">AI Plan Tier:</span>
                                <select id="sel-course-ai-plan-tier" style="background: var(--bg); border: 1px solid var(--border); border-radius: 4px; color: var(--text-primary); font-size: 10px; padding: 2px 5px; cursor: pointer;">
                                    <option value="free" ${getAiPlanTier() === 'free' ? 'selected' : ''}>Free plan</option>
                                    <option value="paid" ${getAiPlanTier() === 'paid' ? 'selected' : ''}>Paid plan</option>
                                </select>
                            </div>
                        </div>

                        <div style="display: flex; gap: 6px; margin-top: 2px;">
                            <button id="btn-open-gemini-setup" type="button" class="amaes-btn" style="flex: 1; justify-content: center; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #fff; border: none; font-weight: 700; cursor: pointer;">
                                <span>${geminiApiKey ? 'Configure AI key' : 'Setup Free AI Assistant'}</span>
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Stop Button -->
                <button id="amaes-stop-btn" class="amaes-btn amaes-btn-stop" style="display: none; margin-bottom: 6px;">
                    ${ICONS.stop} <span>Stop Execution</span>
                </button>

                <!-- Live Monitor & Activity Logger (Doing / Plan / Done) -->
                <div id="amaes-monitor" class="amaes-monitor-card" style="
                    background: var(--surface-subtle);
                    border: 1px solid var(--border-subtle);
                    border-radius: 8px;
                    padding: 7px 9px;
                    margin-top: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    font-size: 11px;
                ">
                    <!-- Doing (Current Action) -->
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-width: 0;">
                        <div style="display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1; overflow: hidden;">
                            <span id="amaes-status-dot" style="width: 7px; height: 7px; border-radius: 50%; background: ${cachedQuestions ? '#10b981' : 'var(--text-muted)'}; flex-shrink: 0; box-shadow: 0 0 5px rgba(16,185,129,0.5);"></span>
                            <span id="amaes-status" style="font-weight: 600; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; flex: 1;" title="Current Status">
                                ${cachedQuestions ? `Ready. Cached ${cachedQuestions.length} verified Q&A.` : 'Ready. Select a tool above.'}
                            </span>
                        </div>
                        <button id="amaes-btn-toggle-logs" type="button" style="background: var(--surface, #1e293b); border: 1px solid var(--border, #334155); color: var(--text-secondary); font-size: 9.5px; cursor: pointer; display: flex; align-items: center; gap: 3px; padding: 2px 6px; border-radius: 4px; flex-shrink: 0; z-index: 2; box-shadow: 0 1px 3px rgba(0,0,0,0.25);" title="Toggle Activity History Log">
                            ${ICONS.clock} <span id="amaes-log-count-badge">Log</span>
                        </button>
                    </div>

                    <!-- Plan (Next Planned Step) -->
                    <div id="amaes-status-plan" style="font-size: 10px; display: flex; align-items: center; gap: 5px;">
                        <span style="font-weight: 700; color: var(--accent-blue, #3b82f6); opacity: 0.9;">Plan:</span>
                        <span id="amaes-plan-text" style="color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${isQuiz ? 'Ready to highlight or solve questions' : 'Browse courses or review answers'}
                        </span>
                    </div>

                    <!-- Done (Expandable Activity History Feed) -->
                    <div id="amaes-activity-feed" style="
                        display: none;
                        flex-direction: column;
                        gap: 3px;
                        max-height: 120px;
                        overflow-y: auto;
                        border-top: 1px solid var(--border-subtle);
                        padding-top: 5px;
                        margin-top: 2px;
                    ">
                        <div style="display: flex; align-items: center; justify-content: space-between; font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">
                            <span>Recent Activity ("Done"):</span>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                <button id="amaes-btn-copy-logs" type="button" style="background: none; border: none; color: var(--accent-blue, #3b82f6); text-decoration: underline; font-size: 9px; cursor: pointer; padding: 0;" title="Copy all logged activities to clipboard">Copy Log</button>
                                <button id="amaes-btn-clear-logs" type="button" style="background: none; border: none; color: var(--text-muted); text-decoration: underline; font-size: 9px; cursor: pointer; padding: 0;">Clear</button>
                            </div>
                        </div>
                        <div id="amaes-logs-list" style="display: flex; flex-direction: column; gap: 2px; font-family: -apple-system, BlinkMacSystemFont, monospace; font-size: 9.5px;">
                            <span style="color: var(--text-muted); font-style: italic;">No recorded events yet.</span>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Inject Dynamic CSS Stylesheet
        const styleSheet = document.createElement('style');
        styleSheet.id = 'amaes-toolkit-styles';
        document.head.appendChild(styleSheet);

        function applyTheme(themeKey) {
            const t = THEMES[themeKey] || THEMES.dark;
            currentTheme = themeKey;
            localStorage.setItem('amaes_toolkit_theme', themeKey);

            styleSheet.textContent = `
                :root {
                    --bg: ${t.bg};
                    --surface: ${t.surface};
                    --surface-subtle: ${t.surfaceSubtle};
                    --border: ${t.border};
                    --border-subtle: ${t.borderSubtle};
                    --text-primary: ${t.textPrimary};
                    --text-secondary: ${t.textSecondary};
                    --text-muted: ${t.textMuted};
                    --accent-blue: ${t.accentBlue};
                    --accent-blue-hover: ${t.accentBlueHover};
                    --accent-pink: ${t.accentPink};
                    --accent-pink-hover: ${t.accentPinkHover};
                    --accent-purple: ${t.accentPurple};
                    --accent-purple-hover: ${t.accentPurpleHover};
                    --accent-green: ${t.accentGreen};
                    --accent-green-hover: ${t.accentGreenHover};
                    --accent-amber: ${t.accentAmber};
                    --accent-gray: ${t.accentGray};
                    --shadow: ${t.shadow};
                    --status-bg: ${t.statusBg};
                }

                #amaes-toolkit-panel {
                    position: fixed;
                    top: auto;
                    bottom: 20px;
                    right: 20px;
                    z-index: 999999;
                    background: var(--bg);
                    color: var(--text-primary);
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
                    font-size: 12px;
                    padding: 12px;
                    border-radius: 12px;
                    box-shadow: var(--shadow);
                    border: 1px solid var(--border);
                    width: 350px;
                    max-height: calc(100vh - 40px);
                    box-sizing: border-box;
                    user-select: none;
                    transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                }

                
                #amaes-nav-tabs {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 3px;
                    background: rgba(0,0,0,0.25);
                    padding: 3px;
                    border-radius: 8px;
                    margin-bottom: 6px;
                    border: 1px solid var(--border-subtle);
                    flex-shrink: 0;
                }

                .amaes-tab-btn {
                    align-items: center;
                    display: inline-flex;
                    gap: 4px;
                    justify-content: center;
                    min-width: 0;
                    padding: 5px 2px;
                    font-size: 10.5px;
                    font-weight: 700;
                    border: 1px solid transparent;
                    border-radius: 6px;
                    background: transparent;
                    color: var(--text-secondary);
                    cursor: pointer;
                    transition: all 0.15s ease;
                    text-align: center;
                    white-space: nowrap;
                    user-select: none;
                    width: 100%;
                }

                .amaes-tab-btn span {
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .amaes-tab-btn:hover {
                    color: var(--text-primary);
                    background: rgba(255,255,255,0.05);
                }

                .amaes-tab-btn.active {
                    background: var(--surface);
                    color: var(--text-primary);
                    border-color: var(--border);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.25);
                }

                .amaes-tab-pane {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                }

                #amaes-panel-body {
                    overflow-y: auto !important;
                    overflow-x: hidden !important;
                    flex: 1 1 auto;
                    min-height: 0;
                    padding-right: 4px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    margin-top: 6px;
                }

                #amaes-panel-body::-webkit-scrollbar {
                    width: 5px;
                }
                #amaes-panel-body::-webkit-scrollbar-track {
                    background: transparent;
                }
                #amaes-panel-body::-webkit-scrollbar-thumb {
                    background: var(--border);
                    border-radius: 4px;
                }
                #amaes-panel-body::-webkit-scrollbar-thumb:hover {
                    background: var(--text-muted);
                }

                #amaes-status {
                    flex: 1 1 0%;
                    min-width: 0;
                    max-width: 100%;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                    display: block;
                }
                #amaes-btn-toggle-logs {
                    flex-shrink: 0;
                    margin-left: auto;
                    z-index: 2;
                }

                @keyframes amaes-dot-pulse {
                    0% { transform: scale(1); filter: brightness(1); }
                    50% { transform: scale(1.5); filter: brightness(1.35); }
                    100% { transform: scale(1); filter: brightness(1); }
                }
                .amaes-pulse {
                    animation: amaes-dot-pulse 0.65s cubic-bezier(0.4, 0, 0.2, 1);
                }

                .amaes-inline-btn {
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 5px !important;
                    width: auto !important;
                    max-width: max-content !important;
                    flex-shrink: 0 !important;
                    padding: 4px 10px !important;
                    border-radius: 6px !important;
                    border: none !important;
                    font-size: 11px !important;
                    font-weight: 700 !important;
                    cursor: pointer !important;
                    white-space: nowrap !important;
                    box-sizing: border-box !important;
                    text-align: center !important;
                }

                .amaes-copy-ai-card-btn {
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 4px !important;
                    background: #eff6ff !important;
                    color: #1d4ed8 !important;
                    border: 1px solid #bfdbfe !important;
                    padding: 4px 4px !important;
                    border-radius: 6px !important;
                    font-size: 10px !important;
                    font-weight: 600 !important;
                    cursor: pointer !important;
                    transition: all 0.15s ease !important;
                    user-select: none !important;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
                    margin-top: 4px !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                    white-space: nowrap !important;
                    text-align: center !important;
                }

                .amaes-copy-ai-card-btn:hover {
                    background: #dbeafe !important;
                    border-color: #3b82f6 !important;
                    color: #1e40af !important;
                    box-shadow: 0 2px 4px rgba(37,99,235,0.12) !important;
                }

                .amaes-ask-ai-card-btn {
                    background: #faf5ff !important;
                    color: #7e22ce !important;
                    border: 1px solid #e9d5ff !important;
                }

                .amaes-ask-ai-card-btn:hover {
                    background: #f3e8ff !important;
                    border-color: #a855f7 !important;
                    color: #6b21a8 !important;
                    box-shadow: 0 2px 4px rgba(168,85,247,0.15) !important;
                }

                .amaes-copy-ai-card-btn svg {
                    width: 12px !important;
                    height: 12px !important;
                    flex-shrink: 0 !important;
                }

                .amaes-web-ai-container {
                    position: relative !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                    margin-top: 3px !important;
                }

                .amaes-web-ai-split-btn {
                    display: flex !important;
                    align-items: stretch !important;
                    width: 100% !important;
                    border-radius: 6px !important;
                    border: 1px solid #bbf7d0 !important;
                    background: #f0fdf4 !important;
                    box-sizing: border-box !important;
                    overflow: hidden !important;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.05) !important;
                    transition: all 0.15s ease !important;
                }

                .amaes-web-ai-split-btn:hover {
                    border-color: #86efac !important;
                    box-shadow: 0 2px 4px rgba(22, 101, 52, 0.12) !important;
                }

                .amaes-web-ai-main-action {
                    flex: 1 !important;
                    min-width: 0 !important;
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 3px !important;
                    background: transparent !important;
                    border: none !important;
                    color: #15803d !important;
                    font-size: 10px !important;
                    font-weight: 700 !important;
                    padding: 4px 4px !important;
                    cursor: pointer !important;
                    white-space: nowrap !important;
                    overflow: hidden !important;
                    text-overflow: ellipsis !important;
                    transition: background 0.15s ease !important;
                    min-height: 24px !important;
                    box-sizing: border-box !important;
                }

                .amaes-web-ai-main-action:hover {
                    background: #dcfce7 !important;
                    color: #166534 !important;
                }

                .amaes-web-ai-arrow-btn {
                    display: inline-flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    background: rgba(21, 128, 61, 0.08) !important;
                    border: none !important;
                    border-left: 1px solid #bbf7d0 !important;
                    color: #15803d !important;
                    font-size: 10px !important;
                    font-weight: 700 !important;
                    padding: 0 7px !important;
                    cursor: pointer !important;
                    transition: background 0.15s ease !important;
                    min-height: 24px !important;
                    box-sizing: border-box !important;
                }

                .amaes-web-ai-arrow-btn:hover {
                    background: #bbf7d0 !important;
                    color: #14532d !important;
                }

                .amaes-card-btn-container {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 4px !important;
                    margin-top: 6px !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                }

                .amaes-card-ai-actions {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 4px !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                }

                .amaes-copy-ai-card-btn {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 6px !important;
                    padding: 5px 9px !important;
                    border-radius: 6px !important;
                    font-size: 11px !important;
                    font-weight: 600 !important;
                    background: rgba(37, 99, 235, 0.08) !important;
                    color: #2563eb !important;
                    border: 1px solid rgba(37, 99, 235, 0.28) !important;
                    cursor: pointer !important;
                    transition: all 0.15s ease !important;
                    box-sizing: border-box !important;
                    line-height: 1.3 !important;
                    width: 100% !important;
                    user-select: none !important;
                    text-align: center !important;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.03) !important;
                }
                .amaes-copy-ai-card-btn:hover,
                .amaes-copy-ai-card-btn:active {
                    background: rgba(37, 99, 235, 0.16) !important;
                    border-color: #2563eb !important;
                    color: #1d4ed8 !important;
                    box-shadow: 0 2px 4px rgba(37, 99, 235, 0.12) !important;
                }

                .amaes-paste-ai-card-btn {
                    background: rgba(245, 158, 11, 0.08) !important;
                    color: #d97706 !important;
                    border-color: rgba(245, 158, 11, 0.28) !important;
                }
                .amaes-paste-ai-card-btn:hover,
                .amaes-paste-ai-card-btn:active {
                    background: rgba(245, 158, 11, 0.16) !important;
                    border-color: #d97706 !important;
                    color: #b45309 !important;
                    box-shadow: 0 2px 4px rgba(245, 158, 11, 0.12) !important;
                }

                /* Built-in AI Section (Left Sidebar) */
                .amaes-builtin-ai-section {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 3px !important;
                    margin-top: 5px !important;
                    padding-top: 5px !important;
                    border-top: 1px solid rgba(226, 232, 240, 0.9) !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                }

                .amaes-builtin-ai-header {
                    display: flex !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 4px !important;
                    font-size: 9px !important;
                    font-weight: 700 !important;
                    color: #8b5cf6 !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.5px !important;
                    user-select: none !important;
                }

                .amaes-ask-ai-card-btn {
                    background: rgba(139, 92, 246, 0.08) !important;
                    color: #7c3aed !important;
                    border: 1px solid rgba(139, 92, 246, 0.28) !important;
                }
                .amaes-ask-ai-card-btn:hover,
                .amaes-ask-ai-card-btn:active {
                    background: rgba(139, 92, 246, 0.16) !important;
                    border-color: #7c3aed !important;
                    color: #6d28d9 !important;
                    box-shadow: 0 2px 4px rgba(139, 92, 246, 0.12) !important;
                }

                /* Web AI Launcher Row (Right Side - Question Header) */
                .amaes-web-ai-row {
                    display: inline-flex !important;
                    flex-wrap: wrap !important;
                    gap: 6px !important;
                    align-items: center !important;
                    margin: 4px 0 10px 0 !important;
                    padding: 3px 6px !important;
                    background: rgba(241, 245, 249, 0.7) !important;
                    border: 1px solid rgba(226, 232, 240, 0.8) !important;
                    border-radius: 6px !important;
                    box-sizing: border-box !important;
                }

                .amaes-web-ai-label {
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 4px !important;
                    font-size: 9.5px !important;
                    font-weight: 700 !important;
                    color: #64748b !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.5px !important;
                    user-select: none !important;
                    padding: 0 2px !important;
                    margin-right: 2px !important;
                }

                .amaes-web-ai-item {
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 5px !important;
                    padding: 3px 8px !important;
                    border-radius: 5px !important;
                    font-size: 11px !important;
                    font-weight: 600 !important;
                    cursor: pointer !important;
                    transition: all 0.15s ease !important;
                    box-sizing: border-box !important;
                    user-select: none !important;
                    touch-action: manipulation !important;
                    line-height: 1.3 !important;
                    white-space: nowrap !important;
                    background: #ffffff !important;
                    border: 1px solid #cbd5e1 !important;
                    color: #334155 !important;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.03) !important;
                }

                .amaes-web-ai-item svg {
                    width: 12px !important;
                    height: 12px !important;
                    flex-shrink: 0 !important;
                }

                .amaes-web-ai-item.amaes-pill-chatgpt:hover,
                .amaes-web-ai-item.amaes-pill-chatgpt:active {
                    background: #f0fdf4 !important;
                    border-color: #10a37f !important;
                    color: #047857 !important;
                    box-shadow: 0 1px 4px rgba(16, 163, 127, 0.15) !important;
                }

                .amaes-web-ai-item.amaes-pill-gemini:hover,
                .amaes-web-ai-item.amaes-pill-gemini:active {
                    background: #faf5ff !important;
                    border-color: #8b5cf6 !important;
                    color: #7c3aed !important;
                    box-shadow: 0 1px 4px rgba(139, 92, 246, 0.15) !important;
                }

                .amaes-web-ai-item.amaes-pill-perplexity:hover,
                .amaes-web-ai-item.amaes-pill-perplexity:active {
                    background: #f0fdfa !important;
                    border-color: #06b6d4 !important;
                    color: #0891b2 !important;
                    box-shadow: 0 1px 4px rgba(6, 182, 212, 0.15) !important;
                }

                /* Active / Focused Question Card Highlight */
                .que.amaes-active-focus-que {
                    outline: 2.5px solid #2563eb !important;
                    outline-offset: 3px !important;
                    box-shadow: 0 4px 20px rgba(37, 99, 235, 0.18) !important;
                    border-radius: 8px !important;
                    transition: outline 0.15s ease, box-shadow 0.15s ease !important;
                }
                .que:not(.amaes-active-focus-que) {
                    transition: outline 0.15s ease, box-shadow 0.15s ease;
                }
                .que:not(.amaes-active-focus-que):hover {
                    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
                    cursor: pointer;
                }
                .amaes-active-focus-badge {
                    display: none !important;
                    align-items: center !important;
                    justify-content: center !important;
                    gap: 4px !important;
                    font-size: 9px !important;
                    font-weight: 700 !important;
                    background: #2563eb !important;
                    color: #ffffff !important;
                    padding: 3px 5px !important;
                    border-radius: 5px !important;
                    margin-bottom: 2px !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.5px !important;
                    box-shadow: 0 1px 3px rgba(37, 99, 235, 0.3) !important;
                    user-select: none !important;
                }
                .amaes-active-focus-badge svg {
                    width: 10px !important;
                    height: 10px !important;
                }
                .que.amaes-active-focus-que .amaes-active-focus-badge {
                    display: inline-flex !important;
                }

                /* Choice Row Highlight Styling */
                .amaes-highlighted-choice {
                    border-radius: 6px !important;
                    transition: all 0.2s ease !important;
                    box-sizing: border-box !important;
                }
                .amaes-highlighted-choice p {
                    display: inline !important;
                    margin: 0 !important;
                    padding: 0 !important;
                }
                .amaes-highlighted-choice label {
                    display: inline-flex !important;
                    align-items: center !important;
                    gap: 6px !important;
                    margin: 0 !important;
                    cursor: pointer !important;
                    background: transparent !important;
                    outline: none !important;
                    padding: 0 !important;
                }

                #amaes-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-bottom: 8px;
                    border-bottom: 1px solid var(--border-subtle);
                    gap: 8px;
                }

                #amaes-brand {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    min-width: 0;
                    flex-shrink: 1;
                }

                #amaes-logo-img {
                    height: 24px;
                    width: auto;
                    display: block;
                    flex-shrink: 0;
                    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.25));
                }

                #amaes-title-group {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    min-width: 0;
                }

                #amaes-title {
                    font-weight: 700;
                    font-size: 13px;
                    letter-spacing: -0.2px;
                    color: var(--text-primary);
                    white-space: nowrap;
                }

                #amaes-version-pill {
                    font-size: 9px;
                    font-weight: 600;
                    padding: 1px 4px;
                    border-radius: 4px;
                    background: var(--surface);
                    color: var(--text-muted);
                    border: 1px solid var(--border);
                    white-space: nowrap;
                }

                #amaes-actions {
                    display: flex;
                    align-items: center;
                    gap: 3px;
                    flex-shrink: 0;
                    min-width: max-content;
                }

                .amaes-icon-btn {
                    width: 26px;
                    height: 26px;
                    background: var(--surface);
                    color: var(--text-secondary);
                    text-decoration: none;
                    border-radius: 6px;
                    font-size: 11px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid var(--border);
                    cursor: pointer;
                    transition: all 0.15s ease;
                    box-sizing: border-box;
                    padding: 0;
                    flex-shrink: 0;
                }

                .amaes-icon-btn:hover {
                    color: var(--text-primary);
                    border-color: var(--text-muted);
                }

                .amaes-debug-btn {
                    color: var(--accent-amber);
                    border-color: rgba(245, 158, 11, 0.4);
                }

                .amaes-card {
                    border: 1px solid var(--border);
                    border-radius: 8px;
                    margin-top: 8px;
                    margin-bottom: 8px;
                    overflow: hidden;
                    background: var(--surface-subtle);
                }

                .amaes-card-header {
                    padding: 8px 10px;
                    background: var(--surface);
                    font-weight: 600;
                    color: var(--text-primary);
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .amaes-subcard {
                    border: 1px solid var(--border);
                    border-radius: 6px;
                    overflow: hidden;
                    background: var(--bg);
                }

                .amaes-subcard-header {
                    padding: 6px 8px;
                    background: var(--surface);
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .sub-label {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 11px;
                    white-space: nowrap;
                }

                .arrow-container {
                    display: inline-flex;
                    align-items: center;
                    color: var(--text-muted);
                    transition: transform 0.15s ease;
                    flex-shrink: 0;
                }

                .amaes-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    border: none;
                    border-radius: 6px;
                    padding: 6px 9px;
                    font-size: 11px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: filter 0.15s ease, background 0.15s ease, transform 0.1s ease;
                    text-align: left;
                    width: 100%;
                    box-sizing: border-box;
                }
                .amaes-btn:active {
                    transform: scale(0.97);
                    filter: brightness(0.92);
                }

                .amaes-btn-preview {
                    background: var(--surface);
                    color: var(--text-primary);
                    border: 1px solid var(--border);
                    font-weight: 600;
                    justify-content: center;
                }
                .amaes-btn-preview:hover {
                    border-color: var(--text-muted);
                }

                .amaes-btn-blue {
                    background: var(--accent-blue);
                    color: #ffffff;
                }
                .amaes-btn-blue:hover {
                    background: var(--accent-blue-hover);
                }

                .amaes-btn-green {
                    background: var(--accent-green);
                    color: #ffffff;
                }
                .amaes-btn-green:hover {
                    background: var(--accent-green-hover);
                }

                .amaes-btn-pink {
                    background: var(--accent-pink);
                    color: #ffffff;
                }
                .amaes-btn-pink:hover {
                    background: var(--accent-pink-hover);
                }

                .amaes-btn-gray {
                    background: var(--surface);
                    color: var(--text-secondary);
                    border: 1px solid var(--border);
                }
                .amaes-btn-gray:hover {
                    color: var(--text-primary);
                }

                .amaes-btn-outline {
                    background: var(--surface);
                    color: var(--text-secondary);
                    border: 1px solid var(--border);
                }
                .amaes-btn-outline:hover {
                    color: var(--text-primary);
                }

                .amaes-text-blue { color: var(--accent-blue) !important; }
                .amaes-text-pink { color: var(--accent-pink) !important; }
                .amaes-text-purple { color: var(--accent-purple) !important; }

                .amaes-btn-stop {
                    background: var(--accent-pink);
                    color: #ffffff;
                    font-weight: 600;
                    justify-content: center;
                }

                .amaes-status-box {
                    padding: 8px;
                    background: var(--status-bg);
                    border-radius: 6px;
                    font-size: 11px;
                    line-height: 1.4;
                    color: var(--text-secondary);
                    max-height: 80px;
                    overflow-y: auto;
                    border: 1px solid var(--border-subtle);
                }

                @keyframes amaes-spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @keyframes amaes-ai-progress {
                    0% { width: 10%; transform: translateX(0); }
                    50% { width: 60%; transform: translateX(50%); }
                    100% { width: 10%; transform: translateX(120%); }
                }

                .amaes-ai-spin {
                    animation: amaes-spin 1.2s linear infinite;
                    display: inline-block;
                }

                .amaes-ai-thinking-indicator {
                    box-sizing: border-box;
                    width: 100%;
                }

                .amaes-ai-progress-bar {
                    animation: amaes-ai-progress 2s ease-in-out infinite;
                }

                .amaes-ai-suggested-choice {
                    outline: 2px solid rgba(139, 92, 246, 0.85) !important;
                    background-color: rgba(139, 92, 246, 0.09) !important;
                    box-shadow: 0 0 0 1px rgba(139, 92, 246, 0.2) !important;
                    border-radius: 6px !important;
                }

                .amaes-ai-suggested-badge {
                    user-select: none;
                }

                .amaes-ai-question-tag {
                    user-select: none;
                }
            `;

            const themeBtn = document.getElementById('amaes-theme-btn');
            if (themeBtn) {
                themeBtn.innerHTML = currentTheme === 'dark' ? ICONS.sun : ICONS.moon;
            }
        }

        applyTheme(currentTheme);

        // UI References
        const statusEl = document.getElementById('amaes-status');
        const stopBtn = document.getElementById('amaes-stop-btn');
        const minBtn = document.getElementById('amaes-min-btn');
        const bodyEl = document.getElementById('amaes-panel-body');
        const debugBtn = document.getElementById('amaes-debug-btn');
        const themeBtn = document.getElementById('amaes-theme-btn');

// Global setLog used

        // Helper: Accordion with automatic state persistence in localStorage
        function setupPersistentAccordion(headerId, bodyId, arrowId, storageKey, defaultOpen = false) {
            const header = document.getElementById(headerId);
            const body = document.getElementById(bodyId);
            const arrow = document.getElementById(arrowId);
            if (!header || !body) return;

            const saved = localStorage.getItem(storageKey);
            const isOpen = saved !== null ? (saved === 'open') : defaultOpen;
            body.style.display = isOpen ? 'flex' : 'none';
            if (arrow) arrow.innerHTML = isOpen ? ICONS.chevronDown : ICONS.chevronRight;

            header.onclick = () => {
                const isCurrentlyHidden = body.style.display === 'none';
                body.style.display = isCurrentlyHidden ? 'flex' : 'none';
                if (arrow) arrow.innerHTML = isCurrentlyHidden ? ICONS.chevronDown : ICONS.chevronRight;
                localStorage.setItem(storageKey, isCurrentlyHidden ? 'open' : 'closed');
            };
        }

        
        // Tab Navigation Logic (Strict 3-Tab Grid: Quiz, DB, Course Tools)
        const tabBtns = document.querySelectorAll('.amaes-tab-btn');
        const tabPanes = {
            quiz: document.getElementById('tab-pane-quiz'),
            db: document.getElementById('tab-pane-db'),
            course: document.getElementById('tab-pane-course')
        };

        function switchTab(tabName) {
            tabBtns.forEach(btn => {
                if (btn.dataset.tab === tabName) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            });
            Object.keys(tabPanes).forEach(name => {
                if (tabPanes[name]) {
                    tabPanes[name].style.display = (name === tabName) ? 'flex' : 'none';
                }
            });
            localStorage.setItem('amaes_active_tab', tabName);
        }

        tabBtns.forEach(btn => {
            btn.onclick = () => switchTab(btn.dataset.tab);
        });

        // Initial Tab Selection: Auto-open to 'quiz'
        let initialTab = localStorage.getItem('amaes_active_tab') || 'quiz';
        switchTab(initialTab);

