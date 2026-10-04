const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const { webcrypto } = require('crypto');

const source = fs.readFileSync('src/moodle/account-transfer.js', 'utf8');
const panelSource = fs.readFileSync('src/ui/panel.js', 'utf8');
const context = vm.createContext({
    crypto: webcrypto,
    TextEncoder,
    TextDecoder,
    Uint8Array,
    Array,
    Object,
    Set,
    Date,
    JSON,
    Error,
    btoa,
    atob
});
vm.runInContext(`${source}
globalThis.transferTestApi = {
    encrypt: accountTransferEncrypt,
    decrypt: accountTransferDecrypt,
    validate: accountTransferValidatePayload,
    encode: accountTransferBase64Url,
    post: accountTransferPost,
    readSelected: accountTransferReadSelectedData,
    settingsKeys: ACCOUNT_TRANSFER_SETTINGS_KEYS
};`, context);

const { encrypt, decrypt, validate, encode, post, readSelected, settingsKeys } = context.transferTestApi;
const codeBytes = webcrypto.getRandomValues(new Uint8Array(32));
const payload = {
    format: 'amaes-toolkit-transfer',
    version: 1,
    createdAt: new Date().toISOString(),
    accounts: [{
        id: 'account-1',
        username: 'student@example.invalid',
        password: 'not-a-real-password',
        nickname: 'Laptop'
    }],
    apiKeys: ['test-api-key-value'],
    settings: {
        amaes_toolkit_theme: 'dark',
        amaes_account_switcher_return_enabled: 'true'
    }
};

async function run() {
    const settingsStorage = new Map();
    const nonBooleanValues = {
        amaes_toolkit_theme: 'dark',
        amaes_quiz_personality: 'passive',
        amaes_ai_plan_tier: 'free',
        amaes_adaptive_probe_budget: '2',
        amaes_ai_retry_count: '2',
        amaes_preferred_web_ai: 'chatgpt',
        amaes_active_tab: 'quiz'
    };
    settingsKeys.forEach(key => {
        if (key !== 'amaes_account_switcher_return_enabled') {
            settingsStorage.set(key, nonBooleanValues[key] || 'true');
        }
    });
    context.localStorage = {
        getItem: key => settingsStorage.has(key) ? settingsStorage.get(key) : null
    };
    context.getAccountSwitcherAccounts = async () => payload.accounts;
    context.getGeminiApiKeys = () => payload.apiKeys;
    context.getAccountSwitcherValue = async (_key, fallback) => fallback === null ? true : fallback;
    const selected = await readSelected(true, true, true);
    assert.deepEqual(Object.keys(selected.settings).sort(), [...settingsKeys].sort());
    assert.deepEqual(selected.accounts, payload.accounts);
    assert.deepEqual(selected.apiKeys, payload.apiKeys);
    assert.ok(!Object.keys(selected).includes('amaes_github_token'));
    assert.ok(!Object.keys(selected).includes('amaes_anon_install_id'));

    const encrypted = await encrypt(codeBytes, payload);
    assert.deepEqual(JSON.parse(JSON.stringify(await decrypt(codeBytes, encrypted))), {
        format: payload.format,
        version: payload.version,
        createdAt: payload.createdAt,
        accounts: payload.accounts,
        apiKeys: payload.apiKeys,
        settings: payload.settings
    });
    let sentBody = '';
    context.communityRelayUrl = 'https://relay.example';
    context.CLIENT_VERSION = '1.11.13';
    context.getAnonymousContributorId = () => 'anonymous-installation-id';
    context.fetch = async (_url, options) => {
        sentBody = options.body;
        return new Response(JSON.stringify({ success: true }), {
            status: 201,
            headers: { 'Content-Type': 'application/json' }
        });
    };
    await post('create', { lookupHash: 'A'.repeat(43), ...encrypted });
    assert.deepEqual(Object.keys(JSON.parse(sentBody)).sort(), ['ciphertext', 'iv', 'lookupHash']);
    assert.ok(!sentBody.includes(payload.accounts[0].password));
    assert.ok(!sentBody.includes(payload.apiKeys[0]));
    assert.ok(!sentBody.includes(payload.accounts[0].username));

    const wrongCode = webcrypto.getRandomValues(new Uint8Array(32));
    await assert.rejects(() => decrypt(wrongCode, encrypted), /incorrect or the encrypted data was altered/);
    const tampered = {
        ...encrypted,
        ciphertext: `${encrypted.ciphertext[0] === 'A' ? 'B' : 'A'}${encrypted.ciphertext.slice(1)}`
    };
    await assert.rejects(() => decrypt(codeBytes, tampered), /incorrect or the encrypted data was altered/);
    assert.equal(encode(codeBytes).length, 43);
    assert.doesNotMatch(source, /ACCOUNT_TRANSFER_TTL_MS|expires in 15 minutes/i);
    assert.match(panelSource, /The code does not expire, but works once only/);

    assert.throws(() => validate({ ...payload, admin: true }), /Unsupported or invalid/);
    assert.throws(() => validate({
        ...payload,
        settings: { unexpected: 'true' }
    }), /unsupported setting/);
    assert.throws(() => validate({
        ...payload,
        accounts: [{ ...payload.accounts[0], sessionCookie: 'not-transferable' }]
    }), /invalid account profiles/);

    const oversizedPayload = {
        ...payload,
        accounts: Array.from({ length: 30 }, (_, index) => ({
            id: `account-${index}-${'i'.repeat(110)}`,
            username: `student-${index}-${'u'.repeat(220)}`,
            password: 'x'.repeat(2_048),
            nickname: `Laptop ${index}-${'n'.repeat(110)}`
        }))
    };
    await assert.rejects(() => encrypt(codeBytes, oversizedPayload), /64 KiB secure transfer limit/);

    console.log('Encrypted account-transfer browser invariants passed');
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
