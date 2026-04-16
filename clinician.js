// ==========================================
// CSF Test — Clinician View
// ==========================================

const channel = new BroadcastChannel('nearpoint-csf');

let currentLine = null;   // { snellenDenom, letters, contrasts, pass, levelIndex, totalLevels }
let errors = [];          // [0,0,1,0,...] per letter
let testComplete = false;
let markMode = 'wrong';   // 'wrong' = mark incorrect (default), 'correct' = mark correct
let lastCompletedResults = null; // stashed after test completes
let responseHistory = [];        // running log of submitted responses
let activeCSFRefs = new Set();
let csfLightingMode = 'photopic';
let csfCompletedResults = { photopic: null, mesopic: null };
let activePatientId = null;
let activePatient = null;        // { id, name, email }

// ==========================================
// Patient Database (IndexedDB)
// ==========================================

const PatientDB = {
    db: null,
    _openPromise: null,

    // Idempotent open — safe to call multiple times, returns cached promise
    open() {
        if (this._openPromise) return this._openPromise;
        this._openPromise = new Promise((resolve, reject) => {
            const req = indexedDB.open('nearpoint-db', 2); // v2: ensure indexes exist
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('patients')) {
                    const ps = db.createObjectStore('patients', { keyPath: 'id', autoIncrement: true });
                    ps.createIndex('name', 'name', { unique: false });
                }
                let rs;
                if (!db.objectStoreNames.contains('csfResults')) {
                    rs = db.createObjectStore('csfResults', { keyPath: 'id', autoIncrement: true });
                } else {
                    rs = e.target.transaction.objectStore('csfResults');
                }
                // Ensure indexes exist (may have been missing in v1)
                if (!rs.indexNames.contains('patientId')) {
                    rs.createIndex('patientId', 'patientId', { unique: false });
                }
                if (!rs.indexNames.contains('date')) {
                    rs.createIndex('date', 'date', { unique: false });
                }
            };
            req.onsuccess = (e) => {
                this.db = e.target.result;
                // Handle version change from another tab
                this.db.onversionchange = () => {
                    this.db.close();
                    this.db = null;
                    this._openPromise = null;
                };
                resolve();
            };
            req.onerror = (e) => {
                console.error('PatientDB open failed:', e.target.error);
                this._openPromise = null; // allow retry
                reject(e.target.error);
            };
        });
        return this._openPromise;
    },

    // All methods await open() so the DB is guaranteed ready
    async _store(name, mode) {
        await this.open();
        return this.db.transaction(name, mode).objectStore(name);
    },

    async addPatient(name, email) {
        const store = await this._store('patients', 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.add({ name, email, createdAt: Date.now() });
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async getPatients() {
        const store = await this._store('patients', 'readonly');
        return new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async getPatient(id) {
        const store = await this._store('patients', 'readonly');
        return new Promise((resolve, reject) => {
            const req = store.get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async saveCSFResult(patientId, results, graphDataURL, correctionType, lightingMode) {
        const store = await this._store('csfResults', 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.add({
                patientId, date: Date.now(), results, graphDataURL,
                correctionType: correctionType || 'bcva',
                lightingMode: lightingMode || 'photopic'
            });
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async getPatientResults(patientId) {
        const store = await this._store('csfResults', 'readonly');
        return new Promise((resolve, reject) => {
            // Try index query first, fall back to full scan if index is missing
            let req;
            try {
                const idx = store.index('patientId');
                req = idx.getAll(patientId);
            } catch (e) {
                // Index missing — fall back to scanning all records
                console.warn('patientId index missing, scanning all records');
                req = store.getAll();
                req.onsuccess = () => {
                    const filtered = req.result
                        .filter(r => r.patientId == patientId) // loose equality handles type mismatch
                        .sort((a, b) => b.date - a.date);
                    resolve(filtered);
                };
                req.onerror = (e2) => reject(e2.target.error);
                return;
            }
            req.onsuccess = () => resolve(req.result.sort((a, b) => b.date - a.date));
            req.onerror = (e) => reject(e.target.error);
        });
    },

    async deleteResult(resultId) {
        const store = await this._store('csfResults', 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.delete(resultId);
            req.onsuccess = () => resolve();
            req.onerror = (e) => reject(e.target.error);
        });
    }
};

PatientDB.open().catch(err => console.error('PatientDB init failed:', err));

// --- DOM refs ---
const $ = (sel) => document.querySelector(sel);
const waitingPanel = $('#waiting-panel');
const testPanel = $('#test-panel');
const resultsPanel = $('#results-panel');
const statusBadge = $('#status-badge');
const levelInfo = $('#level-info');
const lettersGrid = $('#letters-grid');
const progressFill = $('#progress-fill');
const btnNext = $('#btn-next');
const btnAbort = $('#btn-abort');
const pass3Panel = $('#pass3-panel');

// --- Notify patient display that clinician is ready ---
channel.postMessage({ type: 'clinician-ready' });

// --- Message handler ---
let pendingPass3Denoms = null; // stash noisy denoms while clinician decides

channel.onmessage = (e) => {
    const data = e.data;
    switch (data.type) {
        case 'csf-line':
            showLine(data);
            break;
        case 'csf-complete':
            // Reattach acuity anchor and lighting mode to results array
            if (data.acuityAnchor != null) data.results.acuityAnchor = data.acuityAnchor;
            if (data.acuityFail != null) data.results.acuityFail = data.acuityFail;
            if (data.lightingMode) data.results.lightingMode = data.lightingMode;
            showResults(data.results);
            break;
        case 'csf-suggest-pass3':
            showPass3Suggestion(data.results, data.noisyDenoms);
            break;
        case 'csf-cancel':
            showCancelled();
            break;
        case 'line-update':
            // Patient display reports current line info
            if (data.indicator) {
                const ind = $('#line-ctrl-indicator');
                if (ind) ind.textContent = data.indicator;
            }
            break;
    }
};

// --- Show a new line of letters ---
function showLine(data) {
    currentLine = data;
    // Clear history at the start of a new test
    if (data.pass === 1 && data.levelIndex === 0 && !data.acuityCheck && !data.adaptivePhase) {
        responseHistory = [];
        const hc = $('#response-history');
        if (hc) hc.innerHTML = '';
    }
    // In "mark correct" mode, default all to wrong so clinician taps the correct ones
    errors = new Array(data.letters.length).fill(markMode === 'correct' ? 1 : 0);
    testComplete = false;

    waitingPanel.classList.add('hidden');
    resultsPanel.classList.add('hidden');
    testPanel.classList.remove('hidden');

    if (data.acuityCheck) {
        statusBadge.textContent = `Acuity — 20/${data.snellenDenom}`;
        statusBadge.className = 'status-badge waiting';
        statusBadge.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        levelInfo.innerHTML = `<strong>20/${data.snellenDenom}</strong> — Acuity Check (100% contrast, need 3/${data.letters.length} correct)`;
    } else if (data.peakAnchor) {
        statusBadge.textContent = `Peak — 20/${data.snellenDenom}`;
        statusBadge.className = 'status-badge waiting';
        statusBadge.style.background = 'linear-gradient(135deg, #f59e0b, #d97706)';
        levelInfo.innerHTML = `<strong>20/${data.snellenDenom}</strong> — Peak Sensitivity (contrast sweep to anchor Y-axis)`;
    } else if (data.adaptivePhase) {
        const labels = ['Knee', 'Confirm', 'Retest'];
        const label = labels[Math.min(data.adaptiveStep, 2)];
        statusBadge.textContent = `Adaptive ${label} — 20/${data.snellenDenom}`;
        statusBadge.className = 'status-badge waiting';
        statusBadge.style.background = 'linear-gradient(135deg, #3b82f6, #1d4ed8)';
        const desc = data.adaptiveStep === 0
            ? 'Paired contrast sweep at curve inflection point'
            : data.adaptiveStep === 1
            ? 'Paired contrast sweep to confirm curve shape'
            : 'Retesting suspect measurement';
        levelInfo.innerHTML = `<strong>20/${data.snellenDenom}</strong> — ${desc}`;
    } else {
        statusBadge.textContent = `Pass ${data.pass} — 20/${data.snellenDenom}`;
        statusBadge.className = 'status-badge waiting';
        statusBadge.style.background = '';
        levelInfo.innerHTML = `<strong>20/${data.snellenDenom}</strong> — Pass ${data.pass}, Level ${data.levelIndex + 1} of ${data.totalLevels}`;
    }

    // Progress: combine passes (pass 1: 0-50%, pass 2: 50-100%)
    const passOffset = (data.pass - 1) * 50;
    const levelProgress = (data.levelIndex / data.totalLevels) * 50;
    progressFill.style.width = (passOffset + levelProgress) + '%';

    // Render letter cells
    lettersGrid.innerHTML = '';
    data.letters.forEach((letter, i) => {
        const contrast = data.contrasts[i];
        // Clinician view: boost contrast so letters are always readable
        // Map patient contrast (1.25-100%) to clinician gray (0-160) so even
        // the faintest letters are still clearly visible as dark gray
        const clinicianGray = Math.round(160 * (1 - Math.min(1, contrast / 100)));
        const contrastLabel = contrast < 10 ? contrast.toFixed(1) + '%' : Math.round(contrast) + '%';

        const cell = document.createElement('div');
        cell.className = 'letter-cell';

        const display = document.createElement('div');
        display.className = 'letter-display';
        display.style.color = `rgb(${clinicianGray}, ${clinicianGray}, ${clinicianGray})`;
        display.textContent = letter;

        const label = document.createElement('div');
        label.className = 'letter-contrast';
        label.textContent = contrastLabel;

        const toggle = document.createElement('button');
        toggle.className = 'mark-toggle';
        toggle.dataset.index = i;
        applyToggleStyle(toggle, i);
        toggle.addEventListener('click', () => {
            if (markMode === 'wrong') {
                errors[i] = errors[i] ? 0 : 1;
            } else {
                // 'correct' mode: clicking marks as correct (clears error)
                // If already correct, toggle back to wrong
                errors[i] = errors[i] ? 0 : 1;
                // Invert: in correct mode, active = correct = no error
                // We still store errors[] the same way, just invert the visual
            }
            applyToggleStyle(toggle, i);
        });

        cell.appendChild(display);
        cell.appendChild(label);
        cell.appendChild(toggle);
        lettersGrid.appendChild(cell);
    });

    btnNext.disabled = false;
}

function applyToggleStyle(toggle, i) {
    if (markMode === 'wrong') {
        // Default mode: toggles show X, active = marked wrong
        toggle.textContent = '\u2717'; // ✗
        toggle.classList.toggle('active-wrong', !!errors[i]);
        toggle.classList.remove('active-correct');
    } else {
        // Correct mode: toggles show checkmark, active = marked correct
        toggle.textContent = '\u2713'; // ✓
        toggle.classList.toggle('active-correct', !errors[i]);
        toggle.classList.remove('active-wrong');
    }
}

function refreshAllToggles() {
    const toggles = lettersGrid.querySelectorAll('.mark-toggle');
    toggles.forEach((toggle, i) => applyToggleStyle(toggle, i));
}

function switchMarkMode(mode) {
    if (mode === markMode) return;
    const prevMode = markMode;
    markMode = mode;

    const modeBtn = $('#btn-mark-mode');
    const hint = $('#mark-hint');
    if (markMode === 'correct') {
        modeBtn.textContent = 'Mode: Mark Correct';
        modeBtn.classList.add('mode-correct');
        if (hint) hint.textContent = 'Tap correct letters';
    } else {
        modeBtn.textContent = 'Mode: Mark Wrong';
        modeBtn.classList.remove('mode-correct');
        if (hint) hint.textContent = 'Tap wrong letters';
    }

    // When switching modes, if no toggles have been touched yet,
    // flip to all-wrong (so clinician can tap the few correct ones)
    if (prevMode === 'wrong' && mode === 'correct') {
        const anyMarked = errors.some(e => e === 1);
        if (!anyMarked) {
            errors = errors.map(() => 1); // assume all wrong, tap the correct ones
        }
    } else if (prevMode === 'correct' && mode === 'wrong') {
        const anyCorrect = errors.some(e => e === 0);
        if (!anyCorrect) {
            errors = errors.map(() => 0); // reset, tap the wrong ones
        }
    }

    refreshAllToggles();
}

// --- Mark mode toggle ---
$('#btn-mark-mode').addEventListener('click', () => {
    switchMarkMode(markMode === 'wrong' ? 'correct' : 'wrong');
});

// --- Response history ---
function renderResponseHistory() {
    const container = $('#response-history');
    if (!container) return;
    container.innerHTML = '';

    responseHistory.forEach((entry, idx) => {
        const row = document.createElement('div');
        row.className = 'history-row' + (entry.acuityCheck ? ' history-acuity' : '') + (entry.peakAnchor ? ' history-peak' : '') + (entry.adaptivePhase ? ' history-adaptive' : '');

        // Size label
        const sizeEl = document.createElement('span');
        sizeEl.className = 'history-size';
        const denomLabel = Number.isInteger(entry.snellenDenom) ? entry.snellenDenom : Math.round(entry.snellenDenom);
        sizeEl.textContent = `20/${denomLabel}`;
        row.appendChild(sizeEl);

        // Pass label
        const passEl = document.createElement('span');
        passEl.className = 'history-pass';
        passEl.textContent = entry.acuityCheck ? 'AQ' : entry.peakAnchor ? 'PK' : entry.adaptivePhase ? ['KN', 'CF', 'RT'][Math.min(entry.adaptiveStep, 2)] : `P${entry.pass}`;
        row.appendChild(passEl);

        // Mark mode indicator
        const modeEl = document.createElement('span');
        modeEl.className = 'history-mode ' + (entry.markMode === 'correct' ? 'history-mode-correct' : 'history-mode-wrong');
        modeEl.textContent = entry.markMode === 'correct' ? 'MC' : 'MW';
        modeEl.title = entry.markMode === 'correct' ? 'Mark Correct mode' : 'Mark Wrong mode';
        row.appendChild(modeEl);

        // Letters with error highlighting
        const lettersEl = document.createElement('span');
        lettersEl.className = 'history-letters';
        entry.letters.forEach((letter, i) => {
            const span = document.createElement('span');
            span.className = 'history-letter ' + (entry.errors[i] ? 'history-letter-err' : 'history-letter-ok');
            span.textContent = letter;
            // Show contrast as tooltip
            const c = entry.contrasts[i];
            span.title = c < 10 ? c.toFixed(1) + '%' : Math.round(c) + '%';
            lettersEl.appendChild(span);
        });
        row.appendChild(lettersEl);

        // Undo button (only for the most recent entry)
        if (idx === responseHistory.length - 1) {
            const undoBtn = document.createElement('button');
            undoBtn.className = 'history-undo';
            undoBtn.textContent = 'undo';
            undoBtn.title = 'Remove this response and re-show the line';
            undoBtn.onclick = () => {
                const removed = responseHistory.pop();
                renderResponseHistory();
                // Re-show the line so clinician can re-mark it
                if (removed) {
                    channel.postMessage({ type: 'csf-undo' });
                }
            };
            row.appendChild(undoBtn);
        }

        container.appendChild(row);
    });

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight;
}

// --- Send response to patient display ---
btnNext.addEventListener('click', () => {
    if (!currentLine) return;
    btnNext.disabled = true;

    // Record to response history before sending
    responseHistory.push({
        snellenDenom: currentLine.snellenDenom,
        pass: currentLine.pass,
        letters: [...currentLine.letters],
        contrasts: [...currentLine.contrasts],
        errors: [...errors],
        markMode: markMode,
        acuityCheck: currentLine.acuityCheck || false,
        peakAnchor: currentLine.peakAnchor || false,
        adaptivePhase: currentLine.adaptivePhase || false,
        adaptiveStep: currentLine.adaptiveStep
    });
    renderResponseHistory();

    channel.postMessage({ type: 'csf-response', errors: errors });
});

// --- Abort test ---
btnAbort.addEventListener('click', () => {
    channel.postMessage({ type: 'csf-abort' });
    showCancelled();
});

// --- Pass 3 decision ---
$('#btn-accept-pass3').addEventListener('click', () => {
    if (pendingPass3Denoms) {
        pass3Panel.classList.add('hidden');
        testPanel.classList.remove('hidden');
        channel.postMessage({ type: 'csf-accept-pass3', denoms: pendingPass3Denoms });
        pendingPass3Denoms = null;
    }
});

$('#btn-decline-pass3').addEventListener('click', () => {
    pass3Panel.classList.add('hidden');
    channel.postMessage({ type: 'csf-decline-pass3' });
    pendingPass3Denoms = null;
    // Results will come back via csf-complete
});

// --- Show results ---
function showResults(results) {
    testComplete = true;
    lastCompletedResults = results;
    // Store by lighting mode for dual-curve display
    const mode = results.lightingMode || 'photopic';
    csfCompletedResults[mode] = results;
    testPanel.classList.add('hidden');
    waitingPanel.classList.add('hidden');
    resultsPanel.classList.remove('hidden');

    statusBadge.textContent = 'Complete';
    statusBadge.className = 'status-badge complete';

    progressFill.style.width = '100%';

    // Enable save button
    const saveBtn = $('#btn-save-results');
    if (saveBtn) saveBtn.disabled = false;

    // Populate table
    const tbody = $('#results-tbody');
    tbody.innerHTML = '';
    results.forEach(r => {
        const tr = document.createElement('tr');
        const denomLabel = Number.isInteger(r.denom) ? r.denom : Math.round(r.denom);
        const threshStr = r.threshold >= 100 ? "Can\u2019t see"
                        : r.threshold < 10 ? r.threshold.toFixed(1) + '%'
                        : Math.round(r.threshold) + '%';
        const norm = csfNormative(r.cpd);
        const dB = 10 * Math.log10(Math.max(0.01, r.sensitivity) / norm);
        let avgStr, avgClass;
        if (r.threshold >= 100) { avgStr = '\u2014'; avgClass = ''; }
        else if (dB >= 2) { avgStr = 'Above avg'; avgClass = 'result-above'; }
        else if (dB >= -2) { avgStr = 'Average'; avgClass = 'result-avg'; }
        else { avgStr = 'Below avg'; avgClass = 'result-below'; }
        tr.innerHTML = `
            <td>20/${denomLabel}</td>
            <td>${threshStr}</td>
            <td class="${avgClass}">${avgStr}</td>
        `;
        tbody.appendChild(tr);
    });

    // Render CSF graph
    const canvas = $('#csf-graph');
    renderCSFGraph(canvas, results);

    // Show/hide mesopic and display toggle buttons based on what's been tested
    const mesopicBtn = $('#btn-run-mesopic');
    const toggleBtn = $('#btn-toggle-display');
    if (mode === 'photopic' && !csfCompletedResults.mesopic) {
        // Photopic just completed, no mesopic yet — offer to run it
        mesopicBtn.style.display = '';
        toggleBtn.style.display = 'none';
    } else {
        // Mesopic done (or viewing mesopic results) — hide run button, show toggle
        mesopicBtn.style.display = 'none';
        if (csfCompletedResults.photopic && csfCompletedResults.mesopic) {
            toggleBtn.style.display = '';
            toggleBtn.dataset.mode = mode;
            toggleBtn.textContent = mode === 'mesopic' ? 'Switch to Photopic View' : 'Switch to Mesopic View';
        } else {
            toggleBtn.style.display = 'none';
        }
    }

    // Wire up reference overlay toggles
    wireRefToggles();

    // Populate history overlay dropdown
    if (activePatientId) populateHistoryOverlay();
}

function broadcastRefUpdate() {
    channel.postMessage({
        type: 'csf-ref-update',
        refs: [...activeCSFRefs],
        lighting: csfLightingMode
    });
}

function refreshRefGraphs() {
    if (lastCompletedResults) {
        const canvas = $('#csf-graph');
        if (canvas) renderCSFGraph(canvas, lastCompletedResults);
    }
    broadcastRefUpdate();
}

function wireRefToggles() {
    document.querySelectorAll('.csf-ref-btn').forEach(btn => {
        btn.onclick = () => {
            const ref = btn.dataset.ref;
            if (activeCSFRefs.has(ref)) {
                activeCSFRefs.delete(ref);
                btn.classList.remove('active');
            } else {
                activeCSFRefs.add(ref);
                btn.classList.add('active');
            }
            refreshRefGraphs();
        };
    });

}

function showCancelled() {
    returnToLineControls();
    statusBadge.textContent = 'Cancelled';
    statusBadge.className = 'status-badge';
}

function returnToLineControls() {
    testPanel.classList.add('hidden');
    resultsPanel.classList.add('hidden');
    pass3Panel.classList.add('hidden');
    waitingPanel.classList.remove('hidden');
    statusBadge.textContent = 'Ready';
    statusBadge.className = 'status-badge';
    statusBadge.style.background = '';
}

function showPass3Suggestion(results, noisyDenoms) {
    pendingPass3Denoms = noisyDenoms;

    testPanel.classList.add('hidden');
    waitingPanel.classList.add('hidden');
    resultsPanel.classList.add('hidden');
    pass3Panel.classList.remove('hidden');

    statusBadge.textContent = 'Review';
    statusBadge.className = 'status-badge';
    statusBadge.style.background = 'linear-gradient(135deg, #8b5cf6, #6d28d9)';

    // Show which levels are noisy
    const denomList = noisyDenoms
        .map(d => `20/${Number.isInteger(d) ? d : Math.round(d)}`)
        .join(', ');
    $('#pass3-levels').textContent = denomList;
    $('#pass3-count').textContent = noisyDenoms.length;

    // Render the current (potentially noisy) graph so clinician can see the issue
    const canvas = $('#pass3-graph');
    renderCSFGraph(canvas, results);
}

// ==========================================
// CSF Graph Rendering (Normalized + Smoothed)
// ==========================================

// Normative letter-optotype CSF: low-pass shape, peak ~63 CS at 20/60.
// Pelli & Bex 2013, Alexander et al 1997, Elliott et al 1995.
const CSF_NORMATIVE_PTS = [
    { cpd: 5,   cs: 50 },
    { cpd: 6,   cs: 55 },
    { cpd: 8.6, cs: 60 },
    { cpd: 10,  cs: 63 },
    { cpd: 12,  cs: 58 },
    { cpd: 15,  cs: 45 },
    { cpd: 20,  cs: 22 },
    { cpd: 24,  cs: 10 },
    { cpd: 30,  cs: 3.5 },
    { cpd: 34,  cs: 1.5 },
    { cpd: 40,  cs: 0.5 },
];
function csfNormative(cpd) {
    const pts = CSF_NORMATIVE_PTS;
    if (cpd <= pts[0].cpd) return pts[0].cs;
    if (cpd >= pts[pts.length - 1].cpd) return pts[pts.length - 1].cs;
    const lc = Math.log10(cpd);
    for (let i = 0; i < pts.length - 1; i++) {
        const lx0 = Math.log10(pts[i].cpd), lx1 = Math.log10(pts[i + 1].cpd);
        if (lc >= lx0 && lc <= lx1) {
            const t = (lc - lx0) / (lx1 - lx0);
            const ly0 = Math.log10(pts[i].cs), ly1 = Math.log10(pts[i + 1].cs);
            return Math.pow(10, ly0 + t * (ly1 - ly0));
        }
    }
    return pts[pts.length - 1].cs;
}

// Monotone cubic Hermite (Fritsch–Carlson PCHIP) — no overshoot between knots.
// Points must be sorted by x. Returns a sampled curve that passes exactly through
// every input point. At local extrema, the slope is clamped to 0 so the curve
// cannot bulge past an anchor. Operates in whatever space the inputs are in
// (pixel coords here, which are already log-cpd × log-CS).
function pchipSpline(points, segments) {
    const n = points.length;
    if (n < 2) return points.slice();
    if (n === 2) {
        const out = [];
        for (let s = 0; s <= segments; s++) {
            const t = s / segments;
            out.push({
                x: points[0].x + t * (points[1].x - points[0].x),
                y: points[0].y + t * (points[1].y - points[0].y)
            });
        }
        return out;
    }
    const h = new Array(n - 1), d = new Array(n - 1);
    for (let i = 0; i < n - 1; i++) {
        h[i] = points[i + 1].x - points[i].x;
        d[i] = h[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / h[i];
    }
    const m = new Array(n);
    for (let i = 1; i < n - 1; i++) {
        if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
        const w1 = 2 * h[i] + h[i - 1];
        const w2 = h[i] + 2 * h[i - 1];
        m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
    const endSlope = (h0, h1, d0, d1) => {
        const s = ((2 * h0 + h1) * d0 - h0 * d1) / (h0 + h1);
        if (s * d0 <= 0) return 0;
        if (d0 * d1 <= 0 && Math.abs(s) > 3 * Math.abs(d0)) return 3 * d0;
        return s;
    };
    m[0] = endSlope(h[0], h[1] || h[0], d[0], d[1] !== undefined ? d[1] : d[0]);
    m[n - 1] = endSlope(h[n - 2], h[n - 3] !== undefined ? h[n - 3] : h[n - 2],
                        d[n - 2], d[n - 3] !== undefined ? d[n - 3] : d[n - 2]);
    const out = [];
    for (let i = 0; i < n - 1; i++) {
        const hi = h[i], x0 = points[i].x, y0 = points[i].y, y1 = points[i + 1].y;
        const m0 = m[i], m1 = m[i + 1];
        const startS = i === 0 ? 0 : 1;
        for (let s = startS; s <= segments; s++) {
            const t = s / segments;
            const t2 = t * t, t3 = t2 * t;
            const h00 = 2 * t3 - 3 * t2 + 1;
            const h10 = t3 - 2 * t2 + t;
            const h01 = -2 * t3 + 3 * t2;
            const h11 = t3 - t2;
            out.push({
                x: x0 + t * hi,
                y: h00 * y0 + h10 * hi * m0 + h01 * y1 + h11 * hi * m1
            });
        }
    }
    return out;
}

// Data-driven CSF reference scenarios (letter-CSF domain)
const CSF_SCENARIOS = {
    normal_mesopic: { label: 'Normal Mesopic', color: '#818cf8', lighting: 'mesopic', confidence: 'high',
        points: [{cpd:6,cs:33},{cpd:10,cs:37},{cpd:12,cs:30},{cpd:15,cs:19},{cpd:20,cs:6.6},{cpd:24,cs:2.0},{cpd:30,cs:0.8}] },
    older_adult: { label: 'Older Adult', color: '#a78bfa', lighting: 'photopic', confidence: 'high',
        points: [{cpd:6,cs:44},{cpd:10,cs:47},{cpd:12,cs:42},{cpd:15,cs:30},{cpd:20,cs:12},{cpd:24,cs:4.5},{cpd:30,cs:1.5}] },
    elite_aviator: { label: 'Elite Aviator', color: '#facc15', lighting: 'photopic', confidence: 'moderate',
        points: [{cpd:6,cs:61},{cpd:10,cs:72},{cpd:12,cs:68},{cpd:15,cs:55},{cpd:20,cs:29},{cpd:24,cs:14},{cpd:30,cs:5.6},{cpd:40,cs:2.0},{cpd:50,cs:1.0}] },
    elite_athlete: { label: 'Elite Athlete', color: '#fbbf24', lighting: 'photopic', confidence: 'moderate',
        points: [{cpd:6,cs:59},{cpd:10,cs:69},{cpd:12,cs:65},{cpd:15,cs:52},{cpd:20,cs:26},{cpd:24,cs:13},{cpd:30,cs:5.1},{cpd:40,cs:1.5}] },
    early_cataract: { label: 'Early Cataract', color: '#f87171', lighting: 'photopic', confidence: 'high',
        points: [{cpd:6,cs:43},{cpd:10,cs:46},{cpd:12,cs:36},{cpd:15,cs:21},{cpd:20,cs:6},{cpd:24,cs:1.2}] },
    post_lasik: { label: 'Post-LASIK', color: '#34d399', lighting: 'photopic', confidence: 'high',
        points: [{cpd:6,cs:52},{cpd:10,cs:59},{cpd:12,cs:52},{cpd:15,cs:39},{cpd:20,cs:18},{cpd:24,cs:7.5},{cpd:30,cs:2.5},{cpd:40,cs:1.0}] },
    post_lasik_mesopic: { label: 'Post-LASIK Mesopic', color: '#10b981', lighting: 'mesopic', confidence: 'high',
        points: [{cpd:6,cs:30},{cpd:10,cs:32},{cpd:12,cs:25},{cpd:15,cs:15},{cpd:20,cs:4},{cpd:24,cs:1.0}] },
    edof_iol: { label: 'EDOF IOL', color: '#38bdf8', lighting: 'mesopic', confidence: 'moderate',
        points: [{cpd:6,cs:26},{cpd:10,cs:28},{cpd:12,cs:22},{cpd:15,cs:13},{cpd:20,cs:3.5},{cpd:24,cs:1.2}] },
    mfiol: { label: 'Multifocal IOL', color: '#fb923c', lighting: 'mesopic', confidence: 'moderate',
        points: [{cpd:6,cs:21},{cpd:10,cs:22},{cpd:12,cs:17},{cpd:15,cs:10},{cpd:20,cs:2},{cpd:24,cs:0.8}] },
    scleral_before: { label: 'Scleral (Before)', color: '#f472b6', lighting: 'photopic', confidence: 'approximate',
        points: [{cpd:6,cs:19},{cpd:10,cs:19},{cpd:12,cs:15},{cpd:15,cs:8},{cpd:20,cs:2},{cpd:24,cs:0.9}] },
    scleral_after: { label: 'Scleral (After)', color: '#e879f9', lighting: 'photopic', confidence: 'approximate',
        points: [{cpd:6,cs:39},{cpd:10,cs:41},{cpd:12,cs:34},{cpd:15,cs:21},{cpd:20,cs:7},{cpd:24,cs:2.5},{cpd:30,cs:1.0}] }
};
function csfRefInterp(scenario, cpd) {
    const pts = scenario.points;
    if (cpd <= pts[0].cpd) return pts[0].cs;
    if (cpd >= pts[pts.length - 1].cpd) return pts[pts.length - 1].cs;
    const logCpd = Math.log10(cpd);
    for (let i = 0; i < pts.length - 1; i++) {
        const lx0 = Math.log10(pts[i].cpd), lx1 = Math.log10(pts[i + 1].cpd);
        if (logCpd >= lx0 && logCpd <= lx1) {
            const t = (logCpd - lx0) / (lx1 - lx0);
            const ly0 = Math.log10(Math.max(0.1, pts[i].cs));
            const ly1 = Math.log10(Math.max(0.1, pts[i + 1].cs));
            return Math.pow(10, ly0 + t * (ly1 - ly0));
        }
    }
    return pts[pts.length - 1].cs;
}

function renderCSFGraph(canvas, results) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const font = 'Inter, -apple-system, sans-serif';
    const optFont = '"Arial", "Helvetica", sans-serif';
    ctx.clearRect(0, 0, w, h);
    // White background for optotype letter visibility
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const ml = 58, mr = 16, mt = 18, mb = 64;
    const pw = w - ml - mr, ph = h - mt - mb;

    const logCpdMin = 0.65, logCpdMax = 1.85;
    const logCsMin = -0.1, logCsMax = 2.0;

    function toX(cpd) { return ml + pw * (Math.log10(Math.max(4.5, cpd)) - logCpdMin) / (logCpdMax - logCpdMin); }
    function toY(cs) { return mt + ph * (1 - (Math.log10(Math.max(0.8, cs)) - logCsMin) / (logCsMax - logCsMin)); }

    function sampleCurve(fn, steps) {
        const pts = [];
        for (let i = 0; i <= steps; i++) {
            const lc = logCpdMin + (logCpdMax - logCpdMin) * i / steps;
            const cpd = Math.pow(10, lc);
            const cs = fn(cpd);
            pts.push({ x: toX(cpd), y: toY(cs) });
            if (cs < 0.8) break;
        }
        return pts;
    }

    // Interpolate patient CS at a given cpd
    function patientCSatCpd(cpd, sortedRes) {
        if (sortedRes.length === 0) return null;
        if (sortedRes.length === 1) return sortedRes[0].sensitivity;
        const lc = Math.log10(cpd);
        if (cpd <= sortedRes[0].cpd) return sortedRes[0].sensitivity;
        if (cpd >= sortedRes[sortedRes.length - 1].cpd) return sortedRes[sortedRes.length - 1].sensitivity;
        for (let i = 0; i < sortedRes.length - 1; i++) {
            const lc1 = Math.log10(sortedRes[i].cpd), lc2 = Math.log10(sortedRes[i + 1].cpd);
            if (lc >= lc1 && lc <= lc2) {
                const t = (lc - lc1) / (lc2 - lc1);
                const ls1 = Math.log10(Math.max(0.1, sortedRes[i].sensitivity));
                const ls2 = Math.log10(Math.max(0.1, sortedRes[i + 1].sensitivity));
                return Math.pow(10, ls1 + t * (ls2 - ls1));
            }
        }
        return sortedRes[sortedRes.length - 1].sensitivity;
    }

    // Grid
    ctx.lineWidth = 0.5;
    [6,8,10,12,15,20,30,40,60].forEach(cpd => {
        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        const x = toX(cpd);
        ctx.beginPath(); ctx.moveTo(x, mt); ctx.lineTo(x, mt+ph); ctx.stroke();
    });
    [1,2,5,10,20,50,100].forEach(cs => {
        ctx.strokeStyle = 'rgba(0,0,0,0.05)';
        const y = toY(cs);
        ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml+pw, y); ctx.stroke();
    });

    // Axes
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ml, mt); ctx.lineTo(ml, mt+ph); ctx.lineTo(ml+pw, mt+ph); ctx.stroke();

    // --- Optotype letter grid (rendered behind curves) ---
    const sortedResults = [...results].sort((a, b) => a.cpd - b.cpd);
    const SLOAN_ALL = ['C','D','E','F','L','N','O','P','T','Z'];
    const baseFontPx = ph * 0.07;
    const minContrast = 1.0;

    function optFontSize(denom) {
        return Math.max(6, Math.min(baseFontPx * (denom / 100), ph * 0.25));
    }

    // Uniform column spacing based on widest column
    const widestFontPx = optFontSize(100);
    const minColSpacing = widestFontPx * 1.3;
    const numCols = Math.max(3, Math.min(40, Math.floor(pw / minColSpacing)));
    const colSpacing = pw / numCols;

    ctx.save();
    ctx.beginPath(); ctx.rect(ml, mt, pw, ph); ctx.clip();

    for (let col = 0; col < numCols; col++) {
        const x = ml + (col + 0.5) * colSpacing;
        const logCpd = logCpdMin + (x - ml) / pw * (logCpdMax - logCpdMin);
        const cpd = Math.pow(10, logCpd);
        const denom = 600 / cpd;

        const fontSize = optFontSize(denom);
        const letterHeight = fontSize * 1.15;
        const yBottom = toY(1.0);
        const yTop = mt;
        const availableH = yBottom - yTop;
        const maxLetters = Math.max(2, Math.floor(availableH / letterHeight));
        const numLetters = Math.min(maxLetters, 30);

        let bestResult = null, bestDist = Infinity;
        for (const r of sortedResults) {
            const d = Math.abs(Math.log10(r.cpd) - logCpd);
            if (d < bestDist) { bestDist = d; bestResult = r; }
        }
        const ld = (bestResult && bestDist < 0.08) ? bestResult.letterData : null;
        const denomSeed = Math.round(denom);

        // Seeded PRNG, no consecutive repeats
        let rng = (denomSeed * 2654435761) >>> 0;
        const colLetters = [];
        for (let i = 0; i < numLetters; i++) {
            rng = (rng * 1664525 + 1013904223) >>> 0;
            let idx = (rng >>> 16) % SLOAN_ALL.length;
            if (i > 0 && SLOAN_ALL[idx] === colLetters[i - 1]) {
                idx = (idx + 1) % SLOAN_ALL.length;
            }
            colLetters.push(SLOAN_ALL[idx]);
        }

        // Each tested contrast claims only its single closest grid slot
        const testedSlots = new Map();
        if (ld && ld.letters && ld.contrasts) {
            for (let j = 0; j < ld.contrasts.length; j++) {
                if (ld.errors[j]) continue;
                const logC = Math.log10(Math.max(1, ld.contrasts[j]));
                let bestI = -1, bestD = Infinity;
                for (let i = 0; i < numLetters; i++) {
                    const t = numLetters <= 1 ? 0 : i / (numLetters - 1);
                    const gridContrast = 100 * Math.pow(minContrast / 100, t);
                    const d = Math.abs(Math.log10(Math.max(1, gridContrast)) - logC);
                    if (d < bestD) { bestD = d; bestI = i; }
                }
                if (bestI >= 0 && bestD < 0.15 && !testedSlots.has(bestI)) {
                    testedSlots.set(bestI, ld.letters[j]);
                }
            }
        }

        for (let i = 0; i < numLetters; i++) {
            const t = numLetters <= 1 ? 0 : i / (numLetters - 1);
            const contrast = 100 * Math.pow(minContrast / 100, t);
            const cs = 100 / contrast;
            const y = toY(cs);
            const gray = Math.round(255 * (1 - contrast / 100));

            const letter = testedSlots.has(i) ? testedSlots.get(i) : colLetters[i];

            ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
            ctx.font = `bold ${fontSize}px ${optFont}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(letter, x, y);
        }
    }

    ctx.restore();

    // Average curve
    const normPts = sampleCurve(csfNormative, 80);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4,3]);
    ctx.beginPath();
    normPts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
    ctx.stroke();
    ctx.setLineDash([]);
    const nl = normPts[Math.round(normPts.length*0.15)];
    if (nl) { ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.font=`8px ${font}`; ctx.textAlign='left'; ctx.fillText('Average', nl.x+4, nl.y-6); }

    // Reference overlays
    activeCSFRefs.forEach(refKey => {
        const scenario = CSF_SCENARIOS[refKey];
        if (!scenario) return;
        const pts = scenario.points;
        const minCpd = pts[0].cpd, maxCpd = pts[pts.length - 1].cpd;
        const refPts = [];
        for (let i = 0; i <= 60; i++) {
            const cpd = minCpd * Math.pow(maxCpd / minCpd, i / 60);
            const cs = csfRefInterp(scenario, cpd);
            refPts.push({ x: toX(cpd), y: toY(cs) });
            if (cs < 0.8) break;
        }
        if (refPts.length < 2) return;
        const isDashed = scenario.confidence === 'approximate';
        ctx.strokeStyle = scenario.color + 'cc';
        ctx.lineWidth = 1.5;
        ctx.setLineDash(isDashed ? [4,4] : [3,3]);
        ctx.beginPath();
        refPts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
        ctx.stroke();
        ctx.setLineDash([]);
        pts.forEach(pt => {
            if (pt.cs < 0.8) return;
            ctx.fillStyle = scenario.color;
            ctx.beginPath(); ctx.arc(toX(pt.cpd), toY(pt.cs), 2, 0, Math.PI*2); ctx.fill();
        });
        const labelPt = refPts[Math.round(refPts.length * 0.18)];
        if (labelPt) {
            ctx.fillStyle = scenario.color;
            ctx.font = `9px ${font}`;
            ctx.textAlign = 'left';
            ctx.fillText(scenario.label, labelPt.x + 4, labelPt.y - 6);
        }
    });

    // Patient curve is built from up to 4 ground-truth anchors:
    //   peakAnchor (Y-axis)  — peak sensitivity contrast sweep at 20/100
    //   shoulderMid          — adaptive knee sweep
    //   descendingMid        — adaptive confirm sweep
    //   crossover (X-axis)   — CS=1 derived from acuity anchor/fail
    // The spline passes exactly through each; PCHIP guarantees no overshoot.
    const allSorted = [...results].sort((a, b) => a.cpd - b.cpd);
    const plotResults = allSorted.filter(r => r.threshold < 100);

    // Acuity anchor determines where the curve crosses CS=1.
    const acuityAnchor = results.acuityAnchor || null;
    const acuityFail = results.acuityFail || null;
    let crossoverCpd = null;
    if (acuityAnchor && acuityFail) {
        crossoverCpd = Math.pow(10, (Math.log10(600/acuityAnchor) + Math.log10(600/acuityFail)) / 2);
    } else if (acuityAnchor && !acuityFail) {
        crossoverCpd = 600 / acuityAnchor;
    } else if (plotResults.length >= 2) {
        // Legacy data without acuity anchor — extrapolate from last two points
        const last = plotResults[plotResults.length - 1];
        const prev = plotResults[plotResults.length - 2];
        if (last.sensitivity > 1.0) {
            const lc1 = Math.log10(prev.cpd), lc2 = Math.log10(last.cpd);
            const ls1 = Math.log10(prev.sensitivity), ls2 = Math.log10(last.sensitivity);
            const slope = (ls2 - ls1) / (lc2 - lc1);
            if (slope < 0) crossoverCpd = Math.pow(10, lc2 + (0 - ls2) / slope);
        }
    }

    // Pick anchor points by phase tag (new 4-point protocol).
    // If phase tags are missing (legacy result), fall back to using all measured points.
    const byPhase = {};
    for (const r of plotResults) {
        if (r.phase && !byPhase[r.phase]) byPhase[r.phase] = r;
    }
    const anchorResults = [byPhase.peakAnchor, byPhase.shoulderMid, byPhase.descendingMid].filter(Boolean);
    const useAnchors = anchorResults.length >= 2;
    const ctrlData = useAnchors ? anchorResults.sort((a, b) => a.cpd - b.cpd) : plotResults;
    const patientPts = ctrlData.map(r => ({ x: toX(r.cpd), y: toY(r.sensitivity) }));

    if (crossoverCpd) {
        const crossX = toX(crossoverCpd);
        while (patientPts.length > 0 && patientPts[patientPts.length - 1].x > crossX + 1) {
            patientPts.pop();
        }
        patientPts.push({ x: crossX, y: toY(1.0) });
    }
    const spline = patientPts.length >= 2 ? pchipSpline(patientPts, 24) : [];

    // Cosmetic left-edge extension to the Y-axis. Uses the slope between the
    // first two anchors, clamped so a descending curve can't rise above the peak.
    if (spline.length >= 2 && patientPts.length >= 2 && spline[0].x > ml + 0.5) {
        const p0 = patientPts[0], p1 = patientPts[1];
        const slope = Math.min(0, (p1.y - p0.y) / ((p1.x - p0.x) || 1));
        const extY = p0.y + (ml - p0.x) * slope;
        spline.unshift({ x: ml, y: Math.max(mt, Math.min(mt + ph, extY)) });
    }

    // Green/red fill
    const bottomY = toY(1.0);
    const splineEndX = spline.length > 0 ? spline[spline.length - 1].x : ml;

    for (let fp = 0; fp < 2; fp++) {
        ctx.save(); ctx.beginPath(); ctx.rect(ml,mt,pw,ph); ctx.clip();
        ctx.fillStyle = fp===0 ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)';
        let seg = [];
        const flush = () => {
            if (seg.length < 2) { seg = []; return; }
            ctx.beginPath();
            ctx.moveTo(seg[0].x, seg[0].ny);
            seg.forEach(pt => ctx.lineTo(pt.x, pt.py));
            for (let i = seg.length - 1; i >= 0; i--) ctx.lineTo(seg[i].x, seg[i].ny);
            ctx.closePath(); ctx.fill(); seg = [];
        };
        spline.forEach(p => {
            const lc = logCpdMin + (p.x-ml)/pw*(logCpdMax-logCpdMin);
            const ny = toY(csfNormative(Math.pow(10,lc)));
            const above = p.y < ny;
            if ((fp===0&&above)||(fp===1&&!above)) { seg.push({x:p.x, py:p.y, ny}); }
            else { flush(); }
        });
        flush();

        // Red extension past acuity limit: patient at bottom, normative still above
        if (fp === 1 && crossoverCpd) {
            const extSeg = [];
            for (let i = 0; i <= 40; i++) {
                const x = splineEndX + (ml + pw - splineEndX) * i / 40;
                if (x > ml + pw) break;
                const lc = logCpdMin + (x - ml) / pw * (logCpdMax - logCpdMin);
                const normCS = csfNormative(Math.pow(10, lc));
                if (normCS <= 0.8) break;
                const ny = toY(normCS);
                if (ny < bottomY) extSeg.push({ x, py: bottomY, ny });
            }
            if (extSeg.length >= 2) {
                ctx.beginPath();
                ctx.moveTo(extSeg[0].x, extSeg[0].ny);
                extSeg.forEach(pt => ctx.lineTo(pt.x, pt.py));
                for (let i = extSeg.length - 1; i >= 0; i--) ctx.lineTo(extSeg[i].x, extSeg[i].ny);
                ctx.closePath(); ctx.fill();
            }
        }

        ctx.restore();
    }

    // Glow + curve
    ctx.save(); ctx.shadowColor='rgba(37,99,235,0.25)'; ctx.shadowBlur=8;
    ctx.strokeStyle='rgba(37,99,235,0.08)'; ctx.lineWidth=6; ctx.lineJoin='round';
    ctx.beginPath(); spline.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke(); ctx.restore();
    ctx.strokeStyle='#2563eb'; ctx.lineWidth=2.5; ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.beginPath(); spline.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();

    // "You" label
    const graphMode = results.lightingMode || 'photopic';
    const peak = patientPts.reduce((b,p)=>p.y<b.y?p:b, patientPts[0]);
    ctx.fillStyle='#2563eb'; ctx.font=`bold 9px ${font}`; ctx.textAlign='center';
    const otherMode = graphMode === 'photopic' ? 'mesopic' : 'photopic';
    const otherResults = csfCompletedResults[otherMode];
    const modeLabel = otherResults ? (graphMode === 'mesopic' ? 'Mesopic' : 'Photopic') : '';
    ctx.fillText(modeLabel ? `You (${modeLabel})` : 'You', peak.x, peak.y-10);

    // Draw other lighting mode curve if available
    if (otherResults && otherResults.length > 0) {
        const otherColor = otherMode === 'mesopic' ? '#818cf8' : '#f59e0b';
        const otherLabel = otherMode === 'mesopic' ? 'Mesopic' : 'Photopic';
        const otherSorted = [...otherResults].filter(r => r.threshold < 100).sort((a, b) => a.cpd - b.cpd);
        if (otherSorted.length >= 2) {
            const oByPhase = {};
            for (const r of otherSorted) { if (r.phase && !oByPhase[r.phase]) oByPhase[r.phase] = r; }
            const oAnchors = [oByPhase.peakAnchor, oByPhase.shoulderMid, oByPhase.descendingMid].filter(Boolean);
            const oCtrl = oAnchors.length >= 2 ? oAnchors.sort((a, b) => a.cpd - b.cpd) : otherSorted;
            const otherPts = oCtrl.map(r => ({ x: toX(r.cpd), y: toY(r.sensitivity) }));
            const oA = otherResults.acuityAnchor, oF = otherResults.acuityFail;
            if (oA && oF) {
                const oCross = Math.pow(10, (Math.log10(600/oA) + Math.log10(600/oF)) / 2);
                const cx = toX(oCross);
                while (otherPts.length > 0 && otherPts[otherPts.length-1].x > cx+1) otherPts.pop();
                otherPts.push({ x: cx, y: toY(1.0) });
            }
            if (otherPts.length >= 2) {
                const oSpline = pchipSpline(otherPts, 24);
                if (oSpline.length >= 2 && oSpline[0].x > ml + 0.5) {
                    const a0 = otherPts[0], a1 = otherPts[1];
                    const sl = Math.min(0, (a1.y - a0.y) / ((a1.x - a0.x) || 1));
                    const eY = a0.y + (ml - a0.x) * sl;
                    oSpline.unshift({ x: ml, y: Math.max(mt, Math.min(mt + ph, eY)) });
                }
                ctx.strokeStyle = otherColor;
                ctx.lineWidth = 1.5;
                ctx.setLineDash([6, 4]);
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                ctx.beginPath();
                oSpline.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                ctx.stroke();
                ctx.setLineDash([]);
                const oLbl = oSpline[Math.round(oSpline.length * 0.15)];
                if (oLbl) {
                    ctx.fillStyle = otherColor;
                    ctx.font = `bold 8px ${font}`;
                    ctx.textAlign = 'left';
                    ctx.fillText(otherLabel, oLbl.x + 4, oLbl.y + 12);
                }
            }
        }
    }

    // --- History overlay curve (from dropdown) ---
    if (historyOverlayResults && historyOverlayResults.length > 0) {
        const ovrColor = '#f59e0b'; // amber
        const ovrSorted = [...historyOverlayResults].filter(r => r.threshold < 100).sort((a, b) => a.cpd - b.cpd);
        if (ovrSorted.length >= 2) {
            const hByPhase = {};
            for (const r of ovrSorted) { if (r.phase && !hByPhase[r.phase]) hByPhase[r.phase] = r; }
            const hAnchors = [hByPhase.peakAnchor, hByPhase.shoulderMid, hByPhase.descendingMid].filter(Boolean);
            const hCtrl = hAnchors.length >= 2 ? hAnchors.sort((a, b) => a.cpd - b.cpd) : ovrSorted;
            const ovrPts = hCtrl.map(r => ({ x: toX(r.cpd), y: toY(r.sensitivity) }));
            const oA = historyOverlayResults.acuityAnchor, oF = historyOverlayResults.acuityFail;
            let oCross = null;
            if (oA && oF) {
                oCross = Math.pow(10, (Math.log10(600/oA) + Math.log10(600/oF)) / 2);
            } else if (oA && !oF) {
                oCross = 600 / oA;
            } else if (ovrSorted.length >= 2) {
                // Legacy save without acuity data — extrapolate from last two points
                const last = ovrSorted[ovrSorted.length - 1];
                const prev = ovrSorted[ovrSorted.length - 2];
                if (last.sensitivity > 1.0) {
                    const lc1 = Math.log10(prev.cpd), lc2 = Math.log10(last.cpd);
                    const ls1 = Math.log10(prev.sensitivity), ls2 = Math.log10(last.sensitivity);
                    const slope = (ls2 - ls1) / (lc2 - lc1);
                    if (slope < 0) oCross = Math.pow(10, lc2 + (0 - ls2) / slope);
                }
            }
            if (oCross) {
                const cx = toX(oCross);
                while (ovrPts.length > 0 && ovrPts[ovrPts.length-1].x > cx+1) ovrPts.pop();
                ovrPts.push({ x: cx, y: toY(1.0) });
            }
            if (ovrPts.length >= 2) {
                const oSpline = pchipSpline(ovrPts, 24);
                if (oSpline.length >= 2 && oSpline[0].x > ml + 0.5) {
                    const a0 = ovrPts[0], a1 = ovrPts[1];
                    const sl = Math.min(0, (a1.y - a0.y) / ((a1.x - a0.x) || 1));
                    const eY = a0.y + (ml - a0.x) * sl;
                    oSpline.unshift({ x: ml, y: Math.max(mt, Math.min(mt + ph, eY)) });
                }
                ctx.strokeStyle = ovrColor;
                ctx.lineWidth = 2;
                ctx.setLineDash([8, 5]);
                ctx.lineJoin = 'round'; ctx.lineCap = 'round';
                ctx.beginPath();
                oSpline.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
                ctx.stroke();
                ctx.setLineDash([]);
                // Label from dropdown text
                const sel = document.getElementById('history-overlay');
                const selOpt = sel && sel.selectedOptions[0];
                const ovrLabel = selOpt && selOpt.value ? selOpt.textContent : 'Previous';
                const oLbl = oSpline[Math.round(oSpline.length * 0.2)];
                if (oLbl) {
                    ctx.fillStyle = ovrColor;
                    ctx.font = `bold 8px ${font}`;
                    ctx.textAlign = 'left';
                    ctx.fillText(ovrLabel, oLbl.x + 4, oLbl.y + 14);
                }
            }
        }
    }

    // X labels
    const snellenTicks = [
        {denom:100,cpd:6},{denom:50,cpd:12},{denom:40,cpd:15},{denom:30,cpd:20},
        {denom:25,cpd:24},{denom:20,cpd:30},{denom:15,cpd:40},{denom:10,cpd:60}
    ];
    ctx.textAlign='center';
    ctx.font=`bold 9px ${font}`;
    snellenTicks.forEach(t => {
        ctx.fillStyle='rgba(0,0,0,0.55)';
        ctx.fillText(`20/${t.denom}`, toX(t.cpd), mt+ph+15);
    });
    ctx.font=`8px ${font}`; ctx.fillStyle='rgba(0,0,0,0.3)';
    snellenTicks.forEach(t => ctx.fillText(`${t.cpd} cpd`, toX(t.cpd), mt+ph+26));

    // Crossover marker
    if (crossoverCpd) {
        const denomLabel = Math.round(600/crossoverCpd);
        const cx = toX(crossoverCpd), cy = toY(1.0);
        ctx.strokeStyle='rgba(37,99,235,0.35)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,mt+ph); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle='#2563eb'; ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2); ctx.fill();
        ctx.font=`bold 11px ${font}`; ctx.fillStyle='#2563eb'; ctx.textAlign='center';
        ctx.fillText(`20/${denomLabel}`, cx, mt+ph+40);
        ctx.font=`7px ${font}`; ctx.fillStyle='rgba(37,99,235,0.7)';
        ctx.fillText('acuity limit', cx, mt+ph+49);
    }

    ctx.fillStyle='rgba(0,0,0,0.35)'; ctx.font=`9px ${font}`; ctx.textAlign='center';
    ctx.fillText('Spatial Frequency (cpd)', ml+pw/2, mt+ph+60);

    // Y labels
    ctx.font=`10px ${font}`; ctx.textAlign='right';
    [1,2,5,10,20,50,100].forEach(cs => { const y=toY(cs); if(y<mt||y>mt+ph)return; ctx.fillStyle='rgba(0,0,0,0.5)'; ctx.fillText(cs, ml-6, y+4); });
    ctx.save(); ctx.translate(14, mt+ph/2); ctx.rotate(-Math.PI/2); ctx.textAlign='center';
    ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.font=`10px ${font}`; ctx.fillText('Contrast Sensitivity', 0, 0); ctx.restore();
    // Layman labels
    ctx.save(); ctx.translate(10, mt+ph-20); ctx.rotate(-Math.PI/2); ctx.textAlign='left';
    ctx.font=`bold 9px ${font}`; ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillText('\u2190 Needs bolder', 0, 0); ctx.restore();
    ctx.save(); ctx.translate(10, mt+20); ctx.rotate(-Math.PI/2); ctx.textAlign='right';
    ctx.font=`bold 9px ${font}`; ctx.fillStyle='rgba(0,0,0,0.3)'; ctx.fillText('Can see faint \u2192', 0, 0); ctx.restore();

    // --- Area Under the Curve (AUC) metric ---
    // Trapezoidal integration in log-cpd × log-CS space.
    // Normalized so average = 100. Patient score is relative to average.
    if (plotResults.length >= 2) {
        let auc = 0;
        for (let i = 0; i < plotResults.length - 1; i++) {
            const lc1 = Math.log10(plotResults[i].cpd);
            const lc2 = Math.log10(plotResults[i + 1].cpd);
            const ls1 = Math.log10(Math.max(1, plotResults[i].sensitivity));
            const ls2 = Math.log10(Math.max(1, plotResults[i + 1].sensitivity));
            auc += (ls1 + ls2) / 2 * (lc2 - lc1);
        }
        // Normative AUC over the same cpd range
        let normAuc = 0;
        const normSteps = 60;
        const lMin = Math.log10(plotResults[0].cpd);
        const lMax = Math.log10(plotResults[plotResults.length - 1].cpd);
        for (let i = 0; i < normSteps; i++) {
            const lc1 = lMin + (lMax - lMin) * i / normSteps;
            const lc2 = lMin + (lMax - lMin) * (i + 1) / normSteps;
            const ls1 = Math.log10(Math.max(1, csfNormative(Math.pow(10, lc1))));
            const ls2 = Math.log10(Math.max(1, csfNormative(Math.pow(10, lc2))));
            normAuc += (ls1 + ls2) / 2 * (lc2 - lc1);
        }
        // Normalize: average = 100, patient relative to that
        const score = normAuc > 0 ? Math.round(auc / normAuc * 100 / 5) * 5 : 0;

        ctx.font = `bold 13px ${font}`;
        ctx.textAlign = 'right';
        ctx.fillStyle = score >= 100 ? '#16a34a' : score >= 85 ? '#2563eb' : '#dc2626';
        ctx.fillText(`CSF Score: ${score}`, ml + pw, mt + 14);
        ctx.font = `10px ${font}`;
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        ctx.fillText('(avg = 100)', ml + pw, mt + 28);
    }
}

// ==========================================
// Patient Drawer & Database UI
// ==========================================

function showToast(msg) {
    const toast = $('#toast');
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2200);
}

function openDrawer() {
    const drawer = $('#patient-drawer');
    const backdrop = $('#patient-drawer-backdrop');
    drawer.classList.remove('hidden');
    backdrop.classList.remove('hidden');
    // Trigger transition
    requestAnimationFrame(() => drawer.classList.add('open'));
    refreshPatientList();
}

function closeDrawer() {
    const drawer = $('#patient-drawer');
    const backdrop = $('#patient-drawer-backdrop');
    drawer.classList.remove('open');
    setTimeout(() => {
        drawer.classList.add('hidden');
        backdrop.classList.add('hidden');
    }, 250);
}

async function refreshPatientList(filter) {
    const list = $('#patient-list');
    const patients = filter
        ? await PatientDB.getPatients().then(ps => {
            const q = filter.toLowerCase();
            return ps.filter(p => p.name.toLowerCase().includes(q) || (p.email || '').toLowerCase().includes(q));
        })
        : await PatientDB.getPatients();

    list.innerHTML = '';

    if ($('#patient-search').value.trim() && patients.length === 0) {
        // Show "create new" option
        $('#new-patient-form').classList.remove('hidden');
        $('#new-patient-name').value = $('#patient-search').value.trim();
        $('#new-patient-name').focus();
    } else {
        $('#new-patient-form').classList.add('hidden');
    }

    patients.forEach(p => {
        const item = document.createElement('div');
        item.className = 'patient-item';
        item.innerHTML = `
            <div>
                <div class="patient-item-name">${p.name}</div>
                <div class="patient-item-email">${p.email || ''}</div>
            </div>
        `;
        item.addEventListener('click', () => selectPatient(p));
        list.appendChild(item);
    });

    // Add "create new" button at bottom
    const addItem = document.createElement('div');
    addItem.className = 'patient-item';
    addItem.innerHTML = '<div class="patient-item-add">+ New Patient</div>';
    addItem.addEventListener('click', () => {
        $('#new-patient-form').classList.remove('hidden');
        $('#new-patient-name').value = '';
        $('#new-patient-email').value = '';
        $('#new-patient-name').focus();
    });
    list.appendChild(addItem);
}

function selectPatient(patient) {
    activePatientId = patient.id;
    activePatient = patient;

    const section = $('#active-patient-section');
    section.classList.remove('hidden');
    $('#active-patient-card').innerHTML = `
        <div class="ap-name">${patient.name}</div>
        <div class="ap-email">${patient.email || 'No email'}</div>
    `;

    refreshHistory();
    populateHistoryOverlay();
}

const CORRECTION_LABELS = {
    bcva: 'BCVA', habitual: 'Habitual', cl: 'CL', unaided: 'Unaided', pinhole: 'Pinhole'
};

async function refreshHistory() {
    const container = $('#patient-history');
    container.innerHTML = '';

    if (!activePatientId) return;

    let results;
    try {
        results = await PatientDB.getPatientResults(activePatientId);
    } catch (err) {
        console.error('Failed to load history:', err);
        container.innerHTML = `<div style="color:#f87171; font-size:0.8rem; padding:8px 0">Database error: ${err.message || err}</div>`;
        return;
    }

    if (results.length === 0) {
        container.innerHTML = '<div style="color:rgba(255,255,255,0.3); font-size:0.8rem; padding:8px 0">No test history</div>';
        return;
    }

    // Group by date (day)
    const grouped = {};
    results.forEach(r => {
        const d = new Date(r.date);
        const dayKey = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        if (!grouped[dayKey]) grouped[dayKey] = [];
        grouped[dayKey].push(r);
    });

    Object.entries(grouped).forEach(([dayKey, dayResults]) => {
        const dateHeader = document.createElement('div');
        dateHeader.style.cssText = 'font-size:0.72rem;font-weight:700;color:rgba(255,255,255,0.5);margin:8px 0 2px;padding:0 2px;';
        dateHeader.textContent = dayKey;
        container.appendChild(dateHeader);

        dayResults.forEach(r => {
            const date = new Date(r.date);
            const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
            const corrLabel = CORRECTION_LABELS[r.correctionType] || r.correctionType || 'BCVA';
            const modeLabel = r.lightingMode === 'mesopic' ? 'Meso' : 'Photo';
            const levels = r.results ? r.results.length : 0;

            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div style="flex:1">
                    <div class="history-date">${timeStr} — <strong>${corrLabel}</strong> <span style="color:${r.lightingMode === 'mesopic' ? '#818cf8' : '#60a5fa'}">${modeLabel}</span></div>
                    <div class="history-summary">${levels} levels</div>
                </div>
                <div class="history-actions">
                    <button class="history-btn" data-action="view">View</button>
                    <button class="history-btn" data-action="copy">Copy</button>
                    <button class="history-btn history-btn-del" data-action="delete">Del</button>
                </div>
            `;

            item.querySelector('[data-action="view"]').addEventListener('click', (e) => {
                e.stopPropagation();
                if (r.results) showResults(r.results);
            });

            item.querySelector('[data-action="copy"]').addEventListener('click', (e) => {
                e.stopPropagation();
                copyResultsToClipboard(r.results, activePatient, new Date(r.date));
            });

            item.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
                e.stopPropagation();
                await PatientDB.deleteResult(r.id);
                refreshHistory();
                populateHistoryOverlay();
                showToast('Result deleted');
            });

            container.appendChild(item);
        });
    });
}

// Track overlay curve from history
let historyOverlayResults = null;

async function populateHistoryOverlay() {
    const sel = $('#history-overlay');
    if (!sel) return;
    sel.innerHTML = '<option value="">Overlay previous test...</option>';
    historyOverlayResults = null;

    if (!activePatientId) return;
    let results;
    try { results = await PatientDB.getPatientResults(activePatientId); } catch (e) { return; }

    results.forEach(r => {
        const d = new Date(r.date);
        const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const corrLabel = CORRECTION_LABELS[r.correctionType] || 'BCVA';
        const modeLabel = r.lightingMode === 'mesopic' ? 'Meso' : 'Photo';
        const opt = document.createElement('option');
        opt.value = r.id;
        opt.textContent = `${dateStr} ${timeStr} — ${corrLabel} ${modeLabel}`;
        opt.dataset.json = JSON.stringify(r.results);
        // Preserve acuity data
        if (r.results && r.results.acuityAnchor != null) opt.dataset.acuityAnchor = r.results.acuityAnchor;
        if (r.results && r.results.acuityFail != null) opt.dataset.acuityFail = r.results.acuityFail;
        sel.appendChild(opt);
    });
}

// Wire up overlay dropdown
$('#history-overlay').addEventListener('change', function() {
    const opt = this.selectedOptions[0];
    if (!opt || !opt.value) {
        historyOverlayResults = null;
    } else {
        try {
            historyOverlayResults = JSON.parse(opt.dataset.json);
            if (opt.dataset.acuityAnchor) historyOverlayResults.acuityAnchor = Number(opt.dataset.acuityAnchor);
            if (opt.dataset.acuityFail) historyOverlayResults.acuityFail = Number(opt.dataset.acuityFail);
        } catch (e) { historyOverlayResults = null; }
    }
    // Re-render graph with overlay
    if (lastCompletedResults) {
        const canvas = $('#csf-graph');
        if (canvas) renderCSFGraph(canvas, lastCompletedResults);
    }
});

async function saveCurrentResults() {
    if (!lastCompletedResults) {
        showToast('No results to save');
        return;
    }

    if (!activePatientId) {
        openDrawer();
        showToast('Select or create a patient first');
        return;
    }

    // Get graph as data URL
    const canvas = $('#csf-graph');
    let graphDataURL = '';
    try { graphDataURL = canvas.toDataURL('image/png'); } catch (e) { /* ok */ }

    const correctionType = ($('#correction-type') || {}).value || 'bcva';
    const lightingMode = lastCompletedResults.lightingMode || 'photopic';

    try {
        await PatientDB.saveCSFResult(activePatientId, lastCompletedResults, graphDataURL, correctionType, lightingMode);
        showToast(`Saved to ${activePatient.name}`);
        $('#btn-save-results').disabled = true;
        refreshHistory();
        populateHistoryOverlay();
    } catch (err) {
        console.error('Save failed:', err);
        showToast(`Save failed: ${err.message || err}`);
    }
}

function copyResultsToClipboard(results, patient, date) {
    if (!results) { showToast('No results to copy'); return; }

    const patientName = patient ? patient.name : 'Patient';
    const patientEmail = patient ? (patient.email || '') : '';
    const dateStr = (date || new Date()).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

    // Find acuity limit (where contrast sensitivity crosses 1.0)
    const sorted = [...results].sort((a, b) => a.cpd - b.cpd);
    let acuityLimit = null;
    for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].sensitivity >= 1.0 && sorted[i + 1].sensitivity < 1.0) {
            const lc1 = Math.log10(sorted[i].cpd), lc2 = Math.log10(sorted[i + 1].cpd);
            const ls1 = Math.log10(sorted[i].sensitivity), ls2 = Math.log10(sorted[i + 1].sensitivity);
            const t = (0 - ls1) / (ls2 - ls1);
            acuityLimit = `20/${Math.round(600 / Math.pow(10, lc1 + t * (lc2 - lc1)))}`;
            break;
        }
    }
    if (!acuityLimit && sorted.length > 0) {
        const last = sorted[sorted.length - 1];
        const prev = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
        if (last.sensitivity >= 1.0 && prev) {
            const logCpd1 = Math.log10(prev.cpd), logCpd2 = Math.log10(last.cpd);
            const logCs1 = Math.log10(prev.sensitivity), logCs2 = Math.log10(last.sensitivity);
            const slope = (logCs2 - logCs1) / (logCpd2 - logCpd1);
            if (slope < 0) {
                const cpdAt1 = Math.pow(10, logCpd2 + (0 - logCs2) / slope);
                acuityLimit = `20/${Math.round(600 / cpdAt1)}`;
            } else {
                acuityLimit = `better than 20/${Math.round(last.denom)}`;
            }
        }
    }

    // Layman comparison label from dB
    function vsAvgLabel(dB) {
        if (dB >= 5) return 'Well above average';
        if (dB >= 2) return 'Above average';
        if (dB >= -2) return 'Average';
        if (dB >= -5) return 'Below average';
        return 'Well below average';
    }
    function vsAvgEmoji(dB) {
        if (dB >= 2) return '\u2705'; // ✅
        if (dB >= -2) return '\u2796'; // ➖
        return '\u26A0\uFE0F'; // ⚠️
    }

    // Build plain-text version
    let text = `Your Contrast Sensitivity Results\n`;
    text += `${patientName} \u2014 ${dateStr}\n`;
    if (acuityLimit) text += `\nSmallest readable letter size: ${acuityLimit}\n`;
    text += `\nLetter Size | Contrast Needed | vs. Average\n`;
    text += `------------|-----------------|--------------------\n`;
    results.forEach(r => {
        const denomLabel = Number.isInteger(r.denom) ? r.denom : Math.round(r.denom);
        const norm = csfNormative(r.cpd);
        const dB = 10 * Math.log10(Math.max(0.01, r.sensitivity) / norm);
        const threshStr = r.threshold >= 100 ? "Can't see"
                        : r.threshold < 10 ? r.threshold.toFixed(1) + '%'
                        : Math.round(r.threshold) + '%';
        const avgStr = r.threshold >= 100 ? '\u2014' : vsAvgLabel(dB);
        text += `20/${String(denomLabel).padEnd(7)} | ${threshStr.padEnd(15)} | ${avgStr}\n`;
    });
    text += `\nContrast Needed = the minimum boldness your eyes need to see letters at that size. Lower is better.\n`;

    // Build HTML version — graph first, then table
    const canvas = $('#csf-graph');
    let imgBlock = '';
    try {
        const dataURL = canvas.toDataURL('image/png');
        imgBlock = `<img src="${dataURL}" alt="Contrast Sensitivity Graph" style="max-width:600px;border-radius:8px;display:block;margin:12px 0">
<p style="font-size:11px;color:#888;margin:2px 0 16px;font-style:italic">Your results (solid blue line) vs. population average (dashed line). Left side = big letters, right side = small letters. Higher on the graph = better contrast vision.</p>`;
    } catch (e) { /* canvas capture failed, skip image */ }

    const acuitySummary = acuityLimit
        ? `<p style="font-size:15px;font-family:sans-serif;margin:8px 0 4px"><strong>Smallest readable letter size: ${acuityLimit}</strong></p>`
        : '';

    const tdStyle = 'padding:6px 14px;border:1px solid #ddd';
    const htmlRows = results.map(r => {
        const denomLabel = Number.isInteger(r.denom) ? r.denom : Math.round(r.denom);
        const norm = csfNormative(r.cpd);
        const dB = 10 * Math.log10(Math.max(0.01, r.sensitivity) / norm);
        const threshStr = r.threshold >= 100 ? "Can\u2019t see"
                        : r.threshold < 10 ? r.threshold.toFixed(1) + '%'
                        : Math.round(r.threshold) + '%';
        const avgStr = r.threshold >= 100 ? '\u2014' : vsAvgLabel(dB);
        const avgColor = dB >= 2 ? '#16a34a' : dB >= -2 ? '#555' : '#dc2626';
        return `<tr>
<td style="${tdStyle}">20/${denomLabel}</td>
<td style="${tdStyle}">${threshStr}</td>
<td style="${tdStyle};color:${avgColor}">${r.threshold >= 100 ? '\u2014' : vsAvgEmoji(dB)} ${avgStr}</td>
</tr>`;
    }).join('');

    const html = `<h3 style="font-family:sans-serif;margin-bottom:4px">Your Contrast Sensitivity \u2014 ${patientName}</h3>
<p style="font-family:sans-serif;color:#666;margin:2px 0 8px">${dateStr}${patientEmail ? ' &middot; ' + patientEmail : ''}</p>
${acuitySummary}
${imgBlock}
<table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;border:1px solid #ddd;margin:8px 0">
<tr style="background:#f5f5f5">
<th style="${tdStyle};text-align:left">Letter Size</th>
<th style="${tdStyle};text-align:left">Contrast Needed</th>
<th style="${tdStyle};text-align:left">vs. Average</th>
</tr>
${htmlRows}
</table>
<p style="font-size:11px;color:#999;margin-top:4px;font-style:italic">Contrast Needed = the minimum boldness your eyes need to read letters at that size. Lower % = better.</p>`;

    // Write both text and HTML to clipboard
    try {
        const blob = new Blob([html], { type: 'text/html' });
        const textBlob = new Blob([text], { type: 'text/plain' });
        navigator.clipboard.write([
            new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })
        ]).then(() => showToast('Copied to clipboard'));
    } catch (e) {
        navigator.clipboard.writeText(text).then(() => showToast('Copied (text only)'));
    }
}

