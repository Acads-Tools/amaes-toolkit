// ==========================================
// Encrypted one-time account/settings transfer
// ==========================================

const ACCOUNT_TRANSFER_FORMAT = 'amaes-toolkit-transfer';
const ACCOUNT_TRANSFER_VERSION = 1;
const ACCOUNT_TRANSFER_SETTINGS_KEYS = [
    'amaes_toolkit_theme',
    'amaes_auto_highlight_quiz',
    'amaes_auto_copy_ai',
    'amaes_auto_quiz_mode',
    'amaes_fast_quiz_mode',
    'amaes_auto_pick_quiz',
    'amaes_auto_next_verified',
    'amaes_auto_pick_study_guide_fallback',
    'amaes_auto_next_quiz',
    'amaes_adaptive_probe_quiz',
    'amaes_adaptive_probe_budget',
    'amaes_quiz_personality',
    'amaes_auto_submit_quiz',
    'amaes_smart_skip_quiz',
    'amaes_auto_cloud_sync',
    'amaes_auto_scrape_amauoed',
    'amaes_auto_harvest_grades',
    'amaes_enable_hotkeys',
    'amaes_auto_copy_search',
    'amaes_copy_include_confidence',
    'amaes_show_in_question_ai_btns',
    'amaes_ai_prompt_hint',
    'amaes_auto_community_share',
    'amaes_auto_min_quiz',
    'amaes_enable_audio_alerts',
    'amaes_ai_quiz_enabled',
    'amaes_ai_auto_select',
    'amaes_ai_retry_count',
    'amaes_ai_auto_copy_on_fail',
    'amaes_ai_auto_next_on_ai',
    'amaes_ai_plan_tier',
    'amaes_shared_ai_fallback_enabled',
    'amaes_account_switcher_return_enabled',
    'amaes_preferred_web_ai',
    'amaes_pref_minimized',
    'amaes_pref_show_logs',
    'amaes_active_tab'
];
let pendingAccountTransfer = null;

function accountTransferStatus(message, isError = false) {
    const status = document.getElementById('amaes-account-transfer-status');
    if (status) {
        status.textContent = message;
        status.style.color = isError ? 'var(--accent-pink, #f43f5e)' : 'var(--text-secondary)';
    }
}

function accountTransferBase64Url(bytes) {
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function accountTransferDecodeBase64Url(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
        throw new Error('Transfer data has an invalid encoding.');
    }
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/') +
        '='.repeat((4 - value.length % 4) % 4);
    const binary = atob(base64);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function accountTransferLookupHash(codeBytes) {
    const prefix = new TextEncoder().encode('AMAES transfer lookup v1:');
    const input = new Uint8Array(prefix.length + codeBytes.length);
    input.set(prefix);
    input.set(codeBytes, prefix.length);
    return accountTransferBase64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', input)));
}

function accountTransferValidateSettings(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
        throw new Error('The transfer does not contain valid settings.');
    }
    if (Object.keys(settings).some(key => !ACCOUNT_TRANSFER_SETTINGS_KEYS.includes(key))) {
        throw new Error('The transfer contains an unsupported setting.');
    }
    const result = {};
    for (const key of ACCOUNT_TRANSFER_SETTINGS_KEYS) {
        if (!Object.prototype.hasOwnProperty.call(settings, key)) continue;
        const value = settings[key];
        if (typeof value !== 'string' || value.length > 128) {
            throw new Error(`Invalid setting value for ${key}.`);
        }
        if (key === 'amaes_toolkit_theme' && !['dark', 'light'].includes(value)) {
            throw new Error('The transferred theme value is invalid.');
        }
        if (key === 'amaes_quiz_personality' &&
            !['passive', 'aggressive', 'active', 'balanced'].includes(value)) {
            throw new Error('The transferred quiz preference is invalid.');
        }
        if (key === 'amaes_ai_plan_tier' && !['free', 'paid'].includes(value)) {
            throw new Error('The transferred AI plan preference is invalid.');
        }
        if (key === 'amaes_adaptive_probe_budget' && !/^[1-9]\d?$/.test(value)) {
            throw new Error('The transferred probe setting is invalid.');
        }
        if (key === 'amaes_ai_retry_count' && !/^[1-9]\d?$/.test(value)) {
            throw new Error('The transferred retry setting is invalid.');
        }
        if (key === 'amaes_preferred_web_ai' && !['chatgpt', 'perplexity', 'gemini'].includes(value)) {
            throw new Error('The transferred preferred AI setting is invalid.');
        }
        if (key === 'amaes_active_tab' && !['quiz', 'db', 'course'].includes(value)) {
            throw new Error('The transferred panel tab setting is invalid.');
        }
        if (key !== 'amaes_toolkit_theme' && key !== 'amaes_quiz_personality' &&
            key !== 'amaes_ai_plan_tier' && key !== 'amaes_adaptive_probe_budget' &&
            key !== 'amaes_ai_retry_count' && key !== 'amaes_preferred_web_ai' &&
            key !== 'amaes_active_tab' && !['true', 'false'].includes(value)) {
            throw new Error(`Invalid boolean setting for ${key}.`);
        }
        result[key] = value;
    }
    return result;
}

