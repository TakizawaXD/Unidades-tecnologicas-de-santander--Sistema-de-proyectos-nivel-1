/* ===================== DASHBOARD.JS — UTS Enterprise ===================== */
const API = 'http://localhost:3000/api';
const TOTAL_REQUIRED = 52;

function authHeaders() {
    const token = localStorage.getItem('uts_token');
    return { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
}
async function apiFetch(method, path) {
    const r = await fetch(API + path, { method, headers: authHeaders() });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error');
    return d;
}

let projects = [], enrollments = [];

document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('uts_user'));
    if (!user || !localStorage.getItem('uts_token')) return window.location.href = 'login.html';

    const savedTheme = localStorage.getItem('uts_theme');
    if (savedTheme === 'dark') document.body.classList.add('dark-theme');
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) { themeToggle.checked = savedTheme === 'dark'; themeToggle.addEventListener('change', e => { document.body.classList.toggle('dark-theme', e.target.checked); localStorage.setItem('uts_theme', e.target.checked ? 'dark' : 'light'); }); }

    document.getElementById('logoutBtn')?.addEventListener('click', e => { e.preventDefault(); localStorage.clear(); window.location.href = 'login.html'; });

    // Render instantly from cache
    renderUserInfo(user);
    const cached = localStorage.getItem(`uts_projects_cache_${user.id}`);
    if (cached) { projects = JSON.parse(cached); renderAll(user); }

    // Fetch fresh data
    try {
        [projects, enrollments] = await Promise.all([apiFetch('GET', '/projects'), apiFetch('GET', '/enrollments')]);
        const freshUser = await apiFetch('GET', '/users/me');
        Object.assign(user, freshUser);
        localStorage.setItem('uts_user', JSON.stringify(user));
        localStorage.setItem(`uts_projects_cache_${user.id}`, JSON.stringify(projects));
        renderUserInfo(user);
        renderAll(user);
    } catch (e) { showToast('Error cargando datos', 'error'); }
});

function renderUserInfo(user) {
    const s = (id, val) => { const el = document.getElementById(id); if (el) { if (el.tagName === 'INPUT') el.value = val||''; else el.textContent = val||''; } };
    s('userName', user.name); s('welcomeName', (user.name||'').split(' ')[0]);
    s('userCareer', user.career); s('userInitial', (user.name||'U')[0]);
    s('infoName', user.name); s('infoCareer', user.career);
    s('infoCode', user.code || '—'); s('infoSemester', user.semester ? `${user.semester}° Semestre` : '—');
    s('infoJourney', user.journey || '—'); s('infoEmail', user.email);
}

function renderAll(user) {
    renderKPIs();
    renderGradProgress();
    renderChart();
    renderRecentProjects();
    renderEnrollmentList();
    renderBadges();
    renderActivityFeed();
}

// ── KPI CARDS ──
function renderKPIs() {
    const done     = projects.filter(p => p.status === 'done').length;
    const inprog   = projects.filter(p => p.status === 'in-progress').length;
    const review   = projects.filter(p => p.status === 'review').length;
    const pending  = projects.filter(p => !p.status || p.status === 'pending').length;
    const pct      = Math.min(Math.round((done / TOTAL_REQUIRED) * 100), 100);
    const coursesDone = enrollments.filter(e => e.status === 'completed').length;

    const s = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    s('kpiTotal',    projects.length);
    s('kpiDone',     done);
    s('kpiInProg',   inprog);
    s('kpiReview',   review);
    s('kpiPending',  pending);
    s('kpiPct',      pct + '%');
    s('kpiCourses',  coursesDone);
    s('statCompleted', done);
    s('statPending',   Math.max(TOTAL_REQUIRED - done, 0));
    s('welcomePendingCount', Math.max(TOTAL_REQUIRED - done, 0));
}

// ── GRADUATION PROGRESS ──
function renderGradProgress() {
    const done = projects.filter(p => p.status === 'done').length;
    const pct  = Math.min(Math.round((done / TOTAL_REQUIRED) * 100), 100);
    const bar  = document.getElementById('dashGradFill');
    const lbl  = document.getElementById('dashGradPct');
    const sub  = document.getElementById('dashGradSub');
    if (bar) setTimeout(() => bar.style.width = pct + '%', 200);
    if (lbl) lbl.textContent = pct + '%';
    if (sub) sub.textContent = `${done} de ${TOTAL_REQUIRED} proyectos completados`;
}

// ── PRODUCTIVITY CHART ──
function renderChart() {
    const ctx = document.getElementById('productivityChart');
    if (!ctx || !window.Chart) return;
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const done_m = new Array(12).fill(0);
    const total_m = new Array(12).fill(0);
    projects.forEach(p => {
        if (p.createdAt) {
            const m = new Date(p.createdAt).getMonth();
            total_m[m]++;
            if (p.status === 'done') done_m[m]++;
        }
    });
    if (window._dashChart) window._dashChart.destroy();
    window._dashChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [
                { label: 'Registrados', data: total_m, backgroundColor: 'rgba(0,74,135,0.15)', borderColor: '#004A87', borderWidth: 2, borderRadius: 6, order: 2 },
                { label: 'Completados', data: done_m,  backgroundColor: '#008D3E',              borderColor: '#008D3E', borderWidth: 0, borderRadius: 6, order: 1 }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'bottom', labels: { font: { size: 12, weight: '600' }, padding: 16 } } },
            scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,.04)' } } }
        }
    });
}

