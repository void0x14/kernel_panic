async function init() {
    // ============================================================
    // BOOT DIAGNOSTICS — measure each stage
    // ============================================================
    const diag = {
        secure_context: window.isSecureContext,
        page_url: location.href,
        has_navigator_gpu: false,
        adapter_ok: false,
        device_ok: false,
        gpu_stage: 'not_started',
        gpu_error: '',
        wasm_ok: false,
        wasm_error: '',
    };

    // Stage 1: navigator.gpu exists?
    diag.has_navigator_gpu = !!navigator.gpu;
    if (!diag.has_navigator_gpu) {
        diag.gpu_stage = 'api_missing';
    }

    // Stage 2: adapter
    let adapter = null;
    if (diag.gpu_stage === 'not_started') {
        try {
            adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
            if (!adapter) {
                diag.gpu_stage = 'adapter_null';
            } else {
                diag.adapter_ok = true;
            }
        } catch (e) {
            diag.gpu_stage = 'adapter_error';
            diag.gpu_error = e.message || String(e);
        }
    }

    // Stage 3: device
    let device = null;
    if (diag.gpu_stage === 'not_started') {
        try {
            device = await adapter.requestDevice();
            diag.device_ok = true;
            diag.gpu_stage = 'ok';
        } catch (e) {
            diag.gpu_stage = 'device_failed';
            diag.gpu_error = e.message || String(e);
        }
    }

    // Stage 4: WASM
    let wasm = null;
    try {
        const { instance } = await WebAssembly.instantiateStreaming(
            fetch('../zig-out/bin/kernel-panic-sim.wasm'),
        );
        wasm = instance.exports;
        wasm.sim_init(42);
        window._kpWasm = wasm;
        diag.wasm_ok = true;
    } catch (e) {
        diag.wasm_ok = false;
        diag.wasm_error = e.message || String(e);
    }

    // Publish diagnostics
    window._kpBootDiag = diag;
    console.log('[BOOT] ' + JSON.stringify(diag));

    // ============================================================
    // Original boot continues from here (unchanged behavior)
    // ============================================================
    const canvas = document.getElementById('c');

    function clamp01(value) {
        return Math.min(1, Math.max(0, value));
    }

    function lerp(a, b, t) {
        return a + (b - a) * t;
    }

    function mixColor(a, b, t) {
        return [
            lerp(a[0], b[0], t),
            lerp(a[1], b[1], t),
            lerp(a[2], b[2], t),
        ];
    }

    function colorToCss(color, alpha) {
        return `rgba(${Math.round(clamp01(color[0]) * 255)}, ${Math.round(clamp01(color[1]) * 255)}, ${Math.round(clamp01(color[2]) * 255)}, ${alpha})`;
    }

    function getAmbientTint(timeOfDay) {
        switch (timeOfDay) {
            case 'morning': return [0.72, 0.80, 0.92];
            case 'afternoon': return [0.92, 0.92, 0.86];
            case 'evening': return [0.88, 0.58, 0.36];
            case 'night': return [0.14, 0.18, 0.34];
            default: return [0.42, 0.46, 0.52];
        }
    }

    function getAtmosphereTint(atmosphere) {
        switch (atmosphere) {
            case 'tense': return [0.72, 0.18, 0.16];
            case 'calm': return [0.18, 0.46, 0.66];
            case 'melancholic': return [0.36, 0.34, 0.54];
            case 'euphoric': return [0.94, 0.72, 0.28];
            case 'neutral': return [0.38, 0.40, 0.42];
            default: return [0.38, 0.40, 0.42];
        }
    }

    function getFogScalar(weather) {
        switch (weather) {
            case 'clear': return 0.02;
            case 'overcast': return 0.18;
            case 'rain': return 0.30;
            case 'fog': return 0.52;
            default: return 0.10;
        }
    }

    function buildVisualState(sceneData, panicScore) {
        const ambientTint = getAmbientTint(sceneData.time_of_day);
        const atmosphereTint = getAtmosphereTint(sceneData.atmosphere);
        const fogScalar = getFogScalar(sceneData.weather);
        const intensity = Number.isFinite(sceneData.emotion_intensity) ? clamp01(sceneData.emotion_intensity) : 0;
        const panic = Number.isFinite(panicScore) ? clamp01(panicScore / 1.5) : 0;
        const desaturationScalar = clamp01(panic * 0.85);
        const distortionScalar = clamp01(panic * 0.9 + intensity * 0.25);
        const jitterScalar = clamp01(intensity * 0.75);
        const clearColor = mixColor(ambientTint, atmosphereTint, 0.38 + panic * 0.2);

        return {
            ambient_tint: ambientTint,
            atmosphere_tint: atmosphereTint,
            fog_scalar: fogScalar,
            jitter_scalar: jitterScalar,
            distortion_scalar: distortionScalar,
            desaturation_scalar: desaturationScalar,
            clear_color: clearColor,
        };
    }

    function applyVisualState(sceneData, panicScore) {
        const visualState = buildVisualState(sceneData || {}, panicScore);
        const topColor = mixColor(visualState.clear_color, [1, 1, 1], 0.08);
        const bottomColor = mixColor(visualState.clear_color, [0, 0, 0], 0.72 + visualState.desaturation_scalar * 0.12);
        const hazeAlpha = clamp01(0.16 + visualState.fog_scalar * 0.55);
        document.body.style.background = `radial-gradient(circle at top, ${colorToCss(topColor, 0.96)} 0%, ${colorToCss(visualState.atmosphere_tint, 0.42)} 38%, ${colorToCss(bottomColor, 1)} 100%)`;
        canvas.style.filter = `blur(${(visualState.fog_scalar * 3.5).toFixed(2)}px) saturate(${(1 - visualState.desaturation_scalar * 0.55).toFixed(2)}) contrast(${(1 + visualState.distortion_scalar * 0.18).toFixed(2)}) brightness(${(0.92 + (1 - visualState.fog_scalar) * 0.12).toFixed(2)})`;
        canvas.style.opacity = `${(0.88 + (1 - visualState.fog_scalar) * 0.12).toFixed(2)}`;
        canvas.style.boxShadow = `inset 0 0 ${Math.round(36 + visualState.distortion_scalar * 90)}px ${colorToCss(visualState.atmosphere_tint, hazeAlpha)}`;
        window._kpVisualState = visualState;
        return visualState;
    }

    function escapeHtml(value) {
        return String(value ?? '').replace(/[&<>"']/g, (char) => {
            switch (char) {
                case '&': return '&amp;';
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '"': return '&quot;';
                case '\'': return '&#39;';
                default: return char;
            }
        });
    }

    function createNarrativeState() {
        return {
            timeline: [],
            hiddenSignals: [],
            hiddenSignalIndex: 0,
            lastCueAdvanceMs: 0,
            lastSceneSignature: '',
            lastHiddenSignature: '',
            selectedBranchId: 0,
            selectedTimelineIndex: 0,
            hiddenRevealOpen: false,
            divergenceCoeff: 0.6,
            branchMetrics: {},
        };
    }

    const narrativeState = window._kpNarrativeState && typeof window._kpNarrativeState === 'object'
        ? window._kpNarrativeState
        : createNarrativeState();
    window._kpNarrativeState = narrativeState;
    const MAX_BRANCHES = 64;
    window._kpActiveBranchCount = window._kpActiveBranchCount || 1;

    function cloneSceneSnapshot(sceneData) {
        const nextScene = sceneData && typeof sceneData === 'object' ? sceneData : {};
        return {
            source: nextScene.source || 'unknown',
            location: nextScene.location || 'unknown',
            time_of_day: nextScene.time_of_day || 'unknown',
            weather: nextScene.weather || 'unknown',
            atmosphere: nextScene.atmosphere || 'unknown',
            emotion_valence: Number.isFinite(nextScene.emotion_valence) ? nextScene.emotion_valence : 0,
            emotion_intensity: Number.isFinite(nextScene.emotion_intensity) ? nextScene.emotion_intensity : 0,
            sigma: Number.isFinite(nextScene.sigma) ? nextScene.sigma : 0,
            llm_mode: nextScene.llm_mode || '',
            llm_status: nextScene.llm_status || '',
            llm_latency_ms: nextScene.llm_latency_ms ?? null,
            fallback_reason: nextScene.fallback_reason || '',
            persons: Array.isArray(nextScene.persons) ? nextScene.persons.slice() : [],
            hidden_context_candidates: Array.isArray(nextScene.hidden_context_candidates) ? nextScene.hidden_context_candidates.slice() : [],
        };
    }

    function formatClockLabel(timestampMs) {
        const date = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now());
        const parts = [date.getHours(), date.getMinutes(), date.getSeconds()]
            .map((value) => String(value).padStart(2, '0'));
        return parts.join(':');
    }

    function setHiddenSignals(sceneData) {
        const signals = Array.isArray(sceneData.hidden_context_candidates)
            ? sceneData.hidden_context_candidates.filter((item) => typeof item === 'string' && item.trim().length > 0).slice(0, 4)
            : [];

        narrativeState.hiddenSignals = signals;
        if (narrativeState.hiddenSignalIndex >= signals.length) {
            narrativeState.hiddenSignalIndex = 0;
        }
        if (signals.length <= 1) {
            narrativeState.lastCueAdvanceMs = 0;
        }
    }

    function summarizeScene(sceneData) {
        const parts = [];
        if (sceneData.location) parts.push(sceneData.location);
        if (sceneData.time_of_day && sceneData.time_of_day !== 'unknown') parts.push(sceneData.time_of_day);
        if (sceneData.atmosphere && sceneData.atmosphere !== 'unknown') parts.push(sceneData.atmosphere);
        return parts.length > 0 ? parts.join(' · ') : 'scene updated';
    }

    function ensureBranchMetric(branchId) {
        if (!narrativeState.branchMetrics[branchId]) {
            narrativeState.branchMetrics[branchId] = {
                currentPanic: 0,
                maxDelta: 0,
                criticalTick: 0,
            };
        }
        return narrativeState.branchMetrics[branchId];
    }

    function updateBranchMetric(branchId, panicScore, tick) {
        const metric = ensureBranchMetric(branchId);
        metric.currentPanic = Number.isFinite(panicScore) ? panicScore : 0;
        if (typeof tick === 'number' && Number.isFinite(tick)) {
            metric.lastTick = tick;
        }

        if (branchId === 0) {
            return metric;
        }

        const baseMetric = ensureBranchMetric(0);
        const delta = Math.abs(metric.currentPanic - baseMetric.currentPanic);
        if (delta >= metric.maxDelta) {
            metric.maxDelta = delta;
            metric.criticalTick = metric.lastTick || 0;
        }
        return metric;
    }

    function getTimelineEntry(index) {
        return Number.isInteger(index) && index >= 0 && index < narrativeState.timeline.length
            ? narrativeState.timeline[index]
            : null;
    }

    function getSelectedSceneSnapshot() {
        const selectedEntry = getTimelineEntry(narrativeState.selectedTimelineIndex);
        if (selectedEntry && selectedEntry.sceneSnapshot) {
            return selectedEntry.sceneSnapshot;
        }
        if (window._kpSceneData && typeof window._kpSceneData === 'object') {
            return cloneSceneSnapshot(window._kpSceneData);
        }
        return null;
    }

    function getRelevantForkEntry(branchId) {
        return narrativeState.timeline.find((entry) => (
            entry.type === 'fork' && (
                entry.targetBranchId === branchId
                || entry.branchId === branchId
            )
        )) || narrativeState.timeline.find((entry) => entry.type === 'fork') || null;
    }

    function pushTimelineEvent(type, text, timestampMs, metadata) {
        const event = {
            type,
            text,
            timestamp_ms: Number.isFinite(timestampMs) ? timestampMs : Date.now(),
            sceneSnapshot: metadata && metadata.sceneSnapshot ? cloneSceneSnapshot(metadata.sceneSnapshot) : null,
            branchId: metadata && Number.isInteger(metadata.branchId) ? metadata.branchId : 0,
            sourceBranchId: metadata && Number.isInteger(metadata.sourceBranchId) ? metadata.sourceBranchId : null,
            targetBranchId: metadata && Number.isInteger(metadata.targetBranchId) ? metadata.targetBranchId : null,
            divergenceCoeff: metadata && typeof metadata.divergenceCoeff === 'number' ? metadata.divergenceCoeff : null,
        };
        narrativeState.timeline.unshift(event);
        narrativeState.selectedTimelineIndex = 0;
        if (Number.isInteger(event.targetBranchId)) {
            narrativeState.selectedBranchId = event.targetBranchId;
        } else if (Number.isInteger(event.branchId)) {
            narrativeState.selectedBranchId = event.branchId;
        }
    }

    function selectBranch(branchId) {
        if (!Number.isInteger(branchId) || branchId < 0) return;
        narrativeState.selectedBranchId = branchId;
        syncNarrativeUi();
    }

    function selectTimelineEntry(index) {
        const entry = getTimelineEntry(index);
        if (!entry) return;
        narrativeState.selectedTimelineIndex = index;
        if (Number.isInteger(entry.targetBranchId)) {
            narrativeState.selectedBranchId = entry.targetBranchId;
        } else if (Number.isInteger(entry.branchId)) {
            narrativeState.selectedBranchId = entry.branchId;
        }
        setHiddenSignals(entry.sceneSnapshot || window._kpSceneData || {});
        syncNarrativeUi();
    }

    function toggleHiddenReveal() {
        if (narrativeState.hiddenSignals.length === 0) return;
        narrativeState.hiddenRevealOpen = !narrativeState.hiddenRevealOpen;
        syncNarrativeUi();
    }

    function performFork(sourceBranchId) {
        if (!wasm) return -1;
        const fromBranchId = Number.isInteger(sourceBranchId) ? sourceBranchId : 0;
        if ((Number(window._kpActiveBranchCount) || 1) >= MAX_BRANCHES) return -1;
        const coeff = clamp01(narrativeState.divergenceCoeff);
        const newId = wasm.sim_fork(fromBranchId, coeff);
        if (newId <= 0) return newId;
        window._kpActiveBranchCount = newId + 1;
        const sceneData = window._kpSceneData || {};
        pushTimelineEvent('fork', `b${fromBranchId} -> b${newId} coeff ${coeff.toFixed(2)}`, Date.now(), {
            sceneSnapshot: sceneData,
            branchId: newId,
            sourceBranchId: fromBranchId,
            targetBranchId: newId,
            divergenceCoeff: coeff,
        });
        syncNarrativeUi();
        console.log(`Forked: new branch ${newId}, active=${window._kpActiveBranchCount}, coeff=${coeff.toFixed(2)}`);
        return newId;
    }

    function bindNarrativeInteractions() {
        if (narrativeState._bound) return;
        const branchEl = document.getElementById('kp-branch-list');
        const timelineListEl = document.getElementById('kp-timeline-list');
        const revealBtn = document.getElementById('kp-hidden-reveal');
        const forkBtn = document.getElementById('kp-fork-now');
        const divergenceSlider = document.getElementById('kp-divergence');

        if (branchEl) {
            branchEl.addEventListener('click', (event) => {
                const button = event.target.closest('.branch-btn');
                if (!button) return;
                selectBranch(Number(button.dataset.branchId));
            });
        }

        if (timelineListEl) {
            timelineListEl.addEventListener('click', (event) => {
                const button = event.target.closest('.timeline-entry-btn');
                if (!button) return;
                selectTimelineEntry(Number(button.dataset.index));
            });
        }

        if (revealBtn) {
            revealBtn.addEventListener('click', () => {
                toggleHiddenReveal();
            });
        }

        if (forkBtn) {
            forkBtn.addEventListener('click', () => {
                performFork(0);
            });
        }

        if (divergenceSlider) {
            divergenceSlider.addEventListener('input', () => {
                narrativeState.divergenceCoeff = Number(divergenceSlider.value);
                syncNarrativeUi();
            });
        }

        narrativeState._bound = true;
    }

    function syncNarrativeUi(nowMs) {
        const hiddenSignalEl = document.getElementById('kp-hidden-signal');
        const hiddenRevealBtn = document.getElementById('kp-hidden-reveal');
        const hiddenDetailEl = document.getElementById('kp-hidden-context-detail');
        const compareEl = document.getElementById('kp-branch-compare');
        const selectedEventEl = document.getElementById('kp-selected-event');
        const driftIndicatorEl = document.getElementById('kp-drift-indicator');
        const divergenceValueEl = document.getElementById('kp-divergence-value');
        const divergenceSlider = document.getElementById('kp-divergence');
        const forkBtn = document.getElementById('kp-fork-now');
        const timelineListEl = document.getElementById('kp-timeline-list');
        const now = Number.isFinite(nowMs) ? nowMs : performance.now();
        const branchCount = Math.max(1, Number(window._kpActiveBranchCount) || 1);
        if (!Number.isInteger(narrativeState.selectedBranchId) || narrativeState.selectedBranchId >= branchCount) {
            narrativeState.selectedBranchId = 0;
        }

        const selectedScene = getSelectedSceneSnapshot();
        const selectedSignals = Array.isArray(selectedScene && selectedScene.hidden_context_candidates)
            ? selectedScene.hidden_context_candidates.filter((item) => typeof item === 'string' && item.trim().length > 0).slice(0, 4)
            : [];

        if (hiddenSignalEl) {
            const signals = narrativeState.hiddenSignals;
            if (signals.length === 0) {
                hiddenSignalEl.dataset.active = 'false';
                hiddenSignalEl.textContent = 'No hidden context signal.';
            } else {
                if (signals.length > 1) {
                    if (narrativeState.lastCueAdvanceMs === 0) {
                        narrativeState.lastCueAdvanceMs = now;
                    } else if (now - narrativeState.lastCueAdvanceMs > 2600) {
                        narrativeState.hiddenSignalIndex = (narrativeState.hiddenSignalIndex + 1) % signals.length;
                        narrativeState.lastCueAdvanceMs = now;
                    }
                }
                hiddenSignalEl.dataset.active = 'true';
                hiddenSignalEl.textContent = signals[narrativeState.hiddenSignalIndex] || signals[0];
            }
        }

        if (divergenceValueEl) {
            divergenceValueEl.textContent = narrativeState.divergenceCoeff.toFixed(2);
        }

        if (divergenceSlider && Number(divergenceSlider.value) !== narrativeState.divergenceCoeff) {
            divergenceSlider.value = String(narrativeState.divergenceCoeff);
        }

        if (forkBtn) {
            forkBtn.disabled = !wasm || branchCount >= MAX_BRANCHES;
        }

        if (compareEl) {
            const focusBranchId = narrativeState.selectedBranchId;
            const baseScore = wasm ? wasm.sim_panic_score(0) : 0;
            const focusScore = wasm ? wasm.sim_panic_score(focusBranchId) : 0;
            const forkEntry = getRelevantForkEntry(focusBranchId);
            const focusMetric = ensureBranchMetric(focusBranchId);
            const currentDelta = Math.abs(focusScore - baseScore);
            compareEl.innerHTML = [
                ['focus', `b${focusBranchId}`],
                ['base', baseScore.toFixed(4)],
                ['focus_score', focusScore.toFixed(4)],
                ['delta', (focusScore - baseScore).toFixed(4)],
                ['peak_delta', focusMetric.maxDelta.toFixed(4)],
                ['critical_tick', String(focusMetric.criticalTick || 0)],
                ['fork', forkEntry ? forkEntry.text : (focusBranchId === 0 ? 'root branch' : 'no fork event yet')],
            ].map(([key, value]) => (
                `<div class="narrative-row"><span class="narrative-key">${escapeHtml(key)}</span><span class="narrative-value">${escapeHtml(value)}</span></div>`
            )).join('');

            if (driftIndicatorEl) {
                const level = currentDelta >= 0.5 ? 'split' : currentDelta >= 0.15 ? 'shifting' : 'stable';
                driftIndicatorEl.dataset.level = level;
                driftIndicatorEl.textContent = level;
            }
        }

        if (hiddenRevealBtn) {
            hiddenRevealBtn.disabled = selectedSignals.length === 0;
            hiddenRevealBtn.textContent = selectedSignals.length === 0
                ? 'NO CONTEXT TO REVEAL'
                : (narrativeState.hiddenRevealOpen ? 'HIDE CONTEXT' : 'REVEAL CONTEXT');
        }

        if (hiddenDetailEl) {
            if (!narrativeState.hiddenRevealOpen || selectedSignals.length === 0 || !selectedScene) {
                hiddenDetailEl.hidden = true;
                hiddenDetailEl.innerHTML = '';
            } else {
                const activeCue = selectedSignals[narrativeState.hiddenSignalIndex] || selectedSignals[0];
                hiddenDetailEl.hidden = false;
                hiddenDetailEl.innerHTML = [
                    `<div><span class="narrative-key">scene</span> <span class="narrative-value">${escapeHtml(summarizeScene(selectedScene))}</span></div>`,
                    `<div><span class="narrative-key">active</span> <span class="narrative-value">${escapeHtml(activeCue)}</span></div>`,
                    `<div class="hidden-context-list">${selectedSignals.map((cue) => `<span class="hidden-context-chip">${escapeHtml(cue)}</span>`).join('')}</div>`,
                ].join('');
            }
        }

        if (selectedEventEl) {
            const selectedEntry = getTimelineEntry(narrativeState.selectedTimelineIndex);
            if (!selectedEntry) {
                selectedEventEl.innerHTML = '<div class="timeline-entry"><span class="timeline-text">No event selected.</span></div>';
            } else {
                const sceneSnapshot = selectedEntry.sceneSnapshot;
                const summary = sceneSnapshot ? summarizeScene(sceneSnapshot) : 'no scene snapshot';
                const branchLabel = Number.isInteger(selectedEntry.targetBranchId)
                    ? `b${selectedEntry.sourceBranchId} -> b${selectedEntry.targetBranchId}`
                    : `b${selectedEntry.branchId}`;
                const extra = [];
                if (sceneSnapshot && sceneSnapshot.persons.length > 0) extra.push(`persons ${sceneSnapshot.persons.join(', ')}`);
                if (sceneSnapshot && sceneSnapshot.hidden_context_candidates.length > 0) extra.push(`hidden ${sceneSnapshot.hidden_context_candidates.length}`);
                if (typeof selectedEntry.divergenceCoeff === 'number') extra.push(`coeff ${selectedEntry.divergenceCoeff.toFixed(2)}`);
                selectedEventEl.innerHTML = [
                    `<div class="narrative-row"><span class="narrative-key">event</span><span class="narrative-value">${escapeHtml(selectedEntry.type)}</span></div>`,
                    `<div class="narrative-row"><span class="narrative-key">time</span><span class="narrative-value">${escapeHtml(formatClockLabel(selectedEntry.timestamp_ms))}</span></div>`,
                    `<div class="narrative-row"><span class="narrative-key">branch</span><span class="narrative-value">${escapeHtml(branchLabel)}</span></div>`,
                    `<div class="narrative-row"><span class="narrative-key">summary</span><span class="narrative-value">${escapeHtml(summary)}</span></div>`,
                    `<div class="timeline-entry"><span class="timeline-text">${escapeHtml(extra.join(' | ') || selectedEntry.text)}</span></div>`,
                ].join('');
            }
        }

        if (timelineListEl) {
            if (narrativeState.timeline.length === 0) {
                timelineListEl.innerHTML = '<div class="timeline-entry"><span class="timeline-text">No scene or fork events yet.</span></div>';
            } else {
                timelineListEl.innerHTML = narrativeState.timeline.map((entry, index) => (
                    `<div class="timeline-entry" data-type="${escapeHtml(entry.type)}"><button class="timeline-entry-btn" data-index="${index}" data-selected="${index === narrativeState.selectedTimelineIndex ? 'true' : 'false'}"><span class="timeline-time">${escapeHtml(formatClockLabel(entry.timestamp_ms))}</span><span class="timeline-type">${escapeHtml(entry.type)}</span><span class="timeline-text">${escapeHtml(entry.text)}</span></button></div>`
                )).join('');
            }
        }
    }

    function handleSceneNarrativeUpdate(sceneData, timestampMs) {
        const nextScene = cloneSceneSnapshot(sceneData || {});
        const hiddenSignature = Array.isArray(nextScene.hidden_context_candidates)
            ? nextScene.hidden_context_candidates.join('|')
            : '';
        const signature = [
            nextScene.source || '',
            nextScene.llm_mode || '',
            nextScene.location || '',
            nextScene.time_of_day || '',
            nextScene.atmosphere || '',
            hiddenSignature,
        ].join('::');

        setHiddenSignals(nextScene);

        if (signature !== narrativeState.lastSceneSignature) {
            narrativeState.lastSceneSignature = signature;
            pushTimelineEvent('scene', `${nextScene.source || 'scene'} ${summarizeScene(nextScene)}`, timestampMs, {
                sceneSnapshot: nextScene,
                branchId: 0,
            });
        }

        if (hiddenSignature && hiddenSignature !== narrativeState.lastHiddenSignature) {
            narrativeState.lastHiddenSignature = hiddenSignature;
            pushTimelineEvent('hidden', `${nextScene.hidden_context_candidates[0]} surfaced`, timestampMs, {
                sceneSnapshot: nextScene,
                branchId: 0,
            });
        } else if (!hiddenSignature) {
            narrativeState.lastHiddenSignature = '';
        }

        syncNarrativeUi();
    }

    window.addEventListener('kp:scene-updated', (event) => {
        const detail = event.detail || {};
        handleSceneNarrativeUpdate(detail.sceneData || window._kpSceneData || {}, detail.timestamp_ms);
    });

    if (window._kpSceneData && typeof window._kpSceneData === 'object') {
        handleSceneNarrativeUpdate(window._kpSceneData, Date.now());
    } else {
        syncNarrativeUi();
    }
    bindNarrativeInteractions();

    // Derive runtime state from diagnostics
    const hasWebGPU = diag.gpu_stage === 'ok';

    if (!hasWebGPU || !wasm) {
        let activeBranchCount = 1;
        window._kpActiveBranchCount = activeBranchCount;
        window.addEventListener('keydown', (event) => {
            if (event.code !== 'KeyF' || !wasm || activeBranchCount >= MAX_BRANCHES) return;
            const newId = performFork(0);
            if (newId > 0) activeBranchCount = Number(window._kpActiveBranchCount) || activeBranchCount;
        });
        function updatePanicDisplay() {
            const panicEl = document.getElementById('kp-panic-scores');
            const branchEl = document.getElementById('kp-branch-list');
            const sceneEl = document.getElementById('kp-scene-data');
            if (!panicEl || !branchEl) return;
            activeBranchCount = Math.max(activeBranchCount, Number(window._kpActiveBranchCount) || 1);

            if (wasm) {
                const mem = new DataView(wasm.memory.buffer);
                for (let i = 0; i < activeBranchCount; i++) {
                    const ptr = wasm.sim_step(i);
                    const tick = Number(mem.getBigUint64(ptr + 20, true));
                    updateBranchMetric(i, wasm.sim_panic_score(i), tick);
                }
            }

            let panicHtml = '';
            let branchHtml = '';
            for (let i = 0; i < activeBranchCount; i++) {
                const score = wasm ? wasm.sim_panic_score(i) : 0;
                const isPanic = score > 1.0;
                const color = i === 0 ? '#FFFFFF' : i === 1 ? '#00C8FF' : i === 2 ? '#FFC800' : '#FF8000';
                panicHtml += `<div class="${isPanic ? 'panic-alert' : ''}">b${i}: ${score.toFixed(4)}</div>`;
                branchHtml += `<button class="branch-btn" data-branch-id="${i}" data-selected="${narrativeState.selectedBranchId === i ? 'true' : 'false'}" style="color:${color}">b${i} ${isPanic ? '⚠ PANIC' : ''}</button>`;
            }
            window._kpActiveBranchCount = activeBranchCount;
            panicEl.innerHTML = panicHtml;
            branchEl.innerHTML = branchHtml;
            if (!sceneEl) return;
            const sceneData = window._kpSceneData || {};
            applyVisualState(sceneData, wasm ? wasm.sim_panic_score(0) : 0);
            const sceneRows = [
                ['source', sceneData.source ? sceneData.source.toUpperCase() : '-'],
                ['location', sceneData.location || '-'],
                ['time', sceneData.time_of_day || '-'],
                ['weather', sceneData.weather || '-'],
                ['atmosphere', sceneData.atmosphere || '-'],
                ['valence', Number.isFinite(sceneData.emotion_valence) ? sceneData.emotion_valence.toFixed(3) : '-'],
                ['intensity', Number.isFinite(sceneData.emotion_intensity) ? sceneData.emotion_intensity.toFixed(3) : '-'],
                ['llm_status', sceneData.llm_status || '-'],
                ['latency_ms', sceneData.llm_latency_ms ?? '-'],
                ['fallback_reason', sceneData.fallback_reason || '-'],
            ];
            sceneEl.innerHTML = sceneRows.map(([key, value]) => (
                `<div class="scene-row"><span class="scene-key">${key}</span><span class="scene-value">${value}</span></div>`
            )).join('');
            syncNarrativeUi();
        }
        setInterval(updatePanicDisplay, 250);
        console.log('[INIT] UI-only mode (no render) - polling active');
        return;
    }

    // ============================================================
    // WebGPU render path — below only runs if hasWebGPU && wasm
    // ============================================================
    const context = canvas.getContext('webgpu');
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });

    function resize() {
        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
    }
    resize();
    window.addEventListener('resize', resize);

    // Track active branch count from JS side (mirrors wasm internal state)
    let activeBranchCount = 1;
    window._kpActiveBranchCount = activeBranchCount;

    // DataView for reading WASM linear memory (must be recreated on memory.growth)
    let mem = new DataView(wasm.memory.buffer);

    console.log('[INIT] WASM loaded, sim running, WebGPU render active');

    // ============================================================
    // Shaders — unchanged from Phase 2
    // ============================================================
    const shaderCode = /* wgsl */ `
        struct Uniforms {
            view_proj: mat4x4<f32>,
        };
        @group(0) @binding(0) var<uniform> uniforms: Uniforms;

        struct VertexInput {
            @location(0) position: vec3<f32>,
            @location(1) color: vec3<f32>,
        };

        struct VertexOutput {
            @builtin(position) clip_position: vec4<f32>,
            @location(0) frag_color: vec3<f32>,
        };

        @vertex
        fn vs_main(in: VertexInput) -> VertexOutput {
            var out: VertexOutput;
            out.clip_position = uniforms.view_proj * vec4<f32>(in.position, 1.0);
            out.frag_color = in.color;
            return out;
        }

        @fragment
        fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
            return vec4<f32>(in.frag_color, 1.0);
        }
    `;

    const bindGroupLayout = device.createBindGroupLayout({
        entries: [{
            binding: 0,
            visibility: GPUShaderStage.VERTEX,
            buffer: { type: 'uniform' },
        }],
    });

    const pipelineLayout = device.createPipelineLayout({
        bindGroupLayouts: [bindGroupLayout],
    });

    const pipeline = device.createRenderPipeline({
        layout: pipelineLayout,
        vertex: {
            module: device.createShaderModule({ code: shaderCode }),
            entryPoint: 'vs_main',
            buffers: [{
                arrayStride: 24,
                attributes: [
                    { shaderLocation: 0, offset: 0, format: 'float32x3' },
                    { shaderLocation: 1, offset: 12, format: 'float32x3' },
                ],
            }],
        },
        fragment: {
            module: device.createShaderModule({ code: shaderCode }),
            entryPoint: 'fs_main',
            targets: [{ format }],
        },
        primitive: { topology: 'point-list' },
    });

    // ============================================================
    // Camera — identical to Phase 2
    // ============================================================
    const camera = {
        x: 0.0, y: 0.0, z: -5.0,
        pitch: 0.0,
        yaw: 0.0,
    };

    function mat4Perspective(fovY, aspect, near, far) {
        const f = 1.0 / Math.tan(fovY / 2.0);
        const rangeInv = 1.0 / (near - far);
        return new Float32Array([
            f / aspect, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (near + far) * rangeInv, -1,
            0, 0, near * far * rangeInv * 2, 0,
        ]);
    }

    function mat4LookAt(eye, target, up) {
        const zx = eye[0] - target[0], zy = eye[1] - target[1], zz = eye[2] - target[2];
        let len = Math.sqrt(zx * zx + zy * zy + zz * zz);
        const fz = [zx / len, zy / len, zz / len];
        const sx = up[1] * fz[2] - up[2] * fz[1];
        const sy = up[2] * fz[0] - up[0] * fz[2];
        const sz = up[0] * fz[1] - up[1] * fz[0];
        len = Math.sqrt(sx * sx + sy * sy + sz * sz);
        const fx = [sx / len, sy / len, sz / len];
        const ux = [fz[1] * fx[2] - fz[2] * fx[1], fz[2] * fx[0] - fz[0] * fx[2], fz[0] * fx[1] - fz[1] * fx[0]];
        return new Float32Array([
            fx[0], ux[0], fz[0], 0,
            fx[1], ux[1], fz[1], 0,
            fx[2], ux[2], fz[2], 0,
            -(fx[0] * eye[0] + fx[1] * eye[1] + fx[2] * eye[2]),
            -(ux[0] * eye[0] + ux[1] * eye[1] + ux[2] * eye[2]),
            -(fz[0] * eye[0] + fz[1] * eye[1] + fz[2] * eye[2]),
            1,
        ]);
    }

    function mat4Mul(a, b) {
        const o = new Float32Array(16);
        for (let c = 0; c < 4; c++) {
            for (let r = 0; r < 4; r++) {
                o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
            }
        }
        return o;
    }

    function getViewProjMatrix() {
        const aspect = canvas.width / canvas.height;
        const proj = mat4Perspective(75 * Math.PI / 180, aspect, 0.1, 100.0);
        const dirX = Math.cos(camera.pitch) * Math.sin(camera.yaw);
        const dirY = -Math.sin(camera.pitch);
        const dirZ = Math.cos(camera.pitch) * Math.cos(camera.yaw);
        const view = mat4LookAt(
            [camera.x, camera.y, camera.z],
            [camera.x + dirX, camera.y + dirY, camera.z + dirZ],
            [0, 1, 0],
        );
        return mat4Mul(proj, view);
    }

    // ============================================================
    // GPU buffers — uniform stays same, vertex buffer now dynamic
    // ============================================================
    const uniformBuffer = device.createBuffer({
        size: 64,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const bindGroup = device.createBindGroup({
        layout: bindGroupLayout,
        entries: [{ binding: 0, resource: { buffer: uniformBuffer } }],
    });

    // Pre-allocate vertex buffer for MAX_BRANCHES = 64
    // Each point: [x, y, z, r, g, b] = 6 floats = 24 bytes
    // Total: 64 * 24 = 1536 bytes
    const vertexData = new Float32Array(MAX_BRANCHES * 6);
    const vertexBuffer = device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // ============================================================
    // Branch color mapping — deterministic per branch_id
    // ============================================================
    // WHY branch-based colors: lets the eye track which timeline is which
    function getBranchColor(branchId, panicScore) {
        if (panicScore > 1.0) return [1.0, 0.1, 0.1]; // panic override: red
        switch (branchId) {
            case 0: return [1.0, 1.0, 1.0];       // white — the original
            case 1: return [0.0, 0.8, 1.0];       // cyan — first fork
            case 2: return [1.0, 0.8, 0.0];       // yellow — second fork
            default: return [1.0, 0.5, 0.0];      // orange — deep forks
        }
    }

    // ============================================================
    // Input — keyboard + pointer lock (same as Phase 2, plus F key)
    // ============================================================
    const keys = {};
    window.addEventListener('keydown', (e) => { keys[e.code] = true; });
    window.addEventListener('keyup', (e) => { keys[e.code] = false; });

    let mouseLocked = false;
    canvas.addEventListener('click', () => {
        if (!mouseLocked) canvas.requestPointerLock();
    });
    document.addEventListener('pointerlockchange', () => {
        mouseLocked = document.pointerLockElement === canvas;
    });
    document.addEventListener('mousemove', (e) => {
        if (!mouseLocked) return;
        const sensitivity = 0.002;
        camera.yaw += e.movementX * sensitivity;
        camera.pitch += e.movementY * sensitivity;
        const maxPitch = 89 * Math.PI / 180;
        if (camera.pitch > maxPitch) camera.pitch = maxPitch;
        if (camera.pitch < -maxPitch) camera.pitch = -maxPitch;
    });

    // ============================================================
    // Self-test logging — once per second
    // ============================================================
    let lastLogTime = performance.now();

    function logStatus() {
        const scores = [];
        for (let i = 0; i < activeBranchCount; i++) {
            const score = wasm.sim_panic_score(i);
            scores.push(`b${i}:${score.toFixed(3)}`);
        }
        console.log(`branches=${activeBranchCount} panic=[${scores.join(', ')}]`);
    }

    function updatePanicDisplay() {
        const panicEl = document.getElementById('kp-panic-scores');
        const branchEl = document.getElementById('kp-branch-list');
        const sceneEl = document.getElementById('kp-scene-data');
        if (!panicEl || !branchEl) return;

        let panicHtml = '';
        let branchHtml = '';
        for (let i = 0; i < activeBranchCount; i++) {
            const score = wasm.sim_panic_score(i);
            const isPanic = score > 1.0;
            const scoreClass = isPanic ? 'panic-alert' : '';
            const color = i === 0 ? '#FFFFFF' : i === 1 ? '#00C8FF' : i === 2 ? '#FFC800' : '#FF8000';
            panicHtml += `<div class="${scoreClass}">b${i}: ${score.toFixed(4)}</div>`;
            branchHtml += `<button class="branch-btn" data-branch-id="${i}" data-selected="${narrativeState.selectedBranchId === i ? 'true' : 'false'}" style="color:${color}">b${i} ${isPanic ? '⚠ PANIC' : ''}</button>`;
        }
        window._kpActiveBranchCount = activeBranchCount;
        panicEl.innerHTML = panicHtml;
        branchEl.innerHTML = branchHtml;

        if (!sceneEl) return;

        const sceneData = window._kpSceneData || {};
        const sceneRows = [
            ['source', sceneData.source ? sceneData.source.toUpperCase() : '-'],
            ['location', sceneData.location || '-'],
            ['time', sceneData.time_of_day || '-'],
            ['weather', sceneData.weather || '-'],
            ['atmosphere', sceneData.atmosphere || '-'],
            ['valence', Number.isFinite(sceneData.emotion_valence) ? sceneData.emotion_valence.toFixed(3) : '-'],
            ['intensity', Number.isFinite(sceneData.emotion_intensity) ? sceneData.emotion_intensity.toFixed(3) : '-'],
            ['llm_status', sceneData.llm_status || '-'],
            ['latency_ms', sceneData.llm_latency_ms ?? '-'],
            ['fallback_reason', sceneData.fallback_reason || '-'],
        ];

        sceneEl.innerHTML = sceneRows.map(([key, value]) => (
            `<div class="scene-row"><span class="scene-key">${key}</span><span class="scene-value">${value}</span></div>`
        )).join('');
        syncNarrativeUi();
    }

    // ============================================================
    // Render loop — sim_step drives positions, dynamic vertex upload
    // ============================================================
    function frame() {
        // Re-read DataView if WASM memory grew (unlikely but safe)
        mem = new DataView(wasm.memory.buffer);
        activeBranchCount = Math.max(activeBranchCount, Number(window._kpActiveBranchCount) || 1);

        // F key: fork from branch 0 with divergence_coeff=0.6
        // WHY branch 0: the original timeline is always the fork source
        if (keys['KeyF'] && activeBranchCount < MAX_BRANCHES) {
            const newId = performFork(0);
            if (newId > 0) activeBranchCount = Number(window._kpActiveBranchCount) || activeBranchCount;
            keys['KeyF'] = false; // debounce: one fork per press
        }

        // P key: log camera position
        if (keys['KeyP']) {
            console.log(`Camera: (${camera.x.toFixed(2)}, ${camera.y.toFixed(2)}, ${camera.z.toFixed(2)}) yaw=${(camera.yaw * 180 / Math.PI).toFixed(1)}° pitch=${(camera.pitch * 180 / Math.PI).toFixed(1)}°`);
            keys['KeyP'] = false;
        }

        // WASD movement
        const moveSpeed = 0.1;
        const fwdX = Math.sin(camera.yaw);
        const fwdZ = Math.cos(camera.yaw);
        const rightX = Math.cos(camera.yaw);
        const rightZ = -Math.sin(camera.yaw);
        if (keys['KeyW']) { camera.x += fwdX * moveSpeed; camera.z += fwdZ * moveSpeed; }
        if (keys['KeyS']) { camera.x -= fwdX * moveSpeed; camera.z -= fwdZ * moveSpeed; }
        if (keys['KeyA']) { camera.x -= rightX * moveSpeed; camera.z -= rightZ * moveSpeed; }
        if (keys['KeyD']) { camera.x += rightX * moveSpeed; camera.z += rightZ * moveSpeed; }
        if (keys['Space'])     camera.y += moveSpeed;
        if (keys['ShiftLeft']) camera.y -= moveSpeed;

        // Step simulation and populate vertex buffer
        for (let i = 0; i < activeBranchCount; i++) {
            const ptr = wasm.sim_step(i); // returns byte offset into WASM memory

            // Read StateVector fields from WASM linear memory
            const x = mem.getFloat32(ptr + 0, true);
            const y = mem.getFloat32(ptr + 4, true);
            const z = mem.getFloat32(ptr + 8, true);
            // sigma at ptr+12, theta at ptr+16 — not needed for rendering
            // tick at ptr+20 (u64), branch_id at ptr+28 (u32) — already known

            // Compute panic score for color decision
            const panicScore = wasm.sim_panic_score(i);
            const tick = Number(mem.getBigUint64(ptr + 20, true));
            updateBranchMetric(i, panicScore, tick);
            const [r, g, b] = getBranchColor(i, panicScore);
            const visualState = buildVisualState(window._kpSceneData || {}, wasm.sim_panic_score(0));
            const jitter = visualState.jitter_scalar * (1 + visualState.distortion_scalar) * 0.035;
            const phase = performance.now() * 0.008 + i * 1.7;

            // Write interleaved [x, y, z, r, g, b] into vertex buffer
            const off = i * 6;
            vertexData[off + 0] = x + Math.sin(phase) * jitter;
            vertexData[off + 1] = y + Math.cos(phase * 1.37) * jitter;
            vertexData[off + 2] = z;
            vertexData[off + 3] = r;
            vertexData[off + 4] = g;
            vertexData[off + 5] = b;
        }

        // Upload vertex data to GPU — only active branches
        device.queue.writeBuffer(vertexBuffer, 0, vertexData, 0, activeBranchCount * 6);

        // Self-test: log branch stats every 250ms
        const now = performance.now();
        if (now - lastLogTime > 250) {
            logStatus();
            updatePanicDisplay();
            lastLogTime = now;
        }

        // Standard WebGPU render pass
        const vpMatrix = getViewProjMatrix();
        device.queue.writeBuffer(uniformBuffer, 0, vpMatrix);
        const activeVisualState = applyVisualState(window._kpSceneData || {}, wasm.sim_panic_score(0));

        const encoder = device.createCommandEncoder();
        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: context.getCurrentTexture().createView(),
                clearValue: {
                    r: activeVisualState.clear_color[0],
                    g: activeVisualState.clear_color[1],
                    b: activeVisualState.clear_color[2],
                    a: 1.0,
                },
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });
        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.setVertexBuffer(0, vertexBuffer);
        pass.draw(activeBranchCount); // only draw active branches, not all 64
        pass.end();
        device.queue.submit([encoder.finish()]);
        requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}
init();
