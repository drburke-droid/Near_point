// ==========================================
// CSF Test — Clinician View
// ==========================================

const channel = new BroadcastChannel('nearpoint-csf');

let currentLine = null;   // { snellenDenom, letters, contrasts, pass, levelIndex, totalLevels }
let errors = [];          // [0,0,1,0,...] per letter
let testComplete = false;
let markMode = 'wrong';   // 'wrong' = mark incorrect (default), 'correct' = mark correct
let lastCompletedResults = null; // stashed after test completes
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

    async saveCSFResult(patientId, results, graphDataURL) {
        const store = await this._store('csfResults', 'readwrite');
        return new Promise((resolve, reject) => {
            const req = store.add({
                patientId, date: Date.now(), results, graphDataURL
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
    // In "mark correct" mode, default all to wrong so clinician taps the correct ones
    errors = new Array(data.letters.length).fill(markMode === 'correct' ? 1 : 0);
    testComplete = false;

    waitingPanel.classList.add('hidden');
    resultsPanel.classList.add('hidden');
    testPanel.classList.remove('hidden');

    statusBadge.textContent = `Pass ${data.pass} — 20/${data.snellenDenom}`;
    statusBadge.className = 'status-badge waiting';

    levelInfo.innerHTML = `<strong>20/${data.snellenDenom}</strong> — Pass ${data.pass}, Level ${data.levelIndex + 1} of ${data.totalLevels}`;

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

// --- Send response to patient display ---
btnNext.addEventListener('click', () => {
    if (!currentLine) return;
    btnNext.disabled = true;
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

function catmullRomSpline(points, segments) {
    if (points.length < 2) return points;
    const result = [];
    const pts = [
        { x: 2 * points[0].x - points[1].x, y: 2 * points[0].y - points[1].y },
        ...points,
        { x: 2 * points[points.length - 1].x - points[points.length - 2].x,
          y: 2 * points[points.length - 1].y - points[points.length - 2].y }
    ];
    for (let i = 1; i < pts.length - 2; i++) {
        const p0 = pts[i - 1], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2];
        for (let s = 0; s < segments; s++) {
            const t = s / segments;
            const t2 = t * t, t3 = t2 * t;
            const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t +
                (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
                (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
            const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t +
                (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
                (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
            result.push({ x, y });
        }
    }
    result.push(points[points.length - 1]);
    return result;
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
    ctx.clearRect(0, 0, w, h);
    // Solid background so clipboard capture is self-contained (not transparent)
    ctx.fillStyle = '#1a1a2e';
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

    // Grid
    ctx.lineWidth = 0.5;
    [6,8,10,12,15,20,30,40,60].forEach(cpd => {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        const x = toX(cpd);
        ctx.beginPath(); ctx.moveTo(x, mt); ctx.lineTo(x, mt+ph); ctx.stroke();
    });
    [1,2,5,10,20,50,100].forEach(cs => {
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        const y = toY(cs);
        ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml+pw, y); ctx.stroke();
    });

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(ml, mt); ctx.lineTo(ml, mt+ph); ctx.lineTo(ml+pw, mt+ph); ctx.stroke();

    // Average curve
    const normPts = sampleCurve(csfNormative, 80);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4,3]);
    ctx.beginPath();
    normPts.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
    ctx.stroke();
    ctx.setLineDash([]);
    const nl = normPts[Math.round(normPts.length*0.15)];
    if (nl) { ctx.fillStyle='rgba(255,255,255,0.25)'; ctx.font=`8px ${font}`; ctx.textAlign='left'; ctx.fillText('Average', nl.x+4, nl.y-6); }

    // Patient spline — extrapolate to CS=1 (acuity limit)
    const sortedResults = [...results].sort((a, b) => a.cpd - b.cpd);
    const patientPts = sortedResults.map(r => ({ x: toX(r.cpd), y: toY(r.sensitivity) }));
    // Find crossover (CS = 1)
    let crossoverCpd = null;
    for (let i = 0; i < sortedResults.length - 1; i++) {
        const r1 = sortedResults[i], r2 = sortedResults[i + 1];
        if (r1.sensitivity >= 1.0 && r2.sensitivity < 1.0) {
            const lc1 = Math.log10(r1.cpd), lc2 = Math.log10(r2.cpd);
            const ls1 = Math.log10(r1.sensitivity), ls2 = Math.log10(r2.sensitivity);
            const t = (0 - ls1) / (ls2 - ls1);
            crossoverCpd = Math.pow(10, lc1 + t * (lc2 - lc1));
            break;
        }
    }
    // Extrapolate right: extend to CS=1
    if (sortedResults.length >= 2) {
        const last = sortedResults[sortedResults.length - 1];
        const prev = sortedResults[sortedResults.length - 2];
        if (last.sensitivity > 1.0) {
            const logCpd1 = Math.log10(prev.cpd), logCpd2 = Math.log10(last.cpd);
            const logCs1 = Math.log10(prev.sensitivity), logCs2 = Math.log10(last.sensitivity);
            const slope = (logCs2 - logCs1) / (logCpd2 - logCpd1);
            if (slope < 0) {
                const cpdAtCs1 = Math.pow(10, logCpd2 + (0 - logCs2) / slope);
                patientPts.push({ x: toX(cpdAtCs1), y: toY(1.0) });
                if (!crossoverCpd) crossoverCpd = cpdAtCs1;
            }
        }
    }
    // Extrapolate left: extend to y-axis
    if (patientPts.length >= 2) {
        const dx = patientPts[1].x - patientPts[0].x;
        const dy = patientPts[1].y - patientPts[0].y;
        const extY = patientPts[0].y - dy * ((patientPts[0].x - ml) / (dx||1));
        patientPts.unshift({ x: ml, y: Math.max(mt, Math.min(mt+ph, extY)) });
    }
    const spline = catmullRomSpline(patientPts, 24);

    // Green/red fill between patient and norm
    for (let fp = 0; fp < 2; fp++) {
        ctx.save(); ctx.beginPath(); ctx.rect(ml,mt,pw,ph); ctx.clip();
        ctx.fillStyle = fp===0 ? 'rgba(52,211,153,0.18)' : 'rgba(248,113,113,0.18)';
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
        ctx.restore();
    }

    // Glow + curve
    ctx.save(); ctx.shadowColor='rgba(96,165,250,0.3)'; ctx.shadowBlur=10;
    ctx.strokeStyle='rgba(96,165,250,0.12)'; ctx.lineWidth=5; ctx.lineJoin='round';
    ctx.beginPath(); spline.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke(); ctx.restore();
    ctx.strokeStyle='#60a5fa'; ctx.lineWidth=2.5; ctx.lineJoin='round'; ctx.lineCap='round';
    ctx.beginPath(); spline.forEach((p,i)=>i===0?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y)); ctx.stroke();

    // "You" label
    const peak = patientPts.reduce((b,p)=>p.y<b.y?p:b, patientPts[0]);
    ctx.fillStyle='#60a5fa'; ctx.font=`bold 9px ${font}`; ctx.textAlign='center';
    ctx.fillText('You', peak.x, peak.y-10);

    // X labels — standard Snellen at fixed positions
    const snellenTicks = [
        {denom:100,cpd:6},{denom:50,cpd:12},{denom:40,cpd:15},{denom:30,cpd:20},
        {denom:25,cpd:24},{denom:20,cpd:30},{denom:15,cpd:40},{denom:10,cpd:60}
    ];
    ctx.textAlign='center';
    ctx.font=`bold 9px ${font}`;
    snellenTicks.forEach(t => {
        ctx.fillStyle='rgba(255,255,255,0.5)';
        ctx.fillText(`20/${t.denom}`, toX(t.cpd), mt+ph+15);
    });
    ctx.font=`8px ${font}`; ctx.fillStyle='rgba(255,255,255,0.25)';
    snellenTicks.forEach(t => ctx.fillText(`${t.cpd} cpd`, toX(t.cpd), mt+ph+26));

    // Crossover marker
    if (crossoverCpd) {
        const denomLabel = Math.round(600/crossoverCpd);
        const cx = toX(crossoverCpd), cy = toY(1.0);
        ctx.strokeStyle='rgba(96,165,250,0.35)'; ctx.lineWidth=1; ctx.setLineDash([3,3]);
        ctx.beginPath(); ctx.moveTo(cx,cy); ctx.lineTo(cx,mt+ph); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle='#60a5fa'; ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2); ctx.fill();
        ctx.font=`bold 11px ${font}`; ctx.fillStyle='#60a5fa'; ctx.textAlign='center';
        ctx.fillText(`20/${denomLabel}`, cx, mt+ph+40);
        ctx.font=`7px ${font}`; ctx.fillStyle='rgba(96,165,250,0.7)';
        ctx.fillText('acuity limit', cx, mt+ph+49);
    }

    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font=`9px ${font}`; ctx.textAlign='center';
    ctx.fillText('Spatial Frequency (cpd)', ml+pw/2, mt+ph+60);

    // Y labels
    ctx.font=`10px ${font}`; ctx.textAlign='right';
    [1,2,5,10,20,50,100].forEach(cs => { const y=toY(cs); if(y<mt||y>mt+ph)return; ctx.fillStyle='rgba(255,255,255,0.45)'; ctx.fillText(cs, ml-6, y+4); });
    ctx.save(); ctx.translate(14, mt+ph/2); ctx.rotate(-Math.PI/2); ctx.textAlign='center';
    ctx.fillStyle='rgba(255,255,255,0.3)'; ctx.font=`10px ${font}`; ctx.fillText('Contrast Sensitivity', 0, 0); ctx.restore();
    // Layman labels — separated at top and bottom
    ctx.save(); ctx.translate(10, mt+ph-20); ctx.rotate(-Math.PI/2); ctx.textAlign='left';
    ctx.font=`bold 9px ${font}`; ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillText('\u2190 Needs bolder', 0, 0); ctx.restore();
    ctx.save(); ctx.translate(10, mt+20); ctx.rotate(-Math.PI/2); ctx.textAlign='right';
    ctx.font=`bold 9px ${font}`; ctx.fillStyle='rgba(255,255,255,0.35)'; ctx.fillText('Can see faint \u2192', 0, 0); ctx.restore();
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
}

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

    results.forEach(r => {
        const date = new Date(r.date);
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
        const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const levels = r.results ? r.results.length : 0;

        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <div>
                <div class="history-date">${dateStr} ${timeStr}</div>
                <div class="history-summary">${levels} levels tested</div>
            </div>
            <div class="history-actions">
                <button class="history-btn" data-action="view" data-id="${r.id}">View</button>
                <button class="history-btn" data-action="copy" data-id="${r.id}">Copy</button>
                <button class="history-btn history-btn-del" data-action="delete" data-id="${r.id}">Del</button>
            </div>
        `;

        // View: render saved graph
        item.querySelector('[data-action="view"]').addEventListener('click', (e) => {
            e.stopPropagation();
            if (r.results) {
                showResults(r.results);
            } else if (r.graphDataURL) {
                showToast('Graph-only record (legacy)');
            }
        });

        // Copy
        item.querySelector('[data-action="copy"]').addEventListener('click', (e) => {
            e.stopPropagation();
            copyResultsToClipboard(r.results, activePatient, new Date(r.date));
        });

        // Delete
        item.querySelector('[data-action="delete"]').addEventListener('click', async (e) => {
            e.stopPropagation();
            await PatientDB.deleteResult(r.id);
            refreshHistory();
            showToast('Result deleted');
        });

        container.appendChild(item);
    });
}

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

    try {
        await PatientDB.saveCSFResult(activePatientId, lastCompletedResults, graphDataURL);
        showToast(`Saved to ${activePatient.name}`);
        $('#btn-save-results').disabled = true;
        refreshHistory();
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
    channel.postMessage({ type: 'csf-start-remote' });
});

$('#btn-back-acuity').addEventListener('click', () => {
    channel.postMessage({ type: 'csf-abort' });
    returnToLineControls();
});
