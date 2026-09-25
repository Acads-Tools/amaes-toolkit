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

    function findButtons(goal = 'mark_done', category = 'lecture') {
        const results = [];
        const activityElements = document.querySelectorAll(
            'li.activity, .activity-item, .course-section .activity, div[data-region="activity-card"]'
        );

        const processedButtons = new Set();

        const scanBlock = (container) => {
            const buttons = container.querySelectorAll(
                'button[data-action="toggle-manual-completion"], ' +
                'button[data-toggletype], ' +
                'button.btn-outline-secondary, ' +
                'button.btn-outline-success, ' +
                'button.btn-success, ' +
                'button'
            );

            for (const btn of buttons) {
                if (processedButtons.has(btn)) continue;

                const text = (btn.innerText || btn.getAttribute('aria-label') || '').trim().toLowerCase();
                const toggleType = (btn.getAttribute('data-toggletype') || '').toLowerCase();

                const isCurrentlyDone =
                    toggleType === 'manual:undo' ||
                    text === 'done' ||
                    text.includes('completed') ||
                    btn.classList.contains('btn-success');

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
                    const classification = classifyActivity(container);
                    const titleElem = container.querySelector('.instancename, .activityname, a.aal_link, .activity-title');
                    const title = titleElem ? titleElem.innerText.trim() : (container.innerText.split('\n')[0] || 'Activity');

                    let matchesCategory = false;
                    if (category === 'all') matchesCategory = true;
                    else if (category === 'lecture' && (classification.type === 'lecture' || classification.type === 'video')) matchesCategory = true;
                    else if (category === 'quiz' && classification.type === 'quiz') matchesCategory = true;

                    if (matchesCategory) {
                        results.push({ button: btn, container, title, classification });
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

    // Auto-Highlight unanswered / missing quizzes on Grades or Course pages
    function highlightMissingOrUnansweredQuizzes() {
        clearAllHighlights();

        const isGrades = typeof window !== 'undefined' && window.location.pathname.includes('/grade/report/user/index.php');
        const isCourse = checkIsCoursePage();

        if (!isGrades && !isCourse) {
            return { count: 0, error: 'Not on a course or grades page', message: 'Open a course or Grades page first to highlight missing quizzes.' };
        }

        let count = 0;
        let firstScrolled = false;

        if (isGrades) {
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
                if (gradeCell) {
                    const gText = gradeCell.innerText.trim();
                    if (gText && gText !== '-' && gText !== '–' && /\d/.test(gText)) {
                        hasGrade = true;
                    }
                }
                if (!hasGrade && pctCell) {
                    const pText = pctCell.innerText.trim();
                    if (pText && pText !== '-' && pText !== '–' && !pText.includes('0.00') && /\d/.test(pText)) {
                        hasGrade = true;
                    }
                }

                if (!hasGrade) {
                    count++;
                    r.classList.add('amaes-highlighted-item');
                    r.style.background = 'rgba(245, 158, 11, 0.18)';
                    r.style.outline = '2px solid #f59e0b';

                    const badge = document.createElement('span');
                    badge.className = 'amaes-type-badge';
                    badge.innerText = 'UNATTEMPTED';
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
                }
            });
        } else if (isCourse) {
            const activities = Array.from(document.querySelectorAll(
                'li.activity, .activity-item, .course-section .activity, div[data-region="activity-card"]'
            ));
            activities.forEach(el => {
                const cls = classifyActivity(el);
                if (cls.type !== 'quiz') return;

                // Check if activity is already marked completed
                const isCompleted = el.classList.contains('completed') ||
                                    el.querySelector('.iscompleted, .badge-success, .text-success, button[aria-checked="true"], button[data-toggled="true"]');
                if (!isCompleted) {
                    count++;
                    el.classList.add('amaes-highlighted-item');
                    el.style.position = 'relative';
                    el.style.outline = '2px solid #f59e0b';
                    el.style.borderRadius = '8px';
                    el.style.boxShadow = '0 0 12px rgba(245, 158, 11, 0.4)';

                    const badge = document.createElement('span');
                    badge.className = 'amaes-type-badge';
                    badge.innerText = 'MISSING / PENDING';
                    badge.style.cssText = `
                        position: absolute;
                        top: 6px;
                        right: 6px;
                        background: #f59e0b;
                        color: #000000;
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
            });
        }

        return { count, isGrades, isCourse };
    }