function accountTransferValidatePayload(payload) {
    const allowedPayloadKeys = ['format', 'version', 'createdAt', 'accounts', 'apiKeys', 'settings'];
    if (!payload || payload.format !== ACCOUNT_TRANSFER_FORMAT ||
        payload.version !== ACCOUNT_TRANSFER_VERSION ||
        Object.keys(payload).some(key => !allowedPayloadKeys.includes(key)) ||
        typeof payload.createdAt !== 'string' || Number.isNaN(Date.parse(payload.createdAt))) {
        throw new Error('Unsupported or invalid transfer code.');
    }
    const accounts = payload.accounts;
    const apiKeys = payload.apiKeys;
    if (!Array.isArray(accounts) || accounts.length > 30 ||
        accounts.some(account => !account || typeof account.id !== 'string' ||
            Object.keys(account).some(key => !['id', 'username', 'password', 'nickname'].includes(key)) ||
            account.id.length > 128 || typeof account.username !== 'string' ||
            !account.username.trim() || account.username.length > 256 ||
            typeof account.password !== 'string' || !account.password ||
            account.password.length > 2048 || typeof account.nickname !== 'string' ||
            !account.nickname.trim() || account.nickname.length > 128)) {
        throw new Error('The transfer contains invalid account profiles.');
    }
    if (!Array.isArray(apiKeys) || apiKeys.length > 10 ||
        apiKeys.some(key => typeof key !== 'string' || key.length < 10 || key.length > 512)) {
        throw new Error('The transfer contains invalid API keys.');
    }
    return {
        format: payload.format,
        version: payload.version,
        createdAt: payload.createdAt,
        accounts: accounts.map(account => ({
            id: account.id,
            username: account.username,
            password: account.password,
            nickname: account.nickname
        })),
        apiKeys: Array.from(new Set(apiKeys)),
        settings: accountTransferValidateSettings(payload.settings)
    };
}

async function accountTransferEncrypt(codeBytes, payload) {
    const key = await crypto.subtle.importKey('raw', codeBytes, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(payload));
    if (plaintext.length > 65_536) throw new Error('Selected transfer data exceeds the 64 KiB secure transfer limit.');
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
    return {
        iv: accountTransferBase64Url(iv),
        ciphertext: accountTransferBase64Url(new Uint8Array(ciphertext))
    };
}

async function accountTransferDecrypt(codeBytes, encrypted) {
    const iv = accountTransferDecodeBase64Url(encrypted.iv);
    const ciphertext = accountTransferDecodeBase64Url(encrypted.ciphertext);
    if (iv.length !== 12 || ciphertext.length < 16 || ciphertext.length > 65_552) {
        throw new Error('Transfer data is invalid or too large.');
    }
    const key = await crypto.subtle.importKey('raw', codeBytes, { name: 'AES-GCM' }, false, ['decrypt']);
    let plaintext;
    try {
        plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    } catch (_) {
        throw new Error('Transfer code is incorrect or the encrypted data was altered.');
    }
    let payload;
    try {
        payload = JSON.parse(new TextDecoder().decode(plaintext));
    } catch (_) {
        throw new Error('Decrypted transfer data is not valid JSON.');
    }
    return accountTransferValidatePayload(payload);
}

