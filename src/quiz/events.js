        // --- MODULE 1: Autonomous Quiz Controls ---
        const btnMasterAutoQuiz = document.getElementById('btn-master-auto-quiz');
        const btnCopyCurrQ = document.getElementById('btn-copy-curr-q');
        const btnCopyAllQ = document.getElementById('btn-copy-all-q');
        const chkAutoPick = document.getElementById('chk-auto-pick');
        const chkAutoNextVerified = document.getElementById('chk-auto-next-verified');
        const chkAutoNext = document.getElementById('chk-auto-next');
        const chkAiPromptHint = document.getElementById('chk-ai-prompt-hint');
        const chkAutoHlQuiz = document.getElementById('chk-auto-hl-quiz');
        const chkCopyConfidence = document.getElementById('chk-copy-confidence');

        if (btnMasterAutoQuiz) {
            btnMasterAutoQuiz.onclick = () => {
                if (!checkIsQuizAttemptPage() && !autoQuizMode) {
                    // Check if student is on the quiz view/start page (/mod/quiz/view.php)
                    const isQuizLanding = window.location.pathname.includes('/mod/quiz/view.php');
                    if (isQuizLanding) {
                        const startBtn = document.querySelector('form[action*="attempt.php"] button, form[action*="attempt.php"] input[type="submit"], .quizstartbutton button, .quizstartbutton input[type="submit"], #region-main button.btn-primary, #region-main input.btn-primary');
                        if (startBtn) {
                            showToast("Starting quiz attempt...", 2000);
                            setLog("Starting quiz attempt from introduction page...", "var(--accent-green)");
                            startBtn.click();
                            return;
                        }
                    }
                    showToast("Open any quiz attempt to start auto-quiz!", 3000);
                    setLog("Open any quiz attempt to start auto-quiz.", "var(--accent-blue)");
                    return;
                }
                toggleAutoQuizMode();
            };
        }

        if (chkAutoHlQuiz) {
            chkAutoHlQuiz.onchange = () => {
                autoHighlightQuiz = chkAutoHlQuiz.checked;
                localStorage.setItem('amaes_auto_highlight_quiz', autoHighlightQuiz);
                showToast(`Highlight Answers: ${autoHighlightQuiz ? 'Enabled' : 'Disabled'}`);
                setLog(`Highlight Answers: <b>${autoHighlightQuiz ? 'ON' : 'OFF'}</b>`, autoHighlightQuiz ? "var(--accent-green)" : "var(--accent-amber)", autoHighlightQuiz ? "Visual answer badges enabled on quizzes" : "Badges hidden");
                if (autoHighlightQuiz && checkIsQuizAttemptPage()) {
                    const cached = getCachedAnswers(subCode);
                    if (cached && cached.length > 0) {
                        highlightQuizAnswers(cached, false, true);
                    } else if (typeof autoFetchCloudAnswersIfMissing === 'function') {
                        autoFetchCloudAnswersIfMissing(subCode).then(ok => {
                            if (ok) highlightQuizAnswers(getCachedAnswers(subCode), false, true);
                        });
                    }
                }
            };
        }

        if (chkCopyConfidence) {
            chkCopyConfidence.onchange = () => {
                copyIncludeConfidence = chkCopyConfidence.checked;
                localStorage.setItem('amaes_copy_include_confidence', copyIncludeConfidence);
                showToast(`Include DB Hints: ${copyIncludeConfidence ? 'Enabled' : 'Disabled'}`);
                setLog(`Include DB Hints on Copy: <b>${copyIncludeConfidence ? 'ON' : 'OFF'}</b>`, "var(--accent-blue)", copyIncludeConfidence ? "Prompt will include verified answer hints & confidence" : "Question & choices only");
            };
        }

        const chkShowInQBtns = document.getElementById('chk-show-in-q-btns');
        if (chkShowInQBtns) {
            chkShowInQBtns.onchange = (e) => {
                showInQuestionAiBtns = e.target.checked;
                localStorage.setItem('amaes_show_in_question_ai_btns', showInQuestionAiBtns);
                injectQuestionCopyButtons();
                showToast(`In-question buttons: ${showInQuestionAiBtns ? 'Shown' : 'Hidden'}`);
                setLog(`In-Question Action Buttons: <b>${showInQuestionAiBtns ? 'ON' : 'OFF'}</b>`, "var(--accent-blue)", showInQuestionAiBtns ? "Injected beside each question box" : "Buttons hidden");
            };
        }

        if (chkAutoPick) {
            chkAutoPick.onchange = () => {
                autoPickQuiz = chkAutoPick.checked;
                localStorage.setItem('amaes_auto_pick_quiz', autoPickQuiz);
                showToast(`Auto-Pick: ${autoPickQuiz ? 'Enabled' : 'Disabled'}`);
                setLog(`Auto-Pick Answers: <b>${autoPickQuiz ? 'ON (Auto-select verified)' : 'OFF (Companion Mode)'}</b>`, autoPickQuiz ? "var(--accent-green)" : "var(--accent-amber)", autoPickQuiz ? "Will auto-select answers on quiz attempts" : "Highlights only; manual clicks required");
                if (autoPickQuiz && checkIsQuizAttemptPage()) runAutoQuizSolver();
            };
        }

        if (chkAutoNextVerified) {
            chkAutoNextVerified.onchange = () => {
                autoNextVerified = chkAutoNextVerified.checked;
                localStorage.setItem('amaes_auto_next_verified', autoNextVerified);
                showToast(`Auto-Next (Verified): ${autoNextVerified ? 'Enabled' : 'Disabled'}`);
                setLog(`Auto-Next on Verified Answers: <b>${autoNextVerified ? 'ON' : 'OFF'}</b>`, autoNextVerified ? "var(--accent-green)" : "var(--accent-amber)");
                if (autoNextVerified && checkIsQuizAttemptPage()) runAutoQuizSolver();
            };
        }

        if (chkAutoNext) {
            chkAutoNext.onchange = () => {
                autoNextQuiz = chkAutoNext.checked;
                localStorage.setItem('amaes_auto_next_quiz', autoNextQuiz);
                showToast(`Auto-Next (Manual): ${autoNextQuiz ? 'Enabled' : 'Disabled'}`);
                setLog(`Auto-Next Navigation: <b>${autoNextQuiz ? 'ON (Auto-advancing)' : 'OFF (Safe Manual Review)'}</b>`, autoNextQuiz ? "var(--accent-green)" : "var(--accent-amber)", autoNextQuiz ? "Advances automatically on manual choice selection" : "Stay on question until manual Next / N press");
                if (autoNextQuiz && checkIsQuizAttemptPage()) runAutoQuizSolver();
            };
        }

        const chkSmartSkip = document.getElementById('chk-smart-skip');
        if (chkSmartSkip) {
            chkSmartSkip.onchange = () => {
                smartSkipQuiz = chkSmartSkip.checked;
                localStorage.setItem('amaes_smart_skip_quiz', smartSkipQuiz);
                showToast(`Smart Skip: ${smartSkipQuiz ? 'Enabled' : 'Disabled'}`);
                setLog(`Smart Skip Unverified: <b>${smartSkipQuiz ? 'ON (Pause on unverified)' : 'OFF'}</b>`, smartSkipQuiz ? "var(--accent-green)" : "var(--accent-amber)", smartSkipQuiz ? "Pauses auto-next on unverified questions" : "Attempts all matching questions");
            };
        }

        const chkAutoMinQuiz = document.getElementById('chk-auto-min-quiz');
        if (chkAutoMinQuiz) {
            chkAutoMinQuiz.onchange = () => {
                autoMinimizeQuiz = chkAutoMinQuiz.checked;
                localStorage.setItem('amaes_auto_min_quiz', autoMinimizeQuiz);
                showToast(`Auto-minimize during quizzes: ${autoMinimizeQuiz ? 'Enabled' : 'Disabled'}`);
                setLog(`Auto-Minimize During Quizzes: <b>${autoMinimizeQuiz ? 'ON' : 'OFF'}</b>`, autoMinimizeQuiz ? "var(--accent-cyan)" : "var(--accent-amber)", autoMinimizeQuiz ? "Minimizes panel upon entering quiz" : "Panel remains open");
            };
        }

        const chkKeyboardShortcuts = document.getElementById('chk-keyboard-shortcuts');
        if (chkKeyboardShortcuts) {
            chkKeyboardShortcuts.onchange = () => {
                enableKeyboardShortcuts = chkKeyboardShortcuts.checked;
                localStorage.setItem('amaes_enable_hotkeys', enableKeyboardShortcuts);
                showToast(`Keyboard Navigation: ${enableKeyboardShortcuts ? 'Enabled' : 'Disabled'}`);
                setLog(`Keyboard Navigation: <b>${enableKeyboardShortcuts ? 'ON' : 'OFF'}</b>`, enableKeyboardShortcuts ? "var(--accent-blue)" : "var(--accent-amber)", enableKeyboardShortcuts ? "N, Space, 1-4, C, P, H active" : "Key navigation disabled");
            };
        }

        const chkAudioAlerts = document.getElementById('chk-audio-alerts');
        if (chkAudioAlerts) {
            chkAudioAlerts.onchange = () => {
                enableAudioAlerts = chkAudioAlerts.checked;
                localStorage.setItem('amaes_enable_audio_alerts', enableAudioAlerts ? 'true' : 'false');
                showToast(`Audio Notifications: ${enableAudioAlerts ? 'Enabled' : 'Disabled'}`);
                setLog(`Audio Notifications: <b>${enableAudioAlerts ? 'ON' : 'OFF'}</b>`, enableAudioAlerts ? "var(--accent-green)" : "var(--accent-amber)");
                if (enableAudioAlerts) {
                    playToolkitSound('quest_done');
                }
            };
        }

        if (chkAiPromptHint) {
            chkAiPromptHint.onchange = () => {
                aiPromptHint = chkAiPromptHint.checked;
                localStorage.setItem('amaes_ai_prompt_hint', aiPromptHint);
                showToast(`Strict AI Prompt: ${aiPromptHint ? 'Enabled' : 'Disabled'}`);
                setLog(`Strict AI Prompt Format: <b>${aiPromptHint ? 'ON (1-Shot Output)' : 'OFF (Standard)'}</b>`, "var(--accent-blue)", "Directs AI to respond with choice letter only");
            };
        }

        const chkAiQuizEnabled = document.getElementById('chk-ai-quiz-enabled');
        if (chkAiQuizEnabled) {
            chkAiQuizEnabled.onchange = () => {
                aiQuizEnabled = chkAiQuizEnabled.checked;
                localStorage.setItem('amaes_ai_quiz_enabled', aiQuizEnabled);
                showToast(`AI Quiz Solver: ${aiQuizEnabled ? 'Enabled' : 'Disabled'}`);
                setLog(`Gemini AI Quiz Solver: <b>${aiQuizEnabled ? 'ON' : 'OFF'}</b>`, aiQuizEnabled ? "var(--accent-purple)" : "var(--accent-amber)");
            };
        }

        const chkAiAutoSelect = document.getElementById('chk-ai-auto-select');
        if (chkAiAutoSelect) {
            chkAiAutoSelect.onchange = () => {
                aiAutoSelect = chkAiAutoSelect.checked;
                localStorage.setItem('amaes_ai_auto_select', aiAutoSelect);
                showToast(`AI Auto-Select: ${aiAutoSelect ? 'Auto-Select ON' : 'Highlight Only'}`);
                setLog(`AI Auto-Select Answers: <b>${aiAutoSelect ? 'ON (Auto-select AI answers)' : 'OFF (Highlight only)'}</b>`, aiAutoSelect ? "var(--accent-purple)" : "var(--accent-amber)");
            };
        }

        const selAiRetryCount = document.getElementById('sel-ai-retry-count');
        if (selAiRetryCount) {
            selAiRetryCount.onchange = () => {
                setAiRetryCount(selAiRetryCount.value);
                const courseSel = document.getElementById('sel-course-ai-retry-count');
                if (courseSel) courseSel.value = String(getAiRetryCount());
                showToast(`AI Retry Attempts set to ${getAiRetryCount()}`);
            };
        }

        const selCourseAiRetryCount = document.getElementById('sel-course-ai-retry-count');
        if (selCourseAiRetryCount) {
            selCourseAiRetryCount.onchange = () => {
                setAiRetryCount(selCourseAiRetryCount.value);
                const quizSel = document.getElementById('sel-ai-retry-count');
                if (quizSel) quizSel.value = String(getAiRetryCount());
                showToast(`AI Retry Attempts set to ${getAiRetryCount()}`);
            };
        }

        const selAiPlanTier = document.getElementById('sel-ai-plan-tier');
        if (selAiPlanTier) {
            selAiPlanTier.onchange = () => {
                setAiPlanTier(selAiPlanTier.value);
                const courseSel = document.getElementById('sel-course-ai-plan-tier');
                if (courseSel) courseSel.value = getAiPlanTier();
                showToast(`AI plan set to ${getAiPlanTier() === 'free' ? 'Free plan' : 'Paid plan'}`);
            };
        }

        const selCourseAiPlanTier = document.getElementById('sel-course-ai-plan-tier');
        if (selCourseAiPlanTier) {
            selCourseAiPlanTier.onchange = () => {
                setAiPlanTier(selCourseAiPlanTier.value);
                const quizSel = document.getElementById('sel-ai-plan-tier');
                if (quizSel) quizSel.value = getAiPlanTier();
                showToast(`AI plan set to ${getAiPlanTier() === 'free' ? 'Free plan' : 'Paid plan'}`);
            };
        }

        const chkAiAutoCopyOnFail = document.getElementById('chk-ai-auto-copy-on-fail');
        if (chkAiAutoCopyOnFail) {
            chkAiAutoCopyOnFail.onchange = () => {
                setAiAutoCopyOnFail(chkAiAutoCopyOnFail.checked);
                const courseChk = document.getElementById('chk-course-ai-auto-copy-on-fail');
                if (courseChk) courseChk.checked = getAiAutoCopyOnFail();
                showToast(`Auto-Copy on AI Failure: ${getAiAutoCopyOnFail() ? 'ON' : 'OFF'}`);
            };
        }

        const chkCourseAiAutoCopyOnFail = document.getElementById('chk-course-ai-auto-copy-on-fail');
        if (chkCourseAiAutoCopyOnFail) {
            chkCourseAiAutoCopyOnFail.onchange = () => {
                setAiAutoCopyOnFail(chkCourseAiAutoCopyOnFail.checked);
                const quizChk = document.getElementById('chk-ai-auto-copy-on-fail');
                if (quizChk) quizChk.checked = getAiAutoCopyOnFail();
                showToast(`Auto-Copy on AI Failure: ${getAiAutoCopyOnFail() ? 'ON' : 'OFF'}`);
            };
        }

        const chkAiAutoNextOnAi = document.getElementById('chk-ai-auto-next-on-ai');
        if (chkAiAutoNextOnAi) {
            chkAiAutoNextOnAi.onchange = () => {
                setAiAutoNextOnAiAnswer(chkAiAutoNextOnAi.checked);
                const courseChk = document.getElementById('chk-course-ai-auto-next-on-ai');
                if (courseChk) courseChk.checked = getAiAutoNextOnAiAnswer();
                showToast(`Auto-Advance After AI Answer: ${getAiAutoNextOnAiAnswer() ? 'ON' : 'OFF'}`);
            };
        }

        const chkCourseAiAutoNextOnAi = document.getElementById('chk-course-ai-auto-next-on-ai');
        if (chkCourseAiAutoNextOnAi) {
            chkCourseAiAutoNextOnAi.onchange = () => {
                setAiAutoNextOnAiAnswer(chkCourseAiAutoNextOnAi.checked);
                const quizChk = document.getElementById('chk-ai-auto-next-on-ai');
                if (quizChk) quizChk.checked = getAiAutoNextOnAiAnswer();
                showToast(`Auto-Advance After AI Answer: ${getAiAutoNextOnAiAnswer() ? 'ON' : 'OFF'}`);
            };
        }

        if (btnCopyCurrQ) {
            btnCopyCurrQ.onclick = async () => {
                const que = getActiveViewportQuestion();
                if (!que) {
                    showToast("No quiz questions found on this page! Enter a quiz attempt first.", 3500);
                    setLog("<b>No questions found</b> on this page. Open a quiz attempt first.", "var(--accent-pink)");
                    return;
                }
                const qData = extractQuestionData(que);
                const willIncludeContext = shouldInjectAiContext(qData ? qData.qNum : null);
                const text = formatQuestionForAI(que, aiPromptHint);
                try {
                    await copyToClipboard(text);
                    btnCopyCurrQ.innerHTML = `${ICONS.check} <span>Copied!</span>`;
                    const qLabel = qData && qData.qNum ? `Question #${qData.qNum}` : 'Question';
                    showToast(willIncludeContext ? `${qLabel} copied with Course AI Context!` : `${qLabel} & choices copied!`);
                    setLog(willIncludeContext ? `Copied <b>${qLabel}</b> with Course AI Context!` : `Copied <b>${qLabel}</b> & choices!`, "var(--accent-green)");
                    setTimeout(() => {
                        btnCopyCurrQ.innerHTML = `${ICONS.copy} <span>Copy Question (C)</span>`;
                    }, 1800);
                } catch (err) {
                    showToast("Failed to copy question to clipboard.");
                    setLog("Failed to copy to clipboard.", "var(--accent-pink)");
                }
            };
        }

        const btnPasteAiAns = document.getElementById('btn-paste-ai-ans');
        if (btnPasteAiAns) {
            btnPasteAiAns.onclick = () => {
                autoSelectFromAiClipboard();
            };
        }

        if (btnCopyAllQ) {
            btnCopyAllQ.onclick = async () => {
                const queList = document.querySelectorAll('.que');
                if (queList.length === 0) {
                    showToast("No quiz questions found on this page! Enter a quiz attempt first.", 3500);
                    setLog("<b>No questions found</b> on this page. Open a quiz attempt first.", "var(--accent-pink)");
                    return;
                }
                const text = formatAllQuestionsForAI(aiPromptHint);
                try {
                    await copyToClipboard(text);
                    btnCopyAllQ.innerHTML = `${ICONS.check} <span>Copied!</span>`;
                    showToast(`All ${queList.length} questions copied for AI!`);
                    setLog(`Copied all <b>${queList.length}</b> questions for AI!`, "var(--accent-green)");
                    setTimeout(() => {
                        btnCopyAllQ.innerHTML = `${ICONS.copy} <span>Copy All</span>`;
                    }, 1800);
                } catch (err) {
                    showToast("Failed to copy questions to clipboard.");
                    setLog("Failed to copy to clipboard.", "var(--accent-pink)");
                }
            };
        }

        // --- MODULE 1: Web Scraper Answers & Controls ---
        const btnCopyAmauoedLink = document.getElementById('btn-copy-amauoed-link');
        const urlMatchBadge = document.getElementById('amauoed-url-match-badge');
        const hlAnswersBtn = document.getElementById('btn-hl-answers');
        const selectAnswersBtn = document.getElementById('btn-select-answers');

        async function updateAmauoedDisplay(targetCode) {
            const code = targetCode || subCode;
            const linkDisplay = document.getElementById('amauoed-link-display');
            const copyBtn = document.getElementById('btn-copy-amauoed-link');
            if (!linkDisplay) return;

            let url = getStoredAmauoedUrl(code);
            if (url) {
                renderLink(url);
            } else if (code && code !== 'GENERAL' && code !== 'DEFAULT' && autoScrapeAmauoed) {
                linkDisplay.textContent = 'Auto-detecting link...';
                linkDisplay.removeAttribute('href');
                if (copyBtn) copyBtn.disabled = true;
                if (urlMatchBadge) urlMatchBadge.style.display = 'none';
                try {
                    url = await autoFindAmauoedLink(code, courseInfo.subjectName || courseInfo.currentActivityTitle || '');
                    if (url) {
                        renderLink(url);
                        const existing = getCachedAnswers(code);
                        if ((!existing || existing.length === 0) && autoScrapeAmauoed) {
                            setLog(`Auto-scraping AMAUOED answers for <b>${code}</b>...`, 'var(--accent-blue)');
                            const scraped = await loadAllAmauoedAnswers(url);
                            if (scraped && scraped.length > 0) {
                                mergeAnswersIntoCache(code, scraped, 'AMAUOED');
                                updateTermCoverageUI(code);
                                setLog(`Auto-scraped <b>${scraped.length}</b> answers from AMAUOED for <b>${code}</b>!`, 'var(--accent-green)');
                                if (checkIsQuizPage()) {
                                    highlightQuizAnswers(getCachedAnswers(code), false);
                                }
                            }
                        }
                    } else {
                        linkDisplay.textContent = 'No study guide link detected';
                        linkDisplay.removeAttribute('href');
                        if (copyBtn) copyBtn.disabled = true;
                        if (urlMatchBadge) urlMatchBadge.style.display = 'none';
                    }
                } catch (e) {
                    linkDisplay.textContent = 'No study guide link detected';
                    linkDisplay.removeAttribute('href');
                    if (copyBtn) copyBtn.disabled = true;
                    if (urlMatchBadge) urlMatchBadge.style.display = 'none';
                }
            } else {
                linkDisplay.textContent = 'No study guide link detected';
                linkDisplay.removeAttribute('href');
                if (copyBtn) copyBtn.disabled = true;
                if (urlMatchBadge) urlMatchBadge.style.display = 'none';
            }

            function renderLink(linkUrl) {
                linkDisplay.textContent = linkUrl;
                linkDisplay.href = linkUrl;
                linkDisplay.title = linkUrl;
                if (copyBtn) copyBtn.disabled = false;
                if (urlMatchBadge) {
                    const res = checkUrlCourseMatch(linkUrl, courseInfo);
                    urlMatchBadge.style.display = 'block';
                    urlMatchBadge.innerHTML = res.html;

                    if (res.status === 'match') {
                        urlMatchBadge.style.background = 'rgba(16, 185, 129, 0.12)';
                        urlMatchBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';
                        urlMatchBadge.style.color = 'var(--accent-green)';
                    } else if (res.status === 'mismatch' || res.status === 'invalid') {
                        urlMatchBadge.style.background = 'rgba(244, 63, 94, 0.12)';
                        urlMatchBadge.style.border = '1px solid rgba(244, 63, 94, 0.3)';
                        urlMatchBadge.style.color = 'var(--accent-pink)';

                        const fixBtn = document.getElementById('btn-fix-amauoed-url');
                        if (fixBtn) {
                            fixBtn.onclick = (e) => {
                                e.preventDefault();
                                const correctUrl = getStoredAmauoedUrl(subCode);
                                if (correctUrl) {
                                    setStoredAmauoedUrl(subCode, correctUrl);
                                    renderLink(correctUrl);
                                    setLog(`Switched to detected <b>${subCode}</b> URL!`, 'var(--accent-green)');
                                }
                            };
                        }
                    } else {
                        urlMatchBadge.style.background = 'var(--surface-subtle)';
                        urlMatchBadge.style.border = '1px solid var(--border-subtle)';
                        urlMatchBadge.style.color = 'var(--text-secondary)';
                    }
                }
            }
        }

        function updateTermCoverageUI(code) {
            const cardEl = document.getElementById('amaes-term-coverage-card');
            const targetCode = code !== undefined ? code : (courseInfo.subjectCode || '');
            if (!targetCode) {
                if (cardEl) cardEl.style.display = 'none';
                return;
            }
            if (cardEl) cardEl.style.display = 'flex';

            const summaryEl = document.getElementById('amaes-term-summary');
            const pillsEl = document.getElementById('amaes-term-pills');
            const titleEl = document.getElementById('amaes-coverage-title');
            const badgeEl = document.getElementById('amaes-coverage-badge');
            if (titleEl) titleEl.innerText = `Course Coverage (${targetCode}):`;
            if (badgeEl) badgeEl.innerText = targetCode;
            if (!pillsEl || !summaryEl) return;

            const questions = getCachedAnswers(targetCode) || [];
            const total = questions.length;

            let verifiedCount = 0;
            let communityCount = 0;
            let amauoedCount = 0;
            let eliminatedCount = 0;

            questions.forEach(q => {
                const s = (q.source || '').toLowerCase();
                const sources = Array.isArray(q.sources) ? q.sources.map(x => (x || '').toLowerCase()) : [];
                const isAmauoed = s.includes('amauoed') || sources.some(x => x.includes('amauoed'));

                if (isAmauoed) {
                    amauoedCount++;
                } else {
                    verifiedCount++;
                }

                if (Array.isArray(q.wrongAnswers)) {
                    eliminatedCount += q.wrongAnswers.length;
                }
            });

            const statVer = document.getElementById('amaes-stat-verified');
            const statComm = document.getElementById('amaes-stat-community');
            const statAmau = document.getElementById('amaes-stat-amauoed');
            const statElim = document.getElementById('amaes-stat-eliminated');
            if (statVer) statVer.innerText = String(verifiedCount);
            if (statComm) statComm.innerText = '0';
            if (statAmau) statAmau.innerText = String(amauoedCount);
            if (statElim) statElim.innerText = String(eliminatedCount);

            const stats = getSubjectTermBreakdown(targetCode);
            if (total === 0) {
                summaryEl.innerText = "No Qs Saved";
                summaryEl.style.color = "rgba(255, 255, 255, 0.45)";
            } else {
                const covered = [stats.prelim > 0, stats.midterm > 0, stats.prefi > 0, stats.final > 0].filter(Boolean).length;
                summaryEl.innerText = `${total} Qs Total • ${covered}/4 Terms Ready`;
                summaryEl.style.color = covered === 4 ? "#34d399" : covered > 0 ? "#60a5fa" : "rgba(255, 255, 255, 0.7)";
            }

            const terms = [
                { name: 'Prelim', count: stats.prelim },
                { name: 'Midterm', count: stats.midterm },
                { name: 'Prefi', count: stats.prefi },
                { name: 'Final', count: stats.final }
            ];

            pillsEl.innerHTML = terms.map(t => {
                if (t.count > 0) {
                    return `
                        <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid #10b981; border-radius: 4px; padding: 3px 2px; text-align: center;" title="${t.name}: ${t.count} verified questions available">
                            <div style="font-size: 8.5px; font-weight: 700; color: #10b981;">${t.name}</div>
                            <div style="font-size: 10px; font-weight: 800; color: #34d399;">${t.count} Qs</div>
                        </div>
                    `;
                } else {
                    return `
                        <div style="background: rgba(255, 255, 255, 0.04); border: 1px dashed rgba(255, 255, 255, 0.22); border-radius: 4px; padding: 3px 2px; text-align: center;" title="${t.name}: No questions stored yet">
                            <div style="font-size: 8.5px; font-weight: 600; color: rgba(255, 255, 255, 0.7);">${t.name}</div>
                            <div style="font-size: 9.5px; font-weight: 700; color: rgba(255, 255, 255, 0.45);">${t.count} Qs</div>
                        </div>
                    `;
                }
            }).join('');
        }

        updateAmauoedDisplay(courseInfo.subjectCode ? subCode : '');
        updateTermCoverageUI(courseInfo.subjectCode ? subCode : '');

        const selectActiveCourse = document.getElementById('amaes-select-active-course');
        if (selectActiveCourse) {
            selectActiveCourse.onchange = () => {
                let val = selectActiveCourse.value;
                if (val === '_custom') {
                    const custom = prompt("Enter Subject Code (e.g. CS6301, ITE6301):", "");
                    if (custom && custom.trim()) {
                        val = custom.trim().toUpperCase();
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = `${val} (0 Qs)`;
                        opt.selected = true;
                        selectActiveCourse.insertBefore(opt, selectActiveCourse.lastElementChild);
                    } else {
                        selectActiveCourse.value = subCode;
                        return;
                    }
                }
                subCode = val;
                updateAmauoedDisplay(subCode);
                updateTermCoverageUI(subCode);
                const curAnswers = getCachedAnswers(subCode);
                setLog(`Active subject switched to <b>${subCode}</b> (${(curAnswers || []).length} cached answers).`, "var(--accent-blue)");
            };
        }

        if (btnCopyAmauoedLink) {
            btnCopyAmauoedLink.onclick = async () => {
                const linkDisplay = document.getElementById('amauoed-link-display');
                const url = (linkDisplay && linkDisplay.getAttribute('href') && linkDisplay.getAttribute('href') !== '#')
                    ? linkDisplay.getAttribute('href')
                    : (getStoredAmauoedUrl(subCode) || '');
                if (!url) {
                    showToast("No study guide link to copy!");
                    return;
                }
                try {
                    await navigator.clipboard.writeText(url);
                    btnCopyAmauoedLink.innerHTML = `${ICONS.check} <span>Copied!</span>`;
                    showToast("Study guide link copied to clipboard!");
                    setLog(`Copied study guide link to clipboard: <b>${url}</b>`, "var(--accent-green)");
                    setTimeout(() => {
                        btnCopyAmauoedLink.innerHTML = `${ICONS.copy} <span>Copy Link</span>`;
                    }, 1800);
                } catch (err) {
                    showToast("Failed to copy link to clipboard.");
                }
            };
        }

        setupPersistentAccordion('mod-quiz-header', 'mod-quiz-body', 'mod-quiz-arrow', 'amaes_pref_mod_amauoed', true);

        if (chkAutoHlQuiz) chkAutoHlQuiz.onchange = () => {
            autoHighlightQuiz = chkAutoHlQuiz.checked;
            localStorage.setItem('amaes_auto_highlight_quiz', autoHighlightQuiz);
        };

        // Highlight Button
        if (hlAnswersBtn) hlAnswersBtn.onclick = () => {
            const cached = getCachedAnswers(subCode);
            if (!cached) {
                setLog("No answers cached yet for this subject!", "var(--accent-pink)");
                return;
            }
            const res = highlightQuizAnswers(cached, false);
            if (res.error) {
                setLog(res.error, "var(--accent-pink)");
            } else {
                setLog(`Matched & highlighted <b>${res.matched}/${res.total}</b> questions!`, "var(--accent-green)");
            }
        };

        // Auto-Select Button
        if (selectAnswersBtn) selectAnswersBtn.onclick = () => {
            const cached = getCachedAnswers(subCode);
            if (!cached) {
                setLog("No answers cached yet for this subject!", "var(--accent-pink)");
                return;
            }
            const res = highlightQuizAnswers(cached, true, true);
            if (res.error) {
                setLog(res.error, "var(--accent-pink)");
            } else {
                setLog(`Auto-selected <b>${res.matched}/${res.total}</b> answers!`, "var(--accent-green)");
            }
        };



        // Cloud Database Sync Handlers
        const btnCloudSync = document.getElementById('btn-cloud-sync');
        const btnConfigCloud = document.getElementById('btn-config-cloud');

        if (btnCloudSync) {
            btnCloudSync.onclick = async () => {
                btnCloudSync.disabled = true;
                btnCloudSync.classList.add('amaes-pulse');
                btnCloudSync.innerHTML = `${ICONS.cloud} <span>Connecting...</span>`;
                showToast("Connecting to Cloud Database...", 2000);
                setLog("Starting Cloud Sync...", "var(--accent-blue)", "Connecting to Community Cloud");

                let targetCode = subCode;
                const dashCourses = detectDashboardCourses();

                // Dashboard batch sync if no specific course is selected
                if ((!targetCode || targetCode === 'DEFAULT' || targetCode === 'GENERAL') && dashCourses.length > 0) {
                    btnCloudSync.innerHTML = `${ICONS.cloud} <span>Syncing ${dashCourses.length} Courses...</span>`;
                    showToast(`Syncing community & AMAUOED databases for ${dashCourses.length} courses...`, 3000);
                    setLog(`Syncing Cloud & AMAUOED databases for <b>${dashCourses.length} courses</b>...`, "var(--accent-blue)", "Connecting to Community Cloud and amauoed.com");

                    let totalSynced = 0;
                    let coursesProcessed = 0;

                    for (let i = 0; i < dashCourses.length; i++) {
                        const c = dashCourses[i];
                        btnCloudSync.innerHTML = `${ICONS.cloud} <span>[${i + 1}/${dashCourses.length}] ${c.code}...</span>`;
                        setLog(`[${i + 1}/${dashCourses.length}] Syncing <b>${c.code}</b> from Cloud Hub...`, "var(--accent-cyan)", `Checking database for ${c.code}`);

                        try {
                            let res = null;
                            try {
                                res = await syncAnswersFromCloud(c.code);
                            } catch (e) {
                                res = null;
                            }

                            if (res && res.count > 0) {
                                totalSynced += res.count;
                                coursesProcessed++;
                            } else {
                                const amauoedLink = await autoFindAmauoedLink(c.code);
                                if (amauoedLink) {
                                    setLog(`[${i + 1}/${dashCourses.length}] Scraping AMAUOED for <b>${c.code}</b>...`, "var(--accent-purple)", `Crawling questions from ${amauoedLink}`);
                                    const scraped = await loadAllAmauoedAnswers(amauoedLink);
                                    if (scraped && scraped.length > 0) {
                                        mergeAnswersIntoCache(c.code, scraped, 'AMAUOED');
                                        totalSynced += scraped.length;
                                        coursesProcessed++;
                                    }
                                }
                            }
                        } catch (err) {
                            logDebug(`Cloud sync error for ${c.code}: ${err.message}`);
                        }
                    }

                    showToast(`Cloud Sync Complete! Loaded ${totalSynced} answers across ${dashCourses.length} courses.`, 4000);
                    setLog(`Cloud Sync Complete! Loaded <b>${totalSynced}</b> answers across ${dashCourses.length} courses.`, "var(--accent-green)", "All courses indexed in local database");
                    btnCloudSync.classList.remove('amaes-pulse');
                    btnCloudSync.innerHTML = `${ICONS.check} <span>Synced ${totalSynced} Qs!</span>`;
                    injectDashboardCourseBadges();
                    setTimeout(() => {
                        btnCloudSync.disabled = false;
                        btnCloudSync.innerHTML = `${ICONS.cloudDownload} <span>Cloud Sync</span>`;
                    }, 3500);
                    return;
                }

                if (!targetCode || targetCode === 'DEFAULT' || targetCode === 'GENERAL') {
                    btnCloudSync.classList.remove('amaes-pulse');
                    btnCloudSync.disabled = false;
                    btnCloudSync.innerHTML = `${ICONS.cloudDownload} <span>Cloud Sync</span>`;
                    const entered = prompt("Enter Subject Code to sync from Cloud (e.g. CS6301, ITE6301):", (detectedCodes && detectedCodes[0]) || "");
                    if (!entered || !entered.trim()) {
                        setLog("Cloud sync cancelled (no subject code specified).", "var(--accent-amber)", "Select a subject code to sync");
                        showToast("Cloud sync cancelled.");
                        return;
                    }
                    targetCode = entered.trim().toUpperCase();
                    subCode = targetCode;
                    btnCloudSync.disabled = true;
                    btnCloudSync.classList.add('amaes-pulse');
                }

                btnCloudSync.innerHTML = `${ICONS.cloud} <span>Syncing ${targetCode}...</span>`;
                showToast(`Connecting to Cloud Database for ${targetCode}...`, 2500);
                setLog(`Connecting to community cloud database for <b>${targetCode}</b>...`, "var(--accent-blue)", `Checking GitHub repository for ${targetCode}`);

                try {
                    let res = null;
                    try {
                        res = await syncAnswersFromCloud(targetCode);
                    } catch (cloudErr) {
                        res = null;
                    }

                    if (res && res.count > 0) {
                        const finalDb = getCachedAnswers(targetCode) || [];
                        showToast(`Cloud Sync Success! (${res.count} community answers loaded)`);
                        setLog(`Synced <b>${res.count}</b> answers for <b>${targetCode}</b>! (Total: <b>${finalDb.length}</b>)`, "var(--accent-green)", "Verified database cached and active");
                        btnCloudSync.classList.remove('amaes-pulse');
                        btnCloudSync.innerHTML = `${ICONS.check} <span>Synced ${res.count} Qs!</span>`;

                        if (fetchBtnLabel) {
                            fetchBtnLabel.innerText = `Refresh Answers (${finalDb.length} cached)`;
                        }

                        updateTermCoverageUI(targetCode);

                        if (checkIsQuizPage()) {
                            highlightQuizAnswers(finalDb, false);
                        }
                    } else {
                        // Fallback to AMAUOED auto-discovery!
                        setLog(`Cloud repo has no answers for <b>${targetCode}</b> yet. Checking AMAUOED...`, "var(--accent-purple)", `Searching amauoed.com catalog for ${targetCode}`);
                        showToast(`No cloud answers found for ${targetCode}. Checking AMAUOED...`, 2500);
                        btnCloudSync.innerHTML = `${ICONS.rotateCcw} <span>Checking AMAUOED...</span>`;

                        const amauoedUrl = await autoFindAmauoedLink(targetCode);
                        if (amauoedUrl) {
                            btnCloudSync.innerHTML = `${ICONS.rotateCcw} <span>Scraping AMAUOED...</span>`;
                            setLog(`Auto-scraping AMAUOED study guide for <b>${targetCode}</b>...`, "var(--accent-blue)", `Crawling ${amauoedUrl}`);
                            const scraped = await loadAllAmauoedAnswers(amauoedUrl);
                            if (scraped && scraped.length > 0) {
                                mergeAnswersIntoCache(targetCode, scraped, 'AMAUOED');
                                const finalDb = getCachedAnswers(targetCode) || [];
                                showToast(`AMAUOED Fallback: Loaded ${scraped.length} questions for ${targetCode}!`, 4000);
                                setLog(`Scraped <b>${scraped.length}</b> questions from AMAUOED for <b>${targetCode}</b>!`, "var(--accent-green)", "Cached in local database");
                                btnCloudSync.classList.remove('amaes-pulse');
                                btnCloudSync.innerHTML = `${ICONS.check} <span>Scraped ${scraped.length} Qs!</span>`;
                                if (fetchBtnLabel) fetchBtnLabel.innerText = `Refresh Answers (${finalDb.length} cached)`;
                                updateTermCoverageUI(targetCode);
                                if (checkIsQuizPage()) highlightQuizAnswers(finalDb, false);
                            } else {
                                showToast(`No questions found on AMAUOED for ${targetCode}. Will harvest when you take quizzes!`, 4000);
                                setLog(`No questions found for <b>${targetCode}</b> on AMAUOED.`, "var(--accent-amber)", "Answers will auto-harvest as you complete quizzes");
                                btnCloudSync.classList.remove('amaes-pulse');
                                btnCloudSync.innerHTML = `<span>No Answers Yet</span>`;
                            }
                        } else {
                            showToast(`Course ${targetCode} is not in Cloud Hub yet. It will auto-harvest as you quiz!`, 4000);
                            setLog(`No answers found on Cloud or AMAUOED for <b>${targetCode}</b>.`, "var(--accent-amber)", "Answers will auto-harvest from quiz attempts and reviews");
                            btnCloudSync.classList.remove('amaes-pulse');
                            btnCloudSync.innerHTML = `<span>No Answers Yet</span>`;
                        }
                    }
                } catch (err) {
                    showToast(`Cloud Sync error: ${err.message}`);
                    setLog(`Cloud Sync Note: ${err.message}`, "var(--accent-amber)", "You can set custom database link via Config");
                } finally {
                    setTimeout(() => {
                        btnCloudSync.disabled = false;
                        btnCloudSync.classList.remove('amaes-pulse');
                        btnCloudSync.innerHTML = `${ICONS.cloudDownload} <span>Cloud Sync</span>`;
                    }, 3500);
                }
            };
        }

        const btnHarvestGradesDb = document.getElementById('btn-harvest-grades-db');
        if (btnHarvestGradesDb) {
            btnHarvestGradesDb.onclick = () => {
                btnHarvestGradesDb.disabled = true;
                btnHarvestGradesDb.classList.add('amaes-pulse');
                btnHarvestGradesDb.innerHTML = `${ICONS.clock} <span>Scanning Quizzes...</span>`;
                showToast("Scanning completed quizzes for verified answers...", 2500);
                setLog("Starting quiz answer collection & share...", "var(--accent-blue)", "Scanning completed attempts for verified answers");
                executeGradesHarvester((curr, total, name) => {
                    btnHarvestGradesDb.innerHTML = `${ICONS.clock} <span>[${curr}/${total}] ${name}...</span>`;
                }).then(res => {
                    btnHarvestGradesDb.classList.remove('amaes-pulse');
                    if (res && res.success && res.count > 0) {
                        btnHarvestGradesDb.innerHTML = `${ICONS.check} <span>Collected ${res.count} Qs!</span>`;
                    } else if (res && res.inProgress) {
                        btnHarvestGradesDb.innerHTML = `${ICONS.clock} <span>In Progress</span>`;
                        showToast("Auto-collector is currently scanning past quizzes in background. Please wait...", 3000);
                        setLog("Collector is <b>actively scanning</b> enrolled courses in background...", "var(--accent-blue)", "Scanning grade items for completed quizzes");
                    } else if (res && res.success && res.count === 0) {
                        btnHarvestGradesDb.innerHTML = `${ICONS.check} <span>All Up to Date</span>`;
                        showToast("Grade report scan complete. All completed quizzes are already in database!", 3500);
                        setLog("Grade report scan complete. All available quizzes already cached.", "var(--accent-cyan)", "Answers ready in database");
                    } else {
                        btnHarvestGradesDb.innerHTML = `<span>Finished</span>`;
                    }
                    setTimeout(() => {
                        btnHarvestGradesDb.disabled = false;
                        btnHarvestGradesDb.classList.remove('amaes-pulse');
                        btnHarvestGradesDb.innerHTML = `${ICONS.download} <span>Collect & Share Answers</span>`;
                    }, 4000);
                });
            };
        }

        if (btnConfigCloud) {
            btnConfigCloud.onclick = () => {
                const currentUrl = localStorage.getItem('amaes_cloud_db_url') || cloudDbBaseUrl;
                const currentToken = localStorage.getItem('amaes_github_token') || '';
                const choice = prompt(
                    `CLOUD DATABASE & GITHUB CONFIGURATION\n\n` +
                    `1. Base URL for Cloud Sync:\n${currentUrl}\n\n` +
                    `2. GitHub Token (PAT) for 1-Click Push:\n${currentToken ? '••••••••' + currentToken.slice(-4) : '(Not set - Web editor fallback)'}\n\n` +
                    `Commands:\n` +
                    `• 'token <YOUR_PAT>' -> Set GitHub Personal Access Token\n` +
                    `• 'url <NEW_URL>' -> Set raw database URL\n` +
                    `• 'clear' -> Remove GitHub Token\n\n` +
                    `Enter command or leave blank:`,
                    currentToken ? `token ${currentToken}` : `url ${currentUrl}`
                );

                if (choice) {
                    const trimmed = choice.trim();
                    if (trimmed.startsWith('token ')) {
                        const token = trimmed.replace(/^token\s+/, '').trim();
                        localStorage.setItem('amaes_github_token', token);
                        showToast("GitHub Token saved!");
                        setLog("GitHub Token configured for 1-click commits!", "var(--accent-green)");
                    } else if (trimmed.startsWith('url ')) {
                        const url = trimmed.replace(/^url\s+/, '').trim();
                        localStorage.setItem('amaes_cloud_db_url', url);
                        cloudDbBaseUrl = url;
                        showToast("Cloud DB URL updated!");
                        setLog(`Cloud Database URL updated to <b>${url}</b>`, "var(--accent-blue)");
                    } else if (trimmed === 'clear') {
                        localStorage.removeItem('amaes_github_token');
                        showToast("GitHub Token cleared!");
                        setLog("GitHub Token cleared.", "var(--text-muted)");
                    }
                }
            };
        }

        const btnContributeDb = document.getElementById('btn-contribute-db');
        if (btnContributeDb) {
            btnContributeDb.onclick = () => {
                showCommunityContributionModal(subCode);
            };
        }

        const syncSettingsCheckbox = (id, checked) => {
            const welcomeId = {
                'chk-auto-harvest-grades': 'welcome-chk-harvest',
                'chk-auto-cloud-sync': 'welcome-chk-sync',
                'chk-auto-community-share': 'welcome-chk-share',
                'chk-auto-scrape-amauoed': 'welcome-chk-scrape'
            }[id];
            const welcome = welcomeId && document.getElementById(welcomeId);
            if (welcome) welcome.checked = checked;
        };

        const chkAutoHarvestGrades = document.getElementById('chk-auto-harvest-grades');
        if (chkAutoHarvestGrades) {
            chkAutoHarvestGrades.onchange = (e) => {
                autoHarvestGrades = e.target.checked;
                localStorage.setItem('amaes_auto_harvest_grades', autoHarvestGrades);
                syncSettingsCheckbox('chk-auto-harvest-grades', autoHarvestGrades);
                showToast(`Auto-harvest past quizzes: ${autoHarvestGrades ? 'Enabled' : 'Disabled'}`);
                setLog(`Auto-Harvest past quizzes from Grades: <b>${autoHarvestGrades ? 'ON' : 'OFF'}</b>`, autoHarvestGrades ? "var(--accent-green)" : "var(--accent-amber)", autoHarvestGrades ? "Scans completed quizzes for verified teacher answers" : "Manual harvest only");
            };
        }

        const chkAutoCloudSync = document.getElementById('chk-auto-cloud-sync');
        if (chkAutoCloudSync) {
            chkAutoCloudSync.onchange = (e) => {
                autoCloudSync = e.target.checked;
                localStorage.setItem('amaes_auto_cloud_sync', autoCloudSync);
                syncSettingsCheckbox('chk-auto-cloud-sync', autoCloudSync);
                showToast(`Auto-pull community answers: ${autoCloudSync ? 'Enabled' : 'Disabled'}`);
                setLog(`Auto-pull community answers on course open: <b>${autoCloudSync ? 'ON' : 'OFF'}</b>`, autoCloudSync ? "var(--accent-green)" : "var(--accent-amber)", autoCloudSync ? "Auto-fetches answers upon opening any enrolled course" : "Manual sync only");
            };
        }

        const chkAutoCommunityShare = document.getElementById('chk-auto-community-share');
        if (chkAutoCommunityShare) {
            chkAutoCommunityShare.onchange = (e) => {
                autoCommunityShare = e.target.checked;
                localStorage.setItem('amaes_auto_community_share', autoCommunityShare);
                syncSettingsCheckbox('chk-auto-community-share', autoCommunityShare);
                showToast(`Auto-share to Community Hub: ${autoCommunityShare ? 'Enabled' : 'Disabled'}`);
                setLog(`Auto-share verified answers on Review: <b>${autoCommunityShare ? 'ON' : 'OFF'}</b>`, autoCommunityShare ? "var(--accent-green)" : "var(--accent-amber)", autoCommunityShare ? "Anonymously contributes new teacher keys on review" : "Sharing disabled");
                if (checkIsReviewPage()) {
                    document.querySelectorAll('.amaes-review-status-pill, .amaes-review-outcome-banner').forEach(el => el.remove());
                    injectReviewQuestionMarkers();
                }
            };
        }

        const chkAutoScrapeAmauoed = document.getElementById('chk-auto-scrape-amauoed');
        const chkAutoScrapeAmauoedQuiz = document.getElementById('chk-auto-scrape-amauoed-quiz');
        function handleAutoScrapeToggle(enabled) {
            autoScrapeAmauoed = enabled;
            localStorage.setItem('amaes_auto_scrape_amauoed', autoScrapeAmauoed);
            syncSettingsCheckbox('chk-auto-scrape-amauoed', autoScrapeAmauoed);
            if (chkAutoScrapeAmauoed) chkAutoScrapeAmauoed.checked = autoScrapeAmauoed;
            if (chkAutoScrapeAmauoedQuiz) chkAutoScrapeAmauoedQuiz.checked = autoScrapeAmauoed;
            showToast(`Auto-fetch AMAUOED: ${autoScrapeAmauoed ? 'Enabled' : 'Disabled'}`);
            setLog(`Auto-fetch AMAUOED when missing: <b>${autoScrapeAmauoed ? 'ON' : 'OFF'}</b>`, autoScrapeAmauoed ? "var(--accent-purple)" : "var(--accent-amber)", autoScrapeAmauoed ? "Discovers and crawls online study guides when missing" : "AMAUOED scraping disabled");
            if (enabled) {
                updateAmauoedDisplay(subCode);
            }
        }
        if (chkAutoScrapeAmauoed) {
            chkAutoScrapeAmauoed.onchange = (e) => handleAutoScrapeToggle(e.target.checked);
        }
        if (chkAutoScrapeAmauoedQuiz) {
            chkAutoScrapeAmauoedQuiz.onchange = (e) => handleAutoScrapeToggle(e.target.checked);
        }





        // If on quiz attempt page, the unified runAutoQuizSolver handles highlighting, auto-picking & auto-next.
        // Never highlight over graded review pages.
        if (autoHighlightQuiz && isQuiz && cachedQuestions && !checkIsQuizAttemptPage() && !checkIsReviewPage()) {
            setTimeout(() => {
                const res = highlightQuizAnswers(cachedQuestions, false);
                if (res.matched > 0) {
                    setLog(`Auto-highlighted <b>${res.matched}/${res.total}</b> answers from database.`, "var(--accent-green)");
                }
            }, 600);
        }

        // --- MODULE 2: Highlighter Module Elements ---
        setupPersistentAccordion('mod-highlighter-header', 'mod-highlighter-body', 'mod-highlighter-arrow', 'amaes_pref_mod_hl', false);

        const triggerHighlight = (cat, label) => {
            const res = highlightItems(cat);
            if (res.error) {
                showToast("Open a course page first to highlight items.");
                setLog("<b>Action Blocked:</b> Open a course subject first.", "var(--accent-pink)");
            } else if (res.count === 0) {
                showToast(`No ${label} items found to highlight on this page.`);
                setLog(`No ${label} items found on this page.`, "var(--accent-amber)");
            } else {
                showToast(`Highlighted ${res.count} ${label} items!`);
                setLog(`Highlighted <b>${res.count}</b> ${label} items on page.`, "var(--accent-green)");
            }
        };

        const _el__btn_hl_quiz_ = document.getElementById('btn-hl-quiz');
        if (_el__btn_hl_quiz_) _el__btn_hl_quiz_.onclick = () => triggerHighlight('quiz', 'Quiz/Exam');
        const _el__btn_hl_lec_ = document.getElementById('btn-hl-lec');
        if (_el__btn_hl_lec_) _el__btn_hl_lec_.onclick = () => triggerHighlight('lecture', 'Lecture');
        const _el__btn_hl_vid_ = document.getElementById('btn-hl-vid');
        if (_el__btn_hl_vid_) _el__btn_hl_vid_.onclick = () => triggerHighlight('video', 'Video');
        const _el__btn_hl_all_ = document.getElementById('btn-hl-all');
        if (_el__btn_hl_all_) _el__btn_hl_all_.onclick = () => triggerHighlight('all', 'total');
        const _el__btn_hl_clear_ = document.getElementById('btn-hl-clear');
        if (_el__btn_hl_clear_) _el__btn_hl_clear_.onclick = () => {
            clearAllHighlights();
            showToast("Cleared all highlights.");
            setLog("Cleared all highlights.", "var(--text-muted)");
        };

        const btnHlMissingQuizzes = document.getElementById('btn-hl-missing-quizzes');
        if (btnHlMissingQuizzes) {
            btnHlMissingQuizzes.onclick = () => {
                const res = highlightMissingOrUnansweredQuizzes();
                if (res.count > 0) {
                    showToast(`Highlighted ${res.count} missing/unattempted quizzes!`);
                    setLog(`Found and highlighted <b>${res.count}</b> missing/unattempted quizzes.`, "var(--accent-amber)");
                } else if (res.message) {
                    showToast(res.message);
                    setLog(res.message, "var(--accent-green)");
                } else {
                    showToast("No missing quizzes found on this page! All completed.");
                    setLog("No missing quizzes found on this page. All activities completed!", "var(--accent-green)");
                }
            };
        }

        // --- MODULE 3: Search Module Elements ---
        const keywordInput = document.getElementById('search-keyword-input');
        const copyKeywordBtn = document.getElementById('btn-copy-keyword');
        const openGoogleBtn = document.getElementById('btn-open-google');

        setupPersistentAccordion('mod-search-header', 'mod-search-body', 'mod-search-arrow', 'amaes_pref_mod_search', false);

        if (copyKeywordBtn) copyKeywordBtn.onclick = async () => {
            const query = keywordInput ? keywordInput.value.trim() : '';
            if (!query) {
                showToast("Enter a search term first!");
                return;
            }
            try {
                await copyToClipboard(query);
                setLog(`Copied: "<b>${query}</b>"`, "var(--accent-green)");
                copyKeywordBtn.innerHTML = `${ICONS.check} <span>Copied!</span>`;
                showToast(`Copied search query: "${query}"`);
                setTimeout(() => {
                    copyKeywordBtn.innerHTML = `${ICONS.copy} <span>Copy</span>`;
                }, 2000);
            } catch (e) {
                showToast("Failed to copy search keyword.");
                setLog("Failed to copy search keyword.", "var(--accent-pink)");
            }
        };

        if (openGoogleBtn) openGoogleBtn.onclick = async () => {
            const query = keywordInput ? keywordInput.value.trim() : '';
            if (!query) {
                showToast("Enter a search term first!");
                return;
            }
            try {
                await copyToClipboard(query);
            } catch (e) {}

            const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
            window.open(url, '_blank');
            showToast(`Opened Google search for "${query}"`);
            setLog(`Opened Google search for: "<b>${query}</b>"`, "var(--accent-blue)");
        };

        // --- MODULE 4: Smart AI Assistant (Google Gemini) ---
        setupPersistentAccordion('mod-ai-header', 'mod-ai-body', 'mod-ai-arrow', 'amaes_pref_mod_ai', false);

        const btnOpenGeminiSetup = document.getElementById('btn-open-gemini-setup');
        if (btnOpenGeminiSetup) {
            btnOpenGeminiSetup.onclick = () => {
                showGeminiSetupModal();
            };
        }

        // Dynamic hint text for collapsible accordions
        const aiBlockDetails = document.getElementById('amaes-ai-quiz-settings-block');
        if (aiBlockDetails) {
            const hint = aiBlockDetails.querySelector('.amaes-ai-toggle-hint');
            aiBlockDetails.addEventListener('toggle', () => {
                if (hint) hint.textContent = aiBlockDetails.open ? 'Click to collapse' : 'Click to expand';
            });
        }

        const advDetails = document.getElementById('amaes-advanced-quiz-settings');
        if (advDetails) {
            const hint = advDetails.querySelector('.amaes-adv-toggle-hint');
            advDetails.addEventListener('toggle', () => {
                if (hint) hint.textContent = advDetails.open ? 'Click to collapse' : 'Click to expand';
            });
        }

        // Header Reinstall Button Handler
        const reinstallBtn = document.getElementById('amaes-reinstall-btn');
        if (reinstallBtn) {
            reinstallBtn.onclick = () => {
                triggerScriptReinstall();
            };
        }

        // Header Reset Settings Button Handler
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

        // Header Home / Dashboard Navigation Button Handler
        const homeBtn = document.getElementById('amaes-home-btn');
        if (homeBtn) {
            homeBtn.onclick = (e) => {
                e.preventDefault();
                showToast("Navigating to My Courses...");
                window.location.href = getSemesterCoursesUrl();
            };
        }

        // Theme Toggle Handler
        if (themeBtn) themeBtn.onclick = () => {
            const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
            applyTheme(nextTheme);
            showToast(`Theme switched to ${nextTheme} mode`);
        };

        // Header Version Pill Click -> Direct Update if available, else quick check
        const versionPill = document.getElementById('amaes-version-pill');
        if (versionPill) {
            versionPill.onclick = () => {
                const cachedLatest = localStorage.getItem('amaes_latest_version_seen');
                if (cachedLatest && isNewerVersion(cachedLatest, SCRIPT_VERSION)) {
                    window.open(SCRIPT_RAW_URL, '_blank');
                } else {
                    showToast("Checking GitHub for updates...");
                    checkForScriptUpdates(true);
                }
            };
        }

        const welcomeUpdateNow = document.getElementById('btn-welcome-update-now');
        if (welcomeUpdateNow) {
            welcomeUpdateNow.onclick = (e) => {
                e.preventDefault();
                checkForScriptUpdates(true);
            };
        }

        // --- MODULE 4: Marker Module Collapse ---
        setupPersistentAccordion('mod-marker-header', 'mod-marker-body', 'mod-marker-arrow', 'amaes_pref_mod_marker', !isQuiz);

        setupPersistentAccordion('sub-done-header', 'sub-done-body', 'sub-done-arrow', 'amaes_pref_sub_done', false);
        setupPersistentAccordion('sub-undo-header', 'sub-undo-body', 'sub-undo-arrow', 'amaes_pref_sub_undo', false);

        // Lock State & Terms Acceptance Management
        const lockOverlay = document.getElementById('amaes-panel-lock-overlay');
        const lockPill = document.getElementById('amaes-lock-pill');
        const lockChk = document.getElementById('amaes-lock-chk-terms');
        const lockContainer = document.getElementById('amaes-lock-terms-label');
        const viewTermsBtn = document.getElementById('amaes-btn-lock-view-terms');

        const updatePanelLockState = () => {
            const isAccepted = localStorage.getItem('amaes_terms_acknowledged') === 'true';
            const isMin = localStorage.getItem('amaes_pref_minimized') === 'true';

            if (!isAccepted) {
                if (lockOverlay) lockOverlay.style.display = isMin ? 'none' : 'flex';
                if (bodyEl) bodyEl.style.display = 'none';
                if (lockPill) lockPill.style.display = 'inline-flex';
                if (lockChk) lockChk.checked = false;
                if (lockContainer) lockContainer.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            } else {
                if (lockOverlay) lockOverlay.style.display = 'none';
                if (bodyEl) bodyEl.style.display = isMin ? 'none' : 'flex';
                if (lockPill) lockPill.style.display = 'none';
                if (lockChk) lockChk.checked = true;
            }
        };
        window._amaesUpdatePanelLockState = updatePanelLockState;

        if (lockChk) {
            lockChk.onchange = () => {
                if (lockChk.checked) {
                    if (lockContainer) lockContainer.style.borderColor = 'rgba(16, 185, 129, 0.5)';
                    localStorage.setItem('amaes_terms_acknowledged', 'true');
                    showToast("Terms accepted! Toolkit unlocked.", 3000);
                    updatePanelLockState();

                    const welcomeTerms = document.getElementById('welcome-chk-terms');
                    const welcomeBtn = document.getElementById('btn-got-it-welcome');
                    if (welcomeTerms) welcomeTerms.checked = true;
                    if (welcomeBtn) {
                        welcomeBtn.disabled = false;
                        welcomeBtn.style.opacity = '1';
                    }
                }
            };
        }

        if (viewTermsBtn) {
            viewTermsBtn.onclick = () => {
                showWelcomeOnboardingModal(true);
            };
        }

        const bigLockIcon = document.getElementById('amaes-lock-big-icon');
        if (bigLockIcon) {
            bigLockIcon.onclick = () => {
                showWelcomeOnboardingModal(true);
            };
        }

        if (lockPill) {
            lockPill.onclick = () => {
                showWelcomeOnboardingModal(true);
            };
        }

        // Panel Minimize State Persistence
        const savedMinimized = localStorage.getItem('amaes_pref_minimized') === 'true';
        if (savedMinimized) {
            if (bodyEl) bodyEl.style.display = 'none';
            if (lockOverlay) lockOverlay.style.display = 'none';
            minBtn.innerHTML = `
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                </svg>
            `;
        }

        if (minBtn) minBtn.onclick = () => {
            const isLocked = localStorage.getItem('amaes_terms_acknowledged') !== 'true';
            const targetEl = (isLocked && lockOverlay) ? lockOverlay : bodyEl;
            if (targetEl && targetEl.style.display === 'none') {
                targetEl.style.display = isLocked ? 'flex' : 'block';
                minBtn.innerHTML = ICONS.minimize;
                localStorage.setItem('amaes_pref_minimized', 'false');
            } else if (targetEl) {
                targetEl.style.display = 'none';
                minBtn.innerHTML = `
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                `;
                localStorage.setItem('amaes_pref_minimized', 'true');
            }
        };

        // Initialize lock state
        updatePanelLockState();

        const helpBtn = document.getElementById('amaes-help-btn');
        if (helpBtn) {
            if (helpBtn) helpBtn.onclick = () => {
                showWelcomeOnboardingModal(true);
            };
        }

        const bugBtn = document.getElementById('amaes-bug-btn');
        if (bugBtn) {
            bugBtn.onclick = () => {
                showBugReportModal();
            };
        }

        // Debug Copy Handler
        if (debugBtn) {
            if (debugBtn) debugBtn.onclick = async () => {
                logDebug("Exporting debug diagnostic report...");
                const report = generateDebugReport();
                try {
                    await copyToClipboard(report);
                    debugBtn.innerHTML = ICONS.check;
                    setLog("Debug report copied to clipboard. You can paste it directly to AI.", "var(--accent-green)");
                    setTimeout(() => {
                        debugBtn.innerHTML = ICONS.debug;
                    }, 2500);
                } catch (err) {
                    console.error("Clipboard write error:", err);
                    setLog("Failed to copy automatically. Check browser console.", "var(--accent-pink)");
                }
            };
        }

        // Activity Log Feed Toggle & Clear Handlers
        const btnToggleLogs = document.getElementById('amaes-btn-toggle-logs');
        const activityFeed = document.getElementById('amaes-activity-feed');
        if (btnToggleLogs && activityFeed) {
            btnToggleLogs.onclick = (e) => {
                e.preventDefault();
                const isHidden = activityFeed.style.display === 'none';
                activityFeed.style.display = isHidden ? 'flex' : 'none';
                if (isHidden) renderActivityLogs();
                localStorage.setItem('amaes_pref_show_logs', isHidden ? 'true' : 'false');
            };

            const savedShowLogs = localStorage.getItem('amaes_pref_show_logs') === 'true';
            if (savedShowLogs) {
                activityFeed.style.display = 'flex';
                renderActivityLogs();
            }
        }

        const btnClearLogs = document.getElementById('amaes-btn-clear-logs');
        if (btnClearLogs) {
            btnClearLogs.onclick = (e) => {
                e.preventDefault();
                activityHistory.length = 0;
                renderActivityLogs();
                const countBadge = document.getElementById('amaes-log-count-badge');
                if (countBadge) countBadge.innerText = 'Log (0)';
            };
        }

        const btnCopyLogs = document.getElementById('amaes-btn-copy-logs');
        if (btnCopyLogs) {
            btnCopyLogs.onclick = async (e) => {
                e.preventDefault();

                if (activityHistory.length === 0) {
                    showToast("No logs recorded yet to copy!");
                    return;
                }
                const lines = activityHistory.map(item => `[${item.time}] ${item.text}`).reverse();
                const userAgent = (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : 'Unknown';
                const platform = (typeof navigator !== 'undefined' && (navigator.userAgentData?.platform || navigator.platform)) ? (navigator.userAgentData?.platform || navigator.platform) : 'Unknown';
                const screenSize = (typeof window !== 'undefined' && window.screen) ? `${window.screen.width}x${window.screen.height}` : 'Unknown';
                const currentUrl = (typeof window !== 'undefined' && window.location) ? window.location.href : 'Unknown';
                const cachedCount = (typeof getCachedAnswers === 'function' && subCode) ? (getCachedAnswers(subCode) || []).length : 0;
                const unknownTypes = typeof getUnknownQuestionTypes === 'function' ? getUnknownQuestionTypes() : [];

                const diagnosticHeader = [
                    `=== AMAES MOODLE TOOLKIT DIAGNOSTIC AUDIT LOG ===`,
                    `Timestamp: ${new Date().toISOString()}`,
                    `Toolkit Version: ${SCRIPT_VERSION}`,
                    `Subject / Course: ${subCode || 'General'}`,
                    `Page URL: ${currentUrl}`,
                    `User Agent: ${userAgent}`,
                    `Platform: ${platform}`,
                    `Screen: ${screenSize}`,
                    `Active Mode: ${autoQuizMode ? 'Auto-Quiz' : 'Passive'} | Auto-Pick: ${autoPickQuiz} | Smart-Next: ${autoNextVerified}`,
                    `Cloud Sync: ${localStorage.getItem('amaes_auto_cloud_sync') !== 'false'}`,
                    `Cached DB Questions: ${cachedCount}`,
                    `Recorded Unknown Question Types: ${unknownTypes.length}`,
                    ...(unknownTypes.length > 0 ? [
                        ``,
                        `--- RECORDED UNKNOWN QUESTION TYPES JSON ---`,
                        JSON.stringify(unknownTypes, null, 2)
                    ] : []),
                    ``,
                    `--- ACTIVITY LOG TIMELINE ---`
                ].join('\n');

                const logText = `${diagnosticHeader}\n` + lines.join('\n') + `\n=== END DIAGNOSTIC LOG ===`;
                try {
                    await copyToClipboard(logText);
                    showToast(`Copied ${activityHistory.length} log events + diagnostics!`);
                    setLog(`Copied <b>${activityHistory.length}</b> activity log entries with system diagnostics to clipboard.`, "var(--accent-blue)");
                } catch (err) {
                    showToast("Failed to copy logs to clipboard.");
                }
            };
        }

        // Batch Execution Engine for Auto-Marker
        const runBatch = async (goal, category) => {
            if (isRunning) return;

            if (!checkIsCoursePage()) {
                showToast("Open a course page first to use Activity Auto-Marker!");
                setLog("<b>Action Blocked:</b> You are not on a course page. Open a course subject first.", "var(--accent-pink)");
                return;
            }

            isRunning = true;
            shouldStop = false;
            stopBtn.style.display = 'flex';

            const actionLabel = goal === 'mark_done' ? 'Marking' : 'Undoing';
            setLog(`Searching for ${category} items to ${goal === 'mark_done' ? 'complete' : 'undo'}...`);

            const items = findButtons(goal, category);
            if (items.length === 0) {
                showToast(`No uncompleted ${category} items found to ${goal === 'mark_done' ? 'mark' : 'undo'}!`);
                setLog(`No matching items found for: <b>${category}</b> (${goal})!`, "var(--accent-green)");
                finish();
                return;
            }

            showToast(`Found ${items.length} ${category} items to ${goal === 'mark_done' ? 'mark' : 'undo'}. Processing...`, 2500);
            setLog(`Found ${items.length} items. Starting...`);

            let processedCount = 0;
            for (let i = 0; i < items.length; i++) {
                if (shouldStop) {
                    showToast(`Stopped. Processed ${processedCount} items.`);
                    setLog(`Stopped. Processed ${processedCount} items.`, "var(--accent-amber)");
                    break;
                }

                const item = items[i];
                setLog(`[${i + 1}/${items.length}] ${actionLabel}: <b>${item.title.substring(0, 22)}...</b>`);

                item.button.scrollIntoView({ behavior: 'smooth', block: 'center' });
                item.button.click();
                processedCount++;

                await new Promise(r => setTimeout(r, 450));
            }

            if (!shouldStop) {
                showToast(`Finished ${actionLabel.toLowerCase()} ${processedCount} items!`);
                setLog(`Successfully finished ${actionLabel.toLowerCase()} ${processedCount} items!`, "var(--accent-green)");
            }

            finish();
        };

        const finish = () => {
            isRunning = false;
            stopBtn.style.display = 'none';
        };

        if (stopBtn) stopBtn.onclick = () => {
            shouldStop = true;
            showToast("Stopping after current item...");
            setLog('Stopping after current item...', "var(--accent-amber)");
        };

        // Attach Clicks
        const _el__btn_mark_lec_ = document.getElementById('btn-mark-lec');
        if (_el__btn_mark_lec_) _el__btn_mark_lec_.onclick = () => runBatch('mark_done', 'lecture');
        const _el__btn_mark_quiz_ = document.getElementById('btn-mark-quiz');
        if (_el__btn_mark_quiz_) _el__btn_mark_quiz_.onclick = () => runBatch('mark_done', 'quiz');
        const _el__btn_mark_all_ = document.getElementById('btn-mark-all');
        if (_el__btn_mark_all_) _el__btn_mark_all_.onclick = () => runBatch('mark_done', 'all');

        const _el__btn_undo_lec_ = document.getElementById('btn-undo-lec');
        if (_el__btn_undo_lec_) _el__btn_undo_lec_.onclick = () => runBatch('undo', 'lecture');
        const _el__btn_undo_quiz_ = document.getElementById('btn-undo-quiz');
        if (_el__btn_undo_quiz_) _el__btn_undo_quiz_.onclick = () => runBatch('undo', 'quiz');
        const _el__btn_undo_all_ = document.getElementById('btn-undo-all');
        if (_el__btn_undo_all_) _el__btn_undo_all_.onclick = () => runBatch('undo', 'all');

        // Quiz Automation will be initialized once when document is ready
    }

