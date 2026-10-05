    // ==========================================
    // Activity Classifier for Course Page
    // ==========================================

    function getQuizRegex() {
        return /\b(quiz|prelim|prelims|midterm|midterms|prefinal|prefinals|final|finals|exam|examination|assessment|eval)\b/i;
    }

    function getVideoRegex() {
        return /\b(video|vid|vids|watch|recording|recordings|webinar|clip|panopto|zoom|stream)\b/i;
    }

    function getLectureRegex() {
        return /\b(lec|lecture|lectures|lesson|reading|topic|module|handout|guide|discussion|notes)\b/i;
    }

    function classifyActivity(activityElem) {
        const text = (activityElem.innerText || '').toLowerCase();
        const html = activityElem.innerHTML.toLowerCase();

        // 1. Video
        const isVideoMod = Boolean(activityElem.querySelector(
            '[data-modname*="video"], [data-modtype*="video"], a[href*="youtube"], a[href*="vimeo"], a[href*="panopto"], iframe, video'
        )) || activityElem.classList.contains('modtype_videostream') || activityElem.classList.contains('modtype_kalvidres');

        const videoRegex = getVideoRegex();
        if (isVideoMod || videoRegex.test(text) || html.includes('youtube.com') || html.includes('youtu.be') || html.includes('vimeo.com')) {
            return {
                type: 'video',
                reason: isVideoMod ? 'video-mod' : 'video-keyword',
                color: 'var(--accent-purple)',
                badge: 'Video'
            };
        }

        // 2. Quiz / Exam
        const isQuizMod = activityElem.classList.contains('modtype_quiz') ||
            Boolean(activityElem.querySelector('[data-modname="quiz"], [data-modtype="quiz"], a[href*="/mod/quiz/"], img[src*="quiz"]'));

        const iconContainer = activityElem.querySelector('.activityiconcontainer, .activity-icon');
        let hasPinkIcon = false;
        let iconBgColor = '';
        if (iconContainer) {
            iconBgColor = window.getComputedStyle(iconContainer).backgroundColor;
            if (iconContainer.classList.contains('assessment') || iconContainer.classList.contains('evaluations') || iconContainer.classList.contains('bg-pink')) {
                hasPinkIcon = true;
            } else {
                const rgb = iconBgColor.match(/\d+/g);
                if (rgb && rgb.length >= 3) {
                    const [r, g, b] = rgb.map(Number);
                    if (r > 160 && b > 100 && g < 140) hasPinkIcon = true;
                }
            }
        }

        const quizRegex = getQuizRegex();
        if (isQuizMod || hasPinkIcon || quizRegex.test(text)) {
            return {
                type: 'quiz',
                reason: isQuizMod ? 'quiz-module' : hasPinkIcon ? 'pink-icon' : 'keyword',
                color: 'var(--accent-pink)',
                badge: 'Quiz'
            };
        }

        // 3. Lecture / Reading
        const isLectureMod = Boolean(activityElem.querySelector(
            '.modtype_page, .modtype_resource, .modtype_url, .modtype_book, .modtype_folder, ' +
            '[data-modname="page"], [data-modname="resource"], [data-modname="url"], [data-modname="book"], ' +
            'a[href*="/mod/page/"], a[href*="/mod/resource/"], a[href*="/mod/url/"], a[href*="/mod/book/"]'
        )) || activityElem.classList.contains('modtype_page') || activityElem.classList.contains('modtype_resource');

        let hasBlueIcon = false;
        if (iconContainer) {
            if (iconContainer.classList.contains('content') || iconContainer.classList.contains('bg-blue') || iconContainer.classList.contains('content-blue')) {
                hasBlueIcon = true;
            } else {
                const rgb = iconBgColor.match(/\d+/g);
                if (rgb && rgb.length >= 3) {
                    const [r, g, b] = rgb.map(Number);
                    if (b > 150 && b > r + 30) hasBlueIcon = true;
                }
            }
        }

        const lectureRegex = getLectureRegex();
        if (isLectureMod || hasBlueIcon || lectureRegex.test(text)) {
            return {
                type: 'lecture',
                reason: isLectureMod ? 'resource-module' : hasBlueIcon ? 'blue-icon' : 'keyword',
                color: 'var(--accent-blue)',
                badge: 'Lecture'
            };
        }

        return { type: 'lecture', reason: 'default-non-quiz', color: 'var(--accent-blue)', badge: 'Lecture' };
    }

    // ==========================================
    // Quiz Passable Grade (≥80%) Safety Evaluator
    // ==========================================

    async function fetchCourseGradesMap() {
        if (!checkIsCoursePage()) return {};

        // In-memory cache valid for 60s
        if (typeof window !== 'undefined' && window.__amaesCourseGradesCache && window.__amaesCourseGradesCacheTime && (Date.now() - window.__amaesCourseGradesCacheTime < 60000)) {
            return window.__amaesCourseGradesCache;
        }

        let gradesUrl = null;
        if (typeof document !== 'undefined') {
            const gradesLink = document.querySelector('a[href*="/grade/report/user/index.php"]');
            if (gradesLink && gradesLink.href) {
                gradesUrl = gradesLink.href;
            } else if (typeof detectCourseInfo === 'function') {
                const courseInfo = detectCourseInfo();
                if (courseInfo && courseInfo.courseId) {
                    const semPath = typeof getSemesterBasePath === 'function' ? getSemesterBasePath() : '/';
                    gradesUrl = `${window.location.origin}${semPath}grade/report/user/index.php?id=${courseInfo.courseId}`;
                }
            }
        }

        if (!gradesUrl) return {};

        try {
            const resp = await fetch(gradesUrl);
            if (!resp.ok) return {};
            const html = await resp.text();
            const doc = new DOMParser().parseFromString(html, 'text/html');
            const map = {};

            const rows = Array.from(doc.querySelectorAll('.user-grade tr, .generaltable tr, table.table tr, tr'));
            rows.forEach(r => {
                const quizLink = r.querySelector('a[href*="/mod/quiz/"], a[href*="quiz"], a.gradeitemheader')
                              || r.querySelector('.column-itemname a, th a, td:first-child a');
                if (!quizLink) return;

                const href = quizLink.getAttribute('href') || quizLink.href || '';
                const rawTitle = quizLink.innerText.trim();
                if (!rawTitle) return;

                const gradeCell = r.querySelector('.column-grade, [headers*="grade"], td.grade');
                const pctCell = r.querySelector('.column-percentage, [headers*="percentage"]');

                let pct = null;
                let hasGrade = false;
                let gradeStr = '';

                if (pctCell) {
                    const pText = pctCell.innerText.trim();
                    const mPct = pText.match(/(\d+(?:\.\d+)?)\s*%/);
                    if (mPct) {
                        pct = parseFloat(mPct[1]);
                        hasGrade = true;
                        gradeStr = `${pct}%`;
                    }
                }

                if (gradeCell) {
                    const gText = gradeCell.innerText.trim();
                    if (gText && gText !== '-' && gText !== '–' && /\d/.test(gText)) {
                        hasGrade = true;
                        if (!gradeStr) gradeStr = gText;
                        if (pct === null) {
                            const mFrac = gText.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
                            if (mFrac) {
                                const earned = parseFloat(mFrac[1]);
                                const max = parseFloat(mFrac[2]);
                                if (max > 0) pct = Math.round((earned / max) * 100);
                            } else {
                                const mNum = gText.match(/(\d+(?:\.\d+)?)/);
                                if (mNum && parseFloat(mNum[1]) <= 100) {
                                    pct = parseFloat(mNum[1]);
                                }
                            }
                        }
                    }
                }

                const mCmid = href.match(/[?&]id=(\d+)/);
                const cmid = mCmid ? mCmid[1] : null;
                const normTitle = rawTitle.toLowerCase().replace(/[^a-z0-9]/g, '');

                const entry = {
                    title: rawTitle,
                    normTitle: normTitle,
                    href: href,
                    cmid: cmid,
                    hasGrade: hasGrade,
                    percentage: pct,
                    gradeStr: gradeStr,
                    isPassable: Boolean(hasGrade && pct !== null && pct >= 80)
                };

                map[normTitle] = entry;
                if (cmid) map[`cmid_${cmid}`] = entry;
            });

            if (typeof window !== 'undefined') {
                window.__amaesCourseGradesCache = map;
                window.__amaesCourseGradesCacheTime = Date.now();
            }
            return map;
        } catch (e) {
            console.warn('Failed to fetch course grades map:', e);
            return {};
        }
    }

    function evaluateQuizPassableGrade(container, title = '', gradesMap = null) {
        // 1. Check gradesMap if provided or cached
        const map = gradesMap || (typeof window !== 'undefined' ? window.__amaesCourseGradesCache : null);
        if (map && Object.keys(map).length > 0) {
            // Check by container cmid if available (id="module-123" or data-id="123")
            let moduleId = (container && container.id ? container.id.replace(/^module-/, '') : '') || (container && container.dataset ? container.dataset.id : '') || '';
            if (!moduleId && container && container.querySelector) {
                const link = container.querySelector('a[href*="/mod/quiz/view.php?id="], a[href*="id="]');
                if (link) {
                    const m = (link.getAttribute('href') || link.href || '').match(/[?&]id=(\d+)/);
                    if (m) moduleId = m[1];
                }
            }
            if (moduleId && map[`cmid_${moduleId}`]) {
                const entry = map[`cmid_${moduleId}`];
                return {
                    isPassable: entry.isPassable,
                    hasGrade: entry.hasGrade,
                    percentage: entry.percentage,
                    cmid: moduleId,
                    source: 'grades-report'
                };
            }

            // Check by normalized title
            const normTitle = (title || (container && container.innerText ? container.innerText.split('\n')[0] : '') || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if (normTitle && map[normTitle]) {
                const entry = map[normTitle];
                return {
                    isPassable: entry.isPassable,
                    hasGrade: entry.hasGrade,
                    percentage: entry.percentage,
                    cmid: entry.cmid || moduleId,
                    source: 'grades-report'
                };
            }

            // Fuzzy match title
            for (const k in map) {
                if (k.startsWith('cmid_')) continue;
                if (k.length > 5 && (normTitle.includes(k) || k.includes(normTitle))) {
                    const entry = map[k];
                    return {
                        isPassable: entry.isPassable,
                        hasGrade: entry.hasGrade,
                        percentage: entry.percentage,
                        source: 'grades-report-fuzzy'
                    };
                }
            }
        }

        // 2. Fallback: Parse container text for explicit grade or pass/fail markers
        const text = (container.innerText || '').toLowerCase();

        // Check for explicit fail markers
        if (/did not achieve pass grade|failed to pass|\bfailed\b/i.test(text)) {
            return { isPassable: false, hasGrade: true, percentage: 0, source: 'container-fail' };
        }

        // Check for explicit pass markers
        if (/achieved pass grade|pass grade achieved|\bpassed\b/i.test(text)) {
            return { isPassable: true, hasGrade: true, percentage: 100, source: 'container-pass' };
        }

        // Check for explicit percentage in container
        const mPct = text.match(/(\d+(?:\.\d+)?)\s*%/);
        if (mPct) {
            const val = parseFloat(mPct[1]);
            return { isPassable: val >= 80, hasGrade: true, percentage: val, source: 'container-pct' };
        }

        // Check for fractions e.g. "8/10" or "80/100" or "Grade: 9 out of 10"
        const mFrac = text.match(/(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*(\d+(?:\.\d+)?)/i);
        if (mFrac) {
            const earned = parseFloat(mFrac[1]);
            const max = parseFloat(mFrac[2]);
            if (max > 0) {
                const val = Math.round((earned / max) * 100);
                return { isPassable: val >= 80, hasGrade: true, percentage: val, source: 'container-fraction' };
            }
        }

        // 3. No grade recorded or unattempted: MUST NOT TOUCH!
        return { isPassable: false, hasGrade: false, percentage: null, source: 'no-grade' };
    }

    function isActivityAlreadyComplete(container) {
        if (!container) return false;

        // 1. Direct class checks on container
        if (container.classList.contains('completed')) return true;

        // 2. Completed icons or toggled buttons
        if (container.querySelector(
            '.iscompleted, [data-toggled="true"], button[aria-checked="true"], button.btn-success, button.btn-outline-success, button[data-toggletype="manual:undo"]'
        )) return true;

        // 3. Scan completion area for completion markers
        const completionArea = container.querySelector(
            '.activity-completion, [data-region="completion-info"], .automatic-completion-conditions, .completion-info'
        ) || container;

        if (completionArea.querySelector('.badge-success, .text-success, [data-region="completion-info"] .badge-success')) return true;

        // 4. Check entire completionArea text content for "Done" or "Completed"
        const fullText = (completionArea.innerText || completionArea.textContent || '').trim().toLowerCase();
        if (fullText.includes('done:') || fullText.includes('done :') || /\bdone\b/i.test(fullText) || fullText.includes('completed')) {
            return true;
        }

        // 5. Scan all buttons inside container for manual undo or done text
        const btns = container.querySelectorAll(
            'button[data-action="toggle-manual-completion"], button[data-toggletype], button.btn-outline-success, button.btn-success, button'
        );
        for (const b of btns) {
            const bText = (b.innerText || b.getAttribute('aria-label') || b.textContent || '').trim().toLowerCase();
            const bToggle = (b.getAttribute('data-toggletype') || '').toLowerCase();
            if (bToggle === 'manual:undo' || /\bdone\b/i.test(bText) || bText.includes('✓') || bText.includes('✔') || b.classList.contains('btn-outline-success') || b.classList.contains('btn-success')) {
                return true;
            }
        }

        return false;
    }

    function findButtons(goal = 'mark_done', category = 'lecture', gradesMap = null) {
        const results = [];
        const activityElements = document.querySelectorAll(
            'li.activity, .activity-item, .course-section .activity, div[data-region="activity-card"]'
        );

        const processedButtons = new Set();
        const processedContainers = new Set();

        const scanBlock = (container) => {
            if (!container) return;

            // Smart Skip: If goal is to mark done, completely skip activities that are already done
            if (goal === 'mark_done' && isActivityAlreadyComplete(container)) {
                return;
            }

            const buttons = container.querySelectorAll(
                'button[data-action="toggle-manual-completion"], ' +
                'button[data-toggletype], ' +
                'button.btn-outline-secondary, ' +
                'button.btn-outline-success, ' +
                'button.btn-success, ' +
                'button'
            );

            let foundManualButton = false;
            for (const btn of buttons) {
                if (processedButtons.has(btn)) continue;

                const text = (btn.innerText || btn.getAttribute('aria-label') || '').trim().toLowerCase();
                const toggleType = (btn.getAttribute('data-toggletype') || '').toLowerCase();

                const isCurrentlyDone =
                    toggleType === 'manual:undo' ||
                    text === 'done' ||
                    /\bdone\b/i.test(text) ||
                    text.includes('✓') ||
                    text.includes('✔') ||
                    text.includes('completed') ||
                    btn.classList.contains('btn-success') ||
                    btn.classList.contains('btn-outline-success');

                const isCurrentlyUncompleted =
                    toggleType === 'manual:mark-done' ||
                    text === 'mark as done' ||
                    text === 'to do' ||
                    text.includes('mark as done') ||
                    (btn.dataset.action === 'toggle-manual-completion' && !isCurrentlyDone);

                let matchesGoal = false;
                if (goal === 'mark_done' && isCurrentlyUncompleted && !isCurrentlyDone) {
                    matchesGoal = true;
                } else if (goal === 'undo' && isCurrentlyDone) {
                    matchesGoal = true;
                }

                if (matchesGoal) {
                    processedButtons.add(btn);
                    foundManualButton = true;
                    processedContainers.add(container);
                    const classification = classifyActivity(container);
                    const titleElem = container.querySelector('.instancename, .activityname, a.aal_link, .activity-title');
                    const title = titleElem ? titleElem.innerText.trim() : (container.innerText.split('\n')[0] || 'Activity');

                    let gradeInfo = null;
                    // Safety Guard: For quizzes when marking done, ONLY mark if they have a passable grade (>= 80%)!
                    if (goal === 'mark_done' && classification.type === 'quiz') {
                        gradeInfo = evaluateQuizPassableGrade(container, title, gradesMap);
                        if (!gradeInfo.isPassable) {
                            // Leave untouched!
                            continue;
                        }
                    }

                    let matchesCategory = false;
                    if (category === 'all') matchesCategory = true;
                    else if (category === 'lecture' && (classification.type === 'lecture' || classification.type === 'video')) matchesCategory = true;
                    else if (category === 'quiz' && classification.type === 'quiz') matchesCategory = true;

                    if (matchesCategory) {
                        results.push({
                            button: btn,
                            container,
                            title,
                            classification,
                            isAutoView: false,
                            gradePct: gradeInfo ? gradeInfo.percentage : null
                        });
                    }
                }
            }

            // 2. Automatic "To do: View" completion detection (activities requiring view to complete)
            if (!foundManualButton && goal === 'mark_done' && !processedContainers.has(container)) {
                const completionArea = container.querySelector(
                    '.activity-completion, [data-region="completion-info"], .automatic-completion-conditions, .completion-info'
                ) || container;

                const badges = completionArea.querySelectorAll('.badge, button, [data-region="completion-info"] span, .automatic-completion-conditions span');
                let uncompletedViewBadge = null;
                for (const badge of badges) {
                    if (badge.closest('.badge-success, .completed, .iscompleted')) continue;

                    const text = (badge.innerText || badge.textContent || '').trim().toLowerCase();
                    const isTodoView = text.includes('to do: view') || text.includes('to do:view') || (text.includes('to do') && text.includes('view'));

                    if (isTodoView && !text.includes('done') && !text.includes('completed') && !badge.classList.contains('badge-success')) {
                        uncompletedViewBadge = badge;
                        break;
                    }
                }

                if (uncompletedViewBadge) {
                    const linkElem = container.querySelector('a.aal_link, a[href*="/mod/"], a.activityname');
                    const activityUrl = linkElem ? linkElem.href : null;
                    if (activityUrl) {
                        const classification = classifyActivity(container);
                        const titleElem = container.querySelector('.instancename, .activityname, a.aal_link, .activity-title');
                        const title = titleElem ? titleElem.innerText.trim() : (container.innerText.split('\n')[0] || 'Activity');

                        let matchesCategory = false;
                        if (category === 'all') matchesCategory = true;
                        else if (category === 'lecture' && (classification.type === 'lecture' || classification.type === 'video')) matchesCategory = true;
                        else if (category === 'quiz' && classification.type === 'quiz') matchesCategory = true;

                        if (matchesCategory) {
                            processedContainers.add(container);
                            results.push({
                                button: null,
                                autoViewUrl: activityUrl,
                                badgeElem: uncompletedViewBadge,
                                container,
                                title,
                                classification,
                                isAutoView: true,
                                gradePct: null
                            });
                        }
                    }
                }
            }
        };

        if (activityElements.length > 0) {
            activityElements.forEach(scanBlock);
        } else {
            const rawButtons = document.querySelectorAll('button[data-action="toggle-manual-completion"], button[data-toggletype]');
            rawButtons.forEach(btn => {
                const parent = btn.closest('li, div.activity, div.row, div.card') || btn.parentElement;
                scanBlock(parent);
            });
        }

        return results;
    }

    async function autoViewActivity(url, badgeElem = null, container = null) {
        if (!url) return false;

        let originalBadgeText = '';
        if (badgeElem) {
            originalBadgeText = badgeElem.innerText || badgeElem.textContent || '';
            badgeElem.dataset.originalText = originalBadgeText;
            badgeElem.textContent = 'Viewing...';
            badgeElem.style.opacity = '0.7';
            badgeElem.style.cursor = 'wait';
        }

        try {
            await fetch(url, {
                method: 'GET',
                credentials: 'same-origin',
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            });
        } catch (err) {
            // Even if fetch throws (e.g. cross-origin redirect on URL module), Moodle logged course_module_viewed
            logDebug(`Auto-view fetch handled for ${url}: ${err.message}`);
        }

        if (badgeElem) {
            badgeElem.textContent = 'Done: View';
            badgeElem.style.opacity = '1';
            badgeElem.style.cursor = 'default';
            badgeElem.classList.remove('badge-secondary', 'badge-light', 'badge-info', 'badge-warning', 'badge-danger');
            badgeElem.classList.add('badge-success');
            badgeElem.style.backgroundColor = '#198754';
            badgeElem.style.color = '#ffffff';
            badgeElem.style.borderColor = '#198754';
            badgeElem.removeAttribute('title');
        }

        if (container) {
            container.classList.add('completed');
            const compIcon = container.querySelector('.iscompleted, .activity-completion');
            if (compIcon) compIcon.classList.add('completed');
        }

        return true;
    }

    function setupAutoViewBadges() {
        if (typeof checkIsCoursePage === 'function' && !checkIsCoursePage()) return;

        const containers = document.querySelectorAll(
            'li.activity, .activity-item, .course-section .activity, div[data-region="activity-card"], .activity-instance'
        );

        containers.forEach(container => {
            // Smart Skip: If activity is already done/completed, do not bind or view
            if (isActivityAlreadyComplete(container)) return;

            const completionArea = container.querySelector(
                '.activity-completion, [data-region="completion-info"], .automatic-completion-conditions, .completion-info'
            ) || container;

            const badges = completionArea.querySelectorAll('.badge, button, [data-region="completion-info"] span, .automatic-completion-conditions span');
            for (const badge of badges) {
                if (badge.closest('.badge-success, .completed, .iscompleted')) continue;

                const text = (badge.innerText || badge.textContent || '').trim().toLowerCase();
                const isTodoView = text.includes('to do: view') || text.includes('to do:view') || (text.includes('to do') && text.includes('view'));

                if (isTodoView && !text.includes('done') && !text.includes('completed') && !badge.classList.contains('badge-success')) {

                    if (badge.dataset.amaesAutoViewBound) continue;
                    badge.dataset.amaesAutoViewBound = 'true';

                    const linkElem = container.querySelector('a.aal_link, a[href*="/mod/"], a.activityname');
                    const activityUrl = linkElem ? linkElem.href : null;
                    if (!activityUrl) continue;

                    // Style badge to indicate 1-click completion
                    badge.style.cursor = 'pointer';
                    badge.style.transition = 'all 0.2s ease';
                    badge.title = 'Click to auto-view and mark as done!';
                    badge.setAttribute('role', 'button');

                    // Hover effects
                    badge.addEventListener('mouseenter', () => {
                        if (!badge.textContent.includes('Done')) {
                            badge.style.transform = 'scale(1.05)';
                            badge.style.boxShadow = '0 0 6px rgba(46, 204, 113, 0.6)';
                        }
                    });
                    badge.addEventListener('mouseleave', () => {
                        badge.style.transform = '';
                        badge.style.boxShadow = '';
                    });

                    badge.addEventListener('click', async (e) => {
                        e.preventDefault();
                        e.stopPropagation();

                        if (badge.dataset.amaesAutoViewing === 'true') return;
                        badge.dataset.amaesAutoViewing = 'true';

                        const titleElem = container.querySelector('.instancename, .activityname, a.aal_link, .activity-title');
                        const title = titleElem ? titleElem.innerText.trim() : 'Activity';

                        showToast(`Auto-viewing "${title.substring(0, 24)}"...`, 1500);
                        setLog(`Auto-Viewing: <b>${title.substring(0, 30)}...</b>`, "var(--accent-blue)");

                        await autoViewActivity(activityUrl, badge, container);

                        playToolkitSound('quest_done');
                        showToast(`Marked "${title.substring(0, 24)}" as viewed & complete!`, 3000);
                        setLog(`Auto-Viewed: <b>${title.substring(0, 30)}...</b> Completed!`, "var(--accent-green)");
                        badge.dataset.amaesAutoViewing = 'false';
                    });

                    break;
                }
            }
        });
    }

    // ==========================================
    // Visual Course Highlighter
    // ==========================================

    function clearAllHighlights() {
        const highlighted = document.querySelectorAll('.amaes-highlighted-item');
        highlighted.forEach(el => {
            el.classList.remove('amaes-highlighted-item');
            el.style.outline = '';
            el.style.boxShadow = '';
            el.style.position = '';
            const badge = el.querySelector('.amaes-type-badge');
            if (badge) badge.remove();
        });
    }

    function highlightItems(targetCategory = 'all') {
        clearAllHighlights();

        if (!checkIsCoursePage()) {
            return { count: 0, error: 'Not a course page' };
        }

        const activities = document.querySelectorAll(
            'li.activity, .activity-item, .course-section .activity, div[data-region="activity-card"]'
        );

        let count = 0;
        activities.forEach(el => {
            const classification = classifyActivity(el);
            let shouldHighlight = false;

            if (targetCategory === 'all') shouldHighlight = true;
            else if (targetCategory === classification.type) shouldHighlight = true;

            if (shouldHighlight) {
                count++;
                el.classList.add('amaes-highlighted-item');
                el.style.position = 'relative';
                el.style.outline = `2px solid ${classification.color}`;
                el.style.borderRadius = '8px';
                el.style.boxShadow = `0 0 10px ${classification.color}33`;

                const badge = document.createElement('span');
                badge.className = 'amaes-type-badge';
                badge.innerText = classification.badge;
                badge.style.cssText = `
                    position: absolute;
                    top: 6px;
                    right: 6px;
                    background: ${classification.color};
                    color: #ffffff;
                    font-size: 9px;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 4px;
                    z-index: 10;
                    pointer-events: none;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.3);
                `;
                el.appendChild(badge);
            }
        });

        return { count, targetCategory };
    }

    // ==========================================
    // Quiz Landing Page Data & Attempt Parser
    // ==========================================

    function parseQuizLandingData(doc = document, pageUrl = (typeof window !== 'undefined' ? window.location.href : '')) {
        let cmid = null;
        const mId = (pageUrl || '').match(/[?&]id=(\d+)/);
        if (mId) cmid = mId[1];

        const text = (doc.body ? doc.body.innerText : (doc.documentElement ? doc.documentElement.innerText : '')) || '';

        // 1. Attempts allowed
        let attemptsAllowed = null;
        const mAllowed = text.match(/attempts allowed:\s*(\d+)/i);
        if (mAllowed) {
            attemptsAllowed = parseInt(mAllowed[1], 10);
        }

        // 2. Count finished attempts from summary table
        let attemptsUsed = 0;
        const attemptRows = doc.querySelectorAll('.generaltable tbody tr, table.generaltable tr');
        attemptRows.forEach(r => {
            const rText = r.innerText.toLowerCase();
            if (rText.includes('finished') || rText.includes('submitted') || rText.includes('review') || /attempt\s*\d+/i.test(rText)) {
                if (/\d/.test(r.querySelector('td') ? r.querySelector('td').innerText : '')) {
                    attemptsUsed++;
                }
            }
        });

        if (attemptsUsed === 0) {
            const matches = Array.from(text.matchAll(/(?:attempt|preview)\s+(\d+)/gi));
            if (matches.length > 0) {
                const nums = matches.map(m => parseInt(m[1], 10)).filter(n => !isNaN(n));
                if (nums.length > 0) attemptsUsed = Math.max(...nums);
            }
        }

        // 3. Highest grade / Overall grade
        let highestGradeStr = '';
        let highestPct = null;
        let hasGrade = false;

        const mHighest = text.match(/highest grade:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i)
                      || text.match(/overall grade for this quiz:\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/i);
        if (mHighest) {
            const earned = parseFloat(mHighest[1]);
            const max = parseFloat(mHighest[2]);
            if (max > 0) {
                highestPct = Math.round((earned / max) * 100);
                highestGradeStr = `${earned} / ${max} (${highestPct}%)`;
                hasGrade = true;
            }
        }

        if (highestPct === null) {
            const gradeCells = doc.querySelectorAll('.generaltable td.c3, .generaltable td.c2, .generaltable td');
            let maxFoundPct = -1;
            gradeCells.forEach(cell => {
                const cText = cell.innerText.trim();
                const mCellFrac = cText.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
                if (mCellFrac) {
                    const earned = parseFloat(mCellFrac[1]);
                    const max = parseFloat(mCellFrac[2]);
                    if (max > 0) {
                        const p = Math.round((earned / max) * 100);
                        if (p > maxFoundPct) {
                            maxFoundPct = p;
                            highestGradeStr = cText;
                            hasGrade = true;
                        }
                    }
                } else {
                    const mNum = cText.match(/^(\d+(?:\.\d+)?)$/);
                    if (mNum) {
                        const val = parseFloat(mNum[1]);
                        if (val <= 100 && val > maxFoundPct) {
                            maxFoundPct = val;
                            highestGradeStr = `${val}%`;
                            hasGrade = true;
                        }
                    }
                }
            });
            if (maxFoundPct >= 0) {
                highestPct = maxFoundPct;
            }
        }

        // 4. Can re-attempt / start attempt
        const startBtn = doc.querySelector(
            'form[action*="attempt.php"] button, form[action*="attempt.php"] input[type="submit"], ' +
            '.quizstartbutton button, .quizstartbutton input[type="submit"], ' +
            '#region-main button.btn-primary, #region-main input.btn-primary'
        );
        const noMoreAllowed = text.toLowerCase().includes('no more attempts are allowed');
        const maxAttemptsReached = Boolean(noMoreAllowed || (attemptsAllowed !== null && attemptsUsed >= attemptsAllowed));
        const canReattempt = Boolean(startBtn && !maxAttemptsReached);

        const isPassable = Boolean(hasGrade && highestPct !== null && highestPct >= 80);

        return {
            cmid,
            attemptsAllowed,
            attemptsUsed,
            highestGradeStr,
            highestPct,
            hasGrade,
            isPassable,
            canReattempt,
            maxAttemptsReached
        };
    }

    // Auto-Highlight unanswered / missing quizzes on Grades, Course, or Quiz view pages
    async function highlightMissingOrUnansweredQuizzes() {
        clearAllHighlights();

        const isGrades = typeof window !== 'undefined' && window.location.pathname.includes('/grade/report/user/index.php');
        const isCourse = checkIsCoursePage();
        const isQuizLanding = typeof window !== 'undefined' && window.location.pathname.includes('/mod/quiz/view.php');

        if (!isGrades && !isCourse && !isQuizLanding) {
            return { count: 0, error: 'Not on a course, grades, or quiz page', message: 'Open a course, Grades, or Quiz page first to highlight missing quizzes.' };
        }

        let count = 0;
        let firstScrolled = false;

        if (isQuizLanding) {
            const data = parseQuizLandingData(document, window.location.href);
            if (data.cmid) {
                try {
                    localStorage.setItem('amaes_quiz_attempts_' + data.cmid, JSON.stringify(data));
                } catch (e) {}
            }

            if (data.isPassable) {
                return {
                    count: 0,
                    isQuizLanding: true,
                    passed: true,
                    message: `Quiz already completed with passing grade (${data.highestPct}% ≥ 80%)! No further attempts required.`
                };
            }

            const startBtn = document.querySelector(
                'form[action*="attempt.php"] button, form[action*="attempt.php"] input[type="submit"], ' +
                '.quizstartbutton button, .quizstartbutton input[type="submit"], ' +
                '#region-main button.btn-primary, #region-main input.btn-primary'
            );
            if (startBtn) {
                count++;
                startBtn.classList.add('amaes-highlighted-item');
                startBtn.style.outline = '3px solid #f59e0b';
                startBtn.style.boxShadow = '0 0 15px rgba(245, 158, 11, 0.6)';

                const badge = document.createElement('span');
                badge.className = 'amaes-type-badge';
                badge.innerText = data.hasGrade
                    ? `NEEDS 80%+ (Current: ${data.highestPct}%)`
                    : 'UNATTEMPTED';
                badge.style.cssText = `
                    background: #f59e0b;
                    color: #000;
                    font-size: 10px;
                    font-weight: 800;
                    padding: 3px 8px;
                    border-radius: 4px;
                    margin-left: 8px;
                    display: inline-block;
                    vertical-align: middle;
                `;
                startBtn.parentNode.insertBefore(badge, startBtn.nextSibling);
                startBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (data.maxAttemptsReached) {
                return {
                    count: 0,
                    isQuizLanding: true,
                    message: `Max attempts reached (${data.attemptsUsed}/${data.attemptsAllowed}). Score: ${data.highestPct}%. No more attempts allowed.`
                };
            }

            return { count, isQuizLanding: true, attemptsUsed: data.attemptsUsed, attemptsAllowed: data.attemptsAllowed };
        } else if (isGrades) {
            const rows = Array.from(document.querySelectorAll('.user-grade tr, .generaltable tr, table.table tr, tr'));
            rows.forEach(r => {
                const quizLink = r.querySelector('a[href*="/mod/quiz/"], a[href*="quiz"], a.gradeitemheader')
                              || r.querySelector('.column-itemname a, th a, td:first-child a');
                if (!quizLink) return;

                const href = quizLink.getAttribute('href') || quizLink.href || '';
                const rawTitle = quizLink.innerText.trim();
                if (!rawTitle || (!href.includes('quiz') && !r.innerText.toLowerCase().includes('quiz'))) return;

                const rowText = r.innerText || '';
                if (rowText.includes('( Empty )') || rowText.includes('(Empty)')) return;

                // Check grade
                const gradeCell = r.querySelector('.column-grade, [headers*="grade"], td.grade');
                const pctCell = r.querySelector('.column-percentage, [headers*="percentage"]');
                let hasGrade = false;
                let pct = null;

                if (pctCell) {
                    const pText = pctCell.innerText.trim();
                    const mPct = pText.match(/(\d+(?:\.\d+)?)\s*%/);
                    if (mPct) {
                        pct = parseFloat(mPct[1]);
                        hasGrade = true;
                    }
                }

                if (gradeCell) {
                    const gText = gradeCell.innerText.trim();
                    if (gText && gText !== '-' && gText !== '–' && /\d/.test(gText)) {
                        hasGrade = true;
                        if (pct === null) {
                            const mFrac = gText.match(/(\d+(?:\.\d+)?)\s*(?:\/|\s*out of\s*)\s*(\d+(?:\.\d+)?)/i);
                            if (mFrac) {
                                const earned = parseFloat(mFrac[1]);
                                const max = parseFloat(mFrac[2]);
                                if (max > 0) pct = Math.round((earned / max) * 100);
                            } else {
                                const mNum = gText.match(/(\d+(?:\.\d+)?)/);
                                if (mNum && parseFloat(mNum[1]) <= 100) {
                                    pct = parseFloat(mNum[1]);
                                }
                            }
                        }
                    }
                }

                // Strict 80%+ Rule: Only grades >= 80% are accepted!
                const isAccepted = Boolean(hasGrade && pct !== null && pct >= 80);
                if (isAccepted) {
                    return; // Quiz passed and accepted! Do NOT highlight!
                }

                count++;
                r.classList.add('amaes-highlighted-item');
                r.style.background = 'rgba(245, 158, 11, 0.18)';
                r.style.outline = '2px solid #f59e0b';

                const badge = document.createElement('span');
                badge.className = 'amaes-type-badge';
                badge.innerText = (hasGrade && pct !== null) ? `NEEDS 80%+ (${pct}%)` : 'UNATTEMPTED';
                badge.style.cssText = `
                    background: #f59e0b;
                    color: #000;
                    font-size: 9px;
                    font-weight: 800;
                    padding: 1px 5px;
                    border-radius: 3px;
                    margin-left: 6px;
                    display: inline-block;
                    vertical-align: middle;
                `;
                quizLink.appendChild(badge);

                if (!firstScrolled) {
                    r.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstScrolled = true;
                }
            });
        } else if (isCourse) {
            const gradesMap = await fetchCourseGradesMap();
            const activities = Array.from(document.querySelectorAll(
                'li.activity, .activity-item, .course-section .activity, div[data-region="activity-card"]'
            ));

            const quizActivities = activities.filter(el => classifyActivity(el).type === 'quiz');

            for (const el of quizActivities) {
                const titleElem = el.querySelector('.instancename, .activityname, a.aal_link, .activity-title');
                const rawTitle = titleElem ? titleElem.innerText.trim() : (el.innerText.split('\n')[0] || '');
                const gradeInfo = evaluateQuizPassableGrade(el, rawTitle, gradesMap);

                // 1. Strict Acceptance Guard: Overall grade >= 80% is accepted! Never highlight as missing!
                if (gradeInfo.hasGrade && gradeInfo.percentage !== null && gradeInfo.percentage >= 80) {
                    continue;
                }

                // If gradesMap has no grade, check fallback completion only if gradesMap was empty
                if (!gradeInfo.hasGrade && (!gradesMap || Object.keys(gradesMap).length === 0)) {
                    if (isActivityAlreadyComplete(el)) {
                        continue;
                    }
                }

                let cmid = gradeInfo.cmid;
                const linkElem = el.querySelector('a[href*="/mod/quiz/view.php?id="], a[href*="id="]');
                if (!cmid && linkElem) {
                    const m = (linkElem.getAttribute('href') || linkElem.href || '').match(/[?&]id=(\d+)/);
                    if (m) cmid = m[1];
                }

                // Check cached attempt details
                let attemptsInfo = null;
                if (cmid) {
                    try {
                        const raw = localStorage.getItem('amaes_quiz_attempts_' + cmid);
                        if (raw) attemptsInfo = JSON.parse(raw);
                    } catch (e) {}
                }

                // If not cached and quiz link is available, fetch quiz landing to check attempt limits
                if (!attemptsInfo && linkElem && linkElem.href) {
                    try {
                        const resp = await fetch(linkElem.href);
                        if (resp.ok) {
                            const html = await resp.text();
                            const doc = new DOMParser().parseFromString(html, 'text/html');
                            attemptsInfo = parseQuizLandingData(doc, linkElem.href);
                            if (cmid) {
                                try {
                                    localStorage.setItem('amaes_quiz_attempts_' + cmid, JSON.stringify(attemptsInfo));
                                } catch (e) {}
                            }
                            if (attemptsInfo.hasGrade && attemptsInfo.highestPct !== null && attemptsInfo.highestPct >= 80) {
                                // Passed with >= 80%!
                                continue;
                            }
                        }
                    } catch (e) {}
                }

                const isMaxReached = attemptsInfo && attemptsInfo.maxAttemptsReached;
                const attemptsAllowed = attemptsInfo ? attemptsInfo.attemptsAllowed : null;
                const attemptsUsed = attemptsInfo ? attemptsInfo.attemptsUsed : null;
                const pct = (attemptsInfo && attemptsInfo.highestPct !== null) ? attemptsInfo.highestPct : gradeInfo.percentage;

                let badgeText = 'MISSING / PENDING';
                let badgeColor = '#f59e0b';
                let badgeTextColor = '#000000';

                if (isMaxReached) {
                    badgeText = pct !== null ? `MAX ATTEMPTS (${pct}%)` : 'MAX ATTEMPTS REACHED';
                    badgeColor = '#ef4444';
                    badgeTextColor = '#ffffff';
                } else if (pct !== null) {
                    if (attemptsAllowed !== null && attemptsUsed !== null) {
                        badgeText = `RE-ATTEMPT (${pct}% | ${attemptsUsed}/${attemptsAllowed})`;
                    } else {
                        badgeText = `NEEDS 80%+ (${pct}%)`;
                    }
                } else if (attemptsAllowed !== null) {
                    badgeText = `UNATTEMPTED (0/${attemptsAllowed})`;
                } else {
                    badgeText = 'MISSING / PENDING';
                }

                count++;
                el.classList.add('amaes-highlighted-item');
                el.style.position = 'relative';
                el.style.outline = `2px solid ${badgeColor}`;
                el.style.borderRadius = '8px';
                el.style.boxShadow = `0 0 12px ${badgeColor}66`;

                const badge = document.createElement('span');
                badge.className = 'amaes-type-badge';
                badge.innerText = badgeText;
                badge.style.cssText = `
                    position: absolute;
                    top: 6px;
                    right: 6px;
                    background: ${badgeColor};
                    color: ${badgeTextColor};
                    font-size: 9px;
                    font-weight: 800;
                    padding: 2px 6px;
                    border-radius: 4px;
                    z-index: 10;
                    pointer-events: none;
                    text-transform: uppercase;
                `;
                el.appendChild(badge);

                if (!firstScrolled) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    firstScrolled = true;
                }
            }
        }

        return { count, isGrades, isCourse, isQuizLanding };
    }

