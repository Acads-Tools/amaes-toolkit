    // ==========================================
    // AI Context Prompt Injection (1st Question)
    // ==========================================

    function getQuizSessionKey() {
        const urlParams = new URLSearchParams(window.location.search);
        const attempt = urlParams.get('attempt');
        if (attempt) return `attempt_${attempt}`;
        const cmid = urlParams.get('cmid');
        if (cmid) return `cmid_${cmid}`;
        const courseInfo = detectCourseInfo();
        if (courseInfo.subjectCode || courseInfo.currentActivityTitle) {
            return `quiz_${courseInfo.subjectCode}_${courseInfo.currentActivityTitle}`.replace(/[^a-zA-Z0-9_]/g, '_');
        }
        return 'quiz_active_session';
    }

    function hasAiContextBeenSent() {
        return sessionStorage.getItem(`amaes_ai_context_sent_${getQuizSessionKey()}`) === 'true';
    }

    function markAiContextSent() {
        sessionStorage.setItem(`amaes_ai_context_sent_${getQuizSessionKey()}`, 'true');
    }

    function shouldInjectAiContext(qNum = null) {
        if (!checkIsQuizPage()) return false;
        if (!hasAiContextBeenSent()) return true;
        if (qNum === 1 || qNum === '1') return true;
        return false;
    }

    function buildAiContextIntro() {
        const courseInfo = detectCourseInfo();
        const details = [];
        if (courseInfo.subjectCode) details.push(`Course Code: ${courseInfo.subjectCode}`);
        if (courseInfo.subjectName) details.push(`Subject: ${courseInfo.subjectName}`);
        if (courseInfo.currentActivityTitle) details.push(`Activity: ${courseInfo.currentActivityTitle}`);

        const header = details.length > 0 ? details.join(' | ') : 'AMAES Online Course Quiz';

        return `[Context: ${header}]\n` +
               `Act as an expert academic assistant for this course. For each quiz question I provide, analyze carefully and reply ONLY with the correct option letter (a, b, c, or d) and the exact choice text. Keep it direct with no explanations.\n\n---\n\n`;
    }

    // Format a single question and choices cleanly for AI with strict A/B/C/D direct response directive
    // Injects rich course context on the first question of a quiz session
    function formatQuestionForAI(que, withHint = true, forceContext = null) {
        const data = extractQuestionData(que);
        if (!data || !data.qText) return '';

        let output = '';
        if (data.isDragDrop) {
            output += `[DRAG AND DROP QUESTION - MATCH CHOICES TO BLANKS]\n`;
            if (data.dropZonesCount > 1) {
                output += `Total Blanks: ${data.dropZonesCount}\n`;
            }
        } else if (data.isMultiChoice) {
            output += `[NOTE: MULTIPLE ANSWERS ALLOWED - SELECT ONE OR MORE CHOICES]\n`;
        }
        output += `${data.qText}\n\n`;

        // Check if database or live DOM has confirmed wrong choices for this question
        const courseInfo = detectCourseInfo();
        const subCode = courseInfo.subjectCode || 'GENERAL';
        const cached = getCachedAnswers(subCode);
        const eliminatedWrong = [];
        let detectedAnswer = null;

        // 1. Inspect live DOM: grab any choices already marked as eliminated on the page
        // (Guard: NEVER treat a checkmarked correct choice as eliminated!)
        que.querySelectorAll('.amaes-eliminated-choice, .amaes-eliminated-badge').forEach(el => {
            const row = el.closest('div.r0, div.r1, tr, li') || el;
            if (row.querySelector('.fa-check, .feedbackimage[alt="Correct"], img[src*="tick"], img[src*="correct"]') || row.classList.contains('correct')) {
                return;
            }
            const label = row.querySelector('label') || row;
            let text = cleanDOMToAI(label).replace(/^[a-zA-Z0-9][.)]\s*/, '').replace(/(?:Wrong|Incorrect Choice)\s*\(?\d*x?\)?\s*(?:•?\s*0%\s*Prob)?/i, '').trim();
            if (text && !eliminatedWrong.some(w => normalizeChoice(w) === normalizeChoice(text))) {
                eliminatedWrong.push(text);
            }
        });

        // 2. Cross-reference with subject database across ALL matching candidate entries
        if (cached && cached.length > 0) {
            const moodleQNorm = normalizeText(data.qText);
            const cands = cached.filter(c => questionTextMatches(c.qNorm || c.qRaw || c.question, moodleQNorm));
            const verifiedNorms = new Set();
            cands.forEach(c => {
                if (c.verified) {
                    if (c.ansNorm) verifiedNorms.add(c.ansNorm);
                    if (c.ansRaw) verifiedNorms.add(normalizeChoice(c.ansRaw));
                    if (Array.isArray(c.answers)) {
                        c.answers.forEach(a => verifiedNorms.add(normalizeChoice(a)));
                    }
                }
            });

            cands.forEach(cand => {
                if (Array.isArray(cand.wrongAnswers)) {
                    cand.wrongAnswers.forEach(w => {
                        const wText = typeof w === 'string' ? w : (w.text || w.norm);
                        const wNorm = normalizeChoice(wText);
                        // Ground-truth guard: NEVER eliminate any answer that is verified!
                        if (wText && !verifiedNorms.has(wNorm) && !verifiedNorms.has(unscriptDigits(wNorm)) && !eliminatedWrong.some(e => normalizeChoice(e) === wNorm)) {
                            eliminatedWrong.push(wText);
                        }
                    });
                }
            });

            // 3. Find verified/consensus answer ONLY among candidates whose answer is NOT eliminated!
            const validCandidates = cands.filter(cand => {
                const ansText = cand.ansRaw || cand.answer || '';
                const ansNorm = cand.ansNorm || normalizeChoice(ansText);
                if (!ansNorm) return false;
                const isConfirmedWrong = eliminatedWrong.some(w => {
                    const wNorm = normalizeChoice(w);
                    return wNorm === ansNorm || unscriptDigits(wNorm) === unscriptDigits(ansNorm);
                });
                return !isConfirmedWrong;
            });

            // When copying question for AI, NEVER include unverified AI suggestions as detected answers!
            // Only verified teacher keys, deduced answers, or human study guides (AMAUOED) can be suggested.
            const verifiedNonAiCandidates = validCandidates.filter(c => {
                if (c.isAiSuggestion) return false;
                const srcLower = (c.source || '').toLowerCase();
                if (srcLower.includes('gemini') || srcLower.includes('ai assistant') || srcLower === 'ai') return false;
                if (Array.isArray(c.sources) && c.sources.some(s => String(s).toLowerCase().includes('gemini') || String(s).toLowerCase().includes('ai assistant'))) return false;
                return true;
            });

            if (verifiedNonAiCandidates.length > 0) {
                // Sort by verification & consensus
                verifiedNonAiCandidates.sort((a, b) => ((b.verified ? 10 : 0) + (b.confirmations || 1)) - ((a.verified ? 10 : 0) + (a.confirmations || 1)));
                const bestCand = verifiedNonAiCandidates[0];
                const isDeduced = Boolean(bestCand.deduced);
                const isVerified = Boolean(bestCand.verified);
                const isAmauoed = Boolean((bestCand.source || '').toLowerCase().includes('amauoed') || (Array.isArray(bestCand.sources) && bestCand.sources.some(s => s.toLowerCase().includes('amauoed'))));
                const prob = isVerified ? 100 : (isAmauoed ? 95 : 90);
                const label = isDeduced ? 'Deduced • 100% Probability' : (isVerified ? 'Verified • 100% Probability' : (isAmauoed ? 'AMAUOED • 95% Probability' : `${prob}% Probability`));
                detectedAnswer = {
                    text: bestCand.ansRaw || bestCand.answer,
                    label: label,
                    source: bestCand.source || 'Verified Database'
                };
            }
        }

        if (data.isDragDrop) {
            if (data.choices && data.choices.length > 0) {
                output += `Available Draggable Choices:\n` + data.choices.join('\n');
            }
            if (detectedAnswer && copyIncludeConfidence) {
                output += `\n\n[DETECTED ANSWER IN DATABASE]:\n- Suggested: ${detectedAnswer.text} (${detectedAnswer.label} • ${detectedAnswer.source})`;
            }
            if (withHint) {
                if (data.dropZonesCount > 1) {
                    output += `\n\nInstructions: This is a Drag and Drop question with ${data.dropZonesCount} blanks. Match each blank to the correct draggable choice. Format your answer as: Blank 1: [choice text], Blank 2: [choice text], etc. No explanation.`;
                } else {
                    output += `\n\nInstructions: This is a Drag and Drop question. Answer ONLY with the correct draggable choice text. No explanation.`;
                }
            }
        } else if (data.choices && data.choices.length > 0) {
            // Annotate confirmed wrong choices directly in the choices list so AI sees it immediately!
            const annotatedChoices = data.choices.map(choice => {
                const cleanChoiceText = choice.replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                const normC = normalizeChoice(cleanChoiceText);
                const isWrong = eliminatedWrong.some(w => {
                    const wNorm = normalizeChoice(w);
                    return wNorm === normC || unscriptDigits(wNorm) === unscriptDigits(normC);
                });
                if (isWrong) {
                    return `${choice} [CONFIRMED WRONG - DO NOT SELECT]`;
                }
                return choice;
            });
            output += annotatedChoices.join('\n');

            if (detectedAnswer && copyIncludeConfidence) {
                output += `\n\n[DETECTED ANSWER IN DATABASE]:\n- Suggested: ${detectedAnswer.text} (${detectedAnswer.label} • ${detectedAnswer.source})`;
            }

            // Contradiction guard: never eliminate all choices in AI instructions
            if (eliminatedWrong.length > 0 && eliminatedWrong.length < data.choices.length) {
                output += `\n\n[CONFIRMED WRONG CHOICES - DO NOT SELECT]:\n` + eliminatedWrong.map(w => `- "${w}" (Tested and confirmed 100% INCORRECT in prior attempt)`).join('\n');
                output += `\nCRITICAL: Do NOT choose any option marked as confirmed wrong above. Pick strictly from the remaining candidate choices.`;
            }

            if (withHint) {
                if (data.isMultiChoice) {
                    output += `\n\nInstructions: This question allows MULTIPLE answers ("Select one or more"). Answer ONLY with ALL applicable option letters (e.g. "a, c" or "b, d") and their exact choice texts. Do NOT pick any confirmed wrong choices. Do NOT give explanations.`;
                } else {
                    output += `\n\nInstructions: Answer ONLY with the correct option letter (a, b, c, or d) and the exact choice text. Do NOT pick any confirmed wrong choices. Do NOT give explanations.`;
                }
            }
        } else if (data.isGapSelect) {
            output += `[Dropdown Selection / Cloze Question]\n`;
            if (data.gapSelectOptions && data.gapSelectOptions.length > 0) {
                data.gapSelectOptions.forEach(g => {
                    output += `Dropdown ${g.index} Options: ${g.options.join(' | ')}\n`;
                });
            }
            if (detectedAnswer && copyIncludeConfidence) {
                output += `\n[DETECTED ANSWER IN DATABASE]:\n- Suggested: ${detectedAnswer.text} (${detectedAnswer.label} • ${detectedAnswer.source})\n`;
            }
            if (withHint) {
                output += `\nInstructions: Select the exact matching dropdown option for the blank(s). Reply ONLY with the option text. No explanation.`;
            }
        } else if (data.matchPairs && data.matchPairs.length > 0) {
            output += `Matching items:\n`;
            data.matchPairs.forEach(p => {
                output += `- ${p.subQ}: [${p.options.join(', ')}]\n`;
            });
            if (withHint) {
                output += `\n\nInstructions: Answer ONLY with the matched pairs. No explanation.`;
            }
        } else if (data.isEssay) {
            output += `[Essay / Long Answer Question]`;
            if (withHint) {
                output += `\n\nInstructions: Provide a detailed, accurate, and well-structured response to this question prompt.`;
            }
        } else if (data.isShortAnswer) {
            output += `[Fill-in-the-Blank / Short Answer Question]\n[The blank is marked as [____] in the question text above.]`;
            if (detectedAnswer && copyIncludeConfidence) {
                output += `\n\n[DETECTED ANSWER IN DATABASE]:\n- Suggested: ${detectedAnswer.text} (${detectedAnswer.label} • ${detectedAnswer.source})`;
            }
            if (withHint) {
                output += `\n\nInstructions: Answer ONLY with the exact word or phrase that fills the blank [____]. No explanation.`;
            }
        } else if (data.choices.length === 0 && !data.isDragDrop && (!data.matchPairs || data.matchPairs.length === 0)) {
            // General open-ended or unexpected question fallback
            if (withHint) {
                output += `\nInstructions: Provide the most accurate and direct answer to the question prompt above.`;
            }
        }

        const includeContext = forceContext !== null ? forceContext : shouldInjectAiContext(data.qNum);
        if (includeContext) {
            const intro = buildAiContextIntro();
            output = `${intro}${output}`;
            markAiContextSent();
        }

        return output.trim();
    }

    // Format all questions on current quiz page for AI
    function formatAllQuestionsForAI(withHint = true) {
        const queList = document.querySelectorAll('.que');
        if (queList.length === 0) return '';
        if (queList.length === 1) {
            return formatQuestionForAI(queList[0], withHint);
        }

        const formatted = [];
        queList.forEach((que, idx) => {
            const itemText = formatQuestionForAI(que, false, false);
            if (itemText) {
                formatted.push(`Question ${idx + 1}:\n${itemText}`);
            }
        });

        let res = formatted.join('\n\n---\n\n');
        if (withHint && res) {
            res += `\n\nInstructions for all questions above:\n` +
                   `- For multiple choice questions: Answer with question number, option letter (e.g. 1. a), and choice text.\n` +
                   `- For multi-answer ("Select one or more"): Provide all applicable option letters.\n` +
                   `- For short answer, blanks, matching, or essays: Provide the exact direct answer or concise response for each.\n` +
                   `- Format answers in numerical order with zero extraneous conversational filler.`;
        }

        const intro = buildAiContextIntro();
        markAiContextSent();
        return `${intro}${res}`.trim();
    }

    // --------------------------------------------------
    // Multi-Web AI Launchers (ChatGPT, Perplexity, Gemini)
    // --------------------------------------------------
    const WEB_AI_PROVIDERS = {
        chatgpt: { id: 'chatgpt', name: 'ChatGPT', icon: '💬', badge: '(Auto-fill)' },
        perplexity: { id: 'perplexity', name: 'Perplexity', icon: '⚡', badge: '(Auto-search)' },
        gemini: { id: 'gemini', name: 'Gemini', icon: '✦', badge: '(Copy & Go)' }
    };

    function getPreferredWebAi() {
        const saved = localStorage.getItem('amaes_preferred_web_ai');
        return (saved && WEB_AI_PROVIDERS[saved]) ? saved : 'chatgpt';
    }

    function setPreferredWebAi(providerId) {
        if (WEB_AI_PROVIDERS[providerId]) {
            localStorage.setItem('amaes_preferred_web_ai', providerId);
            const info = WEB_AI_PROVIDERS[providerId];
            document.querySelectorAll('.amaes-web-ai-main-action').forEach(btn => {
                btn.innerHTML = `<span class="amaes-web-ai-icon">${info.icon}</span> <span>${info.name}</span>`;
                btn.title = `Ask ${info.name}: Click to solve question in ${info.name}`;
            });
        }
    }

    function openExternalAi(provider, que) {
        if (!que) que = getActiveQuestion() || document.querySelector('.que');
        if (!que) {
            showToast('Please click a question first to select it.');
            return;
        }
        setActiveQuestion(que, true);
        const qData = extractQuestionData(que);
        const willIncludeContext = shouldInjectAiContext(qData ? qData.qNum : null);
        const text = formatQuestionForAI(que, aiPromptHint);
        if (!text) {
            showToast('Could not format question text.');
            return;
        }

        if (provider === 'chatgpt') {
            const url = `https://chatgpt.com/?q=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
            showToast('Opening ChatGPT with question pre-filled...');
        } else if (provider === 'perplexity') {
            const url = `https://www.perplexity.ai/search?q=${encodeURIComponent(text)}`;
            window.open(url, '_blank');
            showToast('Opening Perplexity with question pre-filled...');
        } else if (provider === 'gemini') {
            copyQuestionWithOptionalImage(que, text).then((res) => {
                window.open('https://gemini.google.com/app', '_blank');
                showToast(res && res.withImage ? 'Visual snippet & text copied! Press Ctrl+V in Google Gemini.' : 'Question copied! Press Ctrl+V in Google Gemini.', 3500);
            }).catch(() => {
                window.open('https://gemini.google.com/app', '_blank');
                showToast('Opening Google Gemini...', 2500);
            });
        }
    }

    // Helper to control in-question AI tools state & retry styling
    function updateQuestionAiDrawerState(que, forceUnminimize = false) {
        if (!que) return;
        const drawer = que.querySelector('.amaes-card-ai-drawer');
        if (drawer) {
            const hint = drawer.querySelector('.amaes-card-ai-drawer-hint');
            if (forceUnminimize) {
                drawer.open = true;
                if (hint) hint.textContent = '▴';
            } else {
                const hasVerified = Boolean(que.querySelector('.amaes-verified-badge'));
                const existingAiChoice = que.querySelector('.amaes-ai-suggested-choice');
                const hasAiChoice = Boolean(existingAiChoice && !isChoiceRowEliminated(existingAiChoice));
                if (hasVerified || hasAiChoice) {
                    drawer.open = false;
                    if (hint) hint.textContent = '▾';
                } else {
                    drawer.open = true;
                    if (hint) hint.textContent = '▴';
                }
            }
        }

        // Update Built-in AI retry button text & styling if attempted or failed
        const askAiBtn = que.querySelector('.amaes-ask-ai-card-btn');
        if (askAiBtn) {
            if (que.dataset.amaesAiFailed === 'true' || que.querySelector('.amaes-ai-fallback-bar')) {
                askAiBtn.innerHTML = `${ICONS.sparkles} <span>Retry AI</span>`;
                askAiBtn.style.borderColor = 'rgba(239, 68, 68, 0.4)';
            } else if (que.dataset.amaesAiAttempted === 'true') {
                askAiBtn.innerHTML = `${ICONS.sparkles} <span>Retry AI</span>`;
            }
        }
    }

    // Inject sleek in-question AI tools: Left sidebar (.info below Flag question) for core tools & Built-in AI; Right side (.formulation) for Web AI launchers
    function injectQuestionCopyButtons() {
        if (!checkIsQuizPage()) return;
        const queElements = document.querySelectorAll('.que');

        // Never show Copy AI / Target Question buttons on review screens (where quiz is finished) or if user disabled them
        if (checkIsReviewPage() || !showInQuestionAiBtns) {
            document.querySelectorAll('.amaes-card-btn-container').forEach(el => el.remove());
            document.querySelectorAll('.amaes-web-ai-row').forEach(el => el.remove());
            return;
        }

        queElements.forEach(que => {
            // Bind click event on question card to explicitly select/target it
            if (!que.dataset.amaesFocusBound) {
                que.dataset.amaesFocusBound = 'true';
                que.addEventListener('click', () => {
                    setActiveQuestion(que, true);
                });
            }

            // ==============================================================
            // 1. LEFT SIDE: Core Toolkit & Built-in AI (.info below Flag)
            // ==============================================================
            if (!que.querySelector('.amaes-card-btn-container')) {
                const btnContainer = document.createElement('div');
                btnContainer.className = 'amaes-card-btn-container';
                btnContainer.style.cssText = 'display: flex; flex-direction: column; gap: 4px; margin-top: 6px; width: 100%; box-sizing: border-box;';

                // Active / Target Question Indicator Badge
                const activeBadge = document.createElement('div');
                activeBadge.className = 'amaes-active-focus-badge';
                activeBadge.innerHTML = `${ICONS.check} <span>Target Question</span>`;
                btnContainer.appendChild(activeBadge);

                // Direct action buttons container
                const aiActions = document.createElement('div');
                aiActions.className = 'amaes-card-ai-actions';
                aiActions.style.cssText = 'display: flex; flex-direction: column; gap: 4px; width: 100%; box-sizing: border-box;';

                // 1a. Copy Question Text / Visual Snippet Button
                const btnText = document.createElement('button');
                btnText.type = 'button';
                btnText.className = 'amaes-copy-ai-card-btn';
                btnText.title = 'Copy question and choices (copies visual snippet + text for images and drag & drop)';
                btnText.innerHTML = `${ICONS.copy || ICONS.sparkles} <span>Copy AI</span>`;

                btnText.onclick = async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setActiveQuestion(que, true);
                    const qData = extractQuestionData(que);
                    const willIncludeContext = shouldInjectAiContext(qData ? qData.qNum : null);
                    const text = formatQuestionForAI(que, aiPromptHint);
                    if (!text) return;
                    try {
                        const copyRes = await copyQuestionWithOptionalImage(que, text);
                        btnText.innerHTML = `${ICONS.check} <span>${copyRes && copyRes.withImage ? 'Copied Snippet!' : 'Copied!'}</span>`;
                        btnText.style.borderColor = 'var(--accent-green, #10b981)';
                        btnText.style.color = 'var(--accent-green, #10b981)';
                        showToast(copyRes && copyRes.withImage ? 'Visual snippet & text copied for AI!' : (willIncludeContext ? 'Question copied with Course AI Context!' : 'Question & choices copied for AI!'));
                        if (willIncludeContext) {
                            setLog("Copied question with Course Context for AI.", "var(--accent-green)");
                        }
                        setTimeout(() => {
                            btnText.innerHTML = `${ICONS.copy || ICONS.sparkles} <span>Copy AI</span>`;
                            btnText.style.borderColor = '';
                            btnText.style.color = '';
                        }, 1800);
                    } catch (err) {
                        console.error('Copy failed:', err);
                    }
                };
                aiActions.appendChild(btnText);

                // 1b. Paste AI Button on Question Card
                if (checkIsQuizAttemptPage()) {
                    const btnPaste = document.createElement('button');
                    btnPaste.type = 'button';
                    btnPaste.className = 'amaes-copy-ai-card-btn amaes-paste-ai-card-btn';
                    btnPaste.title = 'Paste AI response from clipboard to select this choice (V)';
                    btnPaste.innerHTML = `${ICONS.clipboard} <span>Paste AI</span>`;
                    btnPaste.onclick = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveQuestion(que, true);
                        await autoSelectFromAiClipboard(que);
                    };
                    aiActions.appendChild(btnPaste);
                }

                // 1d. Built-in AI Solver Section (Differentiated with clear header & button)
                if (checkIsQuizAttemptPage()) {
                    const builtinAiSection = document.createElement('div');
                    builtinAiSection.className = 'amaes-builtin-ai-section';
                    builtinAiSection.style.cssText = 'display: flex; flex-direction: column; gap: 3px; margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(168, 85, 247, 0.35); width: 100%; box-sizing: border-box;';

                    const builtinHeader = document.createElement('div');
                    builtinHeader.className = 'amaes-builtin-ai-header';
                    builtinHeader.style.cssText = 'font-size: 9px; font-weight: 700; color: #a855f7; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: center; gap: 4px; user-select: none;';
                    builtinHeader.innerHTML = `${ICONS.gemini} <span>Built-in AI</span>`;
                    builtinAiSection.appendChild(builtinHeader);

                    const btnAskAi = document.createElement('button');
                    btnAskAi.type = 'button';
                    btnAskAi.className = 'amaes-copy-ai-card-btn amaes-ask-ai-card-btn';
                    btnAskAi.title = 'Ask Google Gemini AI to analyze and solve this question directly';
                    btnAskAi.innerHTML = `${ICONS.gemini} <span>${que.dataset.amaesAiAttempted ? 'Retry AI' : 'Solve with AI'}</span>`;
                    btnAskAi.onclick = async (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setActiveQuestion(que, true);
                        await manualSolveWithAi(que, btnAskAi);
                    };
                    builtinAiSection.appendChild(btnAskAi);
                    aiActions.appendChild(builtinAiSection);
                }

                btnContainer.appendChild(aiActions);

                // Mount into .info (space below Flag question) or fallback to content
                const infoCol = que.querySelector('.info');
                const contentCol = que.querySelector('.content');

                if (infoCol) {
                    infoCol.appendChild(btnContainer);
                } else if (contentCol) {
                    contentCol.insertBefore(btnContainer, contentCol.firstChild);
                } else {
                    que.insertBefore(btnContainer, que.firstChild);
                }
            }

            // ==============================================================
            // 2. RIGHT SIDE: Web AI Launchers (.formulation / question header)
            // ==============================================================
            const formulation = que.querySelector('.formulation') || que.querySelector('.content') || que;
            if (formulation && !que.querySelector('.amaes-web-ai-row')) {
                const webAiRow = document.createElement('div');
                webAiRow.className = 'amaes-web-ai-row';

                const webAiLabel = document.createElement('span');
                webAiLabel.className = 'amaes-web-ai-label';
                webAiLabel.innerHTML = `${ICONS.globe || ICONS.external} <span>Web AI:</span>`;
                webAiRow.appendChild(webAiLabel);

                // 2a. Ask ChatGPT (Official SVG logo)
                const btnChatGpt = document.createElement('button');
                btnChatGpt.type = 'button';
                btnChatGpt.className = 'amaes-web-ai-item amaes-pill-chatgpt';
                btnChatGpt.dataset.provider = 'chatgpt';
                btnChatGpt.title = 'Open question directly in ChatGPT with answer prompt pre-filled';
                btnChatGpt.innerHTML = `${ICONS.chatgpt} <span>ChatGPT</span>`;
                btnChatGpt.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openExternalAi('chatgpt', que);
                };
                webAiRow.appendChild(btnChatGpt);

                // 2b. Google Gemini Web (Official Sparkle SVG logo)
                const btnGemini = document.createElement('button');
                btnGemini.type = 'button';
                btnGemini.className = 'amaes-web-ai-item amaes-pill-gemini';
                btnGemini.dataset.provider = 'gemini';
                btnGemini.title = 'Open question in Google Gemini';
                btnGemini.innerHTML = `${ICONS.gemini} <span>Gemini Web</span>`;
                btnGemini.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openExternalAi('gemini', que);
                };
                webAiRow.appendChild(btnGemini);

                // 2c. Perplexity AI (Official Geometric SVG logo)
                const btnPerplexity = document.createElement('button');
                btnPerplexity.type = 'button';
                btnPerplexity.className = 'amaes-web-ai-item amaes-pill-perplexity';
                btnPerplexity.dataset.provider = 'perplexity';
                btnPerplexity.title = 'Search question in Perplexity AI';
                btnPerplexity.innerHTML = `${ICONS.perplexity} <span>Perplexity</span>`;
                btnPerplexity.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openExternalAi('perplexity', que);
                };
                webAiRow.appendChild(btnPerplexity);

                const topToolbar = formulation.querySelector('.amaes-que-top-toolbar');
                if (topToolbar && topToolbar.nextSibling) {
                    formulation.insertBefore(webAiRow, topToolbar.nextSibling);
                } else if (topToolbar) {
                    formulation.appendChild(webAiRow);
                } else {
                    formulation.insertBefore(webAiRow, formulation.firstChild);
                }
            }

            updateQuestionAiDrawerState(que);
        });

        // Setup throttled window scroll listener to update active focus as user scrolls
        if (!window.__amaesScrollFocusBound) {
            window.__amaesScrollFocusBound = true;
            let scrollTimer = null;
            window.addEventListener('scroll', () => {
                if (scrollTimer) return;
                scrollTimer = setTimeout(() => {
                    scrollTimer = null;
                    if (Date.now() < userActiveLockUntil && userSelectedActiveQuestion && document.contains(userSelectedActiveQuestion)) {
                        const rect = userSelectedActiveQuestion.getBoundingClientRect();
                        const vh = window.innerHeight || 800;
                        if (rect.bottom > 60 && rect.top < vh - 60) return;
                    }
                    getActiveViewportQuestion();
                }, 150);
            }, { passive: true });
        }

        // Initialize active focus on first page load
        if (!userSelectedActiveQuestion && queElements.length > 0) {
            getActiveViewportQuestion();
        }

        // Auto-dismiss Web AI dropdown on click/tap outside
        if (!window.__amaesWebAiMenuBound) {
            window.__amaesWebAiMenuBound = true;
            document.addEventListener('click', (e) => {
                if (!e.target.closest('.amaes-web-ai-container')) {
                    document.querySelectorAll('.amaes-web-ai-menu').forEach(m => { m.style.display = 'none'; });
                }
            });
        }
    }

    // Inject sleek in-question top toolbar with Stop / Resume button on every question card ("uptopquestion")
    function injectQuestionTopToolbars() {
        if (!checkIsQuizAttemptPage()) return;
        const queElements = document.querySelectorAll('.que');
        queElements.forEach(que => {
            const formulation = que.querySelector('.formulation, .content') || que;
            if (!formulation) return;
            if (formulation.querySelector('.amaes-que-top-toolbar')) return;

            const toolbar = document.createElement('div');
            toolbar.className = 'amaes-que-top-toolbar';
            toolbar.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: space-between;
                width: 100%;
                align-self: stretch;
                gap: 6px;
                margin-bottom: 6px;
                padding: 2px 0;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 11px;
                box-sizing: border-box;
            `;

            const qType = identifyQuestionType(que);
            if (qType === 'unknown') {
                return;
            }

            const typePill = document.createElement('span');
            typePill.className = 'amaes-que-type-pill';
            let typeLabel = 'Question';
            let typeBg = 'rgba(59, 130, 246, 0.12)';
            let typeColor = '#60a5fa';
            let typeBorder = 'rgba(59, 130, 246, 0.3)';

            if (qType === 'gapselect') {
                typeLabel = 'Dropdown Pick';
                typeBg = 'rgba(168, 85, 247, 0.12)';
                typeColor = '#c084fc';
                typeBorder = 'rgba(168, 85, 247, 0.3)';
            } else if (qType === 'shortanswer') {
                typeLabel = 'Short Answer';
                typeBg = 'rgba(6, 182, 212, 0.12)';
                typeColor = '#22d3ee';
                typeBorder = 'rgba(6, 182, 212, 0.3)';
            } else if (qType === 'truefalse') {
                typeLabel = 'True / False';
                typeBg = 'rgba(16, 185, 129, 0.12)';
                typeColor = '#34d399';
                typeBorder = 'rgba(16, 185, 129, 0.3)';
            } else if (qType === 'multichoice') {
                typeLabel = 'Multiple Choice';
                typeBg = 'rgba(59, 130, 246, 0.12)';
                typeColor = '#60a5fa';
                typeBorder = 'rgba(59, 130, 246, 0.3)';
            } else if (qType === 'match') {
                typeLabel = 'Matching';
                typeBg = 'rgba(245, 158, 11, 0.12)';
                typeColor = '#fbbf24';
                typeBorder = 'rgba(245, 158, 11, 0.3)';
            } else if (qType === 'dragdrop') {
                typeLabel = 'Drag & Drop';
                typeBg = 'rgba(249, 115, 22, 0.12)';
                typeColor = '#fb923c';
                typeBorder = 'rgba(249, 115, 22, 0.3)';
            } else if (qType === 'essay') {
                typeLabel = 'Essay';
                typeBg = 'rgba(148, 163, 184, 0.12)';
                typeColor = '#cbd5e1';
                typeBorder = 'rgba(148, 163, 184, 0.3)';
            }

            typePill.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 2px 7px;
                font-size: 9px;
                font-weight: 700;
                border-radius: 4px;
                background: ${typeBg};
                color: ${typeColor};
                border: 1px solid ${typeBorder};
                margin-right: auto;
                text-transform: uppercase;
                letter-spacing: 0.3px;
                user-select: none;
            `;
            typePill.textContent = typeLabel;
            typePill.title = `Question Type: ${typeLabel} (Class: ${Array.from(que.classList || []).join(' ')})`;
            toolbar.appendChild(typePill);

            const stopBtn = document.createElement('button');
            stopBtn.type = 'button';
            stopBtn.className = 'amaes-que-stop-btn';
            stopBtn.style.cssText = `
                display: inline-flex;
                margin-left: auto;
                flex: 0 0 auto;
                align-items: center;
                gap: 5px;
                padding: 3px 9px;
                font-size: 10px;
                font-weight: 700;
                border-radius: 6px;
                cursor: pointer;
                transition: all 0.15s ease;
                box-shadow: 0 1px 2px rgba(0,0,0,0.06);
            `;

            if (autoQuizMode) {
                stopBtn.innerHTML = `${ICONS.stop} <span>Stop Automation</span>`;
                stopBtn.style.background = 'rgba(239, 68, 68, 0.1)';
                stopBtn.style.color = '#ef4444';
                stopBtn.style.border = '1px solid rgba(239, 68, 68, 0.35)';
                stopBtn.title = 'Stop automation so you can answer manually without any script interference';
            } else {
                stopBtn.innerHTML = `${ICONS.play} <span>Resume Co-Pilot</span>`;
                stopBtn.style.background = 'rgba(16, 185, 129, 0.1)';
                stopBtn.style.color = '#10b981';
                stopBtn.style.border = '1px solid rgba(16, 185, 129, 0.35)';
                stopBtn.title = 'Resume autonomous quiz solver and auto-navigation';
            }

            stopBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleAutoQuizMode();
            };

            toolbar.appendChild(stopBtn);
            formulation.insertBefore(toolbar, formulation.firstChild);
        });
    }

    // Auto-copy question to clipboard ONLY when not auto-answering and answer is unknown
    let lastCopiedSignature = '';
    function triggerAutoCopyForAI() {
        if (!autoCopyQuizForAI) return;
        if (!checkIsQuizAttemptPage()) return;

        // LOGIC FIX: If Auto-Quiz mode is active OR questions are already verified in DB, DO NOT auto-copy!
        if (autoQuizMode) return;

        const courseInfo = detectCourseInfo();
        const subCode = courseInfo.subjectCode || 'CS6301';
        const cached = getCachedAnswers(subCode);
        const queElements = document.querySelectorAll('.que');
        if (queElements.length === 0) return;

        // If all questions are verified by database, suppress auto-copy
        let hasUnansweredUnknown = false;
        queElements.forEach(que => {
            if (!que.querySelector('.amaes-verified-badge')) hasUnansweredUnknown = true;
        });

        if (!hasUnansweredUnknown) {
            logDebug("All questions known in DB, suppressing auto-copy.");
            return;
        }

        const textToCopy = formatAllQuestionsForAI(aiPromptHint);
        if (!textToCopy) return;

        const signature = textToCopy.trim();
        if (signature === lastCopiedSignature) return;
        lastCopiedSignature = signature;

        let targetQue = null;
        for (const que of queElements) {
            if (!que.querySelector('.amaes-verified-badge')) {
                targetQue = que;
                break;
            }
        }
        if (!targetQue && queElements.length > 0) targetQue = queElements[0];

        copyQuestionWithOptionalImage(targetQue, textToCopy).then((res) => {
            logDebug('Copied unknown question for AI helper' + (res && res.withImage ? ' with snippet' : ''));
            showToast(res && res.withImage ? 'Visual snippet & question copied! Ready to paste into AI.' : 'Question copied! Ready to paste into AI helper.');
            const statusEl = document.getElementById('amaes-status');
            if (statusEl) {
                statusEl.innerHTML = `<span style="color:var(--accent-green);">${res && res.withImage ? 'Visual snippet & text ready to paste into AI!' : 'Question ready to paste into AI helper!'}</span>`;
            }
        }).catch(err => {
            logDebug('Auto-copy failed:', err.message);
        });
    }

    // Observer and initializer for quiz automation
    let observerDebounceTimer = null;
    function setupQuizAutomation() {
        if (!checkIsQuizPage()) return;

        injectQuestionCopyButtons();
        injectQuestionTopToolbars();
        handleQuizReviewPageLoad();
        if (checkIsReviewPage()) {
            injectReviewQuestionMarkers();
        }

        if (checkIsQuizAttemptPage()) {
            isWaitingForUserAnswer = false;
            injectQuizFloatingHUD();
            injectQuestionTopToolbars();
            setupQuizAnswerListeners();

            // Auto-minimize toolkit panel to floating smart pill if enabled
            if (autoMinimizeQuiz) {
                const bodyEl = document.getElementById('amaes-panel-body');
                const minBtn = document.getElementById('amaes-min-btn');
                if (bodyEl && bodyEl.style.display !== 'none') {
                    bodyEl.style.display = 'none';
                    if (minBtn) {
                        minBtn.innerHTML = `
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                            </svg>
                        `;
                    }
                }
            }

            // On attempt page load: ONLY run solver if Auto-Quiz is active; otherwise just highlight visually
            clearTimeout(pageLoadSolverTimer);
            pageLoadSolverTimer = setTimeout(async () => {
                if (autoQuizMode) {
                    runAutoQuizSolver(true);
                } else {
                    const courseInfo = detectCourseInfo();
                    const subCode = courseInfo.subjectCode || 'CS6301';
                    let cached = getCachedAnswers(subCode);
                    if ((!cached || cached.length === 0) && autoScrapeAmauoed && typeof autoFetchCloudAnswersIfMissing === 'function') {
                        setLog(`Answers missing for <b>${subCode}</b>. Auto-fetching from AMAUOED / Cloud...`, 'var(--accent-blue)');
                        await autoFetchCloudAnswersIfMissing(subCode);
                        cached = getCachedAnswers(subCode);
                    }
                    if (cached && cached.length > 0) {
                        highlightQuizAnswers(cached, false, false);
                    }
                }
                triggerAutoCopyForAI();
                setupQuizAnswerListeners();
            }, 400);
        }

        if (checkIsQuizSummaryPage()) {
            setTimeout(handleQuizSummaryAutoSubmit, 600);
        }

        // Debounced observer: updates buttons, answer listeners, and review harvesting
        const observer = new MutationObserver(() => {
            clearTimeout(observerDebounceTimer);
            observerDebounceTimer = setTimeout(() => {
                injectQuestionCopyButtons();
                injectQuestionTopToolbars();
                handleQuizReviewPageLoad();
                if (checkIsReviewPage()) {
                    injectReviewQuestionMarkers();
                }
                if (checkIsQuizAttemptPage()) {
                    setupQuizAnswerListeners();
                }
            }, 300);
        });

        const target = document.querySelector('#region-main, .course-content, body');
        if (target) {
            observer.observe(target, { childList: true, subtree: true });
        }
    }