// --- Event listeners ---
$('#btn-db').addEventListener('click', openDrawer);
$('#drawer-close').addEventListener('click', closeDrawer);
$('#patient-drawer-backdrop').addEventListener('click', closeDrawer);

$('#patient-search').addEventListener('input', () => {
    const q = $('#patient-search').value.trim();
    refreshPatientList(q || undefined);
});

$('#btn-create-patient').addEventListener('click', async () => {
    const name = $('#new-patient-name').value.trim();
    const email = $('#new-patient-email').value.trim();
    if (!name) return;
    const id = await PatientDB.addPatient(name, email);
    const patient = await PatientDB.getPatient(id);
    selectPatient(patient);
    $('#new-patient-form').classList.add('hidden');
    $('#patient-search').value = '';
    refreshPatientList();
    showToast(`Created ${name}`);
});

$('#btn-save-results').addEventListener('click', saveCurrentResults);

$('#btn-copy-results').addEventListener('click', () => {
    copyResultsToClipboard(lastCompletedResults, activePatient, new Date());
});

// --- Line controls (remote control for patient display) ---
$('#btn-line-up').addEventListener('click', () => {
    channel.postMessage({ type: 'line-up' });
});

$('#btn-line-down').addEventListener('click', () => {
    channel.postMessage({ type: 'line-down' });
});

