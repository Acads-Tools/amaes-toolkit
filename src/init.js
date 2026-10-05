    async function initializeToolkit() {
        await handleAccountSwitcherNavigation();
        if (isUserLoggedIn()) {
            await completeAccountSwitcherLoginCapture();
            if (await completeAccountSwitcherReturn()) return;
        } else {
            await setupAccountSwitcherLoginCapture();
            logDebug("User not logged in; skipping UI mounting.");
            return;
        }
        if (!(await verifyClientCompatibility())) return;

        checkPendingUpdateInstallation();
        setupPendingUpdateFocusListener();
        document.getElementById('amaes-topbar-version-badge')?.remove();

        const cachedLatest = localStorage.getItem('amaes_latest_version_seen');
        if (cachedLatest && isNewerVersion(cachedLatest, SCRIPT_VERSION)) {
            injectTopNavUpdateNotification(cachedLatest);
        } else {
            localStorage.removeItem('amaes_latest_version_seen');
            document.getElementById('amaes-topnav-update-item')?.remove();
        }

        createPanel();
        checkForScriptUpdates(false);

        // Strict Terms Acceptance Guard: if not acknowledged, pause all tools except update checking
        const isTermsAccepted = localStorage.getItem('amaes_terms_acknowledged') === 'true';
        if (!isTermsAccepted) {
            autoQuizMode = false;
            localStorage.setItem('amaes_auto_quiz_mode', 'false');
            showWelcomeOnboardingModal(false);
            logDebug("Terms not acknowledged. Toolkit paused in locked state.");
            return;
        }

        startCapabilityTips();
        setupQuizAutomation();
        setupQuizKeyboardShortcuts();
        setupBreadcrumbListeners();
        if (typeof setupAutoViewBadges === 'function') {
            setupAutoViewBadges();
            if (typeof checkIsCoursePage === 'function' && checkIsCoursePage()) {
                let courseViewDebounce = null;
                const courseViewObs = new MutationObserver(() => {
                    if (courseViewDebounce) clearTimeout(courseViewDebounce);
                    courseViewDebounce = setTimeout(() => {
                        setupAutoViewBadges();
                    }, 400);
                });
                const mainTarget = document.getElementById('region-main') || document.querySelector('.course-content') || document.body;
                if (mainTarget) {
                    courseViewObs.observe(mainTarget, { childList: true, subtree: true });
                }
            }
        }
        showWelcomeOnboardingModal(false);
        injectDashboardCourseBadges();
        injectCourseReviewabilityNotice();
        sendPassiveTelemetryPulse();

        if (checkIsQuizViewPage() || checkIsQuizSummaryPage()) {
            promoteAttemptEvidenceFromScore();
            setTimeout(() => {
                try { promoteAttemptEvidenceFromScore(); } catch (_) {}
            }, 800);
        }

        if (checkIsQuizViewPage()) {
            try {
                const landingData = parseQuizLandingData();
                if (landingData && landingData.cmid) {
                    localStorage.setItem('amaes_quiz_attempts_' + landingData.cmid, JSON.stringify(landingData));
                }
            } catch (_) {}
        }

        // Auto-Harvest past quizzes: scan Grade Report once per session per course or all courses on dashboard
        if (autoHarvestGrades) {
            try {
                const isGradesPage = window.location.pathname.includes('/grade/report/user/index.php');
                const isCoursePage = window.location.pathname.includes('/course/view.php');
                const isDashboard = window.location.pathname.includes('/my/') || window.location.pathname.includes('courses.php');

                if (isDashboard) {
                    if (!sessionStorage.getItem('amaes_dash_harvested')) {
                        sessionStorage.setItem('amaes_dash_harvested', '1');
                        setTimeout(() => {
                            setLog("Auto-Harvest: Scanning all enrolled courses in background...", "var(--accent-blue)", "Auto-populating database with past verified answers");
                            executeGradesHarvester();
                        }, 2500);
                    }
                } else if (isGradesPage || isCoursePage) {
                    const cInfo = detectCourseInfo();
                    const courseKey = (cInfo && cInfo.subjectCode && cInfo.subjectCode !== 'DEFAULT' && cInfo.subjectCode !== 'GENERAL')
                        ? cInfo.subjectCode
                        : (cInfo?.courseId || new URLSearchParams(window.location.search).get('id') || 'grades');
                    const sessKey = `amaes_grades_harvested_${courseKey}`;
                    if (!sessionStorage.getItem(sessKey)) {
                        sessionStorage.setItem(sessKey, '1');
                        setTimeout(() => {
                            setLog(`Auto-Harvest: Scanning past quizzes for <b>${courseKey}</b>...`, "var(--accent-blue)");
                            executeGradesHarvester();
                        }, 1800);
                    }
                }
            } catch (e) {
                logDebug(`Auto grades harvest error: ${e.message}`);
            }
        }

        // Auto Cloud Sync: sync answers from community repository once per session in background
        if (autoCloudSync) {
            try {
                const cInfo = detectCourseInfo();
                const sc = cInfo ? cInfo.subjectCode : null;
                if (sc && sc !== 'GENERAL' && sc !== 'DEFAULT' && !sessionStorage.getItem(`amaes_cloud_synced_${sc}`)) {
                    sessionStorage.setItem(`amaes_cloud_synced_${sc}`, '1');
                    setLog(`Auto-syncing community database for <b>${sc}</b>...`, "var(--accent-blue)");
                    syncAnswersFromCloud(sc, null, cInfo.subjectName || '').then(async (res) => {
                        if (res && res.count > 0) {
                            const jennyCount = res.jennysonlineCount || 0;
                            showToast(`Loaded ${res.cachedCount || 0} cached entries and ${jennyCount} unconfirmed Jenny suggestions for ${sc}.`);
                            setLog(`Loaded <b>${res.cachedCount || 0}</b> cached entries and <b>${jennyCount}</b> locally cached, unconfirmed Jenny suggestions for <b>${sc}</b>.`, "var(--accent-green)");
                            const fresh = getCachedAnswers(sc);
                            const lbl = document.getElementById('fetch-btn-label');
                            if (lbl && fresh) lbl.innerText = `Refresh Answers (${fresh.length} cached)`;
                            if (checkIsQuizPage()) {
                                const jennyAnswers = jennyCount > 0 ? await loadJennysonlineAnswersForCourse(sc) : [];
                                highlightQuizAnswers((fresh || []).concat(jennyAnswers), false);
                            }
                        } else if (autoScrapeAmauoed) {
                            const link = await autoFindAmauoedLink(sc, cInfo.subjectName || '');
                            if (link) {
                                const scraped = await loadAllAmauoedAnswers(link);
                                if (scraped && scraped.length > 0) {
                                    mergeAnswersIntoCache(sc, scraped, 'AMAUOED');
                                    showToast(`Auto-scraped ${scraped.length} answers from AMAUOED for ${sc}!`);
                                    setLog(`Auto-scraped <b>${scraped.length}</b> answers for <b>${sc}</b> from AMAUOED.`, "var(--accent-green)");
                                    const fresh = getCachedAnswers(sc);
                                    const lbl = document.getElementById('fetch-btn-label');
                                    if (lbl && fresh) lbl.innerText = `Refresh Answers (${fresh.length} cached)`;
                                    if (checkIsQuizPage()) {
                                        highlightQuizAnswers(fresh, false);
                                    }
                                }
                            }
                        }
                    }).catch(async (err) => {
                        logDebug(`Auto cloud sync note for ${sc}: ${err.message}`);
                        if (autoScrapeAmauoed) {
                            const link = await autoFindAmauoedLink(sc, cInfo.subjectName || '');
                            if (link) {
                                const scraped = await loadAllAmauoedAnswers(link);
                                if (scraped && scraped.length > 0) {
                                    mergeAnswersIntoCache(sc, scraped, 'AMAUOED');
                                    showToast(`Auto-scraped ${scraped.length} answers from AMAUOED for ${sc}!`);
                                    setLog(`Auto-scraped <b>${scraped.length}</b> answers for <b>${sc}</b> from AMAUOED.`, "var(--accent-green)");
                                    const fresh = getCachedAnswers(sc);
                                    const lbl = document.getElementById('fetch-btn-label');
                                    if (lbl && fresh) lbl.innerText = `Refresh Answers (${fresh.length} cached)`;
                                    if (checkIsQuizPage()) {
                                        highlightQuizAnswers(fresh, false);
                                    }
                                }
                            }
                        }
                    });
                }
            } catch (e) {
                logDebug(`Auto cloud sync error: ${e.message}`);
            }

            // Dashboard Auto-Sync: automatically sync all detected courses visible on dashboard
            try {
                const isDashboard = window.location.pathname.includes('/my/') || window.location.pathname.includes('courses.php') || window.location.pathname === '/' || window.location.pathname.endsWith('/index.php');
                if (isDashboard) {
                    setTimeout(() => {
                        const dashCourses = detectDashboardCourses();
                        dashCourses.forEach(c => {
                            if (c.code && !sessionStorage.getItem(`amaes_cloud_synced_${c.code}`)) {
                                sessionStorage.setItem(`amaes_cloud_synced_${c.code}`, '1');
                                syncAnswersFromCloud(c.code, null, c.title || '').then(res => {
                                    if (res && res.count > 0) {
                                        injectDashboardCourseBadges();
                                    }
                                }).catch(async (e) => {
                                    logDebug(`Dashboard auto-sync note for ${c.code}: ${e.message}`);
                                    if (autoScrapeAmauoed) {
                                        const link = await autoFindAmauoedLink(c.code, c.title || '');
                                        if (link) {
                                            const scraped = await loadAllAmauoedAnswers(link);
                                            if (scraped && scraped.length > 0) {
                                                mergeAnswersIntoCache(c.code, scraped, 'AMAUOED');
                                                injectDashboardCourseBadges();
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    }, 1200);
                }
            } catch (e) {
                logDebug(`Dashboard auto-sync error: ${e.message}`);
            }
        }

        // Observe DOM mutations on dashboard to tag dynamically loaded course cards & auto-sync
        if (window.location.pathname.includes('/my/') || window.location.pathname.includes('courses.php')) {
            let debounceTimer = null;
            const obs = new MutationObserver(() => {
                injectDashboardCourseBadges();
                if (autoCloudSync) {
                    if (debounceTimer) clearTimeout(debounceTimer);
                    debounceTimer = setTimeout(() => {
                        const dashCourses = detectDashboardCourses();
                        dashCourses.forEach(c => {
                            if (c.code && !sessionStorage.getItem(`amaes_cloud_synced_${c.code}`)) {
                                sessionStorage.setItem(`amaes_cloud_synced_${c.code}`, '1');
                                syncAnswersFromCloud(c.code, null, c.title || '').then(res => {
                                    if (res && res.count > 0) {
                                        injectDashboardCourseBadges();
                                    }
                                }).catch(async (e) => {
                                    logDebug(`Dashboard observer auto-sync note for ${c.code}: ${e.message}`);
                                    if (autoScrapeAmauoed) {
                                        const link = await autoFindAmauoedLink(c.code, c.title || '');
                                        if (link) {
                                            const scraped = await loadAllAmauoedAnswers(link);
                                            if (scraped && scraped.length > 0) {
                                                mergeAnswersIntoCache(c.code, scraped, 'AMAUOED');
                                                injectDashboardCourseBadges();
                                            }
                                        }
                                    }
                                });
                            }
                        });
                    }, 1500);
                }
            });
            obs.observe(document.body, { childList: true, subtree: true });
        }

    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeToolkit);
    } else {
        initializeToolkit();
    }

})();
