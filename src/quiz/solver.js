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

        const thisPageIndices = [];
        buttons.forEach((btn, idx) => {
            const isCurrent = btn.classList.contains('thispage') || btn.getAttribute('aria-current') === 'true';
            if (isCurrent) thisPageIndices.push(idx);

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
                isCurrent: false,
                isAnswered
            });
        });

        if (thisPageIndices.length === 1) {
            currentIndex = thisPageIndices[0];
        } else if (thisPageIndices.length > 1) {
            // Multi-question page: resolve active question card on screen
            let activeQue = userSelectedActiveQuestion;
            if (!activeQue || !document.contains(activeQue)) {
                activeQue = document.querySelector('.que.amaes-active-focus-que');
            }
            if (!activeQue) {
                const blockedQue = document.querySelector('.que .amaes-blockage-hud')?.closest('.que');
                if (blockedQue) activeQue = blockedQue;
            }
            if (activeQue) {
                const qData = extractQuestionData(activeQue);
                const qNum = qData ? qData.qNum : null;
                if (qNum) {
                    const matchIdx = questionList.findIndex(q => q.qNum === qNum);
                    if (matchIdx >= 0) currentIndex = matchIdx;
                }
            }
            // Fallback: first unanswered question among this page's questions, or the first question on this page
            if (currentIndex < 0) {
                const firstUnanswered = thisPageIndices.find(idx => !questionList[idx].isAnswered);
                currentIndex = (firstUnanswered !== undefined) ? firstUnanswered : thisPageIndices[0];
            }
        } else if (questionList.length > 0) {
            currentIndex = 0;
        }

        if (currentIndex >= 0 && currentIndex < questionList.length) {
            questionList[currentIndex].isCurrent = true;
        }

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

    // Helper to find the Previous Page button on Moodle Quiz Attempt page
    function findQuizPrevButton() {
        let btn = document.querySelector(
            '#responseform .submitbtns input[name="previous"], ' +
            '#responseform .submitbtns button[name="previous"], ' +
            '#responseform .submitbtns input[value*="Previous page"], ' +
            '#responseform .submitbtns button[value*="Previous page"], ' +
            '#responseform .submitbtns input[value*="Previous"], ' +
            '#responseform .submitbtns button[value*="Previous"], ' +
            '.submitbtns input[name="previous"], ' +
            '.submitbtns button[name="previous"], ' +
            '.submitbtns input[value*="Previous page"], ' +
            '.submitbtns button[value*="Previous page"], ' +
            '.submitbtns input[value*="Previous"], ' +
            '.submitbtns button[value*="Previous"], ' +
            'input[name="previous"].mod_quiz-prev-nav, ' +
            '#mod_quiz-prev-nav, ' +
            '.mod_quiz-prev-nav'
        );

        if (!btn) {
            const submits = document.querySelectorAll('#responseform input[type="submit"], #responseform button[type="submit"]');
            for (const s of submits) {
                const val = (s.value || s.innerText || '').toLowerCase();
                if (val.includes('prev') || val.includes('back')) {
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
            const textInputs = que.querySelectorAll('input[type="text"], input.form-control, textarea, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="reset"])');
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
        let answered = false;
        const radios = que.querySelectorAll('.answer input[type="radio"]');
        if (radios.length > 0) {
            answered = Array.from(radios).some(input => input.checked);
        } else {
            const checkboxes = que.querySelectorAll('.answer input[type="checkbox"]');
            if (checkboxes.length > 0) {
                const highlighted = que.querySelectorAll('.amaes-highlighted-choice input[type="checkbox"]');
                answered = highlighted.length > 0
                    ? Array.from(highlighted).every(input => input.checked)
                    : Array.from(checkboxes).some(input => input.checked);
            } else {
                const selects = que.querySelectorAll('select');
                if (selects.length > 0) {
                    answered = Array.from(selects).every(select => select.value && select.value !== '0');
                } else {
                    const textInputs = que.querySelectorAll(
                        'input[type="text"], input.form-control, textarea, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="reset"])'
                    );
                    if (textInputs.length > 0) {
                        answered = Array.from(textInputs).every(input => input.value && input.value.trim());
                    } else {
                        const placeInputs = que.querySelectorAll('input.placeinput, input[type="hidden"][name*="_p"]');
                        const dropZones = que.querySelectorAll('.drop, .dropzone, span.droptarget, .droppable');
                        if (placeInputs.length > 0 || dropZones.length > 0) {
                            answered = placeInputs.length > 0 &&
                                Array.from(placeInputs).every(input => input.value && input.value !== '0' && input.value.trim());
                        } else {
                            const anyInputs = que.querySelectorAll('input:not([type="hidden"]), select, textarea');
                            if (anyInputs.length > 0) {
                                const hasChecked = Array.from(anyInputs).some(i => (i.type === 'radio' || i.type === 'checkbox') && i.checked);
                                const hasValue = Array.from(anyInputs).some(i => i.type !== 'radio' && i.type !== 'checkbox' && i.value && i.value.trim() && i.value !== '0');
                                answered = Boolean(hasChecked || hasValue);
                            } else {
                                answered = que.classList.contains('answered') || que.classList.contains('complete');
                            }
                        }
                    }
                }
            }
        }
        que.dataset.answered = answered ? 'true' : 'false';
        return answered;
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

    function findPreviousQuestionOnCurrentPage(sourceQue) {
        const questions = Array.from(document.querySelectorAll('.que'));
        if (questions.length < 2) return null;
        const currentIndex = sourceQue ? questions.indexOf(sourceQue) : -1;
        if (currentIndex > 0) {
            return questions[currentIndex - 1];
        }
        return null;
    }

    function findFirstUnansweredOnCurrentPage() {
        const questions = Array.from(document.querySelectorAll('.que'));
        return questions.find(que => !isQuestionAnswered(que)) || null;
    }

    function isConfirmedCandidate(item) {
        if (!item) return false;
        const src = String(item.source || '').toLowerCase();
        const evType = String(item.evidenceType || '').toLowerCase();
        const trustedSource = [
            'review_screen',
            'moodle_review',
            'moodle_review_verified',
            'moodle_100_percent',
            'verified_db'
        ].includes(src);
        const trustedEvidence = ['moodle_review', '100_percent', 'moodle_100_percent', 'moodle_review_elimination'].includes(evType);
        const unconfirmedSource = /community|gemini|(^|[^a-z])ai([^a-z]|$)|amauoed|jennysonline/.test(src);

        // Unconfirmed source labels are overridden only by explicit Moodle evidence.
        if ((unconfirmedSource || item.isAiSuggestion) && !trustedEvidence) {
            return false;
        }

        if (item.verified !== true) return false;

        // Only exact, traceable evidence labels qualify. A low/high overall
        // score or a generic "deduced" flag does not prove an answer.
        return trustedSource || trustedEvidence;
    }

    function getStudyGuideInfo(item) {
        const sources = [item && item.source, ...(Array.isArray(item && item.sources) ? item.sources : [])]
            .map(source => String(source || '').toLowerCase())
            .join(' ');
        if (sources.includes('jennysonline') || sources.includes("jenny's online")) {
            return {
                label: "Jenny's Online",
                url: item.sourceUrl || 'https://jennysonline.blogspot.com/2021/03/information-assurance-and-security-1.html'
            };
        }
        if (sources.includes('amauoed')) {
            const subCode = detectCourseInfo().subjectCode || 'CS6301';
            return {
                label: 'AMAUOED',
                url: getStoredAmauoedUrl(subCode) || 'https://amauoed.com/courses'
            };
        }
        return null;
    }

    function setQuestionStudyGuideTag(que, label) {
        if (!que) return;
        que.querySelectorAll('.amaes-study-guide-question-tag').forEach(el => el.remove());
        const formulation = que.querySelector('.formulation, .content') || que;
        const tag = document.createElement('div');
        tag.className = 'amaes-study-guide-question-tag';
        tag.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-bottom: 8px;
            padding: 4px 10px;
            background: rgba(2, 132, 199, 0.09);
            border: 1px solid rgba(2, 132, 199, 0.32);
            border-left: 3px solid #0284c7;
            border-radius: 6px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            font-size: 11px;
            line-height: 1.35;
            box-sizing: border-box;
        `;
        tag.title = `This answer matches an unverified ${label} study-guide suggestion. Review before submitting.`;
        tag.innerHTML = `
            <span style="display: inline-flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span style="background: #0284c7; color: #ffffff !important; padding: 2px 7px; border-radius: 4px; font-weight: 800; font-size: 9.5px; letter-spacing: 0.4px;">STUDY-GUIDE MATCH</span>
                <span style="color: #0369a1; font-weight: 700;">Suggested by ${escapeHtml(label)}</span>
                <span style="color: #0369a1; font-size: 10px;">(Unverified — review before submitting)</span>
            </span>
        `;
        const qtextElem = que.querySelector('.qtext, .formulation .qtext');
        if (qtextElem && qtextElem.parentNode === formulation) {
            formulation.insertBefore(tag, qtextElem);
        } else {
            formulation.insertBefore(tag, formulation.firstChild);
        }
    }

    // Contextual in-question action chip guiding students when unsure or stuck
    function renderUnsureActionChip(que) {
        if (!que || que.querySelector('.amaes-unsure-help-chip') || que.querySelector('.amaes-blockage-hud') || que.querySelector('.amaes-new-question-focus-banner') || checkIsReviewPage()) return;
        const formulation = que.querySelector('.formulation, .content') || que;
        const chip = document.createElement('div');
        chip.className = 'amaes-unsure-help-chip';
        chip.style.cssText = `
            display: inline-flex;
            align-items: center;
            gap: 8px;
            margin-top: 8px;
            margin-bottom: 6px;
            padding: 6px 12px;
            background: rgba(59, 130, 246, 0.08);
            border: 1px solid rgba(59, 130, 246, 0.25);
            border-radius: 6px;
            font-size: 11px;
            color: var(--accent-blue, #3b82f6);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            cursor: pointer;
            user-select: none;
            transition: all 0.2s ease;
        `;
        chip.title = 'Click to skip to the next question or page';
        chip.innerHTML = `
            <span style="display:inline-flex; align-items:center;">${ICONS.lightbulb}</span>
            <span>Unsure? Pick an answer or press <kbd style="background: rgba(59, 130, 246, 0.2); color: #3b82f6; font-weight: 800; padding: 1px 5px; border-radius: 3px; font-size: 10px; border: 1px solid rgba(59, 130, 246, 0.35); font-family: monospace;">N</kbd> to skip to next question</span>
            <span style="margin-left: auto; font-weight: 700; font-size: 10.5px; opacity: 0.85;">Skip &rarr;</span>
        `;
        chip.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (typeof triggerNextQuizPage === 'function') {
                triggerNextQuizPage();
            } else {
                const nextBtn = document.querySelector('.submitbtns input[value*="Next"], input[value*="Next page"], button[value*="Next"]');
                if (nextBtn) nextBtn.click();
            }
        };
        formulation.appendChild(chip);
    }

    // Connects keyboard shortcut [N] directly to the Moodle Next Page button on screen
    // Connects keyboard shortcut [N] directly inside Moodle's native Next Page button on screen
    function updateNextButtonIndicator() {
        if (!checkIsQuizAttemptPage()) return;
        const nextBtn = findQuizNextButton() || document.querySelector('.submitbtns input[type="submit"], .submitbtns button[type="submit"], input[value*="Next page"], input[value*="Next"], button[value*="Next"]');
        if (!nextBtn) return;

        // Unify text directly into Moodle's native button HTML / label
        if (!nextBtn.dataset.amaesOriginalText) {
            nextBtn.dataset.amaesOriginalText = nextBtn.tagName === 'INPUT' ? nextBtn.value : nextBtn.textContent;
        }
        const orig = nextBtn.dataset.amaesOriginalText || 'Next page';
        if (!orig.includes('(Press N)')) {
            const unifiedText = `${orig.trim()} (Press N)`;
            if (nextBtn.tagName === 'INPUT') {
                nextBtn.value = unifiedText;
            } else {
                nextBtn.textContent = unifiedText;
            }
        }

        // Clean up standalone beacon to unify directly into Moodle button
        document.getElementById('amaes-next-btn-beacon')?.remove();
    }

    // High-visibility focused banner for unanswered questions: clear, non-technical guidance and 1-click actions
    function renderNewQuestionFocusBanner(que, qNum) {
        if (!que || checkIsReviewPage()) return;
        // Clean up any stale hints/chips on this question to guarantee a single banner
        que.querySelectorAll('.amaes-unanswered-hint, .amaes-unsure-help-chip, .amaes-ai-fallback-bar, .amaes-new-question-focus-banner, .amaes-blockage-hud').forEach(el => el.remove());
        const formulation = que.querySelector('.formulation, .content') || que;

        const banner = document.createElement('div');
        banner.className = 'amaes-new-question-focus-banner';
        banner.style.cssText = `
            margin-bottom: 12px;
            padding: 10px 14px;
            background: #fffbeb;
            border: 1.5px solid #f59e0b;
            border-radius: 8px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.1);
            box-sizing: border-box;
            color: #78350f;
            transition: all 0.2s ease;
        `;
        const isMatchBanner = que && ((typeof identifyQuestionType === 'function' && identifyQuestionType(que) === 'match') ||
            que.classList.contains('match') ||
            que.classList.contains('qtype_match') ||
            que.querySelectorAll('select').length > 1);

        banner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 6px;">
                    <span style="background: #f59e0b; color: #ffffff; padding: 2px 7px; border-radius: 4px; font-weight: 800; font-size: 10px; letter-spacing: 0.5px;">NO SAVED ANSWER</span>
                    <span style="font-weight: 700; color: #92400e; font-size: 12px;">Question #${qNum || ''}: No saved answer yet</span>
                </div>
                ${isMatchBanner ? '' : '<span style="font-size: 10.5px; color: #b45309; font-weight: 600;">Question copied</span>'}
            </div>
            <div class="amaes-focus-instruction" style="font-size: 11.5px; color: #78350f; line-height: 1.45; margin-bottom: 8px;">
                ${isMatchBanner ?
                    '<b>No saved answers for these matching items yet.</b> Select the matching choices below, or consult Web AI tools above.' :
                    '<b>Question copied to clipboard!</b> Pick an answer below or click <b>Next Question</b>, or use the AI tools at the side or bottom.'
                }
                <div style="font-size: 10.5px; color: #b45309; margin-top: 2px;">No answer known to the system yet — <b>be the first to answer and share it!</b></div>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <button type="button" class="amaes-btn-skip-q" style="
                    display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; margin-left: auto;
                "><span>Next Question &rarr;</span></button>
            </div>
        `;

        const skipBtn = banner.querySelector('.amaes-btn-skip-q');
        if (skipBtn) {
            skipBtn.onclick = (e) => {
                e.preventDefault();
                if (typeof triggerNextQuizPage === 'function') {
                    triggerNextQuizPage();
                } else {
                    const nextBtn = document.querySelector('.submitbtns input[value*="Next"], input[value*="Next page"], button[value*="Next"]');
                    if (nextBtn) nextBtn.click();
                }
            };
        }

        // Choice selection visual feedback
        const choiceInputs = que.querySelectorAll('input[type="radio"], input[type="checkbox"]');
        choiceInputs.forEach(input => {
            input.addEventListener('change', () => {
                const instr = banner.querySelector('.amaes-focus-instruction');
                if (instr) {
                    banner.style.borderColor = '#10b981';
                    banner.style.background = '#f0fdf4';
                    banner.style.color = '#065f46';
                    instr.innerHTML = `<span style="color: #047857; font-weight: 700;">Answer selected!</span> <span style="color: #065f46;">Click <b>Next Question</b> when ready.</span>`;
                }
            }, { once: true });
        });

        formulation.insertBefore(banner, formulation.firstChild);
    }

    function saveQuizAttemptSummary(subCode, data) {
        if (!data || typeof data.percentage !== 'number') return;
        const sCode = subCode || (detectCourseInfo().subjectCode) || 'GENERAL';
        try {
            localStorage.setItem(`amaes_quiz_summary_${sCode}`, JSON.stringify(data));
            if (data.isReviewPermitted === false) {
                localStorage.setItem(`amaes_course_reviewability_${sCode}`, JSON.stringify({
                    status: 'restricted-observed',
                    observedAt: data.recordedAt || Date.now()
                }));
            }
            const quizId = getQuizStorageId();
            if (quizId) {
                localStorage.setItem(`amaes_quiz_summary_${sCode}_${quizId}`, JSON.stringify(data));
            }
        } catch (_) {}
    }

    function reportCourseReviewRestriction(subCode) {
        const code = String(subCode || '').toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        if (!code || code === 'GENERAL' || code === 'DEFAULT') return;
        const key = `amaes_reviewability_reported_${code}`;
        try {
            const reportedAt = Number(localStorage.getItem(key) || 0);
            if (Date.now() - reportedAt < 24 * 60 * 60 * 1000) return;
            localStorage.setItem(key, String(Date.now()));
            fetch(`${communityRelayUrl}/course-reviewability/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-AMAES-Installation': getAnonymousContributorId(),
                    'X-AMAES-Client-Version': CLIENT_VERSION
                },
                body: JSON.stringify({ subjectCode: code, reviewPermitted: false })
            }).then(response => {
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                logDebug(`Restricted quiz review observed for ${code}; anonymous course status report submitted.`);
            }).catch(error => {
                localStorage.removeItem(key);
                logDebug(`Course reviewability report note for ${code}: ${error.message}`);
            });
        } catch (error) {
            logDebug(`Course reviewability report note for ${code}: ${error.message}`);
        }
    }

    function getQuizAttemptSummary(subCode = '') {
        const sCode = subCode || (detectCourseInfo().subjectCode) || 'GENERAL';
        try {
            const quizId = getQuizStorageId();
            if (quizId) {
                const specific = localStorage.getItem(`amaes_quiz_summary_${sCode}_${quizId}`);
                return specific ? JSON.parse(specific) : null;
            }
            const general = localStorage.getItem(`amaes_quiz_summary_${sCode}`);
            if (general) return JSON.parse(general);
            return null;
        } catch (_) {
            return null;
        }
    }

    function getQuizStorageId() {
        const params = new URLSearchParams(window.location.search);
        return params.get('cmid') || params.get('id') || params.get('q') || params.get('quiz') || '';
    }

    function cleanFillBlankAnswer(ans) {
        if (!ans) return '';
        let clean = String(ans).trim();
        clean = clean.replace(/^["'“”]+|["'“”]+$/g, '').trim();
        clean = clean.replace(/^(?:(?:question|item|q)\s*(?:no\.?|#)?\s*\d+[\s:.-]+|\(\d+\)|\d+[.)])\s+|^answer\s*[:.-]\s*/i, '').trim();
        clean = clean.replace(/^[a-e][.)]\s*/i, '').trim();
        return clean;
    }

    function getAttemptEvidenceKey() {
        const params = new URLSearchParams(window.location.search);
        const attemptId = params.get('attempt');
        if (attemptId) return `amaes_attempt_evidence_${attemptId}`;
        const quizId = getQuizStorageId();
        const mappedAttemptId = quizId ? sessionStorage.getItem(`amaes_current_attempt_${quizId}`) : '';
        return `amaes_attempt_evidence_${mappedAttemptId || quizId || 'latest'}`;
    }

    function recordAttemptAnswerEvidence(que, answer, source = 'manual_selection', metadata = {}) {
        if (!que || !answer) return;
        const qData = extractQuestionData(que);
        const qText = metadata.subQuestionText || (qData && qData.qText);
        if (!qText) return;
        try {
            const key = getAttemptEvidenceKey();
            const attemptId = new URLSearchParams(window.location.search).get('attempt');
            const quizId = getQuizStorageId();
            if (attemptId && quizId) {
                sessionStorage.setItem(`amaes_current_attempt_${quizId}`, attemptId);
            }
            const current = JSON.parse(sessionStorage.getItem(key) || '[]');
            const entry = {
                qRaw: qText,
                qNorm: normalizeText(qText),
                ansRaw: String(answer).trim(),
                ansNorm: normalizeChoice(answer),
                choices: metadata.subQuestionText ? [] : (qData.choices || []),
                questionType: metadata.questionType || (metadata.subQuestionText ? 'match_item' : (qData.questionType || (typeof identifyQuestionType === 'function' ? identifyQuestionType(que) : (Array.isArray(qData.choices) && qData.choices.length > 0 ? 'multichoice' : 'shortanswer')))),
                answers: Array.isArray(metadata.answers) ? metadata.answers.map(value => String(value || '').trim()).filter(Boolean) : undefined,
                source,
                isAiSuggestion: source === 'ai_inference',
                verified: Boolean(metadata.verified),
                isAdaptiveProbe: Boolean(metadata.isAdaptiveProbe),
                recordedAt: Date.now()
            };
            const next = current.filter(item => item.qNorm !== entry.qNorm);
            next.push(entry);
            sessionStorage.setItem(key, JSON.stringify(next.slice(-100)));
        } catch (err) {
            logDebug(`Attempt evidence storage note: ${err.message}`);
        }
    }

    function syncCurrentPageSelectionsToEvidence() {
        if (!checkIsQuizAttemptPage()) return;
        const ques = document.querySelectorAll('.que');
        ques.forEach(que => {
            const checkedInputs = Array.from(que.querySelectorAll('.answer input[type="radio"]:checked, .answer input[type="checkbox"]:checked'));
            if (checkedInputs.length > 0) {
                const choiceTexts = checkedInputs.map(input => {
                    const label = input.closest('label') || input.parentElement;
                    return cleanDOMToAI(label).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                }).filter(Boolean);
                const isVerified = Boolean(que.querySelector('.amaes-verified-badge'));
                const isAdaptive = Boolean(que.querySelector('.amaes-adaptive-probe-badge'));
                if (choiceTexts.length > 0) {
                    recordAttemptAnswerEvidence(que, choiceTexts.join(', '), isAdaptive ? 'adaptive_probe' : (isVerified ? 'verified_db' : 'manual'), {
                        verified: isVerified,
                        isAdaptiveProbe: isAdaptive,
                        answers: choiceTexts
                    });
                }
            } else {
                const textInputs = Array.from(que.querySelectorAll('input[type="text"], input.form-control, textarea'));
                if (textInputs.length > 0) {
                    const textAnswers = textInputs.map(input => String(input.value || '').trim());
                    if (textAnswers.every(Boolean)) {
                        recordAttemptAnswerEvidence(que, textAnswers.length === 1 ? textAnswers[0] : textAnswers.join(', '), 'manual_text', { answers: textAnswers });
                    }
                    return;
                }

                const selectInputs = Array.from(que.querySelectorAll('select'));
                if (selectInputs.length > 0) {
                    const isMatch = typeof identifyQuestionType === 'function' && identifyQuestionType(que) === 'match';
                    const matchRows = Array.from(que.querySelectorAll('.answer table tr, .answer tr')).filter(r => r.querySelector('select') && r.querySelector('td.text, td:first-child'));
                    if (isMatch || matchRows.length > 0) {
                        matchRows.forEach(row => {
                            const promptCell = row.querySelector('td.text, td:first-child');
                            const sel = row.querySelector('select');
                            const subQText = promptCell ? cleanDOMToAI(promptCell).trim() : '';
                            const opt = sel && sel.selectedIndex >= 0 ? sel.options[sel.selectedIndex] : null;
                            const text = (opt && opt.value && !opt.text.toLowerCase().includes('choose'))
                                ? String(opt.text || opt.innerText || '').trim()
                                : '';
                            if (subQText && text) {
                                recordAttemptAnswerEvidence(que, text, 'manual_match_select', { answers: [text], subQuestionText: subQText, questionType: 'match_item' });
                            }
                        });
                        return;
                    }
                    // Only record single atomic select answers; never record joined comma blobs for composite questions
                    if (selectInputs.length === 1) {
                        const option = selectInputs[0].selectedIndex >= 0 ? selectInputs[0].options[selectInputs[0].selectedIndex] : null;
                        const text = (option && option.value && !option.text.toLowerCase().includes('choose'))
                            ? String(option.text || option.innerText || '').trim()
                            : '';
                        if (text) {
                            recordAttemptAnswerEvidence(que, text, 'manual_select', { answers: [text] });
                        }
                    }
                }
            }
        });
    }

    function getProbeHistory(subCode = '') {
        const sCode = subCode || (detectCourseInfo().subjectCode) || 'GENERAL';
        try {
            return JSON.parse(localStorage.getItem(`amaes_probe_history_${sCode}_${getQuizStorageId() || 'general'}`) || '{}');
        } catch (_) {
            return {};
        }
    }

    function saveProbeHistory(subCode, history) {
        const sCode = subCode || (detectCourseInfo().subjectCode) || 'GENERAL';
        try {
            localStorage.setItem(`amaes_probe_history_${sCode}_${getQuizStorageId() || 'general'}`, JSON.stringify(history));
        } catch (e) {
            logDebug(`Failed to save probe history: ${e.message}`);
        }
    }

    function getProbeEntry(qText, subCode = '') {
        if (!qText) return null;
        const qNorm = normalizeText(qText);
        const sCode = subCode || (detectCourseInfo().subjectCode) || 'GENERAL';
        const history = getProbeHistory(sCode);
        if (history[qNorm]) return history[qNorm];
        const matchKey = Object.keys(history).find(k => questionTextMatches(k, qNorm));
        return matchKey ? history[matchKey] : null;
    }

    function markProbeQuestionsSolved(subCode, promotedItems) {
        if (!Array.isArray(promotedItems) || promotedItems.length === 0) return;
        const sCode = subCode || (detectCourseInfo().subjectCode) || 'GENERAL';
        const history = getProbeHistory(sCode);
        promotedItems.forEach(item => {
            if (history[item.qNorm]) {
                history[item.qNorm].solved = true;
                history[item.qNorm].verifiedAnswer = item.ansRaw;
            }
        });
        saveProbeHistory(sCode, history);
    }

    function recordAdaptiveProbeAttempt(subCode, evidence, earned, maximum, isReviewPermitted) {
        if (!Array.isArray(evidence) || evidence.length === 0) return;
        const sCode = subCode || (detectCourseInfo().subjectCode) || 'GENERAL';
        const history = getProbeHistory(sCode);
        const percentage = Math.round((earned / maximum) * 100);

        // Update probe tracking history
        evidence.forEach(item => {
            const entry = history[item.qNorm] || {
                qNorm: item.qNorm,
                qRaw: item.qRaw,
                triedChoices: [],
                attempts: []
            };
            const choiceNorm = item.ansNorm;
            if (choiceNorm && !entry.triedChoices.includes(choiceNorm)) {
                entry.triedChoices.push(choiceNorm);
            }
            entry.lastChoice = item.ansRaw;
            entry.lastNorm = choiceNorm;
            entry.lastEarned = earned;
            entry.lastMax = maximum;
            entry.lastPercentage = percentage;
            entry.updatedAt = Date.now();
            entry.attempts.push({
                choice: item.ansRaw,
                norm: choiceNorm,
                earned,
                maximum,
                percentage,
                date: Date.now()
            });
            history[item.qNorm] = entry;
        });

        saveProbeHistory(sCode, history);
    }

    function getUnreviewedAttemptEntry(qText, subCode = '') {
        if (!qText) return null;
        const qNorm = normalizeText(qText);
        const sCode = subCode || (detectCourseInfo().subjectCode) || 'GENERAL';
        try {
            const history = JSON.parse(localStorage.getItem(`amaes_unreviewed_history_${sCode}_${getQuizStorageId() || 'general'}`) || '[]');
            return history.find(h => questionTextMatches(h.qNorm || h.qRaw, qNorm)) || null;
        } catch (_) {
            return null;
        }
    }

    function saveUnreviewedAttemptEvidence(subCode, evidence, earned, maximum, isReviewPermitted) {
        if (!Array.isArray(evidence) || evidence.length === 0) return;
        const sCode = subCode || 'GENERAL';
        const storageKey = `amaes_unreviewed_history_${sCode}_${getQuizStorageId() || 'general'}`;
        try {
            const current = JSON.parse(localStorage.getItem(storageKey) || '[]');
            const percentage = Math.round((earned / maximum) * 100);
            evidence.forEach(item => {
                const existingIndex = current.findIndex(c => questionTextMatches(c.qNorm || c.qRaw, item.qNorm));
                const entry = {
                    qNorm: item.qNorm,
                    qRaw: item.qRaw,
                    selectedAnswer: item.ansRaw,
                    ansNorm: item.ansNorm,
                    choices: item.choices || [],
                    earned,
                    maximum,
                    percentage,
                    isReviewPermitted,
                    recordedAt: Date.now()
                };
                if (existingIndex >= 0) {
                    current[existingIndex] = entry;
                } else {
                    current.push(entry);
                }
            });
            localStorage.setItem(storageKey, JSON.stringify(current.slice(-200)));
        } catch (e) {
            logDebug(`Failed to save unreviewed attempt evidence: ${e.message}`);
        }
    }

    function showUnreviewableQuizRetryWarning(summary) {
        if (!checkIsQuizViewPage() || !summary) return;
        const retryControl = document.querySelector('a[href*="attempt.php"], input[name="startattempt"], button[name="startattempt"]');
        const attemptTable = document.querySelector('.quizattemptsummary, .generaltable.quizattemptsummary, .quizsummarytable');
        const anchor = retryControl || attemptTable;
        if (!anchor) return;

        let warning = document.getElementById('amaes-unreviewable-retry-warning');
        if (!warning) {
            warning = document.createElement('div');
            warning.id = 'amaes-unreviewable-retry-warning';
            warning.setAttribute('role', 'note');
            warning.style.cssText = 'margin: 12px 0; padding: 12px 14px; border-left: 4px solid #f59e0b; border-radius: 6px; background: rgba(245, 158, 11, 0.12); color: inherit; font-size: 12.5px; line-height: 1.5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';
            if (retryControl) {
                (retryControl.closest('form, .singlebutton, .quizattempt') || retryControl.parentElement).insertAdjacentElement('beforebegin', warning);
            } else {
                attemptTable.insertAdjacentElement('afterend', warning);
            }
        }

        const isLowScore = typeof summary.percentage === 'number' && summary.percentage < 80;
        const isCritical = typeof summary.percentage === 'number' && summary.percentage < 70;
        const courseInfo = (typeof detectCourseInfo === 'function') ? detectCourseInfo() : {};
        const subCode = courseInfo.subjectCode || 'GENERAL';
        const quizTitle = (typeof getQuizTitle === 'function' ? getQuizTitle() : '') || document.title;

        if (summary.isReviewPermitted === false) {
            const isHighestGrade = /grading method\s*:\s*highest grade/i.test(document.body.innerText || '');
            warning.innerHTML = `
                <div style="font-weight: 700; color: #f59e0b; margin-bottom: 4px;">Review is not permitted for the previous attempt (${summary.percentage}% overall)</div>
                <div>This score does not identify which individual answers were correct. Your first attempt is only the available baseline, not proof of which answers were right; a retry may score lower. Check the grading method and attempt limit before retrying.${isHighestGrade ? ' Moodle currently lists Highest grade for this quiz.' : ''}</div>
                ${isLowScore ? `
                <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                    <button id="amaes-btn-warning-report-bug" type="button" style="padding: 4px 10px; background: #ef4444; color: #fff; border: none; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;">
                        Report Quiz Anomaly (${summary.percentage}%)
                    </button>
                    <span style="font-size: 11px; color: #94a3b8;">Score is below passable grade (80%)</span>
                </div>` : ''}
            `;
        } else if (isLowScore) {
            warning.style.borderLeftColor = isCritical ? '#ef4444' : '#f59e0b';
            warning.style.background = isCritical ? 'rgba(239, 68, 68, 0.12)' : 'rgba(245, 158, 11, 0.12)';
            warning.innerHTML = `
                <div style="font-weight: 700; color: ${isCritical ? '#f87171' : '#f59e0b'}; margin-bottom: 4px;">
                    Attempt Score Alert: ${summary.percentage}% (Below 80% Passing Cutoff)
                </div>
                <div>Your latest attempt scored below the 80% passing grade. If the quiz has a review link above, open the review so the toolkit can harvest confirmed wrong answers. If answers were missing or incorrect, please report them below.</div>
                <div style="margin-top: 8px; display: flex; align-items: center; gap: 8px;">
                    <button id="amaes-btn-warning-report-bug" type="button" style="padding: 4px 10px; background: #ef4444; color: #fff; border: none; border-radius: 4px; font-size: 11px; font-weight: 700; cursor: pointer;">
                        Report Quiz Anomaly (${summary.percentage}%)
                    </button>
                </div>
            `;
        } else {
            warning.remove();
            return;
        }

        const reportBtn = warning.querySelector('#amaes-btn-warning-report-bug');
        if (reportBtn) {
            reportBtn.onclick = () => {
                if (typeof showBugReportModal === 'function') {
                    showBugReportModal({
                        subjectCode: subCode,
                        description: `Quiz "${quizTitle}" scored ${summary.percentage}% (below 80% passing grade). Answers appear outdated, missing, or incorrect.`
                    });
                }
            };
        }
    }

    function promoteAttemptEvidenceFromScore() {
        if (!checkIsQuizSummaryPage() && !checkIsQuizViewPage()) return;
        const initialCourseCode = (detectCourseInfo().subjectCode) || 'GENERAL';
        showUnreviewableQuizRetryWarning(getQuizAttemptSummary(initialCourseCode));
        let earned = null;
        let maximum = null;
        let isReviewPermitted = null;

        document.querySelectorAll('table, .quizattemptsummary, .generaltable').forEach(table => {
            if (earned !== null) return;
            const rows = Array.from(table.querySelectorAll('tr'));
            const headerRow = rows.find(row => Array.from(row.children).some(cell => /grade|marks/i.test(cell.innerText || '')));
            const attemptRows = rows.filter(row => /finished|submitted|complete/i.test(row.innerText || ''));
            if (attemptRows.length === 0) return;
            const latest = attemptRows[attemptRows.length - 1];

            // 1. Direct cell parsing (e.g. cell has "15.00 / 20.00" or "75.00 / 100.00")
            for (const cell of latest.children) {
                const text = (cell.innerText || '').trim();
                const slashMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)/);
                if (slashMatch) {
                    earned = Number(slashMatch[1]);
                    maximum = Number(slashMatch[2]);
                    break;
                }
            }

            // 2. Header-based parsing if no slash in cell
            if (earned === null && headerRow) {
                const headers = Array.from(headerRow.children);
                const marksIndex = headers.findIndex(cell => /marks/i.test(cell.innerText || ''));
                const gradeIndex = headers.findIndex(cell => /grade/i.test(cell.innerText || ''));
                const targetIndex = marksIndex >= 0 ? marksIndex : gradeIndex;

                if (targetIndex >= 0 && latest.children[targetIndex]) {
                    const headerText = headers[targetIndex].innerText || '';
                    const headerMax = headerText.match(/\/\s*([0-9]+(?:\.[0-9]+)?)/);
                    const cellVal = (latest.children[targetIndex].innerText || '').match(/([0-9]+(?:\.[0-9]+)?)/);
                    if (cellVal && headerMax) {
                        earned = Number(cellVal[1]);
                        maximum = Number(headerMax[1]);
                    }
                }
            }

            // 3. Review permission check
            const reviewIndex = headerRow ? Array.from(headerRow.children).findIndex(cell => /review/i.test(cell.innerText || '')) : -1;
            if (reviewIndex >= 0 && latest.children[reviewIndex]) {
                const revText = (latest.children[reviewIndex].innerText || '').toLowerCase();
                if (revText.includes('not permitted') || revText.includes('not allowed')) {
                    isReviewPermitted = false;
                } else if (latest.querySelector('a[href*="review.php"]')) {
                    isReviewPermitted = true;
                }
            } else {
                const hasReviewLink = Boolean(latest.querySelector('a[href*="review.php"]'));
                if (hasReviewLink) isReviewPermitted = true;
            }
        });

        // 4. Overall feedback fallback parsing if table wasn't matched
        if (earned === null || maximum === null) {
            const feedbackText = document.body.innerText || '';
            const gradeMatch = feedbackText.match(/(?:overall\s+feedback|grade\s+for\s+this\s+quiz)[^0-9]*([0-9]+(?:\.[0-9]+)?)\s*\/\s*([0-9]+(?:\.[0-9]+)?)/i);
            if (gradeMatch) {
                earned = Number(gradeMatch[1]);
                maximum = Number(gradeMatch[2]);
            }
        }

        if (earned === null || maximum === null) return;
        if (!Number.isFinite(earned) || !Number.isFinite(maximum) || maximum <= 0) return;

        const courseInfo = detectCourseInfo();
        const subCode = courseInfo.subjectCode || 'GENERAL';
        const percentage = Math.round((earned / maximum) * 100);

        // Always record latest quiz attempt summary even if prior attempt was done manually without toolkit
        saveQuizAttemptSummary(subCode, {
            earned,
            maximum,
            percentage,
            isReviewPermitted,
            recordedAt: Date.now()
        });
        if (isReviewPermitted === false) reportCourseReviewRestriction(subCode);
        showUnreviewableQuizRetryWarning({ percentage, isReviewPermitted });

        let evidence = [];
        try {
            evidence = JSON.parse(sessionStorage.getItem(getAttemptEvidenceKey()) || '[]');
        } catch (_) {}
        if (!Array.isArray(evidence) || evidence.length === 0) return;

        function dispatchQuizLowScoreAnomaly(subCode, earned, maximum, percentage, evidence) {
            if (percentage >= 80) return;
            const isCritical = percentage < 70;
            const quizTitle = (typeof getQuizTitle === 'function' ? getQuizTitle() : '') || (document.title ? document.title.replace(/\s*\|.*$/, '').trim() : 'Quiz Attempt');

            if (typeof detectAndReportQuestionAnomaly === 'function' && Array.isArray(evidence) && evidence.length > 0) {
                const sampleQue = evidence[0];
                const samplePrompt = sampleQue ? (sampleQue.qRaw || sampleQue.qText || '') : `Quiz scored ${earned}/${maximum} (${percentage}%) in ${subCode}`;
                detectAndReportQuestionAnomaly({
                    anomalyType: isCritical ? 'LOW_QUIZ_SCORE_CRITICAL' : 'QUIZ_SCORE_BELOW_PASSING',
                    subjectCode: subCode,
                    activityTitle: quizTitle,
                    questionRaw: samplePrompt,
                    questionNorm: (typeof normalizeText === 'function' ? normalizeText(samplePrompt) : samplePrompt.toLowerCase()).slice(0, 100),
                    domType: 'quiz_attempt_score',
                    submittedAnswer: `Attempt scored ${earned}/${maximum} (${percentage}%) across ${evidence.length} questions`,
                    markScored: earned,
                    maxMark: maximum,
                    attemptHistory: evidence.slice(0, 5).map(e => `${(e.qRaw || e.qText || '').slice(0, 40)}: ${e.ansRaw || 'N/A'}`),
                    dbCandidate: null
                });
            }

            const alertMsg = isCritical
                ? `Quiz score (${earned}/${maximum} - ${percentage}%) is critical (<70%). Anomaly telemetry dispatched.`
                : `Quiz score (${earned}/${maximum} - ${percentage}%) is below passable grade (80%).`;
            setLog(`[Score Anomaly] ${alertMsg}`, 'var(--accent-amber)');

            if (typeof showToast === 'function') {
                showToast(`${alertMsg} Click to report question issues.`, 8000, () => {
                    if (typeof showBugReportModal === 'function') {
                        showBugReportModal({
                            subjectCode: subCode,
                            description: `Quiz "${quizTitle}" scored ${earned}/${maximum} (${percentage}%). One or more questions appear to have mismatched, rotated, or incorrect answers.`
                        });
                    }
                });
            }
        }

        if (isReviewPermitted !== true) {
            if (earned < maximum) {
                saveUnreviewedAttemptEvidence(subCode, evidence, earned, maximum, isReviewPermitted);
                setLog(`Attempt score recorded (${earned}/${maximum} - ${percentage}%). Review permission is ${isReviewPermitted === false ? 'restricted' : 'unknown'}; overall scores cannot verify individual answers, so these answers were not promoted or shared.`, 'var(--accent-amber)');
                dispatchQuizLowScoreAnomaly(subCode, earned, maximum, percentage, evidence);
                return;
            }
        }

        if (earned < maximum) {
            saveUnreviewedAttemptEvidence(subCode, evidence, earned, maximum, isReviewPermitted);
            recordAdaptiveProbeAttempt(subCode, evidence, earned, maximum, isReviewPermitted);
            setLog(`Attempt score recorded (${earned}/${maximum} - ${percentage}%). This overall score does not identify which individual answers were correct. Unconfirmed choices remain unverified.`, 'var(--accent-amber)');
            dispatchQuizLowScoreAnomaly(subCode, earned, maximum, percentage, evidence);
            return;
        }

        const promoted = evidence.map(item => ({
            ...item,
            verified: true,
            isAiSuggestion: false,
            source: 'moodle_100_percent',
            evidenceType: 'moodle_100_percent'
        }));
        mergeAnswersIntoCache(subCode, promoted, 'moodle_100_percent');
        markProbeQuestionsSolved(subCode, promoted);
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

        const effectiveDelay = fastQuizMode ? Math.min(delayMs, 200) : delayMs;
        const nextOnPage = findNextUnansweredOnCurrentPage(sourceQue);
        if (nextOnPage) {
            clearTimeout(autoNextTimer);
            const secText = (effectiveDelay / 1000).toFixed(1) + 's';
            setLog(`<b>Question Answered:</b> Moving to the next unanswered question in <b>${secText}</b>...`, "var(--accent-blue)");
            showToast("Answer recorded! Moving to next...", 1000);
            autoNextTimer = setTimeout(() => {
                if (!autoQuizMode) return;
                setActiveQuestion(nextOnPage, false);
                nextOnPage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                runAutoQuizSolver();
            }, effectiveDelay);
            return;
        }

        if (!areAllPageQuestionsAnswered()) return;

        const nextBtn = findQuizNextButton();
        if (!nextBtn) return;

        const btnText = (nextBtn.value || nextBtn.innerText || '').toLowerCase();
        const isFinish = btnText.includes('finish') || btnText.includes('submit');

        clearTimeout(autoNextTimer);

        if (isFinish) {
            const finishDelay = fastQuizMode ? 200 : 1000;
            setLog(`<b>All Questions Answered!</b> Advancing to summary in <b>${(finishDelay / 1000).toFixed(1)}s</b>...`, "var(--accent-green)");
            showToast("All questions answered! Advancing to summary...", 1200);
            autoNextTimer = setTimeout(() => {
                if (!autoQuizMode) return;
                if (isManualAnswer && !autoNextQuiz) return;
                clickQuizNextButton(nextBtn, true);
            }, finishDelay);
        } else {
            const pageDelay = effectiveDelay;
            setLog(`<b>Question Answered:</b> Advancing to next page in <b>${(pageDelay / 1000).toFixed(1)}s</b>...`, "var(--accent-blue)");
            showToast("Answer selected! Advancing to next page...", 1000);
            autoNextTimer = setTimeout(() => {
                if (!autoQuizMode) return;
                if (isManualAnswer && !autoNextQuiz) return;
                clickQuizNextButton(nextBtn, true);
            }, pageDelay);
        }
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
        try { syncCurrentPageSelectionsToEvidence(); } catch (_) {}
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
    let studyGuideFallbackRunPending = false;
    const quizStudyGuideLoads = new Map();

    async function runAutoQuizSolver(forceRun = false) {
        if (toolkitStorage.get('amaes_terms_acknowledged') !== 'true') {
            autoQuizMode = false;
            return;
        }

        if (typeof isFeatureDisabledByAdmin === 'function' && isFeatureDisabledByAdmin('autoQuiz')) {
            autoQuizMode = false;
            setLog("[Admin Notice] Auto-Quiz is temporarily disabled by administrator.", "var(--accent-amber)");
            showToast("Auto-Quiz is temporarily disabled by administrator.", 4000);
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
            const externalStudyGuideAnswers = typeof readJennysonlinePersistentCache === 'function'
                ? (readJennysonlinePersistentCache(subCode) || [])
                : [];
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

            const freshExternalStudyGuideAnswers = typeof readJennysonlinePersistentCache === 'function'
                ? (readJennysonlinePersistentCache(subCode) || [])
                : externalStudyGuideAnswers;
            const availableAnswers = (cached || []).concat(freshExternalStudyGuideAnswers);
            if (availableAnswers.length > 0) {
                res = highlightQuizAnswers(availableAnswers, Boolean(autoQuizMode || autoPickQuiz));
            } else {
                setLog(`<b>No Answers in DB:</b> Open amauoed or click Cloud Sync for <b>${subCode}</b>!`, "var(--accent-amber)");
            }

            if (typeof loadJennysonlineAnswersForCourse === 'function' && !quizStudyGuideLoads.has(subCode)) {
                const attemptUrl = window.location.href;
                const guideLoad = loadJennysonlineAnswersForCourse(subCode)
                    .then(answers => {
                        if (!answers.length || window.location.href !== attemptUrl || !checkIsQuizAttemptPage()) return;
                        const freshCache = getCachedAnswers(subCode) || [];
                        const autoPickFallback = autoQuizMode && autoPickStudyGuideFallback;
                        highlightQuizAnswers(freshCache.concat(answers), autoPickFallback);
                        if (autoPickFallback) {
                            studyGuideFallbackRunPending = true;
                            if (!isSolverRunning) {
                                studyGuideFallbackRunPending = false;
                                runAutoQuizSolver();
                            }
                        }
                    })
                    .catch(error => {
                        logDebug(`Jenny's Online source note for ${subCode}: ${error.message}`);
                    })
                    .finally(() => {
                        quizStudyGuideLoads.delete(subCode);
                    });
                quizStudyGuideLoads.set(subCode, guideLoad);
            }

            // 2. Identify questions verified by the database vs unverified/unknown questions
            const unverifiedQuestions = [];
            const unreviewedOrProbeQuestions = [];

            queContainers.forEach(que => {
                if (isQuestionAnswered(que)) return;

                const hasVerifiedBadge = que.querySelector('.amaes-verified-badge');
                const hasAdaptiveBadge = que.querySelector('.amaes-adaptive-probe-badge');
                const hasAiBadge = que.querySelector('.amaes-ai-suggested-badge');
                const hasUnverifiedBadge = que.querySelector('.amaes-unverified-badge');
                const hasDragHint = que.querySelector('.amaes-drag-hint');
                const hasShortAnsHint = que.querySelector('.amaes-shortans-hint');
                const hasSelectHint = que.querySelector('.amaes-select-hint');

                // Track unverified, AI-suggested, or prior unreviewed attempts
                const isAutoPickedStudyGuideFallback = autoQuizMode && autoPickStudyGuideFallback &&
                    que.dataset.amaesStudyGuideFallbackPicked === 'true';
                if (!isAutoPickedStudyGuideFallback &&
                    (hasAdaptiveBadge || hasAiBadge || hasUnverifiedBadge)) {
                    unreviewedOrProbeQuestions.push(que);
                }

                const dropZones = que.querySelectorAll('.drop, .dropzone, span.droptarget, .droppable');
                const selectInputs = que.querySelectorAll('select');
                const textInputs = que.querySelectorAll('input[type="text"], input.form-control, textarea, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="reset"])');

                let isFullyVerified = false;
                if (hasVerifiedBadge && !hasAdaptiveBadge && !hasAiBadge && !hasUnverifiedBadge) {
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

            // Safe review pause: If any question on this page was an unreviewed probe or unverified suggestion,
            // do NOT silently breeze through unless user explicitly enabled auto-advance on manual/unverified clicks!
            // When autoQuizMode is running, let Case B proceed to AI resolution or auto-copy without halting automation.
            if (unreviewedOrProbeQuestions.length > 0 && !autoNextQuiz && !fastQuizMode && !autoQuizMode) {
                const firstProbeQue = unreviewedOrProbeQuestions[0];
                setActiveQuestion(firstProbeQue, false);
                firstProbeQue.scrollIntoView({ behavior: 'smooth', block: 'center' });
                clearTimeout(autoNextTimer);
                autoNextTimer = null;
                isWaitingForUserAnswer = true;
                syncAutoQuizUI(true);
                const qData = extractQuestionData(firstProbeQue);
                const isFlippedProbe = Boolean(firstProbeQue.querySelector('.amaes-adaptive-probe-choice'));
                setLog(`[Review Pause] Question #${qData ? qData.qNum : ''}: ${isFlippedProbe ? 'Adaptive probe flipped to alternative choice' : 'Unverified candidate selected'}. Paused for review—press <b>N</b> or click Next page when ready.`, "var(--accent-purple)");
                isSolverRunning = false;
                return;
            }

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
                        const navDelay = fastQuizMode ? 200 : (isFinish ? 1200 : 1000);
                        if (isFinish) {
                            if (autoSubmitQuiz || fastQuizMode || autoQuizMode) {
                                setLog(`<b>All Questions Answered!</b> Advancing to summary in ${(navDelay / 1000).toFixed(1)}s...`, "var(--accent-green)");
                                showToast("Finishing attempt...", navDelay + 1000);
                                autoNextTimer = setTimeout(() => {
                                    if (!autoQuizMode) return;
                                    clickQuizNextButton(nextBtn);
                                }, navDelay);
                            } else {
                                setLog("<b>Last Question Answered!</b> Paused for review before final submit.", "var(--accent-green)");
                                showToast("Last question answered! Review before submitting.", 4000);
                            }
                            isSolverRunning = false;
                            return;
                        }

                        setLog(`[Auto-Next] <b>Auto-Next:</b> Advancing to next question in <b>${(navDelay / 1000).toFixed(1)}s</b>...`, "var(--accent-blue)");
                        autoNextTimer = setTimeout(() => {
                            if (!autoQuizMode) return;
                            clickQuizNextButton(nextBtn);
                        }, navDelay);
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

                setActiveQuestion(firstBlockedQue, false);
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

                // STRICT ANSWER HIERARCHY GUARD:
                // 1. If question is already answered (by student or prior pick), DO NOT run AI!
                if (isQuestionAnswered(firstBlockedQue)) {
                    firstBlockedQue.querySelectorAll('.amaes-blockage-hud, .amaes-ai-fallback-bar').forEach(el => el.remove());
                    isSolverRunning = false;
                    return;
                }
                // 2. If question already has an unconfirmed community or study-guide candidate,
                // and study guide fallback is enabled, pick it now and skip AI inference!
                const unconfirmedChoice = firstBlockedQue.querySelector('.amaes-highlighted-choice input[type="radio"], .amaes-highlighted-choice input[type="checkbox"]');
                if (unconfirmedChoice && (autoPickStudyGuideFallback || autoPickQuiz)) {
                    if (!unconfirmedChoice.checked) {
                        unconfirmedChoice.checked = true;
                        unconfirmedChoice.click();
                        unconfirmedChoice.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    firstBlockedQue.querySelectorAll('.amaes-blockage-hud, .amaes-ai-fallback-bar').forEach(el => el.remove());
                    setLog(`[Answer Hierarchy] Selected community/study-guide candidate for Question #${qData ? qData.qNum : ''}; skipped AI.`, "var(--accent-blue)");
                    isSolverRunning = false;
                    return;
                }

                // GOOGLE GEMINI AI ASSISTANT: Handle uncertain Multiple Choice, True/False, and row-mapped Matching questions.
                // Other complex types (drag & drop, gapselect, text inputs) fall back to manual copy.
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
                            if (matched && matched.choiceText && !matched.matchingRows) {
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
                            if (matched && Array.isArray(matched.matchingRows)) {
                                showToast(`Gemini suggested ${matched.matchingRows.length} matching answer${matched.matchingRows.length === 1 ? '' : 's'} (unverified).`, 3500);
                                setLog(`[AI Suggestion] Gemini suggested ${matched.matchingRows.length} matching row answers (unverified). Review them before continuing.`, "var(--accent-purple)");
                            } else if (aiAutoSelect && matched && matched.input) {
                                const anyChecked = Boolean(firstBlockedQue.querySelector('.answer input[type="radio"]:checked, .answer input[type="checkbox"]:checked'));
                                if (!anyChecked) {
                                    safelySelectInput(matched.input);
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

                    // Built-in acceleration on multi-question pages: concurrently solve other visible unknown questions
                    if (fastQuizMode && queContainers.length > 1 && unverifiedQuestions.length > 1) {
                        const otherQue = unverifiedQuestions.slice(1);
                        otherQue.forEach(oQue => {
                            if (oQue.querySelector('.amaes-ai-suggested-choice, .amaes-ai-text-badge') || isQuestionAnswered(oQue)) return;
                            const oQData = extractQuestionData(oQue);
                            if (oQData && isEligibleForAiSolver(oQue, oQData)) {
                                const oPrompt = buildGeminiCompactPrompt(oQData, courseCode, oQue);
                                handleGeminiQuestionInference({
                                    que: oQue,
                                    qData: oQData,
                                    promptText: oPrompt,
                                    onSuccess: async (oMatched) => {
                                        if (oMatched && oMatched.choiceText && !oMatched.matchingRows) {
                                            recordAttemptAnswerEvidence(oQue, oMatched.choiceText, 'ai_inference');
                                        }
                                        oQue.querySelectorAll('.amaes-blockage-hud, .amaes-unanswered-hint').forEach(el => el.remove());
                                        oQue.style.outline = '2px solid rgba(139, 92, 246, 0.7)';
                                        oQue.style.borderRadius = '8px';
                                        setQuestionAiTag(oQue, true);
                                        if (aiAutoSelect && oMatched && oMatched.input) {
                                            safelySelectInput(oMatched.input);
                                        }
                                    }
                                }).catch(() => {});
                            }
                        });
                    }

                    // If AI successfully resolved and highlighted a choice, finish here without showing redundant blockage HUD!
                    if (firstBlockedQue.querySelector('.amaes-ai-suggested-choice, .amaes-ai-matching-suggestion')) {
                        isSolverRunning = false;
                        return;
                    }
                } else {
                    // Copy question for AI helper
                    copyQuestionWithOptionalImage(firstBlockedQue, aiPromptText).then((res) => {
                        showToast(res && res.withImage ? `Visual snippet & Question #${qData ? qData.qNum : ''} copied to clipboard!` : `Question #${qData ? qData.qNum : ''} copied to clipboard — ready to paste!`, 3000);
                    }).catch(() => {});

                    // Built-in acceleration: even if first question requires manual intervention, background-solve remaining eligible questions
                    if (fastQuizMode && queContainers.length > 1 && unverifiedQuestions.length > 1) {
                        const activeKey = getAvailableGeminiKey();
                        if (activeKey && aiQuizEnabled) {
                            const courseInfo = detectCourseInfo();
                            const courseCode = courseInfo.subjectCode || '';
                            unverifiedQuestions.slice(1).forEach(oQue => {
                                if (oQue.querySelector('.amaes-ai-suggested-choice, .amaes-ai-text-badge') || isQuestionAnswered(oQue)) return;
                                const oQData = extractQuestionData(oQue);
                                if (oQData && isEligibleForAiSolver(oQue, oQData)) {
                                    const oPrompt = buildGeminiCompactPrompt(oQData, courseCode, oQue);
                                    handleGeminiQuestionInference({
                                        que: oQue,
                                        qData: oQData,
                                        promptText: oPrompt,
                                        onSuccess: async (oMatched) => {
                                            if (oMatched && oMatched.choiceText && !oMatched.matchingRows) {
                                                recordAttemptAnswerEvidence(oQue, oMatched.choiceText, 'ai_inference');
                                            }
                                            oQue.querySelectorAll('.amaes-blockage-hud, .amaes-unanswered-hint').forEach(el => el.remove());
                                            oQue.style.outline = '2px solid rgba(139, 92, 246, 0.7)';
                                            oQue.style.borderRadius = '8px';
                                            setQuestionAiTag(oQue, true);
                                            if (aiAutoSelect && oMatched && oMatched.input) {
                                                safelySelectInput(oMatched.input);
                                            } else if (aiAutoSelect && oMatched && Array.isArray(oMatched.matchingRows)) {
                                                oMatched.matchingRows.forEach(item => {
                                                    if (item.select && item.option) {
                                                        item.select.value = item.option.value;
                                                        item.select.dispatchEvent(new Event('input', { bubbles: true }));
                                                        item.select.dispatchEvent(new Event('change', { bubbles: true }));
                                                        item.select.dispatchEvent(new Event('blur', { bubbles: true }));
                                                        item.select.style.outline = '2px solid #a855f7';
                                                        item.select.style.backgroundColor = 'rgba(168, 85, 247, 0.1)';
                                                    }
                                                });
                                            }
                                        }
                                    }).catch(() => {});
                                }
                            });
                        }
                    }
                }

                // If reaching here: either question is ineligible for AI (e.g. text/drag), AI is not enabled, or AI failed
                // IMPORTANT: If AI was triggered and is still processing (thinking indicator visible), do NOT show
                // the "WAITING FOR ANSWER" HUD — it would conflict with the AI thinking indicator.
                const aiIsHandling = firstBlockedQue.querySelector('.amaes-ai-thinking-indicator');
                const aiAlreadySolved = firstBlockedQue.querySelector('.amaes-ai-suggested-choice, .amaes-ai-text-badge, .amaes-ai-matching-suggestion');
                if (aiIsHandling || aiAlreadySolved) {
                    isSolverRunning = false;
                    return;
                }

                firstBlockedQue.dataset.amaesAiFailed = 'true';
                if (typeof updateQuestionAiDrawerState === 'function') {
                    updateQuestionAiDrawerState(firstBlockedQue, true);
                }
                setLog(
                    `<b>Question #${qData ? qData.qNum : ''} Auto-Copied:</b> Prompt copied to clipboard. ` +
                    `Choose an answer and click <b>Next page</b>, or use <b>Ask AI</b> to get an answer.`,
                    "var(--accent-amber)"
                );

                if (!firstBlockedQue.querySelector('.amaes-blockage-hud')) {
                    // The solver HUD is the full unknown-answer notice. Remove
                    // compact matcher hints, previous focus banners, and chips so no warning is shown twice.
                    firstBlockedQue.querySelectorAll('.amaes-unanswered-hint').forEach(hint => hint.remove());
                    firstBlockedQue.querySelectorAll('.amaes-new-question-focus-banner').forEach(b => b.remove());
                    firstBlockedQue.querySelectorAll('.amaes-unsure-help-chip').forEach(c => c.remove());
                    firstBlockedQue.querySelectorAll('.amaes-ai-fallback-bar').forEach(bar => bar.remove());
                    setQuestionAiTag(firstBlockedQue, false);
                    if (!firstBlockedQue.dataset.amaesInterventionAlertPlayed) {
                        firstBlockedQue.dataset.amaesInterventionAlertPlayed = 'true';
                        playToolkitSound('manual_intervention');
                    }

                    const hud = document.createElement('div');
                    hud.className = 'amaes-blockage-hud amaes-new-question-focus-banner';
                    hud.style.cssText = `
                        margin-bottom: 12px;
                        padding: 10px 14px;
                        background: #fffbeb;
                        border: 1.5px solid #f59e0b;
                        border-radius: 8px;
                        font-size: 11.5px;
                        color: #78350f;
                        box-shadow: 0 4px 12px rgba(245, 158, 11, 0.1);
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                        line-height: 1.4;
                        box-sizing: border-box;
                        transition: all 0.2s ease;
                    `;

                    const isMatchBlocked = Boolean(firstBlockedQue && (
                        (typeof identifyQuestionType === 'function' && identifyQuestionType(firstBlockedQue) === 'match') ||
                        firstBlockedQue.classList.contains('match') ||
                        firstBlockedQue.classList.contains('qtype_match') ||
                        firstBlockedQue.querySelectorAll('select').length > 1
                    ));

                    const retryCount = Number(firstBlockedQue.dataset.amaesAiRetryCount) || 0;
                    hud.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
                            <div style="display: flex; align-items: center; gap: 6px;">
                                <span style="background: #f59e0b; color: #ffffff; padding: 2px 7px; border-radius: 4px; font-weight: 800; font-size: 10px; letter-spacing: 0.5px;">WAITING</span>
                                <span style="font-weight: 700; color: #92400e; font-size: 12px;">Question #${qData ? qData.qNum : ''}: No saved answer yet</span>
                            </div>
                            <span style="font-size: 10.5px; color: #b45309; font-weight: 600;">Auto-quiz paused</span>
                        </div>
                        <div class="amaes-focus-instruction" style="font-size: 11.5px; color: #78350f; line-height: 1.45; margin-bottom: 8px;">
                            ${isMatchBlocked ?
                                '<b>No saved answers for these matching items yet.</b> Select the matching choices below, or consult Web AI tools above.' :
                                '<b>Question copied to clipboard!</b> Pick an answer below or click <b>Next Question</b>, or use the AI tools at the side or bottom.'
                            }
                        </div>
                        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                            <button id="btn-blockage-stop" type="button" class="amaes-inline-btn" style="
                                display: inline-flex; align-items: center; gap: 4px; padding: 5px 10px; background: ${autoQuizMode ? '#fee2e2' : '#dcfce7'}; color: ${autoQuizMode ? '#b91c1c' : '#15803d'}; border: 1px solid ${autoQuizMode ? '#f87171' : '#86efac'}; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer;
                            " title="${autoQuizMode ? 'Stop automation so you can answer manually without any script interference' : 'Resume Auto-Quiz'}">
                                ${autoQuizMode ? ICONS.stop : ICONS.play} <span>${autoQuizMode ? 'Stop Auto' : 'Resume Auto'}</span>
                            </button>
                            <button type="button" class="amaes-btn-skip-q" style="
                                display: inline-flex; align-items: center; gap: 4px; padding: 5px 12px; background: #fef3c7; color: #92400e; border: 1px solid #f59e0b; border-radius: 6px; font-size: 11px; font-weight: 700; cursor: pointer; margin-left: auto;
                            ">
                                <span>Next Question &rarr;</span>
                            </button>
                        </div>
                    `;

                    const formulation = firstBlockedQue.querySelector('.formulation, .content') || firstBlockedQue;
                    formulation.insertBefore(hud, formulation.firstChild);

                    const blockageStop = hud.querySelector('#btn-blockage-stop');
                    if (blockageStop) {
                        blockageStop.onclick = (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleAutoQuizMode();
                        };
                    }

                    const blockageSkip = hud.querySelector('.amaes-btn-skip-q');
                    if (blockageSkip) {
                        blockageSkip.onclick = (e) => {
                            e.preventDefault();
                            if (typeof triggerNextQuizPage === 'function') {
                                triggerNextQuizPage();
                            } else {
                                const nextBtn = document.querySelector('.submitbtns input[value*="Next"], input[value*="Next page"], button[value*="Next"]');
                                if (nextBtn) nextBtn.click();
                            }
                        };
                    }

                    updateNextButtonIndicator();
                }

                // Listen for user selecting or typing a choice: show visual confirmation, DO NOT auto-next by default
                const inputElements = firstBlockedQue.querySelectorAll('input[type="radio"], input[type="checkbox"], input[type="text"], select, .draghome, .drop, input.placeinput');
                const onUserPickedChoice = () => {
                    if (!isQuestionAnswered(firstBlockedQue)) {
                        return;
                    }
                    const selectedInput = firstBlockedQue.querySelector('.answer input[type="radio"]:checked, .answer input[type="checkbox"]:checked');
                    const selectedLabel = selectedInput && (selectedInput.closest('label') || selectedInput.parentElement);
                    const selectedText = selectedLabel ? cleanDOMToAI(selectedLabel).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim() : '';
                    const textInput = firstBlockedQue.querySelector('input[type="text"], input.form-control, textarea, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="reset"])');
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
                            hintMsg = 'Review your answer, then click <b>Next page</b> below to proceed.';
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
            isSolverRunning = false;
            if (studyGuideFallbackRunPending && autoQuizMode && autoPickStudyGuideFallback && checkIsQuizAttemptPage()) {
                studyGuideFallbackRunPending = false;
                setTimeout(() => runAutoQuizSolver(), 0);
            } else {
                studyGuideFallbackRunPending = false;
            }
        }
    }

    function triggerClick(el) {
        if (!el) return;
        try { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_) {}
        try { el.focus(); } catch (_) {}
        try { el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })); } catch (_) {}
        try { el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window })); } catch (_) {}
        try { el.click(); } catch (_) {}
    }

    function safelySelectInput(input) {
        if (!input) return false;
        try {
            // If already checked, preserve checked state and avoid double-toggling
            if (input.checked) return true;

            // Trigger native activation behavior
            try {
                input.click();
            } catch (_) {}

            // Failsafe: Ensure checked property is strictly true
            if (!input.checked) {
                input.checked = true;
            }

            // Dispatch standard events so Moodle recognizes the selection
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        } catch (err) {
            logDebug(`safelySelectInput error: ${err.message}`);
            return false;
        }
    }

    function setInputValueWithEvents(input, val) {
        if (!input) return;
        try {
            const proto = Object.getPrototypeOf(input);
            const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set ||
                                 Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (nativeSetter) {
                nativeSetter.call(input, val);
            } else {
                input.value = val;
            }
        } catch (_) {
            input.value = val;
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('blur', { bubbles: true }));
    }

    function isElementVisible(el) {
        if (!el) return false;
        if (el.getAttribute && el.getAttribute('aria-hidden') === 'true') return false;
        if (el.classList && (el.classList.contains('hidden') || el.classList.contains('yui3-panel-hidden'))) return false;
        try {
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return false;
        } catch (_) {}
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return false;
        return true;
    }

    function findQuizSummarySubmitButton() {
        const candidates = document.querySelectorAll(
            '.btn-finishattempt button, .btn-finishattempt input[type="submit"], .btn-finishattempt input[type="button"], ' +
            'button.btn-finishattempt, input.btn-finishattempt, ' +
            'form[action*="processattempt.php"] button, form[action*="processattempt.php"] input[type="submit"], ' +
            '.submitbtns button, .submitbtns input[type="submit"], ' +
            '.quizsummarybtns button, .quizsummarybtns input[type="submit"], ' +
            '.btn-finishattempt, input[value*="Submit all and finish"], ' +
            'button[type="submit"][name="finishattempt"], button[name="submitallandfinish"], ' +
            'input[name="submitallandfinish"], button[type="submit"], button'
        );
        for (const candidate of candidates) {
            if (!candidate || candidate.disabled) continue;

            // Resolve to the real button/input element if candidate is a container (div/form)
            const btn = (candidate.tagName === 'BUTTON' || (candidate.tagName === 'INPUT' && (candidate.type === 'submit' || candidate.type === 'button')))
                ? candidate
                : candidate.querySelector('button, input[type="submit"], input[type="button"]');

            if (!btn || btn.disabled) continue;

            const label = `${btn.value || ''} ${btn.innerText || btn.textContent || ''}`.trim();
            const name = btn.name || '';
            const action = (btn.form && btn.form.action) || '';

            // Guard against "Return to attempt", "Cancel", "Back"
            if (/cancel|return|back|continue to attempt/i.test(label)) continue;

            if (/submit all and finish|finish attempt/i.test(label) ||
                /finishattempt|submitallandfinish/i.test(name) ||
                (action.includes('processattempt.php') && /submit|finish/i.test(label))) {
                return btn;
            }
        }
        return null;
    }

    function findQuizSubmitConfirmationButton() {
        // Priority 1: Actively open Bootstrap / Moodle 4+ modals
        const openModals = document.querySelectorAll(
            '.modal.show, .modal.in, div[data-region="modal-container"].show, .modal[style*="display: block"], ' +
            '.modal.moodle-has-zindex.show, [role="dialog"].show'
        );
        for (const modal of openModals) {
            if (!isElementVisible(modal)) continue;
            // Target save / primary button
            const saveBtn = modal.querySelector('button[data-action="save"], .modal-footer .btn-primary, button.btn-primary, input[type="submit"].btn-primary, input[value*="Submit"]');
            if (saveBtn && isElementVisible(saveBtn) && !saveBtn.disabled) {
                const label = `${saveBtn.value || ''} ${saveBtn.innerText || saveBtn.textContent || ''}`.trim();
                if (!/cancel|close|dismiss|back/i.test(label)) return saveBtn;
            }
            const allBtns = modal.querySelectorAll('button, input[type="submit"], input[type="button"]');
            for (const b of allBtns) {
                if (!b || b.disabled || !isElementVisible(b)) continue;
                const label = `${b.value || ''} ${b.innerText || b.textContent || ''}`.trim();
                if (/cancel|close|dismiss|back/i.test(label)) continue;
                if (/submit all and finish|submit attempt|^submit$|^finish$/i.test(label)) return b;
            }
        }

        // Priority 2: Moodle YUI confirmation dialogue
        const yuiDialogues = document.querySelectorAll('.moodle-dialogue:not(.yui3-panel-hidden), .moodle-dialogue-focused, .confirmation-dialogue');
        for (const dialogue of yuiDialogues) {
            if (!isElementVisible(dialogue)) continue;
            const primaryBtn = dialogue.querySelector('.confirmation-buttons .btn-primary, .confirmation-buttons input[type="button"], .confirmation-buttons button, .moodle-dialogue-ft .btn-primary');
            if (primaryBtn && isElementVisible(primaryBtn) && !primaryBtn.disabled) {
                const label = `${primaryBtn.value || ''} ${primaryBtn.innerText || primaryBtn.textContent || ''}`.trim();
                if (!/cancel|close|dismiss|back/i.test(label)) return primaryBtn;
            }
        }

        // Priority 3: Visible dialogs with role="dialog" or class="modal"
        const dialogs = document.querySelectorAll('[role="dialog"], .modal, .yui3-panel');
        for (const dialog of dialogs) {
            if (!isElementVisible(dialog)) continue;
            const buttons = dialog.querySelectorAll('button[data-action="save"], .modal-footer .btn-primary, .btn-primary, input[type="submit"], input[type="button"], button');
            for (const button of buttons) {
                if (!button || button.disabled || !isElementVisible(button)) continue;
                if (button.getAttribute('data-action') === 'save') return button;
                const label = `${button.value || ''} ${button.innerText || button.textContent || ''}`.trim();
                if (/cancel|do not submit|close|dismiss|back/i.test(label)) continue;
                if (/submit all and finish|submit attempt|^submit$|^finish$/i.test(label)) {
                    return button;
                }
            }
        }

        // Priority 4: Standalone visible confirmation button
        const directButtons = document.querySelectorAll(
            '.modal-footer button[data-action="save"], .modal-footer .btn-primary, ' +
            '.confirmation-buttons .btn-primary, .confirmation-buttons input, ' +
            '[data-region="modal"] button[data-action="save"], [data-region="modal"] .btn-primary'
        );
        for (const b of directButtons) {
            if (!b || b.disabled || !isElementVisible(b)) continue;
            const label = `${b.value || ''} ${b.innerText || b.textContent || ''}`.trim();
            if (!/cancel|close|dismiss/i.test(label)) return b;
        }

        return null;
    }

    function monitorConfirmationSubmission() {
        const confirmUntil = Date.now() + 6_000;
        const verifySubmission = () => {
            if (!checkIsQuizSummaryPage()) return;
            if (Date.now() < confirmUntil) {
                summaryAutoSubmitTimer = setTimeout(verifySubmission, 150);
                return;
            }
            // If still on summary page after 6s:
            const parentForm = document.querySelector('form[action*="processattempt.php"]');
            if (parentForm) {
                try {
                    setLog("<b>Auto-Submit:</b> Form still present after confirmation; dispatching direct form submit...", "var(--accent-green)");
                    if (parentForm.requestSubmit) parentForm.requestSubmit();
                    else parentForm.submit();
                    return;
                } catch (_) {
                    try { parentForm.submit(); return; } catch (_) {}
                }
            }
            const stillOpenConfirmation = findQuizSubmitConfirmationButton();
            showQuizSubmitFallback(
                stillOpenConfirmation
                    ? 'Moodle’s confirmation is still open. Click its submit button to finish submitting.'
                    : 'Moodle did not leave the summary page after confirmation. Check the attempt and click Moodle’s submit button if it is still available.',
                () => findQuizSubmitConfirmationButton() || findQuizSummarySubmitButton(),
                stillOpenConfirmation ? 'Find confirmation button' : 'Find Moodle’s submit button'
            );
        };
        setLog("<b>Auto-Submit:</b> Confirmation clicked; checking that Moodle completes submission.", "var(--accent-green)");
        summaryAutoSubmitTimer = setTimeout(verifySubmission, 150);
    }

    function executeQuizSummaryFinalSubmit() {
        if (!checkIsQuizSummaryPage()) return;

        // Check if confirmation modal is already open
        const existingConfirm = findQuizSubmitConfirmationButton();
        if (existingConfirm) {
            summaryAutoSubmitAttempted = true;
            triggerClick(existingConfirm);
            monitorConfirmationSubmission();
            return;
        }

        const currentSubmitBtn = findQuizSummarySubmitButton();
        if (!currentSubmitBtn) {
            showQuizSubmitFallback(
                'Auto-submit could not continue because Moodle’s submit button disappeared. Use Moodle’s submission controls on this page to finish.',
                () => findQuizSubmitConfirmationButton() || findQuizSummarySubmitButton(),
                'Find Moodle’s submit button'
            );
            return;
        }
        summaryAutoSubmitAttempted = true;
        triggerClick(currentSubmitBtn);
        const submitStartTime = Date.now();
        let formSubmittedDirectly = false;
        const confirmUntil = Date.now() + 5_000;

        const confirmSubmission = () => {
            if (!checkIsQuizSummaryPage()) return;
            const confirmationButton = findQuizSubmitConfirmationButton();
            if (confirmationButton) {
                triggerClick(confirmationButton);
                monitorConfirmationSubmission();
                return;
            }

            // Direct form submission fallback after 2s if no confirmation modal appeared:
            if (!formSubmittedDirectly && Date.now() - submitStartTime > 2000) {
                const parentForm = currentSubmitBtn.form || currentSubmitBtn.closest('form') || document.querySelector('form[action*="processattempt.php"]');
                if (parentForm && parentForm.action && parentForm.action.includes('processattempt.php')) {
                    formSubmittedDirectly = true;
                    setLog("<b>Auto-Submit:</b> Submitting Moodle attempt form directly...", "var(--accent-green)");
                    try {
                        if (parentForm.requestSubmit) {
                            parentForm.requestSubmit(currentSubmitBtn);
                        } else {
                            parentForm.submit();
                        }
                    } catch (_) {
                        try { parentForm.submit(); } catch (_) {}
                    }
                }
            }

            if (Date.now() < confirmUntil) {
                summaryAutoSubmitTimer = setTimeout(confirmSubmission, 100);
                return;
            }
            const fallbackConfirmationButton = findQuizSubmitConfirmationButton();
            showQuizSubmitFallback(
                fallbackConfirmationButton
                    ? 'Moodle opened a submission confirmation that could not be completed automatically. Click the confirmation button to finish submitting.'
                    : 'Auto-submit could not confirm that Moodle started submission. Click Moodle’s “Submit all and finish” button to finish.',
                () => findQuizSubmitConfirmationButton() || findQuizSummarySubmitButton(),
                fallbackConfirmationButton ? 'Find confirmation button' : 'Find Moodle’s submit button'
            );
        };
        summaryAutoSubmitTimer = setTimeout(confirmSubmission, 100);
    }

    function showQuizSubmitFallback(message, targetFinder = findQuizSummarySubmitButton, actionLabel = 'Show Moodle submit control') {
        let notice = document.getElementById('amaes-auto-submit-fallback');
        if (!notice) {
            notice = document.createElement('div');
            notice.id = 'amaes-auto-submit-fallback';
            notice.setAttribute('role', 'alert');
            notice.setAttribute('aria-live', 'assertive');
            notice.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;padding:12px 14px;border:2px solid #f59e0b;border-radius:8px;background:#fffbeb;color:#78350f;font:600 14px/1.4 sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.12);';
            const messageNode = document.createElement('span');
            messageNode.className = 'amaes-auto-submit-fallback-message';
            const action = document.createElement('button');
            action.type = 'button';
            action.className = 'amaes-auto-submit-fallback-action';
            action.style.cssText = 'flex:0 0 auto;padding:8px 12px;border:0;border-radius:6px;background:#b45309;color:#fff;font-weight:700;cursor:pointer;';
            action.addEventListener('click', () => {
                const target = targetFinder();
                if (!target) {
                    messageNode.textContent = 'Moodle’s submit control is not currently available. Use the controls on this summary page to finish submitting.';
                    return;
                }
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                target.focus({ preventScroll: true });
                target.style.outline = '4px solid #f59e0b';
                target.style.boxShadow = '0 0 0 6px rgba(245, 158, 11, 0.25)';
                triggerClick(target);
            });
            notice.append(messageNode, action);
        }
        notice.querySelector('.amaes-auto-submit-fallback-message').textContent = message;
        notice.querySelector('.amaes-auto-submit-fallback-action').textContent = actionLabel;
        const summary = document.querySelector('#region-main, main, [role="main"]') || document.body;
        summary.prepend(notice);
        notice.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setLog(`<b>Auto-Submit needs you:</b> ${message}`, "var(--accent-amber)");
    }

    let summaryAutoSubmitTimer = null;
    let summaryAutoSubmitAttempted = false;
    let summaryAutoSubmitHastenMultiplier = 1;
    let summaryAutoSubmitPaused = false;

    // Updates Moodle's native submit buttons, sidebar indicator, and panel buttons on summary.php
    function updateQuizSummarySubmitButtons(remainingSec, multiplier = 1) {
        if (!checkIsQuizSummaryPage()) return;
        const isPaused = Boolean(summaryAutoSubmitPaused);
        const submitBtn = findQuizSummarySubmitButton();
        if (submitBtn) {
            if (!submitBtn.dataset.amaesOrigText) {
                submitBtn.dataset.amaesOrigText = submitBtn.tagName === 'INPUT' ? submitBtn.value : submitBtn.textContent;
            }
            const orig = submitBtn.dataset.amaesOrigText || 'Submit all and finish';
            let btnText;
            if (isPaused) {
                btnText = `${orig.trim()} (Auto-submit Paused · Enter to submit)`;
            } else if (remainingSec > 0) {
                btnText = `${orig.trim()} (${remainingSec}s · Enter to submit)`;
            } else {
                btnText = `${orig.trim()} (Enter)`;
            }
            if (submitBtn.tagName === 'INPUT') {
                submitBtn.value = btnText;
            } else {
                submitBtn.textContent = btnText;
            }
        }

        // Right-side Quiz Navigation block indicator (#mod_quiz_navblock)
        const rightNav = document.querySelector('#mod_quiz_navblock, .block_quiz_navigation, aside[data-region="blocks-column"] .card');
        if (rightNav) {
            let navInd = rightNav.querySelector('#amaes-navblock-submit-indicator');
            if (!navInd) {
                navInd = document.createElement('div');
                navInd.id = 'amaes-navblock-submit-indicator';
                rightNav.appendChild(navInd);
            }
            if (isPaused) {
                navInd.style.cssText = 'margin-top:10px; padding:8px 12px; background:#fffbeb; border:1px solid #f59e0b; border-radius:6px; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size:11px; color:#92400e; box-sizing:border-box; text-align:center;';
                navInd.innerHTML = `
                    <div style="font-weight:700; color:#b45309;">Auto-submit Paused</div>
                    <div style="font-size:10px; color:#92400e; margin-top:2px;">Press <b>P</b> to resume · <b>Enter</b> to submit</div>
                    <button id="amaes-navblock-pause-btn" type="button" style="margin-top:5px; padding:2px 8px; font-size:10px; font-weight:600; background:#ffffff; border:1px solid #f59e0b; border-radius:4px; cursor:pointer; color:#b45309;">Resume (P)</button>
                `;
            } else {
                navInd.style.cssText = 'margin-top:10px; padding:8px 12px; background:#ecfdf5; border:1px solid #10b981; border-radius:6px; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size:11px; color:#065f46; box-sizing:border-box; text-align:center;';
                navInd.innerHTML = remainingSec > 0
                    ? `<div style="font-weight:700;">Auto-submit in <span id="amaes-navblock-countdown-sec">${remainingSec}s</span></div>
                       <div style="font-size:10px; color:#047857; margin-top:2px;">Press <b>Enter</b> to submit now · <b>P</b> to pause</div>
                       <button id="amaes-navblock-pause-btn" type="button" style="margin-top:5px; padding:2px 8px; font-size:10px; font-weight:600; background:#ffffff; border:1px solid #10b981; border-radius:4px; cursor:pointer; color:#065f46;">Pause (P)</button>`
                    : `<div style="font-weight:700;">Submitting attempt...</div>`;
            }

            const navPauseBtn = navInd.querySelector('#amaes-navblock-pause-btn');
            if (navPauseBtn) {
                navPauseBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pauseQuizSummaryAutoSubmit();
                };
            }
        }

        // Quick submit button on readyBanner: stable label to avoid width jitter
        const quickSubmitBtn = document.getElementById('amaes-btn-quick-submit');
        if (quickSubmitBtn) {
            quickSubmitBtn.textContent = 'Submit Now (Enter) \u2192';
        }

        // Pause/Resume button on readyBanner
        const bannerPauseBtn = document.getElementById('amaes-btn-pause-auto-submit');
        if (bannerPauseBtn) {
            bannerPauseBtn.textContent = isPaused ? 'Resume (P)' : 'Pause (P)';
            bannerPauseBtn.style.color = isPaused ? '#b45309' : '#065f46';
            bannerPauseBtn.style.borderColor = isPaused ? '#f59e0b' : '#10b981';
            bannerPauseBtn.style.background = isPaused ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)';
        }

        // Ready Banner container visual styling (green when active, amber when paused)
        const readyBannerEl = document.getElementById('amaes-summary-ready-banner');
        if (readyBannerEl) {
            if (isPaused) {
                readyBannerEl.style.borderColor = '#f59e0b';
                readyBannerEl.style.background = '#fffbeb';
                readyBannerEl.style.color = '#92400e';
            } else {
                readyBannerEl.style.borderColor = '#10b981';
                readyBannerEl.style.background = '#ecfdf5';
                readyBannerEl.style.color = '#065f46';
            }
        }

        // Description text on readyBanner
        const bannerDescEl = document.getElementById('amaes-summary-banner-desc');
        if (bannerDescEl) {
            if (isPaused) {
                bannerDescEl.innerHTML = `Auto-submit paused (<b id="amaes-summary-countdown-sec">${remainingSec}s</b> remaining). Review at your own pace or press <b>P</b> to resume.`;
            } else if (remainingSec > 0) {
                bannerDescEl.innerHTML = `Auto-submitting attempt in <b id="amaes-summary-countdown-sec">${remainingSec}s</b> (Press Enter to submit · P to pause)...`;
            } else {
                bannerDescEl.textContent = 'Auto-submitting attempt...';
            }
        }

        // Toolkit panel button
        const btnMasterAutoQuiz = document.getElementById('btn-master-auto-quiz');
        if (btnMasterAutoQuiz) {
            if (isPaused) {
                btnMasterAutoQuiz.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
                btnMasterAutoQuiz.innerHTML = `${ICONS.pause || ICONS.zap} <span>Paused (Press P to resume)</span>`;
                btnMasterAutoQuiz.title = 'Auto-submit paused. Click or press P to resume, or Enter to submit';
            } else {
                btnMasterAutoQuiz.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                btnMasterAutoQuiz.innerHTML = `${ICONS.checkCircle} <span>Submit (${remainingSec}s · Enter)</span>`;
                btnMasterAutoQuiz.title = 'Auto-submitting. Click or press Enter to submit immediately, P to pause';
            }
        }
    }

    // Pauses or resumes auto-submit countdown on summary.php
    function pauseQuizSummaryAutoSubmit(forcePause = null) {
        if (!checkIsQuizSummaryPage()) return false;
        const deadlineKey = 'amaes_summary_deadline_' + window.location.href;
        const pausedSecKey = 'amaes_summary_paused_sec_' + window.location.href;

        if (forcePause === null) {
            summaryAutoSubmitPaused = !summaryAutoSubmitPaused;
        } else {
            summaryAutoSubmitPaused = Boolean(forcePause);
        }

        if (summaryAutoSubmitPaused) {
            if (summaryAutoSubmitTimer) {
                clearInterval(summaryAutoSubmitTimer);
                clearTimeout(summaryAutoSubmitTimer);
                summaryAutoSubmitTimer = null;
            }
            const targetDeadline = parseInt(sessionStorage.getItem(deadlineKey) || '0', 10);
            let remainingSec = 5;
            if (targetDeadline && !isNaN(targetDeadline)) {
                remainingSec = Math.max(1, Math.ceil((targetDeadline - Date.now()) / 1000));
            }
            sessionStorage.removeItem(deadlineKey);
            sessionStorage.setItem(pausedSecKey, String(remainingSec));

            updateQuizSummarySubmitButtons(remainingSec, summaryAutoSubmitHastenMultiplier);
            showToast("Auto-submit paused. Review at your own pace.", 2500);
            setLog("<b>Auto-Submit:</b> Paused via <b>[P]</b>. Countdown stopped.", "var(--accent-amber, #f59e0b)");
            return true;
        } else {
            // Resume
            let remainingSec = parseInt(sessionStorage.getItem(pausedSecKey) || '5', 10);
            if (remainingSec <= 0) remainingSec = 5;
            sessionStorage.removeItem(pausedSecKey);
            let targetDeadline = Date.now() + (remainingSec * 1000);
            sessionStorage.setItem(deadlineKey, String(targetDeadline));
            summaryAutoSubmitPaused = false;

            setLog(`<b>Auto-Submit:</b> Resumed via <b>[P]</b> (${remainingSec}s remaining).`, "var(--accent-green)");
            showToast(`Auto-submit resumed (${remainingSec}s)...`, 2000);
            updateQuizSummarySubmitButtons(remainingSec, summaryAutoSubmitHastenMultiplier);

            const countdownInterval = setInterval(() => {
                if (summaryAutoSubmitPaused) return;
                remainingSec = Math.max(0, Math.ceil((targetDeadline - Date.now()) / 1000));
                const secEl = document.getElementById('amaes-summary-countdown-sec');
                if (secEl) {
                    secEl.textContent = `${remainingSec}s`;
                }
                updateQuizSummarySubmitButtons(remainingSec, summaryAutoSubmitHastenMultiplier);
                if (remainingSec <= 0) {
                    clearInterval(countdownInterval);
                    sessionStorage.removeItem(deadlineKey);
                    summaryAutoSubmitTimer = null;
                    setLog("<b>Auto-Submit:</b> Leeway finished. Submitting attempt now...", "var(--accent-green)");
                    executeQuizSummaryFinalSubmit();
                } else if (remainingSec % 5 === 0 || remainingSec <= 3) {
                    setLog(`<b>Auto-Submit:</b> Submitting attempt in <b>${remainingSec}s</b>...`, "var(--accent-green)");
                }
            }, 1000);
            summaryAutoSubmitTimer = countdownInterval;
            return true;
        }
    }

    // Hastens or immediately executes summary submission on Enter, Space, N, or quick submit
    function hastenQuizSummaryAutoSubmit() {
        if (!checkIsQuizSummaryPage()) return false;
        const deadlineKey = 'amaes_summary_deadline_' + window.location.href;
        const pausedSecKey = 'amaes_summary_paused_sec_' + window.location.href;

        // Clear timers immediately
        if (summaryAutoSubmitTimer) {
            clearInterval(summaryAutoSubmitTimer);
            clearTimeout(summaryAutoSubmitTimer);
            summaryAutoSubmitTimer = null;
        }
        summaryAutoSubmitPaused = false;
        sessionStorage.removeItem(deadlineKey);
        sessionStorage.removeItem(pausedSecKey);

        const fallbackNotice = document.getElementById('amaes-auto-submit-fallback');
        if (fallbackNotice) fallbackNotice.remove();
        summaryAutoSubmitAttempted = false;

        // Priority Check: If confirmation modal is ALREADY visible on screen, click its confirmation button immediately!
        const existingConfirmBtn = findQuizSubmitConfirmationButton();
        if (existingConfirmBtn) {
            setLog("<b>Auto-Submit:</b> Submitting confirmation modal via <b>[Enter/N]</b>...", "var(--accent-green)");
            showToast("Submitting confirmation...", 1500);
            triggerClick(existingConfirmBtn);
            monitorConfirmationSubmission();
            return true;
        }

        setLog("<b>Auto-Submit:</b> Instant submission triggered via <b>[Enter/N]</b>. Submitting attempt now...", "var(--accent-green)");
        showToast("Submitting attempt now...", 1500);
        executeQuizSummaryFinalSubmit();
        return true;
    }

    // Evaluates attempt completeness on Quiz Summary Page (/mod/quiz/summary.php)
    function evaluateQuizSummaryPage() {
        if (!checkIsQuizSummaryPage()) return null;
        const table = document.querySelector('table.quizsummaryofattempt, .generaltable.quizsummaryofattempt, #region-main table.generaltable, table.generaltable');
        if (!table) return null;
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        const unanswered = [];
        let total = 0;
        let answered = 0;

        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            if (cells.length < 2) return;
            const qCell = cells[0];
            const statusCell = cells[1];
            const qNum = (qCell.textContent || '').trim();
            const statusText = (statusCell.textContent || '').trim();
            if (!qNum || isNaN(parseInt(qNum, 10))) return;

            total += 1;
            const link = row.querySelector('a[href*="/mod/quiz/attempt.php"]') || qCell.querySelector('a') || null;
            const isSaved = /answer saved|completed|complete/i.test(statusText);
            const isNotAnswered = /not yet answered|not answered|incomplete|no answer/i.test(statusText);

            if (isNotAnswered || (!isSaved && statusText.length > 0)) {
                unanswered.push({ qNum, rowElement: row, statusCell, link, statusText });
            } else {
                answered += 1;
            }
        });

        return {
            totalQuestions: total,
            answeredQuestions: answered,
            unansweredQuestions: unanswered,
            isAllAnswered: total > 0 && unanswered.length === 0
        };
    }

    // Auto-Mark as Done / Submit Handler for Quiz Summary Page (/mod/quiz/summary.php)
    function handleQuizSummaryAutoSubmit() {
        if (!checkIsQuizSummaryPage()) return;
        promoteAttemptEvidenceFromScore();

        const evalRes = evaluateQuizSummaryPage();

        // INCOMPLETE ATTEMPT SAFETY GUARD: If some questions are NOT answered, highlight them and pause auto-submit!
        if (evalRes && evalRes.unansweredQuestions.length > 0) {
            if (summaryAutoSubmitTimer) {
                clearTimeout(summaryAutoSubmitTimer);
                summaryAutoSubmitTimer = null;
            }

            // Highlight incomplete rows
            evalRes.unansweredQuestions.forEach(item => {
                item.rowElement.style.background = 'rgba(245, 158, 11, 0.15)';
                item.rowElement.style.outline = '2px solid #f59e0b';
                item.rowElement.style.borderRadius = '4px';
                if (!item.statusCell.querySelector('.amaes-unanswered-badge')) {
                    const badge = document.createElement('span');
                    badge.className = 'amaes-unanswered-badge';
                    badge.style.cssText = 'background:#f59e0b; color:#ffffff; padding:2px 7px; border-radius:4px; font-weight:800; font-size:10px; margin-left:8px; display:inline-block;';
                    badge.textContent = 'Not Answered';
                    item.statusCell.appendChild(badge);
                }
            });

            // Top Warning Banner
            let banner = document.getElementById('amaes-summary-incomplete-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'amaes-summary-incomplete-banner';
                banner.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:12px; margin:14px 0; padding:12px 16px; border:2px solid #f59e0b; border-radius:10px; background:#fffbeb; color:#78350f; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; box-shadow:0 4px 12px rgba(245,158,11,0.15);';
                banner.innerHTML = `
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="display:inline-flex; align-items:center; color:#d97706;">${ICONS.alertTriangle}</span>
                        <div>
                            <div style="font-weight:800; font-size:13px; color:#92400e;">Incomplete Quiz: ${evalRes.unansweredQuestions.length} Question${evalRes.unansweredQuestions.length > 1 ? 's' : ''} Not Answered!</div>
                            <div style="font-size:11.5px; color:#b45309; margin-top:2px;">Auto-submit paused to protect your grade. Questions needing answers: <b>${evalRes.unansweredQuestions.map(u => '#' + u.qNum).join(', ')}</b>.</div>
                        </div>
                    </div>
                    ${evalRes.unansweredQuestions[0].link ? `
                    <a id="amaes-btn-jump-first-unanswered" href="${evalRes.unansweredQuestions[0].link.href}" style="padding:7px 14px; background:#f59e0b; color:#ffffff; border:none; border-radius:6px; font-weight:700; font-size:11.5px; cursor:pointer; white-space:nowrap; text-decoration:none;">Answer Question #${evalRes.unansweredQuestions[0].qNum} &rarr;</a>
                    ` : ''}
                `;
                const mainArea = document.querySelector('#region-main, main, [role="main"]') || document.body;
                mainArea.prepend(banner);
            }

            syncAutoQuizUI();
            setLog(`<b>Incomplete Quiz:</b> ${evalRes.unansweredQuestions.length} questions not answered (${evalRes.unansweredQuestions.map(u => '#' + u.qNum).join(', ')}). Auto-submit paused.`, "var(--accent-amber)");
            showToast(`Incomplete quiz: ${evalRes.unansweredQuestions.length} questions not answered!`, 4500);
            return;
        }

        // ALL QUESTIONS ANSWERED: Ready for submission!
        document.getElementById('amaes-summary-incomplete-banner')?.remove();

        const shouldAutoSubmit = autoSubmitQuiz || autoQuizMode;
        const delaySec = (typeof autoSubmitDelay === 'number' && !isNaN(autoSubmitDelay)) ? autoSubmitDelay : 10;

        // Render Ready Banner
        let readyBanner = document.getElementById('amaes-summary-ready-banner');
        if (!readyBanner) {
            readyBanner = document.createElement('div');
            readyBanner.id = 'amaes-summary-ready-banner';
            readyBanner.style.cssText = 'display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px; margin:12px 0 8px 0; padding:10px 14px; border:1px solid #10b981; border-radius:8px; background:#ecfdf5; color:#065f46; font-family:-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; box-sizing:border-box; box-shadow:0 1px 4px rgba(16,185,129,0.08);';
            const autoSubmitDesc = delaySec > 0
                ? `Auto-submitting attempt in <b id="amaes-summary-countdown-sec">${delaySec}s</b> (Press Enter to submit · P to pause)...`
                : 'Auto-submitting attempt...';
            readyBanner.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="display:inline-flex; align-items:center; color:#10b981;">${ICONS.checkCircle}</span>
                    <span style="font-weight:700; font-size:12px; color:#065f46;">All ${evalRes ? evalRes.totalQuestions : ''} questions answered</span>
                    <span style="color:#047857; font-size:10px; opacity:0.6;">•</span>
                    <span id="amaes-summary-banner-desc" style="font-size:11.5px; color:#047857;">${shouldAutoSubmit ? autoSubmitDesc : 'Review your saved answers below and click Submit all and finish.'}</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    ${shouldAutoSubmit ? `
                    <button id="amaes-btn-pause-auto-submit" type="button" style="padding:5px 12px; background:rgba(16,185,129,0.1); color:#065f46; border:1px solid #10b981; border-radius:6px; font-weight:700; font-size:11px; cursor:pointer; white-space:nowrap; transition:all 0.15s ease;">Pause (P)</button>
                    ` : ''}
                    <button id="amaes-btn-quick-submit" type="button" style="padding:5px 14px; background:#10b981; color:#ffffff; border:none; border-radius:6px; font-weight:700; font-size:11.5px; cursor:pointer; white-space:nowrap; transition:all 0.15s ease; box-shadow:0 1px 3px rgba(16,185,129,0.25);">Submit Now (Enter) &rarr;</button>
                </div>
            `;
            readyBanner.querySelector('#amaes-btn-quick-submit').onclick = () => {
                hastenQuizSummaryAutoSubmit();
            };
            const pauseBtn = readyBanner.querySelector('#amaes-btn-pause-auto-submit');
            if (pauseBtn) {
                pauseBtn.onclick = () => {
                    pauseQuizSummaryAutoSubmit();
                };
            }
            const submitContainer = document.querySelector('.submitbtns, .quizsummarybtns, .btn-finishattempt');
            if (submitContainer) {
                submitContainer.parentNode.insertBefore(readyBanner, submitContainer);
            } else {
                const mainArea = document.querySelector('#region-main, main, [role="main"]') || document.body;
                mainArea.prepend(readyBanner);
            }
        }

        // Update UI immediately to indicate completion and waiting for confirmation
        syncAutoQuizUI();
        setLog(
            shouldAutoSubmit
                ? `<b>Quiz Completed:</b> All questions answered and saved. Auto-submit is active (${delaySec > 0 ? delaySec + 's leeway' : 'instant'}).`
                : "<b>Quiz Completed:</b> All questions answered and saved. Waiting for your confirmation to submit.",
            "var(--accent-green)",
            shouldAutoSubmit ? "Moodle submission will be confirmed automatically" : "Review your saved answers below and click Submit all and finish"
        );
        showToast(shouldAutoSubmit ? (delaySec > 0 ? `All questions answered. Auto-submitting in ${delaySec}s...` : "All questions answered. Auto-submitting...") : "All questions answered. Waiting for confirmation...", 4000);

        // Update document title so students multitasking in background tabs know it's ready
        if (typeof document !== 'undefined' && document.title && !document.title.includes('(Ready to Submit)')) {
            document.title = '(Ready to Submit) ' + document.title;
        }

        // Highlight Moodle's "Submit all and finish" button
        const submitBtn = findQuizSummarySubmitButton();
        if (submitBtn) {
            submitBtn.style.outline = '3px solid #10b981';
            submitBtn.style.boxShadow = '0 0 15px rgba(16,185,129,0.45)';
        }

        if (!sessionStorage.getItem('amaes_summary_ding_' + window.location.href)) {
            sessionStorage.setItem('amaes_summary_ding_' + window.location.href, 'true');
            playToolkitSound('quest_done');
            if (typeof recordSessionQuizCompleted === 'function') {
                recordSessionQuizCompleted();
            }
        }

        if ((autoSubmitQuiz || autoQuizMode) && !summaryAutoSubmitAttempted && !summaryAutoSubmitTimer) {
            if (!submitBtn) {
                showQuizSubmitFallback(
                    'Auto-submit could not find Moodle’s “Submit all and finish” button. Locate Moodle’s submission control on this page and click it to finish.',
                    () => findQuizSummarySubmitButton(),
                    'Find Moodle’s submit button'
                );
                return;
            }
            if (delaySec <= 0) {
                setLog("<b>Auto-Submit:</b> Submitting attempt now...", "var(--accent-green)");
                showToast("Auto-submitting attempt...", 1500);
                summaryAutoSubmitTimer = setTimeout(() => {
                    summaryAutoSubmitTimer = null;
                    executeQuizSummaryFinalSubmit();
                }, 200);
            } else {
                summaryAutoSubmitHastenMultiplier = 1;
                const deadlineKey = 'amaes_summary_deadline_' + window.location.href;
                let targetDeadline = parseInt(sessionStorage.getItem(deadlineKey) || '0', 10);
                if (!targetDeadline || isNaN(targetDeadline) || targetDeadline > Date.now() + (delaySec * 2000) || targetDeadline < Date.now() - 5000) {
                    targetDeadline = Date.now() + (delaySec * 1000);
                    sessionStorage.setItem(deadlineKey, String(targetDeadline));
                }
                let remainingSec = Math.max(0, Math.ceil((targetDeadline - Date.now()) / 1000));
                if (remainingSec <= 0) {
                    sessionStorage.removeItem(deadlineKey);
                    executeQuizSummaryFinalSubmit();
                    return;
                }

                setLog(`<b>Auto-Submit:</b> Submitting attempt in <b>${remainingSec}s</b>... (Press Enter to submit · P to pause)`, "var(--accent-green)");
                showToast(`Auto-submitting in ${remainingSec}s...`, 2500);
                updateQuizSummarySubmitButtons(remainingSec, summaryAutoSubmitHastenMultiplier);

                const countdownInterval = setInterval(() => {
                    if (summaryAutoSubmitPaused) return;
                    remainingSec = Math.max(0, Math.ceil((targetDeadline - Date.now()) / 1000));
                    const secEl = document.getElementById('amaes-summary-countdown-sec');
                    if (secEl) {
                        secEl.textContent = `${remainingSec}s`;
                    }
                    updateQuizSummarySubmitButtons(remainingSec, summaryAutoSubmitHastenMultiplier);
                    if (remainingSec <= 0) {
                        clearInterval(countdownInterval);
                        sessionStorage.removeItem(deadlineKey);
                        summaryAutoSubmitTimer = null;
                        setLog("<b>Auto-Submit:</b> Leeway finished. Submitting attempt now...", "var(--accent-green)");
                        executeQuizSummaryFinalSubmit();
                    } else if (remainingSec % 5 === 0 || remainingSec <= 3) {
                        setLog(`<b>Auto-Submit:</b> Submitting attempt in <b>${remainingSec}s</b>...`, "var(--accent-green)");
                    }
                }, 1000);
                summaryAutoSubmitTimer = countdownInterval;
            }
        } else {
            logDebug("Quiz Summary reached. Student reviews at their own pace (Auto-submit disabled by design).");
        }
    }

    function syncFastQuizUI() {
        const hudModeText = document.getElementById('hud-mode-text');
        if (hudModeText && autoQuizMode && !isWaitingForUserAnswer) {
            hudModeText.textContent = 'Co-Pilot';
            hudModeText.style.color = 'var(--accent-blue, #3b82f6)';
        }
    }

    // Unified Synchronizer for UI states (Floating HUD + Panel Button)
    function syncAutoQuizUI(isPausedOnUnknown = false) {
        const btnMasterAutoQuiz = document.getElementById('btn-master-auto-quiz');
        if (btnMasterAutoQuiz) {
            if (checkIsQuizSummaryPage()) {
                btnMasterAutoQuiz.style.background = 'linear-gradient(135deg, #10b981, #059669)';
                btnMasterAutoQuiz.innerHTML = `${ICONS.checkBadge || ICONS.zap} <span>Review & Submit</span>`;
                btnMasterAutoQuiz.title = 'All questions answered! Click to scroll to submit button';
            } else if (isPausedOnUnknown || isWaitingForUserAnswer || (checkIsQuizAttemptPage() && document.querySelector('.amaes-blockage-hud'))) {
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
            if (checkIsQuizSummaryPage()) {
                subtext.textContent = 'All questions answered and saved. Review your answers and submit when ready.';
            } else if (isPausedOnUnknown || isWaitingForUserAnswer || (checkIsQuizAttemptPage() && document.querySelector('.amaes-blockage-hud'))) {
                subtext.textContent = 'Paused on unknown question. Choose an answer to continue.';
            } else if (autoQuizMode) {
                subtext.textContent = 'Auto-answering & advancing in background. Click to pause.';
            } else {
                subtext.textContent = 'Auto-answers & advances. Pauses & copies on unknown questions.';
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
                btn.innerHTML = `${ICONS.stop} <span>Stop Auto</span>`;
                btn.style.background = 'rgba(239, 68, 68, 0.08)';
                btn.style.color = '#ef4444';
                btn.style.border = '1px solid rgba(239, 68, 68, 0.28)';
                btn.title = 'Stop automation so you can answer manually without any interference';
            } else {
                btn.innerHTML = `${ICONS.play} <span>Resume</span>`;
                btn.style.background = 'rgba(16, 185, 129, 0.08)';
                btn.style.color = '#10b981';
                btn.style.border = '1px solid rgba(16, 185, 129, 0.28)';
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
            if (autoQuizMode) {
                batchCopyContainer.style.display = 'none';
            }
        }

        // Keep the in-question pause control visible; hide only the duplicate copy action.
        document.querySelectorAll('.amaes-card-btn-container .amaes-copy-ai-card-btn:not(.amaes-paste-ai-card-btn):not(.amaes-ask-ai-card-btn)').forEach(button => {
            button.style.display = autoQuizMode ? 'none' : '';
        });

        // Synchronize Auto-Pilot controls (Locked ON and disabled while Auto-Quiz is actively driving)
        const chkAutoPick = document.getElementById('chk-auto-pick');
        const chkAutoNextVerified = document.getElementById('chk-auto-next-verified');
        const chkAutoPickStudyGuide = document.getElementById('chk-auto-pick-study-guide-fallback');
        if (autoQuizMode) {
            if (chkAutoPick) {
                chkAutoPick.checked = true;
                chkAutoPick.disabled = true;
                chkAutoPick.title = 'Active & locked while Auto-Quiz is running';
            }
            if (chkAutoNextVerified) {
                chkAutoNextVerified.checked = true;
                chkAutoNextVerified.disabled = true;
                chkAutoNextVerified.title = 'Active & locked while Auto-Quiz is running';
            }
            if (chkAutoPickStudyGuide) {
                chkAutoPickStudyGuide.checked = true;
                chkAutoPickStudyGuide.disabled = true;
                chkAutoPickStudyGuide.title = 'Active & locked while Auto-Quiz is running';
            }
        } else {
            if (chkAutoPick) {
                chkAutoPick.disabled = false;
                chkAutoPick.checked = autoPickQuiz;
                chkAutoPick.title = 'Automatically select choice inputs when verified answers are matched';
            }
            if (chkAutoNextVerified) {
                chkAutoNextVerified.disabled = false;
                chkAutoNextVerified.checked = autoNextVerified;
                chkAutoNextVerified.title = 'Advances smoothly to next question when answered; pauses on unknown questions';
            }
            if (chkAutoPickStudyGuide) {
                chkAutoPickStudyGuide.disabled = false;
                chkAutoPickStudyGuide.checked = autoPickStudyGuideFallback;
                chkAutoPickStudyGuide.title = "In Auto-Quiz, select Jenny's Online or AMAUOED study guide choices when no verified answer is available in the database.";
            }
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
            autoPickQuiz = true;
            autoNextVerified = true;
            autoPickStudyGuideFallback = true;
            isWaitingForUserAnswer = false;
            const isAttempt = checkIsQuizAttemptPage();
            showToast(isAttempt ? "Auto-Quiz Started (Co-Pilot)" : "Auto-Quiz Armed (Ready for Quiz)");
            setLog(isAttempt ? "Auto-Quiz <b>started</b> in <b>Co-Pilot</b> mode!" : "Auto-Quiz <b>armed</b>! Will run hands-free upon opening any quiz attempt.", "var(--accent-green)");
            if (isAttempt) runAutoQuizSolver(true);
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

    function getQuizFloatingProgressState() {
        const questions = Array.from(document.querySelectorAll('.que'));
        const navState = getQuizNavQuestionStates();
        if (questions.length > 1) {
            const viewportHeight = window.innerHeight || 800;
            const readingLine = viewportHeight * 0.42;
            let currentQuestion = questions.find(question => {
                const rect = question.getBoundingClientRect();
                return rect.top <= readingLine && rect.bottom > readingLine;
            });
            if (!currentQuestion) {
                currentQuestion = questions
                    .map(question => {
                        const rect = question.getBoundingClientRect();
                        return {
                            question,
                            distance: Math.abs((rect.top + rect.bottom) / 2 - readingLine),
                            visible: rect.bottom > 0 && rect.top < viewportHeight
                        };
                    })
                    .filter(item => item.visible)
                    .sort((a, b) => a.distance - b.distance)[0]?.question || questions[0];
            }
            const currentIndex = Math.max(0, questions.indexOf(currentQuestion));
            const totalAnswered = questions.filter(isQuestionAnswered).length;
            return {
                currentIndex,
                totalQuestions: questions.length,
                totalAnswered
            };
        }
        if (!navState || navState.totalQuestions === 0) return null;

        const questionData = questions.length === 1 ? extractQuestionData(questions[0]) : null;
        const questionIndex = questionData
            ? navState.questions.findIndex(question => question.qNum === questionData.qNum)
            : -1;
        const currentIndex = questionIndex >= 0 ? questionIndex : navState.currentIndex;
        const currentNavQuestion = navState.questions[currentIndex];
        const currentAnswerIsLive = questions.length === 1 && isQuestionAnswered(questions[0]);
        const answerCount = navState.totalAnswered +
            (currentAnswerIsLive && currentNavQuestion && !currentNavQuestion.isAnswered ? 1 : 0);

        return {
            ...navState,
            currentIndex,
            totalAnswered: answerCount
        };
    }

    let quizHudUpdateFrame = null;
    function updateQuizFloatingHUD() {
        if (quizHudUpdateFrame !== null) return;
        quizHudUpdateFrame = requestAnimationFrame(() => {
            quizHudUpdateFrame = null;
            const hud = document.getElementById('amaes-quiz-hud');
            if (!hud || !checkIsQuizAttemptPage()) return;
            const progress = getQuizFloatingProgressState();
            const progressContainer = document.getElementById('hud-question-progress');
            if (!progressContainer) return;
            if (!progress) {
                progressContainer.style.display = 'none';
                return;
            }
            const currentQuestion = document.getElementById('hud-question-label');
            const progressFill = document.getElementById('hud-question-progress-fill');
            const totalQuestions = progress.totalQuestions;
            const currentIndex = Math.max(0, Math.min(progress.currentIndex, totalQuestions - 1));
            const totalAnswered = Math.max(0, Math.min(progress.totalAnswered, totalQuestions));
            const percentage = Math.round((totalAnswered / totalQuestions) * 100);
            if (currentQuestion) currentQuestion.textContent = `Q ${currentIndex + 1}/${totalQuestions}`;
            if (progressFill) progressFill.style.width = `${percentage}%`;
            progressContainer.title = `${totalAnswered}/${totalQuestions} answered (${percentage}%)`;
            progressContainer.style.display = 'flex';
        });
    }

    function bindQuizFloatingHUDUpdates() {
        if (window.__amaesQuizHudUpdatesBound) return;
        window.__amaesQuizHudUpdatesBound = true;
        const scheduleUpdate = () => updateQuizFloatingHUD();
        window.addEventListener('scroll', scheduleUpdate, { passive: true, capture: true });
        window.addEventListener('resize', scheduleUpdate, { passive: true });
        document.addEventListener('input', event => {
            if (event.target && event.target.closest && event.target.closest('.que')) scheduleUpdate();
        }, true);
        document.addEventListener('change', event => {
            if (event.target && event.target.closest && event.target.closest('.que')) scheduleUpdate();
        }, true);
        document.addEventListener('click', event => {
            if (event.target && event.target.closest && event.target.closest('.que')) scheduleUpdate();
        }, true);
    }

    // Floating HUD for Quiz Attempt Screen
    function injectQuizFloatingHUD() {
        if (toolkitStorage.get('amaes_terms_acknowledged') !== 'true') return;
        if (!checkIsQuizAttemptPage()) return;
        if (document.getElementById('amaes-quiz-hud')) return;

        const navState = getQuizFloatingProgressState();
        const panelEl = document.getElementById('amaes-toolkit-panel');
        const bodyEl = document.getElementById('amaes-panel-body');
        const isPanelMinimized = !panelEl || panelEl.classList.contains('amaes-minimized') || (bodyEl && bodyEl.style.display === 'none');

        let progressHtml = '';
        if (navState && navState.totalQuestions > 0) {
            const currentQ = navState.currentIndex >= 0 ? (navState.currentIndex + 1) : 1;
            const totalQ = navState.totalQuestions;
            const pct = Math.round((navState.totalAnswered / totalQ) * 100);
            progressHtml = `
                <div style="display: flex; align-items: center; gap: 6px; padding: 0 4px; border-left: 1px solid rgba(255,255,255,0.12); margin-left: 2px;">
                    <span id="hud-question-label" style="font-weight: 700; color: #94a3b8; font-size: 10px;">Q ${currentQ}/${totalQ}</span>
                    <div id="hud-question-progress" style="width: 32px; height: 3.5px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;" title="${navState.totalAnswered}/${totalQ} answered (${pct}%)">
                        <div id="hud-question-progress-fill" style="width: ${pct}%; height: 100%; background: #3b82f6; border-radius: 2px; transition: width 0.3s ease;"></div>
                    </div>
                </div>
            `;
        }

        const hud = document.createElement('div');
        hud.id = 'amaes-quiz-hud';
        hud.style.cssText = `
            position: fixed;
            bottom: max(12px, env(safe-area-inset-bottom));
            left: max(12px, env(safe-area-inset-left));
            max-width: calc(100vw - 24px);
            box-sizing: border-box;
            flex-wrap: wrap;
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

            <!-- Quiz Progress -->
            ${progressHtml}

            <!-- Pause / Resume Button (Adaptive: only shown when main panel is minimized) -->
            <button id="btn-hud-toggle-quiz" class="amaes-inline-btn" style="display: ${isPanelMinimized ? 'inline-flex' : 'none'}; padding: 3px 10px; font-size: 10px; background: ${autoQuizMode ? 'rgba(239,68,68,0.25); color:#ef4444; border:1px solid #ef4444' : 'rgba(16,185,129,0.25); color:#10b981; border:1px solid #10b981'}; border-radius: 12px; cursor: pointer; font-weight: 600;">
                ${autoQuizMode ? 'Pause' : 'Resume'}
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
        bindQuizFloatingHUDUpdates();
        updateQuizFloatingHUD();

        const _el__btn_hud_toggle_quiz_ = document.getElementById('btn-hud-toggle-quiz');
        if (_el__btn_hud_toggle_quiz_) _el__btn_hud_toggle_quiz_.onclick = () => {
            toggleAutoQuizMode();
        };
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

            const isMultiMatching = (typeof identifyQuestionType === 'function' && identifyQuestionType(targetQue) === 'match') ||
                targetQue.classList.contains('match') ||
                targetQue.classList.contains('qtype_match') ||
                targetQue.querySelectorAll('select').length > 1;

            if (isMultiMatching) {
                showToast("Matching questions use row dropdowns. Pick options directly or use AI beside each row.", 3500);
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

            // 1. Multi-letter matching for multi-choice checkbox questions (e.g. "a, c", "a and d", "A, B, C, E, F")
            const multiLetters = cleanText.match(/\b([a-zA-Z])\b/g);
            if (isCheckbox && multiLetters && multiLetters.length > 1) {
                const uniqueLetters = Array.from(new Set(multiLetters.map(l => l.toUpperCase())));
                let checkedCount = 0;
                uniqueLetters.forEach(letter => {
                    const idx = letter.charCodeAt(0) - 65;
                    if (inputElements[idx] && idx >= 0 && idx < inputElements.length) {
                        safelySelectInput(inputElements[idx]);
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

            // 2. Direct single letter matching: Look for option letter (A through Z)
            const matchLetter = cleanText.match(/(?:^|\b)(?:answer|option|choice|the correct answer is)?\s*[:\-–*]*\s*([a-zA-Z])(?:\.|\)|:|\s|$)/i);
            if (matchLetter && matchLetter[1]) {
                const letter = matchLetter[1].toUpperCase();
                const idx = letter.charCodeAt(0) - 65;
                if (inputElements[idx] && idx >= 0 && idx < inputElements.length) {
                    safelySelectInput(inputElements[idx]);
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

    // ----------------------------------------------------
    // Quiz & Exam Sequential Cycle Navigation (] and [)
    // ----------------------------------------------------

    // Extracts ordered activities from Moodle's native .activity-navigation select (Jump to...)
    function getActivitiesFromUrlSelect() {
        if (typeof document === 'undefined') return [];
        const select = document.querySelector('.activity-navigation select, select.urlselect, form.urlselect select');
        if (!select) return [];
        const options = Array.from(select.querySelectorAll('option'));
        const items = [];
        options.forEach((opt, idx) => {
            const val = (opt.value || '').trim();
            const text = (opt.textContent || '').trim();
            if (val && (val.includes('/mod/quiz/') || /\b(quiz|exam|assessment|prelim|midterm|prefinal|final)\b/i.test(text))) {
                const mId = val.match(/[?&]id=(\d+)/);
                items.push({
                    url: val,
                    title: text,
                    cmid: mId ? mId[1] : null,
                    index: idx
                });
            }
        });
        return items;
    }

    // Resolves full ordered list of course quizzes from DOM, course index drawer, urlselect, or localStorage cache
    function getCourseQuizzesList() {
        if (typeof document === 'undefined') return [];
        const courseInfo = typeof detectCourseInfo === 'function' ? detectCourseInfo() : {};
        const courseId = courseInfo && courseInfo.courseId ? courseInfo.courseId : '';

        // 1. From Moodle 4 Course Index Drawer or Sidebar Nav
        const drawerSelectors = [
            '#courseindex a[href*="/mod/quiz/"]',
            '.courseindex a[href*="/mod/quiz/"]',
            '[data-region="courseindex"] a[href*="/mod/quiz/"]',
            '#theme_boost-drawers-courseindex a[href*="/mod/quiz/"]',
            '.drawer-left a[href*="/mod/quiz/"]',
            '#courseindex a',
            '.courseindex a',
            '[data-region="courseindex"] a',
            '#theme_boost-drawers-courseindex a',
            '.drawer-left a',
            '.drawercontent a',
            '#nav-drawer a',
            '.block_navigation a',
            'aside a'
        ];
        const drawerLinks = Array.from(document.querySelectorAll(drawerSelectors.join(', ')));
        if (drawerLinks.length > 0) {
            const list = [];
            const seen = new Set();
            drawerLinks.forEach(link => {
                const href = link.getAttribute('href') || link.href || '';
                if (!href || href === '#' || href.startsWith('javascript:')) return;
                const titleElem = link.querySelector('.courseindex-name, .text-truncate, .instancename, .activityname') || link;
                const rawTitle = (titleElem ? (titleElem.innerText || titleElem.textContent) : (link.innerText || link.textContent) || '').trim();
                const isQuizLink = href.includes('/mod/quiz/') ||
                    (/\b(?:quiz|exam)\b/i.test(rawTitle) && href.includes('view.php?id='));
                if (!isQuizLink) return;

                let fullHref = href;
                try {
                    fullHref = new URL(href, window.location.origin).href;
                } catch (_) {}

                const mId = fullHref.match(/[?&](?:id|cmid)=(\d+)/);
                const cmid = mId ? mId[1] : null;
                const key = cmid || fullHref;
                if (!seen.has(key)) {
                    seen.add(key);
                    const cleanTitle = rawTitle.replace(/\(Press\s*[\[\]]\)/gi, '').replace(/\s*Quiz\s*$/i, '').trim() || rawTitle;
                    list.push({
                        url: fullHref,
                        title: cleanTitle,
                        cmid: cmid
                    });
                }
            });
            if (list.length > 0) {
                if (courseId) {
                    try {
                        localStorage.setItem(`amaes_course_quizzes_${courseId}`, JSON.stringify(list));
                    } catch (_) {}
                }
                try {
                    localStorage.setItem('amaes_latest_course_quizzes', JSON.stringify(list));
                } catch (_) {}
                return list;
            }
        }

        // 2. From DOM if on course page (/course/view.php)
        if (checkIsCoursePage()) {
            const activities = Array.from(document.querySelectorAll(
                'li.activity, .activity-item, .course-section .activity, div[data-region="activity-card"]'
            ));
            const list = [];
            const seen = new Set();
            activities.forEach(el => {
                const link = el.querySelector('a[href*="/mod/quiz/view.php?id="], a[href*="/mod/quiz/"]');
                const isQuiz = (typeof classifyActivity === 'function' && classifyActivity(el).type === 'quiz') || Boolean(link);
                if (isQuiz && link) {
                    const href = link.getAttribute('href') || link.href || '';
                    if (!href) return;
                    let fullHref = href;
                    try {
                        fullHref = new URL(href, window.location.origin).href;
                    } catch (_) {}
                    const mId = fullHref.match(/[?&]id=(\d+)/);
                    const cmid = mId ? mId[1] : null;
                    const key = cmid || fullHref;
                    if (!seen.has(key)) {
                        seen.add(key);
                        const titleElem = el.querySelector('.instancename, .activityname, a.aal_link, .activity-title');
                        const rawTitle = titleElem ? (titleElem.innerText || titleElem.textContent).trim() : (link.innerText.trim() || el.innerText.split('\n')[0]);
                        const cleanTitle = rawTitle.replace(/\(Press\s*[\[\]]\)/gi, '').replace(/\s*Quiz\s*$/i, '').trim() || rawTitle;
                        list.push({
                            url: fullHref,
                            title: cleanTitle,
                            cmid: cmid
                        });
                    }
                }
            });
            if (list.length > 0) {
                if (courseId) {
                    try {
                        localStorage.setItem(`amaes_course_quizzes_${courseId}`, JSON.stringify(list));
                    } catch (_) {}
                }
                try {
                    localStorage.setItem('amaes_latest_course_quizzes', JSON.stringify(list));
                } catch (_) {}
                return list;
            }
        }

        // 3. From urlselect dropdown inside .activity-navigation
        const selectItems = getActivitiesFromUrlSelect();
        if (selectItems.length > 0) {
            if (courseId) {
                try {
                    localStorage.setItem(`amaes_course_quizzes_${courseId}`, JSON.stringify(selectItems));
                } catch (_) {}
            }
            try {
                localStorage.setItem('amaes_latest_course_quizzes', JSON.stringify(selectItems));
            } catch (_) {}
            return selectItems;
        }

        // 4. From cached course quiz list in localStorage
        if (courseId) {
            try {
                const cached = localStorage.getItem(`amaes_course_quizzes_${courseId}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
            } catch (_) {}
        }
        try {
            const cachedLatest = localStorage.getItem('amaes_latest_course_quizzes');
            if (cachedLatest) {
                const parsed = JSON.parse(cachedLatest);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch (_) {}

        return [];
    }

    async function populateCourseQuizzesFromRemote(courseId) {
        if (!courseId || typeof window === 'undefined') return [];
        try {
            const semPath = typeof getSemesterBasePath === 'function' ? getSemesterBasePath() : '/';
            const courseUrl = `${window.location.origin}${semPath}course/view.php?id=${courseId}`;
            const resp = await fetch(courseUrl);
            if (!resp.ok) return [];
            const html = await resp.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const drawerLinks = Array.from(doc.querySelectorAll(
                'a[href*="/mod/quiz/view.php"], a[href*="/mod/quiz/"], .modtype_quiz a, li.activity.quiz a, #courseindex a, .courseindex a, [data-region="courseindex"] a, #theme_boost-drawers-courseindex a, li.activity a, .activity-item a'
            ));
            const list = [];
            const seen = new Set();
            drawerLinks.forEach(link => {
                const href = link.getAttribute('href') || link.href || '';
                if (!href || href === '#' || href.startsWith('javascript:')) return;
                const titleElem = link.querySelector('.courseindex-name, .text-truncate, .instancename, .activityname') || link;
                const rawTitle = (titleElem ? (titleElem.innerText || titleElem.textContent) : (link.innerText || link.textContent) || '').trim();
                const isQuizLink = href.includes('/mod/quiz/') ||
                    (/\b(?:quiz|exam)\b/i.test(rawTitle) && href.includes('view.php?id='));
                if (!isQuizLink) return;

                let fullHref = href;
                try {
                    fullHref = new URL(href, window.location.origin).href;
                } catch (_) {}

                const mId = fullHref.match(/[?&](?:id|cmid)=(\d+)/);
                const cmid = mId ? mId[1] : null;
                const key = cmid || fullHref;
                if (!seen.has(key)) {
                    seen.add(key);
                    const cleanTitle = rawTitle.replace(/\(Press\s*[\[\]]\)/gi, '').replace(/\s*Quiz\s*$/i, '').trim() || rawTitle;
                    list.push({ url: fullHref, title: cleanTitle, cmid });
                }
            });
            if (list.length > 0) {
                try {
                    localStorage.setItem(`amaes_course_quizzes_${courseId}`, JSON.stringify(list));
                    localStorage.setItem('amaes_latest_course_quizzes', JSON.stringify(list));
                } catch (_) {}
                if (typeof injectQuizBottomNavigation === 'function') {
                    injectQuizBottomNavigation();
                }
            }
            return list;
        } catch (_) {
            return [];
        }
    }

    function getCurrentQuizCmid() {
        if (typeof window === 'undefined') return '';
        const search = window.location.search || '';
        const m = search.match(/[?&]id=(\d+)/) || search.match(/[?&]cmid=(\d+)/);
        if (m) return m[1];
        const idInput = document.querySelector('input[name="cmid"], input[name="id"]');
        if (idInput && idInput.value) return idInput.value.trim();
        const mBody = (document.body?.className || '').match(/\bcmid-(\d+)\b/);
        if (mBody) return mBody[1];
        const viewLink = document.querySelector('a[href*="/mod/quiz/view.php?id="], a[href*="/mod/quiz/view.php?cmid="], .breadcrumb a[href*="id="], .breadcrumb-item a[href*="id="]');
        if (viewLink) {
            const mLink = (viewLink.getAttribute('href') || viewLink.href || '').match(/[?&](?:id|cmid)=(\d+)/);
            if (mLink) return mLink[1];
        }
        return '';
    }

    // Helper to resolve native Moodle activity navigation link elements (handles both <a> with ID and container with <a>)
    function resolveActivityLink(direction = 'next') {
        if (typeof document === 'undefined') return null;
        const isNext = direction === 'next';
        const selectors = isNext ? [
            'a#next-activity-link',
            '#next-activity-link',
            '#next-activity-link a',
            '.activity-navigation [data-region="next-activity"] a',
            '.activity-navigation [data-region="next-activity"]',
            '.activity-navigation .pull-right a',
            '.activity-navigation .float-right a',
            '.activity-navigation .float-end a',
            '.activity-navigation .pull-right',
            '.activity-navigation .float-right',
            '.activity-navigation .float-end',
            'a.next-activity-link',
            '.next-activity a',
            '.next-activity',
            'a[title*="Next activity" i]',
            'a[aria-label*="Next activity" i]'
        ] : [
            'a#prev-activity-link',
            '#prev-activity-link',
            '#prev-activity-link a',
            '.activity-navigation [data-region="prev-activity"] a',
            '.activity-navigation [data-region="prev-activity"]',
            '.activity-navigation .pull-left a',
            '.activity-navigation .float-left a',
            '.activity-navigation .float-start a',
            '.activity-navigation .pull-left',
            '.activity-navigation .float-left',
            '.activity-navigation .float-start',
            'a.prev-activity-link',
            '.prev-activity a',
            '.prev-activity',
            'a[title*="Previous activity" i]',
            'a[aria-label*="Previous activity" i]'
        ];

        for (const sel of selectors) {
            try {
                const el = document.querySelector(sel);
                if (!el) continue;
                if (el.tagName === 'A' && el.href) return el;
                const inner = el.querySelector('a[href]');
                if (inner && inner.href) return inner;
            } catch (_) {}
        }

        // Semantic fallback: scan all anchor tags inside .activity-navigation
        const navContainer = document.querySelector('.activity-navigation');
        if (navContainer && !navContainer.classList.contains('amaes-quiz-bottom-nav')) {
            const allAnchors = Array.from(navContainer.querySelectorAll('a[href]'));
            if (allAnchors.length > 0) {
                if (isNext) {
                    const match = allAnchors.find(a => {
                        const txt = (a.innerText || a.textContent || '').trim();
                        const html = a.innerHTML || '';
                        return /rarrow|fa-arrow-right|fa-chevron-right|[►▶>]|next/i.test(html + ' ' + txt);
                    }) || (allAnchors.length > 1 ? allAnchors[allAnchors.length - 1] : (allAnchors[0].id.includes('next') ? allAnchors[0] : null));
                    if (match && match.href) return match;
                } else {
                    const match = allAnchors.find(a => {
                        const txt = (a.innerText || a.textContent || '').trim();
                        const html = a.innerHTML || '';
                        return /larrow|fa-arrow-left|fa-chevron-left|[◄◀<]|prev/i.test(html + ' ' + txt);
                    }) || (allAnchors.length > 1 ? allAnchors[0] : (allAnchors[0].id.includes('prev') ? allAnchors[0] : null));
                    if (match && match.href) return match;
                }
            }
        }

        return null;
    }

    // Decorates native Moodle .activity-navigation buttons (#next-activity-link a / #prev-activity-link a)
    function decorateNativeActivityNavigation() {
        if (typeof document === 'undefined') return;

        // Next activity link: decorate with (Press ])
        const nextLink = resolveActivityLink('next');
        if (nextLink && !nextLink.dataset.amaesDecorated) {
            nextLink.dataset.amaesDecorated = 'true';
            const rarrow = nextLink.querySelector('.rarrow, .icon, i, [aria-hidden="true"]');
            const badge = '<span class="amaes-nav-key-hint" style="font-size: 0.85em; opacity: 0.85; margin: 0 4px; font-weight: 600;">(Press ])</span>';
            if (rarrow) {
                rarrow.insertAdjacentHTML('beforebegin', badge);
            } else {
                nextLink.insertAdjacentHTML('beforeend', ' ' + badge);
            }
        }

        // Previous activity link: decorate with (Press [)
        const prevLink = resolveActivityLink('prev');
        if (prevLink && !prevLink.dataset.amaesDecorated) {
            prevLink.dataset.amaesDecorated = 'true';
            const larrow = prevLink.querySelector('.larrow, .icon, i, [aria-hidden="true"]');
            const badge = '<span class="amaes-nav-key-hint" style="font-size: 0.85em; opacity: 0.85; margin: 0 4px; font-weight: 600;">(Press [)</span>';
            if (larrow) {
                larrow.insertAdjacentHTML('afterend', badge);
            } else {
                prevLink.insertAdjacentHTML('afterbegin', badge + ' ');
            }
        }
    }

    // Injects visible bottom sequential cycle buttons for quizzes when native Moodle .activity-navigation is absent
    function injectQuizBottomNavigation() {
        if (typeof document === 'undefined') return;

        const isQuizPage = (typeof checkIsQuizViewPage === 'function' && checkIsQuizViewPage()) ||
                           (typeof checkIsReviewPage === 'function' && checkIsReviewPage()) ||
                           (typeof checkIsQuizSummaryPage === 'function' && checkIsQuizSummaryPage()) ||
                           (typeof window !== 'undefined' && window.location.pathname.includes('/mod/quiz/view.php'));
        if (!isQuizPage) return;

        // If native Moodle .activity-navigation exists with valid next or prev links (e.g. on exam portal), decorate it and avoid duplicate bar
        const hasNativeNext = Boolean(resolveActivityLink('next'));
        const hasNativePrev = Boolean(resolveActivityLink('prev'));
        if (hasNativeNext || hasNativePrev) {
            decorateNativeActivityNavigation();
            return;
        }

        const target = document.querySelector('#region-main [role="main"], #region-main, .course-content, #page-content');
        if (!target) return;

        const list = getCourseQuizzesList();
        const currentCmid = getCurrentQuizCmid();
        const courseInfo = typeof detectCourseInfo === 'function' ? detectCourseInfo() : {};
        const courseId = courseInfo && courseInfo.courseId ? courseInfo.courseId : '';

        // Determine current index in list
        let currentIndex = -1;
        if (currentCmid) {
            currentIndex = list.findIndex(item => item.cmid === currentCmid);
        }
        if (currentIndex === -1 && list.length > 0) {
            currentIndex = list.findIndex(item => item.url && window.location.href.includes(item.url));
        }

        const skipPassed = typeof localStorage !== 'undefined' && localStorage.getItem('amaes_skip_passed_quizzes') === 'true';
        let gradesMap = {};
        if (typeof window !== 'undefined' && window.__amaesCourseGradesCache) {
            gradesMap = window.__amaesCourseGradesCache;
        } else if (courseId) {
            try {
                const cached = localStorage.getItem(`amaes_course_grades_cache_${courseId}`);
                if (cached) gradesMap = JSON.parse(cached);
            } catch (_) {}
        }

        // Find candidate for Next and Previous
        let nextQuiz = null;
        let prevQuiz = null;

        if (list.length > 0) {
            // Next
            const startIndexNext = currentIndex !== -1 ? currentIndex + 1 : 0;
            for (let i = startIndexNext; i < list.length; i++) {
                const candidate = list[i];
                if (!candidate) continue;
                if (skipPassed) {
                    const cmidKey = candidate.cmid ? `cmid_${candidate.cmid}` : '';
                    const normTitle = (candidate.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const gradeEntry = (cmidKey && gradesMap[cmidKey]) || gradesMap[normTitle] || null;
                    if (gradeEntry && gradeEntry.isPassable === true) {
                        continue;
                    }
                }
                nextQuiz = candidate;
                break;
            }

            // Prev
            const startIndexPrev = currentIndex !== -1 ? currentIndex - 1 : list.length - 1;
            for (let i = startIndexPrev; i >= 0; i--) {
                const candidate = list[i];
                if (!candidate) continue;
                if (skipPassed) {
                    const cmidKey = candidate.cmid ? `cmid_${candidate.cmid}` : '';
                    const normTitle = (candidate.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const gradeEntry = (cmidKey && gradesMap[cmidKey]) || gradesMap[normTitle] || null;
                    if (gradeEntry && gradeEntry.isPassable === true) {
                        continue;
                    }
                }
                prevQuiz = candidate;
                break;
            }
        }

        // If list is empty and courseId exists, trigger async fetch to populate
        if (list.length === 0 && courseId) {
            populateCourseQuizzesFromRemote(courseId);
        }

        const prevDisabled = list.length > 0 && !prevQuiz;
        const nextDisabled = list.length > 0 && !nextQuiz;

        const prevLabel = prevQuiz ? prevQuiz.title : (list.length > 0 ? 'First Quiz' : 'Previous Activity');
        const nextLabel = nextQuiz ? nextQuiz.title : (list.length > 0 ? (skipPassed ? 'All Quizzes Passed' : 'Last Quiz') : 'Next Activity');

        // Build Jump Menu Options
        let jumpOptions = '<option value="">Jump to quiz...</option>';
        list.forEach((item, idx) => {
            const isSelected = idx === currentIndex;
            const cmidKey = item.cmid ? `cmid_${item.cmid}` : '';
            const normTitle = (item.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            const g = (cmidKey && gradesMap[cmidKey]) || gradesMap[normTitle] || null;
            let status = '';
            if (g && g.hasGrade) {
                status = ` (${g.percentage !== null ? g.percentage + '%' : g.gradeStr}${g.isPassable ? ' - Passed' : ''})`;
            }
            jumpOptions += `<option value="${escapeHtml(item.url)}" ${isSelected ? 'selected' : ''}>${escapeHtml(item.title)}${escapeHtml(status)}</option>`;
        });

        const navData = {
            list,
            currentIndex,
            prevQuiz,
            nextQuiz,
            prevDisabled,
            nextDisabled,
            prevLabel,
            nextLabel,
            skipPassed,
            jumpOptions
        };

        const isReviewPage = typeof checkIsReviewPage === 'function' && checkIsReviewPage();

        function populateQuizNavElement(container, isTop) {
            if (isTop) {
                container.innerHTML = `
                    <div style="flex: 1; min-width: 140px; text-align: left;">
                        <button id="amaes-top-btn-prev-quiz" class="btn btn-secondary amaes-cycle-btn amaes-cycle-btn-prev" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; border-radius: 6px; cursor: ${prevDisabled ? 'not-allowed' : 'pointer'}; opacity: ${prevDisabled ? '0.45' : '1'}; transition: all 0.2s ease;" ${prevDisabled ? 'disabled' : ''} title="${prevQuiz ? 'Previous Quiz: ' + prevLabel + ' (Press [)' : 'Previous Activity (Press [)'}">
                            <span>&#9668;</span>
                            <span class="amaes-cycle-title" style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(prevLabel)}</span>
                            <span class="amaes-nav-key-hint" style="font-size: 0.85em; opacity: 0.85; font-weight: 500;">(Press [)</span>
                        </button>
                    </div>
                    <div style="flex: 0 1 auto; text-align: center; display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
                        ${isReviewPage ? `
                            <button id="amaes-top-btn-nav-retake" class="btn btn-primary btn-sm amaes-retake-nav-btn" style="display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px; font-size: 12px; font-weight: 700; border-radius: 6px; background: #0f6cbf; border: 1px solid #0f6cbf; color: #fff; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(15,108,191,0.25);" title="Retake this quiz immediately (Press R)">
                                ${ICONS.rotateCcw || ''}
                                <span>Retake (R)</span>
                            </button>
                        ` : ''}
                        ${list.length > 0 ? `
                            <select id="amaes-top-quiz-cycle-select" class="custom-select form-control amaes-cycle-select" style="max-width: 280px; font-size: 12px; font-weight: 500; height: 34px; padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.4); background: inherit; color: inherit;">
                                ${jumpOptions}
                            </select>
                        ` : `
                            <div style="display: inline-flex; align-items: center; gap: 8px;">
                                <button id="amaes-top-pill-prev" class="btn btn-sm btn-outline-secondary" style="font-size: 11.5px; font-weight: 600; padding: 4px 10px; border-radius: 6px; cursor: pointer;" title="Previous activity (Press [)">[ Prev</button>
                                <span style="font-size: 12px; opacity: 0.65; font-weight: 500;">Cycle Quizzes</span>
                                <button id="amaes-top-pill-next" class="btn btn-sm btn-outline-primary" style="font-size: 11.5px; font-weight: 600; padding: 4px 10px; border-radius: 6px; cursor: pointer;" title="Next activity (Press ])">Next ]</button>
                            </div>
                        `}
                    </div>
                    <div style="flex: 1; min-width: 140px; text-align: right;">
                        <button id="amaes-top-btn-next-quiz" class="btn btn-primary amaes-cycle-btn amaes-cycle-btn-next" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; font-size: 12.5px; font-weight: 600; border-radius: 6px; cursor: ${nextDisabled ? 'not-allowed' : 'pointer'}; opacity: ${nextDisabled ? '0.45' : '1'}; transition: all 0.2s ease; background: #0f6cbf; border-color: #0f6cbf; color: #fff;" ${nextDisabled ? 'disabled' : ''} title="${nextQuiz ? 'Next Quiz: ' + nextLabel + ' (Press ])' : (skipPassed && list.length > 0 ? 'All subsequent quizzes passed (≥80%)' : 'Next Activity (Press ])')}">
                            <span class="amaes-cycle-title" style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(nextLabel)}</span>
                            <span class="amaes-nav-key-hint" style="font-size: 0.85em; opacity: 0.85; font-weight: 500;">(Press ])</span>
                            <span>&#9658;</span>
                        </button>
                    </div>
                `;

                const btnPrev = container.querySelector('#amaes-top-btn-prev-quiz');
                if (btnPrev && !prevDisabled) {
                    btnPrev.addEventListener('click', (e) => {
                        e.preventDefault();
                        cycleToPrevQuizOrExam();
                    });
                }

                const btnNext = container.querySelector('#amaes-top-btn-next-quiz');
                if (btnNext && !nextDisabled) {
                    btnNext.addEventListener('click', (e) => {
                        e.preventDefault();
                        cycleToNextQuizOrExam();
                    });
                }

                const btnTopRetake = container.querySelector('#amaes-top-btn-nav-retake');
                if (btnTopRetake) {
                    btnTopRetake.addEventListener('click', (e) => {
                        e.preventDefault();
                        triggerQuizRetake();
                    });
                }

                const pillPrev = container.querySelector('#amaes-top-pill-prev');
                if (pillPrev) {
                    pillPrev.addEventListener('click', (e) => {
                        e.preventDefault();
                        cycleToPrevQuizOrExam();
                    });
                }

                const pillNext = container.querySelector('#amaes-top-pill-next');
                if (pillNext) {
                    pillNext.addEventListener('click', (e) => {
                        e.preventDefault();
                        cycleToNextQuizOrExam();
                    });
                }

                const selectJump = container.querySelector('#amaes-top-quiz-cycle-select');
                if (selectJump) {
                    selectJump.addEventListener('change', (e) => {
                        const targetUrl = e.target.value;
                        if (targetUrl) {
                            showToast("Navigating to selected quiz...", 1500);
                            window.location.href = targetUrl;
                        }
                    });
                }
            } else {
                container.innerHTML = `
                    <div id="amaes-prev-quiz-container" style="flex: 1; min-width: 140px; text-align: left;">
                        <button id="amaes-btn-prev-quiz" class="btn btn-secondary amaes-cycle-btn amaes-cycle-btn-prev" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; font-size: 13px; font-weight: 600; border-radius: 6px; cursor: ${prevDisabled ? 'not-allowed' : 'pointer'}; opacity: ${prevDisabled ? '0.45' : '1'}; transition: all 0.2s ease;" ${prevDisabled ? 'disabled' : ''} title="${prevQuiz ? 'Previous Quiz: ' + prevLabel + ' (Press [)' : 'Previous Activity (Press [)'}">
                            <span>&#9668;</span>
                            <span class="amaes-cycle-title" style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(prevLabel)}</span>
                            <span class="amaes-nav-key-hint" style="font-size: 0.85em; opacity: 0.85; font-weight: 500;">(Press [)</span>
                        </button>
                    </div>
                    <div id="amaes-jump-quiz-container" style="flex: 0 1 auto; text-align: center; display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
                        ${isReviewPage ? `
                            <button id="amaes-btn-nav-retake" class="btn btn-primary btn-sm amaes-retake-nav-btn" style="display: inline-flex; align-items: center; gap: 5px; padding: 6px 14px; font-size: 12.5px; font-weight: 700; border-radius: 6px; background: #0f6cbf; border: 1px solid #0f6cbf; color: #fff; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 1px 3px rgba(15,108,191,0.25);" title="Retake this quiz immediately (Press R)">
                                ${ICONS.rotateCcw || ''}
                                <span>Retake (R)</span>
                            </button>
                        ` : ''}
                        ${list.length > 0 ? `
                            <select id="amaes-quiz-cycle-select" class="custom-select form-control amaes-cycle-select" style="max-width: 280px; font-size: 12.5px; font-weight: 500; height: 36px; padding: 4px 8px; border-radius: 6px; border: 1px solid rgba(148, 163, 184, 0.4); background: inherit; color: inherit;">
                                ${jumpOptions}
                            </select>
                        ` : `
                            <div style="display: inline-flex; align-items: center; gap: 8px;">
                                <button id="amaes-pill-prev" class="btn btn-sm btn-outline-secondary" style="font-size: 11.5px; font-weight: 600; padding: 4px 10px; border-radius: 6px; cursor: pointer;" title="Previous activity (Press [)">[ Prev</button>
                                <span style="font-size: 12px; opacity: 0.65; font-weight: 500;">Cycle Quizzes</span>
                                <button id="amaes-pill-next" class="btn btn-sm btn-outline-primary" style="font-size: 11.5px; font-weight: 600; padding: 4px 10px; border-radius: 6px; cursor: pointer;" title="Next activity (Press ])">Next ]</button>
                            </div>
                        `}
                    </div>
                    <div id="amaes-next-quiz-container" style="flex: 1; min-width: 140px; text-align: right;">
                        <button id="amaes-btn-next-quiz" class="btn btn-primary amaes-cycle-btn amaes-cycle-btn-next" style="display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; font-size: 13px; font-weight: 600; border-radius: 6px; cursor: ${nextDisabled ? 'not-allowed' : 'pointer'}; opacity: ${nextDisabled ? '0.45' : '1'}; transition: all 0.2s ease; background: #0f6cbf; border-color: #0f6cbf; color: #fff;" ${nextDisabled ? 'disabled' : ''} title="${nextQuiz ? 'Next Quiz: ' + nextLabel + ' (Press ])' : (skipPassed && list.length > 0 ? 'All subsequent quizzes passed (≥80%)' : 'Next Activity (Press ])')}">
                            <span class="amaes-cycle-title" style="max-width: 220px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(nextLabel)}</span>
                            <span class="amaes-nav-key-hint" style="font-size: 0.85em; opacity: 0.85; font-weight: 500;">(Press ])</span>
                            <span>&#9658;</span>
                        </button>
                    </div>
                `;

                const btnPrev = container.querySelector('#amaes-btn-prev-quiz');
                if (btnPrev && !prevDisabled) {
                    btnPrev.addEventListener('click', (e) => {
                        e.preventDefault();
                        cycleToPrevQuizOrExam();
                    });
                }

                const btnNext = container.querySelector('#amaes-btn-next-quiz');
                if (btnNext && !nextDisabled) {
                    btnNext.addEventListener('click', (e) => {
                        e.preventDefault();
                        cycleToNextQuizOrExam();
                    });
                }

                const btnBottomRetake = container.querySelector('#amaes-btn-nav-retake');
                if (btnBottomRetake) {
                    btnBottomRetake.addEventListener('click', (e) => {
                        e.preventDefault();
                        triggerQuizRetake();
                    });
                }

                const pillPrev = container.querySelector('#amaes-pill-prev');
                if (pillPrev) {
                    pillPrev.addEventListener('click', (e) => {
                        e.preventDefault();
                        cycleToPrevQuizOrExam();
                    });
                }

                const pillNext = container.querySelector('#amaes-pill-next');
                if (pillNext) {
                    pillNext.addEventListener('click', (e) => {
                        e.preventDefault();
                        cycleToNextQuizOrExam();
                    });
                }

                const selectJump = container.querySelector('#amaes-quiz-cycle-select');
                if (selectJump) {
                    selectJump.addEventListener('change', (e) => {
                        const targetUrl = e.target.value;
                        if (targetUrl) {
                            showToast("Navigating to selected quiz...", 1500);
                            window.location.href = targetUrl;
                        }
                    });
                }
            }
        }

        // 1. Inject Top Navigation Bar (above review questions / summary table so user navigates without scrolling)
        let topNav = document.getElementById('amaes-quiz-top-nav');
        if (!topNav) {
            topNav = document.createElement('div');
            topNav.id = 'amaes-quiz-top-nav';
            topNav.className = 'amaes-quiz-top-nav activity-navigation';

            const reviewBadge = document.getElementById('amaes-reviewable-page-badge');
            const summaryTable = target.querySelector('.quizreviewsummary, table.generaltable, .quizattemptsummary');
            const mainHeader = target.querySelector('h2, h3, .page-header-headings');

            if (reviewBadge && reviewBadge.parentNode) {
                reviewBadge.parentNode.insertBefore(topNav, reviewBadge.nextSibling);
            } else if (summaryTable && summaryTable.parentNode) {
                summaryTable.parentNode.insertBefore(topNav, summaryTable);
            } else if (mainHeader && mainHeader.nextSibling) {
                mainHeader.parentNode.insertBefore(topNav, mainHeader.nextSibling);
            } else {
                target.insertBefore(topNav, target.firstChild);
            }
        }

        topNav.style.cssText = `
            margin-top: 10px;
            margin-bottom: 16px;
            padding: 10px 16px;
            border: 1px solid rgba(148, 163, 184, 0.25);
            background: rgba(148, 163, 184, 0.05);
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 10px;
            user-select: none;
        `;
        populateQuizNavElement(topNav, true);

        // 2. Inject Bottom Navigation Bar
        let navContainer = document.getElementById('amaes-quiz-bottom-nav');
        if (!navContainer) {
            navContainer = document.createElement('div');
            navContainer.id = 'amaes-quiz-bottom-nav';
            navContainer.className = 'amaes-quiz-bottom-nav activity-navigation';
            target.appendChild(navContainer);
        }

        navContainer.style.cssText = `
            margin-top: 36px;
            margin-bottom: 24px;
            padding: 16px 20px;
            border-top: 1px solid rgba(148, 163, 184, 0.25);
            background: rgba(148, 163, 184, 0.04);
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            user-select: none;
        `;
        populateQuizNavElement(navContainer, false);
    }

    const injectQuizCycleNavigation = injectQuizBottomNavigation;

    // Cycles to the next or previous quiz/exam
    function cycleQuizOrExam(direction = 'next', opts = {}) {
        if (typeof window === 'undefined') return false;

        // 1. Strict Page Guard: Must ONLY operate on Moodle quiz, course, or exam pages
        const isExamHost = (typeof detectAssessmentOrigin === 'function' && detectAssessmentOrigin().isExam) ||
            (typeof window !== 'undefined' && window.location.hostname.includes('exam'));
        const isAcademicPage = (typeof checkIsCoursePage === 'function' && checkIsCoursePage()) ||
            (typeof checkIsQuizPage === 'function' && checkIsQuizPage()) ||
            (typeof checkIsQuizViewPage === 'function' && checkIsQuizViewPage()) ||
            (typeof checkIsReviewPage === 'function' && checkIsReviewPage()) ||
            (typeof checkIsQuizSummaryPage === 'function' && checkIsQuizSummaryPage()) ||
            (typeof checkIsQuizAttemptPage === 'function' && checkIsQuizAttemptPage()) ||
            isExamHost;

        if (!isAcademicPage) return false;

        // 2. Resolve Native Activity Links (Exam Portal or standard Moodle .activity-navigation)
        const nativeTarget = resolveActivityLink(direction);
        if (isExamHost && nativeTarget && nativeTarget.href) {
            const rawTitle = nativeTarget.innerText || nativeTarget.textContent || (direction === 'next' ? 'Next Activity' : 'Previous Activity');
            const title = rawTitle.replace(/\(Press\s*[\[\]]\)/gi, '').replace(/[►▶◄◀]/g, '').trim();
            showToast(`${direction === 'next' ? 'Advancing to' : 'Returning to'}: ${title}`, 2000);
            setLog(`<b>Exam Navigation:</b> Cycling to <b>${title}</b> via <b>[${direction === 'next' ? ']' : '['}]</b>.`, "var(--accent-blue)");
            window.location.href = nativeTarget.href;
            return true;
        }

        // 3. Quiz Portal Sequential Navigation
        const skipPassed = !isExamHost && (
            opts.skipPassed !== undefined
                ? Boolean(opts.skipPassed)
                : (typeof localStorage !== 'undefined' && localStorage.getItem('amaes_skip_passed_quizzes') === 'true')
        );

        let list = getCourseQuizzesList();
        const currentCmid = getCurrentQuizCmid();
        const courseInfo = typeof detectCourseInfo === 'function' ? detectCourseInfo() : {};
        const courseId = courseInfo && courseInfo.courseId ? courseInfo.courseId : '';

        // If list is empty, try native activity links or asynchronous remote populate and immediate recursion
        if (list.length === 0) {
            if (nativeTarget && nativeTarget.href) {
                const title = (nativeTarget.innerText || nativeTarget.textContent || (direction === 'next' ? 'Next Activity' : 'Previous Activity'))
                    .replace(/\(Press\s*[\[\]]\)/gi, '').replace(/[►▶◄◀]/g, '').trim();
                showToast(`Navigating to: ${title}`, 2000);
                window.location.href = nativeTarget.href;
                return true;
            }

            if (courseId) {
                showToast("Resolving course quizzes sequence...", 2000);
                populateCourseQuizzesFromRemote(courseId).then(remoteList => {
                    if (remoteList && remoteList.length > 0) {
                        cycleQuizOrExam(direction, opts);
                    } else {
                        showToast("No quizzes found in course navigation.", 2500);
                    }
                }).catch(() => {
                    showToast("Unable to resolve course quizzes.", 2500);
                });
                return true;
            } else {
                showToast("Please visit course home page once to map all quizzes.", 3000);
                return false;
            }
        }

        // Determine current index in list
        let currentIndex = -1;
        if (currentCmid) {
            currentIndex = list.findIndex(item => item.cmid === currentCmid);
        }
        if (currentIndex === -1 && list.length > 0) {
            currentIndex = list.findIndex(item => item.url && window.location.href.includes(item.url));
        }

        // If list is available, traverse in sequence
        if (list.length > 0) {
            let gradesMap = {};
            if (skipPassed) {
                if (typeof window !== 'undefined' && window.__amaesCourseGradesCache) {
                    gradesMap = window.__amaesCourseGradesCache;
                } else if (courseId) {
                    try {
                        const cachedGrades = localStorage.getItem(`amaes_course_grades_cache_${courseId}`);
                        if (cachedGrades) gradesMap = JSON.parse(cachedGrades);
                    } catch (_) {}
                }
            }

            const step = direction === 'next' ? 1 : -1;
            let startIndex = currentIndex !== -1 ? currentIndex + step : (direction === 'next' ? 0 : list.length - 1);
            let targetQuiz = null;

            for (let i = startIndex; direction === 'next' ? i < list.length : i >= 0; i += step) {
                const candidate = list[i];
                if (!candidate) continue;

                if (skipPassed) {
                    const cmidKey = candidate.cmid ? `cmid_${candidate.cmid}` : '';
                    const normTitle = (candidate.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
                    const gradeEntry = (cmidKey && gradesMap[cmidKey]) || gradesMap[normTitle] || null;

                    // If student already has >=80% on this quiz, skip over it
                    if (gradeEntry && gradeEntry.isPassable === true) {
                        continue;
                    }
                }

                targetQuiz = candidate;
                break;
            }

            if (targetQuiz && targetQuiz.url) {
                const toastMsg = skipPassed
                    ? `Cycling to unpassed quiz: ${targetQuiz.title}`
                    : `Cycling to: ${targetQuiz.title}`;
                showToast(toastMsg, 2000);
                setLog(`<b>Quiz Navigation:</b> Cycling to <b>${targetQuiz.title}</b> via <b>[${direction === 'next' ? ']' : '['}]</b>.`, "var(--accent-blue)");
                window.location.href = targetQuiz.url;
                return true;
            }

            if (skipPassed) {
                showToast("All subsequent quizzes have passing scores (≥80%).", 2500);
                setLog("<b>Quiz Navigation:</b> All subsequent quizzes passed (≥80%).", "var(--accent-green)");
                return false;
            } else {
                showToast(direction === 'next' ? "Reached the end of course quizzes." : "Reached the beginning of course quizzes.", 2000);
                return false;
            }
        }

        // 4. Fallback: Native link
        if (nativeTarget && nativeTarget.href) {
            window.location.href = nativeTarget.href;
            return true;
        }

        return false;
    }

    function cycleToNextQuizOrExam(opts = {}) {
        return cycleQuizOrExam('next', opts);
    }

    function cycleToPrevQuizOrExam(opts = {}) {
        return cycleQuizOrExam('prev', opts);
    }

    // Helper to resolve quiz landing URL (view.php?id=...)
    function resolveQuizViewUrl(cmid) {
        if (typeof window === 'undefined') return '';
        const finishLink = document.querySelector('a[href*="/mod/quiz/view.php?id="], a[href*="/mod/quiz/view.php?cmid="], .submitbtns a[href*="view.php"], a.btn[href*="view.php"]');
        if (finishLink && finishLink.getAttribute('href')) {
            const rawHref = finishLink.getAttribute('href');
            if (rawHref && !rawHref.startsWith('#') && !rawHref.startsWith('javascript:')) {
                try {
                    return new URL(rawHref, window.location.origin).toString();
                } catch (_) {}
            }
        }

        const resolvedCmid = cmid || getCurrentQuizCmid();
        if (resolvedCmid) {
            const basePath = window.location.pathname.includes('/mod/quiz/')
                ? window.location.pathname.replace(/\/mod\/quiz\/.*/, '/mod/quiz/view.php')
                : '/mod/quiz/view.php';
            return `${window.location.origin}${basePath}?id=${encodeURIComponent(resolvedCmid)}`;
        }
        return '';
    }

    // Initiates an immediate re-attempt of the current quiz
    async function triggerQuizRetake(options = {}) {
        if (typeof window === 'undefined') return;

        const viewUrl = resolveQuizViewUrl();
        const cmid = getCurrentQuizCmid();

        if (!viewUrl && !cmid) {
            if (typeof showToast === 'function') {
                showToast("Could not resolve quiz landing page to retake.", 3000);
            }
            return;
        }

        // Visual feedback on all retake buttons across page
        const retakeButtons = document.querySelectorAll('#amaes-btn-retake-quiz, #amaes-top-btn-nav-retake, #amaes-btn-nav-retake, .amaes-retake-nav-btn');
        retakeButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.7';
            btn.innerHTML = `${ICONS.rotateCcw || ''} <span>Starting Retake...</span>`;
        });

        if (typeof showToast === 'function') {
            showToast("Initiating quiz retake...", 2000);
        }
        if (typeof setLog === 'function') {
            setLog("Initiating <b>Retake Quiz</b>...", "var(--accent-blue)");
        }

        // Store auto-start flag in sessionStorage in case of navigation
        if (cmid) {
            try {
                sessionStorage.setItem('amaes_auto_start_attempt', String(cmid));
            } catch (_) {}
        }

        // 1. Fast Path: Fetch view.php in background, extract startattempt form, and submit
        if (viewUrl) {
            try {
                const resp = await fetch(viewUrl, { credentials: 'same-origin' });
                if (resp && resp.ok) {
                    const htmlText = await resp.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(htmlText, 'text/html');

                    const startForm = doc.querySelector(
                        'form[action*="startattempt.php"], form[action*="attempt.php"], .quizstartbutton form'
                    );

                    // If form has a password input, user must enter password on view.php so skip fast post
                    const hasPassword = startForm && startForm.querySelector('input[type="password"]');

                    if (startForm && !hasPassword && startForm.getAttribute('action')) {
                        const targetAction = new URL(startForm.getAttribute('action'), viewUrl).toString();
                        const submitForm = document.createElement('form');
                        submitForm.method = (startForm.getAttribute('method') || 'POST').toUpperCase();
                        submitForm.action = targetAction;
                        submitForm.style.display = 'none';

                        Array.from(startForm.elements).forEach(el => {
                            if (el.name && !el.disabled) {
                                const hidden = document.createElement('input');
                                hidden.type = 'hidden';
                                hidden.name = el.name;
                                hidden.value = el.value || '';
                                submitForm.appendChild(hidden);
                            }
                        });

                        document.body.appendChild(submitForm);
                        if (typeof showToast === 'function') {
                            showToast("Attempt initialized! Launching quiz...", 2000);
                        }
                        submitForm.submit();
                        return;
                    }
                }
            } catch (err) {
                console.warn('[AMAES Toolkit] Fast retake background submission skipped, using direct landing auto-start:', err);
            }
        }

        // 2. Fallback Path: Navigate to view.php with amaes_auto_start=1 query param
        const fallbackTarget = viewUrl || (cmid ? `${window.location.origin}/mod/quiz/view.php?id=${encodeURIComponent(cmid)}` : '');
        if (fallbackTarget) {
            try {
                const u = new URL(fallbackTarget, window.location.origin);
                u.searchParams.set('amaes_auto_start', '1');
                window.location.href = u.toString();
            } catch (_) {
                window.location.href = fallbackTarget;
            }
        }
    }

    // Auto-clicks attempt start button and auto-confirms attempt modal when navigating from retake
    function checkAutoStartAttemptOnLanding() {
        if (typeof window === 'undefined' || !window.location.pathname.includes('/mod/quiz/view.php')) return;

        const urlParams = new URLSearchParams(window.location.search);
        const hasAutoStartParam = urlParams.get('amaes_auto_start') === '1';
        const sessionTargetCmid = sessionStorage.getItem('amaes_auto_start_attempt');
        const currentCmid = getCurrentQuizCmid();

        const shouldAutoStart = hasAutoStartParam || (sessionTargetCmid && (!currentCmid || sessionTargetCmid === currentCmid));
        if (!shouldAutoStart) return;

        // Clean up flags immediately to prevent looping
        try {
            sessionStorage.removeItem('amaes_auto_start_attempt');
            if (hasAutoStartParam) {
                urlParams.delete('amaes_auto_start');
                const cleanQuery = urlParams.toString();
                const cleanUrl = window.location.pathname + (cleanQuery ? '?' + cleanQuery : '') + window.location.hash;
                window.history.replaceState({}, '', cleanUrl);
            }
        } catch (_) {}

        if (typeof showToast === 'function') {
            showToast("Auto-starting retake attempt...", 2000);
        }
        if (typeof setLog === 'function') {
            setLog("Auto-starting quiz attempt on landing...", "var(--accent-blue)");
        }

        const triggerAttempt = () => {
            const startBtn = document.querySelector(
                'form[action*="startattempt.php"] button, form[action*="startattempt.php"] input[type="submit"], ' +
                'form[action*="attempt.php"] button, form[action*="attempt.php"] input[type="submit"], ' +
                '.quizstartbutton button, .quizstartbutton input[type="submit"], ' +
                '#region-main button.btn-primary, #region-main input.btn-primary'
            );
            if (startBtn) {
                startBtn.click();
            }

            // Immediately poll for confirmation dialogue (up to 30 attempts x 50ms = 1.5s)
            let attempts = 0;
            const confirmInterval = setInterval(() => {
                attempts++;
                const confirmModalBtn = document.querySelector(
                    '.moodle-dialogue-bd button.btn-primary, .moodle-dialogue-bd input[type="submit"], ' +
                    '.modal.show button.btn-primary, .modal.show input[type="submit"], ' +
                    '.modal button.btn-primary[data-action="save"], input[type="submit"][value*="Start attempt" i], ' +
                    'button[data-action="save"], .confirmation-dialog button.btn-primary'
                );
                if (confirmModalBtn) {
                    clearInterval(confirmInterval);
                    confirmModalBtn.click();
                } else if (attempts >= 30) {
                    clearInterval(confirmInterval);
                }
            }, 50);
        };

        if (document.readyState !== 'complete' && document.readyState !== 'interactive') {
            document.addEventListener('DOMContentLoaded', triggerAttempt, { once: true });
        } else {
            setTimeout(triggerAttempt, 100);
        }
    }

    // Injects dedicated Retake Quiz action bar directly below .quizreviewsummary table
    function injectReviewRetakeButton() {
        if (typeof document === 'undefined') return;
        if (typeof checkIsReviewPage === 'function' && !checkIsReviewPage()) return;

        let retakeBar = document.getElementById('amaes-review-retake-bar');
        const viewUrl = resolveQuizViewUrl();

        if (!retakeBar) {
            retakeBar = document.createElement('div');
            retakeBar.id = 'amaes-review-retake-bar';
            retakeBar.className = 'amaes-review-retake-bar';
            retakeBar.style.cssText = `
                margin: 14px 0 20px 0;
                padding: 12px 18px;
                background: rgba(15, 108, 191, 0.05);
                border: 1px solid rgba(15, 108, 191, 0.25);
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 12px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                box-shadow: 0 1px 3px rgba(15, 108, 191, 0.08);
            `;

            retakeBar.innerHTML = `
                <div style="display: flex; flex-direction: column; gap: 2px;">
                    <div style="font-weight: 700; font-size: 13.5px; color: #0f6cbf; display: flex; align-items: center; gap: 6px;">
                        ${ICONS.rotateCcw || ''}
                        <span>Ready for another attempt?</span>
                    </div>
                    <div style="font-size: 12px; color: #475569;">Retake this quiz immediately with fresh questions and verified answers.</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                    <button id="amaes-btn-retake-quiz" class="btn btn-primary" style="display: inline-flex; align-items: center; gap: 7px; padding: 7px 16px; font-size: 13px; font-weight: 700; border-radius: 6px; background: #0f6cbf; border: 1px solid #0f6cbf; color: #ffffff; cursor: pointer; transition: all 0.2s ease; box-shadow: 0 2px 4px rgba(15,108,191,0.2);" title="Retake this quiz immediately (Press R)">
                        ${ICONS.rotateCcw || ''}
                        <span>Retake Quiz</span>
                        <span class="amaes-nav-key-hint" style="font-size: 0.85em; opacity: 0.9; font-weight: 600; padding: 1px 5px; border-radius: 4px; background: rgba(255,255,255,0.22);">(Press R)</span>
                    </button>
                    ${viewUrl ? `
                        <a id="amaes-btn-finish-review-link" href="${escapeHtml(viewUrl)}" class="btn btn-outline-secondary" style="display: inline-flex; align-items: center; gap: 5px; padding: 7px 14px; font-size: 12.5px; font-weight: 600; border-radius: 6px; text-decoration: none; border: 1px solid rgba(148, 163, 184, 0.4); color: #475569; background: #fff;" title="Back to quiz landing page">
                            <span>Finish Review</span>
                        </a>
                    ` : ''}
                </div>
            `;

            // Injection position: strictly directly below .quizreviewsummary table
            const summaryTable = document.querySelector('.quizreviewsummary, table.quizreviewsummary');
            if (summaryTable && summaryTable.parentNode) {
                summaryTable.parentNode.insertBefore(retakeBar, summaryTable.nextSibling);
            } else {
                const firstQue = document.querySelector('.que');
                if (firstQue && firstQue.parentNode) {
                    firstQue.parentNode.insertBefore(retakeBar, firstQue);
                } else {
                    const topNav = document.getElementById('amaes-quiz-top-nav');
                    if (topNav && topNav.parentNode) {
                        topNav.parentNode.insertBefore(retakeBar, topNav.nextSibling);
                    } else {
                        const targetArea = document.querySelector('#region-main, main, [role="main"]') || document.body;
                        if (targetArea) {
                            if (typeof targetArea.prepend === 'function') {
                                targetArea.prepend(retakeBar);
                            } else if (targetArea.firstChild) {
                                targetArea.insertBefore(retakeBar, targetArea.firstChild);
                            } else if (typeof targetArea.appendChild === 'function') {
                                targetArea.appendChild(retakeBar);
                            }
                        }
                    }
                }
            }

            const retakeBtn = retakeBar.querySelector('#amaes-btn-retake-quiz');
            if (retakeBtn) {
                retakeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    triggerQuizRetake();
                });
            }
        } else {
            // Update finish review link if viewUrl changed or became available
            const finishLink = retakeBar.querySelector('#amaes-btn-finish-review-link');
            if (finishLink && viewUrl && finishLink.getAttribute('href') !== viewUrl) {
                finishLink.setAttribute('href', viewUrl);
            }
        }
    }

    // Decorate Attempt quiz now / Re-attempt quiz button with key hint (Press A)
    function decorateQuizLandingAttemptButton() {
        if (typeof window === 'undefined' || !window.location.pathname.includes('/mod/quiz/view.php')) return;

        if (typeof checkAndAutoMarkDoneOnQuizLanding === 'function') {
            checkAndAutoMarkDoneOnQuizLanding();
        }
        if (typeof checkAutoStartAttemptOnLanding === 'function') {
            checkAutoStartAttemptOnLanding();
        }

        const startBtn = document.querySelector(
            'form[action*="attempt.php"] button, form[action*="attempt.php"] input[type="submit"], ' +
            'form[action*="startattempt.php"] button, form[action*="startattempt.php"] input[type="submit"], ' +
            '.quizstartbutton button, .quizstartbutton input[type="submit"], ' +
            '#region-main button.btn-primary, #region-main input.btn-primary'
        );
        if (!startBtn || startBtn.dataset.amaesShortcutBound) return;
        startBtn.dataset.amaesShortcutBound = 'true';

        let hint = startBtn.querySelector('.amaes-attempt-key-hint');
        if (!hint && startBtn.tagName === 'BUTTON') {
            hint = document.createElement('span');
            hint.className = 'amaes-attempt-key-hint';
            hint.style.cssText = 'margin-left: 8px; font-size: 11px; font-weight: 600; opacity: 0.9; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.35); display: inline-block; vertical-align: middle;';
            hint.textContent = '(Press A)';
            startBtn.appendChild(hint);
        } else if (!hint && startBtn.tagName === 'INPUT') {
            if (!startBtn.value.includes('(Press A)')) {
                startBtn.value = `${startBtn.value} (Press A)`;
            }
        }
    }

    // Toggleable Keyboard Navigation & Fast Shortcuts for Quiz
    function setupQuizKeyboardShortcuts() {
        decorateNativeActivityNavigation();
        injectQuizBottomNavigation();
        decorateQuizLandingAttemptButton();
        if (typeof injectReviewRetakeButton === 'function') {
            injectReviewRetakeButton();
        }
        if (typeof checkAutoStartAttemptOnLanding === 'function') {
            checkAutoStartAttemptOnLanding();
        }

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

            // Retake Quiz Shortcut on Review Pages (/mod/quiz/review.php): 'R', 'r'
            const isReviewPage = typeof checkIsReviewPage === 'function' && checkIsReviewPage();
            if (isReviewPage && (e.key === 'r' || e.key === 'R')) {
                e.preventDefault();
                if (typeof triggerQuizRetake === 'function') {
                    showToast("Retaking quiz... (R)");
                    setLog("Triggered <b>Retake Quiz</b> via keyboard shortcut [R]", "var(--accent-green)");
                    triggerQuizRetake();
                }
                return;
            }

            // Attempt / Re-attempt Quiz Shortcut on Quiz Landing Pages (/mod/quiz/view.php): 'A' or 'Enter'
            const isQuizLanding = typeof window !== 'undefined' && window.location.pathname.includes('/mod/quiz/view.php');
            if (isQuizLanding && (e.key === 'a' || e.key === 'A' || e.key === 'Enter')) {
                const confirmModalBtn = document.querySelector(
                    '.moodle-dialogue-bd button.btn-primary, .moodle-dialogue-bd input[type="submit"], ' +
                    '.modal.show button.btn-primary, .modal.show input[type="submit"], ' +
                    '.modal button.btn-primary[data-action="save"], input[type="submit"][value*="Start attempt" i], ' +
                    'button[data-action="save"], .confirmation-dialog button.btn-primary'
                );
                if (confirmModalBtn) {
                    e.preventDefault();
                    confirmModalBtn.click();
                    showToast("Confirming attempt...");
                    return;
                }

                const startBtn = document.querySelector(
                    'form[action*="attempt.php"] button, form[action*="attempt.php"] input[type="submit"], ' +
                    'form[action*="startattempt.php"] button, form[action*="startattempt.php"] input[type="submit"], ' +
                    '.quizstartbutton button, .quizstartbutton input[type="submit"], ' +
                    '#region-main button.btn-primary, #region-main input.btn-primary'
                );
                if (startBtn) {
                    e.preventDefault();
                    showToast("Starting quiz attempt... (A)");
                    setLog("Triggered <b>Attempt Quiz</b> via keyboard shortcut [A]", "var(--accent-green)");
                    startBtn.click();

                    // Immediately auto-confirm attempt modal if Moodle pops it up
                    let attempts = 0;
                    const confirmInterval = setInterval(() => {
                        attempts++;
                        const mBtn = document.querySelector(
                            '.moodle-dialogue-bd button.btn-primary, .moodle-dialogue-bd input[type="submit"], ' +
                            '.modal.show button.btn-primary, .modal.show input[type="submit"], ' +
                            '.modal button.btn-primary[data-action="save"], input[type="submit"][value*="Start attempt" i], ' +
                            'button[data-action="save"], .confirmation-dialog button.btn-primary'
                        );
                        if (mBtn) {
                            clearInterval(confirmInterval);
                            mBtn.click();
                        } else if (attempts >= 25) {
                            clearInterval(confirmInterval);
                        }
                    }, 40);
                    return;
                }
            }

            // Course page shortcut: 'U' highlights missing or unanswered quizzes
            const isCoursePage = typeof window !== 'undefined' && window.location.pathname.includes('/course/view.php');
            if (isCoursePage && (e.key === 'u' || e.key === 'U')) {
                e.preventDefault();
                if (active && typeof active.blur === 'function') active.blur();
                if (typeof highlightMissingOrUnansweredQuizzes === 'function') {
                    showToast("Scanning and highlighting missing quizzes... (U)");
                    highlightMissingOrUnansweredQuizzes();
                }
                return;
            }

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
                const panel = document.getElementById('amaes-toolkit-panel');
                const bodyEl = document.getElementById('amaes-panel-body');
                const lockOverlay = document.getElementById('amaes-panel-lock-overlay');
                const minBtn = document.getElementById('amaes-min-btn');
                const isLocked = toolkitStorage.get('amaes_terms_acknowledged') !== 'true';
                const targetEl = (isLocked && lockOverlay) ? lockOverlay : bodyEl;
                if (bodyEl) {
                    e.preventDefault();
                    if (active && typeof active.blur === 'function') active.blur();
                    if (targetEl && targetEl.style.display !== 'none') {
                        if (bodyEl) bodyEl.style.display = 'none';
                        if (lockOverlay) lockOverlay.style.display = 'none';
                        if (panel) panel.classList.add('amaes-minimized');
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
                        if (panel) panel.classList.remove('amaes-minimized');
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

            // Pause / Start Auto-Quiz or Auto-Submit: 'P'
            if (e.key === 'p' || e.key === 'P') {
                if (checkIsQuizSummaryPage()) {
                    e.preventDefault();
                    if (active && typeof active.blur === 'function') active.blur();
                    pauseQuizSummaryAutoSubmit();
                    return;
                }
                e.preventDefault();
                toggleAutoQuizMode();
                return;
            }

            // Quiz Summary page shortcuts: N / Space / Enter to hasten countdown or submit; B to return to attempt
            if (checkIsQuizSummaryPage()) {
                const key = e.key ? e.key.toUpperCase() : '';
                if (key === 'N' || key === ' ' || key === 'ENTER') {
                    e.preventDefault();
                    if (active && typeof active.blur === 'function') active.blur();
                    hastenQuizSummaryAutoSubmit();
                    return;
                }
                if (key === 'B') {
                    e.preventDefault();
                    if (active && typeof active.blur === 'function') active.blur();
                    const returnBtn = document.querySelector(
                        'form[action*="attempt.php"] input[type="submit"], ' +
                        'form[action*="attempt.php"] button, ' +
                        '.singlebutton a[href*="attempt.php"], ' +
                        'a[href*="attempt.php"]'
                    );
                    if (returnBtn) {
                        showToast("Returning to attempt... (B)");
                        setLog("Keyboard shortcut triggered: <b>Return to attempt (B)</b>", "var(--accent-blue)");
                        returnBtn.click();
                    } else {
                        showToast("No return to attempt button found.", 1800);
                    }
                    return;
                }
            }

            // Quiz & Exam Sequential Navigation Shortcuts: ']' (Next) and '[' (Previous)
            if (e.key === ']' || e.key === '[' || e.code === 'BracketRight' || e.code === 'BracketLeft') {
                const isBracketNext = e.key === ']' || e.code === 'BracketRight';
                const isBracketPrev = e.key === '[' || e.code === 'BracketLeft';
                const isExamHost = (typeof detectAssessmentOrigin === 'function' && detectAssessmentOrigin().isExam) ||
                    (typeof window !== 'undefined' && window.location.hostname.includes('exam'));
                const isAcademicPage = (typeof checkIsCoursePage === 'function' && checkIsCoursePage()) ||
                    (typeof checkIsQuizPage === 'function' && checkIsQuizPage()) ||
                    (typeof checkIsQuizViewPage === 'function' && checkIsQuizViewPage()) ||
                    (typeof checkIsReviewPage === 'function' && checkIsReviewPage()) ||
                    (typeof checkIsQuizSummaryPage === 'function' && checkIsQuizSummaryPage()) ||
                    (typeof checkIsQuizAttemptPage === 'function' && checkIsQuizAttemptPage()) ||
                    isExamHost;

                if (isAcademicPage && !e.ctrlKey && !e.altKey && !e.metaKey) {
                    e.preventDefault();
                    if (active && typeof active.blur === 'function') active.blur();
                    if (isBracketNext) {
                        cycleToNextQuizOrExam();
                    } else {
                        cycleToPrevQuizOrExam();
                    }
                    return;
                }
            }

            if (checkIsQuizSummaryPage()) return;
            if (!checkIsQuizAttemptPage()) return;

            const key = e.key ? e.key.toUpperCase() : '';

            // 0. Jump to First Unanswered Question: 'U'
            if (key === 'U') {
                e.preventDefault();
                if (active && typeof active.blur === 'function') active.blur();
                const unansweredQue = findFirstUnansweredOnCurrentPage();
                if (unansweredQue) {
                    setActiveQuestion(unansweredQue, true);
                    unansweredQue.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const firstInteractive = unansweredQue.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
                    if (firstInteractive && typeof firstInteractive.focus === 'function') {
                        firstInteractive.focus();
                    }
                    unansweredQue.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
                    unansweredQue.style.boxShadow = '0 0 0 3px rgba(15, 108, 191, 0.4)';
                    setTimeout(() => {
                        unansweredQue.style.boxShadow = '';
                    }, 1500);
                    const qData = extractQuestionData(unansweredQue);
                    showToast(`Focused Unanswered Question #${qData ? qData.qNum : ''} (U)`);
                    setLog(`Shortcut [U]: Focused unanswered <b>Question #${qData ? qData.qNum : ''}</b>`, "var(--accent-blue)");
                } else {
                    showToast("All questions on this page are answered! Press N to advance.", 2200);
                }
                return;
            }

            // Backward Navigation: 'B'
            if (key === 'B') {
                e.preventDefault();
                if (active && typeof active.blur === 'function') active.blur();
                const currentFocus = userSelectedActiveQuestion || getActiveViewportQuestion();
                const prevOnPage = findPreviousQuestionOnCurrentPage(currentFocus);
                if (prevOnPage) {
                    setActiveQuestion(prevOnPage, true);
                    prevOnPage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const qData = extractQuestionData(prevOnPage);
                    showToast(`Back: Question #${qData ? qData.qNum : ''} (B)`, 1500);
                    setLog(`Shortcut: Back to <b>Question #${qData ? qData.qNum : ''}</b>`, "var(--accent-blue)");
                    return;
                }

                const prevBtn = findQuizPrevButton();
                if (prevBtn) {
                    showToast("Shortcut: Previous Page (B)");
                    setLog("Keyboard shortcut triggered: <b>Previous Page (B)</b>", "var(--accent-blue)");
                    prevBtn.click();
                    return;
                } else {
                    showToast("Already on the first question/page (B)", 1500);
                }
                return;
            }

            // 1. Next Question / Next Page / Submit Navigation: 'N' or 'Space' or 'Enter'
            if (key === 'N' || key === ' ' || key === 'ENTER') {
                const currentFocus = userSelectedActiveQuestion || getActiveViewportQuestion();
                const nextOnPage = findNextUnansweredOnCurrentPage(currentFocus);

                if (nextOnPage) {
                    e.preventDefault();
                    if (active && typeof active.blur === 'function') active.blur();
                    setActiveQuestion(nextOnPage, true);
                    nextOnPage.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    const qData = extractQuestionData(nextOnPage);
                    showToast(`Next: Question #${qData ? qData.qNum : ''}`, 1500);
                    setLog(`Shortcut: Advance to <b>Question #${qData ? qData.qNum : ''}</b>`, "var(--accent-blue)");
                    if (autoQuizMode) {
                        runAutoQuizSolver();
                    }
                    return;
                }

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
                    try { syncCurrentPageSelectionsToEvidence(); } catch (_) {}
                    const text = navBtn.value || navBtn.innerText || navBtn.title || 'Navigation';
                    recordBreadcrumb('navigation', `User clicked navigation: ${String(text).trim().slice(0, 40)}`);
                }
            } catch (_) {}
        }, true);

        window.addEventListener('beforeunload', () => {
            try { syncCurrentPageSelectionsToEvidence(); } catch (_) {}
        });

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
    let knownWrongAnswerWarningListenersBound = false;

    function getMatchingRowAnswerEvidence(questionsDb, subQuestionText) {
        if (!subQuestionText) return { candidates: [], wrongAnswers: [], hasConflict: false };
        const rowPromptKey = normalizeQuestionMatchKey(subQuestionText);
        const candidates = questionsDb.filter(candidate => {
            const candidatePrompt = candidate.qRaw || candidate.question || candidate.qNorm || '';
            return rowPromptKey && normalizeQuestionMatchKey(candidatePrompt) === rowPromptKey;
        });
        const wrongAnswers = [];
        candidates.forEach(candidate => {
            if (!(candidate.wrongAnswerEvidence === true || candidate.evidenceType === 'moodle_review_elimination') ||
                !Array.isArray(candidate.wrongAnswers)) return;
            candidate.wrongAnswers.forEach(wrong => {
                const text = typeof wrong === 'string' ? wrong : wrong && (wrong.text || wrong.answer);
                const norm = typeof wrong === 'string' ? normalizeChoice(wrong) :
                    (wrong && (wrong.norm || normalizeChoice(text || '')));
                if (norm && text && !wrongAnswers.some(item => item.norm === norm)) {
                    wrongAnswers.push({ norm, text });
                }
            });
        });
        const validCandidates = candidates.filter(candidate => {
            const answer = candidate.ansRaw || candidate.answer || '';
            const answerNorm = candidate.ansNorm || normalizeChoice(answer);
            return answerNorm && !wrongAnswers.some(wrong =>
                wrong.norm === answerNorm || unscriptDigits(wrong.norm) === unscriptDigits(answerNorm));
        }).sort((left, right) => {
            const priority = candidate => {
                if (isConfirmedCandidate(candidate)) return 1000 + (candidate.confirmations || 1);
                if (String(candidate.source || '').toLowerCase().includes('community')) return 100 + (candidate.confirmations || 1);
                if (getStudyGuideInfo(candidate)) return 50;
                return 0;
            };
            return priority(right) - priority(left);
        });
        const verifiedCandidates = validCandidates.filter(isConfirmedCandidate);
        const candidatesForConflictCheck = verifiedCandidates.length > 0 ? verifiedCandidates : validCandidates;
        const answerKeys = new Set(candidatesForConflictCheck.map(candidate =>
            normalizeChoice(candidate.ansNorm || candidate.ansRaw || candidate.answer || '')
        ).filter(Boolean));
        return {
            candidates: validCandidates,
            wrongAnswers,
            hasConflict: answerKeys.size > 1
        };
    }

    function updateKnownWrongAnswerWarning(que) {
        if (!que) return;
        let knownWrongAnswers = [];
        try {
            knownWrongAnswers = JSON.parse(que.dataset.amaesKnownWrongAnswers || '[]');
        } catch (error) {
            console.warn('Could not read known-wrong-answer evidence for quiz question:', error);
            return;
        }

        que.querySelectorAll('.amaes-known-wrong-selection').forEach(el => {
            el.classList.remove('amaes-known-wrong-selection');
        });
        const wrongValues = new Map(knownWrongAnswers
            .filter(item => item && item.norm && item.text)
            .map(item => [item.norm, item.text]));
        const matchedWrongValues = new Map();
        const inputs = que.querySelectorAll(
            '.answer input[type="radio"]:checked, .answer input[type="checkbox"]:checked, select, ' +
            'input[type="text"], input.form-control, textarea'
        );

        inputs.forEach(input => {
            let value = '';
            if (input.matches('select')) {
                const option = input.selectedOptions && input.selectedOptions[0];
                if (option && option.value && !option.text.toLowerCase().includes('choose')) value = option.text;
            } else if (input.matches('input[type="radio"], input[type="checkbox"]')) {
                value = cleanDOMToAI(input.closest('.r0, .r1, li, tr, label') || input.parentElement);
            } else {
                value = input.value || '';
            }

            let inputWrongValues = wrongValues;
            if (input.dataset && input.dataset.amaesKnownWrongAnswers) {
                try {
                    inputWrongValues = new Map(JSON.parse(input.dataset.amaesKnownWrongAnswers)
                        .filter(item => item && item.norm && item.text)
                        .map(item => [item.norm, item.text]));
                } catch (error) {
                    console.warn('Could not read known-wrong-answer evidence for answer control:', error);
                    return;
                }
            }
            const norm = normalizeChoice(value);
            const match = norm && inputWrongValues.has(norm) ? inputWrongValues.get(norm) : null;
            if (!match) return;
            matchedWrongValues.set(norm, match);
            input.classList.add('amaes-known-wrong-selection');
            const choiceRow = input.closest('.r0, .r1, li, tr');
            if (choiceRow) choiceRow.classList.add('amaes-known-wrong-selection');
        });

        let warning = que.querySelector('.amaes-known-wrong-answer-warning');
        if (matchedWrongValues.size === 0) {
            if (warning) warning.remove();
            return;
        }

        if (!warning) {
            warning = document.createElement('div');
            warning.className = 'amaes-known-wrong-answer-warning';
            warning.setAttribute('role', 'alert');
            warning.setAttribute('aria-live', 'polite');
            warning.style.cssText = 'margin: 6px 0; padding: 8px 10px; border-left: 4px solid #dc2626; border-radius: 4px; background: rgba(220,38,38,.1); color: #b91c1c; font-size: 12px; font-weight: 700;';
            const formulation = que.querySelector('.formulation, .content') || que;
            formulation.insertBefore(warning, formulation.firstChild);
        }
        const answers = Array.from(matchedWrongValues.values());
        warning.textContent = `Warning: ${answers.map(answer => `“${answer}”`).join(', ')} ${answers.length === 1 ? 'was' : 'were'} marked incorrect in a previous Moodle review. Change ${answers.length === 1 ? 'this answer' : 'these answers'} before continuing.`;
    }

    function bindKnownWrongAnswerWarningListeners() {
        if (knownWrongAnswerWarningListenersBound) return;
        knownWrongAnswerWarningListenersBound = true;
        const refreshWarning = event => {
            const que = event.target && event.target.closest ? event.target.closest('.que') : null;
            if (que) updateKnownWrongAnswerWarning(que);
        };
        document.addEventListener('input', refreshWarning, true);
        document.addEventListener('change', refreshWarning, true);
    }

    function highlightQuizAnswers(questionsDb, autoSelect = false, isManualSelect = false) {
        if (toolkitStorage.get('amaes_terms_acknowledged') !== 'true') {
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

        let probedThisPageCount = 0;
        const sCode = (detectCourseInfo().subjectCode) || 'GENERAL';
        const quizSummary = typeof getQuizAttemptSummary === 'function' ? getQuizAttemptSummary(sCode) : null;
        const questionCandidateIndex = new Map();
        questionsDb.forEach(item => {
            const key = normalizeQuestionMatchKey(item.qNorm || item.qRaw || item.question);
            if (!key) return;
            if (!questionCandidateIndex.has(key)) questionCandidateIndex.set(key, []);
            questionCandidateIndex.get(key).push(item);
        });

        queContainers.forEach(que => {
            delete que.dataset.amaesStudyGuideFallbackPicked;
            que.classList.remove('amaes-no-answer-que');
            if (identifyQuestionType(que) === 'unknown') {
                recordUnknownQuestionType(que);
                return;
            }

            const qtextElem = que.querySelector('.qtext, .formulation .qtext');
            if (!qtextElem) return;

            // Redundant whole-card matching action button (.amaes-ai-matching-run-btn) is cleaned up
            // in favor of individual row '+ AI' buttons (allowAnswered: true) to eliminate button clutter and 15 RPM rate limit exhaustion.
            que.querySelectorAll('.amaes-ai-matching-run-btn').forEach(el => el.remove());

            // Clone qtext and remove input, select, textarea, drop zones, and badges so inline blanks match AMAUOED entries cleanly
            const qClone = qtextElem.cloneNode(true);
            qClone.querySelectorAll('input, select, textarea, .drop, .draghome, .drags, .amaes-shortans-hint, .amaes-select-hint, .amaes-drag-hint, .amaes-unanswered-hint, .amaes-blockage-hud, .amaes-new-question-focus-banner, .amaes-unsure-help-chip, .amaes-known-wrong-answer-warning, .amaes-verified-badge, .amaes-probability-hint, .amaes-review-status-pill, .amaes-review-outcome-banner, .amaes-que-top-toolbar, .amaes-que-stop-btn, .amaes-ai-question-tag').forEach(el => el.remove());
            const moodleQRaw = qClone.innerText.trim();
            const moodleQNorm = normalizeText(moodleQRaw);

            const currentQuestionKey = normalizeQuestionMatchKey(moodleQNorm);
            let matchingCandidates = questionCandidateIndex.get(currentQuestionKey) || [];
            const exactCandidates = matchingCandidates;
            const matchingQuestionKeys = new Set(exactCandidates.length > 0 ? [currentQuestionKey] : []);
            if (exactCandidates.length === 0) {
                matchingCandidates = [];
                questionCandidateIndex.forEach((items, candidateKey) => {
                    if (questionTextMatches(candidateKey, currentQuestionKey)) {
                        matchingQuestionKeys.add(candidateKey);
                        matchingCandidates.push(...items);
                    }
                });
            }
            const hasAmbiguousQuestionMatch = exactCandidates.length === 0 && matchingQuestionKeys.size > 1;
            let candidates = exactCandidates.length > 0
                ? exactCandidates
                : (hasAmbiguousQuestionMatch ? [] : matchingCandidates);

            // Prioritize candidates when multiple match:
            // 1. By matching image asset token from the question DOM
            // 2. By verified candidate status
            if (candidates.length > 1) {
                const liveImgTokens = Array.from(que.querySelectorAll('.formulation img, .qtext img')).map(img => {
                    const src = img.src || img.getAttribute('data-src') || '';
                    const m = src.match(/\/pluginfile\.php\/\d+\/question\/(?:answer|questiontext|feedback)\/\d+(?:\/\d+)?\/([^?#\s]+)/i);
                    return m ? m[1].toLowerCase() : '';
                }).filter(Boolean);

                if (liveImgTokens.length > 0) {
                    const assetMatched = candidates.filter(c => {
                        const qStr = (c.qRaw || c.question || '').toLowerCase();
                        return liveImgTokens.some(tok => qStr.includes(tok));
                    });
                    if (assetMatched.length > 0) {
                        candidates = assetMatched;
                    }
                }

                const confirmed = candidates.filter(c => isConfirmedCandidate(c));
                if (confirmed.length > 0) {
                    candidates = confirmed;
                }
            }
            const reviewEliminationCandidates = [];
            questionCandidateIndex.forEach((items, candidateKey) => {
                if (candidateKey === currentQuestionKey || !questionTextMatches(candidateKey, currentQuestionKey)) return;
                items.forEach(item => {
                    const hasReviewElimination = item.wrongAnswerEvidence === true ||
                        item.evidenceType === 'moodle_review_elimination' ||
                        (Array.isArray(item.wrongAnswers) && item.wrongAnswers.some(w =>
                            w && typeof w === 'object' && Array.isArray(w.sources) &&
                            w.sources.some(source => source === 'Review' || source === 'moodle_review')
                        ));
                    if (hasReviewElimination && Array.isArray(item.wrongAnswers) && item.wrongAnswers.length > 0) {
                        reviewEliminationCandidates.push(item);
                    }
                });
            });
            if (reviewEliminationCandidates.length > 0) {
                candidates = Array.from(new Set([...candidates, ...reviewEliminationCandidates]));
            }
            const hasAnyVerifiedCandidate = candidates.some(item => isConfirmedCandidate(item));

            // Clean up any prior hints
            que.querySelectorAll('.amaes-unanswered-hint, .amaes-known-wrong-answer-warning, .amaes-ambiguous-question-match-note, .amaes-study-guide-question-tag').forEach(b => b.remove());

            if (hasAmbiguousQuestionMatch) {
                const formulation = que.querySelector('.formulation, .content') || que;
                const warning = document.createElement('div');
                warning.className = 'amaes-ambiguous-question-match-note';
                warning.style.cssText = 'margin-bottom: 8px; padding: 5px 9px; border-left: 3px solid #f59e0b; background: rgba(245, 158, 11, 0.1); color: #b45309; font-size: 10.5px;';
                warning.textContent = 'Similar saved questions have different wording. Auto-answer is paused here to avoid using an answer from the wrong question.';
                formulation.insertBefore(warning, formulation.firstChild);
                return;
            }

            if (candidates.length === 0) {
                if (checkIsQuizAttemptPage() && !que.querySelector('.amaes-new-question-focus-banner') && !que.querySelector('.amaes-blockage-hud')) {
                    que.classList.add('amaes-no-answer-que');
                    const numElem = que.querySelector('.info .no, .qno');
                    const qNum = numElem ? numElem.innerText.replace(/[^0-9]/g, '') : '';
                    renderNewQuestionFocusBanner(que, qNum);
                    updateNextButtonIndicator();
                } else if (checkIsQuizAttemptPage()) {
                    que.classList.add('amaes-no-answer-que');
                }
                return;
            }
            // Verified evidence wins; AMAUOED and Jenny's Online share equal suggestion priority.
            candidates.sort((a, b) => {
                const priority = item => {
                    if (isConfirmedCandidate(item)) return 1000 + (item.confirmations || 1);
                    if (String(item.source || '').toLowerCase().includes('community')) return 100 + (item.confirmations || 1);
                    if (getStudyGuideInfo(item)) return 50;
                    return 0;
                };
                return priority(b) - priority(a);
            });

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
            que.querySelectorAll('.amaes-verified-badge, .amaes-unverified-badge, .amaes-eliminated-badge, .amaes-probability-hint, .amaes-shortans-hint, .amaes-select-hint, .amaes-select-elim-hint, .amaes-matching-row-conflict-note, .amaes-drag-hint, .amaes-unanswered-hint, .amaes-ai-matching-suggestion, .amaes-ai-suggested-badge, .amaes-ai-question-tag, .amaes-study-guide-question-tag, .amaes-pool-changed-hint').forEach(b => b.remove());

            // Safety: collect all verified/confirmed answers for this question
            const verifiedNorms = new Set();
            candidates.forEach(cand => {
                if (isConfirmedCandidate(cand)) {
                    if (cand.ansNorm) verifiedNorms.add(cand.ansNorm);
                    if (cand.ansRaw) verifiedNorms.add(normalizeChoice(cand.ansRaw));
                    if (Array.isArray(cand.answers)) {
                        cand.answers.forEach(a => verifiedNorms.add(normalizeChoice(a)));
                    }
                }
            });

            // Target each choice row container cleanly (excluding rows that contain select dropdowns)
            let choiceRows = Array.from(que.querySelectorAll('.answer > div.r0, .answer > div.r1, .answer > div, .answer li, .answer tr'))
                .filter(row => !row.querySelector('select'));
            if (choiceRows.length === 0) {
                choiceRows = Array.from(que.querySelectorAll('.answer div.r0, .answer div.r1, .answer li, .answer tr'))
                    .filter(row => !row.querySelector('select'));
            }
            if (choiceRows.length === 0) {
                choiceRows = Array.from(que.querySelectorAll('.answer label'))
                    .filter(label => !label.querySelector('select') && !label.closest('tr')?.querySelector('select'));
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
                if (Array.isArray(cand.wrongAnswers) && cand.wrongAnswers.length > 0) {
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
            const studyGuideAnswerKeys = new Set(candidates
                .filter(candidate => Boolean(getStudyGuideInfo(candidate)))
                .map(candidate => (Array.isArray(candidate.answers) && candidate.answers.length > 0
                    ? candidate.answers.map(normalizeChoice).filter(Boolean).sort().join('|')
                    : normalizeChoice(candidate.ansNorm || candidate.ansRaw || candidate.answer || '')))
                .filter(Boolean));
            const hasStudyGuideConflict = !hasAnyVerifiedCandidate && studyGuideAnswerKeys.size > 1;

            if (hasStudyGuideConflict) {
                const formulation = que.querySelector('.formulation, .content') || que;
                let conflictNote = que.querySelector('.amaes-study-guide-conflict-note');
                if (!conflictNote) {
                    conflictNote = document.createElement('div');
                    conflictNote.className = 'amaes-study-guide-conflict-note';
                    conflictNote.style.cssText = 'margin: 6px 0; padding: 6px 9px; border-left: 3px solid #f59e0b; background: rgba(245,158,11,.1); color: inherit; font-size: 11px;';
                    conflictNote.textContent = 'Study guides disagree on this answer. Auto-Pick is paused for this question; compare the source suggestions before choosing.';
                    formulation.insertBefore(conflictNote, formulation.firstChild);
                }
            } else {
                que.querySelector('.amaes-study-guide-conflict-note')?.remove();
            }

            // Contradiction Guard: A multiple-choice question cannot have 100% of choices wrong!
            // If all choices are marked wrong, keep only those with higher failure counts, preserving at least 1 candidate.
            if (choiceRows.length >= 2 && allWrongList.length >= choiceRows.length) {
                if (typeof detectAndReportQuestionAnomaly === 'function') {
                    detectAndReportQuestionAnomaly({
                        anomalyType: 'ALL_CHOICES_ELIMINATED',
                        subjectCode: sCode,
                        activityTitle: document.title || '',
                        questionRaw: moodleQRaw,
                        questionNorm: moodleQNorm,
                        domType: identifyQuestionType(que) || 'multichoice',
                        submittedAnswer: '',
                        markScored: 0,
                        maxMark: 1,
                        attemptHistory: allWrongList.map(w => w.text || w.norm),
                        dbCandidate: candidates[0] || null
                    });
                }
                allWrongList.sort((a, b) => (b.count || 1) - (a.count || 1));
                allWrongList.splice(choiceRows.length - 1);
            }
            que.dataset.amaesKnownWrongAnswers = JSON.stringify(allWrongList
                .filter(item => item.norm && item.text)
                .map(item => ({ norm: normalizeChoice(item.norm), text: item.text })));
            bindKnownWrongAnswerWarningListeners();
            updateKnownWrongAnswerWarning(que);

            // ── Choice Pool Mismatch Detection ──────────────────────────────────
            // If the DB has stored choices for this question but NONE of them match the
            // live Moodle choices, it means the question pool was updated (new choices
            // swapped in). Warn the student and fall back to elimination-only mode.
            if (identifyQuestionType(que) !== 'match' && choiceRows.length >= 2 && candidates.length > 0) {
                const liveChoiceNorms = Array.from(choiceRows).map(r => {
                    const lbl = r.querySelector('label') || r;
                    return normalizeChoice(cleanDOMToAI(lbl));
                }).filter(Boolean);

                // Check if candidate stored answer(s) appear in live choices (supporting multi-answer questions)
                const getCandidateSubAnswers = (cand) => {
                    if (!cand) return [];
                    return (Array.isArray(cand.answers) ? cand.answers : [])
                        .concat((cand.ansRaw || '').split(/[,;&\n]+|\s+and\s+/i))
                        .concat((cand.answer || '').split(/[,;&\n]+|\s+and\s+/i))
                        .map(s => normalizeChoice(s))
                        .filter(Boolean);
                };

                const topCand = candidates[0];
                const storedChoices = Array.isArray(topCand.choices) ? topCand.choices : [];
                const storedAnsNorm = topCand.ansNorm || normalizeChoice(topCand.ansRaw || topCand.answer || '');
                const topSubAnswers = getCandidateSubAnswers(topCand);

                const matchesLive = (targetNorm) => liveChoiceNorms.some(ln =>
                    ln === targetNorm || unscriptDigits(ln) === unscriptDigits(targetNorm)
                );

                const topAnsInLive = topSubAnswers.length > 0
                    ? topSubAnswers.some(matchesLive)
                    : matchesLive(storedAnsNorm);

                const anyCandInLive = topAnsInLive || candidates.some(cand => {
                    if (!isConfirmedCandidate(cand)) return false;
                    const subs = getCandidateSubAnswers(cand);
                    const norm = cand.ansNorm || normalizeChoice(cand.ansRaw || cand.answer || '');
                    return subs.length > 0 ? subs.some(matchesLive) : matchesLive(norm);
                });

                // Only flag if stored answer is non-empty AND none of the candidate answers match live choices
                const poolChanged = storedAnsNorm && !anyCandInLive && liveChoiceNorms.length > 0;

                if (poolChanged && !que.querySelector('.amaes-pool-changed-hint')) {
                    const formulation = que.querySelector('.formulation, .content') || que;
                    const warn = document.createElement('div');
                    warn.className = 'amaes-pool-changed-hint';
                    warn.style.cssText = `
                        display: inline-flex;
                        align-items: center;
                        gap: 6px;
                        margin-bottom: 8px;
                        padding: 5px 11px;
                        background: rgba(245, 158, 11, 0.12);
                        border: 1px solid rgba(245, 158, 11, 0.45);
                        border-left: 3px solid #f59e0b;
                        border-radius: 6px;
                        font-size: 10.5px;
                        color: #d97706;
                        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                    `;
                    warn.innerHTML = `
                        <span style="background: rgba(245,158,11,0.22); color: #d97706; padding: 1px 5px; border-radius: 4px; font-weight: 800; font-size: 9px; letter-spacing: 0.5px;">POOL CHANGED</span>
                        <span>Stored answer not in current choices — question pool may have been updated. Using elimination hints only.</span>
                    `;
                    formulation.insertBefore(warn, formulation.firstChild);
                }
            }
            // ────────────────────────────────────────────────────────────────────

            const isRadio = que.querySelector('.answer input[type="radio"]') !== null;
            let foundMatchForQuestion = false;

            // Preserve explicit probe/alternative flips
            if (que.dataset.amaesProbeFlipped === 'true') {
                foundMatchForQuestion = true;
            }

            // ── Adaptive Choice Rotation / Blind Probe Solver ──────────────────
            // When an unreviewed quiz attempt scored < 100%, rotate choices on suspect/unverified questions
            // across attempts to systematically explore the solution space until 100% is reached.
            const isAdaptiveProbeActive = (typeof adaptiveProbeQuiz === 'undefined' || adaptiveProbeQuiz !== false) && checkIsQuizAttemptPage();
            const unreviewedEntry = typeof getUnreviewedAttemptEntry === 'function' ? getUnreviewedAttemptEntry(moodleQNorm, sCode) : null;
            const probeEntry = typeof getProbeEntry === 'function' ? getProbeEntry(moodleQNorm, sCode) : null;
            const lastAttemptPercentage = (unreviewedEntry && typeof unreviewedEntry.percentage === 'number')
                ? unreviewedEntry.percentage
                : (probeEntry && typeof probeEntry.lastPercentage === 'number'
                    ? probeEntry.lastPercentage
                    : (quizSummary && typeof quizSummary.percentage === 'number' ? quizSummary.percentage : null));
            const hasPriorFailedAttempt = lastAttemptPercentage !== null && lastAttemptPercentage < 100;
            const isQuestionSuspect = !hasAnyVerifiedCandidate || hasPriorFailedAttempt;
            const hasQuestionLevelFailureEvidence = qGradeInfo.isZeroMark ||
                Array.from(choiceRows).some(row => hasChoiceCross(row) || hasChoiceCross(row.querySelector('label')));

            // Probe ONLY rotates on questions lacking a confirmed answer (never touches confirmed review/100% answers!)
            if (!hasAnyVerifiedCandidate && isQuestionSuspect && hasQuestionLevelFailureEvidence &&
                isAdaptiveProbeActive && choiceRows.length >= 2 && !foundMatchForQuestion) {
                // If student took a prior attempt manually, Moodle's attemptonlast=1 may have pre-checked their prior choice
                const preCheckedRadio = que.querySelector('.answer input[type="radio"]:checked');
                const preCheckedNorm = preCheckedRadio ? normalizeChoice(cleanDOMToAI(preCheckedRadio.closest('label') || preCheckedRadio.parentElement)) : null;

                const prevChoiceNorm = (unreviewedEntry && unreviewedEntry.ansNorm) ||
                    (probeEntry && probeEntry.lastNorm) ||
                    preCheckedNorm ||
                    (candidates.length > 0 ? (candidates[0].ansNorm || normalizeChoice(candidates[0].ansRaw || candidates[0].answer || '')) : null);
                const triedChoices = (probeEntry && Array.isArray(probeEntry.triedChoices))
                    ? probeEntry.triedChoices
                    : (prevChoiceNorm ? [prevChoiceNorm] : []);

                // Check available valid (non-eliminated) rows
                const validRows = [];
                choiceRows.forEach(row => {
                    const lbl = row.querySelector('label') || row;
                    const inp = row.querySelector('input[type="radio"], input[type="checkbox"]');
                    const norm = normalizeChoice(cleanDOMToAI(lbl));
                    const isElim = isChoiceRowEliminated(row) || allWrongList.some(w => w.norm === norm || unscriptDigits(w.norm) === unscriptDigits(norm));
                    if (norm && !isElim) {
                        validRows.push({ row, label: lbl, input: inp, norm, rawText: cleanDOMToAI(lbl).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim() });
                    }
                });

                const budget = typeof adaptiveProbeBudget === 'number' ? adaptiveProbeBudget : 2;
                if (hasPriorFailedAttempt && validRows.length >= 2 && probedThisPageCount < budget) {
                    let probeTarget = null;
                    let isFlipped = false;

                    if (validRows.length === 2) {
                        // Binary True/False question: Flip to the opposite choice!
                        const opposite = validRows.find(vr => vr.norm !== prevChoiceNorm && unscriptDigits(vr.norm) !== unscriptDigits(prevChoiceNorm));
                        if (opposite) {
                            probeTarget = opposite;
                            isFlipped = true;
                        }
                    } else {
                        // Multiple choice (3+ choices): Pick an untried candidate row different from prevChoiceNorm
                        const untried = validRows.find(vr => vr.norm !== prevChoiceNorm && !triedChoices.includes(vr.norm) && !triedChoices.includes(unscriptDigits(vr.norm)));
                        if (untried) {
                            probeTarget = untried;
                        } else {
                            probeTarget = validRows.find(vr => vr.norm !== prevChoiceNorm) || validRows[0];
                        }
                    }

                    if (probeTarget) {
                        foundMatchForQuestion = true;
                        probedThisPageCount++;
                        que.dataset.amaesProbeFlipped = 'true';

                        const targetRow = probeTarget.row;
                        targetRow.classList.add('amaes-adaptive-probe-choice');
                        targetRow.style.outline = '2px solid #a855f7';
                        targetRow.style.backgroundColor = 'rgba(168, 85, 247, 0.12)';
                        targetRow.style.boxShadow = '0 0 0 1px rgba(168, 85, 247, 0.25)';
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

                        const targetLbl = probeTarget.label;
                        if (targetLbl && targetLbl !== targetRow) {
                            targetLbl.style.outline = 'none';
                            targetLbl.style.backgroundColor = 'transparent';
                            targetLbl.style.padding = '0';
                            targetLbl.style.margin = '0';
                            targetLbl.style.display = 'inline-flex';
                            targetLbl.style.alignItems = 'center';
                            targetLbl.style.gap = '6px';
                            targetLbl.style.cursor = 'pointer';
                        }

                        let badge = targetRow.querySelector('.amaes-adaptive-probe-badge');
                        if (!badge) {
                            badge = document.createElement('span');
                            badge.className = 'amaes-adaptive-probe-badge';
                            badge.innerHTML = `${ICONS.rotateCcw || ''} <span>Adaptive Probe (${isFlipped ? 'Flipped' : 'Rotated'})</span>`;
                            badge.style.cssText = `
                                background: #a855f7;
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
                            `;
                            targetRow.appendChild(badge);
                        }

                        const canSelectAnswer = isManualSelect || (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode));
                        if (canSelectAnswer && probeTarget.input && !probeTarget.input.checked) {
                            safelySelectInput(probeTarget.input);
                        }

                        recordAttemptAnswerEvidence(que, probeTarget.rawText, 'adaptive_probe', {
                            verified: false,
                            isAdaptiveProbe: true
                        });

                        setLog(`<b>Adaptive Probe:</b> Rotated choice on unverified question (prior attempt scored ${lastAttemptPercentage}%) to test alternative.`, '#a855f7');
                    }
                }
            }
            // ────────────────────────────────────────────────────────────────────

            choiceRows.forEach(row => {
                if (row.querySelector('select')) return;
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
                            if (hasAnyVerifiedCandidate && !isConfirmedCandidate(cand)) continue;
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
                        const hasVerifiedSource = sourceCandidates.some(candidate => isConfirmedCandidate(candidate));
                        const hasCommunitySource = !hasVerifiedSource && sourceCandidates.some(candidate =>
                            Boolean((candidate.source || '').toLowerCase().includes('community') ||
                            (Array.isArray(candidate.sources) && candidate.sources.some(source => String(source).toLowerCase().includes('community'))))
                        );
                        const hasStudyGuideSource = !hasVerifiedSource && sourceCandidates.some(candidate =>
                            Boolean(getStudyGuideInfo(candidate))
                        );
                        const hasAiSource = !hasVerifiedSource && !hasCommunitySource && !hasStudyGuideSource && sourceCandidates.some(candidate =>
                            Boolean(candidate.isAiSuggestion || (candidate.source || '').toLowerCase().includes('gemini') ||
                            (Array.isArray(candidate.sources) && candidate.sources.some(source => String(source).toLowerCase().includes('gemini'))))
                        );
                        const studyGuide = hasStudyGuideSource
                            ? getStudyGuideInfo(sourceCandidates.find(candidate => getStudyGuideInfo(candidate)))
                            : (hasCommunitySource ? { label: 'Community', url: null } : null);
                        const isStudyGuide = Boolean(studyGuide);
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
                            const verifiedItem = sourceCandidates.find(candidate => isConfirmedCandidate(candidate));
                            const originSuffix = (verifiedItem && verifiedItem.originLabel && verifiedItem.originLabel !== 'General')
                                ? ` • From ${verifiedItem.originLabel}`
                                : '';
                            sourceLabels.push(isDeduced ? `Deduced Answer${originSuffix}` : `Verified Answer${originSuffix}`);
                        }
                        if (hasCommunitySource) sourceLabels.push('Community Candidate (Unconfirmed)');
                        if (hasStudyGuideSource && studyGuide) {
                            sourceLabels.push(`Web Study Guide (${studyGuide.label}, Unconfirmed)`);
                        }
                        if (hasAiSource) sourceLabels.push('AI Suggestion (Gemini)');

                        // Apply full row highlight on container
                        const targetRow = row;
                        targetRow.classList.add(hasAiSource ? 'amaes-ai-suggested-choice' : 'amaes-highlighted-choice');
                        if (hasAiSource) {
                            setQuestionAiTag(que, true);
                        } else if (hasVerifiedSource) {
                            setQuestionAiTag(que, false);
                        } else if (isStudyGuide) {
                            setQuestionStudyGuideTag(que, studyGuide.label);
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

                        // Differentiate unconfirmed study-guide choice text from default white
                        if (isStudyGuide) {
                            targetRow.querySelectorAll('label, .answernumber, p, span').forEach(el => {
                                if (!el.classList.contains('amaes-unverified-badge') && !el.closest('.amaes-unverified-badge')) {
                                    el.style.color = 'var(--accent-sky, #0284c7)';
                                }
                            });
                        }

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
                            badge = document.createElement(isStudyGuide && studyGuide.url ? 'a' : 'span');
                            badge.className = hasAiSource ? 'amaes-ai-suggested-badge' : (hasVerifiedSource ? 'amaes-verified-badge amaes-badge-db' : `amaes-unverified-badge ${hasStudyGuideSource ? 'amaes-badge-amauoed' : 'amaes-badge-db'}`);
                            badge.innerHTML = sourceLabels.map(label => {
                                const icon = label.startsWith('AI Suggestion') ? '' : (label.includes('Unconfirmed') ? ICONS.external : (isDeduced ? ICONS.lightbulb : ICONS.checkCircle));
                                return `${icon} <span>${label}</span>`;
                            }).join('<span style="opacity:.55"> + </span>');
                            if (isStudyGuide && studyGuide.url) {
                                badge.href = studyGuide.url;
                                badge.target = '_blank';
                                badge.rel = 'noopener noreferrer';
                                badge.title = `Source: ${studyGuide.label} — Click to open source`;
                                badge.onclick = (e) => { e.stopPropagation(); };
                            }
                            badge.style.cssText = `
                                background: ${isStudyGuide ? 'rgba(2, 132, 199, 0.15)' : sourceColor};
                                color: ${isStudyGuide ? '#0284c7 !important' : '#ffffff !important'};
                                border: ${isStudyGuide ? '1px solid rgba(2, 132, 199, 0.4)' : 'none'};
                                font-size: 10px;
                                font-weight: 700;
                                padding: 2px 7px;
                                border-radius: 4px;
                                margin-left: auto;
                                display: inline-flex;
                                align-items: center;
                                gap: 4px;
                                box-shadow: ${isStudyGuide ? 'none' : '0 1px 3px rgba(0,0,0,0.18)'};
                                white-space: nowrap;
                                flex-shrink: 0;
                                text-decoration: none;
                                cursor: ${isStudyGuide && studyGuide.url ? 'pointer' : 'default'};
                            `;
                            targetRow.appendChild(badge);
                        }

                        // USER OVERRIDE SAFETY: If user already selected a choice on this question, NEVER overwrite their decision!
                        // EXCEPTION: When a verified/confirmed answer exists, auto-pick applies it even if a pre-checked radio exists from a prior manual attempt
                        const canSelectAnswer = (isManualSelect && hasVerifiedSource) || (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode) &&
                            (hasVerifiedSource || (hasAiSource && aiAutoSelect) ||
                                (isStudyGuide && autoQuizMode && autoPickStudyGuideFallback)));
                        const anyRadioChecked = isRadio && Boolean(que.querySelector('.answer input[type="radio"]:checked'));
                        const shouldSelect = canSelectAnswer && input && !input.checked && (!anyRadioChecked || hasVerifiedSource || isManualSelect);
                        if (shouldSelect) {
                            safelySelectInput(input);
                            const choiceTextClean = cleanDOMToAI(label).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                            recordAttemptAnswerEvidence(que, choiceTextClean,
                                hasAiSource ? 'ai_inference' : (hasVerifiedSource ? 'verified_db' : 'study_guide_suggestion'), {
                                verified: hasVerifiedSource,
                                isAdaptiveProbe: false
                            });
                        }
                        if (isStudyGuide && autoQuizMode && autoPickStudyGuideFallback && Boolean(autoSelect) &&
                            input && input.checked) {
                            que.dataset.amaesStudyGuideFallbackPicked = 'true';
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

                        // Auto-uncheck eliminated checkbox if student or previous attempt pre-checked it
                        if (input && input.type === 'checkbox' && input.checked && (autoQuizMode || autoPickQuiz || isManualSelect) && hasAnyVerifiedCandidate) {
                            try { input.click(); } catch (_) {}
                            if (input.checked) input.checked = false;
                            input.dispatchEvent(new Event('input', { bubbles: true }));
                            input.dispatchEvent(new Event('change', { bubbles: true }));
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
                        safelySelectInput(deducedInput);
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
                            source: 'Elimination Deduction',
                            evidenceType: 'moodle_review_elimination'
                        }], 'Elimination Deduction');
                    }
                } else if (uneliminated.length > 1 && uneliminated.length < choiceRows.length) {
                    // Partial elimination: display remaining probability based on elimination count
                    const elimPct = Math.round(100 / uneliminated.length);
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
                            pHint.title = `${uneliminated.length} of ${choiceRows.length} choices remain after elimination`;
                            pHint.innerHTML = `${ICONS.target} <span>~${elimPct}% chance</span>`;
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
                            safelySelectInput(matchedAi.input);
                        }
                    }
                }
            }

            // Handle Short Answer / Text inputs (both standard and inline cloze inputs)
            if (!foundMatchForQuestion) {
                const textInputs = que.querySelectorAll('input[type="text"], input.form-control, textarea, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="reset"])');
                if (textInputs.length > 0 && validCandidates.length > 0 && !checkIsReviewPage()) {
                    // Exclude multiple-choice, True/False, and choice-letter candidates from text inputs
                    const shortAnsCandidates = validCandidates.filter(cand => {
                        if (cand.questionType && ['multichoice', 'match', 'ddwtos'].includes(cand.questionType)) return false;
                        if (cand.questionType === 'gapselect' && Array.isArray(cand.choices) && cand.choices.length > 0) return false;
                        if (Array.isArray(cand.choices) && cand.choices.length > 1) return false;
                        const raw = String(cand.ansRaw || cand.answer || '').trim();
                        if (/^[a-d][.)]\s*(true|false)$/i.test(raw)) return false;
                        if (/^(true|false)$/i.test(raw)) return false;
                        if (/^[a-d][.)]?$/i.test(raw)) return false;
                        return true;
                    });
                    if (shortAnsCandidates.length === 0) {
                        if (typeof detectAndReportQuestionAnomaly === 'function') {
                            detectAndReportQuestionAnomaly({
                                anomalyType: 'TYPE_MISMATCH_LEAK',
                                subjectCode: sCode,
                                activityTitle: document.title || '',
                                questionRaw: moodleQRaw,
                                questionNorm: moodleQNorm,
                                domType: 'shortanswer',
                                submittedAnswer: '',
                                markScored: 0,
                                maxMark: 1,
                                attemptHistory: [],
                                dbCandidate: validCandidates[0] || null
                            });
                        }
                        return;
                    }
                    const bestCand = shortAnsCandidates[0];
                    const bestAnswer = bestCand ? (bestCand.ansRaw || bestCand.answer || '') : '';
                    const studyGuide = isConfirmedCandidate(bestCand)
                        ? null
                        : (getStudyGuideInfo(bestCand) || (bestCand && Boolean(bestCand.source || '').toLowerCase().includes('community') ? { label: 'Community', url: null } : null));
                    const isStudyGuide = Boolean(studyGuide);
                    const courseInfo = detectCourseInfo();
                    const subCode = courseInfo.subjectCode || 'CS6301';
                    const amauoedUrl = getStoredAmauoedUrl(subCode) || 'https://amauoed.com/courses';
                    const sourceColor = isStudyGuide ? '#0284c7' : (bestCand && isConfirmedCandidate(bestCand) ? '#10b981' : '#3b82f6');
                    const sourceBg = isStudyGuide ? 'rgba(2, 132, 199, 0.1)' : (bestCand && isConfirmedCandidate(bestCand) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)');
                    const guideUrl = studyGuide && studyGuide.url ? studyGuide.url : amauoedUrl;
                    const sourceTitle = studyGuide
                        ? `<a href="${guideUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" style="color:${sourceColor}; font-weight:700; text-decoration:underline; cursor:pointer;" title="Unconfirmed study-guide suggestion: ${studyGuide.label}">Suggested (${studyGuide.label}, unconfirmed):</a>`
                        : isConfirmedCandidate(bestCand) ? 'Verified Answer:' : 'Unconfirmed Candidate:';

                    // Parse potential multi-blank answers if multiple inputs exist in the question
                    let candAnswers = [];
                    if (Array.isArray(bestCand.answers) && bestCand.answers.length > 0) {
                        candAnswers = bestCand.answers.map(s => cleanFillBlankAnswer(s)).filter(Boolean);
                    } else if (textInputs.length > 1 && (bestAnswer.includes(',') || bestAnswer.includes('\n') || bestAnswer.includes(';') || bestAnswer.includes('|'))) {
                        candAnswers = bestAnswer.split(/[\n,;|]+/).map(s => cleanFillBlankAnswer(s)).filter(Boolean);
                    } else {
                        candAnswers = [cleanFillBlankAnswer(bestAnswer)].filter(Boolean);
                    }

                    textInputs.forEach((textInput, idx) => {
                        const rawTarget = textInputs.length === 1 ? (candAnswers[0] || bestAnswer || '') : (candAnswers[idx] || '');
                        const targetAns = cleanFillBlankAnswer(rawTarget);
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
                                        display: ${autoQuizMode ? 'none' : 'inline-flex'};
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
                                setInputValueWithEvents(textInput, targetAns);
                                showToast(`Filled: ${targetAns}`);
                                hint.style.background = 'rgba(16, 185, 129, 0.2)';
                                const btn = hint.querySelector('.amaes-fill-btn');
                                if (btn) btn.innerText = 'Filled';
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
                        const canAutoFill = (isManualSelect && isConfirmedCandidate(bestCand)) ||
                            (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode) &&
                                (isConfirmedCandidate(bestCand) ||
                                    (isStudyGuide && autoQuizMode && autoPickStudyGuideFallback)));
                        const currentInputNorm = normalizeChoice(textInput.value || '');
                        const currentInputIsKnownWrong = currentInputNorm && allWrongList.some(w =>
                            normalizeChoice(w.norm || w.text || w) === currentInputNorm
                        );
                        if (canAutoFill && (!textInput.value || currentInputIsKnownWrong)) {
                            setInputValueWithEvents(textInput, targetAns);
                            hint.style.background = 'rgba(16, 185, 129, 0.2)';
                            const btn = hint.querySelector('.amaes-fill-btn');
                            if (btn) btn.innerText = 'Filled';
                        }
                    });

                    foundMatchForQuestion = true;
                }
            }

            // Handle Dropdown / Select elements (matching questions table, cloze / gapselect dropdowns)
            if (!foundMatchForQuestion || que.querySelectorAll('select').length > 0) {
                const selectInputs = que.querySelectorAll('select');
                const matchingRows = Array.from(selectInputs).map(selectInput => {
                    const row = selectInput.closest('tr, .r0, .r1, [class*="r"], .answer > div, li') || selectInput.parentElement;
                    const cells = row ? Array.from(row.querySelectorAll('td, th')).filter(td => !td.querySelector('select')) : [];
                    let textCell = row && row.querySelector('td.text, td:first-child');
                    if (textCell && /^\d+[\s:.)-]*$/.test(textCell.innerText.trim()) && cells.length > 1) {
                        const promptCell = cells.find(c => c.innerText.trim().length > 2 && !/^\d+[\s:.)-]*$/.test(c.innerText.trim()));
                        if (promptCell) textCell = promptCell;
                    }
                    let subQuestion = textCell ? textCell.innerText.trim() : '';
                    if (!subQuestion && row) {
                        const clone = row.cloneNode(true);
                        clone.querySelectorAll('select, button, .amaes-ai-match-row-btn, .amaes-select-hint').forEach(e => e.remove());
                        subQuestion = clone.innerText.trim();
                    }
                    subQuestion = subQuestion.replace(/^(?:(?:\d+|[a-zA-Z])[\s:.)-]+)/, '').trim();
                    return { selectInput, row, subQuestion };
                }).filter(item => item.subQuestion);
                const hasMatchingRows = matchingRows.length > 0;
                if (selectInputs.length > 0 && (validCandidates.length > 0 || hasMatchingRows) && !checkIsReviewPage()) {
                    const bestCand = validCandidates[0] || null;
                    if (!bestCand && !hasMatchingRows) return;
                    const bestAnswer = bestCand ? (bestCand.ansRaw || bestCand.answer || '') : '';
                    const studyGuide = bestCand && !isConfirmedCandidate(bestCand)
                        ? (getStudyGuideInfo(bestCand) || (bestCand && Boolean(bestCand.source || '').toLowerCase().includes('community') ? { label: 'Community', url: null } : null))
                        : null;
                    const isStudyGuide = Boolean(studyGuide);
                    const courseInfo = detectCourseInfo();
                    const subCode = courseInfo.subjectCode || 'CS6301';
                    const amauoedUrl = getStoredAmauoedUrl(subCode) || 'https://amauoed.com/courses';
                    const sourceColor = isStudyGuide ? '#0284c7' : (isConfirmedCandidate(bestCand) ? '#10b981' : '#3b82f6');
                    const sourceBg = isStudyGuide ? 'rgba(2, 132, 199, 0.1)' : (isConfirmedCandidate(bestCand) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)');
                    const guideUrl = studyGuide && studyGuide.url ? studyGuide.url : amauoedUrl;
                    const sourceTitle = studyGuide
                        ? `<a href="${guideUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" style="color:${sourceColor}; font-weight:700; text-decoration:underline; cursor:pointer;" title="Unconfirmed study-guide suggestion: ${studyGuide.label}">Suggested (${studyGuide.label}, unconfirmed):</a>`
                        : bestCand && isConfirmedCandidate(bestCand) ? 'Verified Answer:' : 'Unconfirmed Candidate:';

                    const candAnswers = (bestCand && bestCand.answers && bestCand.answers.length > 0)
                        ? bestCand.answers
                        : (bestAnswer.includes(',') && selectInputs.length > 1 ? bestAnswer.split(',').map(s => s.trim()) : [bestAnswer]);

                    let matchedAnySelect = false;

                    selectInputs.forEach((selectInput, idx) => {
                        // Check if dropdown is inside a matching table row with sub-question text
                        const row = selectInput.closest('tr, .r0, .r1, [class*="r"], .answer > div, li') || selectInput.parentElement;
                        const cells = row ? Array.from(row.querySelectorAll('td, th')).filter(td => !td.querySelector('select')) : [];
                        let rowTextElem = row ? row.querySelector('td.text, td:first-child') : null;
                        if (rowTextElem && /^\d+[\s:.)-]*$/.test(rowTextElem.innerText.trim()) && cells.length > 1) {
                            const promptCell = cells.find(c => c.innerText.trim().length > 2 && !/^\d+[\s:.)-]*$/.test(c.innerText.trim()));
                            if (promptCell) rowTextElem = promptCell;
                        }
                        let subQText = rowTextElem ? rowTextElem.innerText.trim() : '';
                        if (!subQText && row) {
                            const clone = row.cloneNode(true);
                            clone.querySelectorAll('select, button, .amaes-ai-match-row-btn, .amaes-select-hint').forEach(e => e.remove());
                            subQText = clone.innerText.trim();
                        }
                        subQText = subQText.replace(/^(?:(?:\d+|[a-zA-Z])[\s:.)-]+)/, '').trim();
                        const rowEvidence = hasMatchingRows
                            ? getMatchingRowAnswerEvidence(questionsDb, subQText)
                            : { candidates: [], wrongAnswers: [], hasConflict: false };
                        const rowWrongAnswers = rowEvidence.wrongAnswers;
                        const hasRowAnswerConflict = rowEvidence.hasConflict;
                        const rowCandidate = hasMatchingRows && !hasRowAnswerConflict
                            ? (rowEvidence.candidates[0] || null)
                            : null;
                        if (selectInput.dataset) {
                            if (hasMatchingRows) {
                                selectInput.dataset.amaesKnownWrongAnswers = JSON.stringify(rowWrongAnswers);
                            } else {
                                delete selectInput.dataset.amaesKnownWrongAnswers;
                            }
                        }

                        if (hasMatchingRows && !checkIsReviewPage()) {
                            let aiRowBtn = row ? row.querySelector('.amaes-ai-row-btn, .amaes-ai-match-row-btn') : null;
                            if (!aiRowBtn && row) {
                                aiRowBtn = document.createElement('button');
                                aiRowBtn.type = 'button';
                                aiRowBtn.className = 'amaes-ai-row-btn amaes-ai-match-row-btn';
                                aiRowBtn.innerHTML = `${ICONS.gemini} <span>AI</span>`;
                                aiRowBtn.title = 'Ask Gemini AI to solve this specific row';
                                aiRowBtn.style.cssText = 'margin-left: 6px; padding: 2px 7px; font-size: 10px; font-weight: 700; border: 1px solid #c084fc; border-radius: 4px; background: #faf5ff; color: #7e22ce; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; vertical-align: middle;';
                                aiRowBtn.onclick = async (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    aiRowBtn.disabled = true;
                                    aiRowBtn.innerHTML = `<span>AI...</span>`;
                                    try {
                                        if (typeof solveMatchingRowWithAi === 'function') {
                                            const opt = await solveMatchingRowWithAi({
                                                que,
                                                row,
                                                selectInput,
                                                subQText,
                                                autoApply: false
                                            });
                                            if (opt) {
                                                showToast(`AI suggested: "${opt.text.trim()}"`);
                                            } else {
                                                showToast("AI could not determine an answer for this row.");
                                            }
                                        }
                                    } catch (err) {
                                        showToast(`AI error: ${err.message}`);
                                    } finally {
                                        aiRowBtn.disabled = false;
                                        aiRowBtn.innerHTML = `${ICONS.gemini} <span>AI</span>`;
                                    }
                                };
                                selectInput.insertAdjacentElement('afterend', aiRowBtn);
                            }

                            const sessionCacheKey = `amaes_ai_match_${normalizeText(subQText)}`;
                            const cachedMatchAns = sessionStorage.getItem(sessionCacheKey);
                            if (cachedMatchAns && !row.querySelector('.amaes-ai-matching-suggestion')) {
                                const matchOpt = Array.from(selectInput.options).find(o => normalizeChoice(o.text) === normalizeChoice(cachedMatchAns));
                                if (matchOpt && typeof applyMatchingRowAiSuggestion === 'function') {
                                    applyMatchingRowAiSuggestion(row, selectInput, matchOpt, false);
                                }
                            }
                        }
                        const effectiveCandidate = hasMatchingRows ? rowCandidate : bestCand;
                        if (hasRowAnswerConflict) {
                            const note = document.createElement('div');
                            note.className = 'amaes-matching-row-conflict-note';
                            note.setAttribute('role', 'status');
                            note.textContent = 'Study guides disagree on this matching item. Auto-Pick is paused; check the source answers before selecting.';
                            note.style.cssText = 'margin-top: 5px; padding: 5px 8px; border-left: 3px solid #f59e0b; background: rgba(245,158,11,.1); color: #92400e; font-size: 11px;';
                            selectInput.insertAdjacentElement('afterend', note);
                            updateKnownWrongAnswerWarning(que);
                            return;
                        }
                        if (hasMatchingRows && !effectiveCandidate) {
                            updateKnownWrongAnswerWarning(que);
                            return;
                        }
                        const effectiveStudyGuide = effectiveCandidate && !isConfirmedCandidate(effectiveCandidate)
                            ? (getStudyGuideInfo(effectiveCandidate) || (Boolean(effectiveCandidate.source || '').toLowerCase().includes('community') ? { label: 'Community', url: null } : null))
                            : null;
                        const effectiveIsStudyGuide = Boolean(effectiveStudyGuide);
                        const effectiveSourceColor = effectiveIsStudyGuide ? '#0284c7' :
                            (effectiveCandidate && isConfirmedCandidate(effectiveCandidate) ? '#10b981' : '#3b82f6');
                        const effectiveSourceBg = effectiveIsStudyGuide ? 'rgba(2, 132, 199, 0.1)' :
                            (effectiveCandidate && isConfirmedCandidate(effectiveCandidate) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)');
                        const effectiveSourceTitle = effectiveStudyGuide
                            ? `<a href="${effectiveStudyGuide.url || amauoedUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" style="color:${effectiveSourceColor}; font-weight:700; text-decoration:underline; cursor:pointer;" title="Unconfirmed study-guide suggestion: ${effectiveStudyGuide.label}">Suggested (${effectiveStudyGuide.label}, unconfirmed):</a>`
                            : effectiveCandidate && isConfirmedCandidate(effectiveCandidate) ? 'Verified Answer:' : 'Unconfirmed Candidate:';

                        // Determine target answer for this dropdown:
                        // 1. Try matching sub-question text in bestAnswer (e.g. "Term: Definition" or "Term -> Definition")
                        let targetAns = '';
                        if (rowCandidate) {
                            targetAns = rowCandidate.ansRaw || rowCandidate.answer || '';
                        }
                        if (!targetAns && subQText && (bestAnswer.includes('→') || bestAnswer.includes('->'))) {
                            const lines = bestAnswer.split(/[\n,;]+/).map(l => l.trim());
                            for (const line of lines) {
                                const arrowIndex = Math.max(line.indexOf('→'), line.indexOf('->'));
                                if (arrowIndex < 0) continue;
                                const prompt = line.slice(0, arrowIndex).trim();
                                if (!questionTextMatches(prompt, subQText)) continue;
                                targetAns = line.slice(arrowIndex + (line[arrowIndex] === '→' ? 1 : 2)).trim();
                                break;
                            }
                        }

                        // Positional answer lists are unsafe when Moodle shuffles matching rows.
                        if (!targetAns && !hasMatchingRows) {
                            targetAns = selectInputs.length === 1 ? (candAnswers[0] || bestAnswer || '') : (candAnswers[idx] || '');
                        }
                        if (!targetAns) return;

                        // Look for a matching option in the select
                        const options = Array.from(selectInput.options);
                        const normTarget = normalizeChoice(targetAns);
                        const applicableWrongAnswers = hasMatchingRows ? rowWrongAnswers : allWrongList;

                        // 1. Mark eliminated options in dropdown
                        const eliminatedOptions = [];
                        options.forEach(opt => {
                            if (!opt.value || opt.value === '0' || opt.text.toLowerCase().includes('choose')) return;
                            const optClean = opt.text.replace(/\s*\(Eliminated\)/g, '').trim();
                            const optNorm = normalizeChoice(optClean);
                            const isWrong = applicableWrongAnswers.some(w => w.norm === optNorm || unscriptDigits(w.norm) === unscriptDigits(optNorm));
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
                            if (applicableWrongAnswers.some(w => w.norm === normOpt || unscriptDigits(w.norm) === unscriptDigits(normOpt))) return false;
                            return normOpt === normTarget || (normTarget.length > 2 && normOpt.includes(normTarget)) || (normOpt.length > 2 && targetAns.length > 2 && normTarget.includes(normOpt));
                        });

                        // Fallback: if no direct match, try matching any candidate answer (excluding eliminated)
                        if (!matchedOption && !hasMatchingRows && candAnswers.length > 0) {
                            matchedOption = options.find(opt => {
                                if (!opt.value || opt.value === '0' || opt.text.toLowerCase().includes('choose')) return false;
                                const optClean = opt.text.replace(/\s*\(Eliminated\)/g, '').trim();
                                const normOpt = normalizeChoice(optClean);
                                if (applicableWrongAnswers.some(w => w.norm === normOpt || unscriptDigits(w.norm) === unscriptDigits(normOpt))) return false;
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
                            return !applicableWrongAnswers.some(w => w.norm === optNorm || unscriptDigits(w.norm) === unscriptDigits(optNorm));
                        });

                        let isDeducedSelect = false;
                        if (!matchedOption && validOptions.length === 1) {
                            matchedOption = validOptions[0];
                            isDeducedSelect = true;
                        }

                        if (matchedOption) {
                            matchedAnySelect = true;
                            selectInput.style.outline = `2px solid ${hasMatchingRows ? effectiveSourceColor : sourceColor}`;
                            selectInput.style.backgroundColor = hasMatchingRows ? effectiveSourceBg : sourceBg;
                            selectInput.style.borderRadius = '4px';

                            let hint = que.querySelector(`.amaes-select-hint[data-select-idx="${idx}"]`);
                            if (!hint) {
                                hint = document.createElement('div');
                                hint.className = 'amaes-select-hint';
                                hint.setAttribute('data-select-idx', String(idx));
                                const displayTitle = isDeducedSelect ? 'Deduced Answer:' : (hasMatchingRows ? effectiveSourceTitle : sourceTitle);
                                const cleanText = matchedOption.text.replace(/\s*\(Eliminated\)/g, '').trim();
                                const activeColor = isDeducedSelect ? '#f59e0b' : (hasMatchingRows ? effectiveSourceColor : sourceColor);
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
                                const hintSourceBg = hasMatchingRows ? effectiveSourceBg : sourceBg;
                                const hintSourceColor = hasMatchingRows ? effectiveSourceColor : sourceColor;
                                hint.style.cssText = `font-size: 11px; margin-top: 5px; margin-bottom: 3px; padding: 5px 9px; background: ${hintSourceBg}; border-left: 3px solid ${hintSourceColor}; border-radius: 4px; cursor: pointer; transition: background 0.15s;`;
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
                                    if (btn) btn.innerText = 'Picked';
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
                            const canAutoPick = (isManualSelect && ((effectiveCandidate && isConfirmedCandidate(effectiveCandidate)) || isDeducedSelect)) ||
                                (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode) &&
                                ((effectiveCandidate && isConfirmedCandidate(effectiveCandidate)) ||
                                    ((hasMatchingRows ? effectiveIsStudyGuide : isStudyGuide) && autoQuizMode && autoPickStudyGuideFallback)) && !isDeducedSelect);
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
                    const studyGuide = isConfirmedCandidate(bestCand) ? null : getStudyGuideInfo(bestCand);
                    const isStudyGuide = Boolean(studyGuide);
                    const courseInfo = detectCourseInfo();
                    const subCode = courseInfo.subjectCode || 'CS6301';
                    const amauoedUrl = getStoredAmauoedUrl(subCode) || 'https://amauoed.com/courses';
                    const sourceColor = isStudyGuide ? '#0284c7' : (isConfirmedCandidate(bestCand) ? '#10b981' : '#3b82f6');
                    const sourceBg = isStudyGuide ? 'rgba(2, 132, 199, 0.1)' : (isConfirmedCandidate(bestCand) ? 'rgba(16, 185, 129, 0.1)' : 'rgba(59, 130, 246, 0.1)');
                    const guideUrl = studyGuide && studyGuide.url ? studyGuide.url : amauoedUrl;
                    const sourceTitle = studyGuide
                        ? `<a href="${guideUrl}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation();" style="color:${sourceColor}; font-weight:700; text-decoration:underline; cursor:pointer;" title="Unconfirmed study-guide suggestion: ${studyGuide.label}">Suggested (${studyGuide.label}, unconfirmed):</a>`
                        : isConfirmedCandidate(bestCand) ? 'Verified Answer:' : 'Unconfirmed Candidate:';

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
                                    if (isConfirmedCandidate(bestCand)) {
                                        dropZone.innerText = targetAns;
                                    }
                                    dropZone.style.outline = `2px solid ${sourceColor}`;
                                    dropZone.style.fontWeight = '700';

                                    showToast(`Placed: ${targetAns}`);
                                    hint.style.background = 'rgba(16, 185, 129, 0.2)';
                                    const btn = hint.querySelector('.amaes-drag-btn');
                                    if (btn) btn.innerText = 'Placed';
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
                                const canAutoPick = (isManualSelect && isConfirmedCandidate(bestCand)) ||
                                    (Boolean(autoSelect) && (autoPickQuiz || autoQuizMode) &&
                                        isConfirmedCandidate(bestCand));
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
                if (checkIsQuizAttemptPage() && !que.querySelector('.amaes-new-question-focus-banner') && !que.querySelector('.amaes-blockage-hud')) {
                    que.classList.add('amaes-no-answer-que');
                    const numElem = que.querySelector('.info .no, .qno');
                    const qNum = numElem ? numElem.innerText.replace(/[^0-9]/g, '') : '';
                    renderNewQuestionFocusBanner(que, qNum);
                    updateNextButtonIndicator();
                } else if (checkIsQuizAttemptPage()) {
                    que.classList.add('amaes-no-answer-que');
                }
            } else {
                que.classList.remove('amaes-no-answer-que');
                matchedCount++;
            }

            if (typeof updateQuestionAiDrawerState === 'function') {
                updateQuestionAiDrawerState(que);
            }
        });

        return { matched: matchedCount, total: queContainers.length };
    }