// ── RECENT PROJECTS ──
function renderRecentProjects() {
    const list = document.getElementById('recentProjectsList');
    if (!list) return;
    const recent = [...projects].slice(0, 5);
    if (!recent.length) { list.innerHTML = '<p style="color:var(--uts-text-muted);font-size:13px">Sin proyectos aún. <a href="proyectos.html">Agregar →</a></p>'; return; }
    const statusColors = { done: '#10b981', 'in-progress': '#3b82f6', review: '#f59e0b', pending: '#94a3b8' };
    list.innerHTML = recent.map(p => `
        <div class="bento-list-item">
            <div class="status-dot" style="background:${statusColors[p.status]||'#94a3b8'}"></div>
            <div class="bento-list-content">
                <h4>${p.name}</h4>
                <p>${p.category || 'Sin categoría'} · ${p.tutor || '—'}</p>
            </div>
            <span class="bento-list-date">${p.date || '—'}</span>
        </div>`).join('');
}

// ── COURSE ENROLLMENT LIST ──
function renderEnrollmentList() {
    const list = document.getElementById('enrollmentList');
    if (!list) return;
    if (!enrollments.length) { list.innerHTML = '<p style="color:var(--uts-text-muted);font-size:13px">Sin cursos inscritos. <a href="cursos.html">Ver catálogo →</a></p>'; return; }
    list.innerHTML = enrollments.slice(0, 4).map(e => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--uts-gray-light)">
            <div style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:${e.color}22;font-size:16px;flex-shrink:0">
                <i class="fas ${e.icon}" style="color:${e.color}"></i>
            </div>
            <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.title}</div>
                <div style="height:4px;background:var(--uts-gray-light);border-radius:2px;margin-top:5px;overflow:hidden">
                    <div style="width:${e.progress}%;height:100%;background:${e.color};border-radius:2px"></div>
                </div>
            </div>
            <span style="font-size:12px;font-weight:700;color:var(--uts-text-muted)">${e.progress}%</span>
        </div>`).join('');
}

// ── BADGES ──
function renderBadges() {
    const container = document.getElementById('badgesContainer');
    if (!container) return;
    const done = projects.filter(p => p.status === 'done').length;
    const badges = [];
    if (projects.length >= 1)  badges.push({ icon: 'fa-seedling',    color: '#10b981', title: 'Iniciador: primer proyecto registrado' });
    if (done >= 1)             badges.push({ icon: 'fa-check-circle', color: '#3b82f6', title: 'Primer logro: proyecto completado' });
    if (done >= 5)             badges.push({ icon: 'fa-star',         color: '#f59e0b', title: 'Experto: 5 proyectos completados' });
    if (done >= 10)            badges.push({ icon: 'fa-trophy',       color: '#8b5cf6', title: 'Campeón: 10 proyectos completados' });
    if (enrollments.length >= 1) badges.push({ icon: 'fa-graduation-cap', color: '#ec4899', title: 'Estudiante activo: inscrito en cursos' });
    if (enrollments.filter(e => e.status === 'completed').length >= 1) badges.push({ icon: 'fa-medal', color: '#f59e0b', title: 'Certificado: curso completado' });
    if (done >= TOTAL_REQUIRED) badges.push({ icon: 'fa-crown',       color: '#ef4444', title: '¡Graduado! Todos los requisitos completados' });

    container.innerHTML = badges.length
        ? badges.map(b => `<div class="badge-icon" title="${b.title}" style="background:${b.color}22;color:${b.color}"><i class="fas ${b.icon}"></i></div>`).join('')
        : '<span style="font-size:12px;color:rgba(255,255,255,0.6)">Completa proyectos para obtener insignias</span>';
}

// ── ACTIVITY FEED ──
function renderActivityFeed() {
    const feed = document.getElementById('activityFeed');
    if (!feed) return;
    const items = [];
    [...projects].slice(0, 3).forEach(p => {
        items.push({ icon: 'fa-layer-group', color: '#3b82f6', text: `Proyecto <strong>${p.name}</strong> — ${statusLabel(p.status)}`, date: p.createdAt });
    });
    [...enrollments].slice(0, 2).forEach(e => {
        items.push({ icon: 'fa-book-open', color: e.color, text: `Inscrito en <strong>${e.title}</strong> · ${e.progress}%`, date: e.startedAt });
    });
    items.sort((a, b) => new Date(b.date) - new Date(a.date));
    if (!items.length) { feed.innerHTML = '<p style="color:var(--uts-text-muted);font-size:13px">Sin actividad reciente</p>'; return; }
    feed.innerHTML = items.slice(0, 5).map(item => `
        <div style="display:flex;gap:10px;padding:9px 0;border-bottom:1px solid var(--uts-gray-light);align-items:flex-start">
            <div style="width:30px;height:30px;border-radius:8px;background:${item.color}22;display:flex;align-items:center;justify-content:center;flex-shrink:0">
                <i class="fas ${item.icon}" style="color:${item.color};font-size:13px"></i>
            </div>
            <div>
                <div style="font-size:13px;line-height:1.4">${item.text}</div>
                <div style="font-size:11px;color:var(--uts-text-muted);margin-top:2px">${item.date ? new Date(item.date).toLocaleDateString('es-CO') : ''}</div>
            </div>
        </div>`).join('');
}

function statusLabel(s) {
    return { done: 'Completado', 'in-progress': 'En Progreso', review: 'En Revisión', pending: 'Pendiente' }[s] || 'Pendiente';
}

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle'}"></i> ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('reveal'), 10);
    setTimeout(() => { t.classList.remove('reveal'); setTimeout(() => t.remove(), 500); }, 3000);
}
