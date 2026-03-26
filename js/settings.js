/**
 * settings.js — Settings management and AI provider integration for Lab Designer v2.
 */

const Settings = (() => {
    const STORAGE_KEY = 'labdesigner_v2_settings';

    const DEFAULTS = {
        aiProvider: 'claude',
        apiKey: '',
        model: 'claude-sonnet-4-20250514',
        endpointUrl: '',
        targetDuration: 60,
        activitiesPerLab: 4,
    };

    function get() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : { ...DEFAULTS };
        } catch {
            return { ...DEFAULTS };
        }
    }

    function update(partial) {
        const current = get();
        const updated = { ...current, ...partial };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
    }

    function isConfigured() {
        const s = get();
        return !!s.apiKey;
    }

    // ── AI API Calls ──

    async function callAI(messages, options = {}) {
        const s = get();
        if (!s.apiKey) throw new Error('No API key configured. Go to Settings to add one.');

        const provider = s.aiProvider || 'claude';

        if (provider === 'claude') {
            return callClaude(s, messages, options);
        } else if (provider === 'openai') {
            return callOpenAI(s, messages, options);
        } else if (provider === 'custom') {
            return callCustom(s, messages, options);
        }

        throw new Error('Unknown AI provider: ' + provider);
    }

    async function callClaude(s, messages, options) {
        const systemMsg = messages.find(m => m.role === 'system');
        const chatMessages = messages.filter(m => m.role !== 'system');

        const body = {
            model: s.model || 'claude-sonnet-4-20250514',
            max_tokens: options.maxTokens || 4096,
            messages: chatMessages.map(m => ({ role: m.role, content: m.content })),
        };

        if (systemMsg) {
            body.system = systemMsg.content;
        }

        const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': s.apiKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true',
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Claude API error (${res.status}): ${err}`);
        }

        const data = await res.json();
        return data.content?.[0]?.text || '';
    }

    async function callOpenAI(s, messages, options) {
        const body = {
            model: s.model || 'gpt-4o',
            max_tokens: options.maxTokens || 4096,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
        };

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${s.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`OpenAI API error (${res.status}): ${err}`);
        }

        const data = await res.json();
        return data.choices?.[0]?.message?.content || '';
    }

    async function callCustom(s, messages, options) {
        const body = {
            model: s.model || 'default',
            max_tokens: options.maxTokens || 4096,
            messages: messages.map(m => ({ role: m.role, content: m.content })),
        };

        const res = await fetch(s.endpointUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${s.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Custom API error (${res.status}): ${err}`);
        }

        const data = await res.json();
        // Try common response formats
        return data.content?.[0]?.text || data.choices?.[0]?.message?.content || JSON.stringify(data);
    }

    async function testConnection() {
        try {
            const result = await callAI([
                { role: 'system', content: 'Reply with exactly: Connection successful' },
                { role: 'user', content: 'Test' },
            ], { maxTokens: 50 });
            return { ok: true, message: result.slice(0, 100) };
        } catch (e) {
            return { ok: false, message: e.message };
        }
    }

    return { get, update, isConfigured, callAI, testConnection };
})();
