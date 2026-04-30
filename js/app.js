// ╔══════════════════════════════════════════════════════════════╗
// ║         UTS Enterprise — Frontend API Client                 ║
// ║         Backend: Express + SQLite (localhost:3000)           ║
// ╚══════════════════════════════════════════════════════════════╝

const API_BASE = 'http://localhost:3000/api';
const TOTAL_REQUIRED_PROJECTS = 52;

// ─────────────────────────── API HELPER ───────────────────────────
async function api(method, endpoint, body = null) {
    const token = localStorage.getItem('uts_token');
    const opts = {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
    };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${endpoint}`, opts);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error en la solicitud');
    return data;
}

// ─────────────────────────── MAIN INIT ────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

    // --- THEME ---
    const savedTheme = localStorage.getItem('uts_theme');
    if (savedTheme === 'dark') toggleDarkMode(true);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.addEventListener('change', (e) => toggleDarkMode(e.target.checked));
    }

    const isAppPage = ['dashboard.html','inicio.html','proyectos.html','cursos.html','reportes.html','configuracion.html']
        .some(p => window.location.pathname.includes(p));

    let currentPage = null;
    if (window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('inicio.html')) currentPage = 'dashboard';
    if (window.location.pathname.includes('proyectos.html'))  currentPage = 'proyectos';
    if (window.location.pathname.includes('reportes.html'))   currentPage = 'reportes';

    let currentUser = JSON.parse(localStorage.getItem('uts_user'));

    // ── GUARD: si es página protegida y no hay sesión → login ──
    if (isAppPage) {
        if (!currentUser || !localStorage.getItem('uts_token')) {
            return window.location.href = 'login.html';
        }
        updateUI(currentUser);

        // Renderizar desde caché instantáneamente
        if (currentPage) {
            const localCache = localStorage.getItem(`uts_projects_cache_${currentUser.id}`);
            if (localCache) {
                try {
                    const cached = JSON.parse(localCache);
                    window.currentLoadedProjects = cached;
                    renderPageData(cached, currentPage);
                    if (currentPage === 'proyectos') initKanbanControls();
                } catch (e) { console.warn('Cache error', e); }
            }
        }

        // Luego refrescar desde el servidor
        refreshUserAndProjects(currentUser, currentPage);

        if (currentPage === 'proyectos') {
            initProjectCRUD();
            initKanbanControls();
        }
        if (window.location.pathname.includes('configuracion.html')) initSettingsLogic();
    }

    // ─────────────────────────── LOGIN ────────────────────────────
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email    = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value.trim();
            try {
                showToast('Iniciando sesión...', 'info');
                const { token, user } = await api('POST', '/auth/login', { email, password });
                localStorage.setItem('uts_token', token);
                localStorage.setItem('uts_user', JSON.stringify(user));
                showToast(`¡Bienvenido, ${user.name}!`, 'success');
                setTimeout(() => window.location.href = 'dashboard.html', 1000);
            } catch (err) {
                showToast(err.message || 'Correo o contraseña incorrectos', 'error');
            }
        };
    }

    // ─────────────────────────── REGISTER ─────────────────────────
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const name     = document.getElementById('reg-name').value.trim();
            const email    = document.getElementById('reg-email').value.trim().toLowerCase();
            const password = document.getElementById('reg-pass').value.trim();
            const career   = document.getElementById('reg-career').value;
            const code     = document.getElementById('reg-code')?.value.trim() || '';
            const semester = document.getElementById('reg-semester')?.value || '';
            const journey  = document.getElementById('reg-journey')?.value || '';

            if (password.length < 8) return showToast('La contraseña debe tener al menos 8 caracteres', 'error');

            try {
                showToast('Creando cuenta...', 'info');
                const { token, user } = await api('POST', '/auth/register', { name, email, password, career, code, semester, journey });
                localStorage.setItem('uts_token', token);
                localStorage.setItem('uts_user', JSON.stringify(user));
                showToast(`¡Bienvenido, ${name}!`, 'success');
                setTimeout(() => window.location.href = 'dashboard.html', 1500);
            } catch (err) {
                showToast(err.message || 'Error al crear la cuenta', 'error');
            }
        };
    }

    // ─────────────────────────── LOGOUT ───────────────────────────
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
            e.preventDefault();
            try { await api('POST', '/auth/logout'); } catch (_) {}
            localStorage.clear();
            window.location.href = 'login.html';
        };
    }
});

// ─────────────────────── REFRESH DATA FROM API ────────────────────
async function refreshUserAndProjects(currentUser, currentPage) {
    try {
        // Refrescar perfil
        const freshUser = await api('GET', '/users/me');
        const mergedUser = { ...currentUser, ...freshUser };
        localStorage.setItem('uts_user', JSON.stringify(mergedUser));
        updateUI(mergedUser);
        Object.assign(currentUser, mergedUser);
    } catch (e) {
        console.warn('No se pudo refrescar el perfil:', e.message);
    }

    if (!currentPage) return;

    try {
        const projects = await api('GET', '/projects');
        window.currentLoadedProjects = projects;
        localStorage.setItem(`uts_projects_cache_${currentUser.id}`, JSON.stringify(projects));
        renderPageData(projects, currentPage);
    } catch (e) {
        console.warn('No se pudo cargar proyectos:', e.message);
    }
}

// ─────────────────────────── RENDER ENGINE ────────────────────────
function renderPageData(projects, page) {
    if (page === 'dashboard') {
        updateStatsFromProjects(projects);
        renderChart(projects);
        checkBadges(projects);
    } else if (page === 'proyectos') {
        renderProjectsTable(projects);
        renderKanbanBoard(projects);
    } else if (page === 'reportes') {
        initPDFGenerator(projects);
    }
}

function renderProjectsTable(projects) {
    const tableBody = document.getElementById('projectsTableBody');
    if (!tableBody) return;
    if (projects.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><i class="fas fa-folder-open"></i><h3>Sin proyectos</h3></div></td></tr>`;
        return;
    }
    tableBody.innerHTML = projects.map(p => `
        <tr>
            <td><strong>${p.name}</strong></td>
            <td><span class="category-pill">${p.category || '—'}</span></td>
            <td>${p.date || '—'}</td>
            <td><span class="status-badge status-${p.status || 'pending'}">${(p.status || 'pending').toUpperCase()}</span></td>
            <td style="text-align:center;">
                <button onclick="editProject('${p.id}')" class="btn-icon edit"><i class="fas fa-edit"></i></button>
                <button onclick="deleteProject('${p.id}')" class="btn-icon delete"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

// ─────────────────────────── PROJECT CRUD ─────────────────────────
function initProjectCRUD() {
    const modal      = document.getElementById('projectModal');
    const openBtn    = document.getElementById('openModalBtn');
    const closeBtn   = document.getElementById('closeModal');
    const projectForm = document.getElementById('projectForm');

    if (openBtn) openBtn.onclick = () => {
        projectForm.reset();
        document.getElementById('projectId').value = '';
        modal.style.display = 'flex';
    };
    if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';

    projectForm.onsubmit = async (e) => {
        e.preventDefault();
        const id = document.getElementById('projectId').value;
        const projectData = {
            name:        document.getElementById('projName').value,
            category:    document.getElementById('projCategory').value,
            tutor:       document.getElementById('projTutor').value,
            status:      document.getElementById('projStatus').value,
            priority:    document.getElementById('projPriority').value,
            date:        document.getElementById('projDueDate').value,
            description: document.getElementById('projDesc').value
        };
        try {
            if (id) {
                await api('PUT', `/projects/${id}`, projectData);
            } else {
                await api('POST', '/projects', projectData);
            }
            modal.style.display = 'none';
            showToast(id ? 'Proyecto actualizado' : 'Proyecto creado', 'success');

            // Re-fetch & re-render
            const projects = await api('GET', '/projects');
            const currentUser = JSON.parse(localStorage.getItem('uts_user'));
            window.currentLoadedProjects = projects;
            localStorage.setItem(`uts_projects_cache_${currentUser.id}`, JSON.stringify(projects));
            renderProjectsTable(projects);
            renderKanbanBoard(projects);
        } catch (err) {
            console.error(err);
            showToast(err.message || 'Error al guardar', 'error');
        }
    };
}

window.editProject = (id) => {
    const p = window.currentLoadedProjects?.find(x => x.id === id);
    if (p) {
        document.getElementById('projectId').value        = id;
        document.getElementById('projName').value         = p.name;
        document.getElementById('projCategory').value     = p.category;
        document.getElementById('projTutor').value        = p.tutor;
        document.getElementById('projStatus').value       = p.status;
        document.getElementById('projPriority').value     = p.priority;
        document.getElementById('projDueDate').value      = p.date;
        document.getElementById('projDesc').value         = p.description;
        document.getElementById('projectModal').style.display = 'flex';
    }
};

window.deleteProject = async (id) => {
    if (!confirm('¿Eliminar proyecto?')) return;
    try {
        await api('DELETE', `/projects/${id}`);
        showToast('Proyecto eliminado', 'success');

        const currentUser = JSON.parse(localStorage.getItem('uts_user'));
        const projects = await api('GET', '/projects');
        window.currentLoadedProjects = projects;
        localStorage.setItem(`uts_projects_cache_${currentUser.id}`, JSON.stringify(projects));
        renderProjectsTable(projects);
        renderKanbanBoard(projects);
    } catch (err) {
        showToast(err.message || 'Error al eliminar', 'error');
    }
};

// ─────────────────────────── SETTINGS ─────────────────────────────
function initSettingsLogic() {
    const configForm = document.getElementById('configForm');
    if (!configForm) return;

    const currentUser = JSON.parse(localStorage.getItem('uts_user'));
    if (!currentUser) return;

    if (document.getElementById('confName'))    document.getElementById('confName').value    = currentUser.name    || '';
    if (document.getElementById('confEmail'))   document.getElementById('confEmail').value   = currentUser.email   || '';
    if (document.getElementById('confCode'))    document.getElementById('confCode').value    = currentUser.code    || '';
    if (document.getElementById('confCareer'))  document.getElementById('confCareer').value  = currentUser.career  || '';
    if (document.getElementById('confInitial')) document.getElementById('confInitial').textContent = (currentUser.name || 'U').charAt(0);

    configForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const updatedData = {
            name:   document.getElementById('confName').value.trim(),
            code:   document.getElementById('confCode').value.trim(),
            career: document.getElementById('confCareer').value
        };
        try {
            showToast('Guardando cambios...', 'info');
            const freshUser = await api('PUT', '/users/me', updatedData);
            const newUser = { ...currentUser, ...freshUser };
            localStorage.setItem('uts_user', JSON.stringify(newUser));
            Object.assign(currentUser, newUser);
            updateUI(newUser);
            if (document.getElementById('confInitial')) document.getElementById('confInitial').textContent = (newUser.name || 'U').charAt(0);
            showToast('Perfil actualizado con éxito', 'success');
        } catch (err) {
            showToast(err.message || 'Error al guardar', 'error');
        }
    });
}

// ─────────────────────────── UI HELPERS ───────────────────────────
function updateUI(user) {
    if (!user) return;
    const els = {
        'userName':    user.name,
        'welcomeName': (user.name || '').split(' ')[0],
        'userCareer':  user.career,
        'userInitial': (user.name || 'U').charAt(0),
        'confName':    user.name,
        'confCode':    user.code,
        'confCareer':  user.career,
        'confEmail':   user.email,
        'confInitial': (user.name || 'U').charAt(0)
    };
    for (let id in els) {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'INPUT' || el.tagName === 'SELECT') el.value = els[id] || '';
            else el.textContent = els[id] || '';
        }
    }
}

function updateStatsFromProjects(projects) {
    const completed = projects.filter(p => p.status === 'done').length;
    const pending   = TOTAL_REQUIRED_PROJECTS - completed;
    if (document.getElementById('statCompleted'))      document.getElementById('statCompleted').textContent      = completed;
    if (document.getElementById('statPending'))        document.getElementById('statPending').textContent        = pending;
    if (document.getElementById('welcomePendingCount')) document.getElementById('welcomePendingCount').textContent = pending;
}

// ─────────────────────────── KANBAN ───────────────────────────────
function initKanbanControls() {
    const btnList   = document.getElementById('btnViewList');
    const btnKanban = document.getElementById('btnViewKanban');
    const viewList  = document.getElementById('listViewContainer');
    const viewKanban = document.getElementById('kanbanViewContainer');
    if (btnList && btnKanban) {
        btnList.onclick = () => {
            btnList.classList.add('active');   btnKanban.classList.remove('active');
            viewList.style.display = 'block';  viewKanban.style.display = 'none';
        };
        btnKanban.onclick = () => {
            btnKanban.classList.add('active'); btnList.classList.remove('active');
            viewKanban.style.display = 'flex'; viewList.style.display = 'none';
        };
    }
}

function renderKanbanBoard(projects) {
    const cols   = { 'pending': '', 'in-progress': '', 'review': '', 'done': '' };
    const counts = { 'pending': 0,  'in-progress': 0,  'review': 0,  'done': 0  };

    projects.forEach(p => {
        const s = p.status || 'pending';
        if (cols[s] !== undefined) {
            counts[s]++;
            cols[s] += `
                <div class="kanban-card" data-id="${p.id}">
                    <h4>${p.name}</h4>
                    <p>${p.category || ''}</p>
                    <div class="kanban-card-meta">
                        <span class="priority">${p.priority || 'Media'}</span>
                        <span style="color:var(--uts-text-muted);"><i class="fas fa-clock"></i> ${p.date?.substring(5) || ''}</span>
                    </div>
                </div>`;
        }
    });

    ['pending', 'in-progress', 'review', 'done'].forEach(s => {
        const container = document.getElementById(`kanban-${s}`);
        const countEl   = document.getElementById(`count-${s}`);
        if (container) {
            container.innerHTML = cols[s];
            if (countEl) countEl.textContent = counts[s];
        }
    });
}

// ─────────────────────────── CHART ────────────────────────────────
function renderChart(projects) {
    const ctx = document.getElementById('productivityChart');
    if (!ctx || !window.Chart) return;
    const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    const data   = new Array(12).fill(0);
    projects.forEach(p => {
        if (p.createdAt) data[new Date(p.createdAt).getMonth()]++;
    });
    if (window.myProductivityChart) window.myProductivityChart.destroy();
    window.myProductivityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [{ label: 'Proyectos', data, borderColor: '#008D3E', backgroundColor: 'rgba(0,141,62,0.1)', borderWidth: 3, tension: 0.4, fill: true }]
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function checkBadges(projects) {
    const container = document.getElementById('badgesContainer');
    if (!container) return;
    const doneCount = projects.filter(p => p.status === 'done').length;
    let html = '';
    if (projects.length > 0)  html += `<div class="badge-icon" title="Iniciador"><i class="fas fa-seedling"></i></div>`;
    if (doneCount >= 5)       html += `<div class="badge-icon" title="Experto"><i class="fas fa-star"></i></div>`;
    container.innerHTML = html || '<span style="font-size:12px;color:var(--uts-text-muted);">Sin insignias aún</span>';
}

// ─────────────────────────── PDF ──────────────────────────────────
function initPDFGenerator(projects) {
    const btn = document.getElementById('btnGeneratePDF');
    if (!btn) return;
    btn.onclick = () => {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const user = JSON.parse(localStorage.getItem('uts_user'));
        doc.text('Reporte de Proyectos - UTS', 14, 20);
        const tableData = projects.map((p, i) => [i + 1, p.name, p.category, p.status]);
        doc.autoTable({ startY: 30, head: [['#', 'Nombre', 'Categoría', 'Estado']], body: tableData });
        doc.save(`Reporte_${user?.name || 'UTS'}.pdf`);
    };
}

// ─────────────────────────── UTILS ────────────────────────────────
function toggleDarkMode(isDark) {
    document.body.classList.toggle('dark-theme', isDark);
    localStorage.setItem('uts_theme', isDark ? 'dark' : 'light');
}

function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('reveal'), 10);
    setTimeout(() => { toast.classList.remove('reveal'); setTimeout(() => toast.remove(), 500); }, 3000);
}
