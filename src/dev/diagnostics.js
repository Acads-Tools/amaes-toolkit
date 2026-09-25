    // ==========================================
    // Debug Report Generator
    // ==========================================

    function generateDebugReport() {
        const isCourse = checkIsCoursePage();
        const isQuiz = checkIsQuizPage();
        const courseInfo = detectCourseInfo();
        const cachedAns = getCachedAnswers(courseInfo.subjectCode);

        const report = {
            toolkitVersion: SCRIPT_VERSION,
            timestamp: new Date().toISOString(),
            theme: currentTheme,
            courseInfo,
            isQuizPage: isQuiz,
            cachedQuestionsCount: cachedAns ? cachedAns.length : 0,
            recentLogs: debugLogs.slice(-20)
        };

        return "```json\n" + JSON.stringify(report, null, 2) + "\n```";
    }

    function copyToClipboard(text) {
        if (typeof GM_setClipboard === 'function') {
            try {
                GM_setClipboard(text, 'text');
                return Promise.resolve();
            } catch (e) {
                logDebug('GM_setClipboard error:', e.message);
            }
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(text);
        }
        return new Promise((resolve, reject) => {
            try {
                const ta = document.createElement('textarea');
                ta.value = text;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                const ok = document.execCommand('copy');
                document.body.removeChild(ta);
                if (ok) resolve();
                else reject(new Error('execCommand copy failed'));
            } catch (err) {
                reject(err);
            }
        });
    }

    // Floating Non-intrusive Toast Notification
    function showToast(message, duration = 2400) {
        let toast = document.getElementById('amaes-toast-notification');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'amaes-toast-notification';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000000;
                background: rgba(15, 23, 42, 0.94);
                backdrop-filter: blur(8px);
                color: #f8fafc;
                border: 1px solid #334155;
                padding: 8px 14px;
                border-radius: 8px;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                font-size: 11.5px;
                font-weight: 600;
                box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                gap: 7px;
                opacity: 0;
                transform: translateY(-8px);
                transition: opacity 0.25s ease, transform 0.25s ease;
                pointer-events: none;
            `;
            document.body.appendChild(toast);
        }
        toast.innerHTML = `${ICONS.sparkles} <span>${message}</span>`;
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
        clearTimeout(toast._timer);
        toast._timer = setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-8px)';
        }, duration);
    }

    let capabilityTipsInterval = null;
    let capabilityTipIndex = 0;
    const CAPABILITY_TIPS = [
        'Tip: Auto-Quiz can scan every question on a page and move to the next unanswered one.',
        'Tip: Verified community answers are highlighted before any AI request is made.',
        'Tip: Gemini is used as a fallback for unknown multiple-choice and true/false questions.',
        'Tip: Copy AI prepares a clean prompt with the question and choices for any AI assistant.',
        'Tip: Paste AI matches an answer to the Moodle choice without changing your sharing format.',
        'Tip: One-page quizzes are not advanced until every question on that page has an answer.',
        'Tip: Complex questions such as essays, dropdowns, and drag-and-drop stay available for manual review.',
        'Tip: Cloud Sync keeps your local answer database updated with community contributions.',
        'Tip: Use the floating toolkit pill to pause automation, open settings, or review the current status.',
        'Tip: Personal Gemini keys stay in your browser; contributor sharing is optional and encrypted.',
        'Tip: Course Tools > Activity Auto-Marker > Mark Lectures & Vids marks unfinished lecture and video activities complete.',
        'Tip: Course Tools > Activity Auto-Marker > Mark Quizzes / Exams Only targets quiz activities without changing lecture progress.',
        'Tip: Course Tools > Activity Auto-Marker > Mark ALL as Done processes every unfinished activity found on the current course page.',
        'Tip: Use Course Tools > Highlight Missing Quizzes to find unanswered or unattempted quizzes on a Grades or Course page.',
        'Tip: Course Tools > Search Helper copies a subject-aware search phrase and opens Google for study-guide lookup.',
        'Tip: In the AI Assistant card, Auto-Copy Question on AI Failure puts a clean fallback prompt on your clipboard.',
        'Tip: In the AI Assistant card, Auto-Advance After AI Answer automatically proceeds to the next page after an AI choice is made (Default: ON).',
        'Tip: Click inside a quiz question and press C to copy the question and choices, ready to paste into another AI tool.',
        'Tip: After another AI tool gives you an answer, click the question and press V to paste it back and match the choice.',
        'Tip: Click inside a question and press N when you are ready to continue to the next question or page.',
        'Tip: Press P to pause or resume automatic quiz help while you review a question.'
    ];

    function startCapabilityTips() {
        if (capabilityTipsInterval || CAPABILITY_TIPS.length === 0) return;
        capabilityTipsInterval = setInterval(() => {
            const tip = CAPABILITY_TIPS[capabilityTipIndex % CAPABILITY_TIPS.length];
            capabilityTipIndex += 1;
            showToast(tip, 7500);
        }, 15000);
    }

    // Character Maps for Mathematical / Circuit Superscripts & Subscripts
    const SUP_MAP = {'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻','=':'⁼','(':'⁽',')':'⁾','n':'ⁿ','i':'ⁱ','x':'ˣ','y':'ʸ','m':'ᵐ','a':'ᵃ','b':'ᵇ','c':'ᶜ'};
    const SUB_MAP = {'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋','=':'₌','(':'₍',')':'₎','a':'ₐ','e':'ₑ','o':'ₒ','x':'ₓ','i':'ᵢ','j':'ⱼ','n':'ₙ','p':'ₚ'};

    // Converts DOM tree to clean formatted text preserving Superscripts, Subscripts, Math, Truth Tables, and Images
    function cleanDOMToAI(rootNode) {
        if (!rootNode) return '';
        const clone = rootNode.cloneNode(true);

        // Strip non-content scripts, toolkit buttons, injected UI badges & Moodle feedback icons/accessibility text
        clone.querySelectorAll('script, style, noscript, .amaes-verified-badge, .amaes-eliminated-badge, .amaes-probability-hint, .amaes-shortans-hint, .amaes-select-hint, .amaes-drag-hint, .amaes-unanswered-hint, .amaes-blockage-hud, .amaes-copy-ai-card-btn, .amaes-ask-ai-card-btn, .amaes-copy-img-card-btn, .amaes-paste-ai-card-btn, .amaes-active-focus-badge, .amaes-review-status-pill, .amaes-review-outcome-banner, .amaes-que-top-toolbar, .amaes-que-stop-btn, .amaes-ai-thinking-indicator, .amaes-ai-fallback-bar, .amaes-ai-suggested-badge, .amaes-ai-text-badge, .amaes-ai-question-tag, .feedbackimage, .fa-check, .fa-remove, .fa-times, .fa-close, .accesshide, .sr-only').forEach(el => el.remove());

        // Convert Superscripts (e.g. 2^3 -> 2³, x^2 -> x², or ^{complex})
        clone.querySelectorAll('sup').forEach(sup => {
            const txt = sup.innerText.trim();
            if (txt) {
                if ([...txt].every(ch => ch in SUP_MAP)) {
                    sup.replaceWith([...txt].map(ch => SUP_MAP[ch]).join(''));
                } else {
                    sup.replaceWith(`^{${txt}}`);
                }
            } else {
                sup.remove();
            }
        });

        // Convert Subscripts (e.g. 10_2 -> 10₂, A_0 -> A₀, or _{complex})
        clone.querySelectorAll('sub').forEach(sub => {
            const txt = sub.innerText.trim();
            if (txt) {
                if ([...txt].every(ch => ch in SUB_MAP)) {
                    sub.replaceWith([...txt].map(ch => SUB_MAP[ch]).join(''));
                } else {
                    sub.replaceWith(`_{${txt}}`);
                }
            } else {
                sub.remove();
            }
        });

        // Convert MathJax / LaTeX formulas
        clone.querySelectorAll('.math, .MathJax, [data-mathml]').forEach(mathElem => {
            const tex = mathElem.getAttribute('data-mathml') ||
                        (mathElem.querySelector('annotation[encoding*="tex"]') ? mathElem.querySelector('annotation[encoding*="tex"]').textContent : null) ||
                        mathElem.getAttribute('alt');
            if (tex) {
                mathElem.replaceWith(` $${tex.trim()}$ `);
            }
        });

        // Convert images into markdown links with alt text & cross-attempt normalized tokens
        clone.querySelectorAll('img').forEach(img => {
            const src = img.src || img.getAttribute('data-src') || '';
            const alt = (img.alt || '').trim();
            if (src) {
                const moodleImgMatch = src.match(/\/pluginfile\.php\/\d+\/question\/(?:answer|questiontext|feedback)\/\d+(?:\/\d+)?\/([^?#\s]+)/i);
                const assetName = moodleImgMatch ? moodleImgMatch[1] : '';
                const cleanSrc = (moodleImgMatch && assetName) ? `[moodle-asset:${assetName}]` : src;
                const imgText = alt ? `[Image: ${alt} - ${cleanSrc}]` : `[Image: ${cleanSrc}]`;
                img.replaceWith(document.createTextNode(`\n${imgText}\n`));
            } else {
                img.remove();
            }
        });

        // Convert drop zones into readable blank indicators (e.g. [Blank 1], [Blank 2])
        let dropCount = 0;
        clone.querySelectorAll('.drop, .dropzone, span.droptarget').forEach(dz => {
            dropCount++;
            const placed = dz.innerText.trim();
            const textNode = document.createTextNode(placed ? `[Blank ${dropCount}: ${placed}]` : `[Blank ${dropCount}]`);
            dz.replaceWith(textNode);
        });

        // Convert fill-in-the-blank text inputs into ____ so AI sees where the answer goes
        let blankCount = 0;
        clone.querySelectorAll('input[type="text"], input[type="number"], input:not([type="radio"]):not([type="checkbox"]):not([type="submit"]):not([type="button"]):not([type="hidden"])').forEach(inp => {
            // Only convert inputs inside the question text area (not answer choice inputs)
            if (inp.closest('.answer, .submitbtns, .amaes-card-btn-container')) return;
            blankCount++;
            const currentVal = (inp.value || inp.getAttribute('value') || '').trim();
            // If user already typed something, show it in context; otherwise show blank
            const blankLabel = currentVal ? `[____${blankCount > 1 ? ' ' + blankCount : ''}: ${currentVal}]` : `[____${blankCount > 1 ? ' ' + blankCount : ''}]`;
            inp.replaceWith(document.createTextNode(` ${blankLabel} `));
        });

        // Convert select / dropdown elements (e.g. gapselect inline dropdowns) into readable options
        let selectCount = 0;
        clone.querySelectorAll('select').forEach(sel => {
            selectCount++;
            const selectedOpt = (sel.selectedIndex >= 0 && sel.options) ? sel.options[sel.selectedIndex] : null;
            const selectedVal = (selectedOpt && selectedOpt.value && selectedOpt.value !== '0' && !selectedOpt.text.toLowerCase().includes('choose')) ? selectedOpt.text.trim() : '';
            const options = Array.from(sel.querySelectorAll('option'))
                .map(o => (o.innerText || o.textContent || '').trim())
                .filter(o => o && !o.toLowerCase().includes('choose'));
            let selLabel = '';
            if (selectedVal) {
                selLabel = `[Dropdown ${selectCount}: ${selectedVal}]`;
            } else if (options.length > 0) {
                selLabel = `[Dropdown ${selectCount} (${options.join(' | ')})]`;
            } else {
                selLabel = `[Dropdown ${selectCount}]`;
            }
            sel.replaceWith(document.createTextNode(` ${selLabel} `));
        });

        // Convert tables (Truth Tables, Logic Mappings) to markdown rows
        clone.querySelectorAll('table').forEach(table => {
            const rows = [];
            table.querySelectorAll('tr').forEach(tr => {
                const cells = Array.from(tr.querySelectorAll('th, td')).map(td => td.innerText.trim());
                if (cells.length > 0) rows.push(cells.join(' | '));
            });
            if (rows.length > 0) {
                table.replaceWith(document.createTextNode('\n' + rows.join('\n') + '\n'));
            }
        });

        // Normalize spaces and clean up
        let text = clone.innerText || clone.textContent || '';
        text = text.replace(/[✓✔✗✘✕✖]/g, '');
        text = text.replace(/\r\n/g, '\n');
        text = text.split('\n').map(line => line.replace(/[ \t]+/g, ' ').trim()).filter((line, i, arr) => {
            return !(line === '' && arr[i - 1] === '');
        }).join('\n');

        return text.trim();
    }

    // Copy an image directly to the OS clipboard as a PNG blob
    async function copyImageBlobToClipboard(imgUrl) {
        try {
            const response = await fetch(imgUrl);
            const blob = await response.blob();
            let pngBlob = blob;
            if (blob.type !== 'image/png') {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                await new Promise((res, rej) => {
                    img.onload = res;
                    img.onerror = rej;
                    img.src = imgUrl;
                });
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                pngBlob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            }
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': pngBlob })
            ]);
            return { success: true };
        } catch (err) {
            logDebug('Image blob copy failed, falling back to URL copy:', err.message);
            await copyToClipboard(imgUrl);
            return { success: false, fallbackUrl: imgUrl };
        }
    }

    function mapQuestionTypeCategory(rawType) {
        if (!rawType) return 'unknown';
        const t = rawType.toLowerCase();
        if (t === 'multichoice' || t === 'multichoiceset') return 'multichoice';
        if (t === 'truefalse') return 'truefalse';
        if (t === 'shortanswer' || t === 'numerical' || t === 'calculated' || t === 'calculatedsimple' || t === 'calculatedmulti') return 'shortanswer';
        if (t === 'gapselect' || t === 'select' || t === 'cloze_select') return 'gapselect';
        if (t === 'match' || t === 'matching') return 'match';
        if (t.startsWith('dd') || t.includes('drag') || t.includes('drop')) return 'dragdrop';
        if (t === 'essay') return 'essay';
        if (t === 'multianswer') return 'gapselect';
        return 'unknown';
    }

    function identifyQuestionType(que) {
        if (!que) return 'unknown';

        // 1. Inspect Moodle's class on .que container
        const classList = Array.from(que.classList || []);
        for (const cls of classList) {
            const lower = cls.toLowerCase();
            if (lower.startsWith('qtype_')) {
                const sub = lower.replace('qtype_', '');
                return mapQuestionTypeCategory(sub);
            }
            if (['multichoice', 'truefalse', 'shortanswer', 'gapselect', 'match', 'ddwtos', 'ddimageortext', 'ddmarker', 'essay', 'numerical', 'multianswer', 'calculated'].includes(lower)) {
                return mapQuestionTypeCategory(lower);
            }
        }

        // 2. DOM signature checks
        if (que.querySelector('.draghome, .drags, .drop, .dropzone, span.droptarget, .droppable')) {
            return 'dragdrop';
        }

        const selects = que.querySelectorAll('select');
        if (selects.length > 0) {
            if (que.querySelector('.answer table select, td.control select')) {
                return 'match';
            }
            return 'gapselect';
        }

        if (que.querySelector('textarea, [contenteditable="true"], [data-fieldtype="editor"]')) {
            return 'essay';
        }

        const radios = que.querySelectorAll('.answer input[type="radio"]');
        if (radios.length > 0) {
            if (radios.length === 2) {
                const labels = Array.from(que.querySelectorAll('.answer label, .answer div.r0, .answer div.r1')).map(l => (l.innerText || '').toLowerCase());
                if (labels.some(l => l.includes('true')) && labels.some(l => l.includes('false'))) {
                    return 'truefalse';
                }
            }
            return 'multichoice';
        }

        if (que.querySelectorAll('.answer input[type="checkbox"]').length > 0) {
            return 'multichoice';
        }

        if (que.querySelector('input[type="text"].form-control, input.form-control, input[type="text"], input[type="number"]')) {
            return 'shortanswer';
        }

        return 'unknown';
    }

    function recordUnknownQuestionType(que, qData = null) {
        try {
            if (!que) return;
            const raw = localStorage.getItem('amaes_unknown_question_types');
            const list = raw ? JSON.parse(raw) : [];

            const classList = Array.from(que.classList || []).filter(c => !c.startsWith('amaes') && c !== 'clearfix');
            const inputs = Array.from(que.querySelectorAll('input, select, textarea, button, [contenteditable], .drop, .draghome')).map(el => {
                let tag = el.tagName.toLowerCase();
                if (el.type) tag += `[type=${el.type}]`;
                if (el.className) tag += `.${el.className.split(/\s+/).filter(c => c && !c.startsWith('amaes')).join('.')}`;
                return tag;
            });
            const signature = `${classList.sort().join(' ')} | ${inputs.sort().join(', ')}`;

            if (list.some(item => item.signature === signature)) {
                return;
            }

            const qSnippet = (que.querySelector('.qtext, .formulation') ? que.querySelector('.qtext, .formulation').innerText.slice(0, 160) : (qData && qData.qText ? qData.qText.slice(0, 160) : '')).trim();
            let rawHtml = que.querySelector('.formulation, .content') ? que.querySelector('.formulation, .content').innerHTML : '';
            rawHtml = rawHtml.replace(/data:image\/[^;]+;base64,[a-zA-Z0-9+/=]+/g, '[image: embedded]');
            rawHtml = rawHtml.replace(/([?&])(sesskey|attempt|token)=[a-zA-Z0-9]+/g, '$1$2=REDACTED');
            const formulationHtml = rawHtml.slice(0, 500);

            const entry = {
                id: `unk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                timestamp: new Date().toISOString(),
                url: (typeof window !== 'undefined' && window.location) ? window.location.href.split('?')[0] : '',
                classes: classList,
                signature: signature,
                inputCount: inputs.length,
                inputsSummary: inputs.slice(0, 10),
                snippet: qSnippet,
                htmlSample: formulationHtml
            };

            list.push(entry);
            if (list.length > 25) list.splice(0, list.length - 25);
            localStorage.setItem('amaes_unknown_question_types', JSON.stringify(list));
            logDebug(`Recorded unknown question type signature: ${signature}`);

            // Automatically push unknown question telemetry to the community database relay
            try {
                const courseInfo = (typeof detectCourseInfo === 'function') ? detectCourseInfo() : {};
                const currentSubCode = courseInfo.subjectCode || (typeof subCode !== 'undefined' ? subCode : 'GENERAL');
                pushUnknownQuestionToRelay(entry, currentSubCode);
            } catch (_) {}

            // Reassure user with a gentle notice without altering the question DOM or interrupting
            if (!hasNotifiedUnknownQuestion && (typeof checkIsQuizPage === 'function' ? checkIsQuizPage() : true)) {
                hasNotifiedUnknownQuestion = true;
                if (typeof showToast === 'function') {
                    showToast("New question type detected — reported to maintainer.", 4000);
                }
                if (typeof setLog === 'function') {
                    setLog("New question format detected. Reported to database for developer review.", "var(--accent-amber)");
                }
            }

            if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
                try {
                    window.dispatchEvent(new CustomEvent('amaes-unknown-question-recorded', { detail: entry }));
                } catch (_) {}
            }
        } catch (e) {
            logDebug('Failed to record unknown question type:', e && e.message);
        }
    }

    const pushedUnknownSignatures = new Set();
    let hasNotifiedUnknownQuestion = false;

    function pushUnknownQuestionToRelay(entry, subjectCode = 'GENERAL') {
        try {
            if (!entry || !entry.signature) return;
            if (pushedUnknownSignatures.has(entry.signature)) return;
            pushedUnknownSignatures.add(entry.signature);

            const relayUrl = (typeof communityRelayUrl !== 'undefined' && communityRelayUrl) ? communityRelayUrl : COMMUNITY_RELAY_URL;
            if (!relayUrl) return;

            const payload = {
                subjectCode: subjectCode || 'GENERAL',
                clientVersion: SCRIPT_VERSION.replace(/^v/i, ''),
                contributorId: (typeof getAnonymousContributorId === 'function') ? getAnonymousContributorId() : 'anon',
                signature: entry.signature,
                classes: entry.classes || [],
                inputCount: entry.inputCount || 0,
                inputsSummary: entry.inputsSummary || [],
                snippet: entry.snippet || '',
                htmlSample: entry.htmlSample || '',
                submittedAt: entry.timestamp || new Date().toISOString()
            };

            const gmReq = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                          (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

            if (gmReq) {
                gmReq({
                    method: 'POST',
                    url: `${relayUrl}/unknown-question`,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-AMAES-Client-Version': SCRIPT_VERSION.replace(/^v/i, '')
                    },
                    data: JSON.stringify(payload),
                    onload: (res) => {
                        logDebug(`Pushed unknown question telemetry to database relay (status: ${res.status})`);
                    },
                    onerror: (err) => {
                        logDebug('Failed to push unknown question telemetry:', err);
                    }
                });
            } else if (typeof fetch !== 'undefined') {
                fetch(`${relayUrl}/unknown-question`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-AMAES-Client-Version': SCRIPT_VERSION.replace(/^v/i, '')
                    },
                    body: JSON.stringify(payload)
                }).then(res => {
                    logDebug(`Pushed unknown question telemetry via fetch (status: ${res.status})`);
                }).catch(err => {
                    logDebug('Failed to push unknown question telemetry via fetch:', err);
                });
            }
        } catch (e) {
            logDebug('Exception in pushUnknownQuestionToRelay:', e && e.message);
        }
    }

    function getUnknownQuestionTypes() {
        try {
            const raw = localStorage.getItem('amaes_unknown_question_types');
            return raw ? JSON.parse(raw) : [];
        } catch (_) {
            return [];
        }
    }

    function clearUnknownQuestionTypes() {
        localStorage.removeItem('amaes_unknown_question_types');
    }

    function exportUnknownQuestionTypesJson() {
        const types = getUnknownQuestionTypes();
        return JSON.stringify(types, null, 2);
    }

    // Community Bug Reporting (Direct to GitHub Issues via Cloudflare Relay)
    function submitBugReportToRelay(reportData) {
        return new Promise((resolve, reject) => {
            try {
                const relayUrl = (typeof communityRelayUrl !== 'undefined' && communityRelayUrl) ? communityRelayUrl : COMMUNITY_RELAY_URL;
                if (!relayUrl) {
                    return reject(new Error('Community relay URL is not configured.'));
                }

                const payload = {
                    description: reportData.description || '',
                    subjectCode: reportData.subjectCode || 'GENERAL',
                    clientVersion: SCRIPT_VERSION.replace(/^v/i, ''),
                    pageType: reportData.pageType || 'unknown',
                    environment: reportData.environment || `${(typeof navigator !== 'undefined' && navigator.userAgent) || 'Unknown'} (Screen: ${(typeof window !== 'undefined' && window.innerWidth) || 0}x${(typeof window !== 'undefined' && window.innerHeight) || 0})`,
                    logs: Array.isArray(reportData.logs) ? reportData.logs : [],
                    breadcrumbs: Array.isArray(reportData.breadcrumbs) ? reportData.breadcrumbs : [],
                    questionsSummary: Array.isArray(reportData.questionsSummary) ? reportData.questionsSummary : [],
                    settings: (reportData.settings && typeof reportData.settings === 'object') ? reportData.settings : {},
                    contributorId: (typeof getAnonymousContributorId === 'function') ? getAnonymousContributorId() : 'anon'
                };

                const gmReq = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                              (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

                if (gmReq) {
                    gmReq({
                        method: 'POST',
                        url: `${relayUrl}/report-bug`,
                        headers: {
                            'Content-Type': 'application/json',
                            'X-AMAES-Client-Version': SCRIPT_VERSION.replace(/^v/i, '')
                        },
                        data: JSON.stringify(payload),
                        onload: (res) => {
                            try {
                                const data = JSON.parse(res.responseText || '{}');
                                if (res.status >= 200 && res.status < 300 && data.success) {
                                    resolve(data);
                                } else {
                                    reject(new Error(data.error || `HTTP ${res.status}`));
                                }
                            } catch (err) {
                                reject(new Error(`Server returned unexpected response (status ${res.status})`));
                            }
                        },
                        onerror: (err) => {
                            reject(new Error(err && err.statusText ? err.statusText : 'Network error communicating with bug relay'));
                        }
                    });
                } else if (typeof fetch !== 'undefined') {
                    fetch(`${relayUrl}/report-bug`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-AMAES-Client-Version': SCRIPT_VERSION.replace(/^v/i, '')
                        },
                        body: JSON.stringify(payload)
                    }).then(async res => {
                        const data = await res.json().catch(() => ({}));
                        if (res.ok && data.success) {
                            resolve(data);
                        } else {
                            reject(new Error(data.error || `HTTP ${res.status}`));
                        }
                    }).catch(err => {
                        reject(err);
                    });
                } else {
                    reject(new Error('No HTTP transport available.'));
                }
            } catch (e) {
                reject(e);
            }
        });
    }

    function showBugReportModal() {
        const existing = document.getElementById('amaes-bug-modal');
        if (existing) {
            existing.querySelector('textarea')?.focus();
            return;
        }

        const courseInfo = (typeof detectCourseInfo === 'function') ? detectCourseInfo() : {};
        const activeSubCode = courseInfo.subjectCode || (typeof subCode !== 'undefined' ? subCode : 'GENERAL');
        const activePageType = (typeof checkIsQuizPage === 'function' && checkIsQuizPage()) ? 'quiz_attempt'
            : ((typeof checkIsReviewPage === 'function' && checkIsReviewPage()) ? 'quiz_review'
            : ((typeof checkIsCoursePage === 'function' && checkIsCoursePage()) ? 'course_view' : 'dashboard'));

        const modal = document.createElement('div');
        modal.id = 'amaes-bug-modal';
        modal.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(15, 23, 42, 0.75);
            backdrop-filter: blur(4px);
            z-index: 999999;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            animation: amaesFadeIn 0.15s ease-out;
        `;

        modal.innerHTML = `
            <div style="
                background: var(--surface, #1e293b);
                border: 1px solid var(--border, #334155);
                border-radius: 12px;
                width: 90%;
                max-width: 480px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                overflow: hidden;
                color: var(--text-primary, #f8fafc);
                font-size: 12px;
            ">
                <!-- Header -->
                <div style="
                    padding: 14px 18px;
                    background: linear-gradient(135deg, rgba(239, 68, 68, 0.18), rgba(249, 115, 22, 0.18));
                    border-bottom: 1px solid var(--border, #334155);
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                ">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="color: #f87171; display: flex; align-items: center;">${ICONS.bug || ICONS.alertTriangle}</span>
                        <span style="font-weight: 800; font-size: 13.5px; color: #f8fafc;">Report a Problem / Bug</span>
                    </div>
                    <button id="amaes-bug-modal-close" type="button" style="
                        background: transparent;
                        border: none;
                        color: var(--text-muted, #94a3b8);
                        font-size: 18px;
                        cursor: pointer;
                        line-height: 1;
                        padding: 4px;
                    ">&times;</button>
                </div>

                <!-- Body -->
                <div id="amaes-bug-modal-body" style="padding: 16px 18px; display: flex; flex-direction: column; gap: 12px;">
                    <div style="color: var(--text-secondary, #cbd5e1); line-height: 1.45;">
                        Found a bug, broken question, or unexpected behavior? Submit details below to immediately open a tracked GitHub issue for the maintainers. No GitHub account needed.
                    </div>

                    <!-- Context Pills -->
                    <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                        <span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 600;">
                            Subject: ${activeSubCode}
                        </span>
                        <span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 600;">
                            Context: ${activePageType}
                        </span>
                        <span style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 4px; padding: 2px 7px; font-size: 11px; font-weight: 600;">
                            Version: ${SCRIPT_VERSION}
                        </span>
                    </div>

                    <!-- Input Box -->
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        <label for="amaes-bug-description" style="font-weight: 600; color: var(--text-primary, #f8fafc);">
                            Description of the problem:
                        </label>
                        <textarea id="amaes-bug-description" rows="4" placeholder="e.g. Question 3 failed to auto-select, or the database answers did not match this quiz question format..." style="
                            width: 100%;
                            box-sizing: border-box;
                            padding: 8px 10px;
                            background: rgba(15, 23, 42, 0.6);
                            border: 1px solid var(--border, #334155);
                            border-radius: 6px;
                            color: var(--text-primary, #f8fafc);
                            font-size: 12px;
                            font-family: inherit;
                            resize: vertical;
                            min-height: 80px;
                        "></textarea>
                        <div style="display: flex; justify-content: space-between; font-size: 11px; color: var(--text-muted, #94a3b8); margin-top: 2px;">
                            <span id="amaes-bug-char-count">0 / 10 min characters</span>
                            <span id="amaes-bug-status-hint"></span>
                        </div>
                    </div>

                    <!-- Logs Option -->
                    <label style="display: flex; align-items: flex-start; gap: 8px; cursor: pointer; user-select: none; font-size: 11.5px; color: var(--text-secondary, #cbd5e1);">
                        <input type="checkbox" id="amaes-bug-include-logs" checked style="accent-color: #6366f1; margin-top: 2px;">
                        <span>Attach comprehensive diagnostics (action timeline, quiz structure, and activity logs — no passwords or tokens)</span>
                    </label>

                    <div id="amaes-bug-error-msg" style="display: none; padding: 8px 10px; border-radius: 6px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); color: #f87171; font-size: 11.5px;"></div>

                    <!-- Action Buttons -->
                    <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
                        <button id="amaes-bug-btn-cancel" type="button" style="
                            padding: 6px 14px;
                            background: transparent;
                            border: 1px solid var(--border, #334155);
                            color: var(--text-secondary, #cbd5e1);
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: 600;
                            font-size: 12px;
                        ">Cancel</button>
                        <button id="amaes-bug-btn-submit" type="button" style="
                            padding: 6px 16px;
                            background: #ef4444;
                            color: #ffffff;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: 700;
                            font-size: 12px;
                            transition: background 0.15s ease;
                        ">Submit Report</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        const closeModal = () => modal.remove();
        modal.querySelector('#amaes-bug-modal-close').onclick = closeModal;
        modal.querySelector('#amaes-bug-btn-cancel').onclick = closeModal;
        modal.onclick = (e) => {
            if (e.target === modal) closeModal();
        };

        const textarea = modal.querySelector('#amaes-bug-description');
        const charCount = modal.querySelector('#amaes-bug-char-count');
        const submitBtn = modal.querySelector('#amaes-bug-btn-submit');
        const errorMsg = modal.querySelector('#amaes-bug-error-msg');
        const logsCheckbox = modal.querySelector('#amaes-bug-include-logs');
        const modalBody = modal.querySelector('#amaes-bug-modal-body');

        textarea.focus();

        textarea.oninput = () => {
            const len = textarea.value.trim().length;
            charCount.innerText = `${len} / 10 min characters`;
            if (len >= 10) {
                charCount.style.color = '#34d399';
            } else {
                charCount.style.color = 'var(--text-muted, #94a3b8)';
            }
            errorMsg.style.display = 'none';
        };

        submitBtn.onclick = async () => {
            const desc = textarea.value.trim();
            if (desc.length < 10) {
                errorMsg.innerText = 'Please provide at least 10 characters describing the issue.';
                errorMsg.style.display = 'block';
                textarea.focus();
                return;
            }

            submitBtn.disabled = true;
            submitBtn.style.opacity = '0.6';
            submitBtn.innerText = 'Submitting...';
            errorMsg.style.display = 'none';

            let logs = [];
            let breadcrumbs = [];
            let questionsSummary = [];
            let settings = {};

            if (logsCheckbox && logsCheckbox.checked) {
                try {
                    // 1. Logs
                    logs = (typeof activityHistory !== 'undefined' && Array.isArray(activityHistory))
                        ? activityHistory.slice(0, 40).map(item => `[${item.time}] ${(item.text || '').replace(/<[^>]+>/g, '')}`)
                        : [];

                    // 2. User Action Breadcrumbs (what the user clicked and did)
                    breadcrumbs = (typeof userBreadcrumbs !== 'undefined' && Array.isArray(userBreadcrumbs))
                        ? userBreadcrumbs.slice(-35).map(b => `[${b.time}] [${b.category}] ${b.action}${b.details ? ' — ' + b.details : ''}`)
                        : [];

                    // 3. Questions Summary on active page
                    const queNodes = Array.from(document.querySelectorAll('.que'));
                    questionsSummary = queNodes.map((que, idx) => {
                        const numElem = que.querySelector('.info .no, .qno');
                        const qNum = numElem ? numElem.innerText.replace(/\s+/g, ' ').trim() : `Q${idx + 1}`;
                        const rawType = (typeof identifyQuestionType === 'function') ? identifyQuestionType(que) : 'unknown';
                        const checkedInputs = que.querySelectorAll('input:checked, select option:checked, textarea:not(:placeholder-shown)');
                        const gradeElem = que.querySelector('.grade');
                        const gradeText = gradeElem ? gradeElem.innerText.replace(/\s+/g, ' ').trim() : null;
                        return {
                            num: qNum,
                            type: rawType,
                            answered: checkedInputs.length > 0,
                            ...(gradeText ? { grade: gradeText } : {})
                        };
                    });

                    // 4. Active Toolkit Settings & Preferences (Real live settings)
                    settings = {
                        autoQuizMode: typeof autoQuizMode !== 'undefined' ? autoQuizMode : false,
                        autoPickQuiz: typeof autoPickQuiz !== 'undefined' ? autoPickQuiz : true,
                        autoNextVerified: typeof autoNextVerified !== 'undefined' ? autoNextVerified : true,
                        autoNextQuiz: typeof autoNextQuiz !== 'undefined' ? autoNextQuiz : false,
                        autoHighlightQuiz: typeof autoHighlightQuiz !== 'undefined' ? autoHighlightQuiz : true,
                        smartSkipQuiz: typeof smartSkipQuiz !== 'undefined' ? smartSkipQuiz : false,
                        aiQuizEnabled: typeof aiQuizEnabled !== 'undefined' ? aiQuizEnabled : false,
                        aiAutoSelect: typeof aiAutoSelect !== 'undefined' ? aiAutoSelect : false,
                        hasGeminiKey: !!localStorage.getItem('amaes_gemini_api_key'),
                        cloudSync: localStorage.getItem('amaes_auto_cloud_sync') !== 'false',
                        cachedAnswersCount: (typeof getCachedAnswers === 'function' && activeSubCode) ? (getCachedAnswers(activeSubCode) || []).length : 0,
                        unknownTypesCount: (typeof getUnknownQuestionTypes === 'function') ? getUnknownQuestionTypes().length : 0
                    };
                } catch (_) {}
            }

            try {
                const res = await submitBugReportToRelay({
                    description: desc,
                    subjectCode: activeSubCode,
                    pageType: activePageType,
                    logs: logs,
                    breadcrumbs: breadcrumbs,
                    questionsSummary: questionsSummary,
                    settings: settings
                });

                modalBody.innerHTML = `
                    <div style="display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 12px 0;">
                        <div style="width: 44px; height: 44px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); display: flex; align-items: center; justify-content: center; color: #34d399;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                        <div style="font-weight: 800; font-size: 14px; color: #f8fafc;">
                            Issue #${res.issueNumber} Opened!
                        </div>
                        <div style="color: var(--text-secondary, #cbd5e1); font-size: 12px; line-height: 1.45;">
                            Thank you! Your bug report has been forwarded directly to the developers on GitHub.
                        </div>
                        ${res.issueUrl ? `
                        <a href="${res.issueUrl}" target="_blank" rel="noopener noreferrer" style="color: #60a5fa; font-size: 11.5px; text-decoration: underline; margin-top: 4px;">
                            View Issue #${res.issueNumber} on GitHub &rarr;
                        </a>` : ''}
                        <button id="amaes-bug-done-btn" type="button" style="
                            margin-top: 10px;
                            padding: 6px 20px;
                            background: #6366f1;
                            color: white;
                            border: none;
                            border-radius: 6px;
                            cursor: pointer;
                            font-weight: 700;
                            font-size: 12px;
                        ">Done</button>
                    </div>
                `;

                const doneBtn = modal.querySelector('#amaes-bug-done-btn');
                if (doneBtn) doneBtn.onclick = closeModal;

                if (typeof showToast === 'function') {
                    showToast(`Bug report submitted (#${res.issueNumber})!`);
                }
                if (typeof setLog === 'function') {
                    setLog(`Reported bug to GitHub (Issue <b>#${res.issueNumber}</b>).`, "var(--accent-green)");
                }
            } catch (err) {
                submitBtn.disabled = false;
                submitBtn.style.opacity = '1';
                submitBtn.innerText = 'Submit Report';
                errorMsg.innerText = err.message || 'Failed to submit bug report. Please try again later.';
                errorMsg.style.display = 'block';
            }
        };
    }

    // Extract Question & Choices cleanly from a Moodle .que element
    function extractQuestionData(que) {
        if (!que) return null;

        // 1. Question Number (clean digits only, e.g. "4", avoiding "Question #Question 4")
        const numElem = que.querySelector('.info .no, .qno');
        let rawNum = numElem ? numElem.innerText.replace(/\s+/g, ' ').trim() : '';
        const matchDigits = rawNum.match(/\d+/);
        const qNum = matchDigits ? matchDigits[0] : (rawNum.replace(/^Question\s*/i, '').trim() || '1');

        // 2. Question Text (cleanly processed through cleanDOMToAI)
        const qtextElem = que.querySelector('.qtext, .formulation .qtext');
        let qText = '';
        if (qtextElem) {
            qText = cleanDOMToAI(qtextElem);
        } else {
            const formElem = que.querySelector('.formulation');
            if (formElem) {
                const clone = formElem.cloneNode(true);
                const ans = clone.querySelector('.answer, .submitbtns');
                if (ans) ans.remove();
                qText = cleanDOMToAI(clone);
            }
        }

        // Broad fallback if neither .qtext nor .formulation captured the prompt
        if (!qText) {
            const fallbackElem = que.querySelector('.content, .formulation, [class*="formulation"]') || que;
            const clone = fallbackElem.cloneNode(true);
            clone.querySelectorAll('.answer, .submitbtns, .info, .im-controls, .amaes-card-btn-container, .amaes-que-top-toolbar, .amaes-ai-question-tag').forEach(el => el.remove());
            qText = cleanDOMToAI(clone);
        }

        // Clean question text of leading "Question 1" or prompt remnants
        qText = qText.replace(/^Question\s*\d+[\s:.]*/i, '').trim();
        // Also strip leading instruction preambles for cleaner AI prompts
        const preambleCleanRegex = /^(?:(?:direction|directions|instruction|instructions)\s*[:.\-–]\s*)?(?:read\s+(?:each\s+|the\s+)?(?:statement|question|passage)s?\s+(?:carefully\s+)?(?:and\s+)?)?(?:choose|select|pick|identify|mark)\s+(?:the\s+)?(?:best|correct|appropriate|right)\s+(?:answer|choice|option)[.:?!;\s–-]*/i;
        while (preambleCleanRegex.test(qText)) {
            const stripped = qText.replace(preambleCleanRegex, '').trim();
            if (stripped.length === 0) break;
            qText = stripped;
        }
        qText = qText.replace(/\b(Select one|Select one or more|Choose one|Choose one or more)[:.]?\s*$/i, '').trim();

        // Detect all image URLs inside this question
        const questionImages = [];
        que.querySelectorAll('.formulation img, .qtext img').forEach(img => {
            if (img.src && !questionImages.includes(img.src)) questionImages.push(img.src);
        });

        // 3. Choices / Answers
        const choices = [];
        let choiceRows = que.querySelectorAll('.answer > div, .answer div.r0, .answer div.r1, .answer li, .answer tr');
        if (choiceRows.length === 0) {
            choiceRows = que.querySelectorAll('.answer div.r0, .answer div.r1, .answer li, .answer tr');
        }
        if (choiceRows.length === 0) {
            choiceRows = que.querySelectorAll('.answer label');
        }

        if (choiceRows.length > 0) {
            choiceRows.forEach((row, idx) => {
                const label = row.querySelector('label') || row;
                let choiceText = cleanDOMToAI(label);
                // Collapse newlines inside single choice row to maintain clean multi-line choice sentences
                choiceText = choiceText.replace(/\r?\n\s*/g, ' ').replace(/\s+/g, ' ').trim();

                if (choiceText) {
                    // Ensure each choice starts with a clean letter prefix (a., b., c., d.)
                    const hasPrefix = /^[a-zA-Z0-9][.)]\s*/.test(choiceText);
                    if (!hasPrefix && choiceRows.length > 1) {
                        const letter = String.fromCharCode(97 + idx);
                        choiceText = `${letter}. ${choiceText}`;
                    }
                    choices.push(choiceText);
                }
            });
        }

        // Direct input element fallback if wrapper elements weren't caught
        if (choices.length === 0) {
            const choiceInputs = que.querySelectorAll('.answer input[type="radio"], .answer input[type="checkbox"]');
            if (choiceInputs.length > 0) {
                choiceInputs.forEach((inp, idx) => {
                    const label = (inp.labels && inp.labels[0]) || inp.closest('label, div.r0, div.r1, tr, li, div') || inp.parentElement;
                    let choiceText = cleanDOMToAI(label);
                    choiceText = choiceText.replace(/\r?\n\s*/g, ' ').replace(/\s+/g, ' ').trim();
                    if (choiceText) {
                        const hasPrefix = /^[a-zA-Z0-9][.)]\s*/.test(choiceText);
                        if (!hasPrefix && choiceInputs.length > 1) {
                            const letter = String.fromCharCode(97 + idx);
                            choiceText = `${letter}. ${choiceText}`;
                        }
                        choices.push(choiceText);
                    }
                });
            }
        }

        // 4. Essay / Long Answer question check
        const isEssay = Boolean(que.querySelector('textarea, [contenteditable="true"], .qtype_essay, [data-fieldtype="editor"]') && choices.length === 0);

        // 4b. Short Answer check
        const textInput = que.querySelector('input[type="text"].form-control, input.form-control, input[type="text"], input[type="number"]');
        const isShortAnswer = Boolean(textInput && choices.length === 0 && !isEssay);

        // 5. Matching type check
        const matchRows = que.querySelectorAll('.answer table tr, .answer tr');
        const matchPairs = [];
        if (matchRows.length > 0 && choices.length === 0) {
            matchRows.forEach(tr => {
                const textCol = tr.querySelector('td.text, td:first-child');
                const selectCol = tr.querySelector('td.control select, select');
                if (textCol && selectCol) {
                    const subQ = cleanDOMToAI(textCol);
                    const options = Array.from(selectCol.querySelectorAll('option'))
                        .map(o => o.innerText.trim())
                        .filter(o => o && !o.toLowerCase().includes('choose'));
                    if (subQ && options.length > 0) {
                        matchPairs.push({ subQ, options });
                    }
                }
            });
        }

        // 5b. Inline Gapselect / Cloze Select dropdowns check
        if (choices.length === 0 && matchPairs.length === 0) {
            const gapSelects = que.querySelectorAll('.qtext select, .formulation select');
            if (gapSelects.length > 0) {
                gapSelects.forEach((sel, gIdx) => {
                    const options = Array.from(sel.querySelectorAll('option'))
                        .map(o => o.innerText.trim())
                        .filter(o => o && !o.toLowerCase().includes('choose'));
                    if (options.length > 0) {
                        matchPairs.push({ subQ: `Blank [${gIdx + 1}]`, options });
                    }
                });
            }
        }

        // 5c. Drag and Drop Question Type check (ddwtos, ddimageortext, ddmarker)
        const dragHomes = Array.from(que.querySelectorAll('.draghome, .dragitems .draghome, .drags .drag, .drags span, span.draghome, .dragboxes .drag, .dragitem'));
        const dropZones = Array.from(que.querySelectorAll('.drop, .dropzone, span.droptarget, .droppable'));
        const isDragDrop = Boolean(que.classList.contains('ddwtos') || que.classList.contains('ddimageortext') || que.classList.contains('ddmarker') || (dragHomes.length > 0 && dropZones.length > 0));

        if (isDragDrop && choices.length === 0) {
            const seenChoices = new Set();
            dragHomes.forEach((dh) => {
                const choiceText = cleanDOMToAI(dh).trim();
                if (choiceText && !seenChoices.has(choiceText)) {
                    seenChoices.add(choiceText);
                    const letter = String.fromCharCode(97 + choices.length);
                    choices.push(`${letter}. ${choiceText}`);
                }
            });
        }

        // 6. Multi-Choice check (checkboxes or "Select one or more")
        const promptElem = que.querySelector('.prompt, .formulation .prompt');
        const promptText = promptElem ? promptElem.innerText : '';
        const hasCheckboxes = que.querySelectorAll('.answer input[type="checkbox"]').length > 0;
        const isMultiChoice = Boolean(
            hasCheckboxes ||
            /select (?:one or more choices?|one or more|all that apply)/i.test(promptText) ||
            /select (?:one or more choices?|one or more|all that apply)/i.test(que.innerText || '') ||
            /select (?:one or more choices?|one or more|all that apply)/i.test(qText)
        );

        const questionType = identifyQuestionType(que);
        const gapSelects = Array.from(que.querySelectorAll('.qtext select, .formulation select'));
        const isGapSelect = (questionType === 'gapselect' || (gapSelects.length > 0 && choices.length === 0));

        if (questionType === 'unknown') {
            recordUnknownQuestionType(que, { qNum, qText, questionType });
        }

        const gapSelectOptions = (isGapSelect || gapSelects.length > 0) ? gapSelects.map((sel, idx) => ({
            index: idx + 1,
            options: Array.from(sel.querySelectorAll('option')).map(o => (o.innerText || o.textContent || '').trim()).filter(o => o && !o.toLowerCase().includes('choose')),
            selectElem: sel
        })) : [];

        return {
            qNum,
            qText,
            choices,
            questionType,
            isGapSelect,
            gapSelectOptions,
            isMultiChoice,
            isShortAnswer,
            isEssay,
            isDragDrop,
            dropZonesCount: dropZones.length,
            matchPairs,
            questionImages
        };
    }

