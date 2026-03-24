'use strict';

const LLM_CONFIG = {
    baseUrl: 'http://127.0.0.1:8080/v1',
    chatEndpoint: '/chat/completions',
    model: 'gemma-3-4b-it-Q4_K_M.gguf',
    maxTokens: 1024,
    temperature: 0.1,
};

function getEndpointUrl() {
    return LLM_CONFIG.baseUrl + LLM_CONFIG.chatEndpoint;
}

function buildMessages(text) {
    return [
        {
            role: 'system',
            content: 'Return ONLY valid JSON. No explanation. No markdown. No extra text.',
        },
        {
            role: 'user',
            content: [
                'Analyze this memory and return SceneData JSON.',
                '',
                'Fields:',
                '{"location":"string","time_of_day":"morning|afternoon|evening|night","weather":"clear|overcast|rain|fog","atmosphere":"tense|calm|melancholic|euphoric|neutral","emotion_valence":-1.0 to 1.0,"emotion_intensity":0.0 to 1.0,"persons":["string"],"hidden_context_candidates":["string"]}',
                '',
                'Memory:',
                text,
            ].join('\n'),
        },
    ];
}

function buildBody(text) {
    return {
        model: LLM_CONFIG.model,
        messages: buildMessages(text),
        max_tokens: LLM_CONFIG.maxTokens,
        temperature: LLM_CONFIG.temperature,
    };
}

function extractJsonObject(responseText) {
    let cleaned = responseText;
    // Remove markdown code fences
    cleaned = cleaned.replace(/```json\s*/gi, '');
    cleaned = cleaned.replace(/```\s*/g, '');

    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start === -1 || end === -1 || end < start) {
        return null;
    }

    try {
        return JSON.parse(cleaned.slice(start, end + 1));
    } catch (_error) {
        return null;
    }
}

async function requestCompletion(text) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    const endpoint = getEndpointUrl();

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildBody(text)),
            signal: controller.signal,
        });
        window.clearTimeout(timeoutId);

        if (!response.ok) {
            console.warn('[LLM] Request failed:', response.status, response.statusText);
            return null;
        }

        const payload = await response.json();
        const content = payload.choices
            && payload.choices[0]
            && payload.choices[0].message
            && typeof payload.choices[0].message.content === 'string'
            ? payload.choices[0].message.content
            : '';

        if (!content) {
            console.warn('[LLM] Empty content in response');
            return null;
        }

        const sceneData = extractJsonObject(content);
        if (!sceneData) {
            console.warn('[LLM] No valid JSON in content');
            return null;
        }

        return sceneData;
    } catch (error) {
        window.clearTimeout(timeoutId);
        console.warn('[LLM] Unexpected error:', error && error.message ? error.message : error);
        return null;
    }
}

async function llm_analyze_memory(text) {
    console.log('[LLM] Analyzing memory...');
    return await requestCompletion(text);
}

function llmTest(text) {
    if (typeof window.llm_analyze_memory !== 'function') {
        console.warn('[LLM] Analyzer not available');
        return null;
    }

    return window.llm_analyze_memory(text);
}

(function loadModule() {
    if (typeof window._kpLLM !== 'undefined') return;

    window._kpLLM = {
        analyze_memory: llm_analyze_memory,
        test: llmTest,
    };

    console.log('[LLM] Module ready, endpoint:', getEndpointUrl());
})();
