(function () {
    'use strict';

    const LLM_PORT = 8080;
    const LLM_PATH = '/completion';
    const LLM_TIMEOUT_MS = 15000;

    function getConfiguredEndpoint() {
        return typeof window.KP_LLM_ENDPOINT === 'string' && window.KP_LLM_ENDPOINT.trim().length > 0
            ? window.KP_LLM_ENDPOINT.trim()
            : null;
    }

    function buildEndpointUrl(hostname) {
        return `http://${hostname}:${LLM_PORT}${LLM_PATH}`;
    }

    function getEndpointCandidates() {
        const configuredEndpoint = getConfiguredEndpoint();
        if (configuredEndpoint) return [configuredEndpoint];

        const candidates = [];
        const pageHost = window.location && window.location.hostname ? window.location.hostname : '';

        if (pageHost) {
            candidates.push(buildEndpointUrl(pageHost));
        }

        candidates.push(buildEndpointUrl('127.0.0.1'));
        candidates.push(buildEndpointUrl('localhost'));

        return [...new Set(candidates)];
    }

    function buildPrompt(text) {
        return [
            'Return JSON only. No markdown. No explanation. No extra text.',
            'Analyze the memory text and return exactly this SceneData JSON shape:',
            '{',
            '  "location": "string",',
            '  "time_of_day": "string",',
            '  "weather": "string",',
            '  "atmosphere": "string",',
            '  "emotion_valence": number,',
            '  "emotion_intensity": number,',
            '  "persons": ["string"],',
            '  "hidden_context_candidates": ["string"]',
            '}',
            'Keep emotion_valence between -1 and 1.',
            'Keep emotion_intensity between 0 and 1.',
            'Use short strings for location, time_of_day, weather, and atmosphere.',
            'Use an empty array when persons or hidden_context_candidates are unknown.',
            '',
            'Memory text:',
            text,
        ].join('\n');
    }

    function extractJsonObject(responseText) {
        const start = responseText.indexOf('{');
        const end = responseText.lastIndexOf('}');

        if (start === -1 || end === -1 || end < start) {
            return null;
        }

        try {
            return JSON.parse(responseText.slice(start, end + 1));
        } catch (_error) {
            return null;
        }
    }

    async function requestCompletion(endpoint, text) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify({
                    prompt: buildPrompt(text),
                    n_predict: 512,
                    temperature: 0.1,
                    stop: ['\n\n'],
                }),
            });

            if (!response.ok) {
                console.warn(`[LLM] Request failed for ${endpoint}:`, response.status, response.statusText);
                return null;
            }

            const payload = await response.json();
            const responseText = typeof payload.content === 'string' ? payload.content : '';
            return extractJsonObject(responseText);
        } catch (error) {
            if (error && error.name === 'AbortError') {
                console.warn(`[LLM] Request timed out for ${endpoint} after ${LLM_TIMEOUT_MS}ms`);
                return null;
            }

            throw error;
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    async function llm_analyze_memory(text) {
        const endpoints = getEndpointCandidates();

        for (let index = 0; index < endpoints.length; index += 1) {
            const endpoint = endpoints[index];

            try {
                const scene = await requestCompletion(endpoint, text);
                if (scene) return scene;
                if (index === endpoints.length - 1) return null;
            } catch (error) {
                console.warn(`[LLM] Network request failed for ${endpoint}:`, error);
                if (index === endpoints.length - 1) return null;
            }
        }

        return null;
    }

    window.llm_analyze_memory = llm_analyze_memory;

    console.log('[LLM] Module ready, endpoints:', getEndpointCandidates().join(', '));
}());