$('#btn-line-refresh').addEventListener('click', () => {
    channel.postMessage({ type: 'line-refresh' });
});

$('#btn-csf-remote').addEventListener('click', () => {
    // CSF always starts photopic
    channel.postMessage({ type: 'csf-start-remote', lightingMode: 'photopic' });
});

// --- Save prompt system ---
// Pending action to execute after save/discard decision
let pendingSaveAction = null;

function showSavePrompt(title, onComplete) {
    // If results are already saved (button disabled), skip the prompt
    if ($('#btn-save-results').disabled || !lastCompletedResults) {
        onComplete();
        return;
    }
    pendingSaveAction = onComplete;
    $('#save-prompt-title').textContent = title || 'Save results before continuing?';
    $('#save-prompt').classList.remove('hidden');
    $('#save-prompt-backdrop').classList.remove('hidden');
}

function hideSavePrompt() {
    $('#save-prompt').classList.add('hidden');
    $('#save-prompt-backdrop').classList.add('hidden');
    pendingSaveAction = null;
}

$('#save-prompt-save').addEventListener('click', async () => {
    await saveCurrentResults();
    const action = pendingSaveAction;
    hideSavePrompt();
    if (action) action();
});

$('#save-prompt-discard').addEventListener('click', () => {
    const action = pendingSaveAction;
    hideSavePrompt();
    if (action) action();
});

