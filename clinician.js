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
    open() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('nearpoint-db', 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('patients')) {
                    const ps = db.createObjectStore('patients', { keyPath: 'id', autoIncrement: true });
                    ps.createIndex('name', 'name', { unique: false });
                }
                if (!db.objectStoreNames.contains('csfResults')) {
                    const rs = db.createObjectStore('csfResults', { keyPath: 'id', autoIncrement: true });
                    rs.createIndex('patientId', 'patientId', { unique: false });
                    rs.createIndex('date', 'date', { unique: false });
                }
            };
            req.onsuccess = (e) => { this.db = e.target.result; resolve(); };
            req.onerror = (e) => reject(e.target.error);
        });
    },
    _store(name, mode) { return this.db.transaction(name, mode).objectStore(name); },
    addPatient(name, email) {
        return new Promise((resolve, reject) => {
            const req = this._store('patients', 'readwrite').add({ name, email, createdAt: Date.now() });
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },
    getPatients() {
        return new Promise((resolve, reject) => {
            const req = this._store('patients', 'readonly').getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },
    getPatient(id) {
        return new Promise((resolve, reject) => {
            const req = this._store('patients', 'readonly').get(id);
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },
    saveCSFResult(patientId, results, graphDataURL) {
        return new Promise((resolve, reject) => {
            const req = this._store('csfResults', 'readwrite').add({
                patientId, date: Date.now(), results, graphDataURL
            });
            req.onsuccess = () => resolve(req.result);
            req.onerror = (e) => reject(e.target.error);
        });
    },
    getPatientResults(patientId) {
        return new Promise((resolve, reject) => {
            const idx = this._store('csfResults', 'readonly').index('patientId');
            const req = idx.getAll(patientId);
            req.onsuccess = () => resolve(req.result.sort((a, b) => b.date - a.date));
            req.onerror = (e) => reject(e.target.error);
        });
    },
    deleteResult(resultId) {
        return new Promise((resolve, reject) => {
            const req = this._store('csfResults', 'readwrite').delete(resultId);
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
        tr.innerHTML = `
            <td>20/${denomLabel}</td>
            <td>${r.cpd.toFixed(2)}</td>
            <td>${r.threshold < 10 ? r.threshold.toFixed(1) : Math.round(r.threshold)}%</td>
            <td>${r.sensitivity.toFixed(1)}</td>
        `;
        tbody.appendChild(tr);
    });

    // Render CSF graph
    const canvas = $('#csf-graph');
    renderCSFGraph(canvas, results);
}

function showCancelled() {
    testPanel.classList.add('hidden');
    resultsPanel.classList.add('hidden');
    pass3Panel.classList.add('hidden');
    waitingPanel.classList.remove('hidden');
    waitingPanel.querySelector('h2').textContent = 'Test cancelled';
    waitingPanel.querySelector('p').textContent = 'The CSF test was stopped.';
    statusBadge.textContent = 'Cancelled';
    statusBadge.className = 'status-badge';
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

// Normative letter-optotype CSF: log-Gaussian in log-frequency space
// Beyond 20/20 (1.5 cpd): average patient can't read, so norm = 1.0
function csfNormative(cpd) {
    const peak = 50;
    const fp = 0.6;
    const sigma = 0.3;
    if (cpd > 1.5) return 1.0;
    const logRatio = Math.log10(cpd / fp);
    return peak * Math.exp(-(logRatio * logRatio) / (2 * sigma * sigma));
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

    const ml = 58, mr = 50, mt = 25, mb = 55;
    const pw = w - ml - mr;
    const ph = h - mt - mb;

    const normData = results.map(r => {
        const norm = csfNormative(r.cpd);
        const dB = 10 * Math.log10(Math.max(0.01, r.sensitivity) / norm);
        return { ...r, norm, dB };
    });

    const cpdValues = results.map(r => r.cpd);
    const logCpdMin = Math.floor(Math.log10(Math.min(...cpdValues)) * 4) / 4 - 0.05;
    const logCpdMax = Math.ceil(Math.log10(Math.max(...cpdValues)) * 4) / 4 + 0.05;
    const maxAbsDB = Math.max(10, Math.ceil(Math.max(...normData.map(d => Math.abs(d.dB))) / 5) * 5);
    const yMin = -maxAbsDB, yMax = maxAbsDB;

    function toX(cpd) { return ml + pw * (Math.log10(cpd) - logCpdMin) / (logCpdMax - logCpdMin); }
    function toY(dB) { return mt + ph * (1 - (dB - yMin) / (yMax - yMin)); }
    const zeroY = toY(0);

    // Background gradients
    const greenGrad = ctx.createLinearGradient(0, mt, 0, zeroY);
    greenGrad.addColorStop(0, 'rgba(16, 185, 129, 0.12)');
    greenGrad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
    ctx.fillStyle = greenGrad;
    ctx.fillRect(ml, mt, pw, zeroY - mt);
    const redGrad = ctx.createLinearGradient(0, zeroY, 0, mt + ph);
    redGrad.addColorStop(0, 'rgba(239, 68, 68, 0.02)');
    redGrad.addColorStop(1, 'rgba(239, 68, 68, 0.12)');
    ctx.fillStyle = redGrad;
    ctx.fillRect(ml, zeroY, pw, mt + ph - zeroY);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let lv = Math.floor(logCpdMin * 2) / 2; lv <= logCpdMax; lv += 0.25) {
        const x = toX(Math.pow(10, lv));
        if (x < ml || x > ml + pw) continue;
        ctx.beginPath(); ctx.moveTo(x, mt); ctx.lineTo(x, mt + ph); ctx.stroke();
    }
    for (let dB = yMin; dB <= yMax; dB += 5) {
        if (dB === 0) continue;
        const y = toY(dB);
        ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml + pw, y); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ml, mt); ctx.lineTo(ml, mt + ph); ctx.lineTo(ml + pw, mt + ph);
    ctx.stroke();

    // Average line
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 5]);
    ctx.beginPath();
    ctx.moveTo(ml, zeroY); ctx.lineTo(ml + pw, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `10px ${font}`;
    ctx.textAlign = 'left';
    ctx.fillText('AVERAGE', ml + pw + 5, zeroY + 4);

    // Spline
    const dataPoints = normData.map(d => ({ x: toX(d.cpd), y: toY(d.dB) }));
    const spline = catmullRomSpline(dataPoints, 20);

    // Gradient fills
    ctx.save();
    ctx.beginPath(); ctx.rect(ml, mt, pw, zeroY - mt); ctx.clip();
    const gf = ctx.createLinearGradient(0, mt, 0, zeroY);
    gf.addColorStop(0, 'rgba(52, 211, 153, 0.35)');
    gf.addColorStop(1, 'rgba(52, 211, 153, 0.05)');
    ctx.fillStyle = gf;
    ctx.beginPath();
    ctx.moveTo(spline[0].x, zeroY);
    spline.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(spline[spline.length - 1].x, zeroY);
    ctx.closePath(); ctx.fill(); ctx.restore();

    ctx.save();
    ctx.beginPath(); ctx.rect(ml, zeroY, pw, mt + ph - zeroY); ctx.clip();
    const rf = ctx.createLinearGradient(0, zeroY, 0, mt + ph);
    rf.addColorStop(0, 'rgba(248, 113, 113, 0.05)');
    rf.addColorStop(1, 'rgba(248, 113, 113, 0.35)');
    ctx.fillStyle = rf;
    ctx.beginPath();
    ctx.moveTo(spline[0].x, zeroY);
    spline.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(spline[spline.length - 1].x, zeroY);
    ctx.closePath(); ctx.fill(); ctx.restore();

    // Glow
    ctx.save();
    ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
    ctx.shadowBlur = 12;
    ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    spline.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();
    ctx.restore();

    // Main curve
    const lineGrad = ctx.createLinearGradient(spline[0].x, 0, spline[spline.length - 1].x, 0);
    lineGrad.addColorStop(0, '#60a5fa');
    lineGrad.addColorStop(0.5, '#a78bfa');
    lineGrad.addColorStop(1, '#818cf8');
    ctx.strokeStyle = lineGrad;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    spline.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
    ctx.stroke();

    // Data points
    normData.forEach(d => {
        const x = toX(d.cpd), y = toY(d.dB);
        const color = d.dB >= 0 ? '#34d399' : '#f87171';
        ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = d.dB >= 0 ? 'rgba(52,211,153,0.4)' : 'rgba(248,113,113,0.4)';
        ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    });

    // X-axis labels at data points
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = `10px ${font}`;
    ctx.textAlign = 'center';
    normData.forEach(d => {
        ctx.fillText(d.cpd < 1 ? d.cpd.toFixed(2) : d.cpd.toFixed(1), toX(d.cpd), mt + ph + 16);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `9px ${font}`;
    ctx.fillText('Spatial Frequency (cpd)', ml + pw / 2, mt + ph + 42);

    // Snellen labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = `8px ${font}`;
    normData.forEach(d => {
        const denomLabel = Number.isInteger(d.denom) ? d.denom : Math.round(d.denom);
        ctx.fillText(`20/${denomLabel}`, toX(d.cpd), mt + ph + 27);
    });

    // Y-axis
    ctx.font = `10px ${font}`;
    ctx.textAlign = 'right';
    for (let dB = yMin; dB <= yMax; dB += 5) {
        const y = toY(dB);
        ctx.fillStyle = dB > 0 ? 'rgba(52,211,153,0.6)' : dB < 0 ? 'rgba(248,113,113,0.6)' : 'rgba(255,255,255,0.5)';
        ctx.fillText((dB > 0 ? '+' : '') + dB + ' dB', ml - 6, y + 3);
    }
    ctx.save();
    ctx.translate(11, mt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `9px ${font}`;
    ctx.fillText('vs. Average', 0, 0);
    ctx.restore();

    // Better / Worse
    ctx.font = `bold 9px ${font}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(52,211,153,0.35)';
    ctx.fillText('BETTER \u25B2', ml + pw - 4, mt + 14);
    ctx.fillStyle = 'rgba(248,113,113,0.35)';
    ctx.fillText('WORSE \u25BC', ml + pw - 4, mt + ph - 6);
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
    const results = await PatientDB.getPatientResults(activePatientId);

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

    await PatientDB.saveCSFResult(activePatientId, lastCompletedResults, graphDataURL);
    showToast(`Saved to ${activePatient.name}`);
    $('#btn-save-results').disabled = true;
    refreshHistory();
}

function copyResultsToClipboard(results, patient, date) {
    if (!results) { showToast('No results to copy'); return; }

    const patientName = patient ? patient.name : 'Unknown';
    const patientEmail = patient ? (patient.email || '') : '';
    const dateStr = (date || new Date()).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });

    // Build text version
    let text = `CSF Test Results \u2014 ${patientName}\n`;
    text += `Date: ${dateStr}\n`;
    if (patientEmail) text += `Email: ${patientEmail}\n`;
    text += `\nSnellen  | cpd   | Threshold | Sensitivity | vs. Avg\n`;
    text += `---------|-------|-----------|-------------|--------\n`;

    results.forEach(r => {
        const denomLabel = Number.isInteger(r.denom) ? r.denom : Math.round(r.denom);
        const norm = csfNormative(r.cpd);
        const dB = 10 * Math.log10(Math.max(0.01, r.sensitivity) / norm);
        const dBStr = (dB >= 0 ? '+' : '') + dB.toFixed(1) + ' dB';
        const threshStr = r.threshold < 10 ? r.threshold.toFixed(1) + '%' : Math.round(r.threshold) + '%';
        text += `20/${String(denomLabel).padEnd(5)} | ${r.cpd.toFixed(2).padEnd(5)} | ${threshStr.padEnd(9)} | ${r.sensitivity.toFixed(1).padEnd(11)} | ${dBStr}\n`;
    });

    // Build HTML version with embedded graph
    const canvas = $('#csf-graph');
    let imgTag = '';
    try {
        const dataURL = canvas.toDataURL('image/png');
        imgTag = `<br><img src="${dataURL}" alt="CSF Graph" style="max-width:600px;border-radius:8px;">`;
    } catch (e) { /* ok */ }

    const htmlRows = results.map(r => {
        const denomLabel = Number.isInteger(r.denom) ? r.denom : Math.round(r.denom);
        const norm = csfNormative(r.cpd);
        const dB = 10 * Math.log10(Math.max(0.01, r.sensitivity) / norm);
        const dBStr = (dB >= 0 ? '+' : '') + dB.toFixed(1) + ' dB';
        const threshStr = r.threshold < 10 ? r.threshold.toFixed(1) + '%' : Math.round(r.threshold) + '%';
        return `<tr><td>20/${denomLabel}</td><td>${r.cpd.toFixed(2)}</td><td>${threshStr}</td><td>${r.sensitivity.toFixed(1)}</td><td>${dBStr}</td></tr>`;
    }).join('');

    const html = `<h3>CSF Test Results \u2014 ${patientName}</h3>
<p>Date: ${dateStr}${patientEmail ? '<br>Email: ' + patientEmail : ''}</p>
<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;font-family:sans-serif;font-size:13px">
<tr style="background:#f0f0f0"><th>Snellen</th><th>cpd</th><th>Threshold</th><th>Sensitivity</th><th>vs. Avg</th></tr>
${htmlRows}
</table>
${imgTag}`;

    // Write both text and HTML to clipboard
    try {
        const blob = new Blob([html], { type: 'text/html' });
        const textBlob = new Blob([text], { type: 'text/plain' });
        navigator.clipboard.write([
            new ClipboardItem({ 'text/html': blob, 'text/plain': textBlob })
        ]).then(() => showToast('Copied to clipboard'));
    } catch (e) {
        // Fallback: text only
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
