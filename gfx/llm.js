'use strict';

const LLM_CONFIG = {
    baseUrl: 'http://127.0.0.1:8080/v1',
    chatEndpoint: '/chat/completions',
    model: 'gemma-3-4b-it-Q4_K_M.gguf',
    maxTokens: 128,
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

async function requestCompletionDetailed(text) {
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
            return {
                status: 'request_error',
                sceneData: null,
                content: '',
                http_status: response.status,
                error_message: response.statusText || 'Request failed',
            };
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
            return {
                status: 'empty_response',
                sceneData: null,
                content: '',
            };
        }

        const sceneData = extractJsonObject(content);
        if (!sceneData) {
            console.warn('[LLM] No valid JSON in content');
            return {
                status: 'invalid_json',
                sceneData: null,
                content,
            };
        }

        return {
            status: 'ok',
            sceneData,
            content,
        };
    } catch (error) {
        window.clearTimeout(timeoutId);
        const message = error && error.message ? error.message : String(error);
        console.warn('[LLM] Unexpected error:', message);
        return {
            status: 'request_error',
            sceneData: null,
            content: '',
            error_message: message,
        };
    }
}

async function requestCompletion(text) {
    const result = await requestCompletionDetailed(text);
    return result.status === 'ok' ? result.sceneData : null;
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

function normalizeLocation(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function getValenceSign(valence) {
    if (typeof valence !== 'number' || !Number.isFinite(valence)) return null;
    if (valence < -0.15) return 'negative';
    if (valence > 0.15) return 'positive';
    return 'neutral';
}

function getIntensityBand(intensity) {
    if (typeof intensity !== 'number' || !Number.isFinite(intensity)) return null;
    if (intensity <= 0.33) return 'low';
    if (intensity <= 0.66) return 'mid';
    return 'high';
}

function getSceneNormalizer() {
    return window._kpParser && typeof window._kpParser.parseLlmSceneData === 'function'
        ? window._kpParser.parseLlmSceneData
        : null;
}

function roundMetric(value, digits) {
    const scale = 10 ** digits;
    return Math.round(value * scale) / scale;
}

function buildActualResult(normalizedScene) {
    const location = normalizedScene && typeof normalizedScene.location === 'string'
        ? normalizedScene.location
        : null;
    const valence = normalizedScene && typeof normalizedScene.emotion_valence === 'number'
        ? normalizedScene.emotion_valence
        : null;
    const intensity = normalizedScene && typeof normalizedScene.emotion_intensity === 'number'
        ? normalizedScene.emotion_intensity
        : null;

    return {
        location,
        valence,
        intensity,
        valence_sign: getValenceSign(valence),
        intensity_band: getIntensityBand(intensity),
    };
}

function evaluateFixture(fixture, requestResult, latencyMs) {
    const normalizeScene = getSceneNormalizer();
    const normalizedScene = requestResult.status === 'ok' && normalizeScene
        ? normalizeScene(requestResult.sceneData)
        : requestResult.status === 'ok'
            ? requestResult.sceneData
            : null;
    const actual = buildActualResult(normalizedScene);
    const failures = [];

    if (requestResult.status === 'invalid_json' || requestResult.status === 'empty_response' || requestResult.status === 'request_error') {
        failures.push(requestResult.status);
    } else {
        if (normalizeLocation(actual.location) !== normalizeLocation(fixture.expected.location)) {
            failures.push('location mismatch');
        }
        if (actual.valence_sign !== fixture.expected.valence_sign) {
            failures.push('valence sign mismatch');
        }
        if (actual.intensity_band !== fixture.expected.intensity_band) {
            failures.push('intensity band mismatch');
        }
    }

    return {
        id: fixture.id,
        text: fixture.text,
        status: requestResult.status,
        expected: {
            location: fixture.expected.location,
            valence_sign: fixture.expected.valence_sign,
            intensity_band: fixture.expected.intensity_band,
        },
        actual,
        pass: failures.length === 0,
        failures,
        latency_ms: roundMetric(latencyMs, 2),
        error_message: requestResult.error_message || null,
    };
}

function buildBatchTableRows(report) {
    return report.cases.map((item) => ({
        id: item.id,
        status: item.status,
        pass: item.pass ? 'PASS' : 'FAIL',
        expected_location: item.expected.location,
        actual_location: item.actual.location,
        expected_valence_sign: item.expected.valence_sign,
        actual_valence_sign: item.actual.valence_sign,
        expected_intensity_band: item.expected.intensity_band,
        actual_intensity_band: item.actual.intensity_band,
        failures: item.failures.join(', '),
        latency_ms: item.latency_ms,
    }));
}

async function runBatch(fixtures) {
    const activeFixtures = Array.isArray(fixtures) && fixtures.length > 0
        ? fixtures
        : Array.isArray(window._kpLLMFixtures)
            ? window._kpLLMFixtures
            : [];

    if (activeFixtures.length === 0) {
        const emptyReport = {
            total: 0,
            passed: 0,
            failed: 0,
            accuracy: 0,
            accuracy_pct: 0,
            avg_latency_ms: 0,
            cases: [],
        };
        console.warn('[LLM][BATCH] No fixtures available');
        return emptyReport;
    }

    const cases = [];

    for (const fixture of activeFixtures) {
        const startTime = performance.now();
        const requestResult = await requestCompletionDetailed(fixture.text);
        const latencyMs = performance.now() - startTime;
        cases.push(evaluateFixture(fixture, requestResult, latencyMs));
    }

    const total = cases.length;
    const passed = cases.filter((item) => item.pass).length;
    const failed = total - passed;
    const accuracy = total === 0 ? 0 : roundMetric(passed / total, 4);
    const avgLatency = total === 0
        ? 0
        : roundMetric(cases.reduce((sum, item) => sum + item.latency_ms, 0) / total, 2);
    const report = {
        total,
        passed,
        failed,
        accuracy,
        accuracy_pct: roundMetric(accuracy * 100, 2),
        avg_latency_ms: avgLatency,
        cases,
    };

    console.log('[LLM][BATCH] Summary', {
        total: report.total,
        passed: report.passed,
        failed: report.failed,
        accuracy: report.accuracy,
        accuracy_pct: report.accuracy_pct,
        avg_latency_ms: report.avg_latency_ms,
    });
    console.table(buildBatchTableRows(report));

    window._kpLLMBatchLastReport = report;
    return report;
}

(function loadModule() {
    if (typeof window._kpLLM !== 'undefined') return;

    window.llm_analyze_memory = llm_analyze_memory;

    window._kpLLM = {
        analyze_memory: llm_analyze_memory,
        test: llmTest,
        testBatch: runBatch,
        fixtures: window._kpLLMFixtures || [],
    };

    console.log('[LLM] Module ready, endpoint:', getEndpointUrl());
})();
