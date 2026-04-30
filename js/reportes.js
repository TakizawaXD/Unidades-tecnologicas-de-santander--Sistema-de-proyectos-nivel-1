/* ===================== REPORTES.JS — UTS Enterprise ===================== */
const API = 'http://localhost:3000/api';

function authHeaders() {
    const token = localStorage.getItem('uts_token');
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}
async function apiFetch(method, path, body) {
    const r = await fetch(API + path, { method, headers: authHeaders(), body: body ? JSON.stringify(body) : undefined });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error');
    return d;
}

const TOTAL_REQUIRED = 52;
let userData = {}, projects = [], enrollments = [];

document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('uts_user'));
    if (!user || !localStorage.getItem('uts_token')) return window.location.href = 'login.html';
    userData = user;

    // UI user info
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('userName', user.name); set('userCareer', user.career || '');
    set('userInitial', (user.name || 'U')[0]);

    const savedTheme = localStorage.getItem('uts_theme');
    if (savedTheme === 'dark') document.body.classList.add('dark-theme');

    document.getElementById('logoutBtn')?.addEventListener('click', e => { e.preventDefault(); localStorage.clear(); window.location.href = 'login.html'; });

    await loadAllData();
    renderSummaryCards();
    renderProjectsTable();
    renderCoursesTable();
    renderCharts();
    const pc = document.getElementById('projCount'); if(pc) pc.textContent = projects.length + ' proyectos';
    const cc = document.getElementById('courseCount'); if(cc) cc.textContent = enrollments.length + ' cursos';
    setupPDFButtons();
});

async function loadAllData() {
    try {
        [projects, enrollments] = await Promise.all([
            apiFetch('GET', '/projects'),
            apiFetch('GET', '/enrollments')
        ]);
        userData = await apiFetch('GET', '/users/me');
        localStorage.setItem('uts_user', JSON.stringify(userData));
    } catch (e) { showToast('Error cargando datos', 'error'); }
}

// ── SUMMARY CARDS ──
function renderSummaryCards() {
    const done      = projects.filter(p => p.status === 'done').length;
    const pending   = TOTAL_REQUIRED - done;
    const pct       = Math.min(Math.round((done / TOTAL_REQUIRED) * 100), 100);
    const courseDone = enrollments.filter(e => e.status === 'completed').length;
    const hoursTotal = enrollments.reduce((s, e) => s + (e.hours * e.progress / 100), 0);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('rStatTotal',   projects.length);
    set('rStatDone',    done);
    set('rStatPending', pending > 0 ? pending : 0);
    set('rStatPct',     pct + '%');
    set('rStatCourses', courseDone);
    set('rStatHours',   Math.round(hoursTotal) + 'h');

    // Progress bar graduation
    const bar = document.getElementById('gradProgressFill');
    if (bar) setTimeout(() => bar.style.width = pct + '%', 100);
    const pctLabel = document.getElementById('gradPct');
    if (pctLabel) pctLabel.textContent = pct + '%';

    // Graduation status badge
    const badge = document.getElementById('gradStatus');
    if (badge) {
        if (pct >= 100) { badge.textContent = '✅ Listo para graduación'; badge.className = 'grad-badge grad-ready'; }
        else if (pct >= 50) { badge.textContent = '🔄 En progreso'; badge.className = 'grad-badge grad-progress'; }
        else { badge.textContent = '⏳ Inicio de carrera'; badge.className = 'grad-badge grad-early'; }
    }
}

// ── PROJECTS TABLE ──
function renderProjectsTable() {
    const tbody = document.getElementById('rProjectsBody');
    if (!tbody) return;
    if (!projects.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:30px;color:var(--uts-text-muted)">Sin proyectos registrados</td></tr>';
        return;
    }
    tbody.innerHTML = projects.map((p, i) => `
        <tr>
            <td style="font-weight:700;color:var(--uts-text-muted)">${i + 1}</td>
            <td><strong>${p.name}</strong></td>
            <td><span class="category-pill">${p.category || '—'}</span></td>
            <td>${p.tutor || '—'}</td>
            <td><span class="status-badge status-${p.status || 'pending'}">${statusLabel(p.status)}</span></td>
            <td>${p.date || '—'}</td>
        </tr>`).join('');
}