async function accountTransferReadSelectedData(includeAccounts, includeApiKeys, includeSettings) {
    const savedAccounts = includeAccounts ? await getAccountSwitcherAccounts() : [];
    const apiKeys = includeApiKeys && typeof getGeminiApiKeys === 'function'
        ? getGeminiApiKeys()
        : [];
    const settings = includeSettings
        ? Object.fromEntries(ACCOUNT_TRANSFER_SETTINGS_KEYS
            .filter(key => key !== 'amaes_account_switcher_return_enabled')
            .map(key => [key, localStorage.getItem(key)])
            .filter(([, value]) => value !== null))
        : {};
    if (includeSettings) {
        const returnEnabled = await getAccountSwitcherValue('amaes_account_switcher_return_enabled', null);
        if (returnEnabled !== null) {
            settings.amaes_account_switcher_return_enabled =
                String(returnEnabled === true || returnEnabled === 'true');
        }
    }
    return {
        format: ACCOUNT_TRANSFER_FORMAT,
        version: ACCOUNT_TRANSFER_VERSION,
        createdAt: new Date().toISOString(),
        accounts: savedAccounts.map(account => ({
            id: account.id,
            username: account.username,
            password: account.password,
            nickname: account.nickname
        })),
        apiKeys: apiKeys.filter(key => typeof key === 'string' && key.trim()).map(key => key.trim()),
        settings
    };
}

async function accountTransferPost(path, body) {
    const response = await fetch(`${communityRelayUrl}/transfer/${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-AMAES-Client-Version': CLIENT_VERSION,
            'X-AMAES-Installation': getAnonymousContributorId()
        },
        body: JSON.stringify(body)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Secure transfer request failed (${response.status}).`);
    return result;
}

async function createAccountTransferCode() {
    const includeAccounts = document.getElementById('amaes-transfer-include-accounts').checked;
    const includeApiKeys = document.getElementById('amaes-transfer-include-api-keys').checked;
    const includeSettings = document.getElementById('amaes-transfer-include-settings').checked;
    if (!includeAccounts && !includeApiKeys && !includeSettings) {
        throw new Error('Select at least one item to transfer.');
    }
    if ((includeAccounts || includeApiKeys) &&
        !document.getElementById('amaes-transfer-secret-consent').checked) {
        throw new Error('Confirm that you understand the code can transfer selected passwords and API keys.');
    }
    const codeBytes = crypto.getRandomValues(new Uint8Array(32));
    const code = accountTransferBase64Url(codeBytes);
    const payload = accountTransferValidatePayload(
        await accountTransferReadSelectedData(includeAccounts, includeApiKeys, includeSettings)
    );
    const encrypted = await accountTransferEncrypt(codeBytes, payload);
    const lookupHash = await accountTransferLookupHash(codeBytes);
    await accountTransferPost('create', { lookupHash, ...encrypted });
    const output = document.getElementById('amaes-transfer-code');
    output.value = code;
    output.hidden = false;
    const copyButton = document.getElementById('amaes-transfer-copy');
    copyButton.hidden = false;
    accountTransferStatus('Code created. It stays available until it is imported once. Keep it private.');
}

async function importAccountTransferCode() {
    const input = document.getElementById('amaes-transfer-import-code');
    const code = input.value.trim();
    const codeBytes = accountTransferDecodeBase64Url(code);
    if (codeBytes.length !== 32) throw new Error('Enter the complete 43-character transfer code.');
    const lookupHash = await accountTransferLookupHash(codeBytes);
    const encrypted = await accountTransferPost('consume', { lookupHash });
    const payload = await accountTransferDecrypt(codeBytes, encrypted);
    const preview = document.getElementById('amaes-transfer-preview');
    preview.textContent = `Ready to import ${payload.accounts.length} account(s), ${payload.apiKeys.length} API key(s), and ${Object.keys(payload.settings).length} setting(s). Imported account profiles and API keys will be stored on this device.`;
    preview.hidden = false;
    input.value = '';
    document.getElementById('amaes-transfer-import').hidden = true;
    document.getElementById('amaes-transfer-apply').hidden = false;
    document.getElementById('amaes-transfer-discard').hidden = false;
    pendingAccountTransfer = payload;
}

