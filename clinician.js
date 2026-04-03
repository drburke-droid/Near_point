// ==========================================
// CSF Test — Clinician View
// ==========================================

const channel = new BroadcastChannel('nearpoint-csf');

let currentLine = null;   // { snellenDenom, letters, contrasts, pass, levelIndex, totalLevels }
let errors = [];          // [0,0,1,0,...] per letter
let testComplete = false;
let markMode = 'wrong';   // 'wrong' = mark incorrect (default), 'correct' = mark correct

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

// --- Notify patient display that clinician is ready ---
channel.postMessage({ type: 'clinician-ready' });

// --- Message handler ---
channel.onmessage = (e) => {
    const data = e.data;
    switch (data.type) {
        case 'csf-line':
            showLine(data);
            break;
        case 'csf-complete':
            showResults(data.results);
            break;
        case 'csf-cancel':
            showCancelled();
            break;
    }
};

// --- Show a new line of letters ---
function showLine(data) {
    currentLine = data;
    errors = new Array(data.letters.length).fill(0);
    testComplete = false;

    // Reset mark mode to 'wrong' for each new line
    markMode = 'wrong';
    const modeBtn = $('#btn-mark-mode');
    const hint = $('#mark-hint');
    if (modeBtn) { modeBtn.textContent = 'Mode: Mark Wrong'; modeBtn.classList.remove('mode-correct'); }
    if (hint) hint.textContent = 'Tap wrong letters';

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
        const gray = Math.round(255 * (1 - contrast / 100));
        const contrastLabel = contrast < 10 ? contrast.toFixed(1) + '%' : Math.round(contrast) + '%';

        const cell = document.createElement('div');
        cell.className = 'letter-cell';

        const display = document.createElement('div');
        display.className = 'letter-display';
        display.style.color = `rgb(${gray}, ${gray}, ${gray})`;
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

// --- Show results ---
function showResults(results) {
    testComplete = true;
    testPanel.classList.add('hidden');
    waitingPanel.classList.add('hidden');
    resultsPanel.classList.remove('hidden');

    statusBadge.textContent = 'Complete';
    statusBadge.className = 'status-badge complete';

    progressFill.style.width = '100%';

    // Populate table
    const tbody = $('#results-tbody');
    tbody.innerHTML = '';
    results.forEach(r => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>20/${r.denom}</td>
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
    waitingPanel.classList.remove('hidden');
    waitingPanel.querySelector('h2').textContent = 'Test cancelled';
    waitingPanel.querySelector('p').textContent = 'The CSF test was stopped.';
    statusBadge.textContent = 'Cancelled';
    statusBadge.className = 'status-badge';
}

// ==========================================
// CSF Graph Rendering (Normalized)
// ==========================================

// Normative CSF model: CS(f) = a * f^b * exp(-c * f)
// Parametric fit to published letter-optotype norms (peak ~3-4 cpd)
function csfNormative(cpd) {
    const a = 75, b = 0.82, c = 0.2;
    return a * Math.pow(cpd, b) * Math.exp(-c * cpd);
}

function renderCSFGraph(canvas, results) {
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, w, h);

    // Margins
    const ml = 60, mr = 25, mt = 25, mb = 55;
    const pw = w - ml - mr;
    const ph = h - mt - mb;

    // Compute normalized deviations: dB = 10 * log10(patient_CS / norm_CS)
    const normData = results.map(r => {
        const norm = csfNormative(r.cpd);
        const dB = 10 * Math.log10(Math.max(0.01, r.sensitivity) / norm);
        return { ...r, norm, dB };
    });

    // X-axis: log spatial frequency
    const cpdValues = results.map(r => r.cpd);
    const logCpdMin = Math.floor(Math.log10(Math.min(...cpdValues)) * 2) / 2;
    const logCpdMax = Math.ceil(Math.log10(Math.max(...cpdValues)) * 2) / 2;

    // Y-axis: dB deviation, symmetric around 0
    const maxAbsDB = Math.max(10, Math.ceil(Math.max(...normData.map(d => Math.abs(d.dB))) / 5) * 5);
    const yMin = -maxAbsDB;
    const yMax = maxAbsDB;

    function toX(cpd) {
        return ml + pw * (Math.log10(cpd) - logCpdMin) / (logCpdMax - logCpdMin);
    }
    function toY(dB) {
        return mt + ph * (1 - (dB - yMin) / (yMax - yMin));
    }

    // --- Background shading ---
    const zeroY = toY(0);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.06)';
    ctx.fillRect(ml, mt, pw, zeroY - mt);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
    ctx.fillRect(ml, zeroY, pw, mt + ph - zeroY);

    // Grid
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 0.5;
    for (let lv = logCpdMin; lv <= logCpdMax; lv += 0.5) {
        const x = toX(Math.pow(10, lv));
        ctx.beginPath(); ctx.moveTo(x, mt); ctx.lineTo(x, mt + ph); ctx.stroke();
    }
    for (let dB = yMin; dB <= yMax; dB += 5) {
        if (dB === 0) continue;
        const y = toY(dB);
        ctx.beginPath(); ctx.moveTo(ml, y); ctx.lineTo(ml + pw, y); ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(ml, mt); ctx.lineTo(ml, mt + ph); ctx.lineTo(ml + pw, mt + ph);
    ctx.stroke();

    // --- Average line (0 dB) ---
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(ml, zeroY); ctx.lineTo(ml + pw, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '10px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Average', ml + pw + 4, zeroY + 3);

    // X-axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '11px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    for (let lv = logCpdMin; lv <= logCpdMax; lv += 0.5) {
        const val = Math.pow(10, lv);
        const x = toX(val);
        ctx.fillText(val < 1 ? val.toFixed(2) : val.toFixed(1), x, mt + ph + 18);
    }
    ctx.fillText('Spatial Frequency (cpd)', ml + pw / 2, mt + ph + 42);

    // Y-axis labels (dB)
    ctx.textAlign = 'right';
    for (let dB = yMin; dB <= yMax; dB += 5) {
        const y = toY(dB);
        const label = (dB > 0 ? '+' : '') + dB;
        ctx.fillStyle = dB > 0 ? 'rgba(16, 185, 129, 0.7)'
                      : dB < 0 ? 'rgba(239, 68, 68, 0.7)'
                      : 'rgba(255,255,255,0.6)';
        ctx.fillText(label, ml - 8, y + 4);
    }
    ctx.save();
    ctx.translate(13, mt + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillText('Deviation from Average (dB)', 0, 0);
    ctx.restore();

    // "Better" / "Worse" labels
    ctx.font = '9px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(16, 185, 129, 0.5)';
    ctx.fillText('BETTER', ml + 6, mt + 14);
    ctx.fillStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.fillText('WORSE', ml + 6, mt + ph - 6);

    // --- Fill area between patient line and zero line ---
    ctx.save();
    ctx.beginPath();
    ctx.rect(ml, mt, pw, zeroY - mt);
    ctx.clip();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.beginPath();
    ctx.moveTo(toX(normData[0].cpd), zeroY);
    normData.forEach(d => ctx.lineTo(toX(d.cpd), toY(d.dB)));
    ctx.lineTo(toX(normData[normData.length - 1].cpd), zeroY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.beginPath();
    ctx.rect(ml, zeroY, pw, mt + ph - zeroY);
    ctx.clip();
    ctx.fillStyle = 'rgba(239, 68, 68, 0.15)';
    ctx.beginPath();
    ctx.moveTo(toX(normData[0].cpd), zeroY);
    normData.forEach(d => ctx.lineTo(toX(d.cpd), toY(d.dB)));
    ctx.lineTo(toX(normData[normData.length - 1].cpd), zeroY);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Patient data line
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    normData.forEach((d, i) => {
        const x = toX(d.cpd);
        const y = toY(d.dB);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Data points
    normData.forEach(d => {
        const x = toX(d.cpd);
        const y = toY(d.dB);
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fillStyle = d.dB >= 0 ? '#10b981' : '#ef4444';
        ctx.fill();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    });

    // Snellen labels
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = '9px Inter, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    normData.forEach(d => {
        ctx.fillText(`20/${d.denom}`, toX(d.cpd), mt + ph + 30);
    });
}