// ── COURSES TABLE ──
function renderCoursesTable() {
    const tbody = document.getElementById('rCoursesBody');
    if (!tbody) return;
    if (!enrollments.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:30px;color:var(--uts-text-muted)">Sin cursos inscritos</td></tr>';
        return;
    }
    tbody.innerHTML = enrollments.map(e => `
        <tr>
            <td><strong>${e.title}</strong></td>
            <td>${e.category}</td>
            <td>
                <div style="display:flex;align-items:center;gap:8px">
                    <div style="flex:1;height:6px;background:var(--uts-gray-light);border-radius:3px;overflow:hidden">
                        <div style="width:${e.progress}%;height:100%;background:${e.progress>=100?'var(--uts-green)':'var(--uts-accent)'};border-radius:3px"></div>
                    </div>
                    <span style="font-size:12px;font-weight:700;color:var(--uts-text-muted);width:34px">${e.progress}%</span>
                </div>
            </td>
            <td><span class="status-badge ${e.status==='completed'?'status-done':'status-in-progress'}">${e.status==='completed'?'Completado':'En progreso'}</span></td>
        </tr>`).join('');
}

// ── CHARTS ──
function renderCharts() {
    renderStatusChart();
    renderCategoryChart();
    renderMonthlyChart();
}

function renderStatusChart() {
    const ctx = document.getElementById('statusChart');
    if (!ctx || !window.Chart) return;
    const done = projects.filter(p => p.status === 'done').length;
    const inprog = projects.filter(p => p.status === 'in-progress').length;
    const review = projects.filter(p => p.status === 'review').length;
    const pending = projects.filter(p => p.status === 'pending' || !p.status).length;
    if (window._statusChart) window._statusChart.destroy();
    window._statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completado', 'En Progreso', 'Revisión', 'Pendiente'],
            datasets: [{ data: [done, inprog, review, pending], backgroundColor: ['#10b981','#3b82f6','#f59e0b','#e2e8f0'], borderWidth: 0, hoverOffset: 8 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 12, weight: '600' }, padding: 16 } } } }
    });
}

function renderCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    if (!ctx || !window.Chart) return;
    const cats = {};
    projects.forEach(p => { const c = p.category || 'Sin categoría'; cats[c] = (cats[c] || 0) + 1; });
    const colors = ['#004A87','#008D3E','#8b5cf6','#f59e0b','#ec4899','#10b981','#ef4444'];
    if (window._catChart) window._catChart.destroy();
    window._catChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(cats),
            datasets: [{ label: 'Proyectos', data: Object.values(cats), backgroundColor: colors, borderRadius: 8, borderWidth: 0 }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } }
    });
}

function renderMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    if (!ctx || !window.Chart) return;
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const data = new Array(12).fill(0);
    projects.forEach(p => { if (p.createdAt) data[new Date(p.createdAt).getMonth()]++; });
    if (window._monthChart) window._monthChart.destroy();
    window._monthChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{
                label: 'Proyectos registrados', data,
                borderColor: '#008D3E', backgroundColor: 'rgba(0,141,62,0.08)',
                borderWidth: 3, tension: 0.4, fill: true, pointBackgroundColor: '#008D3E', pointRadius: 4
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } }, x: { grid: { display: false } } } }
    });
}

// ── PDF GENERATION ──
function setupPDFButtons() {
    document.getElementById('btnPDFProyectos')?.addEventListener('click', () => generatePDF('proyectos'));
    document.getElementById('btnPDFCursos')?.addEventListener('click', () => generatePDF('cursos'));
    document.getElementById('btnPDFCompleto')?.addEventListener('click', () => generatePDF('completo'));
    document.getElementById('btnPDFGrado')?.addEventListener('click', () => generatePDF('grado'));
}