$('#save-prompt-cancel').addEventListener('click', () => {
    hideSavePrompt();
});

$('#save-prompt-backdrop').addEventListener('click', () => {
    hideSavePrompt();
});

// --- Post-test action buttons ---

// Run Mesopic — prompt to save photopic first, then start mesopic test
$('#btn-run-mesopic').addEventListener('click', () => {
    showSavePrompt('Save photopic results before running mesopic test?', () => {
        channel.postMessage({ type: 'csf-start-remote', lightingMode: 'mesopic' });
        $('#btn-run-mesopic').style.display = 'none';
        resultsPanel.classList.add('hidden');
        testPanel.classList.remove('hidden');
    });
});

// Toggle display between photopic (white bg) and mesopic (black bg) on patient screen
$('#btn-toggle-display').addEventListener('click', () => {
    const btn = $('#btn-toggle-display');
    const showingMesopic = btn.dataset.mode === 'mesopic';
    const newMode = showingMesopic ? 'photopic' : 'mesopic';
    btn.dataset.mode = newMode;
    btn.textContent = newMode === 'mesopic' ? 'Switch to Photopic View' : 'Switch to Mesopic View';

    // Update clinician graph
    const primary = csfCompletedResults[newMode] || lastCompletedResults;
    if (primary) {
        primary.lightingMode = newMode;
        lastCompletedResults = primary;
        const canvas = $('#csf-graph');
        if (canvas) renderCSFGraph(canvas, primary);
    }

    // Tell patient display to switch
    csfLightingMode = newMode;
    broadcastRefUpdate();
});

// Retest Patient — prompt to save, then clear patient display and return to targets
$('#btn-retest-patient').addEventListener('click', () => {
    showSavePrompt('Save results before retesting?', () => {
        channel.postMessage({ type: 'csf-retest' });
        lastCompletedResults = null;
        csfCompletedResults.photopic = null;
        csfCompletedResults.mesopic = null;
        returnToLineControls();
    });
});

// Test New Patient — prompt to save, then clear everything on patient display
$('#btn-new-patient').addEventListener('click', () => {
    showSavePrompt('Save results before switching to a new patient?', () => {
        channel.postMessage({ type: 'csf-new-patient' });
        lastCompletedResults = null;
        csfCompletedResults.photopic = null;
        csfCompletedResults.mesopic = null;
        returnToLineControls();
    });
});
