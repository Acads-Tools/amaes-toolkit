    const ACCOUNT_SWITCHER_ACCOUNTS_KEY = 'amaes_account_switcher_accounts';
    const ACCOUNT_SWITCHER_RETURN_KEY = 'amaes_account_switcher_return_url';
    const ACCOUNT_SWITCHER_PENDING_KEY = 'amaes_account_switcher_pending';
    const ACCOUNT_SWITCHER_RETURN_OPTION_KEY = 'amaes_account_switcher_return_enabled';
    const ACCOUNT_SWITCHER_SESSION_KEY = 'amaes_account_switcher_session_key';
    const ACCOUNT_SWITCHER_VAULT_KEY = 'amaes_account_switcher_vault';
    const ACCOUNT_SWITCHER_INTENT_TTL_MS = 10 * 60 * 1000;
    const ACCOUNT_SWITCHER_PBKDF2_ITERATIONS = 310000;
    const ACCOUNT_SWITCHER_VERIFIER = 'AMAES Account Switcher vault verifier v1';

    function accountSwitcherEncodeBase64(bytes) {
        return btoa(String.fromCharCode(...new Uint8Array(bytes)));
    }

    function accountSwitcherDecodeBase64(value) {
        return Uint8Array.from(atob(value), character => character.charCodeAt(0));
    }

    async function accountSwitcherDeriveKey(passphrase, salt) {
        if (typeof passphrase !== 'string' || passphrase.length < 12) {
            throw new Error('Use the same encryption passphrase of at least 12 characters.');
        }
        if (!window.crypto?.subtle) {
            throw new Error('Encrypted accounts require a browser with Web Crypto support.');
        }
        const material = await window.crypto.subtle.importKey(
            'raw',
            new TextEncoder().encode(passphrase),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        return window.crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt, iterations: ACCOUNT_SWITCHER_PBKDF2_ITERATIONS, hash: 'SHA-256' },
            material,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async function encryptAccountSwitcherCredentials(username, password, passphrase) {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await accountSwitcherDeriveKey(passphrase, salt);
        const plaintext = new TextEncoder().encode(JSON.stringify({ username, password }));
        const ciphertext = await window.crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
        return {
            version: 1,
            salt: accountSwitcherEncodeBase64(salt),
            iv: accountSwitcherEncodeBase64(iv),
            ciphertext: accountSwitcherEncodeBase64(ciphertext)
        };
    }

    async function decryptAccountSwitcherCredentials(account, passphrase) {
        if (!account.encryptedCredentials) {
            return { username: account.username, password: account.password };
        }
        try {
            const encrypted = account.encryptedCredentials;
            if (encrypted.version !== 1) throw new Error('Unsupported encrypted account format.');
            const salt = accountSwitcherDecodeBase64(encrypted.salt);
            const iv = accountSwitcherDecodeBase64(encrypted.iv);
            const key = await accountSwitcherDeriveKey(passphrase, salt);
            const plaintext = await window.crypto.subtle.decrypt(
                { name: 'AES-GCM', iv },
                key,
                accountSwitcherDecodeBase64(encrypted.ciphertext)
            );
            const credentials = JSON.parse(new TextDecoder().decode(plaintext));
            if (typeof credentials.username !== 'string' || typeof credentials.password !== 'string') {
                throw new Error('Encrypted account data is invalid.');
            }
            return credentials;
        } catch (error) {
            if (error.name === 'OperationError' || error.name === 'DataError') {
                throw new Error('Could not decrypt the saved account. Check the encryption passphrase.');
            }
            throw error;
        }
    }

    async function verifyAccountSwitcherPassphrase(passphrase) {
        if (typeof passphrase !== 'string' || passphrase.length < 12) {
            throw new Error('Use an encryption passphrase of at least 12 characters.');
        }
        const storedVerifier = await getAccountSwitcherValue(ACCOUNT_SWITCHER_VAULT_KEY, null);
        if (storedVerifier) {
            try {
                const key = await accountSwitcherDeriveKey(
                    passphrase,
                    accountSwitcherDecodeBase64(storedVerifier.salt)
                );
                const plaintext = await window.crypto.subtle.decrypt(
                    { name: 'AES-GCM', iv: accountSwitcherDecodeBase64(storedVerifier.iv) },
                    key,
                    accountSwitcherDecodeBase64(storedVerifier.ciphertext)
                );
                if (new TextDecoder().decode(plaintext) !== ACCOUNT_SWITCHER_VERIFIER) {
                    throw new Error('The encryption passphrase does not match this account vault.');
                }
                return;
            } catch (error) {
                if (error.message === 'The encryption passphrase does not match this account vault.') throw error;
                throw new Error('The encryption passphrase does not match this account vault.');
            }
        }

        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await accountSwitcherDeriveKey(passphrase, salt);
        const ciphertext = await window.crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            new TextEncoder().encode(ACCOUNT_SWITCHER_VERIFIER)
        );
        await setAccountSwitcherValue(ACCOUNT_SWITCHER_VAULT_KEY, {
            version: 1,
            salt: accountSwitcherEncodeBase64(salt),
            iv: accountSwitcherEncodeBase64(iv),
            ciphertext: accountSwitcherEncodeBase64(ciphertext)
        });
    }

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
            typeof account.nickname === 'string' &&
            (
                (account.encryptedCredentials && typeof account.encryptedCredentials === 'object') ||
                (typeof account.username === 'string' && typeof account.password === 'string')
            )
        );
    }

    async function saveAccountSwitcherAccounts(accounts) {
        await setAccountSwitcherValue(ACCOUNT_SWITCHER_ACCOUNTS_KEY, accounts);
    }

    async function encryptLegacyAccountSwitcherAccounts(accounts, passphrase) {
        const encryptedAccounts = [];
        let changed = false;
        for (const account of accounts) {
            if (account.encryptedCredentials) {
                encryptedAccounts.push(account);
                continue;
            }
            const encryptedCredentials = await encryptAccountSwitcherCredentials(
                account.username,
                account.password,
                passphrase
            );
            const { username, password, ...safeAccount } = account;
            changed = true;
            encryptedAccounts.push({ ...safeAccount, encryptedCredentials });
        }
        if (changed) await saveAccountSwitcherAccounts(encryptedAccounts);
        return encryptedAccounts;
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

    async function startAccountSwitch(accountId, returnToCurrentPage, passphrase) {
        try {
            if (!passphrase) throw new Error('Enter your encryption passphrase before switching accounts.');
            await verifyAccountSwitcherPassphrase(passphrase);
            const accounts = await encryptLegacyAccountSwitcherAccounts(
                await getAccountSwitcherAccounts(),
                passphrase
            );
            const account = accounts.find(saved => saved.id === accountId);
            if (!account) throw new Error('The selected account could not be found.');
            await decryptAccountSwitcherCredentials(account, passphrase);

            await setAccountSwitcherValue(ACCOUNT_SWITCHER_SESSION_KEY, {
                passphrase,
                expiresAt: Date.now() + ACCOUNT_SWITCHER_INTENT_TTL_MS
            });

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
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_SESSION_KEY);
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
            const temporaryKey = await getAccountSwitcherValue(ACCOUNT_SWITCHER_SESSION_KEY, null);
            if (temporaryKey && temporaryKey.expiresAt < Date.now()) {
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_SESSION_KEY);
            }
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

            let sessionKey;
            try {
                sessionKey = await getAccountSwitcherValue(ACCOUNT_SWITCHER_SESSION_KEY, null);
            } finally {
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_SESSION_KEY);
            }
            if (!sessionKey || typeof sessionKey.passphrase !== 'string' || sessionKey.expiresAt < Date.now()) {
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY);
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_KEY);
                throw new Error('The temporary encryption key expired. Start account switching again.');
            }
            let credentials;
            try {
                credentials = await decryptAccountSwitcherCredentials(account, sessionKey.passphrase);
            } catch (error) {
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY);
                await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_RETURN_KEY);
                throw error;
            }

            await setAccountSwitcherValue(ACCOUNT_SWITCHER_PENDING_KEY, {
                ...pending,
                stage: 'attempted'
            });
            accountSwitcherSetInputValue(loginFields.username, credentials.username);
            accountSwitcherSetInputValue(loginFields.password, credentials.password);

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
        const passphraseInput = document.getElementById('amaes-account-switcher-passphrase');
        const submitButton = document.getElementById('amaes-account-switcher-submit');
        const cancelEditButton = document.getElementById('amaes-account-switcher-cancel-edit');
        const encryptExistingButton = document.getElementById('amaes-account-switcher-encrypt-existing');
        if (!form || !list || !returnToggle || !passphraseInput || !submitButton || !cancelEditButton || !encryptExistingButton) return;
        let editingAccountId = null;

        const resetAccountForm = () => {
            editingAccountId = null;
            form.reset();
            submitButton.textContent = 'Add account';
            cancelEditButton.style.display = 'none';
        };

        const renderAccounts = async () => {
            const accounts = await getAccountSwitcherAccounts();
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
                row.style.cssText = 'display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 5px; align-items: center; width: 100%;';

                const switchButton = document.createElement('button');
                switchButton.type = 'button';
                switchButton.className = 'amaes-btn amaes-btn-monotone';
                switchButton.textContent = account.nickname;
                switchButton.title = `Switch to ${account.nickname}`;
                switchButton.style.cssText = 'width: 100%; justify-content: flex-start; min-width: 0; overflow: hidden; text-overflow: ellipsis;';
                switchButton.addEventListener('click', () => {
                    const passphrase = passphraseInput.value;
                    passphraseInput.value = '';
                    startAccountSwitch(account.id, returnToggle.checked, passphrase);
                });

                const editButton = document.createElement('button');
                editButton.type = 'button';
                editButton.className = 'amaes-btn amaes-btn-outline';
                editButton.textContent = 'Edit';
                editButton.setAttribute('aria-label', `Edit ${account.nickname}`);
                editButton.style.cssText = 'width: auto; white-space: nowrap; padding: 4px 7px; font-size: 9px;';
                editButton.addEventListener('click', async () => {
                    try {
                        const passphrase = passphraseInput.value;
                        if (!passphrase) throw new Error('Enter your encryption passphrase to edit this account.');
                        await verifyAccountSwitcherPassphrase(passphrase);
                        const credentials = await decryptAccountSwitcherCredentials(account, passphrase);
                        editingAccountId = account.id;
                        document.getElementById('amaes-account-switcher-username').value = credentials.username;
                        document.getElementById('amaes-account-switcher-password').value = credentials.password;
                        document.getElementById('amaes-account-switcher-nickname').value = account.nickname;
                        submitButton.textContent = 'Save changes';
                        cancelEditButton.style.display = 'block';
                        document.getElementById('amaes-account-switcher-username').focus();
                        accountSwitcherSetStatus(`Editing ${account.nickname}.`);
                    } catch (error) {
                        accountSwitcherSetStatus(error.message || 'Could not decrypt the saved account.', true);
                    }
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
                        if (remainingAccounts.length === 0) {
                            await deleteAccountSwitcherValue(ACCOUNT_SWITCHER_VAULT_KEY);
                        }
                        if (editingAccountId === account.id) resetAccountForm();
                        await renderAccounts();
                        accountSwitcherSetStatus(`${account.nickname} removed.`);
                    } catch (error) {
                        accountSwitcherSetStatus(error.message || 'Could not remove the saved account.', true);
                    }
                });

                row.append(switchButton, editButton, removeButton);
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
            encryptExistingButton.addEventListener('click', async () => {
                try {
                    const passphrase = passphraseInput.value;
                    if (!passphrase || passphrase.length < 12) {
                        throw new Error('Enter a passphrase of at least 12 characters to encrypt saved accounts.');
                    }
                    const accounts = await getAccountSwitcherAccounts();
                    if (accounts.length === 0) {
                        accountSwitcherSetStatus('Add an account before encrypting saved accounts.');
                        return;
                    }
                    await verifyAccountSwitcherPassphrase(passphrase);
                    const legacyCount = accounts.filter(account => !account.encryptedCredentials).length;
                    await encryptLegacyAccountSwitcherAccounts(accounts, passphrase);
                    passphraseInput.value = '';
                    accountSwitcherSetStatus(legacyCount
                        ? `${legacyCount} existing account${legacyCount === 1 ? '' : 's'} encrypted locally.`
                        : 'All saved account credentials are already encrypted.');
                } catch (error) {
                    accountSwitcherSetStatus(error.message || 'Could not encrypt existing accounts.', true);
                }
            });

            form.addEventListener('submit', async event => {
                event.preventDefault();
                const usernameInput = document.getElementById('amaes-account-switcher-username');
                const passwordInput = document.getElementById('amaes-account-switcher-password');
                const nicknameInput = document.getElementById('amaes-account-switcher-nickname');
                const username = usernameInput.value.trim();
                const password = passwordInput.value;
                const nickname = nicknameInput.value.trim();
                const passphrase = passphraseInput.value;
                if (!username || !password || !nickname) {
                    accountSwitcherSetStatus('Enter a username, password, and nickname.', true);
                    return;
                }
                if (!passphrase) {
                    accountSwitcherSetStatus('Enter an encryption passphrase to save this account securely.', true);
                    return;
                }
                if (passphrase.length < 12) {
                    accountSwitcherSetStatus('Use an encryption passphrase of at least 12 characters.', true);
                    return;
                }

                try {
                    const wasEditing = Boolean(editingAccountId);
                    await verifyAccountSwitcherPassphrase(passphrase);
                    let accounts = await encryptLegacyAccountSwitcherAccounts(
                        await getAccountSwitcherAccounts(),
                        passphrase
                    );
                    const id = editingAccountId || (crypto.randomUUID
                        ? crypto.randomUUID()
                        : `account-${Date.now()}-${Math.random().toString(36).slice(2)}`);
                    const encryptedCredentials = await encryptAccountSwitcherCredentials(username, password, passphrase);
                    const updatedAccount = { id, nickname, encryptedCredentials };
                    if (editingAccountId) {
                        accounts = accounts.map(account => account.id === editingAccountId ? updatedAccount : account);
                    } else {
                        accounts.push(updatedAccount);
                    }
                    await saveAccountSwitcherAccounts(accounts);
                    resetAccountForm();
                    passphraseInput.value = '';
                    await renderAccounts();
                    accountSwitcherSetStatus(`${nickname} ${wasEditing ? 'updated' : 'saved'} with local encryption.`);
                } catch (error) {
                    accountSwitcherSetStatus(error.message || 'Could not save the account.', true);
                }
            });

            await renderAccounts();
        } catch (error) {
            accountSwitcherSetStatus(error.message || 'Could not load saved accounts.', true);
        }
    }
