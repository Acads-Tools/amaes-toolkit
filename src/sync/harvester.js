    // ==========================================
    // Quiz Review Harvester & Answer Sharing
    // ==========================================

    // Intelligent Multi-Source Answer Cross-Referencing, Elimination & Consensus Engine
    let communityShareDebounceTimer = null;
    function getQuestionIdentity(item) {
        const qNorm = item.qNorm || normalizeText(item.qRaw || item.question);
        const choiceNorms = Array.isArray(item.choices)
            ? item.choices.map(choice => normalizeChoice(choice)).filter(Boolean).sort()
            : [];
        return `${qNorm}::${choiceNorms.join('|')}`;
    }

    function mergeAnswersIntoCache(subCode, newQuestions, sourceLabel = 'Imported') {
        let existing = getCachedAnswers(subCode) || [];
        if (!Array.isArray(newQuestions)) {
            throw new TypeError('Incoming answer data must be an array');
        }
        let addedCount = 0;
        let confirmedCount = 0;
        let conflictCount = 0;
        let eliminatedCount = 0;

        newQuestions.forEach(newItem => {
            const qNorm = newItem.qNorm || normalizeText(newItem.qRaw || newItem.question);
            const ansRaw = newItem.ansRaw || newItem.answer || '';
            const ansNorm = newItem.ansNorm || normalizeChoice(ansRaw);
            const incomingWrong = normalizeWrongAnswers(newItem.wrongAnswers);

            // If neither correct answer nor eliminated wrong answers exist, ignore
            if (!qNorm || (!ansRaw && incomingWrong.length === 0)) return;

            const incomingIdentity = getQuestionIdentity({ ...newItem, qNorm });
            const idx = existing.findIndex(ex => {
                if (ex.qNorm !== qNorm) return false;
                // Legacy entries without choices remain compatible with the
                // question-text identity used by older cache versions.
                if (!Array.isArray(ex.choices) || ex.choices.length === 0 || !Array.isArray(newItem.choices) || newItem.choices.length === 0) {
                    return true;
                }
                return getQuestionIdentity(ex) === incomingIdentity;
            });

            if (idx === -1) {
                // Brand new question added to database
                const entry = {
                    qRaw: newItem.qRaw || newItem.question,
                    qNorm: qNorm,
                    ansRaw: ansRaw,
                    ansNorm: ansNorm,
                    answers: Array.isArray(newItem.answers) && newItem.answers.length > 0 ? newItem.answers : undefined,
                    choices: newItem.choices || [],
                    verified: Boolean(newItem.verified),
                    isAiSuggestion: Boolean(newItem.isAiSuggestion),
                    period: newItem.period || newItem.term || detectTermFromText(newItem.quizTitle || newItem.qRaw || '') || 'General',
                    quizTitle: newItem.quizTitle || '',
                    wrongAnswers: incomingWrong,
                    confirmations: ansRaw ? 1 : 0,
                    source: newItem.source || sourceLabel,
                    sources: [sourceLabel]
                };

                // Deduction check: if choices exist and all but 1 are eliminated
                if (!entry.ansRaw && Array.isArray(entry.choices) && entry.choices.length > 1) {
                    const wrongNorms = entry.wrongAnswers.map(w => w.norm);
                    const remaining = entry.choices.filter(c => !wrongNorms.includes(normalizeChoice(c)));
                    if (remaining.length === 1) {
                        entry.ansRaw = remaining[0].replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                        entry.ansNorm = normalizeChoice(entry.ansRaw);
                        entry.verified = true;
                        entry.deduced = true;
                        entry.sources.push('Elimination Deduction');
                    }
                }

                existing.push(entry);
                if (ansRaw) addedCount++;
                if (incomingWrong.length > 0) eliminatedCount += incomingWrong.length;
            } else {
                // Question already exists: Cross-reference!
                const cur = existing[idx];
                cur.sources = cur.sources || [];
                if (!cur.sources.includes(sourceLabel)) cur.sources.push(sourceLabel);
                if ((!cur.period || cur.period === 'General') && newItem.period && newItem.period !== 'General') {
                    cur.period = newItem.period;
                }
                if (!cur.quizTitle && newItem.quizTitle) cur.quizTitle = newItem.quizTitle;
                if (Array.isArray(newItem.answers) && newItem.answers.length > 0) {
                    cur.answers = Array.from(new Set((cur.answers || []).concat(newItem.answers)));
                }

                if (!Array.isArray(cur.wrongAnswers)) {
                    cur.wrongAnswers = normalizeWrongAnswers(cur.wrongAnswers);
                }

                // Merge incoming wrong answers with weighting
                incomingWrong.forEach(inW => {
                    // Safety Guard: If incoming wrong answer matches current ansNorm, review/attempt proved cur.ansRaw was WRONG!
                    if (cur.ansNorm && (inW.norm === cur.ansNorm || unscriptDigits(inW.norm) === unscriptDigits(cur.ansNorm))) {
                        cur.ansRaw = '';
                        cur.ansNorm = '';
                        cur.verified = false;
                        cur.isAiSuggestion = false;
                        cur.confirmations = 0;
                    }
                    if (Array.isArray(cur.answers)) {
                        cur.answers = cur.answers.filter(a => {
                            const aNorm = normalizeChoice(a);
                            return aNorm !== inW.norm && unscriptDigits(aNorm) !== unscriptDigits(inW.norm);
                        });
                        if (cur.answers.length === 0) {
                            cur.answers = undefined;
                        } else {
                            cur.ansRaw = cur.answers.join(', ');
                            cur.ansNorm = normalizeChoice(cur.ansRaw);
                        }
                    }
                    const existingW = cur.wrongAnswers.find(w => w.norm === inW.norm || unscriptDigits(w.norm) === unscriptDigits(inW.norm));
                    if (existingW) {
                        existingW.count = (existingW.count || 1) + (inW.count || 1);
                        if (!existingW.sources) existingW.sources = [];
                        if (!existingW.sources.includes(sourceLabel)) existingW.sources.push(sourceLabel);
                    } else {
                        cur.wrongAnswers.push(inW);
                        eliminatedCount++;
                    }
                });

                // Update choices if missing
                if (Array.isArray(newItem.choices) && newItem.choices.length > 0 && (!cur.choices || cur.choices.length === 0)) {
                    cur.choices = newItem.choices;
                }

                // Handle correct answer
                if (ansRaw) {
                    if (!cur.ansRaw) {
                        cur.ansRaw = ansRaw;
                        cur.ansNorm = ansNorm;
                        cur.verified = Boolean(newItem.verified);
                        cur.isAiSuggestion = Boolean(newItem.isAiSuggestion);
                        cur.confirmations = 1;
                        if (newItem.source) cur.source = newItem.source;
                        addedCount++;
                    } else {
                        const isSameAnswer = (cur.ansNorm === ansNorm || cur.ansRaw.toLowerCase() === ansRaw.toLowerCase());
                        if (isSameAnswer) {
                            cur.confirmations = (cur.confirmations || 1) + 1;
                            if (newItem.verified) {
                                cur.verified = true;
                                cur.isAiSuggestion = false;
                            }
                            confirmedCount++;
                        } else {
                            cur.variations = cur.variations || [];
                            const existingVar = cur.variations.find(v => v.ansNorm === ansNorm);
                            if (existingVar) {
                                existingVar.confirmations = (existingVar.confirmations || 1) + 1;
                            } else {
                                cur.variations.push({
                                    ansRaw: ansRaw,
                                    ansNorm: ansNorm,
                                    choices: newItem.choices || [],
                                    verified: Boolean(newItem.verified),
                                    isAiSuggestion: Boolean(newItem.isAiSuggestion),
                                    confirmations: 1,
                                    source: sourceLabel
                                });
                            }

                            if (newItem.verified && (!cur.verified || sourceLabel === 'Review')) {
                                cur.variations.push({
                                    ansRaw: cur.ansRaw,
                                    ansNorm: cur.ansNorm,
                                    choices: cur.choices || [],
                                    verified: cur.verified || false,
                                    isAiSuggestion: cur.isAiSuggestion || false,
                                    source: cur.source || 'Previous'
                                });
                                cur.ansRaw = ansRaw;
                                cur.ansNorm = ansNorm;
                                cur.verified = true;
                                cur.isAiSuggestion = false;
                                cur.source = 'Review';
                            }
                            conflictCount++;
                        }
                    }
                }

                // Safety Guard: Purge confirmed answer from wrongAnswers!
                if (cur.ansNorm && Array.isArray(cur.wrongAnswers)) {
                    cur.wrongAnswers = cur.wrongAnswers.filter(w => {
                        const wNorm = typeof w === 'string' ? normalizeChoice(w) : (w.norm || normalizeChoice(w.text || ''));
                        return wNorm !== cur.ansNorm && unscriptDigits(wNorm) !== unscriptDigits(cur.ansNorm);
                    });
                }

                // Deduction check for existing item if still missing verified answer (or holds unverified AI guess)
                if ((!cur.ansRaw || (!cur.verified && cur.isAiSuggestion)) && Array.isArray(cur.choices) && cur.choices.length > 1) {
                    const wrongNorms = cur.wrongAnswers.map(w => w.norm);
                    const remaining = cur.choices.filter(c => !wrongNorms.includes(normalizeChoice(c)));
                    if (remaining.length === 1) {
                        cur.ansRaw = remaining[0].replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                        cur.ansNorm = normalizeChoice(cur.ansRaw);
                        cur.verified = true;
                        cur.deduced = true;
                        cur.isAiSuggestion = false;
                        if (!cur.sources.includes('Elimination Deduction')) cur.sources.push('Elimination Deduction');
                    }
                }
            }
        });

        setCachedAnswers(subCode, existing);

        // Community Auto-Share: If user enabled auto-sharing (enabled by default),
        // and new/confirmed/eliminated data was saved to local database,
        // send anonymously to the community database relay so the world can benefit.
        // Avoid pinging if the source is already from cloud sync ('Cloud-Verified', 'Cloud-Fallback', 'Cloud-Amauoed').
        try {
            const autoShareEnabled = localStorage.getItem('amaes_auto_community_share') !== 'false';
            const isFromCloudSync = typeof sourceLabel === 'string' && sourceLabel.startsWith('Cloud-');
            const isReviewSave = sourceLabel === 'Review';
            if (autoShareEnabled && !isFromCloudSync && !isReviewSave && (addedCount > 0 || confirmedCount > 0 || eliminatedCount > 0)) {
                if (typeof dispatchCommunityContribution === 'function') {
                    clearTimeout(communityShareDebounceTimer);
                    communityShareDebounceTimer = setTimeout(() => {
                        queueCommunityContribution(subCode, existing, { source: sourceLabel });
                    }, 1500);
                }
            }
        } catch (shareErr) {
            logDebug(`Community dispatch check note: ${shareErr.message}`);
        }

        return {
            total: existing.length,
            added: addedCount,
            confirmed: confirmedCount,
            conflicts: conflictCount,
            eliminated: eliminatedCount
        };
    }

    // Direct GitHub REST API / Web Editor Answer Exporter & Contributor
    async function pushAnswersToGitHub(subCode, questionsToPush, options = {}) {
        const repoOwner = localStorage.getItem('amaes_github_owner') || 'Acads-Tools';
        const repoName = localStorage.getItem('amaes_github_repo') || 'database';
        const pat = localStorage.getItem('amaes_github_token');
        const branch = localStorage.getItem('amaes_github_branch') || 'main';
        const filePath = `data/${subCode}.json`;
        const apiUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`;

        // Ensure questions are valid
        if (!questionsToPush || questionsToPush.length === 0) {
            throw new Error('No verified questions to push');
        }

        // If no Personal Access Token is configured, prompt user or guide to 1-click web edit
        if (!pat) {
            const fullPayload = exportAnswersAsJSON({
                subjectCode: subCode,
                quizTitle: options.quizTitle || 'Community Contribution',
                gradeText: options.gradeText || 'Verified Answers',
                totalQuestions: questionsToPush.length,
                harvestedCount: questionsToPush.length,
                questions: questionsToPush
            });

            await copyToClipboard(fullPayload);

            const userChoice = confirm(
                `PUSH TO GITHUB (Community Study Hub)\n\n` +
                `${questionsToPush.length} Verified Q&A entries have been COPIED to your clipboard!\n\n` +
                `Click OK to open the GitHub Web Editor:\n` +
                `Press Ctrl+A, Ctrl+V, and click 'Commit changes'.\n\n` +
                `Tip: To push automatically in 1 click without opening tabs, set your GitHub Token in 'Config'.`
            );

            if (userChoice) {
                const editUrl = `https://github.com/${repoOwner}/${repoName}/edit/${branch}/${filePath}`;
                window.open(editUrl, '_blank');
                return { success: true, mode: 'web_edit', count: questionsToPush.length };
            }
            return { success: false, mode: 'cancelled' };
        }

        // Direct GitHub REST API Commit (Zero traces of personal username, commits as Open LMS Contributor)
        const req = (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest :
                    (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

        function doHttp(params) {
            return new Promise((resolve, reject) => {
                if (req) {
                    req({
                        ...params,
                        onload: (res) => resolve(res),
                        onerror: (err) => reject(err)
                    });
                } else {
                    fetch(params.url, {
                        method: params.method,
                        headers: params.headers,
                        body: params.data
                    }).then(async res => {
                        const text = await res.text();
                        resolve({ status: res.status, responseText: text });
                    }).catch(reject);
                }
            });
        }

        // 1. Fetch existing file to retrieve current SHA and merge contents
        let existingSha = null;
        let existingQuestions = [];

        try {
            const getRes = await doHttp({
                method: 'GET',
                url: `${apiUrl}?ref=${branch}`,
                headers: {
                    'Authorization': `token ${pat}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'User-Agent': 'AMAES-Moodle-Toolkit'
                }
            });

            if (getRes.status === 200) {
                const data = JSON.parse(getRes.responseText);
                existingSha = data.sha;
                if (data.content) {
                    const decoded = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
                    const parsedExisting = JSON.parse(decoded);
                    existingQuestions = parseIncomingAnswerPayload(parsedExisting, subCode);
                }
            }
        } catch (e) {
            console.warn('GitHub file not found or fetch error, creating new dataset:', e);
        }

        // 2. Intelligent Merge & Consensus
        const questionMap = new Map();
        existingQuestions.forEach(q => {
            const key = q.qNorm || normalizeText(q.qRaw || q.question);
            if (key) {
                questionMap.set(key, {
                    question: q.qRaw || q.question,
                    answer: q.ansRaw || q.answer,
                    choices: q.choices || [],
                    verified: Boolean(q.verified),
                    confirmations: q.confirmations || 1,
                    source: q.source || 'community'
                });
            }
        });

        questionsToPush.forEach(q => {
            const key = q.qNorm || normalizeText(q.qRaw || q.question);
            if (!key) return;
            const text = q.qRaw || q.question;
            const ans = q.ansRaw || q.answer;
            const choices = q.choices || [];
            const isVer = Boolean(q.verified);

            if (questionMap.has(key)) {
                const cur = questionMap.get(key);
                if (normalizeChoice(cur.answer) === normalizeChoice(ans)) {
                    cur.confirmations = (cur.confirmations || 1) + 1;
                    cur.verified = true;
                } else if (isVer && !cur.verified) {
                    cur.answer = ans;
                    cur.verified = true;
                    cur.confirmations = 1;
                }
                if (!cur.choices || cur.choices.length === 0) cur.choices = choices;
            } else {
                questionMap.set(key, {
                    question: text,
                    answer: ans,
                    choices: choices,
                    verified: isVer,
                    confirmations: 1,
                    source: options.quizTitle || 'toolkit-review'
                });
            }
        });

        const mergedList = Array.from(questionMap.values());
        const finalPayload = {
            subjectCode: subCode,
            subjectName: options.courseTitle || subCode,
            updatedAt: new Date().toISOString(),
            totalQuestions: mergedList.length,
            questions: mergedList
        };

        const jsonString = JSON.stringify(finalPayload, null, 2);
        const contentBase64 = btoa(unescape(encodeURIComponent(jsonString)));

        const commitBody = {
            message: `Update ${subCode} verified answers database (${mergedList.length} questions) via Toolkit`,
            content: contentBase64,
            branch: branch,
            committer: {
                name: "Open LMS Contributor",
                email: "academic-contributor@users.noreply.github.com"
            },
            author: {
                name: "Open LMS Contributor",
                email: "academic-contributor@users.noreply.github.com"
            }
        };

        if (existingSha) {
            commitBody.sha = existingSha;
        }

        const putRes = await doHttp({
            method: 'PUT',
            url: apiUrl,
            headers: {
                'Authorization': `token ${pat}`,
                'Accept': 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
                'User-Agent': 'AMAES-Moodle-Toolkit'
            },
            data: JSON.stringify(commitBody)
        });

        if (putRes.status === 200 || putRes.status === 201) {
            // Merge into local cache too
            mergeAnswersIntoCache(subCode, mergedList, 'GitHub-Push');
            return { success: true, count: mergedList.length, mode: 'api' };
        } else {
            let errMsg = `HTTP ${putRes.status}`;
            try {
                const errData = JSON.parse(putRes.responseText);
                if (errData.message) errMsg = errData.message;
            } catch (_) {}
            throw new Error(`GitHub Commit Error: ${errMsg}`);
        }
    }

    // Multi-Tier Cloud Database Synchronization (Verified + AMAUOED Tiers)
    async function syncAnswersFromCloud(subCode, cloudUrl = null) {
        if (!subCode || subCode.toUpperCase() === 'DEFAULT' || subCode.toUpperCase() === 'GENERAL') {
            throw new Error('Please select or specify a valid subject code (e.g. CS6301, ITE6301)');
        }
        const cleanSubCode = subCode.trim().toUpperCase();

        const req = (typeof GM_xmlhttpRequest === 'function') ? GM_xmlhttpRequest :
                    (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

        function fetchJsonUrl(url) {
            return new Promise((resolve, reject) => {
                if (!req) {
                    fetch(url)
                        .then(res => {
                            if (!res.ok) throw new Error(`HTTP ${res.status}`);
                            return res.json();
                        })
                        .then(resolve)
                        .catch(reject);
                    return;
                }

                req({
                    method: 'GET',
                    url: url,
                    headers: { 'Accept': 'application/json' },
                    onload: (resp) => {
                        if (resp.status >= 200 && resp.status < 300) {
                            try {
                                resolve(JSON.parse(resp.responseText));
                            } catch (e) {
                                reject(new Error('Invalid JSON'));
                            }
                        } else {
                            reject(new Error(`HTTP ${resp.status}`));
                        }
                    },
                    onerror: () => reject(new Error('Network error connecting to database'))
                });
            });
        }

        let verifiedCount = 0;
        let communityCount = 0;
        let amauoedCount = 0;

        // 1. Fetch Verified Tier (Audited Gold Standard)
        try {
            const verBase = cloudUrl || cloudDbBaseUrl;
            const targetVerUrl = verBase.endsWith('/') ? `${verBase}${cleanSubCode}.json` : `${verBase}/${cleanSubCode}.json`;
            logDebug(`Syncing verified answers from: ${targetVerUrl}`);
            const verData = await fetchJsonUrl(targetVerUrl);
            const parsedVer = parseIncomingAnswerPayload(verData, cleanSubCode).map(q => ({
                ...q,
                source: q.source || 'verified_db',
                verified: true
            }));
            mergeAnswersIntoCache(cleanSubCode, parsedVer, 'Cloud-Verified');
            verifiedCount = parsedVer.length;
        } catch (e) {
            // Fallback to legacy master data/{CODE}.json
            try {
                const fbUrl = `${CLOUD_DB_FALLBACK_URL}${cleanSubCode}.json`;
                logDebug(`Falling back to master dataset: ${fbUrl}`);
                const fbData = await fetchJsonUrl(fbUrl);
                const parsedFb = parseIncomingAnswerPayload(fbData, cleanSubCode);
                mergeAnswersIntoCache(cleanSubCode, parsedFb, 'Cloud-Fallback');
                verifiedCount = parsedFb.length;
            } catch (err) {
                logDebug(`Verified tier note for ${cleanSubCode}: ${err.message}`);
            }
        }

        // 2. Fetch community tier, including unverified AI suggestions.
        // These entries are displayed as suggestions but never auto-selected
        // unless later promoted by review evidence or a 100% score.
        try {
            const communityUrl = `${communityDbBaseUrl}${cleanSubCode}.json`;
            const communityData = await fetchJsonUrl(communityUrl);
            const parsedCommunity = parseIncomingAnswerPayload(communityData, cleanSubCode).map(q => ({
                ...q,
                source: q.source || 'community_cache',
                verified: Boolean(q.verified),
                isAiSuggestion: Boolean(q.isAiSuggestion || q.evidenceType === 'ai_inference')
            }));
            mergeAnswersIntoCache(cleanSubCode, parsedCommunity, 'Cloud-Community');
            communityCount = parsedCommunity.length;
        } catch (e) {
            logDebug(`Community cache tier note for ${cleanSubCode}: ${e.message}`);
        }

        // 3. Fetch AMAUOED Tier (Study Guide Catalog)
        try {
            const amaUrl = `${CLOUD_DB_AMAUOED_URL}${cleanSubCode}.json`;
            logDebug(`Syncing amauoed catalog from: ${amaUrl}`);
            const amaData = await fetchJsonUrl(amaUrl);
            const parsedAma = parseIncomingAnswerPayload(amaData, cleanSubCode).map(q => ({
                ...q,
                source: 'amauoed'
            }));
            mergeAnswersIntoCache(cleanSubCode, parsedAma, 'Cloud-Amauoed');
            amauoedCount = parsedAma.length;
        } catch (e) {
            logDebug(`AMAUOED tier note for ${cleanSubCode}: ${e.message}`);
        }

        const totalSynced = verifiedCount + communityCount + amauoedCount;
        if (totalSynced === 0) {
            throw new Error(`No answer databases found for ${cleanSubCode}`);
        }

        return {
            success: true,
            count: totalSynced,
            verifiedCount,
            communityCount,
            amauoedCount
        };
    }

    async function autoFetchCloudAnswersIfMissing(code) {
        if (!code || code === 'DEFAULT' || code === 'GENERAL') return false;
        try {
            // 1. Check local cache: If answers already exist locally, avoid unnecessary scraping or network calls
            const existing = getCachedAnswers(code) || [];
            if (existing.length > 0) {
                return true;
            }

            // 2. Fetch from Cloud / GitHub community database
            const res = await syncAnswersFromCloud(code);
            if (res && res.count > 0) {
                return true;
            }

            // 3. Fallback: Auto-discover AMAUOED link dynamically or use stored (if autoScrapeAmauoed is enabled)
            if (autoScrapeAmauoed) {
                const amauoedUrl = (typeof autoFindAmauoedLink === 'function')
                    ? await autoFindAmauoedLink(code)
                    : getStoredAmauoedUrl(code);
                const alreadyScraped = localStorage.getItem(`amaes_amauoed_scraped_${code}`);
                if (amauoedUrl && !alreadyScraped && typeof loadAllAmauoedAnswers === 'function') {
                    logDebug(`Auto-scraping AMAUOED URL for missing course ${code}: ${amauoedUrl}`);
                    setLog(`Scraping AMAUOED answers for <b>${code}</b>...`, 'var(--accent-blue)', 'Plan: Crawl study guide and merge question bank');
                    const scraped = await loadAllAmauoedAnswers(amauoedUrl);
                    if (scraped && scraped.length > 0) {
                        localStorage.setItem(`amaes_amauoed_scraped_${code}`, '1');
                        mergeAnswersIntoCache(code, scraped, 'AMAUOED');
                        setLog(`Auto-scraped <b>${scraped.length}</b> answers from AMAUOED for <b>${code}</b>!`, 'var(--accent-green)');
                        showToast(`Loaded ${scraped.length} answers from AMAUOED!`);
                        return true;
                    }
                }
            }
            return false;
        } catch (e) {
            logDebug(`autoFetchCloudAnswersIfMissing note for ${code}: ${e.message}`);
            return false;
        }
    }

    function parseIncomingAnswerPayload(payload, defaultSubCode) {
        const incomingSchema = Number(payload && !Array.isArray(payload)
            ? payload.databaseSchema || payload.schemaVersion || 1
            : 1);
        if (Number.isFinite(incomingSchema) && incomingSchema > ANSWER_DB_SCHEMA_VERSION) {
            throw new Error(`Unsupported answer database schema ${incomingSchema}; this toolkit supports schema ${ANSWER_DB_SCHEMA_VERSION}.`);
        }
        let list = [];
        if (Array.isArray(payload)) {
            list = payload;
        } else if (payload && Array.isArray(payload.questions)) {
            list = payload.questions;
        }
        return list.map(q => ({
            qRaw: q.question || q.qRaw,
            qNorm: normalizeText(q.question || q.qRaw),
            ansRaw: q.answer || q.ansRaw,
            ansNorm: normalizeChoice(q.answer || q.ansRaw),
            choices: q.choices || [],
            verified: q.verified !== false,
            isAiSuggestion: Boolean(q.isAiSuggestion || q.evidenceType === 'ai_inference'),
            evidenceType: q.evidenceType || '',
            confirmations: Number(q.confirmations) || 1,
            source: q.source || 'db'
        }));
    }

    // Parse Moodle question grade accurately for arbitrary numbers and decimals (e.g. 1.00 out of 1.00, 3.40 out of 5.00, 2.10 out of 3.00, 0.00 out of 2.00)
    function parseMoodleQuestionGrade(que) {
        let earned = null;
        let max = null;
        const gradeElem = que.querySelector('.info .grade');
        if (gradeElem) {
            const match = gradeElem.innerText.match(/([0-9]+(?:\.[0-9]+)?)\s*out of\s*([0-9]+(?:\.[0-9]+)?)/i);
            if (match) {
                earned = parseFloat(match[1]);
                max = parseFloat(match[2]);
            }
        }

        const hasCorrectClass = que.classList.contains('correct');
        const hasIncorrectClass = que.classList.contains('incorrect');
        const hasPartialClass = que.classList.contains('partiallycorrect');

        const isFullMark = Boolean(
            (max !== null && max > 0 && Math.abs(earned - max) < 0.001) ||
            (hasCorrectClass && !hasPartialClass && !hasIncorrectClass)
        );

        const isZeroMark = Boolean(
            (earned !== null && earned === 0) ||
            (hasIncorrectClass && !hasPartialClass && !hasCorrectClass)
        );

        const isPartialMark = Boolean(
            hasPartialClass ||
            (earned !== null && max !== null && earned > 0 && earned < max && Math.abs(earned - max) >= 0.001)
        );

        return { earned, max, isFullMark, isZeroMark, isPartialMark };
    }

    function hasChoiceCheckmark(elem) {
        if (!elem) return false;
        // Priority guard: If choice has an explicit Moodle cross / incorrect marker, it is never a checkmark!
        if (hasChoiceCross(elem)) return false;
        if (elem.classList && (elem.classList.contains('correct') || elem.classList.contains('text-success'))) return true;
        if (elem.querySelector('.fa-check, .feedbackimage[alt*="Correct" i], img[src*="tick"], img[src*="correct"], img[src*="check"], [title*="Correct" i], [aria-label*="Correct" i], .text-success, [class*="correct" i], svg[class*="check" i]')) return true;

        // Clone and strip any toolkit-injected badges so toolkit's own check icons don't trigger false positives
        const clone = elem.cloneNode(true);
        clone.querySelectorAll('.amaes-verified-badge, .amaes-eliminated-badge, .amaes-active-focus-badge, .amaes-review-status-pill, .amaes-review-outcome-banner, .amaes-card-btn-container, .amaes-que-top-toolbar, .amaes-probability-hint, .amaes-shortans-hint, .amaes-select-hint, .amaes-drag-hint, .amaes-unanswered-hint, .amaes-ai-suggested-badge, .amaes-ai-text-badge, .amaes-ai-question-tag').forEach(el => el.remove());

        const text = (clone.innerText || clone.textContent || '');
        if (/[✓✔]/.test(text)) return true;
        const html = clone.innerHTML || '';
        return /fa-check|alt="Correct"|title="Correct"|correct\.svg|feedbackimage/i.test(html);
    }

    function hasChoiceCross(elem) {
        if (!elem) return false;
        if (elem.classList && (elem.classList.contains('incorrect') || elem.classList.contains('text-danger'))) return true;
        if (elem.querySelector('.fa-remove, .fa-times, .fa-close, .feedbackimage[alt*="Incorrect" i], img[src*="cross"], img[src*="incorrect"], [title*="Incorrect" i], [aria-label*="Incorrect" i], .text-danger, [class*="incorrect" i]')) return true;

        // Clone and strip any toolkit-injected badges
        const clone = elem.cloneNode(true);
        clone.querySelectorAll('.amaes-verified-badge, .amaes-eliminated-badge, .amaes-active-focus-badge, .amaes-review-status-pill, .amaes-review-outcome-banner, .amaes-card-btn-container, .amaes-que-top-toolbar, .amaes-probability-hint, .amaes-shortans-hint, .amaes-select-hint, .amaes-drag-hint, .amaes-unanswered-hint, .amaes-ai-suggested-badge, .amaes-ai-text-badge, .amaes-ai-question-tag').forEach(el => el.remove());

        const text = (clone.innerText || clone.textContent || '');
        if (/[✗✘✕✖]/.test(text)) return true;
        const html = clone.innerHTML || '';
        return /fa-remove|fa-times|alt="Incorrect"|title="Incorrect"|incorrect\.svg/i.test(html);
    }

    function harvestFromReviewDOM(rootDoc, subCode, quizTitle, courseTitle = '') {
        const queList = rootDoc.querySelectorAll('.que');
        if (queList.length === 0) return { success: false, error: 'No questions found on review page', questions: [] };

        let gradeText = '';
        const gradeRow = rootDoc.querySelector('.quizreviewsummary tr:last-child, .quizreviewsummary .grade');
        if (gradeRow) {
            gradeText = gradeRow.innerText.replace(/\s+/g, ' ').trim();
        }

        const harvested = [];
        let correctCount = 0;
        let eliminatedTotal = 0;

        queList.forEach((que, idx) => {
            const qData = extractQuestionData(que);
            if (!qData || !qData.qText) return;

            let rightAnswer = '';
            let isVerified = false;
            const wrongAnswers = [];

            // 1. Check for explicit Moodle .rightanswer box (handles both singular and plural answers)
            const rightElem = que.querySelector('.rightanswer, .outcome .rightanswer');
            if (rightElem) {
                let raw = cleanDOMToAI(rightElem);
                raw = raw.replace(/^The correct answers? (is|are):?\s*['"]?/i, '').replace(/['"]?\s*$/i, '').trim();
                if (raw) {
                    rightAnswer = raw;
                    isVerified = true;
                }
            }

            // 2. Extract choices from all input formats (Radio, Checkbox, Text input, Dropdown, Drag & Drop)
            const checkedInputs = que.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked, input[checked], [aria-checked="true"]');
            const checkedTexts = [];
            checkedInputs.forEach(inp => {
                const label = inp.closest('label') || inp.closest('div.r0, div.r1, [class*="r"]') || inp.parentElement;
                let text = cleanDOMToAI(label);
                text = text.replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                if (text && !checkedTexts.some(c => normalizeChoice(c) === normalizeChoice(text))) checkedTexts.push(text);
            });
            if (checkedTexts.length === 0) {
                const selectedRows = que.querySelectorAll('.answer div.correct, .answer div.selected, .answer label.correct, .answer label.selected');
                selectedRows.forEach(row => {
                    let text = cleanDOMToAI(row).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                    if (text && !checkedTexts.some(c => normalizeChoice(c) === normalizeChoice(text))) checkedTexts.push(text);
                });
            }

            // Text inputs & textareas (e.g. cloze sentences, short answers)
            const textInputs = que.querySelectorAll('input[type="text"], textarea');
            const filledInputTexts = [];
            textInputs.forEach(inp => {
                const val = inp.value ? inp.value.trim() : '';
                if (val) filledInputTexts.push(val);
            });

            // Dropdowns (select elements in matching tables & gapselects)
            const selects = que.querySelectorAll('select');
            const selectedDropdownTexts = [];
            selects.forEach(sel => {
                const opt = sel.options[sel.selectedIndex];
                const optText = (opt && opt.value) ? (opt.text || opt.innerText).trim() : '';
                if (optText && optText !== 'Choose...') {
                    selectedDropdownTexts.push(optText);
                }
            });

            // Drag and drop words into text (ddwtos, ddimageortext, ddmarker)
            const dropZones = que.querySelectorAll('.drop, .dropzone, span.droptarget');
            const placedDropTexts = [];
            dropZones.forEach(dz => {
                const placedText = cleanDOMToAI(dz).replace(/^\[Blank\s*\d+[^\]]*\]/i, '').trim();
                if (placedText && !placedText.startsWith('[Blank')) {
                    placedDropTexts.push(placedText);
                }
            });

            // Parse decimal and arbitrary score (1.00 out of 1.00, 3.40 out of 5.00, 2.10 out of 3.00, 0.00 out of 2.00)
            const gradeInfo = parseMoodleQuestionGrade(que);
            const isFullMark = gradeInfo.isFullMark;
            const isZeroMark = gradeInfo.isZeroMark;
            const isPartialMark = gradeInfo.isPartialMark;

            // Direct per-choice checkmark and cross detection (supports nested fieldsets and all Moodle themes)
            const choiceRows = que.querySelectorAll('.answer div.r0, .answer div.r1, .answer div[class*="r"], .answer fieldset > div, .answer li, .answer tr, .answer label, .answer > div');
            const checkmarkedTexts = [];
            const crossedTexts = [];
            choiceRows.forEach(row => {
                const label = row.querySelector('label') || row;
                let text = cleanDOMToAI(label).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                if (!text) return;
                // Feature 4: Empty choice sanitizer — skip choices with insufficient text after prefix strip
                if (text.length < 2) return;
                if (hasChoiceCheckmark(row) || hasChoiceCheckmark(label)) {
                    if (!checkmarkedTexts.some(c => normalizeChoice(c) === normalizeChoice(text))) {
                        checkmarkedTexts.push(text);
                    }
                } else if (hasChoiceCross(row) || hasChoiceCross(label)) {
                    if (!crossedTexts.some(c => normalizeChoice(c) === normalizeChoice(text))) {
                        crossedTexts.push(text);
                    }
                }
            });

            // If checkmarked choices exist (even on partial scores or multi-answer), harvest them as verified!
            if (checkmarkedTexts.length > 0) {
                rightAnswer = checkmarkedTexts.join(', ');
                isVerified = true;
            }

            // If user got full mark, the selected/entered choice(s) are verified correct!
            if (!rightAnswer && isFullMark) {
                if (checkedTexts.length > 0) {
                    rightAnswer = checkedTexts.length === 1 ? checkedTexts[0] : checkedTexts.join(', ');
                    isVerified = true;
                } else if (filledInputTexts.length > 0) {
                    rightAnswer = filledInputTexts.length === 1 ? filledInputTexts[0] : filledInputTexts.join(', ');
                    isVerified = true;
                } else if (selectedDropdownTexts.length > 0) {
                    rightAnswer = selectedDropdownTexts.length === 1 ? selectedDropdownTexts[0] : selectedDropdownTexts.join(', ');
                    isVerified = true;
                } else if (placedDropTexts.length > 0) {
                    rightAnswer = placedDropTexts.length === 1 ? placedDropTexts[0] : placedDropTexts.join(', ');
                    isVerified = true;
                }
            }

            // Confirmed wrong choices:
            // 1. Explicit red cross choices are always confirmed wrong
            crossedTexts.forEach(txt => {
                const norm = normalizeChoice(txt);
                if (norm && !wrongAnswers.some(w => normalizeChoice(w) === norm)) {
                    wrongAnswers.push(txt);
                }
            });

            // 2. If question was marked INCORRECT (0 marks): the checked/entered choice(s) are confirmed WRONG!
            if (isZeroMark) {
                [...checkedTexts, ...filledInputTexts, ...selectedDropdownTexts, ...placedDropTexts].forEach(txt => {
                    const norm = normalizeChoice(txt);
                    if (norm && !wrongAnswers.some(w => normalizeChoice(w) === norm)) {
                        wrongAnswers.push(txt);
                    }
                });
            }

            // Also check Moodle's per-choice incorrect indicators on non-standard containers
            const incorrectChoiceElems = que.querySelectorAll('.answer div.incorrect, .answer tr.incorrect, .answer li.incorrect, .answer .fa-remove, .answer .fa-times, .drop.incorrect');
            incorrectChoiceElems.forEach(el => {
                const row = el.closest('div.r0, div.r1, tr, li') || el;
                const label = row.querySelector('label') || row;
                let text = cleanDOMToAI(label).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                const norm = normalizeChoice(text);
                if (norm && !wrongAnswers.some(w => normalizeChoice(w) === norm)) {
                    wrongAnswers.push(text);
                }
            });

            // Safety guard: Any verified rightAnswer or checkmarked choice can NEVER be in wrongAnswers!
            const verifiedSet = new Set(checkmarkedTexts.map(c => normalizeChoice(c)));
            if (rightAnswer) {
                verifiedSet.add(normalizeChoice(rightAnswer));
                rightAnswer.split(/[,;&\n]+|\s+and\s+/i).forEach(s => verifiedSet.add(normalizeChoice(s)));
            }
            for (let i = wrongAnswers.length - 1; i >= 0; i--) {
                const wNorm = normalizeChoice(wrongAnswers[i]);
                if (verifiedSet.has(wNorm) || verifiedSet.has(unscriptDigits(wNorm))) {
                    wrongAnswers.splice(i, 1);
                }
            }

            // 3. Real-time Deduction by Elimination on Review screen:
            // If answer is not yet known, but choices are available (e.g. True/False where 1 is wrong, or 4-choice where 3 are wrong)
            let isDeduced = false;
            if (!rightAnswer && wrongAnswers.length > 0 && Array.isArray(qData.choices) && qData.choices.length > 1) {
                const uneliminated = qData.choices.filter(c => {
                    const normC = normalizeChoice(c);
                    return !wrongAnswers.some(w => normalizeChoice(w) === normC);
                });
                if (uneliminated.length === 1) {
                    rightAnswer = uneliminated[0];
                    isVerified = true;
                    isDeduced = true;
                }
            }

            if (rightAnswer || wrongAnswers.length > 0) {
                if (rightAnswer) correctCount++;
                eliminatedTotal += wrongAnswers.length;
                const detectedPeriod = detectTermFromText(quizTitle) || 'General';
                const rightAnswersList = rightAnswer ? rightAnswer.split(/[,;&\n]+|\s+and\s+/i).map(s => s.trim()).filter(Boolean) : [];
                harvested.push({
                    index: idx + 1,
                    qRaw: qData.qText,
                    qNorm: normalizeText(qData.qText),
                    ansRaw: rightAnswer,
                    ansNorm: normalizeChoice(rightAnswer),
                    answers: rightAnswersList.length > 1 ? rightAnswersList : undefined,
                    isMultiChoice: Boolean(qData.isMultiChoice),
                    wrongAnswers: normalizeWrongAnswers(wrongAnswers),
                    choices: qData.choices,
                    verified: isVerified,
                    deduced: isDeduced,
                    evidenceType: isVerified ? 'moodle_review' : 'community_report',
                    period: detectedPeriod,
                    quizTitle: quizTitle
                });
            }
        });

        return {
            success: true,
            course: courseTitle || subCode,
            subjectCode: subCode,
            quizTitle,
            gradeText,
            totalQuestions: queList.length,
            harvestedCount: correctCount,
            eliminatedCount: eliminatedTotal,
            questions: harvested
        };
    }

    function harvestReviewAnswers() {
        const courseInfo = detectCourseInfo();
        const subCode = courseInfo.subjectCode || 'CS6301';
        let quizTitle = courseInfo.currentActivityTitle || 'Quiz Review';
        return harvestFromReviewDOM(document, subCode, quizTitle, courseInfo.fullTitle || subCode);
    }

    function exportAnswersAsJSON(data) {
        const payload = {
            tool: "AMAES Moodle Toolkit",
            version: SCRIPT_VERSION,
            exportedAt: new Date().toISOString(),
            subjectCode: data.subjectCode,
            quizTitle: data.quizTitle,
            grade: data.gradeText,
            totalQuestions: data.totalQuestions,
            answerCount: data.harvestedCount,
            eliminatedCount: data.eliminatedCount || 0,
            questions: data.questions.map(q => ({
                question: q.qRaw,
                answer: q.ansRaw,
                choices: q.choices,
                wrongAnswers: Array.isArray(q.wrongAnswers) ? q.wrongAnswers.map(w => typeof w === 'string' ? w : w.text) : []
            }))
        };
        return JSON.stringify(payload, null, 2);
    }

    // Batched & Debounced Community Contribution Queue
    const pendingContributionBatches = {};
    const pendingContributionTimers = {};

    function queueCommunityContribution(subCode, questions, options = {}) {
        if (!questions || questions.length === 0) return;
        const validQuestions = questions.filter(q => Boolean(q.ansRaw || q.answer || q.correctAnswer));
        if (validQuestions.length === 0) return;

        if (!pendingContributionBatches[subCode]) {
            pendingContributionBatches[subCode] = new Map();
        }

        validQuestions.forEach(q => {
            const key = (typeof getQuestionIdentity === 'function' ? getQuestionIdentity(q) : null) ||
                        normalizeText(q.qRaw || q.question || "");
            if (key) {
                pendingContributionBatches[subCode].set(key, q);
            }
        });

        if (pendingContributionTimers[subCode]) {
            clearTimeout(pendingContributionTimers[subCode]);
        }

        // Ultra-fast 2-second debounce: catches simultaneous page discoveries and shares immediately
        pendingContributionTimers[subCode] = setTimeout(() => {
            flushCommunityContributions(subCode, options);
        }, 2000);
    }

    async function flushCommunityContributions(subCode, options = {}) {
        if (pendingContributionTimers[subCode]) {
            clearTimeout(pendingContributionTimers[subCode]);
            delete pendingContributionTimers[subCode];
        }
        const batchMap = pendingContributionBatches[subCode];
        if (!batchMap || batchMap.size === 0) return;
        const questionsToFlush = Array.from(batchMap.values());
        delete pendingContributionBatches[subCode];
        return dispatchCommunityContribution(subCode, questionsToFlush, options);
    }

    // Dispatch Community Contribution silently in background
    async function dispatchCommunityContribution(subCode, questions, options = {}) {
        if (!questions || questions.length === 0) return;
        const validQuestions = questions.filter(q => {
            const raw = (q.ansRaw || q.answer || q.correctAnswer || '').trim();
            if (!raw) return false;
            // Proven Wrong Guard: If answer was confirmed wrong/eliminated, NEVER share it!
            const norm = normalizeChoice(raw);
            const wrongList = Array.isArray(q.wrongAnswers) ? q.wrongAnswers : [];
            const isProvenWrong = wrongList.some(w => {
                const wNorm = typeof w === 'string' ? normalizeChoice(w) : (w.norm || normalizeChoice(w.text || ''));
                return wNorm === norm || unscriptDigits(wNorm) === unscriptDigits(norm);
            });
            return !isProvenWrong;
        });
        if (validQuestions.length === 0) return;
        const contributionId = options.contributionId || `contribution-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const evidenceType = options.evidenceType || (options.source === 'review_screen' ? 'moodle_review' : 'community_report');

        const detectedCourse = (typeof detectCourseInfo === 'function') ? detectCourseInfo() : null;
        const resolvedName = options.subjectName ||
            (detectedCourse && (detectedCourse.subjectCode === subCode || detectedCourse.code === subCode) && detectedCourse.subjectName) ||
            resolveKnownCourseName(subCode) ||
            subCode;

        const payload = {
            subjectCode: subCode,
            subjectName: resolvedName,
            clientVersion: SCRIPT_VERSION.replace(/^v/i, ''),
            databaseSchema: ANSWER_DB_SCHEMA_VERSION,
            totalQuestions: validQuestions.length,
            source: options.source || "auto_harvester",
            evidenceType,
            contributionId,
            contributorId: getAnonymousContributorId(),
            submittedAt: new Date().toISOString(),
            questions: validQuestions.map(q => ({
                question: q.qRaw || q.question || "",
                answer: q.ansRaw || q.answer || "",
                choices: q.choices || [],
                wrongAnswers: Array.isArray(q.wrongAnswers) ? q.wrongAnswers.map(w => typeof w === 'string' ? w : w.text) : [],
                verified: Boolean(q.verified),
                isAiSuggestion: Boolean(q.isAiSuggestion || (q.source && String(q.source).toLowerCase().includes('gemini'))),
                source: q.source || options.source || "auto_harvester",
                evidenceType: q.evidenceType || (q.isAiSuggestion || (q.source && String(q.source).toLowerCase().includes('gemini')) ? 'ai_inference' : evidenceType)
            }))
        };

        logDebug(`Dispatching ${validQuestions.length} answers to community relay...`);

        if (communityRelayUrl) {
            const gmReq = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                          (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

            if (gmReq) {
                try {
                    gmReq({
                        method: 'POST',
                        url: communityRelayUrl,
                        headers: {
                            'Content-Type': 'application/json',
                            'X-AMAES-Client-Version': SCRIPT_VERSION.replace(/^v/i, '')
                        },
                        data: JSON.stringify(payload),
                        onload: (res) => {
                            if (res.status >= 200 && res.status < 300) {
                                showToast(`Auto-shared ${validQuestions.length} verified answers to Global Database!`);
                                setLog(`Shared <b>${validQuestions.length}</b> evidence records to Global Database via relay.`, "var(--accent-green)");
                            } else {
                                logDebug(`Community relay response status: ${res.status}`);
                            }
                        },
                        onerror: (err) => {
                            logDebug("GM relay post error:", err);
                        }
                    });
                    return { success: true, mode: 'relay_gm', count: validQuestions.length };
                } catch (gmErr) {
                    logDebug(`GM relay exception: ${gmErr.message}`);
                }
            } else {
                try {
                    const resp = await fetch(communityRelayUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-AMAES-Client-Version': SCRIPT_VERSION.replace(/^v/i, '')
                        },
                        body: JSON.stringify(payload)
                    });
                    if (resp.status === 426) {
                        const update = await resp.json().catch(() => ({}));
                        showToast(`Update AMAES Toolkit to v${update.minimumVersion || 'the latest version'} to share answers.`, 7000);
                        setLog(`Toolkit update required before community sharing. <a href="${SCRIPT_RAW_URL}" target="_blank">Install update</a>.`, "var(--accent-amber)");
                    } else if (resp.ok) {
                        showToast(`Auto-shared ${validQuestions.length} verified answers to Global Database!`);
                        setLog(`Shared <b>${validQuestions.length}</b> evidence records to Global Database via relay.`, "var(--accent-green)");
                        return { success: true, mode: 'relay', count: validQuestions.length };
                    }
                } catch (err) {
                    logDebug(`Relay background post note: ${err.message}`);
                }
            }
        }

        // Silent local save notice
        showToast(`Saved ${validQuestions.length} verified answers to local database!`, 3000);
        return { success: true, mode: 'local', count: validQuestions.length };
    }

    // Background Grades Report Answer Harvester
    let isHarvestingInProgress = false;

    async function harvestQuizzesFromGradesDoc(gradesDoc, targetSubCode, courseTitle, statusCallback) {
        let subCode = targetSubCode;

        const table = gradesDoc.querySelector('.user-grade, table[summary="User report"], .generaltable');
        if (!table) {
            return { success: false, error: 'No grade table found', count: 0 };
        }

        if (!subCode || subCode === 'DEFAULT' || subCode === 'GENERAL') {
            const catHeaders = table.querySelectorAll('th.category, tr.category, h2, h3, .cat_1');
            for (const h of catHeaders) {
                const m = (h.innerText || '').match(/(?:UGRD-|UGRD_)?([A-Z]{2,6}\d{3,4}[A-Z]?)/i);
                if (m) {
                    subCode = m[1].toUpperCase();
                    break;
                }
            }
        }
        if (!subCode || subCode === 'DEFAULT') {
            subCode = 'GENERAL';
        }

        // Scan all candidate rows across document or tables
        const candidateRows = Array.from(gradesDoc.querySelectorAll('.user-grade tr, .generaltable tr, table.table tr, tr'));
        const completedQuizzes = [];
        const seenUrls = new Set();

        candidateRows.forEach(r => {
            const quizLink = r.querySelector('a[href*="/mod/quiz/"], a[href*="quiz"], a.gradeitemheader')
                          || r.querySelector('.column-itemname a, th a, td:first-child a');
            if (!quizLink) return;

            const href = quizLink.getAttribute('href') || quizLink.href || '';
            const rawTitle = quizLink.innerText.trim();
            if (!rawTitle || (!href.includes('quiz') && !r.innerText.toLowerCase().includes('quiz'))) return;

            // Prevent empty or unattempted rows
            const rowText = r.innerText || '';
            if (rowText.includes('( Empty )') || rowText.includes('(Empty)') || rowText.includes('( empty )')) return;

            let fullQuizUrl = '';
            try {
                fullQuizUrl = new URL(href, window.location.origin).href;
            } catch (e) {
                fullQuizUrl = href;
            }
            if (!fullQuizUrl || seenUrls.has(fullQuizUrl)) return;

            // Determine if the quiz has a completed grade
            const gradeCell = r.querySelector('.column-grade, [headers*="grade"], td.grade');
            const pctCell = r.querySelector('.column-percentage, [headers*="percentage"]');

            let hasGrade = false;
            let gradeStr = '';

            if (gradeCell) {
                const gText = gradeCell.innerText.trim();
                if (gText && gText !== '-' && gText !== '–' && /\d/.test(gText)) {
                    hasGrade = true;
                    gradeStr = gText;
                }
            }

            if (!hasGrade && pctCell) {
                const pText = pctCell.innerText.trim();
                if (pText && pText !== '-' && pText !== '–' && !pText.includes('0.00') && /\d/.test(pText)) {
                    hasGrade = true;
                    gradeStr = pText;
                }
            }

            if (!hasGrade) {
                const cells = Array.from(r.querySelectorAll('td, th'));
                for (const c of cells) {
                    if (c.contains(quizLink)) continue;
                    const txt = c.innerText.trim();
                    if (txt && txt !== '-' && txt !== '–' && !txt.includes('( Empty )') && !txt.includes('0.00 %') && !txt.startsWith('0-') && !txt.startsWith('0–') && /\b\d+(\.\d+)?\b/.test(txt)) {
                        hasGrade = true;
                        gradeStr = txt;
                        break;
                    }
                }
            }

            if (hasGrade) {
                seenUrls.add(fullQuizUrl);
                const cleanTitle = rawTitle.replace(/^QUIZ\s+/i, '').replace(/\s+/g, ' ').trim();
                completedQuizzes.push({
                    title: cleanTitle || rawTitle,
                    url: fullQuizUrl,
                    grade: gradeStr
                });
            }
        });

        if (completedQuizzes.length === 0) {
            return { success: false, count: 0, quizzes: 0, subCode };
        }

        let totalHarvested = 0;
        let allQuestions = [];

        for (let i = 0; i < completedQuizzes.length; i++) {
            const qz = completedQuizzes[i];
            if (statusCallback) statusCallback(i + 1, completedQuizzes.length, qz.title);
            setLog(`[${i + 1}/${completedQuizzes.length}] Opening <b>${qz.title}</b> (${subCode} Score: ${qz.grade})...`, "var(--accent-cyan)", `Harvesting verified answer key`);

            try {
                const viewResp = await fetch(qz.url);
                if (!viewResp.ok) continue;
                const viewHtml = await viewResp.text();
                const viewDoc = new DOMParser().parseFromString(viewHtml, 'text/html');

                const reviewLinks = Array.from(viewDoc.querySelectorAll(
                    'a[href*="review.php"], a[href*="/mod/quiz/review.php"], a[href*="/mod/quiz/attempt.php"][href*="review"]'
                ));
                // Some Moodle themes put the review URL directly in the grade row.
                if (reviewLinks.length === 0 && /\/mod\/quiz\/review\.php/i.test(qz.url)) {
                    reviewLinks.push({ getAttribute: () => qz.url, href: qz.url });
                }
                if (reviewLinks.length === 0) continue;

                const seenReviewUrls = new Set();
                const reviewQueue = reviewLinks.map(rLink => {
                    const raw = rLink.getAttribute('href') || rLink.href;
                    return raw ? new URL(raw, qz.url).href : '';
                }).filter(Boolean);

                // Some Moodle themes ignore showall=1, so keep a queue for
                // pagination links discovered in each fetched review page.
                for (let queueIndex = 0; queueIndex < reviewQueue.length; queueIndex++) {
                    const queuedUrl = reviewQueue[queueIndex];
                    const rLink = { getAttribute: () => queuedUrl, href: queuedUrl };
                    const rawHref = rLink.getAttribute('href') || rLink.href;
                    if (!rawHref) continue;

                    let reviewUrl = '';
                    try {
                        reviewUrl = new URL(rawHref, qz.url).href;
                    } catch (e) {
                        reviewUrl = rawHref;
                    }

                    const reviewUrlObj = new URL(reviewUrl, qz.url);
                    reviewUrlObj.searchParams.set('showall', '1');
                    reviewUrl = reviewUrlObj.href;

                    if (seenReviewUrls.has(reviewUrl)) continue;
                    seenReviewUrls.add(reviewUrl);

                    const reviewResp = await fetch(reviewUrl);
                    if (!reviewResp.ok) continue;
                    const reviewHtml = await reviewResp.text();
                    const reviewDoc = new DOMParser().parseFromString(reviewHtml, 'text/html');

                    const res = harvestFromReviewDOM(reviewDoc, subCode, qz.title, courseTitle || subCode);
                    if (res.success && res.questions.length > 0) {
                        const knownQuestionKeys = new Set(allQuestions.map(getQuestionIdentity));
                        res.questions.forEach(question => {
                            if (!question.qNorm) return;
                            const questionKey = getQuestionIdentity(question);
                            if (knownQuestionKeys.has(questionKey)) return;
                            knownQuestionKeys.add(questionKey);
                            allQuestions.push(question);
                            totalHarvested += question.ansRaw ? 1 : 0;
                        });
                    }

                    // If showall is ignored, enqueue every review page link
                    // found in the fetched document.
                    reviewDoc.querySelectorAll('a[href*="review.php"], a[href*="/mod/quiz/review.php"]').forEach(pageLink => {
                        const href = pageLink.getAttribute('href') || pageLink.href;
                        if (!href) return;
                        const pageUrl = new URL(href, qz.url);
                        pageUrl.searchParams.delete('showall');
                        const pageHref = pageUrl.href;
                        if (!reviewQueue.includes(pageHref)) reviewQueue.push(pageHref);
                    });
                }
            } catch (err) {
                console.warn(`Error harvesting ${qz.title}:`, err);
            }
        }

        if (allQuestions.length > 0) {
            mergeAnswersIntoCache(subCode, allQuestions, 'Grades-Harvester');
            flushCommunityContributions(subCode, { source: 'grades_harvester' }).catch(() => {});
            return { success: true, count: totalHarvested, quizzes: completedQuizzes.length, subCode };
        }

        return { success: false, count: 0, quizzes: completedQuizzes.length, subCode };
    }

    async function executeGradesHarvester(statusCallback) {
        if (isHarvestingInProgress) {
            showToast("Answer collection is already running in background...", 2500);
            return { success: false, inProgress: true };
        }
        isHarvestingInProgress = true;

        try {
            const isDirectGradesPage = window.location.pathname.includes('/grade/report/user/index.php');
            const isDashboard = window.location.pathname.includes('/my/') || window.location.pathname.includes('courses.php');
            const courseInfo = detectCourseInfo();

            // Scenario 1: Directly on a Grade Report page
            if (isDirectGradesPage) {
                setLog("Scanning current Grade Report for completed quizzes...", "var(--accent-blue)", "Analyzing grade items");
                const res = await harvestQuizzesFromGradesDoc(document, courseInfo.subjectCode, courseInfo.fullTitle, statusCallback);
                if (res.success && res.count > 0) {
                    setLog(`Collection Complete! Loaded <b>${res.count}</b> verified answers into <b>${res.subCode}</b> DB.`, "var(--accent-green)", "Saved to local database");
                    showToast(`Collected ${res.count} verified answers! Saved to database.`, 4000);
                    syncAutoQuizUI();
                    return res;
                } else {
                    setLog("Grade report scan finished. No accessible reviews found or already cached.", "var(--accent-amber)", "Reviews may be restricted by instructor");
                    showToast("No new answers collected from this grade report.");
                    return res;
                }
            }

            // Scenario 2: Inside a specific course or quiz page (courseId is known)
            let singleGradesUrl = null;
            const gradesLink = document.querySelector('a[href*="/grade/report/user/index.php"]');
            if (gradesLink && gradesLink.href) {
                singleGradesUrl = gradesLink.href;
            } else if (courseInfo.courseId) {
                const semPath = getSemesterBasePath();
                singleGradesUrl = `${window.location.origin}${semPath}grade/report/user/index.php?id=${courseInfo.courseId}`;
            }

            if (singleGradesUrl && !isDashboard) {
                setLog(`Fetching course Grade Report for <b>${courseInfo.subjectCode || 'course'}</b>...`, "var(--accent-blue)", "Accessing grade history");
                showToast("Fetching course Grade Report in background...", 2500);

                try {
                    const resp = await fetch(singleGradesUrl);
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const html = await resp.text();
                    const gradesDoc = new DOMParser().parseFromString(html, 'text/html');

                    const res = await harvestQuizzesFromGradesDoc(gradesDoc, courseInfo.subjectCode, courseInfo.fullTitle, statusCallback);
                    if (res.success && res.count > 0) {
                        setLog(`Collection Complete! Loaded <b>${res.count}</b> verified answers into <b>${res.subCode}</b> DB.`, "var(--accent-green)", "Saved to local database");
                        showToast(`Collected ${res.count} verified answers! Saved to database.`, 4000);
                        syncAutoQuizUI();
                        return res;
                    } else {
                        setLog("Grade report scan complete. No new accessible reviews found.", "var(--accent-amber)", "Quizzes may not have review attempts available");
                        showToast("No accessible quiz reviews found to collect for this course.");
                        return res;
                    }
                } catch (e) {
                    showToast("Could not fetch Grade Report: " + e.message);
                    setLog(`Grade Report fetch error: ${e.message}`, "var(--accent-pink)", "Check course permissions");
                    return { success: false, error: e.message };
                }
            }

            // Scenario 3: On Dashboard or Multi-Course View
            const dashCourses = detectDashboardCourses().filter(c => c.courseId || c.gradesUrl);
            if (dashCourses.length > 0) {
                setLog(`Scanning Grade Reports for <b>${dashCourses.length} enrolled courses</b>...`, "var(--accent-blue)", "Batch collecting past semester quizzes");
                showToast(`Scanning grade reports for ${dashCourses.length} enrolled courses...`, 3000);

                let totalHarvested = 0;
                let totalQuizzes = 0;

                for (let i = 0; i < dashCourses.length; i++) {
                    const c = dashCourses[i];
                    const gradesUrl = c.gradesUrl || `${window.location.origin}${getSemesterBasePath()}grade/report/user/index.php?id=${c.courseId}`;
                    if (statusCallback) statusCallback(i + 1, dashCourses.length, `Course: ${c.code}`);
                    setLog(`[${i + 1}/${dashCourses.length}] Scanning <b>${c.code}</b> Grade Report...`, "var(--accent-cyan)", `Checking completed quizzes for ${c.code}`);

                    try {
                        const resp = await fetch(gradesUrl);
                        if (!resp.ok) continue;
                        const html = await resp.text();
                        const gDoc = new DOMParser().parseFromString(html, 'text/html');
                        const res = await harvestQuizzesFromGradesDoc(gDoc, c.code, c.title, (curQ, totQ, qTitle) => {
                            if (statusCallback) statusCallback(i + 1, dashCourses.length, `[${curQ}/${totQ}] ${qTitle}`);
                        });
                        if (res.success && res.count > 0) {
                            totalHarvested += res.count;
                            totalQuizzes += res.quizzes || 0;
                        }
                    } catch (err) {
                        logDebug(`Error scanning grades for ${c.code}: ${err.message}`);
                    }
                }

                if (totalHarvested > 0) {
                    setLog(`Collection Complete! Loaded <b>${totalHarvested}</b> verified answers across ${dashCourses.length} courses.`, "var(--accent-green)", "All enrolled subjects updated in database");
                    showToast(`Collection complete! Loaded ${totalHarvested} verified answers across ${dashCourses.length} courses!`, 4500);
                    injectDashboardCourseBadges();
                    syncAutoQuizUI();
                    return { success: true, count: totalHarvested, quizzes: totalQuizzes, courses: dashCourses.length };
                } else {
                    setLog(`Scanned ${dashCourses.length} courses. All available answers already cached or reviews restricted.`, "var(--accent-cyan)", "Answers ready in local database");
                    showToast(`Scan complete for ${dashCourses.length} courses. All up to date!`, 3500);
                    injectDashboardCourseBadges();
                    return { success: true, count: 0, courses: dashCourses.length };
                }
            }

            // Fallback: If no course can be identified
            showToast("Open a course or your Dashboard first to scan completed quizzes!", 3500);
            setLog("<b>Collection Unavailable:</b> Open a course or your Dashboard first.", "var(--accent-pink)", "Plan: Go to Dashboard or Course page to collect answers");
            return { success: false, error: 'No course or dashboard found' };

        } catch (e) {
            showToast("Collection error: " + e.message);
            setLog(`Collection error: ${e.message}`, "var(--accent-pink)", "Check network or permissions");
            return { success: false, error: e.message };
        } finally {
            isHarvestingInProgress = false;
        }
    }



    function escapeHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function injectReviewQuestionMarkers(harvestedData = null) {
        if (!checkIsReviewPage()) return;
        const queList = document.querySelectorAll('.que');
        if (queList.length === 0) return;

        const courseInfo = detectCourseInfo();
        const subCode = (harvestedData && harvestedData.subjectCode) ? harvestedData.subjectCode : (courseInfo.subjectCode || 'CS6301');
        const cachedDb = getCachedAnswers(subCode);
        const autoShareEnabled = localStorage.getItem('amaes_auto_community_share') !== 'false';
        const autoPushEnabled = localStorage.getItem('amaes_auto_push_github') === 'true' && Boolean(localStorage.getItem('amaes_github_token'));
        const isCloudSharingOn = autoShareEnabled || autoPushEnabled;

        queList.forEach((que) => {
            const qData = extractQuestionData(que);
            if (!qData || !qData.qText) return;
            const qNorm = normalizeText(qData.qText);

            // Find matching item in harvested list or cached DB
            const harvestedItem = harvestedData && harvestedData.questions ?
                harvestedData.questions.find(q => q.qNorm === qNorm || (qData.qText && qData.qText.includes(q.qRaw))) : null;
            const dbEntry = cachedDb.find(q => q.qNorm === qNorm || (qData.qText && qData.qText.includes(q.qRaw)));

            const gradeInfo = parseMoodleQuestionGrade(que);
            const isFullMark = gradeInfo.isFullMark;
            const isZeroMark = gradeInfo.isZeroMark;
            const isPartialMark = gradeInfo.isPartialMark;

            const rightElem = que.querySelector('.rightanswer, .outcome .rightanswer');
            const hasExplicitRightElem = Boolean(rightElem && rightElem.innerText.trim());

            let ansText = (harvestedItem && harvestedItem.ansRaw) || (dbEntry && (dbEntry.ansRaw || dbEntry.answer)) || '';

            // Check choice rows directly for checkmarks (Moodle review ground truth!)
            const choiceRows = que.querySelectorAll('.answer div.r0, .answer div.r1, .answer div[class*="r"], .answer fieldset > div, .answer li, .answer tr, .answer label, .answer > div');
            const checkmarkedTexts = [];
            choiceRows.forEach(row => {
                const label = row.querySelector('label') || row;
                let text = cleanDOMToAI(label).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                if (!text) return;
                if (hasChoiceCheckmark(row) || hasChoiceCheckmark(label)) {
                    if (!checkmarkedTexts.some(c => normalizeChoice(c) === normalizeChoice(text))) {
                        checkmarkedTexts.push(text);
                    }
                }
            });

            if (checkmarkedTexts.length > 0) {
                ansText = checkmarkedTexts.join(', ');
            }

            // If question scored full marks but ansText wasn't in cache, extract directly from live DOM!
            if (!ansText && isFullMark) {
                const textInput = que.querySelector('input[type="text"], textarea, .form-control');
                if (textInput && (textInput.value || textInput.getAttribute('value'))) {
                    ansText = (textInput.value || textInput.getAttribute('value')).trim();
                }
                const checked = que.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked, input[checked], [aria-checked="true"], .answer div.selected, .answer div.correct, .answer [class*="selected"], .answer [class*="checked"]');
                if (!ansText && checked) {
                    const lbl = checked.closest('label') || checked.closest('div.r0, div.r1, [class*="r"]') || checked.parentElement;
                    if (lbl) ansText = cleanDOMToAI(lbl).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                }
                const selected = que.querySelector('select');
                if (!ansText && selected && selected.selectedIndex >= 0) {
                    const opt = selected.options[selected.selectedIndex];
                    if (opt && opt.value && !opt.text.toLowerCase().includes('choose')) {
                        ansText = opt.text.trim();
                    }
                }
            }

            // Extract explicit right answer from outcome if present
            if (rightElem && !checkmarkedTexts.length) {
                let raw = cleanDOMToAI(rightElem);
                raw = raw.replace(/^The correct answers? (is|are):?\s*['"]?/i, '').replace(/['"]?\s*$/i, '').trim();
                if (raw) {
                    ansText = raw;
                }
            }

            const wrongList = (harvestedItem && harvestedItem.wrongAnswers) || (dbEntry && dbEntry.wrongAnswers) || [];
            const wrongNorms = wrongList.map(w => typeof w === 'string' ? normalizeChoice(w) : (w.norm || normalizeChoice(w.text || '')));

            // Detect any selected choice that was marked wrong (red cross or zero mark)
            const crossedTexts = [];
            choiceRows.forEach(row => {
                const label = row.querySelector('label') || row;
                let text = cleanDOMToAI(label).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                if (!text) return;
                if (hasChoiceCross(row) || hasChoiceCross(label)) {
                    if (!crossedTexts.some(c => normalizeChoice(c) === normalizeChoice(text))) {
                        crossedTexts.push(text);
                    }
                }
            });
            if (isZeroMark) {
                const checkedInputs = que.querySelectorAll('input[type="radio"]:checked, input[type="checkbox"]:checked, input[checked], [aria-checked="true"], .answer div.selected, .answer label.selected');
                checkedInputs.forEach(inp => {
                    const label = inp.closest('label') || inp.closest('div.r0, div.r1, [class*="r"]') || inp.parentElement;
                    let text = cleanDOMToAI(label).replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                    if (text && !crossedTexts.some(c => normalizeChoice(c) === normalizeChoice(text))) {
                        crossedTexts.push(text);
                    }
                });
            }
            crossedTexts.forEach(txt => {
                const norm = normalizeChoice(txt);
                if (norm && !wrongNorms.includes(norm)) {
                    wrongList.push(txt);
                    wrongNorms.push(norm);
                }
            });

            const ansNorm = normalizeChoice(ansText);
            const isConfirmedByMoodle = Boolean(isFullMark || hasExplicitRightElem || checkmarkedTexts.length > 0);

            let isDebunked = false;
            if (isConfirmedByMoodle && ansNorm) {
                isDebunked = false;
                // Moodle's grade / checkmark is absolute supreme truth!
                // Purge any contradictory wrongAnswer distractor from wrongList and cache!
                const verifiedNormsList = checkmarkedTexts.map(c => normalizeChoice(c));
                verifiedNormsList.push(ansNorm);
                ansText.split(/[,;&\n]+|\s+and\s+/i).forEach(s => verifiedNormsList.push(normalizeChoice(s)));

                for (let i = wrongList.length - 1; i >= 0; i--) {
                    const wNorm = typeof wrongList[i] === 'string' ? normalizeChoice(wrongList[i]) : (wrongList[i].norm || normalizeChoice(wrongList[i].text || ''));
                    if (verifiedNormsList.some(v => v === wNorm || unscriptDigits(v) === unscriptDigits(wNorm))) {
                        wrongList.splice(i, 1);
                    }
                }
                if (harvestedItem && Array.isArray(harvestedItem.wrongAnswers)) {
                    harvestedItem.wrongAnswers = harvestedItem.wrongAnswers.filter(w => {
                        const wNorm = typeof w === 'string' ? normalizeChoice(w) : (w.norm || normalizeChoice(w.text || ''));
                        return !verifiedNormsList.some(v => v === wNorm || unscriptDigits(v) === unscriptDigits(wNorm));
                    });
                    harvestedItem.ansRaw = ansText;
                    harvestedItem.ansNorm = ansNorm;
                    harvestedItem.verified = true;
                }
                if (dbEntry) {
                    if (Array.isArray(dbEntry.wrongAnswers)) {
                        dbEntry.wrongAnswers = dbEntry.wrongAnswers.filter(w => {
                            const wNorm = typeof w === 'string' ? normalizeChoice(w) : (w.norm || normalizeChoice(w.text || ''));
                            return !verifiedNormsList.some(v => v === wNorm || unscriptDigits(v) === unscriptDigits(wNorm));
                        });
                    }
                    dbEntry.ansRaw = ansText;
                    dbEntry.ansNorm = ansNorm;
                    dbEntry.verified = true;
                    if (cachedDb && cachedDb.length > 0) {
                        setCachedAnswers(subCode, cachedDb);
                    }
                }
            } else if (ansNorm && wrongNorms.some(w => w === ansNorm || unscriptDigits(w) === unscriptDigits(ansNorm))) {
                isDebunked = true;
                ansText = '';
                if (dbEntry) {
                    dbEntry.ansRaw = '';
                    dbEntry.ansNorm = '';
                    dbEntry.verified = false;
                    dbEntry.wrongAnswers = wrongList;
                    if (cachedDb && cachedDb.length > 0) {
                        setCachedAnswers(subCode, cachedDb);
                    }
                }
                if (harvestedItem) {
                    harvestedItem.ansRaw = '';
                    harvestedItem.ansNorm = '';
                    harvestedItem.verified = false;
                    harvestedItem.wrongAnswers = wrongList;
                }
            }

            // Ground-truth debunking: If question scored zero mark and Moodle revealed neither checkmarks nor right answer:
            if (isZeroMark && !isFullMark && checkmarkedTexts.length === 0 && !hasExplicitRightElem) {
                // If ansText matches any crossed choice or was the submitted choice, it is completely debunked
                if (ansNorm && (wrongNorms.some(w => w === ansNorm || unscriptDigits(w) === unscriptDigits(ansNorm)) || crossedTexts.some(c => normalizeChoice(c) === ansNorm))) {
                    isDebunked = true;
                    ansText = '';
                    if (dbEntry) {
                        dbEntry.ansRaw = '';
                        dbEntry.ansNorm = '';
                        dbEntry.verified = false;
                        dbEntry.wrongAnswers = wrongList;
                        if (cachedDb && cachedDb.length > 0) {
                            setCachedAnswers(subCode, cachedDb);
                        }
                    }
                    if (harvestedItem) {
                        harvestedItem.ansRaw = '';
                        harvestedItem.ansNorm = '';
                        harvestedItem.verified = false;
                        harvestedItem.wrongAnswers = wrongList;
                    }
                }
            }

            // Real-time Deduction by Elimination on Review screen
            let isDeduced = Boolean((harvestedItem && harvestedItem.deduced) || (dbEntry && dbEntry.deduced));
            if (!ansText && wrongNorms.length > 0 && Array.isArray(qData.choices) && qData.choices.length > 1) {
                const uneliminated = qData.choices.filter(c => {
                    const normC = normalizeChoice(c);
                    return !wrongNorms.some(w => w === normC || unscriptDigits(w) === unscriptDigits(normC));
                });
                if (uneliminated.length === 1) {
                    ansText = uneliminated[0].replace(/^[a-zA-Z0-9][.)]\s*/, '').trim();
                    isDeduced = true;
                    isDebunked = false;
                    if (dbEntry) {
                        dbEntry.ansRaw = ansText;
                        dbEntry.ansNorm = normalizeChoice(ansText);
                        dbEntry.answer = ansText;
                        dbEntry.verified = true;
                        dbEntry.deduced = true;
                        dbEntry.wrongAnswers = wrongList;
                        if (cachedDb && cachedDb.length > 0) {
                            setCachedAnswers(subCode, cachedDb);
                        }
                    }
                    if (harvestedItem) {
                        harvestedItem.ansRaw = ansText;
                        harvestedItem.ansNorm = normalizeChoice(ansText);
                        harvestedItem.verified = true;
                        harvestedItem.deduced = true;
                        harvestedItem.wrongAnswers = wrongList;
                    }
                }
            }

            const hasMoodleOrDeducedProof = isConfirmedByMoodle || isDeduced;
            const isVerified = Boolean(!isDebunked && ansText && (hasMoodleOrDeducedProof || (!isZeroMark && ((harvestedItem && harvestedItem.verified) || (dbEntry && dbEntry.verified)))));

            const infoCol = que.querySelector('.info');
            const contentCol = que.querySelector('.content');

            // 1. Sidebar Info Badge (Left box under Grade / Flag question)
            let pill = que.querySelector('.amaes-review-status-pill');
            if (!pill) {
                pill = document.createElement('div');
                pill.className = 'amaes-review-status-pill';
                const flagBox = que.querySelector('.info .questionflag, .info .state');
                if (flagBox) {
                    flagBox.parentNode.insertBefore(pill, flagBox.nextSibling);
                } else if (infoCol) {
                    infoCol.appendChild(pill);
                }
            }

            if (isVerified && ansText) {
                if (isCloudSharingOn) {
                    pill.style.cssText = `
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        padding: 4px 8px;
                        margin-top: 6px;
                        border-radius: 6px;
                        font-size: 11px;
                        font-weight: 700;
                        line-height: 1.25;
                        background: rgba(16, 185, 129, 0.14);
                        color: #059669;
                        border: 1px solid rgba(16, 185, 129, 0.4);
                        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                        cursor: default;
                    `;
                    pill.title = `Correct answer "${ansText}" saved to Study Bank for your next attempt and classmates!`;
                    pill.innerHTML = `${ICONS.cloudUpload || ICONS.cloud} <span>${isDeduced ? 'Deduced & Saved' : 'Saved to Study Bank'}</span>`;
                } else {
                    pill.style.cssText = `
                        display: inline-flex;
                        align-items: center;
                        gap: 5px;
                        padding: 4px 8px;
                        margin-top: 6px;
                        border-radius: 6px;
                        font-size: 11px;
                        font-weight: 700;
                        line-height: 1.25;
                        background: rgba(59, 130, 246, 0.14);
                        color: #2563eb;
                        border: 1px solid rgba(59, 130, 246, 0.4);
                        box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                        cursor: default;
                    `;
                    pill.title = `Correct answer "${ansText}" saved locally (Community sharing toggle is OFF)`;
                    pill.innerHTML = `${ICONS.database} <span>${isDeduced ? 'Deduced Locally' : 'Saved Locally'}</span>`;
                }

                // 2. In-Question Outcome Banner
                let outcomeBox = que.querySelector('.outcome');
                if (!outcomeBox) {
                    const formulationBox = que.querySelector('.formulation, .content');
                    if (formulationBox) {
                        outcomeBox = document.createElement('div');
                        outcomeBox.className = 'outcome clearfix';
                        formulationBox.appendChild(outcomeBox);
                    }
                }
                if (outcomeBox) {
                    let banner = outcomeBox.querySelector('.amaes-review-outcome-banner');
                    if (!banner) {
                        banner = document.createElement('div');
                        banner.className = 'amaes-review-outcome-banner';
                        outcomeBox.appendChild(banner);
                    }
                    banner.style.cssText = `
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        margin-top: 8px;
                        padding: 6px 12px;
                        border-radius: 6px;
                        font-size: 11.5px;
                        font-weight: 600;
                        background: ${isCloudSharingOn ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)'};
                        border: 1px solid ${isCloudSharingOn ? 'rgba(16, 185, 129, 0.35)' : 'rgba(59, 130, 246, 0.35)'};
                        color: ${isCloudSharingOn ? '#065f46' : '#1e40af'};
                    `;
                    banner.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            ${isCloudSharingOn ? (ICONS.cloudUpload || ICONS.cloud) : ICONS.database}
                            <span><b>${isDeduced ? 'Deduced' : 'Verified'} Answer${checkmarkedTexts.length > 1 ? 's' : ''}:</b> &ldquo;${escapeHtml(ansText)}&rdquo;${(isPartialMark && gradeInfo.earned !== null && gradeInfo.max !== null) ? ` (Partial: ${gradeInfo.earned}/${gradeInfo.max})` : ''}</span>
                        </div>
                        <span style="font-size: 10px; padding: 2px 7px; border-radius: 4px; font-weight: 700; white-space: nowrap; background: ${isCloudSharingOn ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.25)'};">
                            ${isCloudSharingOn ? 'Saved to Study Bank' : 'Saved Locally'}
                        </span>
                    `;
                }
            } else if (isZeroMark && !isFullMark && checkmarkedTexts.length === 0) {
                pill.style.cssText = `
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 8px;
                    margin-top: 6px;
                    border-radius: 6px;
                    font-size: 11px;
                    font-weight: 700;
                    line-height: 1.25;
                    background: rgba(239, 68, 68, 0.14);
                    color: #dc2626;
                    border: 1px solid rgba(239, 68, 68, 0.4);
                    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
                    cursor: default;
                `;
                const wrongText = wrongList.map(w => typeof w === 'string' ? w : w.text).filter(Boolean).join(', ');
                const isEmptyAnswer = !wrongText; // e.g. user cleared a fill-in-the-blank field
                const pillLabel = isEmptyAnswer ? 'No Answer / Incorrect' : 'Wrong Choice Saved';
                pill.title = isEmptyAnswer
                    ? 'No answer was submitted or the answer field was cleared. Check the verified answer below.'
                    : `Wrong choice "${wrongText}" eliminated in database. Will not be selected on next attempt!`;
                pill.innerHTML = `${ICONS.xCircle} <span>${pillLabel}</span>`;

                // Try to get the correct answer from the .rightanswer element for display
                const rightAnswerForDisplay = (() => {
                    const re = que.querySelector('.rightanswer, .outcome .rightanswer');
                    if (!re) return '';
                    return cleanDOMToAI(re).replace(/^The correct answers? (is|are):?\s*['"]/i, '').replace(/['"]?\s*$/i, '').trim();
                })();

                const outcomeBox = que.querySelector('.outcome');
                if (outcomeBox || isEmptyAnswer) {
                    let targetBox = outcomeBox;
                    if (!targetBox) {
                        const formulationBox = que.querySelector('.formulation, .content');
                        if (formulationBox) {
                            targetBox = document.createElement('div');
                            targetBox.className = 'outcome clearfix';
                            formulationBox.appendChild(targetBox);
                        }
                    }
                    if (targetBox) {
                        let banner = targetBox.querySelector('.amaes-review-outcome-banner');
                        if (!banner) {
                            banner = document.createElement('div');
                            banner.className = 'amaes-review-outcome-banner';
                            targetBox.appendChild(banner);
                        }
                        banner.style.cssText = `
                            display: flex;
                            align-items: center;
                            justify-content: space-between;
                            gap: 8px;
                            margin-top: 8px;
                            padding: 6px 12px;
                            border-radius: 6px;
                            font-size: 11.5px;
                            font-weight: 600;
                            background: rgba(239, 68, 68, 0.12);
                            border: 1px solid rgba(239, 68, 68, 0.35);
                            color: #991b1b;
                        `;
                        if (isEmptyAnswer) {
                            banner.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${ICONS.xCircle}
                                    <span><b>Incorrect / No Answer Submitted</b>${rightAnswerForDisplay ? ` — Correct: &ldquo;${escapeHtml(rightAnswerForDisplay)}&rdquo;` : ''}</span>
                                </div>
                                <span style="font-size: 10px; padding: 2px 7px; border-radius: 4px; font-weight: 700; white-space: nowrap; background: rgba(239, 68, 68, 0.25);">
                                    Incorrect
                                </span>
                            `;
                        } else {
                            banner.innerHTML = `
                                <div style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${ICONS.xCircle}
                                    <span><b>Eliminated:</b> &ldquo;${escapeHtml(wrongText)}&rdquo; (Confirmed Incorrect)</span>
                                </div>
                                <span style="font-size: 10px; padding: 2px 7px; border-radius: 4px; font-weight: 700; white-space: nowrap; background: rgba(239, 68, 68, 0.25);">
                                    Eliminated
                                </span>
                            `;
                        }
                    }
                }
            }

            // ── Review Card Border Highlight ──────────────────────────────────────
            // Visually highlight the entire question card so users instantly see
            // which questions were wrong (red), partial (orange), or correct (green).
            // This prevents confusion especially for fill-in-the-blank where students
            // may have cleared their answer and can't see what they entered.
            que.style.transition = 'border-left 0.3s ease';
            if (isFullMark) {
                que.style.borderLeft = '4px solid rgba(16, 185, 129, 0.75)';
                que.style.borderRadius = '0 6px 6px 0';
            } else if (isPartialMark) {
                que.style.borderLeft = '4px solid rgba(245, 158, 11, 0.85)';
                que.style.borderRadius = '0 6px 6px 0';
            } else if (isZeroMark) {
                que.style.borderLeft = '4px solid rgba(239, 68, 68, 0.8)';
                que.style.borderRadius = '0 6px 6px 0';
            }
        });
    }

    let lastProcessedReviewAttempt = null;
    function getReviewQuestionStateSignature(que) {
        const qData = extractQuestionData(que);
        const qText = normalizeText(qData ? qData.qText : '');
        // Extract native Moodle feedback, excluding toolkit's own injected banners/pills
        const feedbackEls = que.querySelectorAll('.info, .outcome, .rightanswer, .feedback');
        const feedbackTexts = [];
        feedbackEls.forEach(el => {
            const clone = el.cloneNode(true);
            clone.querySelectorAll('[class*="amaes-"]').forEach(inj => inj.remove());
            feedbackTexts.push(clone.innerText || '');
        });
        const feedback = normalizeText(feedbackTexts.join('|'));
        const inputs = Array.from(que.querySelectorAll('input, select, textarea')).map(input => {
            const selected = input.type === 'checkbox' || input.type === 'radio'
                ? (input.checked ? 'checked' : '')
                : input.value || '';
            return `${input.type || input.tagName}:${selected}`;
        }).join('|');
        const markedChoices = Array.from(que.querySelectorAll('.answer [class*="correct" i], .answer [class*="incorrect" i], .answer .fa-check, .answer .fa-times'))
            .filter(el => !el.closest('[class*="amaes-"]') && !(el.className && typeof el.className === 'string' && el.className.includes('amaes-')))
            .map(el => `${el.className || ''}:${normalizeText(el.innerText || '')}`)
            .join('|');
        return `${qText}::${feedback}::${inputs}::${markedChoices}`;
    }

    function getReviewShareKey(question) {
        const wrong = normalizeWrongAnswers(question.wrongAnswers)
            .map(item => item.norm)
            .sort()
            .join('|');
        return `${getQuestionIdentity(question)}::${normalizeChoice(question.ansRaw || question.answer || '')}::${wrong}`;
    }

    function handleQuizReviewPageLoad() {
        if (!checkIsReviewPage()) return;

        const urlParams = new URLSearchParams(window.location.search);
        const attemptId = urlParams.get('attempt') || urlParams.get('id') || urlParams.get('cmid') || window.location.search || window.location.pathname;

        if (!sessionStorage.getItem(`amaes_review_ding_${attemptId}`)) {
            sessionStorage.setItem(`amaes_review_ding_${attemptId}`, '1');
            playToolkitSound('quest_done');
        }

        // Check for multi-page review pagination: expand to show all questions on one page if available
        const showAllLink = document.querySelector('a[href*="review.php"][href*="showall=1"], a[href*="showall=true"]');
        if (showAllLink && !window.location.search.includes('showall=1') && !sessionStorage.getItem(`amaes_expanded_review_${attemptId}`)) {
            sessionStorage.setItem(`amaes_expanded_review_${attemptId}`, '1');
            setLog("<b>Multi-page Review:</b> Expanding full quiz to review and harvest all questions on one page...", "var(--accent-blue)");
            showToast("Expanding full quiz review for complete answer harvest...", 2000);
            window.location.href = showAllLink.href;
            return;
        }

        const harvested = harvestReviewAnswers();
        // MutationObserver may see the review page before Moodle finishes
        // inserting all questions. Include the question signature in the guard
        // so a later multi-question DOM is harvested too.
        const questionSignature = Array.from(document.querySelectorAll('.que'))
            .map(getReviewQuestionStateSignature)
            .filter(Boolean)
            .join('|');
        const processingKey = `${attemptId}:${questionSignature}`;

        // Always inject visual markers for questions on review page
        injectReviewQuestionMarkers(harvested);

        if (!harvested || !harvested.success ||
            (harvested.harvestedCount === 0 && (harvested.eliminatedCount || 0) === 0)) {
            const retryKey = `amaes_review_retry_${attemptId}`;
            const retryCount = Number(sessionStorage.getItem(retryKey) || '0');
            if (retryCount < 5) {
                sessionStorage.setItem(retryKey, String(retryCount + 1));
                setTimeout(() => {
                    if (checkIsReviewPage()) handleQuizReviewPageLoad();
                }, 700);
            } else {
                sessionStorage.removeItem(retryKey);
            }
            return;
        }
        sessionStorage.removeItem(`amaes_review_retry_${attemptId}`);

        if (lastProcessedReviewAttempt === processingKey) return;
        lastProcessedReviewAttempt = processingKey;

        // Auto-save verified answers and eliminated wrong choices to local subject cache
        const cacheRes = mergeAnswersIntoCache(harvested.subjectCode, harvested.questions, 'Review');

        // Re-highlight choices so newly deduced or eliminated choices display updated badges
        highlightQuizAnswers(getCachedAnswers(harvested.subjectCode), false);

        // Update markers with fresh cache state
        injectReviewQuestionMarkers(harvested);

        const autoShareEnabled = localStorage.getItem('amaes_auto_community_share') !== 'false';
        const hasNewDiscoveries = Boolean(cacheRes && (cacheRes.added > 0 || cacheRes.confirmed > 0 || cacheRes.eliminated > 0 || cacheRes.conflicts > 0));

        if (hasNewDiscoveries) {
            const newTotal = (cacheRes.added || 0) + (cacheRes.confirmed || 0);
            if (autoShareEnabled) {
                setLog(`<b>Quiz Review Checked:</b> Extracted <b>${harvested.harvestedCount}</b> verified answers (${newTotal} updated) & <b>${harvested.eliminatedCount || 0}</b> wrong choices for <b>${harvested.subjectCode}</b>. Sharing queued.`, "var(--accent-green)");
                showToast(`Review Checked: ${newTotal > 0 ? `Collected ${newTotal} verified answer${newTotal > 1 ? 's' : ''}` : `${cacheRes.eliminated} wrong choice${cacheRes.eliminated > 1 ? 's' : ''} eliminated`}; sharing queued.`, 4000);
            } else {
                setLog(`<b>Quiz Review Checked:</b> Extracted <b>${harvested.harvestedCount}</b> verified answers (${newTotal} updated) for <b>${harvested.subjectCode}</b> (Saved to Local DB, sharing is OFF).`, "var(--accent-blue)");
                showToast(`Review Checked: ${newTotal > 0 ? `Collected ${newTotal} verified answer${newTotal > 1 ? 's' : ''}` : `${cacheRes.eliminated} wrong choice${cacheRes.eliminated > 1 ? 's' : ''} eliminated`} & saved locally!`, 4000);
            }
        } else {
            // Already cataloged: quiet debug log, no repetitive popup toast when reviewing past attempts
            logDebug(`Quiz Review: All ${harvested.harvestedCount} verified answers for ${harvested.subjectCode} are already cataloged.`);
        }

        const autoPushEnabled = localStorage.getItem('amaes_auto_push_github') === 'true';
        const hasGithubToken = Boolean(localStorage.getItem('amaes_github_token'));

        // Prevent repeated auto-actions on refresh using sessionStorage attempt keys
        const pushKey = `amaes_autopush_${attemptId}`;
        const shareKey = `amaes_autoshare_${attemptId}_${harvested.subjectCode}`;

        // 2. Auto-Push to GitHub if configured
        if (autoPushEnabled && hasGithubToken && !sessionStorage.getItem(pushKey)) {
            sessionStorage.setItem(pushKey, '1');
            setTimeout(async () => {
                try {
                    const res = await pushAnswersToGitHub(harvested.subjectCode, harvested.questions, {
                        quizTitle: harvested.quizTitle,
                        gradeText: harvested.gradeText,
                        courseTitle: harvested.course
                    });
                    if (res && res.success && res.mode === 'api') {
                        showToast(`Auto-pushed ${harvested.harvestedCount} answers directly to GitHub database!`);
                    }
                } catch (e) {
                    console.error('Auto-push to GitHub failed:', e);
                }
            }, 1000);
        }

        // 3. Auto-Share newly harvested answers to Community Hub (Default: ON).
        // Store individual evidence keys in localStorage so across tabs and sessions, duplicate network requests are avoided.
        if (autoShareEnabled && (harvested.harvestedCount > 0 || (harvested.eliminatedCount || 0) > 0)) {
            let sharedKeys = [];
            try {
                sharedKeys = JSON.parse(localStorage.getItem(shareKey) || sessionStorage.getItem(shareKey) || '[]');
                if (!Array.isArray(sharedKeys)) sharedKeys = [];
            } catch (e) {
                sharedKeys = [];
            }
            const sharedSet = new Set(sharedKeys);
            const pendingQuestions = harvested.questions.filter(question => {
                if (!question.ansRaw) return false;
                const key = getReviewShareKey(question);
                if (sharedSet.has(key)) return false;
                sharedSet.add(key);
                return true;
            });
            if (pendingQuestions.length > 0) {
                localStorage.setItem(shareKey, JSON.stringify(Array.from(sharedSet)));
                sessionStorage.setItem(shareKey, JSON.stringify(Array.from(sharedSet)));
                setTimeout(() => {
                    Promise.resolve(queueCommunityContribution(harvested.subjectCode, pendingQuestions, {
                        source: 'review_screen',
                        evidenceType: 'moodle_review',
                        contributionId: `review-${processingKey}`
                    }))
                        .catch(err => logDebug(`Review community share note: ${err.message}`));
                }, 1200);
            }
        }
    }
    const injectReviewScreenBanner = handleQuizReviewPageLoad;

    // Helper to retrieve all locally cached subject databases
    function getAllSavedSubjectDatabases() {
        const dbs = {};
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('amaes_amauoed_cache_')) {
                const code = key.replace('amaes_amauoed_cache_', '').toUpperCase();
                try {
                    const data = JSON.parse(localStorage.getItem(key));
                    if (Array.isArray(data) && data.length > 0) {
                        dbs[code] = data;
                    }
                } catch (e) {}
            }
        }
        return dbs;
    }

    // Community Database Contribution & Anti-Sabotage Submission Modal
    function showCommunityContributionModal(initialSubCode) {
        const existing = document.getElementById('amaes-contribute-modal');
        if (existing) existing.remove();

        const allDbs = getAllSavedSubjectDatabases();
        const availableCodes = Object.keys(allDbs);
        // Sort availableCodes by question count descending
        availableCodes.sort((a, b) => (allDbs[b]?.length || 0) - (allDbs[a]?.length || 0));

        let targetCode = (initialSubCode && allDbs[initialSubCode.toUpperCase()]) ?
            initialSubCode.toUpperCase() :
            (availableCodes[0] || (initialSubCode ? initialSubCode.toUpperCase() : 'GENERAL'));

        const modal = document.createElement('div');
        modal.id = 'amaes-contribute-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0; left: 0; width: 100vw; height: 100vh;
            background: rgba(0, 0, 0, 0.75);
            backdrop-filter: blur(4px);
            z-index: 100003;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-sizing: border-box;
        `;

        function generatePayload(code, qList) {
            // Only export questions that have a verified or deduced answer
            const validQuestions = qList.filter(q => Boolean(q.ansRaw || q.answer || q.correctAnswer));
            const cInfo = (typeof courseInfo !== 'undefined' && courseInfo) ? courseInfo :
                          (typeof detectedCourseInfo !== 'undefined' && detectedCourseInfo) ? detectedCourseInfo :
                          (typeof detectCourseInfo === 'function' ? detectCourseInfo() : null);
            const resolvedName = (cInfo && (cInfo.subjectCode === code || cInfo.code === code) && cInfo.subjectName) ?
                cInfo.subjectName : resolveKnownCourseName(code);

            return {
                subjectCode: code,
                subjectName: resolvedName || code,
                contributor: "community",
                timestamp: new Date().toISOString(),
                totalQuestions: validQuestions.length,
                questions: validQuestions.map(q => ({
                    question: q.qRaw || q.question || q.qText || "",
                    answer: q.ansRaw || q.answer || q.correctAnswer || "",
                    choices: q.choices || [],
                    wrongAnswers: Array.isArray(q.wrongAnswers) ? q.wrongAnswers.map(w => typeof w === 'string' ? w : (w && w.text ? w.text : w)) : [],
                    confidence: typeof q.confidence === 'number' ? q.confidence : 1.0,
                    period: q.period || q.term || 'General',
                    quizTitle: q.quizTitle || '',
                    source: q.source || "community_contribute"
                }))
            };
        }

        function renderModal() {
            const questions = allDbs[targetCode] || [];
            const payload = generatePayload(targetCode, questions);
            const payloadStr = JSON.stringify(payload, null, 2);
            const verifiedCount = questions.filter(q => q.ansRaw || q.answer || q.correctAnswer).length;
            const eliminatedCount = questions.reduce((acc, q) => acc + (Array.isArray(q.wrongAnswers) ? q.wrongAnswers.length : 0), 0);
            const hasPatToken = Boolean(localStorage.getItem('amaes_github_token'));

            modal.innerHTML = `
                <div style="
                    background: var(--surface, #1e293b);
                    border: 1px solid var(--border, #334155);
                    border-radius: 14px;
                    max-width: 580px;
                    width: 100%;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.6);
                    overflow: hidden;
                    color: var(--text-primary, #f8fafc);
                    display: flex;
                    flex-direction: column;
                    max-height: 86vh;
                ">
                    <!-- Header with Motto -->
                    <div style="
                        padding: 12px 18px;
                        background: linear-gradient(135deg, #10b981, #047857);
                        color: #ffffff;
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                    ">
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px;">
                                ${ICONS.upload}
                                <span style="font-weight: 800; font-size: 14px;">Share Database to Community Hub</span>
                            </div>
                            <div style="font-size: 10px; color: #d1fae5; margin-top: 2px; font-style: italic;">
                                "Solve once, share together, never guess twice."
                            </div>
                        </div>
                        <button id="amaes-contribute-close-btn" style="
                            background: rgba(255,255,255,0.2);
                            border: none;
                            color: #fff;
                            width: 26px; height: 26px;
                            border-radius: 50%;
                            cursor: pointer;
                            display: flex; align-items: center; justify-content: center;
                            font-size: 15px; font-weight: bold;
                        ">&times;</button>
                    </div>

                    <!-- Body Content -->
                    <div style="padding: 14px 18px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 10px; font-size: 12px; line-height: 1.5;">
                        <!-- Motto Callout & Anti-Sabotage Notice -->
                        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px 12px;">
                            <div style="font-weight: 700; color: #34d399; margin-bottom: 2px; display: flex; align-items: center; gap: 6px;">
                                ${ICONS.shieldCheck} <span>A community where each student answers what's missing</span>
                            </div>
                            <div style="color: var(--text-secondary, #cbd5e1); font-size: 11px;">
                                Submissions are processed automatically by GitHub Actions CI. Teacher keys and consensus answers are strictly protected from overwrites. Zero tokens or accounts required!
                            </div>
                        </div>

                        ${availableCodes.length === 0 ? `
                            <!-- Empty Local Storage State -->
                            <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 14px; text-align: center;">
                                <div style="font-weight: 700; color: var(--accent-pink, #f43f5e); font-size: 13px; margin-bottom: 4px;">No Saved Answers in Local Storage Yet</div>
                                <div style="font-size: 11px; color: var(--text-secondary, #cbd5e1); line-height: 1.5;">
                                    Complete or review a quiz in Moodle to harvest verified answers, or scrape answers from amauoed.com. Once answers are saved in your local storage, you can share them here with 1 click!
                                </div>
                            </div>
                        ` : `
                            <!-- Subject Selection -->
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 10px; background: var(--surface-subtle, #0f172a); padding: 8px 12px; border-radius: 8px; border: 1px solid var(--border-subtle, #334155);">
                                <div>
                                    <span style="font-weight: 700;">Subject Database:</span>
                                    ${availableCodes.length > 1 ? `
                                        <select id="amaes-contribute-sub-select" style="margin-left: 6px; background: var(--surface, #1e293b); color: var(--text-primary, #f8fafc); border: 1px solid var(--border, #334155); border-radius: 4px; padding: 3px 6px; font-weight: 600;">
                                            ${availableCodes.map(c => `<option value="${c}" ${c === targetCode ? 'selected' : ''}>${c} (${allDbs[c].length} Qs)</option>`).join('')}
                                        </select>
                                    ` : `<b style="color: var(--accent-blue, #38bdf8); margin-left: 4px;">${targetCode}</b>`}
                                </div>
                                <span style="background: ${questions.length > 0 ? '#10b981' : '#f43f5e'}; color: #fff; padding: 2px 8px; border-radius: 12px; font-weight: 700; font-size: 10px;">
                                    ${verifiedCount} Verified • ${eliminatedCount} Eliminated
                                </span>
                            </div>

                            <!-- Payload Preview -->
                            <div>
                                <div style="font-weight: 600; margin-bottom: 4px; color: var(--text-secondary, #94a3b8); font-size: 11px;">Contribution Payload Preview (${questions.length} questions):</div>
                                <pre style="background: #020617; color: #a5f3fc; padding: 8px; border-radius: 6px; font-size: 10px; font-family: monospace; max-height: 120px; overflow: auto; border: 1px solid #1e293b; white-space: pre-wrap; word-break: break-all;">${payloadStr.length > 1000 ? payloadStr.slice(0, 1000) + '\n... (truncated for display)' : payloadStr}</pre>
                            </div>

                            <!-- Guide Steps -->
                            <div style="font-size: 11px; color: var(--text-secondary, #94a3b8);">
                                <b>How it works:</b> Clicking <b>"Submit via 1-Click Issue"</b> opens a pre-filled GitHub issue in the open community repository. Click "Submit new issue" on GitHub and the automated merger bot incorporates the new questions within 60 seconds!
                            </div>

                            <!-- Dynamic Feedback Area -->
                            <div id="amaes-contribute-feedback-area" style="display: none;"></div>
                        `}
                    </div>

                    <!-- Footer Actions -->
                    <div style="
                        padding: 10px 18px;
                        background: var(--surface-subtle, #0f172a);
                        border-top: 1px solid var(--border, #334155);
                        display: flex;
                        gap: 8px;
                        justify-content: flex-end;
                        flex-wrap: wrap;
                        align-items: center;
                    ">
                        <button id="amaes-contribute-copy-btn" class="amaes-btn amaes-btn-outline" style="padding: 5px 10px; font-size: 10.5px; cursor: pointer;">
                            ${ICONS.copy} <span>Copy JSON</span>
                        </button>
                        ${hasPatToken ? `
                            <button id="amaes-contribute-token-push-btn" class="amaes-btn amaes-btn-blue" style="padding: 5px 12px; font-size: 10.5px; font-weight: 700; cursor: pointer; border-radius: 6px;" ${questions.length === 0 ? 'disabled' : ''}>
                                ${ICONS.github} <span>Direct Push (via Token)</span>
                            </button>
                        ` : ''}
                        <button id="amaes-contribute-submit-btn" class="amaes-btn" style="padding: 5px 14px; background: linear-gradient(135deg, #10b981, #047857); color: #fff; border: none; font-weight: 700; font-size: 11px; cursor: pointer; border-radius: 6px;" ${questions.length === 0 ? 'disabled' : ''}>
                            ${ICONS.upload} <span>Submit via 1-Click Issue</span>
                        </button>
                    </div>
                </div>
            `;

            const closeBtn = modal.querySelector('#amaes-contribute-close-btn');
            if (closeBtn) closeBtn.onclick = () => modal.remove();

            const selectEl = modal.querySelector('#amaes-contribute-sub-select');
            if (selectEl) {
                selectEl.onchange = (e) => {
                    targetCode = e.target.value;
                    renderModal();
                };
            }

            const copyBtn = modal.querySelector('#amaes-contribute-copy-btn');
            if (copyBtn) {
                copyBtn.onclick = () => {
                    copyToClipboard(payloadStr).then(() => {
                        showToast("Payload JSON copied to clipboard!");
                        copyBtn.innerHTML = `${ICONS.check} <span>Copied!</span>`;
                        setTimeout(() => {
                            copyBtn.innerHTML = `${ICONS.copy} <span>Copy JSON</span>`;
                        }, 2000);
                    }).catch(() => {
                        showToast("Failed to copy JSON");
                    });
                };
            }

            const tokenPushBtn = modal.querySelector('#amaes-contribute-token-push-btn');
            if (tokenPushBtn) {
                tokenPushBtn.onclick = async () => {
                    tokenPushBtn.disabled = true;
                    tokenPushBtn.innerHTML = `${ICONS.rotateCcw} <span>Pushing...</span>`;
                    try {
                        await pushAnswersToGitHub(targetCode, questions, {
                            quizTitle: 'Community Contribution'
                        });
                        showToast(`Successfully pushed ${questions.length} answers directly to GitHub!`);
                        setLog(`Successfully pushed <b>${questions.length}</b> answers directly to GitHub for <b>${targetCode}</b>!`, "var(--accent-green)");
                        const feedbackContainer = modal.querySelector('#amaes-contribute-feedback-area');
                        if (feedbackContainer) {
                            feedbackContainer.style.display = 'block';
                            feedbackContainer.innerHTML = `
                                <div style="background: rgba(16, 185, 129, 0.2); border: 1.5px solid #10b981; border-radius: 8px; padding: 10px 12px; margin-top: 6px;">
                                    <div style="font-weight: 700; color: #34d399; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                        ${ICONS.checkCircle} <span>Successfully Pushed to Cloud Database!</span>
                                    </div>
                                    <div style="font-size: 11px; color: #e2e8f0; margin-top: 4px;">
                                        <b>${questions.length}</b> answers were committed directly to the official community repository.
                                    </div>
                                </div>
                            `;
                        }
                    } catch (err) {
                        alert(`Push failed: ${err.message}`);
                        tokenPushBtn.disabled = false;
                        tokenPushBtn.innerHTML = `${ICONS.github} <span>Direct Push (via Token)</span>`;
                    }
                };
            }

            const submitBtn = modal.querySelector('#amaes-contribute-submit-btn');
            if (submitBtn) {
                submitBtn.onclick = () => {
                    if (!questions || questions.length === 0) {
                        alert("No questions found for this subject to submit.");
                        return;
                    }

                    const issueTitle = `[Contribution] ${targetCode} (${questions.length} questions)`;
                    let issueBody = `### Community Answer Contribution\n\n**Subject**: ${targetCode}\n**Total Questions**: ${questions.length}\n**Submitted At**: ${new Date().toISOString()}\n\n\`\`\`json\n${payloadStr}\n\`\`\`\n`;
                    let autoCopied = false;

                    // If URL query string exceeds safe browser/HTTP limits (~3500 chars), auto-copy full JSON and provide clean paste prompt
                    if (encodeURIComponent(issueBody).length > 3500) {
                        copyToClipboard(payloadStr);
                        autoCopied = true;
                        issueBody = `### Community Answer Contribution\n\n**Subject**: ${targetCode}\n**Total Questions**: ${questions.length}\n**Submitted At**: ${new Date().toISOString()}\n\n> [!NOTE]\n> The JSON payload (${questions.length} questions) was automatically copied to your clipboard!\n> Simply press **Ctrl + V** (or Cmd + V) below inside this text box to paste it, then click **"Submit new issue"**.\n\n\`\`\`json\nPASTE_HERE\n\`\`\`\n`;
                    }

                    const ghUrl = `https://github.com/Acads-Tools/database/issues/new?title=${encodeURIComponent(issueTitle)}&body=${encodeURIComponent(issueBody)}&labels=community-contribution`;
                    
                    window.open(ghUrl, '_blank');

                    // Provide immediate, unmissable in-modal feedback
                    const feedbackContainer = modal.querySelector('#amaes-contribute-feedback-area');
                    if (feedbackContainer) {
                        feedbackContainer.style.display = 'block';
                        feedbackContainer.innerHTML = `
                            <div style="background: rgba(16, 185, 129, 0.15); border: 1.5px solid var(--accent-green, #10b981); border-radius: 8px; padding: 10px 12px; margin-top: 6px;">
                                <div style="font-weight: 700; color: #34d399; font-size: 12px; display: flex; align-items: center; gap: 6px;">
                                    ${ICONS.checkCircle} <span>Submission Page Opened in New Tab!</span>
                                </div>
                                <div style="font-size: 11px; color: #e2e8f0; margin-top: 4px; line-height: 1.45;">
                                    ${autoCopied ? `<b>Payload Copied!</b> Your ${questions.length} questions were auto-copied to your clipboard. Go to the new GitHub tab, press <b>Ctrl + V</b> in the box, and click <b>"Submit new issue"</b>!` : `<b>Final Step:</b> Go to the newly opened GitHub tab and click the green <b>"Submit new issue"</b> button. The automated bot will merge your answers into the cloud database within 60 seconds!`}
                                </div>
                                <div style="margin-top: 8px; display: flex; gap: 8px; align-items: center;">
                                    <a href="${ghUrl}" target="_blank" rel="noopener noreferrer" class="amaes-btn amaes-btn-blue" style="font-size: 10px; padding: 4px 10px; text-decoration: none; display: inline-flex; align-items: center; gap: 5px;">
                                        ${ICONS.external} <span>Open GitHub Tab (If Blocked by Browser)</span>
                                    </a>
                                </div>
                            </div>
                        `;
                    }
                    showToast(autoCopied ? "JSON auto-copied! GitHub opened." : "GitHub submission page opened!");
                    setLog(`Opened GitHub community submission page for <b>${targetCode}</b>`, "var(--accent-green)");
                };
            }
        }

        document.body.appendChild(modal);
        renderModal();
    }

