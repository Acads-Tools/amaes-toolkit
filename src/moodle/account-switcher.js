    const ACCOUNT_SWITCHER_ACCOUNTS_KEY = 'amaes_account_switcher_accounts';
    const ACCOUNT_SWITCHER_RETURN_KEY = 'amaes_account_switcher_return_url';
    const ACCOUNT_SWITCHER_PENDING_KEY = 'amaes_account_switcher_pending';
    const ACCOUNT_SWITCHER_RETURN_OPTION_KEY = 'amaes_account_switcher_return_enabled';
    const ACCOUNT_SWITCHER_LOGIN_CAPTURE_KEY = 'amaes_account_switcher_login_capture';
    const ACCOUNT_SWITCHER_INTENT_TTL_MS = 10 * 60 * 1000;

    async function getAccountSwitcherValue(key, fallbackValue = null) {
        if (typeof GM_getValue !== 'function') {
            throw new Error('Account Switcher requires a userscript manager with GM storage support.');
        }
        return await GM_getValue(key, fallbackValue);
    }

    async function setAccountSwitcherValue(key, value) {
        if (typeof GM_setValue !== 'function') {
            throw new Error('Account Switcher requires a userscript manager with GM storage support.');
        }
        await GM_setValue(key, value);
    }

    async function deleteAccountSwitcherValue(key) {
        if (typeof GM_deleteValue !== 'function') {
            throw new Error('Account Switcher requires a userscript manager with GM storage support.');
        }
        await GM_deleteValue(key);
    }

    async function getAccountSwitcherAccounts() {
        const stored = await getAccountSwitcherValue(ACCOUNT_SWITCHER_ACCOUNTS_KEY, []);
        const accounts = typeof stored === 'string' ? JSON.parse(stored) : stored;
        if (!Array.isArray(accounts)) {
            throw new Error('Saved Account Switcher data is invalid. Remove and re-add the affected accounts.');
        }
        return accounts.filter(account =>
            account &&
            typeof account.id === 'string' &&
            typeof account.username === 'string' &&
            typeof account.password === 'string' &&
            typeof account.nickname === 'string'
        );
    }

    async function saveAccountSwitcherAccounts(accounts) {
        await setAccountSwitcherValue(ACCOUNT_SWITCHER_ACCOUNTS_KEY, accounts);
    }

    function accountSwitcherSetStatus(message, isError = false) {
        const status = document.getElementById('amaes-account-switcher-status');
        if (status) {
            status.textContent = message;
            status.style.color = isError ? 'var(--accent-pink, #f43f5e)' : 'var(--text-secondary)';
        }
        if (isError) console.error(`[AMAES Account Switcher] ${message}`);
    }

    function accountSwitcherIsVisible(element) {
        return Boolean(element && element.getClientRects().length);
    }

    function findAccountSwitcherLogoutLink() {
        const links = Array.from(document.querySelectorAll('a[href]'));
        const hrefMatch = links.find(link => {
            if (!accountSwitcherIsVisible(link)) return false;
            try {
                const url = new URL(link.href, window.location.href);
                return url.origin === window.location.origin && /\/logout\.php$/i.test(url.pathname);
            } catch (_) {
                return false;
            }
        });
        if (hrefMatch) return hrefMatch;

        const menu = document.querySelector('.usermenu .dropdown-menu, [data-region="popover-region-container"], [data-region="user-menu"]');
        if (!menu) return null;
        return Array.from(menu.querySelectorAll('a, button')).find(element =>
            accountSwitcherIsVisible(element) && /^log\s*out$/i.test((element.textContent || '').trim())
        ) || null;
    }

    function findAccountSwitcherProfileToggle() {
        const selectors = [
            '#user-menu-toggle',
            '[data-region="user-menu-toggle"]',
            '.usermenu .dropdown-toggle',
            '#action-menu-toggle-0'
        ];
        for (const selector of selectors) {
            const toggle = document.querySelector(selector);
            if (accountSwitcherIsVisible(toggle)) return toggle;
        }
        return null;
    }

    function findAccountSwitcherLogoutConfirmation() {
        const candidates = Array.from(document.querySelectorAll(
            'button, input[type="submit"], input[type="button"], a.btn, [role="button"]'
        ));
        return candidates.find(element => {
            const label = (element.textContent || element.value || '').trim();
            return accountSwitcherIsVisible(element) && /^log\s*out$/i.test(label);
        }) || null;
    }

    function findAccountSwitcherLoginFields() {
        const username = document.querySelector(
            '#username, input[name="username"], input[autocomplete="username"]'
        );
        const password = document.querySelector(
            '#password, input[name="password"], input[autocomplete="current-password"]'
        );
        if (!username || !password || !username.form || username.form !== password.form) return null;
        return { username, password, form: username.form };
    }

    function getCurrentAccountSwitcherProfileName() {
        const selectors = [
            '.usermenu .usertext',
            '[data-region="user-menu-toggle"] .usertext',
            '#user-menu-toggle .usertext',
            '.logininfo a[href*="/user/profile.php"]',
            '#user-menu-toggle',
            '[data-region="user-menu-toggle"]'
        ];
        for (const selector of selectors) {
            const element = document.querySelector(selector);
            const value = (element?.getAttribute('aria-label') || element?.textContent || '').replace(/\s+/g, ' ').trim();
            if (value && !/^user menu$/i.test(value)) return value;
        }
        return '';
    }

    function normalizeAccountSwitcherIdentity(value) {
        return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
    }

    async function setupAccountSwitcherLoginCapture() {
        if (window.location.hostname !== 'semestral.amaes.com') return;
        const loginFields = findAccountSwitcherLoginFields();
        if (!loginFields || loginFields.form.querySelector('#amaes-login-save-account')) return;
        try {
            const previousCapture = await getAccountSwitcherValue(ACCOUNT_SWITCHER_LOGIN_CAPTURE_KEY, null);
            if (previousCapture) await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_LOGIN_CAPTURE_KEY);
        } catch (error) {
            console.error(`[AMAES Account Switcher] Could not clear an earlier login save: ${error.message || error}`);
        }

        const container = document.createElement('div');
        container.style.cssText = 'margin: 10px 0; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px;';
        let savedAccounts = [];
        try {
            savedAccounts = await getAccountSwitcherAccounts();
        } catch (error) {
            console.error(`[AMAES Account Switcher] Could not load quick-login accounts: ${error.message || error}`);
        }
        if (savedAccounts.length > 0) {
            const quickSwitch = document.createElement('div');
            quickSwitch.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 5px; margin-bottom: 8px;';
            const quickSwitchLabel = document.createElement('span');
            quickSwitchLabel.textContent = 'Quick sign in:';
            quickSwitchLabel.style.cssText = 'font-size: 12px; font-weight: 600; color: #374151;';
            quickSwitch.appendChild(quickSwitchLabel);
            savedAccounts.forEach(account => {
                const quickLoginButton = document.createElement('button');
                quickLoginButton.type = 'button';
                quickLoginButton.textContent = account.nickname;
                quickLoginButton.title = `Sign in as ${account.nickname}`;
                quickLoginButton.style.cssText = 'max-width: 100%; padding: 5px 8px; border: 1px solid #9ca3af; border-radius: 5px; background: #f3f4f6; color: #111827; font-size: 12px; cursor: pointer;';
                quickLoginButton.addEventListener('click', () => {
                    accountSwitcherSetInputValue(loginFields.username, account.username);
                    accountSwitcherSetInputValue(loginFields.password, account.password);
                    loginFields.form.requestSubmit();
                });
                quickSwitch.appendChild(quickLoginButton);
            });
            container.appendChild(quickSwitch);
        }
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: flex-start; gap: 7px; cursor: pointer;';
        const checkbox = document.createElement('input');
        checkbox.id = 'amaes-login-save-account';
        checkbox.type = 'checkbox';
        checkbox.style.cssText = 'margin: 2px 0 0; flex: 0 0 auto;';
        const labelText = document.createElement('span');
        labelText.textContent = 'Save this account on this device for quick switching';
        label.append(checkbox, labelText);

        const nicknameInput = document.createElement('input');
        nicknameInput.id = 'amaes-login-account-nickname';
        nicknameInput.type = 'text';
        nicknameInput.autocomplete = 'off';
        nicknameInput.placeholder = 'Display name for your account';
        nicknameInput.setAttribute('aria-label', 'Account display name');
        nicknameInput.style.cssText = 'display: none; box-sizing: border-box; width: 100%; margin-top: 7px; padding: 6px 7px; border: 1px solid #d1d5db; border-radius: 5px; font-size: 12px;';
        const feedback = document.createElement('div');
        feedback.setAttribute('role', 'status');
        feedback.style.cssText = 'display: none; margin-top: 5px; color: #b91c1c; font-size: 11px;';
        checkbox.addEventListener('change', () => {
            nicknameInput.style.display = checkbox.checked ? 'block' : 'none';
            if (checkbox.checked && !nicknameInput.value.trim()) {
                nicknameInput.value = loginFields.username.value.trim();
            }
        });

        container.append(label, nicknameInput, feedback);
        loginFields.password.insertAdjacentElement('afterend', container);
        let isSavingLoginCapture = false;
        let allowCaptureSubmission = false;
        loginFields.form.addEventListener('submit', event => {
            if (!checkbox.checked) return;
            if (isSavingLoginCapture) {
                if (allowCaptureSubmission) {
                    allowCaptureSubmission = false;
                } else {
                    event.preventDefault();
                }
                return;
            }
            const username = loginFields.username.value.trim();
            const password = loginFields.password.value;
            const nickname = nicknameInput.value.trim() || username;
            if (!username || !password || !nickname) return;

            event.preventDefault();
            isSavingLoginCapture = true;
            const captureExpiresAt = Date.now() + ACCOUNT_SWITCHER_INTENT_TTL_MS;
            setAccountSwitcherValue(ACCOUNT_SWITCHER_LOGIN_CAPTURE_KEY, {
                username,
                password,
                nickname,
                nicknameFromUsername: nickname === username,
                expiresAt: captureExpiresAt
            }).then(() => {
                setTimeout(async () => {
                    try {
                        if (window.location.pathname.includes('/login/')) {
                            const capture = await getAccountSwitcherValue(ACCOUNT_SWITCHER_LOGIN_CAPTURE_KEY, null);
                            if (capture?.expiresAt === captureExpiresAt) {
                                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_LOGIN_CAPTURE_KEY);
                            }
                        }
                    } catch (error) {
                        console.error(`[AMAES Account Switcher] Could not clear an unsuccessful login save: ${error.message || error}`);
                    }
                }, 20000);
                allowCaptureSubmission = true;
                loginFields.form.requestSubmit(event.submitter || undefined);
            })
                .catch(error => {
                    feedback.textContent = `${error.message || 'Could not save this account.'} Continuing login without saving.`;
                    feedback.style.display = 'block';
                    isSavingLoginCapture = true;
                    allowCaptureSubmission = true;
                    loginFields.form.requestSubmit(event.submitter || undefined);
                });
        });
    }

    async function completeAccountSwitcherLoginCapture() {
        try {
            const capture = await getAccountSwitcherValue(ACCOUNT_SWITCHER_LOGIN_CAPTURE_KEY, null);
            if (!capture) return false;
            if (!capture.expiresAt || capture.expiresAt < Date.now()) {
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_LOGIN_CAPTURE_KEY);
                return false;
            }

            const accounts = await getAccountSwitcherAccounts();
            const profileName = getCurrentAccountSwitcherProfileName();
            const nickname = capture.nicknameFromUsername && profileName
                ? profileName
                : capture.nickname;
            const existing = accounts.find(account => account.username.toLocaleLowerCase() === capture.username.toLocaleLowerCase());
            if (existing) {
                existing.password = capture.password;
                existing.nickname = nickname;
                await saveAccountSwitcherAccounts(accounts);
            } else {
                const id = crypto.randomUUID
                    ? crypto.randomUUID()
                    : `account-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                accounts.push({ id, username: capture.username, password: capture.password, nickname });
                await saveAccountSwitcherAccounts(accounts);
            }
            await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_LOGIN_CAPTURE_KEY);
            return true;
        } catch (error) {
            console.error(`[AMAES Account Switcher] Could not save the account after login: ${error.message || error}`);
            return false;
        }
    }

    function accountSwitcherSetInputValue(input, value) {
        const prototype = Object.getPrototypeOf(input);
        const valueSetter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
        if (valueSetter) valueSetter.call(input, value);
        else input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    async function waitForAccountSwitcherElement(findElement, timeoutMs = 7000) {
        const deadline = Date.now() + timeoutMs;
        while (Date.now() < deadline) {
            const element = findElement();
            if (element) return element;
            await new Promise(resolve => setTimeout(resolve, 150));
        }
        return null;
    }

    async function startAccountSwitch(accountId, returnToCurrentPage) {
        try {
            const accounts = await getAccountSwitcherAccounts();
            const account = accounts.find(saved => saved.id === accountId);
            if (!account) throw new Error('The selected account could not be found.');
            if (returnToCurrentPage) {
                await setAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_KEY, {
                    url: window.location.href,
                    expiresAt: Date.now() + ACCOUNT_SWITCHER_INTENT_TTL_MS
                });
            } else {
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_KEY);
            }

            await setAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY, {
                accountId: account.id,
                stage: 'logout',
                createdAt: Date.now()
            });

            let logoutLink = findAccountSwitcherLogoutLink();
            if (!logoutLink) {
                const profileToggle = findAccountSwitcherProfileToggle();
                if (!profileToggle) throw new Error('Could not find the Moodle profile menu.');
                profileToggle.click();
                logoutLink = await waitForAccountSwitcherElement(findAccountSwitcherLogoutLink);
            }
            if (!logoutLink) throw new Error('Could not find the Log out option in the Moodle profile menu.');

            accountSwitcherSetStatus(`Signing out before switching to ${account.nickname}…`);
            logoutLink.click();
        } catch (error) {
            try {
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY);
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_KEY);
            } catch (cleanupError) {
                console.error(`[AMAES Account Switcher] Could not clear incomplete switch state: ${cleanupError.message || cleanupError}`);
            }
            accountSwitcherSetStatus(error.message || 'Could not start account switching.', true);
        }
    }

    async function handleAccountSwitcherNavigation() {
        if (window.location.hostname !== 'semestral.amaes.com') return;

        let pending;
        try {
            pending = await getAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY, null);
            if (!pending || typeof pending !== 'object') return;
            if (!pending.createdAt || Date.now() - pending.createdAt > ACCOUNT_SWITCHER_INTENT_TTL_MS) {
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY);
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_KEY);
                return;
            }

            if (!window.location.pathname.includes('/login/')) return;

            if (pending.stage === 'attempted') {
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY);
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_KEY);
                return;
            }

            let loginFields = findAccountSwitcherLoginFields();
            if (!loginFields) {
                let confirmation = findAccountSwitcherLogoutConfirmation();
                if (confirmation) {
                    confirmation.click();
                    return;
                }
                loginFields = await waitForAccountSwitcherElement(findAccountSwitcherLoginFields, 9000);
                if (!loginFields) {
                    confirmation = findAccountSwitcherLogoutConfirmation();
                    if (confirmation) confirmation.click();
                    return;
                }
            }

            const accounts = await getAccountSwitcherAccounts();
            const account = accounts.find(saved => saved.id === pending.accountId);
            if (!account) {
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY);
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_KEY);
                throw new Error('The selected account no longer exists.');
            }
            await setAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY, {
                ...pending,
                stage: 'attempted'
            });
            accountSwitcherSetInputValue(loginFields.username, account.username);
            accountSwitcherSetInputValue(loginFields.password, account.password);

            const submitButton = loginFields.form.querySelector(
                'button[type="submit"], input[type="submit"], #loginbtn'
            );
            if (typeof loginFields.form.requestSubmit === 'function') {
                loginFields.form.requestSubmit(submitButton || undefined);
            } else if (submitButton) {
                submitButton.click();
            } else {
                throw new Error('Could not find a login submit button.');
            }

            setTimeout(async () => {
                try {
                    if (!window.location.pathname.includes('/login/')) return;
                    const latestPending = await getAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY, null);
                    if (latestPending?.stage === 'attempted') {
                        await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY);
                        await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_KEY);
                        accountSwitcherSetStatus('Login did not complete. Check the credentials and try again.', true);
                    }
                } catch (error) {
                    console.error(`[AMAES Account Switcher] Could not clear a failed login attempt: ${error.message || error}`);
                }
            }, 10000);
        } catch (error) {
            console.error(`[AMAES Account Switcher] ${error.message || error}`);
        }
    }

    async function completeAccountSwitcherReturn() {
        try {
            if (typeof GM_getValue !== 'function' || typeof GM_deleteValue !== 'function') return false;
            const pending = await getAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY, null);
            if (!pending || pending.stage !== 'attempted') return false;

            await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY);
            const returnTarget = await getAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_KEY, null);
            await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_KEY);
            if (!returnTarget || typeof returnTarget.url !== 'string' || returnTarget.expiresAt < Date.now()) {
                return false;
            }

            const target = new URL(returnTarget.url);
            if (target.origin !== window.location.origin) {
                console.error('[AMAES Account Switcher] Refusing to restore a return address on another site.');
                return false;
            }

            window.location.replace(target.href);
            return true;
        } catch (error) {
            console.error(`[AMAES Account Switcher] Could not restore the saved return address: ${error.message || error}`);
            return false;
        }
    }

    async function setupAccountSwitcherUI() {
        const form = document.getElementById('amaes-account-switcher-form');
        const list = document.getElementById('amaes-account-switcher-list');
        const returnToggle = document.getElementById('amaes-account-switcher-return');
        const submitButton = document.getElementById('amaes-account-switcher-submit');
        const cancelEditButton = document.getElementById('amaes-account-switcher-cancel-edit');
        if (!form || !list || !returnToggle || !submitButton || !cancelEditButton) return;
        let editingAccountId = null;

        const resetAccountForm = () => {
            editingAccountId = null;
            form.reset();
            submitButton.textContent = 'Add account';
            cancelEditButton.style.display = 'none';
        };

        const renderAccounts = async () => {
            const accounts = await getAccountSwitcherAccounts();
            const currentProfileName = normalizeAccountSwitcherIdentity(getCurrentAccountSwitcherProfileName());
            list.replaceChildren();
            if (accounts.length === 0) {
                const empty = document.createElement('div');
                empty.textContent = 'No saved accounts yet.';
                empty.style.cssText = 'font-size: 10px; color: var(--text-muted); padding: 4px 2px;';
                list.appendChild(empty);
                return;
            }

            accounts.forEach(account => {
                const row = document.createElement('div');
                row.style.cssText = 'display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 5px; align-items: center; width: 100%;';

                const switchButton = document.createElement('button');
                switchButton.type = 'button';
                switchButton.className = 'amaes-btn amaes-btn-monotone';
                switchButton.textContent = account.nickname;
                switchButton.title = `Switch to ${account.nickname}`;
                switchButton.style.cssText = 'width: 100%; justify-content: flex-start; min-width: 0; overflow: hidden; text-overflow: ellipsis;';
                switchButton.addEventListener('click', () => {
                    startAccountSwitch(account.id, returnToggle.checked);
                });

                const status = document.createElement('span');
                const isCurrentAccount = Boolean(currentProfileName && (
                    currentProfileName === normalizeAccountSwitcherIdentity(account.nickname) ||
                    currentProfileName === normalizeAccountSwitcherIdentity(account.username)
                ));
                status.textContent = isCurrentAccount ? 'Active' : 'Saved';
                status.title = isCurrentAccount
                    ? 'Matches the name shown in the current Moodle profile.'
                    : 'Saved in this browser; not matched to the current Moodle profile name.';
                status.style.cssText = `font-size: 9px; white-space: nowrap; color: ${isCurrentAccount ? 'var(--accent-green, #22c55e)' : 'var(--text-muted)'};`;

                const editButton = document.createElement('button');
                editButton.type = 'button';
                editButton.className = 'amaes-btn amaes-btn-outline';
                editButton.textContent = 'Edit';
                editButton.setAttribute('aria-label', `Edit ${account.nickname}`);
                editButton.style.cssText = 'width: auto; white-space: nowrap; padding: 4px 7px; font-size: 9px;';
                editButton.addEventListener('click', async () => {
                    editingAccountId = account.id;
                    document.getElementById('amaes-account-switcher-username').value = account.username;
                    document.getElementById('amaes-account-switcher-password').value = account.password;
                    document.getElementById('amaes-account-switcher-nickname').value = account.nickname;
                    submitButton.textContent = 'Save changes';
                    cancelEditButton.style.display = 'block';
                    document.getElementById('amaes-account-switcher-username').focus();
                    accountSwitcherSetStatus(`Editing ${account.nickname}.`);
                });

                const removeButton = document.createElement('button');
                removeButton.type = 'button';
                removeButton.className = 'amaes-btn amaes-btn-outline';
                removeButton.textContent = 'Remove';
                removeButton.setAttribute('aria-label', `Remove ${account.nickname}`);
                removeButton.style.cssText = 'width: auto; white-space: nowrap; padding: 4px 7px; font-size: 9px;';
                removeButton.addEventListener('click', async () => {
                    try {
                        const latest = await getAccountSwitcherAccounts();
                        const remainingAccounts = latest.filter(saved => saved.id !== account.id);
                        await saveAccountSwitcherAccounts(remainingAccounts);
                        if (editingAccountId === account.id) resetAccountForm();
                        await renderAccounts();
                        accountSwitcherSetStatus(`${account.nickname} removed.`);
                    } catch (error) {
                        accountSwitcherSetStatus(error.message || 'Could not remove the saved account.', true);
                    }
                });

                row.append(switchButton, status, editButton, removeButton);
                list.appendChild(row);
            });
        };

        try {
            returnToggle.checked = (await getAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_OPTION_KEY, false)) === true;
            returnToggle.addEventListener('change', async () => {
                try {
                    await setAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_OPTION_KEY, returnToggle.checked);
                } catch (error) {
                    accountSwitcherSetStatus(error.message || 'Could not save the return-page setting.', true);
                }
            });

            cancelEditButton.addEventListener('click', resetAccountForm);

            form.addEventListener('submit', async event => {
                event.preventDefault();
                const usernameInput = document.getElementById('amaes-account-switcher-username');
                const passwordInput = document.getElementById('amaes-account-switcher-password');
                const nicknameInput = document.getElementById('amaes-account-switcher-nickname');
                const username = usernameInput.value.trim();
                const password = passwordInput.value;
                const nickname = nicknameInput.value.trim();
                if (!username || !password || !nickname) {
                    accountSwitcherSetStatus('Enter a username, password, and nickname.', true);
                    return;
                }

                try {
                    const wasEditing = Boolean(editingAccountId);
                    let accounts = await getAccountSwitcherAccounts();
                    const id = editingAccountId || (crypto.randomUUID
                        ? crypto.randomUUID()
                        : `account-${Date.now()}-${Math.random().toString(36).slice(2)}`);
                    const updatedAccount = { id, username, password, nickname };
                    if (editingAccountId) {
                        accounts = accounts.map(account => account.id === editingAccountId ? updatedAccount : account);
                    } else {
                        accounts.push(updatedAccount);
                    }
                    await saveAccountSwitcherAccounts(accounts);
                    resetAccountForm();
                    await renderAccounts();
                    accountSwitcherSetStatus(`${nickname} ${wasEditing ? 'updated' : 'saved'} on this device.`);
                } catch (error) {
                    accountSwitcherSetStatus(error.message || 'Could not save the account.', true);
                }
            });

            await renderAccounts();
        } catch (error) {
            accountSwitcherSetStatus(error.message || 'Could not load saved accounts.', true);
        }
    }
