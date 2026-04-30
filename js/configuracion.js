/* ===================== CONFIGURACION.JS — UTS Enterprise ===================== */
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

let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = JSON.parse(localStorage.getItem('uts_user'));
    if (!currentUser || !localStorage.getItem('uts_token')) return window.location.href = 'login.html';

    const savedTheme = localStorage.getItem('uts_theme');
    if (savedTheme === 'dark') document.body.classList.add('dark-theme');

    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.addEventListener('change', e => {
            document.body.classList.toggle('dark-theme', e.target.checked);
            localStorage.setItem('uts_theme', e.target.checked ? 'dark' : 'light');
            showToast(e.target.checked ? 'Modo oscuro activado' : 'Modo claro activado', 'info');
        });
    }

    document.getElementById('logoutBtn')?.addEventListener('click', async e => {
        e.preventDefault();
        try { await apiFetch('POST', '/auth/logout'); } catch (_) {}
        localStorage.clear();
        window.location.href = 'login.html';
    });

    // Fetch fresh user data
    try {
        const freshUser = await apiFetch('GET', '/users/me');
        Object.assign(currentUser, freshUser);
        localStorage.setItem('uts_user', JSON.stringify(currentUser));
    } catch (_) {}

    populateProfile();
    renderStats();
    setupProfileForm();
    setupPasswordForm();
    setupTabNav();
});

// ── POPULATE PROFILE ──
function populateProfile() {
    const u = currentUser;
    const s = (id, val) => { const el = document.getElementById(id); if (!el) return; if (el.tagName==='INPUT'||el.tagName==='SELECT') el.value=val||''; else el.textContent=val||''; };
    s('userName',    u.name);   s('userCareer',  u.career);
    s('userInitial', (u.name||'U')[0]);
    s('confInitial', (u.name||'U')[0]);
    s('confName',    u.name);   s('confCode',    u.code);
    s('confEmail',   u.email);  s('confCareer',  u.career);
    s('confSemester', u.semester); s('confJourney', u.journey);
    // Header user info
    const ua = document.getElementById('confInitialAvatar');
    if (ua) ua.textContent = (u.name||'U')[0];
    const nm = document.getElementById('confUserName');
    if (nm) nm.textContent = u.name;
    const cr = document.getElementById('confUserCareer');
    if (cr) cr.textContent = u.career;
    const em = document.getElementById('confUserEmail');
    if (em) em.textContent = u.email;
    const cd = document.getElementById('confUserCode');
    if (cd) cd.textContent = u.code ? `Código: ${u.code}` : 'Sin código registrado';
}

// ── STATS ──
async function renderStats() {
    try {
        const [projects, enrollments] = await Promise.all([
            apiFetch('GET', '/projects'),
            apiFetch('GET', '/enrollments')
        ]);
        const done = projects.filter(p => p.status === 'done').length;
        const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        s('cStatProjects',   projects.length);
        s('cStatDone',       done);
        s('cStatCourses',    enrollments.filter(e => e.status === 'completed').length);
        s('cStatPct',        Math.min(Math.round(done / 52 * 100), 100) + '%');
    } catch (_) {}
}

// ── PROFILE FORM ──
function setupProfileForm() {
    const form = document.getElementById('configForm');
    if (!form) return;
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const btn = form.querySelector('[type=submit]');
        btn.disabled = true; btn.textContent = 'Guardando...';
        const data = {
            name:     document.getElementById('confName').value.trim(),
            code:     document.getElementById('confCode').value.trim(),
            career:   document.getElementById('confCareer').value,
            semester: document.getElementById('confSemester').value,
            journey:  document.getElementById('confJourney').value
        };
        try {
            const updated = await apiFetch('PUT', '/users/me', data);
            Object.assign(currentUser, updated);
            localStorage.setItem('uts_user', JSON.stringify(currentUser));
            populateProfile();
            showToast('Perfil actualizado con éxito ✓', 'success');
        } catch (err) {
            showToast(err.message || 'Error al guardar', 'error');
        } finally {
            btn.disabled = false; btn.textContent = 'Guardar Cambios';
        }
    });
}

// ── PASSWORD FORM ──
function setupPasswordForm() {
    const form = document.getElementById('passwordForm');
    if (!form) return;
    form.addEventListener('submit', async e => {
        e.preventDefault();
        const cur  = document.getElementById('currentPass').value;
        const newP = document.getElementById('newPass').value;
        const conf = document.getElementById('confirmPass').value;
        if (newP !== conf) return showToast('Las contraseñas no coinciden', 'error');
        if (newP.length < 8) return showToast('Mínimo 8 caracteres', 'error');
        try {
            // Re-login to verify current password, then update
            await apiFetch('POST', '/auth/login', { email: currentUser.email, password: cur });
            // Server-side password change — endpoint simple via PUT users/me con campo password
            await fetch(`${API}/users/me/password`, {
                method: 'PUT', headers: authHeaders(),
                body: JSON.stringify({ currentPassword: cur, newPassword: newP })
            });
            form.reset();
            showToast('Contraseña actualizada ✓', 'success');
        } catch (err) { showToast('Contraseña actual incorrecta', 'error'); }
    });
}

// ── TAB NAV ──
function setupTabNav() {
    document.querySelectorAll('.settings-nav-item').forEach(item => {
        item.addEventListener('click', function() {
            const tab = this.dataset.tab;
            document.querySelectorAll('.settings-nav-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
            document.querySelectorAll('.settings-section-card').forEach(c => c.style.display = 'none');
            const target = document.getElementById(`tab-${tab}`);
            if (target) target.style.display = 'block';
        });
    });
}

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle'}"></i> ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('reveal'), 10);
    setTimeout(() => { t.classList.remove('reveal'); setTimeout(() => t.remove(), 500); }, 3000);
}
