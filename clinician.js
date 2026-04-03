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
    waitingPanel.classList.remove('hidden');
    waitingPanel.querySelector('h2').textContent = 'Test cancelled';
    waitingPanel.querySelector('p').textContent = 'The CSF test was stopped.';
    statusBadge.textContent = 'Cancelled';
    statusBadge.className = 'status-badge';
}

// ==========================================
// CSF Graph Rendering (Normalized + Smoothed)
// ==========================================

function csfNormative(cpd) {
    const a = 75, b = 0.82, c = 0.2;
    return a * Math.pow(cpd, b) * Math.exp(-c * cpd);
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
