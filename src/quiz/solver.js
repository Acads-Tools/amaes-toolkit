    // ==========================================
    // Robust Quiz Navigation & Autonomous Solver Engine
    // ==========================================

    // Inspect Moodle Quiz Navigation block to detect answered vs unanswered questions
    function getQuizNavQuestionStates() {
        const navBlock = document.querySelector('#mod_quiz_navblock, .block_quiz_navigation, .qn_buttons');
        if (!navBlock) return null;

        const buttons = Array.from(navBlock.querySelectorAll('.qnbutton, a[id^="quiznavbutton"], button[id^="quiznavbutton"]'));
        if (buttons.length === 0) return null;

        const questionList = [];
        let currentIndex = -1;

        buttons.forEach((btn, idx) => {
            const isCurrent = btn.classList.contains('thispage') || btn.getAttribute('aria-current') === 'true';
            if (isCurrent) currentIndex = idx;

            // In Moodle, answered questions have class .answersaved, or title/aria-label containing "Answer saved"
            const title = (btn.getAttribute('title') || '').toLowerCase();
            const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
            const hasAnswerSavedClass = btn.classList.contains('answersaved');
            const isAnswered = hasAnswerSavedClass || title.includes('answer saved') || ariaLabel.includes('answer saved');

            const qNum = parseInt(btn.innerText.trim(), 10) || (idx + 1);

            questionList.push({
                btn,
                qNum,
                index: idx,
                isCurrent,
                isAnswered
            });
        });

        // Find the next UNANSWERED question AFTER the current question
        let nextUnanswered = null;
        if (currentIndex >= 0) {
            for (let i = currentIndex + 1; i < questionList.length; i++) {
                if (!questionList[i].isAnswered) {
                    nextUnanswered = questionList[i];
                    break;
                }
            }
            // If none ahead, wrap around to check earlier skipped questions
            if (!nextUnanswered) {
                for (let i = 0; i < currentIndex; i++) {
                    if (!questionList[i].isAnswered) {
                        nextUnanswered = questionList[i];
                        break;
                    }
                }
            }
        }

        const totalUnanswered = questionList.filter(q => !q.isAnswered).length;
        const totalAnswered = questionList.length - totalUnanswered;

        return {
            navBlock,
            questions: questionList,
            currentIndex,
            nextUnanswered,
            totalUnanswered,
            totalAnswered,
            totalQuestions: questionList.length,
            allAnswered: totalUnanswered === 0
        };
    }

    // Helper to find the Next Page button on Moodle Quiz Attempt page
    function findQuizNextButton() {
        // 1. Primary: Next button inside Moodle's submitbtns or responseform
        let btn = document.querySelector(
            '#responseform .submitbtns input[name="next"], ' +
            '#responseform .submitbtns button[name="next"], ' +
            '#responseform .submitbtns input[type="submit"]:not([name="previous"]):not([value*="Previous"]), ' +
            '#responseform .submitbtns button:not([name="previous"]):not(.btn-secondary), ' +
            '.submitbtns input[name="next"], ' +
            '.submitbtns button[name="next"], ' +
            '.submitbtns input[value*="Next"], ' +
            '.submitbtns button[value*="Next"], ' +
            'input[name="next"].mod_quiz-next-nav, ' +
            '#mod_quiz-next-nav, ' +
            '.mod_quiz-next-nav'
        );

        // 2. If on the final question, look for "Finish attempt ..."
        if (!btn) {
            btn = document.querySelector(
                '#responseform .submitbtns input[value*="Finish attempt"], ' +
                '#responseform .submitbtns button[value*="Finish attempt"], ' +
                '.submitbtns input[value*="Finish attempt"], ' +
                '.submitbtns button[value*="Finish attempt"], ' +
                'input[value*="Finish attempt"], ' +
                'button[value*="Finish attempt"], ' +
                'input[value*="Finish"], ' +
                'button[value*="Finish"]'
            );
        }

        // 3. Fallback: Any submit button inside responseform that does not navigate backwards
        if (!btn) {
            const submits = document.querySelectorAll('#responseform input[type="submit"], #responseform button[type="submit"]');
            for (const s of submits) {
                const val = (s.value || s.innerText || '').toLowerCase();
                if (!val.includes('prev') && !val.includes('back')) {
                    btn = s;
                    break;
                }
            }
        }

        return btn;
    }

    // Active Question State & Visual Focus Tracking
    let userSelectedActiveQuestion = null;
    let userActiveLockUntil = 0;

    function setActiveQuestion(que, userClicked = false) {
        if (!que) return;
        userSelectedActiveQuestion = que;
        if (userClicked) {
            userActiveLockUntil = Date.now() + 8000;
        }
        document.querySelectorAll('.que').forEach(q => {
            if (q === que) {
                q.classList.add('amaes-active-focus-que');
            } else {
                q.classList.remove('amaes-active-focus-que');
            }
        });
    }

    // Resolve the question currently in viewport, active, or first unanswered on multi-question pages
    function getActiveViewportQuestion() {
        const questions = Array.from(document.querySelectorAll('.que'));
        if (questions.length === 0) return null;
        if (questions.length === 1) {
            setActiveQuestion(questions[0], false);
            return questions[0];
        }

        // If user explicitly clicked a question and it is still visible within/near viewport
        if (userSelectedActiveQuestion && document.contains(userSelectedActiveQuestion)) {
            const rect = userSelectedActiveQuestion.getBoundingClientRect();
            const vh = window.innerHeight || 800;
            if (rect.bottom > 60 && rect.top < vh - 60) {
                setActiveQuestion(userSelectedActiveQuestion, false);
                return userSelectedActiveQuestion;
            }
        }

        const viewportHeight = window.innerHeight || 800;
        let bestQue = null;
        let bestScore = -1;

        for (const q of questions) {
            const rect = q.getBoundingClientRect();
            // Discard if element is completely scrolled out of viewport
            if (rect.bottom < 40 || rect.top > viewportHeight - 40) continue;

            const visibleTop = Math.max(0, rect.top);
            const visibleBottom = Math.min(viewportHeight, rect.bottom);
            const visibleHeight = Math.max(0, visibleBottom - visibleTop);
            if (visibleHeight <= 0) continue;

            // Prioritize questions whose header or body is in the primary reading band (-80px to 60% viewport)
            let score = visibleHeight;
            if (rect.top >= -80 && rect.top <= viewportHeight * 0.6) {
                score += 600;
            }
            if (score > bestScore) {
                bestScore = score;
                bestQue = q;
            }
        }

        if (!bestQue) {
            bestQue = questions.find(q => !q.classList.contains('answered') && !q.classList.contains('complete')) || questions[0];
        }

        if (bestQue) {
            setActiveQuestion(bestQue, false);
        }
        return bestQue;
    }

    // Check whether every question on the current attempt page has an answer selected/entered
    function areAllPageQuestionsAnswered() {
        const queList = document.querySelectorAll('.que');
        if (queList.length === 0) return false;

        for (const que of queList) {
            // 1. Radio: check if any radio in question is checked
            const radios = que.querySelectorAll('.answer input[type="radio"]');
            if (radios.length > 0) {
                const anyChecked = Array.from(radios).some(r => r.checked);
                if (!anyChecked) return false;
                continue;
            }

            // 2. Checkbox: multi-choice questions (require all verified highlighted choices to be checked)
            const checkboxes = que.querySelectorAll('.answer input[type="checkbox"]');
            if (checkboxes.length > 0) {
                const highlightedBoxes = que.querySelectorAll('.amaes-highlighted-choice input[type="checkbox"]');
                if (highlightedBoxes.length > 0) {
                    const allVerifiedChecked = Array.from(highlightedBoxes).every(c => c.checked);
                    if (!allVerifiedChecked) return false;
                } else {
                    const anyChecked = Array.from(checkboxes).some(c => c.checked);
                    if (!anyChecked) return false;
                }
                continue;
            }

            // 3. Select dropdowns (matching questions)
            const selects = que.querySelectorAll('select');
            if (selects.length > 0) {
                const allSelected = Array.from(selects).every(s => s.value && s.value !== '0' && s.value !== '');
                if (!allSelected) return false;
                continue;
            }

            // 4. Text input / textarea (shortanswer questions)
            const textInputs = que.querySelectorAll('input[type="text"].form-control, input.form-control, textarea');
            if (textInputs.length > 0) {
                const allFilled = Array.from(textInputs).every(inp => inp.value && inp.value.trim().length > 0);
                if (!allFilled) return false;
                continue;
            }

            // 5. Drag and Drop questions (ddwtos, ddimageortext, ddmarker)
            const dropZones = que.querySelectorAll('.drop, .dropzone, span.droptarget, .droppable');
            const placeInputs = que.querySelectorAll('input.placeinput, input[type="hidden"][name*="_p"]');
            if (dropZones.length > 0 || placeInputs.length > 0) {
                if (placeInputs.length > 0) {
                    const allPlaced = Array.from(placeInputs).every(inp => inp.value && inp.value !== '0' && inp.value.trim() !== '');
                    if (!allPlaced) return false;
                } else {
                    const allFilled = Array.from(dropZones).every(dz => dz.innerText && dz.innerText.trim().length > 0);
                    if (!allFilled) return false;
                }
                continue;
            }

            // 6. Moodle state classes
            if (que.classList.contains('answered') || que.classList.contains('complete')) {
                continue;
            }

            // Fallback: unrecognized question type with no checked answer
            return false;
        }

        return true;
    }

    function isQuestionAnswered(que) {
        if (!que) return false;
        const radios = que.querySelectorAll('.answer input[type="radio"]');
        if (radios.length > 0) return Array.from(radios).some(input => input.checked);

        const checkboxes = que.querySelectorAll('.answer input[type="checkbox"]');
        if (checkboxes.length > 0) {
            const highlighted = que.querySelectorAll('.amaes-highlighted-choice input[type="checkbox"]');
            return highlighted.length > 0
                ? Array.from(highlighted).every(input => input.checked)
                : Array.from(checkboxes).some(input => input.checked);
        }

        const selects = que.querySelectorAll('select');
        if (selects.length > 0) {
            return Array.from(selects).every(select => select.value && select.value !== '0');
        }

        const textInputs = que.querySelectorAll(
            'input[type="text"].form-control, input.form-control, textarea'
        );
        if (textInputs.length > 0) {
            return Array.from(textInputs).every(input => input.value && input.value.trim());
        }

        const placeInputs = que.querySelectorAll('input.placeinput, input[type="hidden"][name*="_p"]');
        const dropZones = que.querySelectorAll('.drop, .dropzone, span.droptarget, .droppable');
        if (placeInputs.length > 0 || dropZones.length > 0) {
            return placeInputs.length > 0 &&
                Array.from(placeInputs).every(input => input.value && input.value !== '0' && input.value.trim());
        }

        // Generalized fallback for unknown question input structures
        const anyInputs = que.querySelectorAll('input:not([type="hidden"]), select, textarea');
        if (anyInputs.length > 0) {
            const hasChecked = Array.from(anyInputs).some(i => (i.type === 'radio' || i.type === 'checkbox') && i.checked);
            const hasValue = Array.from(anyInputs).some(i => i.type !== 'radio' && i.type !== 'checkbox' && i.value && i.value.trim() && i.value !== '0');
            if (hasChecked || hasValue) return true;
        }

        return que.classList.contains('answered') || que.classList.contains('complete');
    }

    function findNextUnansweredOnCurrentPage(sourceQue) {
        const questions = Array.from(document.querySelectorAll('.que'));
        if (questions.length < 2) return null;

        const startIndex = sourceQue ? questions.indexOf(sourceQue) : -1;
        const ordered = startIndex >= 0
            ? questions.slice(startIndex + 1).concat(questions.slice(0, startIndex))
            : questions;
        return ordered.find(que => !isQuestionAnswered(que)) || null;
    }

    function getAttemptEvidenceKey() {
        const params = new URLSearchParams(window.location.search);
        return `amaes_attempt_evidence_${params.get('attempt') || params.get('quiz') || params.get('cmid') || window.location.pathname}`;
    }

    function recordAttemptAnswerEvidence(que, answer, source = 'manual_selection') {
        if (!que || !answer) return;
        const qData = extractQuestionData(que);
        if (!qData || !qData.qText) return;
        try {
            const key = getAttemptEvidenceKey();
            const current = JSON.parse(sessionStorage.getItem(key) || '[]');
            const entry = {
                qRaw: qData.qText,
                qNorm: normalizeText(qData.qText),
                ansRaw: String(answer).trim(),
                ansNorm: normalizeChoice(answer),
                choices: qData.choices || [],
                source,
                isAiSuggestion: source === 'ai_inference',
                recordedAt: Date.now()
            };
            const next = current.filter(item => item.qNorm !== entry.qNorm);
            next.push(entry);
            sessionStorage.setItem(key, JSON.stringify(next.slice(-100)));
        } catch (err) {
            logDebug(`Attempt evidence storage note: ${err.message}`);
        }
    }

    function promoteAttemptEvidenceFromScore() {
        if (!checkIsQuizSummaryPage()) return;
        let earned = null;
        let maximum = null;
        document.querySelectorAll('table').forEach(table => {
            if (earned !== null) return;
            const rows = Array.from(table.querySelectorAll('tr'));
            const headerRow = rows.find(row => Array.from(row.children).some(cell => /grade/i.test(cell.innerText || '')));
            if (!headerRow) return;
            const headers = Array.from(headerRow.children);
            const gradeIndex = headers.findIndex(cell => /grade/i.test(cell.innerText || ''));
            if (gradeIndex < 0) return;
            const headerMax = (headers[gradeIndex].innerText || '').match(/\/\s*([0-9]+(?:\.[0-9]+)?)/);
            const attemptRows = rows.filter(row => /finished/i.test(row.innerText || ''));
            const latest = attemptRows[attemptRows.length - 1];
            const gradeCell = latest && latest.children[gradeIndex];
            const gradeValue = gradeCell && (gradeCell.innerText || '').match(/([0-9]+(?:\.[0-9]+)?)/);
            if (gradeValue && headerMax) {
                earned = Number(gradeValue[1]);
                maximum = Number(headerMax[1]);
            }
        });
        if (earned === null || maximum === null) return;
        if (!Number.isFinite(earned) || !Number.isFinite(maximum) || maximum <= 0) return;
        let evidence = [];
        try {
            evidence = JSON.parse(sessionStorage.getItem(getAttemptEvidenceKey()) || '[]');
        } catch (_) {}
        if (!Array.isArray(evidence) || evidence.length === 0) return;
        if (earned < maximum) {
            setLog(`Score evidence saved (${earned}/${maximum}). Individual answers were not promoted because a partial score cannot identify which choices were correct.`, 'var(--accent-amber)');
            return;
        }
        const courseInfo = detectCourseInfo();
        const subCode = courseInfo.subjectCode || 'GENERAL';
        const promoted = evidence.map(item => ({
            ...item,
            verified: true,
            isAiSuggestion: false,
            source: 'moodle_100_percent',
            evidenceType: 'moodle_100_percent'
        }));
        mergeAnswersIntoCache(subCode, promoted, 'moodle_100_percent');
        queueCommunityContribution(subCode, promoted, {
            source: 'moodle_100_percent',
            evidenceType: 'moodle_100_percent'
        });
        setLog(`100% score confirmed <b>${promoted.length}</b> recorded answers and queued them for the verified database.`, 'var(--accent-green)');
        showToast(`100% confirmed: ${promoted.length} answers saved to the study database.`, 4000);
        sessionStorage.removeItem(getAttemptEvidenceKey());
    }

    // Schedule automatic advancement to the next target on a one-page quiz,
    // or to the next Moodle page after all questions on this page are answered.
    function scheduleAutoNextAfterAnswer(delayMs = 800, isManualAnswer = false) {
        const sourceQue = arguments[2] || null;
        const allowAiAutoNext = arguments[3] === true;
        if (!autoQuizMode) return;
        // While Auto-Quiz is running, manual answers are completed targets too.
        // Continue to the next unanswered question instead of leaving the user
        // on the question that was just answered.
        if (isManualAnswer && !autoNextQuiz) return;
        if (!isManualAnswer && !autoNextVerified && !allowAiAutoNext) return;
        if (!checkIsQuizAttemptPage()) return;

        const nextOnPage = findNextUnansweredOnCurrentPage(sourceQue);
        if (nextOnPage) {
            clearTimeout(autoNextTimer);
            setLog("<b>Question Answered:</b> Moving to the next unanswered question in <b>0.8s</b>...", "var(--accent-blue)");
            showToast("Answer recorded! Moving to the next question...", 1200);
            autoNextTimer = setTimeout(() => {
                if (!autoQuizMode) return;
                setActiveQuestion(nextOnPage, false);
                nextOnPage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                runAutoQuizSolver();
            }, delayMs);
            return;
        }

        if (!areAllPageQuestionsAnswered()) return;

        const nextBtn = findQuizNextButton();
        if (!nextBtn) return;

        const btnText = (nextBtn.value || nextBtn.innerText || '').toLowerCase();
        const isFinish = btnText.includes('finish') || btnText.includes('submit');

        clearTimeout(autoNextTimer);

        if (isFinish) {
            setLog("<b>All Questions Answered!</b> Advancing to summary in <b>1.0s</b>...", "var(--accent-green)");
            showToast("All questions answered! Advancing to summary in 1s...", 1500);
            playToolkitSound('quest_done');
        } else {
            setLog("<b>Question Answered:</b> Advancing to next page in <b>0.8s</b>...", "var(--accent-blue)");
            showToast("Answer selected! Advancing to next page...", 1200);
        }

        autoNextTimer = setTimeout(() => {
            if (!autoQuizMode) return;
            if (isManualAnswer && !autoNextQuiz) return;
            clickQuizNextButton(nextBtn, true);
        }, delayMs);
    }

    // Bind event listeners to question inputs to trigger auto-next immediately when choices are selected
    function setupQuizAnswerListeners() {
        if (!checkIsQuizAttemptPage()) return;
        const inputs = document.querySelectorAll(
            '.que .answer input[type="radio"], .que .answer input[type="checkbox"], .que select'
        );
        inputs.forEach(inp => {
            if (inp.dataset.amaesAutoNextBound) return;
            inp.dataset.amaesAutoNextBound = 'true';
            inp.addEventListener('change', () => {
                if (autoQuizMode) {
                    scheduleAutoNextAfterAnswer(inp.type === 'checkbox' ? 1200 : 800, true, inp.closest('.que'));
                }
            });
        });

        const textInputs = document.querySelectorAll(
            '.que input[type="text"].form-control, .que input.form-control, .que textarea'
        );
        textInputs.forEach(inp => {
            if (inp.dataset.amaesAutoNextBound) return;
            inp.dataset.amaesAutoNextBound = 'true';
            inp.addEventListener('blur', () => {
                if (autoQuizMode && inp.value && inp.value.trim().length > 0) {
                    scheduleAutoNextAfterAnswer(1000, true, inp.closest('.que'));
                }
            });
        });
    }

    // Fail-safe click & smart navigation executor (skips already-answered questions)
    function clickQuizNextButton(btn, forceAllow = false) {
        if (!autoQuizMode && !forceAllow && !autoNextQuiz) {
            logDebug("Blocked clickQuizNextButton: Auto-Quiz is PAUSED.");
            return false;
        }

        // SMART NAVIGATION: If smart skip is enabled, jump directly to next unanswered question!
        if (smartSkipQuiz) {
            const navState = getQuizNavQuestionStates();
            if (navState && navState.nextUnanswered && navState.nextUnanswered.btn) {
                const target = navState.nextUnanswered;
                logDebug(`Smart Jump: Bypassing answered questions, jumping directly to Question #${target.qNum}`);
                setLog(`[Skip] <b>Smart Skip:</b> Jumping to unanswered <b>Question #${target.qNum}</b> (${navState.totalUnanswered} remaining)...`, "var(--accent-blue)");
                showToast(`Smart Jump: Question #${target.qNum}`, 1800);

                target.btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                try {
                    target.btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    target.btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                    target.btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                } catch (e) {}
                target.btn.click();
                return true;
            } else if (navState && navState.allAnswered) {
                // All questions on the entire quiz are answered! Proceed to finish attempt
                const finishBtn = document.querySelector(
                    '.submitbtns input[value*="Finish attempt"], .submitbtns button[value*="Finish attempt"], input[value*="Finish attempt"], a.endtestlink, #mod_quiz_navblock a[href*="summary.php"]'
                );
                if (finishBtn) {
                    logDebug("Smart Navigation: All questions answered! Proceeding to finish attempt.");
                    setLog("<b>All Questions Answered!</b> Proceeding to summary screen...", "var(--accent-green)");
                    showToast("All questions answered! Finishing attempt...", 2500);
                    playToolkitSound('quest_done');
                    finishBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    finishBtn.click();
                    return true;
                }
            }
        }

        if (!btn) {
            logDebug("Cannot navigate: Next button not found on page.");
            return false;
        }
        logDebug(`Executing Quiz Next Navigation: ${btn.value || btn.innerText || btn.name}`);

        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        btn.focus();

        // Dispatch realistic user click event
        try {
            btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
            btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
            btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
        } catch (e) {
            console.warn("MouseEvent dispatch error:", e);
        }

        // Native click call
        btn.click();
        return true;
    }

    let isSolverRunning = false;

    async function runAutoQuizSolver(forceRun = false) {
        if (localStorage.getItem('amaes_terms_acknowledged') !== 'true') {
            autoQuizMode = false;
            return;
        }
        if (!checkIsQuizAttemptPage()) return;

        // STRICT PAUSE CHECK: If Auto-Quiz is not explicitly active or force-run, halt completely
        const isAutoActive = forceRun || autoQuizMode;
        if (!isAutoActive || !autoQuizMode) {
            logDebug("Auto Quiz Solver is PAUSED. Suppressing auto-clicks and auto-navigation.");
            clearTimeout(autoNextTimer);
            autoNextTimer = null;
            clearTimeout(pageLoadSolverTimer);
            pageLoadSolverTimer = null;
            isSolverRunning = false;
            return;
        }

        if (isSolverRunning) return;
        isSolverRunning = true;

        try {
            const courseInfo = detectCourseInfo();
            const subCode = courseInfo.subjectCode || 'CS6301';
            let cached = getCachedAnswers(subCode);
            const queContainers = document.querySelectorAll('.que');
            // Restore per-question controls when the solver is no longer
            // blocked; they are hidden below when the full waiting HUD exists.
            document.querySelectorAll('.amaes-que-top-toolbar').forEach(toolbar => {
                toolbar.style.display = '';
            });

            if (queContainers.length === 0) {
                isSolverRunning = false;
                return;
            }

            // 1. Highlight and Auto-Select verified answers from database (ONLY click if autoQuizMode is true)
            let res = { matched: 0, total: queContainers.length };

            // AUTO-FETCH FROM CLOUD DATABASE / AMAUOED FALLBACK: If local cache is empty, check cloud DB & AMAUOED!
            if (!cached || cached.length === 0) {
                logDebug(`Local cache empty for ${subCode}. Checking community cloud database & AMAUOED...`);
                setLog(`Checking database & AMAUOED for <b>${subCode}</b>...`, "var(--accent-blue)");
                try {
                    if (typeof autoFetchCloudAnswersIfMissing === 'function') {
                        await autoFetchCloudAnswersIfMissing(subCode);
                    } else {
                        await syncAnswersFromCloud(subCode);
                    }
                    const freshCached = getCachedAnswers(subCode);
                    if (freshCached && freshCached.length > 0) {
                        cached = freshCached;
                        setLog(`Auto-loaded <b>${freshCached.length}</b> verified answers for <b>${subCode}</b>!`, "var(--accent-green)");
                        showToast(`Loaded ${freshCached.length} answers!`);
                        syncAutoQuizUI();
                    }
                } catch (e) {
                    logDebug(`Auto-fetch fallback note: ${e.message}`);
                }
            }

            if (cached && cached.length > 0) {
                res = highlightQuizAnswers(cached, autoPickQuiz || autoQuizMode);
            } else {
                setLog(`<b>No Answers in DB:</b> Open amauoed or click Cloud Sync for <b>${subCode}</b>!`, "var(--accent-amber)");
            }

            // 2. Identify questions verified by the database vs unverified/unknown questions
            const unverifiedQuestions = [];
            queContainers.forEach(que => {
                // A student's manual answer is not an unknown question. Do not
                // replace it with an AI warning on one-page quizzes.
                if (isQuestionAnswered(que)) return;
                const hasVerifiedBadge = que.querySelector('.amaes-verified-badge');
                const hasShortAnsHint = que.querySelector('.amaes-shortans-hint');
                const hasSelectHint = que.querySelector('.amaes-select-hint');
                const hasDragHint = que.querySelector('.amaes-drag-hint');
                const dropZones = que.querySelectorAll('.drop, .dropzone, span.droptarget, .droppable');
                const selectInputs = que.querySelectorAll('select');
                const textInputs = que.querySelectorAll('input[type="text"].form-control, input.form-control');

                let isFullyVerified = false;
                if (hasVerifiedBadge) {
                    isFullyVerified = true;
                } else if (dropZones.length > 0) {
                    isFullyVerified = que.querySelectorAll('.amaes-drag-hint').length >= dropZones.length;
                } else if (selectInputs.length > 0) {
                    isFullyVerified = que.querySelectorAll('.amaes-select-hint').length >= selectInputs.length;
                } else if (textInputs.length > 0) {
                    isFullyVerified = que.querySelectorAll('.amaes-shortans-hint').length >= textInputs.length;
                } else if (hasShortAnsHint || hasSelectHint || hasDragHint) {
                    isFullyVerified = true;
                }

                if (!isFullyVerified) {
                    unverifiedQuestions.push(que);
                }
            });

            const nextBtn = findQuizNextButton();

            // Co-Pilot: Auto-Pick & Next IF Known, WAIT if Unknown
                // Case A: 100% of questions on this page were verified & answered by database!
                if (unverifiedQuestions.length === 0 && res.total > 0) {
                    const allAnswered = areAllPageQuestionsAnswered();
                    if (allAnswered) {
                        setLog(`All <b>${res.total}</b> question(s) verified & picked!`, "var(--accent-green)");

                        // Answered by Auto-Quiz: automatically advance to next page!
                        if (nextBtn && autoNextVerified) {
                            const btnText = (nextBtn.value || nextBtn.innerText || '').toLowerCase();
                            const isFinish = btnText.includes('finish') || btnText.includes('submit');

                            clearTimeout(autoNextTimer);
                            if (isFinish) {
                                if (autoSubmitQuiz) {
                                    setLog(`<b>All Questions Answered!</b> Advancing to summary in 1.2s...`, "var(--accent-green)");
                                    showToast("Finishing attempt...", 3000);
                                    autoNextTimer = setTimeout(() => {
                                        if (!autoQuizMode) return;
                                        clickQuizNextButton(nextBtn);
                                    }, 1200);
                                } else {
                                    setLog("<b>Last Question Answered!</b> Paused for review before final submit.", "var(--accent-green)");
                                    showToast("Last question answered! Review before submitting.", 4000);
                                }
                                isSolverRunning = false;
                                return;
                            }

                            setLog(`[Auto-Next] <b>Auto-Next:</b> Advancing to next question in <b>1.0s</b>...`, "var(--accent-blue)");
                            autoNextTimer = setTimeout(() => {
                                if (!autoQuizMode) return;
                                clickQuizNextButton(nextBtn);
                            }, 1000);
                        }
                    } else {
                        // Verified choices highlighted, but not all picked (e.g. auto-pick disabled)
                        setLog(`Verified answers found! Select your choice${autoNextQuiz ? ' (advances automatically)' : ' and click Next page'}.`, "var(--accent-blue)");
                    }
                    isSolverRunning = false;
                    return;
                }

                // Case B: UNKNOWN QUESTION DETECTED (Auto-solver cannot answer it!)
                // Safe wait state on unknown question: solver pauses on THIS question for user input,
                // while keeping autoQuizMode active so subsequent known questions are answered directly!
                clearTimeout(autoNextTimer);
                autoNextTimer = null;
                isWaitingForUserAnswer = true;
                syncAutoQuizUI(true);

                const firstBlockedQue = unverifiedQuestions[0];
                const qData = extractQuestionData(firstBlockedQue);
                const willIncludeContext = shouldInjectAiContext(qData ? qData.qNum : null);
                const aiPromptText = formatQuestionForAI(firstBlockedQue, aiPromptHint);

                // Feature 1: Instant Auto-Copy — copy prompt immediately on unknown question detection,
                // before AI is invoked or any condition is checked (aiAutoCopyOnFail guard respected).
                if (aiAutoCopyOnFail && qData && qData.questionType !== 'unknown') {
                    copyQuestionWithOptionalImage(firstBlockedQue, aiPromptText).catch(() => {});
                }

                firstBlockedQue.scrollIntoView({ behavior: 'smooth', block: 'center' });
                firstBlockedQue.style.outline = '2.5px solid #f59e0b';
                firstBlockedQue.style.borderRadius = '8px';
                // The waiting HUD already has the only needed stop control.
                firstBlockedQue.querySelectorAll('.amaes-que-top-toolbar').forEach(toolbar => {
                    toolbar.style.display = 'none';
                });

                // If question type is unknown / unrecognized:
                // Do not alter or interfere with the question card at all ("dont do anythibg but notify").
                // It is already reported and pushed to database by recordUnknownQuestionType.
                if (qData && qData.questionType === 'unknown') {
                    recordUnknownQuestionType(firstBlockedQue, qData);
                    firstBlockedQue.style.outline = '';
                    isSolverRunning = false;
                    return;
                }

                // Feature 4: Moodle Server Error Guard — detect empty/failed question load
                if (detectMoodleServerError(firstBlockedQue)) {
                    firstBlockedQue.querySelectorAll('.amaes-blockage-hud').forEach(el => el.remove());
                    const errHud = document.createElement('div');
                    errHud.className = 'amaes-blockage-hud';
                    errHud.style.cssText = `
                        margin-bottom: 12px; padding: 8px 12px;
                        background: #fff7ed; border: 1.5px solid #f97316;
                        border-radius: 8px; display: flex; align-items: center; gap: 8px;
                        font-size: 11px; color: #9a3412; font-family: -apple-system, sans-serif;
                    `;
                    errHud.innerHTML = `
                        <span style="font-weight: 700;">Warning</span>
                        <div>
                            <div style="font-weight: 700;">Moodle Server Glitch Detected</div>
                            <div style="font-size: 10px; color: #c2410c;">Question content failed to load from Moodle database. Try refreshing the page.</div>
                        </div>
                        <button type="button" onclick="location.reload()" style="margin-left:auto; background:#ea580c; color:#fff; border:none; border-radius:5px; padding:4px 10px; font-size:10px; font-weight:700; cursor:pointer;">Reload</button>
                    `;
                    const formEl = firstBlockedQue.querySelector('.formulation, .content') || firstBlockedQue;
                    formEl.insertBefore(errHud, formEl.firstChild);
                    setLog('[Server Error] Moodle database glitch detected. Question content is empty — cannot solve. Try refreshing.', 'var(--accent-amber)');
                    showToast('Moodle server glitch: Question failed to load.', 4000);
                    isSolverRunning = false;
                    return;
                }

                const navState = getQuizNavQuestionStates();

                // GOOGLE GEMINI AI ASSISTANT: Only trigger on uncertain Multiple Choice & True/False questions!
                // Fall back to manual copy for complex types (drag & drop, dropdown, text inputs) or if AI not configured
                const isEligibleChoice = isEligibleForAiSolver(firstBlockedQue, qData);
                const existingAiChoice = firstBlockedQue.querySelector('.amaes-ai-suggested-choice');
                if (existingAiChoice && !isChoiceRowEliminated(existingAiChoice)) {
                    // Clean up any stale blockage HUD if previously injected
                    firstBlockedQue.querySelectorAll('.amaes-blockage-hud').forEach(el => el.remove());
                    firstBlockedQue.querySelectorAll('.amaes-que-top-toolbar').forEach(toolbar => {
                        toolbar.style.display = 'flex';
                    });
                    firstBlockedQue.style.outline = '2px solid rgba(139, 92, 246, 0.7)';
                    firstBlockedQue.style.borderRadius = '8px';
                    setQuestionAiTag(firstBlockedQue, true);
                    // Already solved by AI and highlighted! Keep paused for review without re-querying API.
                    setLog(`[AI Suggestion] Question #${qData ? qData.qNum : ''} has an AI suggestion. (Prompt copied) Paused for review—press <b>N</b> or click Next page when ready.`, "var(--accent-purple)");
                    isSolverRunning = false;
                    return;
                }
                const activeGeminiKey = getAvailableGeminiKey();
                if (activeGeminiKey && aiQuizEnabled && isEligibleChoice) {
                    // Check if client-side or cooldown rate limit is currently active
                    const rateLimitStatus = getAiRateLimitStatus();
                    if (rateLimitStatus.isLimited) {
                        firstBlockedQue.querySelectorAll('.amaes-blockage-hud').forEach(el => el.remove());
                        copyQuestionWithOptionalImage(firstBlockedQue, aiPromptText).catch(() => {});
                        const rlReason = `Google is temporarily limiting AI requests. Try again in ${rateLimitStatus.remainingSec} seconds.`;
                        setLog(`[AI Rate Limit] Question #${qData ? qData.qNum : ''}: ${rlReason} (Prompt copied)`, "var(--accent-amber)");
                        showToast(`AI rate limit: available in ${rateLimitStatus.remainingSec}s`, 3500);

                        if (!firstBlockedQue.dataset.amaesInterventionAlertPlayed) {
                            firstBlockedQue.dataset.amaesInterventionAlertPlayed = 'true';
                            playToolkitSound('manual_intervention');
                        }

                        showAiFallbackBar(firstBlockedQue, qData, aiPromptText, async () => {
                            isSolverRunning = false;
                            autoSolveQuizQuestion();
                        }, {
                            reason: rlReason,
                            isRateLimit: true,
                            waitSeconds: rateLimitStatus.remainingSec
                        });

                        firstBlockedQue.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        firstBlockedQue.style.outline = '2px solid #f97316';
                        firstBlockedQue.style.borderRadius = '8px';
                        isSolverRunning = false;
                        return;
                    }

                    // Remove any manual blockage HUD so it does not conflict with active AI solving
                    firstBlockedQue.querySelectorAll('.amaes-blockage-hud').forEach(el => el.remove());

                    // Auto-copy question prompt in background as seamless backup for the student
                    copyQuestionWithOptionalImage(firstBlockedQue, aiPromptText).catch(() => {});

                    const courseInfo = detectCourseInfo();
                    const courseCode = courseInfo.subjectCode || '';
                    const promptText = buildGeminiCompactPrompt(qData, courseCode, firstBlockedQue);

                    await handleGeminiQuestionInference({
                        que: firstBlockedQue,
                        qData: qData,
                        promptText: promptText,
                        onSuccess: async (matched) => {
                            if (matched && matched.choiceText) {
                                recordAttemptAnswerEvidence(firstBlockedQue, matched.choiceText, 'ai_inference');
                            }
                            // Ensure blockage HUD is removed upon successful AI resolution
                            firstBlockedQue.querySelectorAll('.amaes-blockage-hud, .amaes-unanswered-hint').forEach(el => el.remove());
                            firstBlockedQue.querySelectorAll('.amaes-que-top-toolbar').forEach(toolbar => {
                                toolbar.style.display = 'flex';
                            });
                            firstBlockedQue.style.outline = '2px solid rgba(139, 92, 246, 0.7)';
                            firstBlockedQue.style.borderRadius = '8px';
                            setQuestionAiTag(firstBlockedQue, true);
                            if (aiAutoSelect && matched && matched.input) {
                                const anyChecked = Boolean(firstBlockedQue.querySelector('.answer input[type="radio"]:checked, .answer input[type="checkbox"]:checked'));
                                if (!anyChecked) {
                                    matched.input.checked = true;
                                    matched.input.click();
                                    if (matched.input.parentElement) matched.input.parentElement.click();
                                    matched.input.dispatchEvent(new Event('input', { bubbles: true }));
                                    matched.input.dispatchEvent(new Event('change', { bubbles: true }));
                                }
                                showToast(`Gemini selected a choice for #${qData ? qData.qNum : ''}. (Paused for review)`, 3000);
                                setLog(`[AI Suggestion] Gemini selected <b>${escapeHtml(matched.choiceText)}</b> for #${qData ? qData.qNum : ''}. (Prompt copied) Paused for review—press <b>N</b> or click Next page when ready.`, "var(--accent-purple)");
                            } else {
                                showToast(`Gemini suggested an answer for #${qData ? qData.qNum : ''} (Paused for review)`, 3000);
                                setLog(`[AI Suggestion] Gemini suggested <b>${escapeHtml(matched ? matched.choiceText : '')}</b> for #${qData ? qData.qNum : ''}. (Prompt copied) Paused for review—click to select and proceed.`, "var(--accent-purple)");
                            }
                            // Feature 2: Auto-Advance after AI answer if setting is enabled
                            if (aiAutoNextOnAiAnswer || autoNextVerified) {
                                scheduleAutoNextAfterAnswer(800, false, firstBlockedQue, aiAutoNextOnAiAnswer);
                            }
                            if (typeof updateQuestionAiDrawerState === 'function') {
                                updateQuestionAiDrawerState(firstBlockedQue, false);
                            }
                        }
                    });

                    // If AI successfully resolved and highlighted a choice, finish here without showing redundant blockage HUD!
                    if (firstBlockedQue.querySelector('.amaes-ai-suggested-choice')) {
                        isSolverRunning = false;
                        return;
                    }
                } else {
                    // Copy question for AI helper
                    copyQuestionWithOptionalImage(firstBlockedQue, aiPromptText).then((res) => {
                        showToast(res && res.withImage ? `Visual snippet & Question #${qData ? qData.qNum : ''} copied to clipboard!` : `Question #${qData ? qData.qNum : ''} copied to clipboard — ready to paste!`, 3000);
                    }).catch(() => {});
                }

                // If reaching here: either question is ineligible for AI (e.g. text/drag), AI is not enabled, or AI failed
                firstBlockedQue.dataset.amaesAiFailed = 'true';
                if (typeof updateQuestionAiDrawerState === 'function') {
                    updateQuestionAiDrawerState(firstBlockedQue, true);
                }
                setLog(
                    `<b>Question #${qData ? qData.qNum : ''} Auto-Copied:</b> Prompt copied to clipboard. ` +
                    `Paste from AI (press <b>V</b>) or select manually, then press <b>N</b> or click <b>Next page</b> to proceed.`,
                    "var(--accent-amber)"
                );

                if (!firstBlockedQue.querySelector('.amaes-blockage-hud')) {
                    // The solver HUD is the full unknown-answer notice. Remove
                    // the compact matcher hint so the same warning is not shown twice.
                    firstBlockedQue.querySelectorAll('.amaes-unanswered-hint').forEach(hint => hint.remove());
                    setQuestionAiTag(firstBlockedQue, false);
                    if (!firstBlockedQue.dataset.amaesInterventionAlertPlayed) {
                        firstBlockedQue.dataset.amaesInterventionAlertPlayed = 'true';
                        playToolkitSound('manual_intervention');
                    }

                    const hud = document.createElement('div');
                    hud.className = 'amaes-blockage-hud';
                    hud.style.cssText = `
                        margin-bottom: 14px;
                        padding: 10px 14px;
                        background: #fffbeb;
                        border: 1.5px solid #f59e0b;
                        border-radius: 8px;
                        font-size: 11.5px;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 12px;
                        color: #78350f;
                        box-shadow: 0 2px 5px rgba(245, 158, 11, 0.08);
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        line-height: 1.4;
                        box-sizing: border-box;
                    `;

                    hud.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 200px;">
                            <span style="background: #f59e0b; color: #ffffff; padding: 3px 8px; border-radius: 5px; font-weight: 800; font-size: 10px; letter-spacing: 0.5px; flex-shrink: 0;">WAITING FOR ANSWER</span>
                            <div>
                                <div style="font-weight: 700; color: #92400e; font-size: 12px; margin-bottom: 2px;">Question #${qData ? qData.qNum : ''}: No saved answer yet (Auto-copied to clipboard)</div>
                                <div style="color: #b45309; font-size: 11px; line-height: 1.45;">
                                    <div><strong>1. Answer:</strong> Pick a choice, or paste an AI answer (press <b>V</b> to paste)</div>
                                    <div><strong>2. Continue:</strong> Click <b>Next page</b> or press <b>N</b> to proceed</div>
                                </div>
                            </div>
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                            <button id="btn-blockage-ask-ai" type="button" class="amaes-inline-btn" style="
                                padding: 4px 10px;
                                font-size: 11px;
                                font-weight: 700;
                                background: #f5f3ff;
                                color: #7c3aed;
                                border: 1px solid #c4b5fd;
                                border-radius: 6px;
                                cursor: pointer;
                                display: inline-flex;
                                align-items: center;
                                gap: 4px;
                                transition: all 0.15s ease;
                            " title="Ask Google Gemini AI to analyze and solve this question directly">
                                ${ICONS.sparkles} <span>${firstBlockedQue.dataset.amaesAiAttempted ? 'Retry AI' : 'Ask AI'}</span>
                            </button>
                            <button id="btn-blockage-stop" type="button" class="amaes-inline-btn" style="
                                padding: 4px 10px;
                                font-size: 11px;
                                font-weight: 700;
                                background: ${autoQuizMode ? '#fee2e2' : '#dcfce7'};
                                color: ${autoQuizMode ? '#b91c1c' : '#15803d'};
                                border: 1px solid ${autoQuizMode ? '#f87171' : '#86efac'};
                                border-radius: 6px;
                                cursor: pointer;
                                display: inline-flex;
                                align-items: center;
                                gap: 4px;
                                transition: all 0.15s ease;
                            " title="${autoQuizMode ? 'Stop automation so you can answer manually without any script interference' : 'Resume Auto-Quiz'}">
                                ${autoQuizMode ? ICONS.stop : ICONS.play} <span>${autoQuizMode ? 'Stop Auto' : 'Resume Auto'}</span>
                            </button>
                        </div>
                    `;

                    const formulation = firstBlockedQue.querySelector('.formulation, .content') || firstBlockedQue;
                    formulation.insertBefore(hud, formulation.firstChild);

                    const blockageAskAi = hud.querySelector('#btn-blockage-ask-ai');
                    if (blockageAskAi) {
                        blockageAskAi.onclick = async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            await manualSolveWithAi(firstBlockedQue, blockageAskAi);
                        };
                    }

                    const blockageStop = hud.querySelector('#btn-blockage-stop');
                    if (blockageStop) {
                        blockageStop.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleAutoQuizMode();
                        };
                    }
                }

                // Listen for user selecting or typing a choice: show visual confirmation, DO NOT auto-next by default
                const inputElements = firstBlockedQue.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="text"], select, .draghome, .drop, input.placeinput');
                const onUserPickedChoice = () => {
                    const selectedInput = firstBlockedQue.querySelector('.answer input[type="radio"]:checked, .answer input[type="checkbox"]:checked');
                    const selectedLabel = selectedInput && (selectedInput.closest('label') || selectedInput.parentElement);
                    const selectedText = selectedLabel ? cleanDOMToAI(selectedLabel).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim() : '';
                    const textInput = firstBlockedQue.querySelector('input[type="text"].form-control, input.form-control, textarea');
                    const selectInput = firstBlockedQue.querySelector('select');
                    const selectedOption = selectInput && selectInput.options[selectInput.selectedIndex];
                    recordAttemptAnswerEvidence(
                        firstBlockedQue,
                        selectedText || (textInput && textInput.value) || (selectedOption && selectedOption.text) || '',
                        'manual_selection'
                    );
                    firstBlockedQue.style.outline = '2px solid #10b981';
                    const hud = firstBlockedQue.querySelector('.amaes-blockage-hud');
                    const allAnswered = areAllPageQuestionsAnswered();
                    const isMultiQuestionPage = queContainers && queContainers.length > 1;

                    if (hud) {
                        hud.style.borderColor = '#10b981';
                        hud.style.background = '#ecfdf5';
                        hud.style.color = '#065f46';

                        let hintMsg = '';
                        if (!allAnswered && isMultiQuestionPage) {
                            hintMsg = 'Answer recorded! Scroll down to continue answering remaining questions.';
                        } else if (autoNextQuiz && autoQuizMode) {
                            hintMsg = 'Advancing automatically...';
                        } else if (allAnswered && isMultiQuestionPage) {
                            hintMsg = 'All questions answered! Review choices and click <b>Finish attempt</b> when ready.';
                        } else {
                            hintMsg = 'Review your answer, then press <b>N</b> or click <b>Next page</b> below to proceed.';
                        }

                        hud.innerHTML = `
                            <div style="display: flex; align-items: center; gap: 10px; flex: 1; min-width: 200px;">
                                <span style="background: #10b981; color: #ffffff; padding: 3px 8px; border-radius: 5px; font-weight: 800; font-size: 10px;">READY</span>
                                <div>
                                    <div style="font-weight: 700; color: #065f46;">Answer recorded!</div>
                                    <div style="color: #047857; font-size: 11px;">${hintMsg}</div>
                                </div>
                            </div>
                        `;
                    }

                    if (!allAnswered && isMultiQuestionPage && autoQuizMode && autoNextQuiz) {
                        scheduleAutoNextAfterAnswer(800, true, firstBlockedQue);
                    } else if (!allAnswered && isMultiQuestionPage) {
                        showToast("Answer recorded! Continue with next questions below.", 2200);
                        setLog(`Answer recorded for <b>Question #${qData ? qData.qNum : ''}</b>! Continue answering remaining questions below.`, "var(--accent-green)");
                    } else if (autoNextQuiz && autoQuizMode) {
                        scheduleAutoNextAfterAnswer(800, true);
                    } else if (allAnswered && isMultiQuestionPage) {
                        showToast("All questions answered! Review before finishing.", 3000);
                        setLog("<b>All questions on page answered!</b> Review before clicking <b>Finish attempt</b>.", "var(--accent-green)");
                    } else {
                        showToast("Answer recorded! Press N or click Next page when ready.", 2500);
                        setLog("Answer entered! Press <b>N</b> or click <b>Next page</b> below to proceed (Auto-Quiz remains active).", "var(--accent-green)");
                    }
                };

                inputElements.forEach(inp => {
                    inp.addEventListener('change', onUserPickedChoice);
                    inp.addEventListener('click', onUserPickedChoice);
                    if (inp.type === 'text') {
                        inp.addEventListener('blur', onUserPickedChoice);
                    }
                });

                isSolverRunning = false;
                return;
        } catch (err) {
            logDebug(`Auto-Solver Error: ${err.message}`);
            console.error("Auto-Solver Exception:", err);
        } finally {
            setTimeout(() => { isSolverRunning = false; }, 1200);
        }
    }

    // Auto-Mark as Done / Submit Handler for Quiz Summary Page (/mod/quiz/summary.php)
    function handleQuizSummaryAutoSubmit() {
        if (!checkIsQuizSummaryPage()) return;
        promoteAttemptEvidenceFromScore();
        if (!sessionStorage.getItem('amaes_summary_ding_' + window.location.href)) {
            sessionStorage.setItem('amaes_summary_ding_' + window.location.href, 'true');
            playToolkitSound('quest_done');
        }
        logDebug("Quiz Summary reached. Student reviews at their own pace (Auto-submit disabled by design).");
    }

    // Unified Synchronizer for UI states (Floating HUD + Panel Button)
    function syncAutoQuizUI(isPausedOnUnknown = false) {
        const btnMasterAutoQuiz = document.getElementById('btn-master-auto-quiz');
        if (btnMasterAutoQuiz) {
            if (isPausedOnUnknown || isWaitingForUserAnswer || (checkIsQuizAttemptPage() && document.querySelector('.amaes-blockage-hud'))) {
                btnMasterAutoQuiz.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                btnMasterAutoQuiz.innerHTML = `${ICONS.zap} <span>Waiting on Q (Press N)</span>`;
            } else if (autoQuizMode) {
                btnMasterAutoQuiz.style.background = 'linear-gradient(135deg, #ef4444, #dc2626)';
                btnMasterAutoQuiz.innerHTML = `${ICONS.stop} <span>Pause Auto-Quiz</span>`;
            } else {
                btnMasterAutoQuiz.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                btnMasterAutoQuiz.innerHTML = `${ICONS.zap} <span>Start Auto-Quiz</span>`;
            }
        }

        const subtext = document.getElementById('amaes-autoquiz-subtext');
        if (subtext) {
            if (isPausedOnUnknown || isWaitingForUserAnswer || (checkIsQuizAttemptPage() && document.querySelector('.amaes-blockage-hud'))) {
                subtext.textContent = 'Paused on unknown question. Answer or press N to continue.';
            } else if (autoQuizMode) {
                subtext.textContent = 'Auto-answering & advancing in background. Click to pause.';
            } else {
                subtext.textContent = 'Auto-answers & advances. Pauses & copies on unknown questions.';
            }
        }

        const bgNoticeDot = document.getElementById('amaes-autoquiz-bg-dot');
        const bgNoticeText = document.getElementById('amaes-autoquiz-bg-text');
        if (bgNoticeDot && bgNoticeText) {
            if (autoQuizMode) {
                bgNoticeDot.style.background = 'var(--accent-green, #10b981)';
                bgNoticeDot.style.boxShadow = '0 0 6px #10b981';
                bgNoticeText.textContent = 'Active in background (safe to switch tabs/apps)';
            } else {
                bgNoticeDot.style.background = 'var(--text-muted, #94a3b8)';
                bgNoticeDot.style.boxShadow = 'none';
                bgNoticeText.textContent = 'Runs while multitasking in other windows';
            }
        }

        const existingHud = document.getElementById('amaes-quiz-hud');
        if (existingHud) {
            existingHud.remove();
        }
        if (checkIsQuizAttemptPage()) {
            injectQuizFloatingHUD();
        }

        // Sync all in-question top toolbar stop/resume buttons
        document.querySelectorAll('.amaes-que-stop-btn').forEach(btn => {
            if (autoQuizMode) {
                btn.innerHTML = `${ICONS.stop} <span>Stop Auto (Manual)</span>`;
                btn.style.background = 'rgba(239, 68, 68, 0.1)';
                btn.style.color = '#ef4444';
                btn.style.border = '1px solid rgba(239, 68, 68, 0.35)';
                btn.title = 'Stop automation so you can answer manually without any interference';
            } else {
                btn.innerHTML = `${ICONS.play} <span>Resume Co-Pilot</span>`;
                btn.style.background = 'rgba(16, 185, 129, 0.1)';
                btn.style.color = '#10b981';
                btn.style.border = '1px solid rgba(16, 185, 129, 0.35)';
                btn.title = 'Resume autonomous quiz solver and auto-navigation';
            }
        });

        // Sync blockage HUD button
        const blockageStopBtn = document.getElementById('btn-blockage-stop');
        if (blockageStopBtn) {
            blockageStopBtn.innerHTML = `${autoQuizMode ? ICONS.stop : ICONS.play} <span>${autoQuizMode ? 'Stop Auto' : 'Resume Auto'}</span>`;
            blockageStopBtn.style.background = autoQuizMode ? '#fee2e2' : '#dcfce7';
            blockageStopBtn.style.color = autoQuizMode ? '#b91c1c' : '#15803d';
            blockageStopBtn.style.borderColor = autoQuizMode ? '#f87171' : '#86efac';
        }

        // Sync batch copy container visibility (only visible when questions are present)
        const batchCopyContainer = document.getElementById('amaes-batch-copy-container');
        if (batchCopyContainer) {
            const hasQue = checkIsQuizPage() && Boolean(document.querySelector('.que'));
            batchCopyContainer.style.display = hasQue ? 'flex' : 'none';
        }
    }

    // Master Toggle Function for Starting / Pausing Autonomous Quiz
    function toggleAutoQuizMode(desiredState = null) {
        if (desiredState !== null) {
            autoQuizMode = Boolean(desiredState);
        } else {
            autoQuizMode = !autoQuizMode;
        }
        localStorage.setItem('amaes_auto_quiz_mode', autoQuizMode ? 'true' : 'false');

        if (autoQuizMode) {
            isWaitingForUserAnswer = false;
            showToast("Auto-Quiz Started (Co-Pilot)");
            setLog("Auto-Quiz <b>started</b> in <b>Co-Pilot</b> mode!", "var(--accent-green)");
            if (checkIsQuizAttemptPage()) runAutoQuizSolver(true);
            if (checkIsQuizSummaryPage()) handleQuizSummaryAutoSubmit();
        } else {
            isWaitingForUserAnswer = false;
            clearTimeout(autoNextTimer);
            autoNextTimer = null;
            clearTimeout(pageLoadSolverTimer);
            pageLoadSolverTimer = null;
            isSolverRunning = false;
            if (activeAiAbortController) {
                try { activeAiAbortController.abort(); } catch (_) {}
                activeAiAbortController = null;
            }
            document.querySelectorAll('.amaes-ai-thinking-indicator').forEach(el => el.remove());
            showToast("Auto-Quiz Paused");
            setLog("Auto-Quiz <b>paused</b>. Auto-answers & auto-navigation completely stopped.", "var(--accent-amber)");
        }

        syncAutoQuizUI();
    }

    // Floating HUD for Quiz Attempt Screen
    function injectQuizFloatingHUD() {
        if (localStorage.getItem('amaes_terms_acknowledged') !== 'true') return;
        if (!checkIsQuizAttemptPage()) return;
        if (document.getElementById('amaes-quiz-hud')) return;

        const courseInfo = detectCourseInfo();
        const subCode = courseInfo.subjectCode || 'CS6301';
        const detectedQuizTerm = detectTermFromText(courseInfo.currentActivityTitle || document.title || '');
        const cached = getCachedAnswers(subCode);
        const hasDb = cached && cached.length > 0;
        const verifiedCount = cached ? cached.filter(q => q.ansRaw || q.answer).length : 0;
        const eliminatedCount = cached ? cached.reduce((acc, q) => acc + (Array.isArray(q.wrongAnswers) ? q.wrongAnswers.length : 0), 0) : 0;
        const termStats = getSubjectTermBreakdown(subCode);
        const termCount = detectedQuizTerm === 'Prelim' ? termStats.prelim :
                          detectedQuizTerm === 'Midterm' ? termStats.midterm :
                          detectedQuizTerm === 'Prefi' ? termStats.prefi :
                          detectedQuizTerm === 'Final' ? termStats.final : 0;
        const navState = getQuizNavQuestionStates();

        const hud = document.createElement('div');
        hud.id = 'amaes-quiz-hud';
        hud.style.cssText = `
            position: fixed;
            bottom: 22px;
            left: 22px;
            z-index: 99998;
            background: var(--surface, #1e293b);
            border: 1.5px solid ${autoQuizMode ? '#3b82f6' : 'var(--border, #334155)'};
            border-radius: 30px;
            padding: 6px 14px;
            box-shadow: 0 6px 24px rgba(0,0,0,0.45);
            display: flex;
            align-items: center;
            gap: 10px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            color: var(--text-primary, #f8fafc);
            backdrop-filter: blur(8px);
        `;

        hud.innerHTML = `
            <!-- Auto-Quiz Status -->
            <div style="display: flex; align-items: center; gap: 6px;">
                <span id="hud-pulse-dot" style="width: 8px; height: 8px; border-radius: 50%; background: ${!autoQuizMode ? '#64748b' : (isWaitingForUserAnswer ? '#f59e0b' : '#3b82f6')}; box-shadow: 0 0 8px ${!autoQuizMode ? 'transparent' : (isWaitingForUserAnswer ? '#f59e0b' : '#3b82f6')};"></span>
                <span style="font-weight: 700;">Auto-Quiz:</span>
                <span id="hud-mode-text" style="color: ${!autoQuizMode ? '#94a3b8' : (isWaitingForUserAnswer ? 'var(--accent-amber, #f59e0b)' : 'var(--accent-blue, #3b82f6)')}; font-weight: 700;">
                    ${!autoQuizMode ? 'Paused' : (isWaitingForUserAnswer ? 'Waiting on Q' : 'Co-Pilot')}
                </span>
            </div>

            <!-- Course Database Badge -->
            <div id="hud-db-indicator" style="
                background: ${hasDb ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'};
                color: ${hasDb ? '#10b981' : '#f87171'};
                border: 1px solid ${hasDb ? '#10b981' : '#f87171'};
                padding: 2px 7px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 700;
                display: flex;
                align-items: center;
                gap: 4px;
            " title="${hasDb ? `${subCode} DB: ${verifiedCount} total verified answers & ${eliminatedCount} eliminated choices stored${detectedQuizTerm ? ` (${termCount} for ${detectedQuizTerm})` : ''}` : `No database answers found for ${subCode}`}">
                <span>${hasDb ? 'DB' : 'No DB'}</span>
                <span>${subCode}${detectedQuizTerm ? ` • ${detectedQuizTerm}` : ''}</span>
                <span>(${termCount > 0 ? `${termCount} Qs` : `${verifiedCount} Qs`}${eliminatedCount > 0 ? ` • ${eliminatedCount} Elim` : ''})</span>
            </div>

            <!-- Pause / Resume Button -->
            <button id="btn-hud-toggle-quiz" class="amaes-inline-btn" style="padding: 3px 10px; font-size: 10px; background: ${autoQuizMode ? 'rgba(239,68,68,0.25); color:#ef4444; border:1px solid #ef4444' : 'rgba(16,185,129,0.25); color:#10b981; border:1px solid #10b981'}; border-radius: 12px; cursor: pointer; font-weight: 600;">
                ${autoQuizMode ? 'Pause' : 'Resume Auto-Quiz'}
            </button>

            <!-- Toggle Toolkit Panel -->
            <button id="btn-hud-expand-panel" class="amaes-inline-btn" style="padding: 3px 8px; font-size: 10px; background: rgba(255,255,255,0.08); color: #cbd5e1; border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; cursor: pointer;" title="Toggle Full Toolkit Panel">
                ${ICONS.minimize} <span>Panel</span>
            </button>

            <!-- Persistent Update Indicator -->
            <a id="hud-update-indicator" href="${SCRIPT_RAW_URL}" target="_blank" rel="noopener noreferrer" style="
                display: ${(localStorage.getItem('amaes_latest_version_seen') && isNewerVersion(localStorage.getItem('amaes_latest_version_seen'), SCRIPT_VERSION)) ? 'inline-flex' : 'none'};
                align-items: center;
                gap: 4px;
                background: linear-gradient(135deg, #10b981, #059669);
                color: #ffffff !important;
                padding: 2px 9px;
                border-radius: 12px;
                font-size: 10px;
                font-weight: 800;
                text-decoration: none;
                animation: amaesPulse 2s infinite;
            " title="Toolkit Update Available! Click to update now">
                ${ICONS.download} <span>Update Now</span>
            </a>
        `;

        document.body.appendChild(hud);

        const _el__btn_hud_toggle_quiz_ = document.getElementById('btn-hud-toggle-quiz');
        if (_el__btn_hud_toggle_quiz_) _el__btn_hud_toggle_quiz_.onclick = () => {;
            toggleAutoQuizMode();
        };

        const hudPanelBtn = document.getElementById('btn-hud-expand-panel');
        if (hudPanelBtn) {
            hudPanelBtn.onclick = () => {
                const bodyEl = document.getElementById('amaes-panel-body');
                const minBtn = document.getElementById('amaes-min-btn');
                if (!bodyEl) return;
                const isHidden = bodyEl.style.display === 'none';
                bodyEl.style.display = isHidden ? 'block' : 'none';
                if (minBtn) minBtn.innerHTML = isHidden ? ICONS.minimize : `
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                        <rect x="3" y="3" width="18" height="18" rx="2"/>
                    </svg>
                `;
            };
        }
    }

    // Auto-select choice based on AI answer from clipboard (Shortcut: V or Button)
    async function autoSelectFromAiClipboard(explicitQue = null) {
        if (!navigator.clipboard || !navigator.clipboard.readText) {
            showToast("Clipboard reading not supported in this browser");
            return;
        }
        try {
            const text = await navigator.clipboard.readText();
            if (!text || !text.trim()) {
                showToast("Clipboard is empty. Copy the AI answer first.");
                return;
            }
            const targetQue = explicitQue || getActiveViewportQuestion();
            if (!targetQue) {
                showToast("No quiz question found on page");
                return;
            }

            const cleanText = text.trim();
            const inputElements = Array.from(targetQue.querySelectorAll('.answer input[type="radio"], .answer input[type="checkbox"]'));
            if (inputElements.length === 0) {
                // Check for Short-Answer or fill-in-the-blank text inputs
                const textInputs = Array.from(targetQue.querySelectorAll('input[type="text"], input.form-control, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="reset"])'));
                if (textInputs.length > 0) {
                    const cleanedAnswer = cleanText
                        .replace(/^Answer:\s*/i, '')
                        .replace(/^The correct answer is:\s*/i, '')
                        .replace(/^[a-e][.)]\s*/i, '')
                        .replace(/^["']|["']$/g, '')
                        .trim();
                    textInputs[0].value = cleanedAnswer;
                    textInputs[0].dispatchEvent(new Event('input', { bubbles: true }));
                    textInputs[0].dispatchEvent(new Event('change', { bubbles: true }));
                    textInputs[0].dispatchEvent(new Event('blur', { bubbles: true }));
                    showToast(`Pasted to Text Box: ${cleanedAnswer}`);
                    setLog(`AI Paste: Filled text input with <b>${cleanedAnswer}</b>`, "var(--accent-green)");
                    if (autoNextQuiz) {
                        scheduleAutoNextAfterAnswer(1000, true);
                    }
                    return;
                }

                // Check for Dropdown / Select elements (matching questions & gapselect)
                const selectInputs = Array.from(targetQue.querySelectorAll('select'));
                if (selectInputs.length > 0) {
                    const cleanedAnswer = cleanText
                        .replace(/^Answer:\s*/i, '')
                        .replace(/^The correct answer is:\s*/i, '')
                        .replace(/^["']|["']$/g, '')
                        .trim();
                    let selectedCount = 0;
                    selectInputs.forEach((sel, sIdx) => {
                        const row = sel.closest('tr');
                        const rowTextElem = row ? row.querySelector('td.text') : null;
                        const subQText = rowTextElem ? rowTextElem.innerText.trim() : '';

                        // Look for sub-question matching in lines of clipboard text
                        let targetAns = '';
                        if (subQText) {
                            const lines = cleanedAnswer.split(/[\n,;]+/).map(l => l.trim());
                            for (const line of lines) {
                                const subNorm = normalizeText(subQText);
                                const lineNorm = normalizeText(line);
                                if (lineNorm.includes(subNorm)) {
                                    const parts = line.split(/[:\->=]+/);
                                    if (parts.length >= 2) {
                                        targetAns = parts.slice(1).join(':').trim();
                                        break;
                                    }
                                }
                            }
                        }

                        const options = Array.from(sel.options);
                        const matchOpt = options.find(opt => {
                            if (!opt.value || opt.value === '0' || opt.text.toLowerCase().includes('choose')) return false;
                            const optNorm = normalizeText(opt.text);
                            if (targetAns) {
                                const tNorm = normalizeText(targetAns);
                                if (optNorm === tNorm || optNorm.includes(tNorm) || tNorm.includes(optNorm)) return true;
                            }
                            const cleanNorm = normalizeText(cleanedAnswer);
                            return optNorm === cleanNorm || (cleanNorm.length > 2 && optNorm.includes(cleanNorm)) || (optNorm.length > 2 && cleanNorm.includes(optNorm));
                        });

                        if (matchOpt) {
                            sel.value = matchOpt.value;
                            sel.dispatchEvent(new Event('input', { bubbles: true }));
                            sel.dispatchEvent(new Event('change', { bubbles: true }));
                            sel.dispatchEvent(new Event('blur', { bubbles: true }));
                            selectedCount++;
                        }
                    });

                    if (selectedCount > 0) {
                        showToast(`Pasted to Dropdown: Selected ${selectedCount} option(s)`);
                        setLog(`AI Paste: Selected <b>${selectedCount}</b> dropdown option(s) from clipboard`, "var(--accent-green)");
                        if (autoNextQuiz) {
                            scheduleAutoNextAfterAnswer(1000, true);
                        }
                        return;
                    }
                }

                // Check for Drag and Drop questions (ddwtos, ddimageortext, ddmarker)
                const dragHomes = Array.from(targetQue.querySelectorAll('.draghome, .dragitems .draghome, .drags .drag, .drags span, span.draghome, .dragboxes .drag, .dragitem'));
                const dropZones = Array.from(targetQue.querySelectorAll('.drop, .dropzone, span.droptarget, .droppable'));
                if (dragHomes.length > 0 && dropZones.length > 0) {
                    const cleanedAnswer = cleanText
                        .replace(/^Answer:\s*/i, '')
                        .replace(/^The correct answer is:\s*/i, '')
                        .replace(/^["']|["']$/g, '')
                        .trim();

                    // Extract answers per blank
                    let answersForBlanks = [];
                    const blankMatches = cleanedAnswer.match(/Blank\s*\d+\s*[:\-–]\s*([^\n,;]+)/gi);
                    if (blankMatches && blankMatches.length > 0) {
                        answersForBlanks = blankMatches.map(m => m.replace(/Blank\s*\d+\s*[:\-–]\s*/i, '').trim());
                    } else if (cleanedAnswer.includes('\n')) {
                        answersForBlanks = cleanedAnswer.split('\n').map(l => l.replace(/^[a-z0-9][.)]\s*/i, '').trim()).filter(Boolean);
                    } else if (cleanedAnswer.includes(',') && dropZones.length > 1) {
                        answersForBlanks = cleanedAnswer.split(',').map(s => s.trim()).filter(Boolean);
                    } else {
                        answersForBlanks = [cleanedAnswer];
                    }

                    let placedCount = 0;
                    dropZones.forEach((dz, idx) => {
                        const ans = answersForBlanks[idx] || (dropZones.length === 1 ? answersForBlanks[0] : null);
                        if (!ans) return;

                        const normAns = normalizeChoice(ans);
                        const matchingDrag = dragHomes.find(dh => {
                            const dText = normalizeChoice(cleanDOMToAI(dh));
                            return dText === normAns || (normAns.length > 1 && dText.includes(normAns)) || (dText.length > 1 && normAns.includes(dText));
                        });

                        if (matchingDrag) {
                            const hiddenInput = targetQue.querySelector(`input.placeinput.place${idx + 1}, input[name$="_p${idx + 1}"], input[name*="_p${idx + 1}"]`) || targetQue.querySelectorAll('input.placeinput, input[type="hidden"][name*="_p"]')[idx];
                            const choiceClass = Array.from(matchingDrag.classList).find(c => /^(?:choice|c)(\d+)$/i.test(c));
                            let choiceNum = choiceClass ? choiceClass.replace(/^[^\d]+/, '') : String(dragHomes.indexOf(matchingDrag) + 1);

                            if (hiddenInput && choiceNum) {
                                hiddenInput.value = choiceNum;
                                hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
                                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                                hiddenInput.dispatchEvent(new Event('blur', { bubbles: true }));
                            }

                            matchingDrag.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                            dz.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                            dz.innerText = ans;
                            dz.style.outline = '2px solid #10b981';
                            dz.style.fontWeight = '700';
                            placedCount++;
                        }
                    });

                    if (placedCount > 0) {
                        showToast(`Pasted to Drag & Drop: Placed ${placedCount} item(s)`);
                        setLog(`AI Paste: Placed <b>${placedCount}</b> drag-and-drop item(s) from clipboard`, "var(--accent-green)");
                        if (autoNextQuiz) {
                            scheduleAutoNextAfterAnswer(1000, true);
                        }
                        return;
                    }
                }

                showToast("No answer inputs found for this question");
                return;
            }

            const isCheckbox = targetQue.querySelectorAll('.answer input[type="checkbox"]').length > 0;

            // 1. Multi-letter matching for multi-choice checkbox questions (e.g. "a, c", "a and d", "A, B, C")
            const multiLetters = cleanText.match(/\b([a-dA-D])\b/g);
            if (isCheckbox && multiLetters && multiLetters.length > 1) {
                const uniqueLetters = Array.from(new Set(multiLetters.map(l => l.toUpperCase())));
                let checkedCount = 0;
                uniqueLetters.forEach(letter => {
                    const idx = letter.charCodeAt(0) - 65;
                    if (inputElements[idx]) {
                        if (!inputElements[idx].checked) {
                            inputElements[idx].click();
                        }
                        checkedCount++;
                    }
                });
                if (checkedCount > 0) {
                    showToast(`Auto-selected Options ${uniqueLetters.join(', ')} from AI clipboard`);
                    setLog(`AI Paste: Selected multiple choices <b>${uniqueLetters.join(', ')}</b>`, "var(--accent-green)");
                    if (autoNextQuiz) {
                        scheduleAutoNextAfterAnswer(1200, true);
                    }
                    return;
                }
            }

            // 2. Direct single letter matching: Look for option letter (A, B, C, D)
            const matchLetter = cleanText.match(/(?:^|\b)(?:answer|option|choice|the correct answer is)?\s*[:\-–*]*\s*([a-dA-D])(?:\.|\)|:|\s|$)/i);
            if (matchLetter && matchLetter[1]) {
                const letter = matchLetter[1].toUpperCase();
                const idx = letter.charCodeAt(0) - 65;
                if (inputElements[idx]) {
                    inputElements[idx].click();
                    showToast(`Auto-selected Option ${letter} from AI clipboard`);
                    setLog(`AI Paste: Selected Option <b>${letter}</b> from clipboard`, "var(--accent-green)");
                    if (autoNextQuiz) {
                        scheduleAutoNextAfterAnswer(isCheckbox ? 1200 : 800, true);
                    }
                    return;
                }
            }

            // 2. Fuzzy text matching: match clipboard text with choice labels
            const normClip = normalizeText(cleanText);
            let bestInput = null;
            let bestScore = 0;
            let bestLabel = '';

            inputElements.forEach((inp, idx) => {
                const container = inp.closest('div, li, label') || inp.parentElement;
                const choiceText = container ? container.innerText.trim() : '';
                const normChoice = normalizeText(choiceText);
                if (!normChoice) return;

                if (normClip.includes(normChoice) || normChoice.includes(normClip)) {
                    if (normChoice.length > bestScore) {
                        bestScore = normChoice.length;
                        bestInput = inp;
                        bestLabel = String.fromCharCode(65 + idx);
                    }
                } else {
                    const cWords = normChoice.split(/\s+/).filter(w => w.length > 2);
                    const matchedWords = cWords.filter(w => normClip.includes(w));
                    const score = matchedWords.length / Math.max(1, cWords.length);
                    if (score > 0.6 && score > bestScore) {
                        bestScore = score;
                        bestInput = inp;
                        bestLabel = String.fromCharCode(65 + idx);
                    }
                }
            });

            if (bestInput) {
                bestInput.click();
                showToast(`Auto-selected ${bestLabel} from AI text match`);
                setLog(`AI Paste: Auto-matched choice <b>${bestLabel}</b> from clipboard`, "var(--accent-green)");
                if (autoNextQuiz) {
                    scheduleAutoNextAfterAnswer(800, true);
                }
            } else {
                showToast("Could not match AI response to any option. Select manually.");
                setLog("AI Paste: Clipboard did not clearly match any choice.", "var(--accent-amber)");
            }
        } catch (err) {
            logDebug("Clipboard read error: " + err);
            showToast("Clipboard access denied or unavailable");
        }
    }

    // Toggleable Keyboard Navigation & Fast Shortcuts for Quiz
    function setupQuizKeyboardShortcuts() {
        window.addEventListener('keydown', (e) => {
            if (!enableKeyboardShortcuts) return;

            // Strict safety: ignore hotkeys ONLY when actively typing in text input fields (except Escape to dismiss modals)
            const active = document.activeElement;
            if (active) {
                const tag = active.tagName ? active.tagName.toUpperCase() : '';
                const type = active.type ? active.type.toLowerCase() : '';
                const isTextInput = (tag === 'INPUT' && !['radio', 'checkbox', 'button', 'submit', 'reset'].includes(type)) ||
                                    tag === 'TEXTAREA' ||
                                    active.isContentEditable;
                if (isTextInput && e.key !== 'Escape' && e.key !== 'Esc') return;
            }

            if (e.ctrlKey || e.altKey || e.metaKey) return;

            // Global Escape Handler: First press closes open Help/Contribute modal, subsequent press minimizes/toggles toolkit panel
            if (e.key === 'Escape' || e.key === 'Esc') {
                const welcomeModal = document.getElementById('amaes-welcome-modal');
                const contributeModal = document.getElementById('amaes-contribute-modal');
                const devModal = document.getElementById('amaes-dev-unlock-modal');
                const geminiModal = document.getElementById('amaes-gemini-modal');
                const bugModal = document.getElementById('amaes-bug-modal');
                if (welcomeModal || contributeModal || devModal || geminiModal || bugModal) {
                    e.preventDefault();
                    if (active && typeof active.blur === 'function') active.blur();
                    if (welcomeModal) welcomeModal.remove();
                    if (contributeModal) contributeModal.remove();
                    if (devModal) devModal.remove();
                    if (geminiModal) geminiModal.remove();
                    if (bugModal) bugModal.remove();
                    showToast("Closed Modal (Esc)");
                    setLog("Modal closed via <b>Esc</b> shortcut.", "var(--accent-blue)");
                    return;
                }

                // If no modal open, minimize or expand the toolkit panel
                const bodyEl = document.getElementById('amaes-panel-body');
                const lockOverlay = document.getElementById('amaes-panel-lock-overlay');
                const minBtn = document.getElementById('amaes-min-btn');
                const isLocked = localStorage.getItem('amaes_terms_acknowledged') !== 'true';
                const targetEl = (isLocked && lockOverlay) ? lockOverlay : bodyEl;
                if (bodyEl) {
                    e.preventDefault();
                    if (active && typeof active.blur === 'function') active.blur();
                    if (targetEl && targetEl.style.display !== 'none') {
                        if (bodyEl) bodyEl.style.display = 'none';
                        if (lockOverlay) lockOverlay.style.display = 'none';
                        if (minBtn) {
                            minBtn.innerHTML = `
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                                </svg>
                            `;
                        }
                        localStorage.setItem('amaes_pref_minimized', 'true');
                        showToast("Toolkit Minimized (Esc)");
                        setLog("Toolkit panel <b>minimized</b> via <b>Esc</b> shortcut.", "var(--accent-blue)");
                    } else {
                        if (isLocked) {
                            if (lockOverlay) lockOverlay.style.display = 'flex';
                            if (bodyEl) bodyEl.style.display = 'none';
                        } else {
                            if (lockOverlay) lockOverlay.style.display = 'none';
                            if (bodyEl) bodyEl.style.display = 'block';
                        }
                        if (minBtn) minBtn.innerHTML = ICONS.minimize;
                        localStorage.setItem('amaes_pref_minimized', 'false');
                        showToast("Toolkit Expanded (Esc)");
                        setLog("Toolkit panel <b>expanded</b> via <b>Esc</b> shortcut.", "var(--accent-green)");
                    }
                    return;
                }
            }

            // Global Help & Shortcuts Cheatsheet: '?' (Shift+/) or 'K'
            if (e.key === '?' || (e.key === '/' && e.shiftKey) || e.key === 'k' || e.key === 'K') {
                e.preventDefault();
                showWelcomeOnboardingModal(true);
                setTimeout(() => {
                    const sec = document.getElementById('welcome-shortcuts-section');
                    if (sec) sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 80);
                showToast("Shortcuts Cheatsheet (?)");
                setLog("Keyboard shortcut triggered: <b>Shortcuts Cheatsheet (?)</b>", "var(--accent-blue)");
                return;
            }

            // Developer Diagnostic Console: Triple Backtick (```)
            if (e.key === '`' || e.code === 'Backquote') {
                if (document.getElementById('amaes-welcome-modal')) {
                    // Modal is open; handled exclusively by the modal's keydown listener to prevent double-toggle race conditions
                    return;
                }
                globalBacktickCount++;
                clearTimeout(globalBacktickTimer);
                globalBacktickTimer = setTimeout(() => { globalBacktickCount = 0; }, 1200);
                if (globalBacktickCount >= 3) {
                    globalBacktickCount = 0;
                    e.preventDefault();
                    toggleDeveloperConsole();
                    return;
                }
            }

            if (!checkIsQuizAttemptPage()) return;

            const key = e.key ? e.key.toUpperCase() : '';

            // 1. Next Page / Submit Navigation: 'N' or 'Space' or 'Enter'
            if (key === 'N' || key === ' ' || key === 'ENTER') {
                const nextBtn = findQuizNextButton();
                if (nextBtn) {
                    e.preventDefault();
                    if (active && typeof active.blur === 'function') {
                        active.blur();
                    }
                    showToast("Shortcut: Next Page");
                    setLog("Keyboard shortcut triggered: <b>Next Page</b>", "var(--accent-blue)");
                    nextBtn.click();
                }
                return;
            }

            // 2. Copy Current Question for AI: 'C'
            if (key === 'C') {
                const btnCopy = document.getElementById('btn-copy-curr-q');
                if (btnCopy) {
                    e.preventDefault();
                    btnCopy.click();
                } else {
                    const que = getActiveViewportQuestion();
                    if (que) {
                        e.preventDefault();
                        const text = formatQuestionForAI(que, aiPromptHint);
                        copyQuestionWithOptionalImage(que, text).then((res) => {
                            showToast(res && res.withImage ? "Shortcut: Visual snippet & question copied for AI" : "Shortcut: Question copied for AI");
                        }).catch(() => {});
                    }
                }
                return;
            }

            // 3. Paste AI Answer & Auto-Select: 'V'
            if (key === 'V') {
                e.preventDefault();
                autoSelectFromAiClipboard();
                return;
            }

            // 4. Pause / Start Auto-Quiz: 'P'
            if (key === 'P') {
                e.preventDefault();
                toggleAutoQuizMode();
                return;
            }

            // 5. Highlight Database Answers: 'H'
            if (key === 'H') {
                e.preventDefault();
                const courseInfo = detectCourseInfo();
                const subCode = courseInfo.subjectCode || 'CS6301';
                const cached = getCachedAnswers(subCode);
                if (cached && cached.length > 0) {
                    const res = highlightQuizAnswers(cached, false, true);
                    showToast(`Highlighted ${res.matched}/${res.total} questions!`);
                    setLog(`Shortcut [H]: Highlighted <b>${res.matched}/${res.total}</b> questions.`, "var(--accent-green)");
                } else if (typeof autoFetchCloudAnswersIfMissing === 'function') {
                    showToast("Checking cloud database for answers...");
                    autoFetchCloudAnswersIfMissing(subCode).then(ok => {
                        if (ok) {
                            const fresh = getCachedAnswers(subCode);
                            const res = highlightQuizAnswers(fresh, false, true);
                            showToast(`Highlighted ${res.matched}/${res.total} questions from cloud!`);
                        } else {
                            showToast(`No answers found in database for ${subCode}`);
                        }
                    });
                } else {
                    showToast(`No answers cached for ${subCode}`);
                }
                return;
            }

            // 6. Select Choice Option: 1-4 or A-D
            let optIndex = -1;
            if (key >= '1' && key <= '9') {
                optIndex = parseInt(key, 10) - 1;
            } else if (['A', 'B', 'C', 'D'].includes(key)) {
                optIndex = key.charCodeAt(0) - 65;
            }

            if (optIndex >= 0) {
                // Target question currently in view or first unanswered
                const targetQue = getActiveViewportQuestion();

                if (targetQue) {
                    const choices = Array.from(targetQue.querySelectorAll('.answer input[type="radio"], .answer input[type="checkbox"]'));
                    if (choices[optIndex]) {
                        e.preventDefault();
                        const isCheckbox = choices[optIndex].type === 'checkbox';
                        choices[optIndex].click();
                        const choiceLabel = key >= '1' && key <= '9' ? String.fromCharCode(65 + optIndex) : key;
                        showToast(`Shortcut: Selected Choice ${choiceLabel}`);
                        setLog(`Keyboard shortcut: Selected choice <b>${choiceLabel}</b>`, "var(--accent-blue)");
                        if (autoNextQuiz) {
                            scheduleAutoNextAfterAnswer(isCheckbox ? 1400 : 800, true);
                        }
                    }
                }
            }
        });
    }

    // Setup Passive User Action & Breadcrumb Listeners for Bug Reproduction
    function setupBreadcrumbListeners() {
        if (typeof document === 'undefined') return;

        document.addEventListener('click', (e) => {
            try {
                const target = e.target;
                if (!target) return;

                // 1. Toolkit button / control click
                const toolkitBtn = target.closest('#amaes-panel button, #amaes-panel a, #amaes-panel input, #amaes-panel select');
                if (toolkitBtn) {
                    const label = toolkitBtn.title || toolkitBtn.innerText || toolkitBtn.id || toolkitBtn.name || toolkitBtn.tagName;
                    recordBreadcrumb('user_ui', `Clicked toolkit control: ${String(label).trim().slice(0, 50)}`);
                    return;
                }

                // 2. Question option click (radio, checkbox, button inside .que)
                const que = target.closest('.que');
                if (que) {
                    const numElem = que.querySelector('.info .no, .qno');
                    const qNum = numElem ? numElem.innerText.replace(/\s+/g, ' ').trim() : 'Question';
                    if (target.matches('input[type="radio"], input[type="checkbox"]')) {
                        const optText = target.closest('.answer, label')?.innerText?.slice(0, 40) || target.value;
                        recordBreadcrumb('user_quiz', `Selected choice on ${qNum}`, String(optText).replace(/\s+/g, ' ').trim());
                    } else if (target.matches('button, a, .submitbtns input')) {
                        recordBreadcrumb('user_quiz', `Clicked button on ${qNum}: ${(target.value || target.innerText || '').slice(0, 30)}`);
                    }
                    return;
                }

                // 3. Navigation / Submission button click
                const navBtn = target.closest('.submitbtns input, #mod_quiz-next-nav, .mod_quiz-next-nav, a[href*="attempt.php"], a[href*="review.php"]');
                if (navBtn) {
                    const text = navBtn.value || navBtn.innerText || navBtn.title || 'Navigation';
                    recordBreadcrumb('navigation', `User clicked navigation: ${String(text).trim().slice(0, 40)}`);
                }
            } catch (_) {}
        }, true);

        document.addEventListener('change', (e) => {
            try {
                const target = e.target;
                if (!target) return;
                const que = target.closest('.que');
                if (que && target.matches('select')) {
                    const numElem = que.querySelector('.info .no, .qno');
                    const qNum = numElem ? numElem.innerText.replace(/\s+/g, ' ').trim() : 'Question';
                    const selectedText = target.options[target.selectedIndex]?.text || target.value;
                    recordBreadcrumb('user_quiz', `Selected dropdown option on ${qNum}`, String(selectedText).slice(0, 40));
                }
            } catch (_) {}
        }, true);
    }

    // Match questions & auto-highlight / auto-select on Moodle Quiz
    function highlightQuizAnswers(questionsDb, autoSelect = false, isManualSelect = false) {
        if (localStorage.getItem('amaes_terms_acknowledged') !== 'true') {
            return { matched: 0, total: 0, error: "Toolkit locked" };
        }
        if (!questionsDb || questionsDb.length === 0) {
            return { matched: 0, total: 0, error: "No cached questions found" };
        }

        const queContainers = document.querySelectorAll('.que');
        if (queContainers.length === 0) {
            return { matched: 0, total: 0, error: "Not on a quiz question page" };
        }

        let matchedCount = 0;

        // Never run highlightQuizAnswers on review pages (which already show students' answers, feedback, and keys).
        // Prevents injecting fill buttons, green borders, or contradictory suggestions over graded results.
        if (checkIsReviewPage()) {
            return { matched: 0, total: queContainers.length, isReview: true };
        }

        queContainers.forEach(que => {
            if (identifyQuestionType(que) === 'unknown') {
                recordUnknownQuestionType(que);
                return;
            }

            const qtextElem = que.querySelector('.qtext, .formulation .qtext');
            if (!qtextElem) return;

            // Clone qtext and remove input, select, textarea, drop zones, and badges so inline blanks match AMAUOED entries cleanly
            const qClone = qtextElem.cloneNode(true);
            qClone.querySelectorAll('input, select, textarea, .drop, .draghome, .drags, .amaes-shortans-hint, .amaes-select-hint, .amaes-drag-hint, .amaes-unanswered-hint, .amaes-verified-badge, .amaes-probability-hint, .amaes-review-status-pill, .amaes-review-outcome-banner, .amaes-que-top-toolbar, .amaes-que-stop-btn, .amaes-ai-question-tag').forEach(el => el.remove());
            const moodleQRaw = qClone.innerText.trim();
            const moodleQNorm = normalizeText(moodleQRaw);

            // Find all matching questions from database/AMAUOED (handles multiple answers for same question and inline blanks)
            const candidates = questionsDb.filter(item => questionTextMatches(item.qNorm || item.qRaw || item.question, moodleQNorm));
            const hasAnyVerifiedCandidate = candidates.some(item => item.verified === true || item.deduced === true);

            // Clean up any prior unanswered hint
            que.querySelectorAll('.amaes-unanswered-hint').forEach(b => b.remove());

            if (candidates.length === 0) {
                if (checkIsQuizAttemptPage() && !que.querySelector('.amaes-unanswered-hint') && !que.querySelector('.amaes-blockage-hud')) {
                    const formulation = que.querySelector('.formulation, .content') || que;
                    const hint = document.createElement('div');
                    hint.className = 'amaes-unanswered-hint';
                    hint.style.cssText = `
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        margin-bottom: 8px;
                        padding: 4px 10px;
                        background: rgba(245, 158, 11, 0.1);
                        border: 1px solid rgba(245, 158, 11, 0.35);
                        border-left: 3px solid #f59e0b;
                        border-radius: 6px;
                        font-size: 10.5px;
                        color: #d97706;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    `;
                    hint.innerHTML = `
                        <span style="background: rgba(245, 158, 11, 0.22); color: #d97706; padding: 1px 5px; border-radius: 4px; font-weight: 800; font-size: 9px; letter-spacing: 0.5px;">NEW</span>
                        <span>No answer known to the system yet — <b>be the first to answer and share it!</b></span>
                    `;
                    formulation.insertBefore(hint, formulation.firstChild);
                }
                return;
            }
            // Sort candidates by verification and consensus confirmations descending
            candidates.sort((a, b) => ((b.verified ? 10 : 0) + (b.confirmations || 1)) - ((a.verified ? 10 : 0) + (a.confirmations || 1)));

            // Clean up any prior highlighting or elimination badges on this question
            que.querySelectorAll('.amaes-highlighted-choice, .amaes-eliminated-choice, .amaes-ai-suggested-choice').forEach(el => {
                el.classList.remove('amaes-highlighted-choice');
                el.classList.remove('amaes-eliminated-choice');
                el.classList.remove('amaes-ai-suggested-choice');
                el.style.outline = '';
                el.style.backgroundColor = '';
                el.style.borderRadius = '';
                el.style.padding = '';
                el.style.margin = '';
                el.style.display = '';
                el.style.alignItems = '';
                el.style.flexWrap = '';
                el.style.gap = '';
                el.style.width = '';
                el.style.boxSizing = '';
                const lbl = el.querySelector('label') || el;
                if (lbl) {
                    lbl.style.textDecoration = '';
                    lbl.style.opacity = '';
                }
            });
            que.querySelectorAll('select').forEach(sel => {
                sel.style.outline = '';
                sel.style.backgroundColor = '';
                sel.style.borderRadius = '';
            });
            que.querySelectorAll('.draghome, .dragitems .draghome, .drags .drag, .drags span, span.draghome, .dragboxes .drag, .dragitem, .drop, .dropzone, span.droptarget').forEach(el => {
                el.style.outline = '';
                el.style.backgroundColor = '';
                el.style.borderRadius = '';
            });
            que.querySelectorAll('.amaes-verified-badge, .amaes-eliminated-badge, .amaes-probability-hint, .amaes-shortans-hint, .amaes-select-hint, .amaes-drag-hint, .amaes-select-elim-hint, .amaes-unanswered-hint, .amaes-ai-suggested-badge, .amaes-ai-question-tag').forEach(b => b.remove());

            // Safety: collect all verified/confirmed answers for this question
            const verifiedNorms = new Set();
            candidates.forEach(cand => {
                if (cand.verified) {
                    if (cand.ansNorm) verifiedNorms.add(cand.ansNorm);
                    if (cand.ansRaw) verifiedNorms.add(normalizeChoice(cand.ansRaw));
                    if (Array.isArray(cand.answers)) {
                        cand.answers.forEach(a => verifiedNorms.add(normalizeChoice(a)));
                    }
                }
            });

            // Target each choice row container cleanly
            let choiceRows = que.querySelectorAll('.answer > div.r0, .answer > div.r1, .answer > div, .answer li, .answer tr');
            if (choiceRows.length === 0) {
                choiceRows = que.querySelectorAll('.answer div.r0, .answer div.r1, .answer li, .answer tr');
            }
            if (choiceRows.length === 0) {
                choiceRows = que.querySelectorAll('.answer label');
            }

            // Inspect DOM for explicit Moodle checkmarks (e.g. on review page)
            choiceRows.forEach(row => {
                if (hasChoiceCheckmark(row)) {
                    const label = row.querySelector('label') || row;
                    const txt = normalizeChoice(cleanDOMToAI(label));
                    if (txt) verifiedNorms.add(txt);
                }
            });

            // Inspect DOM for explicit Moodle red crosses or zero-mark selections (ground truth override!)
            const qGradeInfo = parseMoodleQuestionGrade(que);
            choiceRows.forEach(row => {
                const label = row.querySelector('label') || row;
                const txt = normalizeChoice(cleanDOMToAI(label));
                const isCrossed = hasChoiceCross(row) || hasChoiceCross(label);
                const isCheckedZero = qGradeInfo.isZeroMark && (
                    row.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked, input[checked], [aria-checked="true"]') !== null ||
                    row.classList.contains('selected') || (label && label.classList && label.classList.contains('selected'))
                );
                if ((isCrossed || isCheckedZero) && txt) {
                    // Moodle proved this choice is INCORRECT - remove from verifiedNorms!
                    verifiedNorms.delete(txt);
                    verifiedNorms.delete(unscriptDigits(txt));
                }
            });

            // Inspect DOM for explicit Moodle red crosses or zero marks on text inputs and dropdowns
            const liveTextInputs = que.querySelectorAll('input[type="text"], input.form-control, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="reset"])');
            liveTextInputs.forEach(ti => {
                const val = (ti.value || ti.getAttribute('value') || '').trim();
                const isCrossed = hasChoiceCross(ti) || hasChoiceCross(ti.parentElement) || qGradeInfo.isZeroMark;
                if ((isCrossed || qGradeInfo.isZeroMark) && val) {
                    const norm = normalizeChoice(val);
                    verifiedNorms.delete(norm);
                    verifiedNorms.delete(unscriptDigits(norm));
                }
            });
            const liveSelectInputs = que.querySelectorAll('select');
            liveSelectInputs.forEach(sel => {
                const opt = (sel.selectedIndex >= 0 && sel.options) ? sel.options[sel.selectedIndex] : null;
                const optText = (opt && opt.value && !opt.text.toLowerCase().includes('choose')) ? (opt.text || opt.innerText).trim() : '';
                const isCrossed = hasChoiceCross(sel) || hasChoiceCross(sel.parentElement) || qGradeInfo.isZeroMark;
                if ((isCrossed || qGradeInfo.isZeroMark) && optText) {
                    const norm = normalizeChoice(optText);
                    verifiedNorms.delete(norm);
                    verifiedNorms.delete(unscriptDigits(norm));
                }
            });

            // Compile all eliminated wrong choices known for this question
            const allWrongList = [];
            candidates.forEach(cand => {
                if (Array.isArray(cand.wrongAnswers)) {
                    cand.wrongAnswers.forEach(w => {
                        const wNorm = typeof w === 'string' ? normalizeChoice(w) : (w.norm || normalizeChoice(w.text || ''));
                        const wCount = typeof w === 'object' && typeof w.count === 'number' ? w.count : 1;
                        // Ground-truth guard: NEVER eliminate any answer known to be verified or checkmarked!
                        if (wNorm && !verifiedNorms.has(wNorm) && !verifiedNorms.has(unscriptDigits(wNorm)) && !allWrongList.some(item => item.norm === wNorm || unscriptDigits(item.norm) === unscriptDigits(wNorm))) {
                            allWrongList.push({ norm: wNorm, text: typeof w === 'string' ? w : w.text, count: wCount });
                        }
                    });
                }
            });

            // Ground-truth override: Add live DOM crosses or zero-mark selections into allWrongList
            choiceRows.forEach(row => {
                const label = row.querySelector('label') || row;
                const txt = normalizeChoice(cleanDOMToAI(label));
                const isCrossed = hasChoiceCross(row) || hasChoiceCross(label);
                const isCheckedZero = qGradeInfo.isZeroMark && (
                    row.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked, input[checked], [aria-checked="true"]') !== null ||
                    row.classList.contains('selected') || (label && label.classList && label.classList.contains('selected'))
                );
                if ((isCrossed || isCheckedZero) && txt) {
                    if (!allWrongList.some(item => item.norm === txt || unscriptDigits(item.norm) === unscriptDigits(txt))) {
                        const rawLabel = cleanDOMToAI(label).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                        allWrongList.push({ norm: txt, text: rawLabel || txt, count: 1 });
                    }
                }
            });
            liveTextInputs.forEach(ti => {
                const val = (ti.value || ti.getAttribute('value') || '').trim();
                const isCrossed = hasChoiceCross(ti) || hasChoiceCross(ti.parentElement) || qGradeInfo.isZeroMark;
                if ((isCrossed || qGradeInfo.isZeroMark) && val) {
                    const norm = normalizeChoice(val);
                    if (!allWrongList.some(item => item.norm === norm || unscriptDigits(item.norm) === unscriptDigits(norm))) {
                        allWrongList.push({ norm, text: val, count: 1 });
                    }
                }
            });
            liveSelectInputs.forEach(sel => {
                const opt = (sel.selectedIndex >= 0 && sel.options) ? sel.options[sel.selectedIndex] : null;
                const optText = (opt && opt.value && !opt.text.toLowerCase().includes('choose')) ? (opt.text || opt.innerText).trim() : '';
                const isCrossed = hasChoiceCross(sel) || hasChoiceCross(sel.parentElement) || qGradeInfo.isZeroMark;
                if ((isCrossed || qGradeInfo.isZeroMark) && optText) {
                    const norm = normalizeChoice(optText);
                    if (!allWrongList.some(item => item.norm === norm || unscriptDigits(item.norm) === unscriptDigits(norm))) {
                        allWrongList.push({ norm, text: optText, count: 1 });
                    }
                }
            });

            // Filter candidates: exclude any candidate whose answer was confirmed WRONG
            const validCandidates = candidates.filter(cand => {
                const ansText = cand.ansRaw || cand.answer || '';
                const ansNorm = cand.ansNorm || normalizeChoice(ansText);
                if (!ansNorm) return false;
                const isConfirmedWrong = allWrongList.some(w => {
                    const wNorm = normalizeChoice(w.norm || w.text || w);
                    return wNorm === ansNorm || unscriptDigits(wNorm) === unscriptDigits(ansNorm);
                });
                return !isConfirmedWrong;
            });

            // Contradiction Guard: A multiple-choice question cannot have 100% of choices wrong!
            // If all choices are marked wrong, keep only those with higher failure counts, preserving at least 1 candidate.
            if (choiceRows.length >= 2 && allWrongList.length >= choiceRows.length) {
                allWrongList.sort((a, b) => (b.count || 1) - (a.count || 1));
                allWrongList.splice(choiceRows.length - 1);
            }

            const isRadio = que.querySelector('.answer input[type="radio"]') !== null;
            let foundMatchForQuestion = false;

            choiceRows.forEach(row => {
                // If it is a single-choice radio question and we already highlighted the top verified answer, avoid double-highlighting
                if (isRadio && foundMatchForQuestion) return;

                const label = row.querySelector('label') || row;
                const input = row.querySelector('input[type="radio"], input[type="checkbox"]');
                const hasDomCheckmark = hasChoiceCheckmark(row);

                // Extract clean text without badges
                const choiceText = normalizeChoice(cleanDOMToAI(label));
                const isCrossedRow = hasChoiceCross(row) || hasChoiceCross(label) || (qGradeInfo.isZeroMark && Boolean(row.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked, input[checked], [aria-checked="true"]')));
                const isVerifiedChoice = !isCrossedRow && (hasDomCheckmark || verifiedNorms.has(choiceText) || verifiedNorms.has(unscriptDigits(choiceText)));
                const isEliminatedChoice = isCrossedRow || (!isVerifiedChoice && allWrongList.some(w => w.norm === choiceText || unscriptDigits(w.norm) === unscriptDigits(choiceText)));

                // 1. Check against verified candidate answers (ONLY if NOT confirmed wrong!)
                if (!isEliminatedChoice) {
                    let isChoiceMatch = false;
                    let matchedCand = null;

                    if (isVerifiedChoice) {
                        isChoiceMatch = true;
                        matchedCand = candidates.find(c => c.verified && (c.ansNorm === choiceText || unscriptDigits(c.ansNorm) === unscriptDigits(choiceText))) || candidates[0];
                    }

                    if (!isChoiceMatch) {
                        for (const cand of candidates) {
                            // Never auto-pick a lower-trust AMAUOED/community answer
                            // when a verified review answer exists for this question.
                            if (hasAnyVerifiedCandidate && cand.verified !== true && cand.deduced !== true) continue;
                            const ansNorm = cand.ansNorm || normalizeChoice(cand.ansRaw || cand.answer || '');
                            if (!ansNorm) continue;
                            if (choiceText === ansNorm) {
                                isChoiceMatch = true;
                                matchedCand = cand;
                                break;
                            }
                            const subCandidates = (Array.isArray(cand.answers) ? cand.answers : [])
                                .concat((cand.ansRaw || '').split(/[,;&\n]+|\s+and\s+/i))
                                .concat((cand.answer || '').split(/[,;&\n]+|\s+and\s+/i))
                                .map(s => normalizeChoice(s))
                                .filter(Boolean);
                            if (subCandidates.includes(choiceText)) {
                                isChoiceMatch = true;
                                matchedCand = cand;
                                break;
                            }
                        }
                    }

                    if (isChoiceMatch) {
                        const cand = matchedCand || { source: 'Verified Database', verified: true, confirmations: 1 };
                        foundMatchForQuestion = true;

                        const matchingSources = candidates.filter(candidate => {
                            const answerNorms = [
                                candidate.ansNorm,
                                candidate.ansRaw,
                                ...(Array.isArray(candidate.answers) ? candidate.answers : [])
                            ].filter(Boolean).map(normalizeChoice);
                            return answerNorms.includes(choiceText) || answerNorms.includes(unscriptDigits(choiceText));
                        });
                        const sourceCandidates = matchingSources.length > 0 ? matchingSources : [cand];
                        const hasVerifiedSource = sourceCandidates.some(candidate => candidate.verified === true || candidate.deduced === true);
                        const hasAmauoedSource = sourceCandidates.some(candidate =>
                            Boolean((candidate.source || '').toLowerCase().includes('amauoed') ||
                            (Array.isArray(candidate.sources) && candidate.sources.some(source => String(source).toLowerCase().includes('amauoed'))))
                        );
                        const hasAiSource = !hasVerifiedSource && !hasAmauoedSource && sourceCandidates.some(candidate =>
                            Boolean(candidate.isAiSuggestion || (candidate.source || '').toLowerCase().includes('gemini') ||
                            (Array.isArray(candidate.sources) && candidate.sources.some(source => String(source).toLowerCase().includes('gemini'))))
                        );
                        const isAmauoed = !hasVerifiedSource && !hasAiSource && hasAmauoedSource;
                        const isDeduced = cand.deduced === true;
                        let sourceColor = '#0284c7';
                        let sourceBg = 'rgba(2, 132, 199, 0.12)';
                        if (hasVerifiedSource) {
                            sourceColor = '#10b981';
                            sourceBg = 'rgba(16, 185, 129, 0.14)';
                        } else if (hasAiSource) {
                            sourceColor = '#8b5cf6';
                            sourceBg = 'rgba(139, 92, 246, 0.12)';
                        }
                        const sourceLabels = [];
                        if (hasVerifiedSource) {
                            sourceLabels.push(isDeduced ? 'Deduced Answer' : 'Verified Answer');
                        }
                        if (hasAmauoedSource && !hasAiSource) sourceLabels.push('Web Study Guide');
                        if (hasAiSource) sourceLabels.push('AI Suggestion (Gemini)');

                        // Apply full row highlight on container
                        const targetRow = row;
                        targetRow.classList.add(hasAiSource ? 'amaes-ai-suggested-choice' : 'amaes-highlighted-choice');
                        if (hasAiSource) {
                            setQuestionAiTag(que, true);
                        } else if (hasVerifiedSource) {
                            setQuestionAiTag(que, false);
                        }
                        targetRow.style.outline = `2px solid ${sourceColor}`;
                        targetRow.style.backgroundColor = sourceBg;
                        targetRow.style.boxShadow = `0 0 0 1px ${sourceColor}33`;
                        targetRow.style.borderRadius = '6px';
                        targetRow.style.padding = '6px 12px';
                        targetRow.style.margin = '4px 0';
                        targetRow.style.display = 'flex';
                        targetRow.style.alignItems = 'center';
                        targetRow.style.flexWrap = 'wrap';
                        targetRow.style.gap = '8px';
                        targetRow.style.width = '100%';
                        targetRow.style.boxSizing = 'border-box';
                        targetRow.style.transition = 'all 0.2s ease';

                        // Reset inner label so it doesn't constrain width or wrap oddly
                        if (label !== targetRow) {
                            label.style.outline = 'none';
                            label.style.backgroundColor = 'transparent';
                            label.style.padding = '0';
                            label.style.margin = '0';
                            label.style.display = 'inline-flex';
                            label.style.alignItems = 'center';
                            label.style.gap = '6px';
                            label.style.cursor = 'pointer';
                        }

                        // Prevent internal <p> tags from forcing line breaks
                        targetRow.querySelectorAll('p').forEach(p => {
                            p.style.display = 'inline';
                            p.style.margin = '0';
                            p.style.padding = '0';
                        });

                        // Add source badge if not already present
                        let badge = targetRow.querySelector('.amaes-verified-badge, .amaes-ai-suggested-badge');
                        if (!badge) {
                            badge = document.createElement(isAmauoed && !hasVerifiedSource ? 'a' : 'span');
                            badge.className = hasAiSource ? 'amaes-ai-suggested-badge' : `amaes-verified-badge ${hasAmauoedSource ? 'amaes-badge-amauoed' : 'amaes-badge-db'}`;
                            badge.innerHTML = sourceLabels.map(label => {
                                const icon = label.startsWith('AI Suggestion') ? '' : ((label.startsWith('Web Study Guide') || label.startsWith('AMAUOED')) ? ICONS.external : (isDeduced ? ICONS.lightbulb : ICONS.checkCircle));
                                return `${icon} <span>${label}</span>`;
                            }).join('<span style="opacity:.55"> + </span>');
                            const courseInfo = detectCourseInfo();
                            const subCode = courseInfo.subjectCode || 'CS6301';
                            const amauoedUrl = getStoredAmauoedUrl(subCode) || 'https://amauoed.com/courses';
                            if (isAmauoed && !hasVerifiedSource) {
                                badge.href = amauoedUrl;
                                badge.target = '_blank';
                                badge.rel = 'noopener noreferrer';
                                badge.title = `Source: amauoed.com — Click to open ${subCode} study guide in new tab`;
                                badge.onclick = (e) => { e.stopPropagation(); };
                            }
                            badge.style.cssText = `
                                background: ${sourceColor};
                                color: #ffffff !important;
                                font-size: 10px;
                                font-weight: 700;
                                padding: 2px 7px;
                                border-radius: 4px;
                                margin-left: auto;
                                display: inline-flex;
                                align-items: center;
                                gap: 4px;
                                box-shadow: 0 1px 3px rgba(0,0,0,0.18);
                                white-space: nowrap;
                                flex-shrink: 0;
                                text-decoration: none;
                                cursor: ${isAmauoed ? 'pointer' : 'default'};
                            `;
                            targetRow.appendChild(badge);
                        }

                        // Auto-select radio button if autoPickQuiz is enabled OR autoQuizMode is running OR autoSelect is requested
                        // USER OVERRIDE SAFETY: If user already selected a choice on this question, NEVER overwrite their decision!
                        const canSelectAnswer = isManualSelect || (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode));
                        const anyRadioChecked = isRadio && Boolean(que.querySelector('.answer input[type="radio"]:checked'));
                        if (canSelectAnswer && input && !input.checked && (!anyRadioChecked || isManualSelect)) {
                            if (!hasAiSource || aiAutoSelect) {
                                input.checked = true;
                                input.click();
                                if (label && label !== input) {
                                    label.click();
                                }
                                input.dispatchEvent(new Event('input', { bubbles: true }));
                                input.dispatchEvent(new Event('change', { bubbles: true }));
                            }
                        }

                        return;
                    }
                }

            // 2. Check if choice is confirmed WRONG (elimination)
                if (!isVerifiedChoice && (isEliminatedChoice || !foundMatchForQuestion) && allWrongList.length > 0) {
                    const matchedWrong = allWrongList.find(w => w.norm === choiceText || unscriptDigits(w.norm) === unscriptDigits(choiceText));
                    if (matchedWrong) {
                        const targetRow = row;
                        targetRow.classList.add('amaes-eliminated-choice');
                        targetRow.style.outline = '1.5px solid #ef4444';
                        targetRow.style.backgroundColor = 'rgba(239, 68, 68, 0.12)';
                        targetRow.style.boxShadow = '0 0 0 1px rgba(239, 68, 68, 0.18)';
                        targetRow.style.borderRadius = '6px';
                        targetRow.style.padding = '5px 10px';
                        targetRow.style.margin = '4px 0';
                        targetRow.style.display = 'flex';
                        targetRow.style.alignItems = 'center';
                        targetRow.style.flexWrap = 'wrap';
                        targetRow.style.gap = '8px';
                        targetRow.style.width = '100%';
                        targetRow.style.boxSizing = 'border-box';
                        targetRow.style.transition = 'all 0.2s ease';

                        if (label !== targetRow) {
                            label.style.textDecoration = 'line-through';
                            label.style.opacity = '0.6';
                        }

                        let badge = targetRow.querySelector('.amaes-eliminated-badge');
                        if (!badge) {
                            badge = document.createElement('span');
                            badge.className = 'amaes-eliminated-badge';
                            const countText = 'Incorrect Choice';
                            badge.innerHTML = `${ICONS.xCircle} <span>${countText}</span>`;
                            badge.title = `Attempt or classmate history confirmed this choice is incorrect`;
                            badge.style.cssText = `
                                background: #ef4444;
                                color: #ffffff;
                                font-size: 9.5px;
                                font-weight: 700;
                                padding: 2px 7px;
                                border-radius: 4px;
                                margin-left: auto;
                                display: inline-flex;
                                align-items: center;
                                gap: 4px;
                                box-shadow: 0 1px 2px rgba(0,0,0,0.15);
                                white-space: nowrap;
                                flex-shrink: 0;
                            `;
                            targetRow.appendChild(badge);
                        }
                    }
                }
            });

            // 3. Real-Time Deduction by Elimination: If all choices except 1 are eliminated, deduce the remaining 1 as correct!
            if (!foundMatchForQuestion && choiceRows.length >= 2) {
                const uneliminated = Array.from(choiceRows).filter(r => !r.classList.contains('amaes-eliminated-choice'));
                if (uneliminated.length === 1) {
                    const deducedRow = uneliminated[0];
                    const deducedLabel = deducedRow.querySelector('label') || deducedRow;
                    const deducedInput = deducedRow.querySelector('input[type="radio"], input[type="checkbox"]');
                    foundMatchForQuestion = true;

                    deducedRow.classList.add('amaes-highlighted-choice');
                    deducedRow.style.outline = '2px solid #10b981';
                    deducedRow.style.backgroundColor = 'rgba(16, 185, 129, 0.15)';
                    deducedRow.style.borderRadius = '6px';
                    deducedRow.style.padding = '6px 12px';
                    deducedRow.style.margin = '4px 0';
                    deducedRow.style.display = 'flex';
                    deducedRow.style.alignItems = 'center';
                    deducedRow.style.flexWrap = 'wrap';
                    deducedRow.style.gap = '8px';
                    deducedRow.style.width = '100%';
                    deducedRow.style.boxSizing = 'border-box';

                    let badge = deducedRow.querySelector('.amaes-verified-badge');
                    if (!badge) {
                        badge = document.createElement('span');
                        badge.className = 'amaes-verified-badge amaes-badge-db';
                        badge.innerHTML = `${ICONS.lightbulb} <span>Deduced Answer</span>`;
                        badge.style.cssText = `
                            background: linear-gradient(135deg, #10b981, #059669);
                            color: #ffffff;
                            font-size: 10px;
                            font-weight: 700;
                            padding: 2px 7px;
                            border-radius: 4px;
                            margin-left: auto;
                            display: inline-flex;
                            align-items: center;
                            gap: 4px;
                            box-shadow: 0 1px 3px rgba(0,0,0,0.18);
                            white-space: nowrap;
                            flex-shrink: 0;
                        `;
                        deducedRow.appendChild(badge);
                    }

                    const canSelectAnswer = isManualSelect || (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode));
                    const anyDeducedRadioChecked = Boolean(que.querySelector('.answer input[type="radio"]:checked'));
                    if (canSelectAnswer && deducedInput && !deducedInput.checked && (!anyDeducedRadioChecked || isManualSelect)) {
                        deducedInput.checked = true;
                        deducedInput.click();
                        if (deducedLabel && deducedLabel !== deducedInput) {
                            deducedLabel.click();
                        }
                        deducedInput.dispatchEvent(new Event('input', { bubbles: true }));
                        deducedInput.dispatchEvent(new Event('change', { bubbles: true }));
                    }

                    // Auto-save the deduced answer into course cache for permanent verification!
                    const deducedText = cleanDOMToAI(deducedLabel).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                    if (deducedText) {
                        const courseInfo = detectCourseInfo();
                        const sCode = courseInfo.subjectCode || 'GENERAL';
                        mergeAnswersIntoCache(sCode, [{
                            qRaw: moodleQRaw,
                            qNorm: moodleQNorm,
                            ansRaw: deducedText,
                            ansNorm: normalizeChoice(deducedText),
                            choices: Array.from(choiceRows).map(r => cleanDOMToAI(r.querySelector('label') || r)),
                            verified: true,
                            deduced: true,
                            source: 'Elimination Deduction'
                        }], 'Elimination Deduction');
                    }
                } else if (uneliminated.length > 1 && uneliminated.length < choiceRows.length) {
                    // Partial elimination: display remaining candidate note
                    uneliminated.forEach(candRow => {
                        candRow.style.outline = '1.5px dashed #0284c7';
                        candRow.style.backgroundColor = 'rgba(2, 132, 199, 0.07)';
                        candRow.style.borderRadius = '6px';
                        if (!candRow.querySelector('.amaes-probability-hint')) {
                            const pHint = document.createElement('span');
                            pHint.className = 'amaes-probability-hint';
                            pHint.style.cssText = `
                                font-size: 9.5px;
                                color: #38bdf8;
                                background: rgba(56, 189, 248, 0.15);
                                border: 1px solid rgba(56, 189, 248, 0.35);
                                padding: 2px 6px;
                                border-radius: 4px;
                                margin-left: auto;
                                font-weight: 700;
                                display: inline-flex;
                                align-items: center;
                                gap: 4px;
                            `;
                            pHint.innerHTML = `${ICONS.target} <span>Possible Option</span>`;
                            candRow.appendChild(pHint);
                        }
                    });
                }
            }

            // 4. Session AI Cache: Reapply previously AI-solved answer if returning to this question!
            if (!foundMatchForQuestion && choiceRows.length >= 2) {
                const qData = extractQuestionData(que);
                const cachedAi = getCachedAiAnswer(qData);
                if (cachedAi && cachedAi.choiceText) {
                    const matchedAi = matchAiAnswerToChoice(cachedAi.choiceText, que, qData);
                    if (matchedAi && matchedAi.row && !isChoiceRowEliminated(matchedAi.row)) {
                        foundMatchForQuestion = true;
                        applyAiChoiceHighlight(matchedAi.row);
                        const canSelectAnswer = isManualSelect || (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode) && aiAutoSelect);
                        const anyRadioChecked = Boolean(que.querySelector('.answer input[type="radio"]:checked'));
                        if (canSelectAnswer && matchedAi.input && !matchedAi.input.checked && (!anyRadioChecked || isManualSelect)) {
                            matchedAi.input.checked = true;
                            matchedAi.input.click();
                            if (matchedAi.input.parentElement) matchedAi.input.parentElement.click();
                            matchedAi.input.dispatchEvent(new Event('input', { bubbles: true }));
                            matchedAi.input.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                    }
                }
            }

            // Handle Short Answer / Text inputs (both standard and inline cloze inputs)
            if (!foundMatchForQuestion) {
                const textInputs = que.querySelectorAll('input[type="text"], input.form-control, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="reset"])');
                if (textInputs.length > 0 && validCandidates.length > 0 && !checkIsReviewPage()) {
                    const bestCand = validCandidates[0];
                    const bestAnswer = bestCand.ansRaw || bestCand.answer || '';
                    const isAmauoed = Boolean((bestCand.source || '').toLowerCase().includes('amauoed') || (Array.isArray(bestCand.sources) && bestCand.sources.some(s => s.toLowerCase().includes('amauoed'))));
                    const courseInfo = detectCourseInfo();
                    const subCode = courseInfo.subjectCode || 'CS6301';
                    const amauoedUrl = getStoredAmauoedUrl(subCode) || 'https://amauoed.com/courses';
                    const sourceColor = isAmauoed ? '#0284c7' : '#10b981';
                    const sourceBg = isAmauoed ? 'rgba(2, 132, 199, 0.1)' : 'rgba(16, 185, 129, 0.1)';
                    const sourceTitle = isAmauoed
                        ? `<a href="${amauoedUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" style="color:${sourceColor}; font-weight:700; text-decoration:underline; cursor:pointer;" title="Source: amauoed.com — Click to open ${subCode} study guide in new tab">Suggested (amauoed.com):</a>`
                        : 'Suggested (Verified DB):';

                    // Parse potential multi-blank answers if multiple inputs exist in the question
                    let candAnswers = [];
                    if (Array.isArray(bestCand.answers) && bestCand.answers.length > 0) {
                        candAnswers = bestCand.answers.map(s => String(s || '').trim()).filter(Boolean);
                    } else if (textInputs.length > 1 && (bestAnswer.includes(',') || bestAnswer.includes('\n') || bestAnswer.includes(';') || bestAnswer.includes('|'))) {
                        candAnswers = bestAnswer.split(/[\n,;|]+/).map(s => s.trim()).filter(Boolean);
                    } else {
                        candAnswers = [bestAnswer.trim()].filter(Boolean);
                    }

                    textInputs.forEach((textInput, idx) => {
                        const targetAns = textInputs.length === 1 ? (candAnswers[0] || bestAnswer || '') : (candAnswers[idx] || '');
                        if (!targetAns) return;

                        textInput.style.outline = `2px solid ${sourceColor}`;
                        textInput.style.backgroundColor = sourceBg;
                        textInput.style.borderRadius = '4px';

                        let hint = que.querySelector(`.amaes-shortans-hint[data-input-idx="${idx}"]`);
                        if (!hint) {
                            hint = document.createElement('div');
                            hint.className = 'amaes-shortans-hint';
                            hint.setAttribute('data-input-idx', String(idx));
                            hint.innerHTML = `
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                                    <span><span style="color:${sourceColor}; font-weight:700;">${sourceTitle}</span> <b>${targetAns}</b></span>
                                    <button type="button" class="amaes-fill-btn" style="
                                        background: ${sourceColor};
                                        color: #ffffff;
                                        border: none;
                                        border-radius: 4px;
                                        padding: 2px 7px;
                                        font-size: 10px;
                                        font-weight: 700;
                                        cursor: pointer;
                                        display: inline-flex;
                                        align-items: center;
                                        gap: 3px;
                                        white-space: nowrap;
                                        box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                                    ">${ICONS.zap} Fill</button>
                                </div>
                            `;
                            hint.style.cssText = `font-size: 11px; margin-top: 5px; margin-bottom: 3px; padding: 5px 9px; background: ${sourceBg}; border-left: 3px solid ${sourceColor}; border-radius: 4px; cursor: pointer; transition: background 0.15s;`;
                            hint.title = `Click to auto-fill "${targetAns}" into answer field`;

                            const fillFn = (e) => {
                                if (e && e.target && e.target.closest('a')) return;
                                if (e) {
                                    e.preventDefault();
                                    e.stopPropagation();
                                }
                                textInput.value = targetAns;
                                textInput.dispatchEvent(new Event('input', { bubbles: true }));
                                textInput.dispatchEvent(new Event('change', { bubbles: true }));
                                textInput.dispatchEvent(new Event('blur', { bubbles: true }));
                                showToast(`Filled: ${targetAns}`);
                                hint.style.background = 'rgba(16, 185, 129, 0.2)';
                                const btn = hint.querySelector('.amaes-fill-btn');
                                if (btn) btn.innerText = '✓ Filled';
                            };

                            hint.onclick = fillFn;
                            const fillBtn = hint.querySelector('.amaes-fill-btn');
                            if (fillBtn) fillBtn.onclick = fillFn;

                            // Insert hint directly after input container or into question
                            if (textInput.parentElement && textInput.parentElement !== que) {
                                textInput.parentElement.appendChild(hint);
                            } else {
                                textInput.insertAdjacentElement('afterend', hint);
                            }
                        }

                        // Auto-fill when autoPickQuiz is enabled and auto-quiz is running, or user triggered manual select
                        const canAutoFill = isManualSelect || (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode));
                        if (canAutoFill && !textInput.value) {
                            textInput.value = targetAns;
                            textInput.dispatchEvent(new Event('input', { bubbles: true }));
                            textInput.dispatchEvent(new Event('change', { bubbles: true }));
                            textInput.dispatchEvent(new Event('blur', { bubbles: true }));
                        }
                    });

                    foundMatchForQuestion = true;
                }
            }

            // Handle Dropdown / Select elements (matching questions table, cloze / gapselect dropdowns)
            if (!foundMatchForQuestion) {
                const selectInputs = que.querySelectorAll('select');
                if (selectInputs.length > 0 && validCandidates.length > 0 && !checkIsReviewPage()) {
                    const bestCand = validCandidates[0];
                    const bestAnswer = bestCand.ansRaw || bestCand.answer || '';
                    const isAmauoed = Boolean((bestCand.source || '').toLowerCase().includes('amauoed') || (Array.isArray(bestCand.sources) && bestCand.sources.some(s => s.toLowerCase().includes('amauoed'))));
                    const courseInfo = detectCourseInfo();
                    const subCode = courseInfo.subjectCode || 'CS6301';
                    const amauoedUrl = getStoredAmauoedUrl(subCode) || 'https://amauoed.com/courses';
                    const sourceColor = isAmauoed ? '#0284c7' : '#10b981';
                    const sourceBg = isAmauoed ? 'rgba(2, 132, 199, 0.1)' : 'rgba(16, 185, 129, 0.1)';
                    const sourceTitle = isAmauoed
                        ? `<a href="${amauoedUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" style="color:${sourceColor}; font-weight:700; text-decoration:underline; cursor:pointer;" title="Source: amauoed.com — Click to open ${subCode} study guide in new tab">Suggested (amauoed.com):</a>`
                        : 'Suggested (Verified DB):';

                    const candAnswers = (bestCand.answers && bestCand.answers.length > 0)
                        ? bestCand.answers
                        : (bestAnswer.includes(',') && selectInputs.length > 1 ? bestAnswer.split(',').map(s => s.trim()) : [bestAnswer]);

                    let matchedAnySelect = false;

                    selectInputs.forEach((selectInput, idx) => {
                        // Check if dropdown is inside a matching table row with sub-question text
                        const row = selectInput.closest('tr');
                        const rowTextElem = row ? row.querySelector('td.text') : null;
                        const subQText = rowTextElem ? rowTextElem.innerText.trim() : '';

                        // Determine target answer for this dropdown:
                        // 1. Try matching sub-question text in bestAnswer (e.g. "Term: Definition" or "Term -> Definition")
                        let targetAns = '';
                        if (subQText && (bestAnswer.includes(':') || bestAnswer.includes('->') || bestAnswer.includes('-'))) {
                            const lines = bestAnswer.split(/[\n,;]+/).map(l => l.trim());
                            for (const line of lines) {
                                const subNorm = normalizeText(subQText);
                                const lineNorm = normalizeText(line);
                                if (lineNorm.includes(subNorm)) {
                                    const parts = line.split(/[:\->=]+/);
                                    if (parts.length >= 2) {
                                        targetAns = parts.slice(1).join(':').trim();
                                        break;
                                    }
                                }
                            }
                        }

                        // 2. Fallback to candidate answers array index
                        if (!targetAns) {
                            targetAns = selectInputs.length === 1 ? (candAnswers[0] || bestAnswer || '') : (candAnswers[idx] || '');
                        }
                        if (!targetAns) return;

                        // Look for a matching option in the select
                        const options = Array.from(selectInput.options);
                        const normTarget = normalizeChoice(targetAns);

                        // 1. Mark eliminated options in dropdown
                        const eliminatedOptions = [];
                        options.forEach(opt => {
                            if (!opt.value || opt.value === '0' || opt.text.toLowerCase().includes('choose')) return;
                            const optClean = opt.text.replace(/\s*\(Eliminated\)/g, '').trim();
                            const optNorm = normalizeChoice(optClean);
                            const isWrong = allWrongList.some(w => w.norm === optNorm || unscriptDigits(w.norm) === unscriptDigits(optNorm));
                            if (isWrong) {
                                if (!opt.text.includes('(Eliminated)')) {
                                    opt.text = `${optClean} (Eliminated)`;
                                }
                                opt.style.color = '#ef4444';
                                opt.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                                eliminatedOptions.push(optClean);
                            }
                        });

                        if (eliminatedOptions.length > 0) {
                            let elimHint = que.querySelector(`.amaes-select-elim-hint[data-select-idx="${idx}"]`);
                            if (!elimHint) {
                                elimHint = document.createElement('div');
                                elimHint.className = 'amaes-select-elim-hint';
                                elimHint.setAttribute('data-select-idx', String(idx));
                                elimHint.style.cssText = `font-size: 11px; margin-top: 4px; padding: 4px 8px; background: rgba(239, 68, 68, 0.12); border-left: 3px solid #ef4444; color: #ef4444; border-radius: 4px; font-weight: 600;`;
                                elimHint.innerHTML = `${ICONS.xCircle} <span>Eliminated: <b>${escapeHtml(eliminatedOptions.join(', '))}</b> (Do not pick)</span>`;
                                if (selectInput.parentElement && selectInput.parentElement !== que) {
                                    selectInput.parentElement.appendChild(elimHint);
                                } else {
                                    selectInput.insertAdjacentElement('afterend', elimHint);
                                }
                            }
                        }

                        // 2. Find matching option excluding eliminated ones
                        let matchedOption = options.find(opt => {
                            if (!opt.value || opt.value === '0' || opt.text.toLowerCase().includes('choose')) return false;
                            const optClean = opt.text.replace(/\s*\(Eliminated\)/g, '').trim();
                            const normOpt = normalizeChoice(optClean);
                            if (allWrongList.some(w => w.norm === normOpt || unscriptDigits(w.norm) === unscriptDigits(normOpt))) return false;
                            return normOpt === normTarget || (normTarget.length > 2 && normOpt.includes(normTarget)) || (normOpt.length > 2 && targetAns.length > 2 && normTarget.includes(normOpt));
                        });

                        // Fallback: if no direct match, try matching any candidate answer (excluding eliminated)
                        if (!matchedOption && candAnswers.length > 0) {
                            matchedOption = options.find(opt => {
                                if (!opt.value || opt.value === '0' || opt.text.toLowerCase().includes('choose')) return false;
                                const optClean = opt.text.replace(/\s*\(Eliminated\)/g, '').trim();
                                const normOpt = normalizeChoice(optClean);
                                if (allWrongList.some(w => w.norm === normOpt || unscriptDigits(w.norm) === unscriptDigits(normOpt))) return false;
                                return candAnswers.some(ca => {
                                    const nca = normalizeChoice(ca);
                                    return normOpt === nca || (nca.length > 2 && normOpt.includes(nca)) || (normOpt.length > 2 && nca.includes(normOpt));
                                });
                            });
                        }

                        // 3. Deduction by elimination: if all options except 1 are eliminated, pick remaining
                        const validOptions = options.filter(opt => {
                            if (!opt.value || opt.value === '0' || opt.text.toLowerCase().includes('choose')) return false;
                            const optClean = opt.text.replace(/\s*\(Eliminated\)/g, '').trim();
                            const optNorm = normalizeChoice(optClean);
                            return !allWrongList.some(w => w.norm === optNorm || unscriptDigits(w.norm) === unscriptDigits(normOpt));
                        });

                        let isDeducedSelect = false;
                        if (!matchedOption && validOptions.length === 1) {
                            matchedOption = validOptions[0];
                            isDeducedSelect = true;
                        }

                        if (matchedOption) {
                            matchedAnySelect = true;
                            selectInput.style.outline = `2px solid ${sourceColor}`;
                            selectInput.style.backgroundColor = sourceBg;
                            selectInput.style.borderRadius = '4px';

                            let hint = que.querySelector(`.amaes-select-hint[data-select-idx="${idx}"]`);
                            if (!hint) {
                                hint = document.createElement('div');
                                hint.className = 'amaes-select-hint';
                                hint.setAttribute('data-select-idx', String(idx));
                                const displayTitle = isDeducedSelect ? 'Deduced Answer:' : sourceTitle;
                                const cleanText = matchedOption.text.replace(/\s*\(Eliminated\)/g, '').trim();
                                const activeColor = isDeducedSelect ? '#f59e0b' : sourceColor;
                                hint.innerHTML = `
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                                        <span><span style="color:${activeColor}; font-weight:700;">${displayTitle}</span> <b>${cleanText}</b></span>
                                        <button type="button" class="amaes-select-btn" style="
                                            background: ${activeColor};
                                            color: #ffffff;
                                            border: none;
                                            border-radius: 4px;
                                            padding: 2px 7px;
                                            font-size: 10px;
                                            font-weight: 700;
                                            cursor: pointer;
                                            display: inline-flex;
                                            align-items: center;
                                            gap: 3px;
                                            white-space: nowrap;
                                            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                                        ">${ICONS.zap} Pick</button>
                                    </div>
                                `;
                                hint.style.cssText = `font-size: 11px; margin-top: 5px; margin-bottom: 3px; padding: 5px 9px; background: ${sourceBg}; border-left: 3px solid ${sourceColor}; border-radius: 4px; cursor: pointer; transition: background 0.15s;`;
                                hint.title = `Click to pick "${matchedOption.text}"`;

                                const pickFn = (e) => {
                                    if (e && e.target && e.target.closest('a')) return;
                                    if (e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }
                                    selectInput.value = matchedOption.value;
                                    selectInput.dispatchEvent(new Event('input', { bubbles: true }));
                                    selectInput.dispatchEvent(new Event('change', { bubbles: true }));
                                    selectInput.dispatchEvent(new Event('blur', { bubbles: true }));
                                    showToast(`Selected: ${matchedOption.text}`);
                                    hint.style.background = 'rgba(16, 185, 129, 0.2)';
                                    const btn = hint.querySelector('.amaes-select-btn');
                                    if (btn) btn.innerText = '✓ Picked';
                                };

                                hint.onclick = pickFn;
                                const pickBtn = hint.querySelector('.amaes-select-btn');
                                if (pickBtn) pickBtn.onclick = pickFn;

                                if (selectInput.parentElement && selectInput.parentElement !== que) {
                                    selectInput.parentElement.appendChild(hint);
                                } else {
                                    selectInput.insertAdjacentElement('afterend', hint);
                                }
                            }

                            // Auto-select when autoPickQuiz is enabled and auto-quiz is running, or user triggered manual select
                            const canAutoPick = isManualSelect || (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode));
                            if (canAutoPick && (!selectInput.value || selectInput.value === '0')) {
                                selectInput.value = matchedOption.value;
                                selectInput.dispatchEvent(new Event('input', { bubbles: true }));
                                selectInput.dispatchEvent(new Event('change', { bubbles: true }));
                                selectInput.dispatchEvent(new Event('blur', { bubbles: true }));
                            }
                        }
                    });

                    if (matchedAnySelect) {
                        foundMatchForQuestion = true;
                    }
                }
            }

            // Handle Drag and Drop into text / onto image questions (ddwtos, ddimageortext, ddmarker)
            if (!foundMatchForQuestion) {
                const dragHomes = Array.from(que.querySelectorAll('.draghome, .dragitems .draghome, .drags .drag, .drags span, span.draghome, .dragboxes .drag, .dragitem'));
                const dropZones = Array.from(que.querySelectorAll('.drop, .dropzone, span.droptarget, .droppable'));

                if (dragHomes.length > 0 && dropZones.length > 0 && candidates.length > 0) {
                    const bestCand = candidates[0];
                    const bestAnswer = bestCand.ansRaw || bestCand.answer || '';
                    const isAmauoed = Boolean((bestCand.source || '').toLowerCase().includes('amauoed') || (Array.isArray(bestCand.sources) && bestCand.sources.some(s => s.toLowerCase().includes('amauoed'))));
                    const courseInfo = detectCourseInfo();
                    const subCode = courseInfo.subjectCode || 'CS6301';
                    const amauoedUrl = getStoredAmauoedUrl(subCode) || 'https://amauoed.com/courses';
                    const sourceColor = isAmauoed ? '#0284c7' : '#10b981';
                    const sourceBg = isAmauoed ? 'rgba(2, 132, 199, 0.1)' : 'rgba(16, 185, 129, 0.1)';
                    const sourceTitle = isAmauoed
                        ? `<a href="${amauoedUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" style="color:${sourceColor}; font-weight:700; text-decoration:underline; cursor:pointer;" title="Source: amauoed.com — Click to open ${subCode} study guide in new tab">Suggested (amauoed.com):</a>`
                        : 'Suggested (Verified DB):';

                    let candAnswers = [];
                    if (Array.isArray(bestCand.answers) && bestCand.answers.length > 0) {
                        candAnswers = bestCand.answers.map(s => String(s || '').trim()).filter(Boolean);
                    } else if (dropZones.length > 1 && (bestAnswer.includes(',') || bestAnswer.includes('\n') || bestAnswer.includes(';') || bestAnswer.includes('|'))) {
                        candAnswers = bestAnswer.split(/[\n,;|]+/).map(s => s.trim()).filter(Boolean);
                    } else {
                        candAnswers = [bestAnswer.trim()].filter(Boolean);
                    }

                    let matchedDragCount = 0;
                    const usedDrags = new Set();

                    dropZones.forEach((dropZone, idx) => {
                        let targetAns = dropZones.length === 1 ? (candAnswers[0] || bestAnswer || '') : (candAnswers[idx] || '');
                        targetAns = targetAns.replace(/^Blank\s*\d+\s*[:\-–]\s*/i, '').trim();
                        if (!targetAns) return;

                        const normTarget = normalizeChoice(targetAns);
                        const matchingDrag = dragHomes.find(dh => {
                            const isInfinite = dh.classList.contains('infinite') || dh.classList.contains('drag-infinite');
                            if (!isInfinite && usedDrags.has(dh)) return false;
                            const dText = normalizeChoice(cleanDOMToAI(dh));
                            return dText === normTarget || (normTarget.length > 1 && dText.includes(normTarget)) || (dText.length > 1 && normTarget.includes(dText));
                        });

                        if (matchingDrag) {
                            usedDrags.add(matchingDrag);
                            matchedDragCount++;
                            matchingDrag.style.outline = `2.5px solid ${sourceColor}`;
                            matchingDrag.style.backgroundColor = sourceBg;
                            matchingDrag.style.borderRadius = '4px';

                            dropZone.style.outline = `2px dashed ${sourceColor}`;
                            dropZone.style.backgroundColor = sourceBg;
                            dropZone.style.borderRadius = '4px';

                            let hint = que.querySelector(`.amaes-drag-hint[data-drop-idx="${idx}"]`);
                            if (!hint) {
                                hint = document.createElement('div');
                                hint.className = 'amaes-drag-hint';
                                hint.setAttribute('data-drop-idx', String(idx));
                                hint.innerHTML = `
                                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                                        <span><span style="color:${sourceColor}; font-weight:700;">${sourceTitle}</span> Blank [${idx + 1}]: <b>${targetAns}</b></span>
                                        <button type="button" class="amaes-drag-btn" style="
                                            background: ${sourceColor};
                                            color: #ffffff;
                                            border: none;
                                            border-radius: 4px;
                                            padding: 2px 7px;
                                            font-size: 10px;
                                            font-weight: 700;
                                            cursor: pointer;
                                            display: inline-flex;
                                            align-items: center;
                                            gap: 3px;
                                            white-space: nowrap;
                                            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
                                        ">${ICONS.zap} Place</button>
                                    </div>
                                `;
                                hint.style.cssText = `font-size: 11px; margin-top: 5px; margin-bottom: 3px; padding: 5px 9px; background: ${sourceBg}; border-left: 3px solid ${sourceColor}; border-radius: 4px; cursor: pointer; transition: background 0.15s;`;
                                hint.title = `Click to place "${targetAns}" into Blank ${idx + 1}`;

                                const placeFn = (e) => {
                                    if (e && e.target && e.target.closest('a')) return;
                                    if (e) {
                                        e.preventDefault();
                                        e.stopPropagation();
                                    }
                                    const hiddenInput = que.querySelector(`input.placeinput.place${idx + 1}, input[name$="_p${idx + 1}"], input[name*="_p${idx + 1}"]`) || que.querySelectorAll('input.placeinput, input[type="hidden"][name*="_p"]')[idx];
                                    const choiceClass = Array.from(matchingDrag.classList).find(c => /^(?:choice|c)(\d+)$/i.test(c));
                                    let choiceNum = choiceClass ? choiceClass.replace(/^[^\d]+/, '') : String(dragHomes.indexOf(matchingDrag) + 1);

                                    if (hiddenInput && choiceNum) {
                                        hiddenInput.value = choiceNum;
                                        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
                                        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
                                        hiddenInput.dispatchEvent(new Event('blur', { bubbles: true }));
                                    }

                                    matchingDrag.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                    dropZone.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                                    dropZone.innerText = targetAns;
                                    dropZone.style.outline = `2px solid ${sourceColor}`;
                                    dropZone.style.fontWeight = '700';

                                    showToast(`Placed: ${targetAns}`);
                                    hint.style.background = 'rgba(16, 185, 129, 0.2)';
                                    const btn = hint.querySelector('.amaes-drag-btn');
                                    if (btn) btn.innerText = '✓ Placed';
                                };

                                hint.onclick = placeFn;
                                const placeBtn = hint.querySelector('.amaes-drag-btn');
                                if (placeBtn) placeBtn.onclick = placeFn;

                                if (dropZone.parentElement && dropZone.parentElement !== que) {
                                    dropZone.parentElement.appendChild(hint);
                                } else {
                                    dropZone.insertAdjacentElement('afterend', hint);
                                }

                                // Auto-place when autoPickQuiz is enabled and auto-quiz is running, or user triggered manual select
                                const canAutoPick = isManualSelect || (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode));
                                if (canAutoPick) {
                                    placeFn();
                                }
                            }
                        }
                    });

                    // Only consider the question matched if ALL drop zones are matched!
                    if (matchedDragCount === dropZones.length) {
                        foundMatchForQuestion = true;
                    } else if (matchedDragCount > 0) {
                        let partialBanner = que.querySelector('.amaes-partial-drag-hint');
                        if (!partialBanner) {
                            partialBanner = document.createElement('div');
                            partialBanner.className = 'amaes-partial-drag-hint';
                            partialBanner.style.cssText = `
                                font-size: 11px;
                                margin-top: 6px;
                                margin-bottom: 6px;
                                padding: 6px 10px;
                                background: rgba(245, 158, 11, 0.12);
                                border-left: 3px solid #f59e0b;
                                border-radius: 4px;
                                color: #b45309;
                                display: flex;
                                align-items: center;
                                gap: 6px;
                            `;
                            partialBanner.innerHTML = `
                                <span style="font-weight: 700;">Partial Answer Known:</span>
                                <span>Matched ${matchedDragCount} of ${dropZones.length} blanks. Please review and place remaining blanks manually.</span>
                            `;
                            const formulation = que.querySelector('.formulation, .content') || que;
                            formulation.insertBefore(partialBanner, formulation.firstChild);
                        }
                    }
                }
            }

            if (!foundMatchForQuestion) {
                if (checkIsQuizAttemptPage() && !que.querySelector('.amaes-unanswered-hint') && !que.querySelector('.amaes-blockage-hud')) {
                    const formulation = que.querySelector('.formulation, .content') || que;
                    const hint = document.createElement('div');
                    hint.className = 'amaes-unanswered-hint';
                    hint.style.cssText = `
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        margin-bottom: 8px;
                        padding: 4px 10px;
                        background: rgba(245, 158, 11, 0.1);
                        border: 1px solid rgba(245, 158, 11, 0.35);
                        border-left: 3px solid #f59e0b;
                        border-radius: 6px;
                        font-size: 10.5px;
                        color: #d97706;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    `;
                    hint.innerHTML = `
                        <span style="background: rgba(245, 158, 11, 0.22); color: #d97706; padding: 1px 5px; border-radius: 4px; font-weight: 800; font-size: 9px; letter-spacing: 0.5px;">NEW</span>
                        <span>No answer known to the system yet — <b>be the first to answer and share it!</b></span>
                    `;
                    formulation.insertBefore(hint, formulation.firstChild);
                }
            } else {
                matchedCount++;
            }

            if (typeof updateQuestionAiDrawerState === 'function') {
                updateQuestionAiDrawerState(que);
            }
        });

        return { matched: matchedCount, total: queContainers.length };
    }

