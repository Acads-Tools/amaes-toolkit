    // ==========================================
    // Update Checker & Release Notifier
    // ==========================================

    function isNewerVersion(remote, local) {
        const rVersion = normalizeVersion(remote);
        const lVersion = normalizeVersion(local);
        if (!rVersion || !lVersion) return false;
        const r = rVersion.split('.').map(n => parseInt(n, 10));
        const l = lVersion.split('.').map(n => parseInt(n, 10));
        for (let i = 0; i < Math.max(r.length, l.length); i++) {
            const rv = r[i] || 0;
            const lv = l[i] || 0;
            if (rv > lv) return true;
            if (rv < lv) return false;
        }
        return false;
    }

    function normalizeVersion(value) {
        const match = String(value || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)$/i);
        return match ? `${Number(match[1])}.${Number(match[2])}.${Number(match[3])}` : null;
    }

    function triggerScriptUpdate(targetVersion) {
        const ver = normalizeVersion(targetVersion);
        if (!ver || !isNewerVersion(ver, SCRIPT_VERSION)) {
            showToast(`No valid newer toolkit version was found. Please run Check for Updates again.`, 5000);
            return;
        }
        try {
            localStorage.setItem('amaes_pending_update_install', ver);
            localStorage.setItem('amaes_pending_update_time', String(Date.now()));
            localStorage.setItem('amaes_update_in_progress', '1');
        } catch (e) {}
        showToast(`Opening v${ver} installer... After confirming in Violentmonkey, page will auto-refresh!`, 6500);
        try {
            window.open(SCRIPT_RAW_URL, '_blank');
        } catch (e) {
            window.location.href = SCRIPT_RAW_URL;
        }

        // Fallback auto-refresh: In case student confirms update without switching focus (e.g. mobile popup), auto-refresh after 6s
        setTimeout(() => {
            const pending = localStorage.getItem('amaes_pending_update_install');
            if (pending && isNewerVersion(pending, SCRIPT_VERSION) && document.visibilityState === 'visible') {
                showToast(`Update v${ver} detected! Refreshing page to apply...`, 2000);
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            }
        }, 6000);
    }

    function injectTopNavUpdateNotification(latestVersion) {
        if (!latestVersion || !isNewerVersion(latestVersion, SCRIPT_VERSION)) return;

        const pendingRaw = localStorage.getItem('amaes_pending_update_install');
        const pending = pendingRaw && isNewerVersion(pendingRaw, SCRIPT_VERSION) ? pendingRaw : null;
        if (pendingRaw && !pending) {
            localStorage.removeItem('amaes_pending_update_install');
            localStorage.removeItem('amaes_pending_update_time');
            localStorage.removeItem('amaes_update_in_progress');
        }
        const existing = document.getElementById('amaes-topnav-update-item');
        if (pending) {
            if (existing) existing.remove();
            return;
        }

        if (existing) {
            existing.remove();
        }

        const navContainer = document.querySelector('#usernavigation, .usermenu, .popover-region, nav.navbar .ml-auto, nav.navbar .ms-auto, nav.navbar ul.navbar-nav:last-child');
        if (!navContainer) {
            setTimeout(() => injectTopNavUpdateNotification(latestVersion), 600);
            return;
        }

        const wrap = document.createElement('div');
        wrap.id = 'amaes-topnav-update-item';
        wrap.className = 'nav-item d-flex align-items-center me-2';
        wrap.style.cssText = `
            display: inline-flex;
            align-items: center;
            margin-right: 8px;
            z-index: 1050;
            vertical-align: middle;
        `;

        if (pending) {
            wrap.innerHTML = `
                <span class="btn btn-sm" style="
                    background: rgba(16, 185, 129, 0.16);
                    color: #a7f3d0 !important;
                    font-weight: 700;
                    font-size: 11px;
                    padding: 3px 11px;
                    border-radius: 20px;
                    border: 1px solid rgba(16, 185, 129, 0.45);
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    line-height: 1.3;
                " title="Update v${pending} is queued in the userscript manager">
                    ${ICONS.check} Update v${pending} queued
                </span>
            `;
        } else {
            wrap.innerHTML = `
                <button id="amaes-topnav-update-btn" type="button" class="btn btn-sm" style="
                    background: linear-gradient(135deg, #10b981, #059669);
                    color: #ffffff !important;
                    font-weight: 700;
                    font-size: 11px;
                    padding: 3px 11px;
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.3);
                    box-shadow: 0 1px 4px rgba(16, 185, 129, 0.3);
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    cursor: pointer;
                    line-height: 1.3;
                    white-space: nowrap;
                " title="New version v${latestVersion} available! Click to open update in script manager">
                    ${ICONS.download} Update Toolkit (v${latestVersion})
                </button>
            `;
        }

        const updateBtn = wrap.querySelector('#amaes-topnav-update-btn');
        if (updateBtn) {
            updateBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                triggerScriptUpdate(latestVersion);
                injectTopNavUpdateNotification(latestVersion);
            };
        }

        if (navContainer.firstChild) {
            navContainer.insertBefore(wrap, navContainer.firstChild);
        } else {
            navContainer.appendChild(wrap);
        }
    }

    function checkPendingUpdateInstallation() {
        try {
            const pending = localStorage.getItem('amaes_pending_update_install');
            const lastSeen = localStorage.getItem('amaes_last_seen_version');

            if (pending && !isNewerVersion(pending, SCRIPT_VERSION)) {
                localStorage.removeItem('amaes_pending_update_install');
                localStorage.removeItem('amaes_pending_update_time');
                localStorage.removeItem('amaes_update_in_progress');

                const cachedLatest = localStorage.getItem('amaes_latest_version_seen');
                if (cachedLatest && !isNewerVersion(cachedLatest, SCRIPT_VERSION)) {
                    localStorage.removeItem('amaes_latest_version_seen');
                }

                setTimeout(() => {
                    showToast(`Toolkit successfully updated to ${SCRIPT_VERSION}!`, 5000);
                    setLog(`Toolkit successfully updated to <b>${SCRIPT_VERSION}</b>. All features active.`, "var(--accent-green)");
                }, 600);
            } else if (lastSeen && isNewerVersion(SCRIPT_VERSION, lastSeen)) {
                const cachedLatest = localStorage.getItem('amaes_latest_version_seen');
                if (cachedLatest && !isNewerVersion(cachedLatest, SCRIPT_VERSION)) {
                    localStorage.removeItem('amaes_latest_version_seen');
                }

                setTimeout(() => {
                    showToast(`Toolkit updated to ${SCRIPT_VERSION}!`, 4500);
                    setLog(`Toolkit updated to <b>${SCRIPT_VERSION}</b>.`, "var(--accent-green)");
                }, 600);
            }

            localStorage.setItem('amaes_last_seen_version', SCRIPT_VERSION);
        } catch (e) {
            logDebug(`Error checking pending update: ${e.message}`);
        }
    }

    function setupPendingUpdateFocusListener() {
        let lastFocusPrompt = 0;
        let isReloading = false;
        const handleReturnFocus = () => {
            try {
                if (isReloading) return;
                const pendingRaw = localStorage.getItem('amaes_pending_update_install');
                const pending = pendingRaw && isNewerVersion(pendingRaw, SCRIPT_VERSION) ? pendingRaw : null;
                const latestKnown = normalizeVersion(localStorage.getItem('amaes_latest_version_seen'));

                if (!pending || (latestKnown && isNewerVersion(latestKnown, pending))) {
                    if (pending && latestKnown && isNewerVersion(latestKnown, pending)) {
                        localStorage.removeItem('amaes_pending_update_install');
                        localStorage.removeItem('amaes_pending_update_time');
                    }
                    return;
                }

                if (!isNewerVersion(pending, SCRIPT_VERSION)) {
                    localStorage.removeItem('amaes_pending_update_install');
                    return;
                }

                const now = Date.now();
                if (now - lastFocusPrompt < 2000) return;
                lastFocusPrompt = now;

                const updateTime = Number(localStorage.getItem('amaes_pending_update_time') || 0);
                const elapsed = now - updateTime;

                // Auto-refresh when student returns from confirming in Violentmonkey / script manager
                if (elapsed >= 1000) {
                    isReloading = true;
                    showToast(`Update detected! Refreshing page to apply v${pending}...`, 2500);
                    setTimeout(() => {
                        window.location.reload();
                    }, 1000);
                } else {
                    showToast(`Update v${pending} is queued in Violentmonkey. It will apply when the userscript manager reloads the script.`, 5000);
                }
            } catch (e) {}
        };

        window.addEventListener('focus', handleReturnFocus);
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                handleReturnFocus();
            }
        });
    }

    function renderUpdateNotice(latestVersion) {
        const pendingRaw = localStorage.getItem('amaes_pending_update_install');
        const pending = pendingRaw &&
            isNewerVersion(pendingRaw, SCRIPT_VERSION) &&
            !isNewerVersion(latestVersion, pendingRaw) ? pendingRaw : null;
        if (pendingRaw && !pending) {
            localStorage.removeItem('amaes_pending_update_install');
            localStorage.removeItem('amaes_pending_update_time');
        }

        // 1. Persistent Header "Update Now" Button
        const titleGroup = document.getElementById('amaes-title-group');
        if (titleGroup) {
            let headerUpdateBtn = document.getElementById('amaes-header-update-btn');
            if (headerUpdateBtn) {
                headerUpdateBtn.remove(); // Keep header clean and prevent overlapping action icons
            }
        }

        // 2. Version Pill Update Indicator & Direct Link
        const versionPill = document.getElementById('amaes-version-pill');
        if (versionPill) {
            const targetVer = latestVersion.startsWith('v') ? latestVersion : `v${latestVersion}`;
            const targetPending = pending ? (pending.startsWith('v') ? pending : `v${pending}`) : '';
            if (pending) {
                versionPill.innerHTML = `${SCRIPT_VERSION} <span style="font-size: 8px; margin-left: 2px; color: #f59e0b; font-weight: 800;">→ ${targetPending}</span>`;
                versionPill.title = `Update ${targetPending} is waiting for confirmation in Violentmonkey`;
                versionPill.style.borderColor = '#f59e0b';
                versionPill.style.color = '#f59e0b';
                versionPill.onclick = () => window.location.reload();
            } else {
                versionPill.innerHTML = `${SCRIPT_VERSION} <span style="display: inline-flex; align-items: center; background: #10b981; color: #fff; padding: 0 4px; border-radius: 3px; font-size: 8px; margin-left: 2px; font-weight: 800; letter-spacing: 0; white-space: nowrap;">→ ${targetVer}</span>`;
                versionPill.title = `Update available: ${targetVer}. Click to install`;
                versionPill.style.borderColor = '#10b981';
                versionPill.style.color = '#10b981';
                versionPill.onclick = () => triggerScriptUpdate(latestVersion);
            }
        }

        // 3. Top-Right Persistent Notification Area Update Item
        injectTopNavUpdateNotification(latestVersion);

        // 5. Persistent Banner in Panel Body
        const container = document.getElementById('amaes-update-container');
        if (container) {
            if (pending) {
                container.innerHTML = `
                    <div id="amaes-update-banner" style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        padding: 6px 10px;
                        background: linear-gradient(135deg, rgba(16, 185, 129, 0.18), rgba(5, 150, 105, 0.25));
                        border: 1px solid rgba(16, 185, 129, 0.5);
                        border-radius: 6px;
                        margin-bottom: 8px;
                        font-size: 11px;
                        animation: amaesFadeIn 0.3s ease;
                        cursor: pointer;
                    " title="Click to refresh page and apply update immediately">
                        <div style="display: flex; align-items: center; gap: 6px; min-width: 0; color: #a7f3d0;">
                            <span style="font-weight: 700; white-space: nowrap; font-size: 11px;">
                                Update v${pending} Ready
                            </span>
                        </div>
                        <span style="font-size: 10px; color: #a7f3d0; white-space: nowrap;">
                            Auto-refreshing on return...
                        </span>
                    </div>
                `;
                const bEl = document.getElementById('amaes-update-banner');
                if (bEl) {
                    bEl.onclick = () => window.location.reload();
                }
            } else {
                container.innerHTML = `
                    <div id="amaes-update-banner" style="
                        display: flex;
                        align-items: center;
                        justify-content: space-between;
                        gap: 8px;
                        padding: 6px 10px;
                        background: linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(5, 150, 105, 0.2));
                        border: 1px solid rgba(16, 185, 129, 0.45);
                        border-radius: 6px;
                        margin-bottom: 8px;
                        font-size: 11px;
                        animation: amaesFadeIn 0.3s ease;
                    ">
                        <div style="display: flex; align-items: center; gap: 6px; min-width: 0; color: #a7f3d0;">
                            ${ICONS.download}
                            <span style="font-weight: 700; white-space: nowrap; font-size: 11px;">
                                Update v${latestVersion} Available
                            </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                            <button id="amaes-banner-update-btn" type="button" class="amaes-btn amaes-btn-primary" style="
                                padding: 3px 11px;
                                font-size: 11px;
                                font-weight: 800;
                                white-space: nowrap;
                                border-radius: 4px;
                                display: inline-flex;
                                align-items: center;
                                gap: 4px;
                                background: linear-gradient(135deg, #10b981, #059669);
                                color: #ffffff !important;
                                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                                border: none;
                                cursor: pointer;
                                flex-shrink: 0;
                            ">
                                Update Now
                            </button>
                        </div>
                    </div>
                `;
            }
            const bUpdate = document.getElementById('amaes-banner-update-btn');
            if (bUpdate) {
                bUpdate.onclick = () => {
                    triggerScriptUpdate(latestVersion);
                    renderUpdateNotice(latestVersion);
                };
            }
        } else {
            setTimeout(() => renderUpdateNotice(latestVersion), 400);
        }

        // 6. Welcome Guide Modal Update Status
        const welcomeUpdateNow = document.getElementById('btn-welcome-update-now');
        if (welcomeUpdateNow) {
            const pending = localStorage.getItem('amaes_pending_update_install');
            if (pending) {
                welcomeUpdateNow.innerHTML = `${ICONS.check} <span>Update Queued</span>`;
                welcomeUpdateNow.disabled = true;
                welcomeUpdateNow.onclick = null;
            } else {
                welcomeUpdateNow.innerHTML = `${ICONS.download} <span>Update Now (v${latestVersion})</span>`;
                welcomeUpdateNow.onclick = (e) => {
                    e.preventDefault();
                    triggerScriptUpdate(latestVersion);
                    welcomeUpdateNow.innerHTML = `${ICONS.check} <span>Update Queued</span>`;
                    welcomeUpdateNow.disabled = true;
                    welcomeUpdateNow.onclick = null;
                };
            }
        }

        // 7. Quiz Floating HUD Update Button
        const hudUpdateIndicator = document.getElementById('hud-update-indicator');
        if (hudUpdateIndicator) {
            hudUpdateIndicator.style.display = pending ? 'none' : 'inline-flex';
            hudUpdateIndicator.onclick = (e) => {
                e.preventDefault();
                triggerScriptUpdate(latestVersion);
            };
        }
    }

    function checkForScriptUpdates(manual = false, callback = null) {
        const cachedRaw = localStorage.getItem('amaes_latest_version_seen');
        const cachedLatest = normalizeVersion(cachedRaw);
        if (cachedRaw && !cachedLatest) {
            localStorage.removeItem('amaes_latest_version_seen');
        }
        const lastCheck = parseInt(localStorage.getItem('amaes_last_update_check') || '0', 10);
        const now = Date.now();

        const hasKnownUpdate = cachedLatest && isNewerVersion(cachedLatest, SCRIPT_VERSION);

        // 1. If an update is ALREADY known from cache:
        if (hasKnownUpdate && !manual) {
            renderUpdateNotice(cachedLatest);
        }

        // 2. Cache throttling: 5 minutes for background auto-check, 10 seconds for manual
        const throttleWindow = manual ? 10 * 1000 : 5 * 60 * 1000;
        if (!manual && (now - lastCheck < throttleWindow)) {
            if (callback) callback({ status: hasKnownUpdate ? 'update_available' : 'cached', version: cachedLatest || SCRIPT_VERSION });
            return;
        }

        if (manual) {
            setLog("Auto-checking GitHub for toolkit updates...", "var(--accent-blue)", "Querying releases...");
        }

        const req = (typeof GM_xmlhttpRequest !== 'undefined') ? GM_xmlhttpRequest :
                    (typeof GM !== 'undefined' && GM.xmlHttpRequest) ? GM.xmlHttpRequest : null;

        const processRemoteVersion = (remoteVer) => {
            localStorage.setItem('amaes_last_update_check', String(now));
            const validRemoteVersion = normalizeVersion(remoteVer);
            if (!validRemoteVersion) {
                if (manual) setLog("GitHub returned an invalid release version.", "var(--accent-amber)");
                if (callback) callback({ status: 'error', message: 'Invalid release version' });
                return;
            }
            remoteVer = validRemoteVersion;

            if (isNewerVersion(remoteVer, SCRIPT_VERSION)) {
                localStorage.setItem('amaes_latest_version_seen', remoteVer);
                renderUpdateNotice(remoteVer);
                setLog(`Update found: <b>v${remoteVer}</b> is available! Opening installer...`, 'var(--accent-green)');
                showToast(`Update found: v${remoteVer} is available!`, 4000);
                if (manual) {
                    triggerScriptUpdate(remoteVer);
                }
                if (callback) callback({ status: 'update_available', version: remoteVer });
            } else {
                localStorage.removeItem('amaes_latest_version_seen');
                localStorage.removeItem('amaes_pending_update_install');
                localStorage.removeItem('amaes_pending_update_time');
                localStorage.removeItem('amaes_update_in_progress');
                document.getElementById('amaes-topnav-update-item')?.remove();
                document.getElementById('amaes-update-banner')?.remove();
                if (manual) {
                    setLog(`Toolkit is up to date (<b>${SCRIPT_VERSION}</b>).`, 'var(--accent-green)');
                    showToast(`Toolkit is up to date (${SCRIPT_VERSION})`);
                }
                if (callback) callback({ status: 'up_to_date', version: SCRIPT_VERSION });
            }
        };

        const checkViaRawUrl = () => {
            const rawUrl = `${SCRIPT_RAW_URL}?_t=${now}`;
            const parseRaw = (text) => {
                const m = text.match(/@version\s+([0-9]+\.[0-9]+\.[0-9]+)/);
                if (m && m[1]) {
                    processRemoteVersion(m[1].trim());
                } else {
                    if (manual) setLog("Unable to verify update header.", "var(--accent-amber)");
                    if (callback) callback({ status: 'error', message: 'Could not parse version' });
                }
            };

            if (req) {
                try {
                    req({
                        method: 'GET',
                        url: rawUrl,
                        headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate', 'Pragma': 'no-cache' },
                        onload: (res) => parseRaw(res.responseText || ''),
                        onerror: (err) => {
                            logDebug("Raw update check error:", err);
                            if (manual) setLog("Network error checking updates.", "var(--accent-red)");
                            if (callback) callback({ status: 'error', error: err });
                        }
                    });
                } catch (e) {
                    if (manual) setLog("Exception checking updates.", "var(--accent-red)");
                    if (callback) callback({ status: 'error', error: e });
                }
            } else {
                fetch(rawUrl, { cache: 'no-store' })
                    .then(r => r.text())
                    .then(parseRaw)
                    .catch(err => {
                        logDebug("Fetch update error:", err);
                        if (manual) setLog("Network error checking updates.", "var(--accent-red)");
                        if (callback) callback({ status: 'error', error: err });
                    });
            }
        };

        // Query GitHub API Releases first for instantaneous 0-delay tag detection
        const apiUrl = `https://api.github.com/repos/Acads-Tools/amaes-toolkit/releases/latest?_t=${now}`;
        if (req) {
            try {
                req({
                    method: 'GET',
                    url: apiUrl,
                    headers: { 'Accept': 'application/vnd.github.v3+json', 'Cache-Control': 'no-cache' },
                    onload: (res) => {
                        try {
                            const data = JSON.parse(res.responseText || '{}');
                            if (data && data.tag_name) {
                                const ver = normalizeVersion(data.tag_name);
                                if (isNewerVersion(ver, SCRIPT_VERSION)) {
                                    processRemoteVersion(ver);
                                    return;
                                }
                            }
                        } catch (e) {}
                        checkViaRawUrl();
                    },
                    onerror: () => checkViaRawUrl()
                });
            } catch (e) {
                checkViaRawUrl();
            }
        } else {
            fetch(apiUrl, { cache: 'no-store' })
                .then(r => r.json())
                .then(data => {
                    if (data && data.tag_name) {
                        const ver = normalizeVersion(data.tag_name);
                        if (isNewerVersion(ver, SCRIPT_VERSION)) {
                            processRemoteVersion(ver);
                            return;
                        }
                    }
                    checkViaRawUrl();
                })
                .catch(() => checkViaRawUrl());
        }
    }