function generatePDF(type) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const now = new Date();
    const dateStr = now.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' });
    const user = userData;

    // ── Header común ──
    doc.setFillColor(0, 74, 135);
    doc.rect(0, 0, 210, 38, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('UNIDADES TECNOLÓGICAS DE SANTANDER', 14, 14);
    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text('Sistema Académico de Gestión de Proyectos — UTS Enterprise', 14, 22);
    doc.setFontSize(9);
    doc.text(`Generado: ${dateStr}  |  Usuario: ${user.name || ''}  |  Código: ${user.code || '—'}`, 14, 31);

    // ── Línea verde ──
    doc.setFillColor(0, 141, 62);
    doc.rect(0, 38, 210, 3, 'F');

    doc.setTextColor(0, 0, 0);
    let startY = 50;

    if (type === 'proyectos' || type === 'completo' || type === 'grado') {
        doc.setFontSize(14); doc.setFont('helvetica', 'bold');
        doc.setTextColor(0, 74, 135);
        doc.text('REPORTE DE PROYECTOS ACADÉMICOS', 14, startY);
        startY += 8;

        // Stats box
        doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
        const done = projects.filter(p => p.status === 'done').length;
        const pct = Math.round((done / TOTAL_REQUIRED) * 100);
        doc.text(`Total registrados: ${projects.length}   |   Completados: ${done}   |   Avance: ${pct}% de ${TOTAL_REQUIRED} requisitos`, 14, startY);
        startY += 8;

        doc.autoTable({
            startY,
            head: [['#', 'Nombre del Proyecto', 'Categoría', 'Tutor', 'Estado', 'Fecha']],
            body: projects.map((p, i) => [i + 1, p.name, p.category || '—', p.tutor || '—', statusLabel(p.status), p.date || '—']),
            styles: { fontSize: 9, cellPadding: 4 },
            headStyles: { fillColor: [0, 74, 135], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 60 } }
        });
        startY = doc.lastAutoTable.finalY + 12;
    }

    if (type === 'cursos' || type === 'completo') {
        if (startY > 220) { doc.addPage(); startY = 20; }
        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 74, 135);
        doc.text('REPORTE DE FORMACIÓN COMPLEMENTARIA', 14, startY);
        startY += 8;

        doc.autoTable({
            startY,
            head: [['Curso', 'Categoría', 'Nivel', 'Horas', 'Progreso', 'Estado']],
            body: enrollments.map(e => [e.title, e.category, e.level, e.hours + 'h', e.progress + '%', e.status === 'completed' ? 'Completado' : 'En progreso']),
            styles: { fontSize: 9, cellPadding: 4 },
            headStyles: { fillColor: [0, 141, 62], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 252] }
        });
        startY = doc.lastAutoTable.finalY + 12;
    }

    if (type === 'grado') {
        if (startY > 180) { doc.addPage(); startY = 20; }
        const done = projects.filter(p => p.status === 'done').length;
        const pct = Math.round((done / TOTAL_REQUIRED) * 100);

        doc.setFontSize(14); doc.setFont('helvetica', 'bold'); doc.setTextColor(0, 74, 135);
        doc.text('CERTIFICACIÓN DE AVANCE ACADÉMICO', 14, startY); startY += 10;

        doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);
        doc.text(`Estudiante: ${user.name || ''}`, 14, startY); startY += 7;
        doc.text(`Programa: ${user.career || ''}`, 14, startY); startY += 7;
        doc.text(`Código Estudiantil: ${user.code || '—'}`, 14, startY); startY += 7;
        doc.text(`Semestre: ${user.semester || '—'}   Jornada: ${user.journey || '—'}`, 14, startY); startY += 12;

        // Progress bar in PDF
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(14, startY, 182, 10, 3, 3, 'F');
        doc.setFillColor(0, 141, 62);
        doc.roundedRect(14, startY, Math.max(182 * pct / 100, 2), 10, 3, 3, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        if (pct > 10) doc.text(pct + '%', 14 + 182 * pct / 100 - 14, startY + 6.5);
        startY += 18;

        doc.setFontSize(10); doc.setFont('helvetica', 'normal'); doc.setTextColor(100, 116, 139);
        doc.text(`Proyectos completados: ${done} de ${TOTAL_REQUIRED} requeridos`, 14, startY); startY += 7;
        doc.text(`Cursos completados: ${enrollments.filter(e => e.status === 'completed').length}`, 14, startY); startY += 7;
        doc.text(`Horas de formación complementaria: ${Math.round(enrollments.reduce((s, e) => s + (e.hours * e.progress / 100), 0))}h`, 14, startY); startY += 14;

        // Firma
        doc.setDrawColor(200, 200, 200);
        doc.line(14, startY, 90, startY);
        doc.line(120, startY, 196, startY);
        startY += 5;
        doc.setFontSize(9); doc.setTextColor(100, 116, 139);
        doc.text('Firma del Estudiante', 14, startY);
        doc.text('Coordinador Académico UTS', 120, startY);
        startY += 12;

        doc.setFontSize(8); doc.setTextColor(148, 163, 184);
        doc.text(`Documento generado electrónicamente el ${dateStr}. ID: UTS-${Date.now()}`, 14, startY);
    }

    // Footer en cada página
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFillColor(248, 250, 252);
        doc.rect(0, 285, 210, 12, 'F');
        doc.setFontSize(8); doc.setTextColor(148, 163, 184);
        doc.text('UTS Enterprise — Documento confidencial. Solo para uso académico interno.', 14, 292);
        doc.text(`Pág. ${i} / ${pageCount}`, 196, 292, { align: 'right' });
    }

    const filename = { proyectos: 'Reporte_Proyectos', cursos: 'Reporte_Cursos', completo: 'Reporte_Completo', grado: 'Certificado_Avance' };
    doc.save(`${filename[type]}_${(user.name||'UTS').replace(/ /g,'_')}_${now.getFullYear()}.pdf`);
    showToast('PDF generado exitosamente', 'success');
}

// ── UTILS ──
function statusLabel(s) {
    return { 'done': 'Completado', 'in-progress': 'En Progreso', 'review': 'Revisión', 'pending': 'Pendiente' }[s] || 'Pendiente';
}

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle'}"></i> ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('reveal'), 10);
    setTimeout(() => { t.classList.remove('reveal'); setTimeout(() => t.remove(), 500); }, 3000);
}