async function applyAccountTransfer() {
    const payload = pendingAccountTransfer;
    if (!payload) throw new Error('There is no decrypted transfer awaiting confirmation.');
    const existing = await getAccountSwitcherAccounts();
    const byUsername = new Map(existing.map(account => [account.username.toLocaleLowerCase(), account]));
    payload.accounts.forEach(account => byUsername.set(account.username.toLocaleLowerCase(), account));
    await saveAccountSwitcherAccounts(Array.from(byUsername.values()));

    if (payload.apiKeys.length) {
        const current = typeof getGeminiApiKeys === 'function' ? getGeminiApiKeys() : [];
        const keys = Array.from(new Set(current.concat(payload.apiKeys)));
        if (typeof setGeminiApiKeys !== 'function') {
            throw new Error('Gemini API key storage is unavailable in this toolkit version.');
        }
        setGeminiApiKeys(keys);
    }
    for (const [key, value] of Object.entries(payload.settings)) {
        if (key === 'amaes_account_switcher_return_enabled') {
            await setAccountSwitcherValue(key, value === 'true');
        } else {
            localStorage.setItem(key, value);
        }
    }
    pendingAccountTransfer = null;
    document.getElementById('amaes-transfer-preview').hidden = true;
    document.getElementById('amaes-transfer-apply').hidden = true;
    document.getElementById('amaes-transfer-discard').hidden = true;
    document.getElementById('amaes-transfer-import').hidden = false;
    document.getElementById('amaes-transfer-import-code').value = '';
    accountTransferStatus('Transfer imported. Reload the page to apply all settings.');
}

function discardAccountTransfer() {
    pendingAccountTransfer = null;
    document.getElementById('amaes-transfer-preview').hidden = true;
    document.getElementById('amaes-transfer-apply').hidden = true;
    document.getElementById('amaes-transfer-discard').hidden = true;
    document.getElementById('amaes-transfer-import').hidden = false;
    accountTransferStatus('Decrypted preview discarded. This one-time code has already been consumed.');
}

function setupAccountTransferUI() {
    const exportButton = document.getElementById('amaes-transfer-create');
    const importButton = document.getElementById('amaes-transfer-import');
    if (!exportButton || !importButton) return;
    exportButton.addEventListener('click', async () => {
        try {
            exportButton.disabled = true;
            await createAccountTransferCode();
        } catch (error) {
            accountTransferStatus(error.message || 'Could not create transfer code.', true);
        } finally {
            exportButton.disabled = false;
        }
    });
    document.getElementById('amaes-transfer-copy').addEventListener('click', async () => {
        const code = document.getElementById('amaes-transfer-code').value;
        try {
            if (typeof GM_setClipboard === 'function') GM_setClipboard(code);
            else await navigator.clipboard.writeText(code);
            accountTransferStatus('Transfer code copied. Share it only with the intended device owner.');
        } catch (error) {
            accountTransferStatus(error.message || 'Could not copy the transfer code.', true);
        }
    });
    importButton.addEventListener('click', async () => {
        try {
            importButton.disabled = true;
            await importAccountTransferCode();
        } catch (error) {
            accountTransferStatus(error.message || 'Could not import transfer code.', true);
        } finally {
            importButton.disabled = false;
        }
    });
    document.getElementById('amaes-transfer-apply').addEventListener('click', async () => {
        try {
            await applyAccountTransfer();
        } catch (error) {
            accountTransferStatus(error.message || 'Could not apply transferred settings.', true);
        }
    });
    document.getElementById('amaes-transfer-discard').addEventListener('click', discardAccountTransfer);
}
