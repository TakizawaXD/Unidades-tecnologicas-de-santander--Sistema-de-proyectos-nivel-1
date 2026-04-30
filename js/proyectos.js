/* ===================== PROYECTOS.JS — UTS Enterprise ===================== */
const API = 'http://localhost:3000/api';
const TOTAL_REQUIRED = 52;

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

let projects = [], currentUser = null, editingId = null, activeView = 'list', activeFilter = 'all', searchQuery = '';

document.addEventListener('DOMContentLoaded', async () => {
    currentUser = JSON.parse(localStorage.getItem('uts_user'));
    if (!currentUser || !localStorage.getItem('uts_token')) return window.location.href = 'login.html';

    const savedTheme = localStorage.getItem('uts_theme');
    if (savedTheme === 'dark') document.body.classList.add('dark-theme');

    const s = (id, v) => { const el = document.getElementById(id); if (el) { if (el.tagName==='INPUT'||el.tagName==='SELECT') el.value=v||''; else el.textContent=v||''; } };
    s('userName', currentUser.name); s('userCareer', currentUser.career); s('userInitial', (currentUser.name||'U')[0]);

    document.getElementById('logoutBtn')?.addEventListener('click', e => { e.preventDefault(); localStorage.clear(); window.location.href = 'login.html'; });

    // Load from cache instantly
    const cached = localStorage.getItem(`uts_projects_cache_${currentUser.id}`);
    if (cached) { projects = JSON.parse(cached); renderAll(); }

    await fetchProjects();
    setupModal();
    setupViewToggle();
    setupFilters();
    setupSearch();
});

async function fetchProjects() {
    try {
        projects = await apiFetch('GET', '/projects');
        localStorage.setItem(`uts_projects_cache_${currentUser.id}`, JSON.stringify(projects));
        renderAll();
    } catch (e) { showToast('Error cargando proyectos', 'error'); }
}

// ── RENDER ALL ──
function renderAll() {
    renderKPIs();
    renderGradBar();
    const filtered = filterProjects();
    renderTable(filtered);
    renderKanban(filtered);
}

function filterProjects() {
    let list = [...projects];
    if (activeFilter !== 'all') list = list.filter(p => (p.status || 'pending') === activeFilter);
    if (searchQuery) {
        const q = searchQuery.toLowerCase();
        list = list.filter(p => p.name.toLowerCase().includes(q) || (p.category||'').toLowerCase().includes(q) || (p.tutor||'').toLowerCase().includes(q));
    }
    return list;
}

// ── KPIs ──
function renderKPIs() {
    const done    = projects.filter(p => p.status === 'done').length;
    const inprog  = projects.filter(p => p.status === 'in-progress').length;
    const review  = projects.filter(p => p.status === 'review').length;
    const pending = projects.filter(p => !p.status || p.status === 'pending').length;
    const s = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    s('pKpiTotal',   projects.length);
    s('pKpiDone',    done);
    s('pKpiInProg',  inprog);
    s('pKpiReview',  review);
    s('pKpiPending', pending);
}

function renderGradBar() {
    const done = projects.filter(p => p.status === 'done').length;
    const pct  = Math.min(Math.round((done / TOTAL_REQUIRED) * 100), 100);
    const bar  = document.getElementById('pGradFill');
    const lbl  = document.getElementById('pGradPct');
    const sub  = document.getElementById('pGradSub');
    if (bar) setTimeout(() => bar.style.width = pct + '%', 100);
    if (lbl) lbl.textContent = pct + '%';
    if (sub) sub.textContent = `${done} de ${TOTAL_REQUIRED} proyectos completados`;
}

// ── TABLE ──
function renderTable(list) {
    const tbody = document.getElementById('projectsTableBody');
    if (!tbody) return;
    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="fas fa-folder-open"></i><h3>${searchQuery || activeFilter !== 'all' ? 'Sin resultados' : 'Sin proyectos'}</h3><p>${searchQuery || activeFilter !== 'all' ? 'Prueba con otros filtros' : 'Haz clic en "+ Nuevo Proyecto" para comenzar'}</p></div></td></tr>`;
        return;
    }
    const priorityColors = { Alta: '#ef4444', Media: '#f59e0b', Baja: '#10b981' };
    tbody.innerHTML = list.map(p => `
        <tr>
            <td><strong>${p.name}</strong>${p.description ? `<br><small style="color:var(--uts-text-muted)">${p.description.substring(0,50)}${p.description.length>50?'...':''}</small>` : ''}</td>
            <td><span class="category-pill">${p.category || '—'}</span></td>
            <td>${p.tutor || '—'}</td>
            <td><span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:700;color:${priorityColors[p.priority]||'#94a3b8'}"><i class="fas fa-circle" style="font-size:7px"></i>${p.priority||'Media'}</span></td>
            <td><span class="status-badge status-${p.status||'pending'}">${statusLabel(p.status)}</span></td>
            <td>${p.date || '—'}</td>
            <td style="text-align:center">
                <div style="display:flex;gap:6px;justify-content:center">
                    <button onclick="openEdit('${p.id}')" class="btn-icon edit" title="Editar"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteProject('${p.id}')" class="btn-icon delete" title="Eliminar"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>`).join('');
}

// ── KANBAN ──
function renderKanban(list) {
    const cols = { pending: '', 'in-progress': '', review: '', done: '' };
    const counts = { pending: 0, 'in-progress': 0, review: 0, done: 0 };
    const priorityColors = { Alta: '#ef4444', Media: '#f59e0b', Baja: '#10b981' };
    list.forEach(p => {
        const s = p.status || 'pending';
        if (cols[s] !== undefined) {
            counts[s]++;
            cols[s] += `
            <div class="kanban-card" data-id="${p.id}" onclick="openEdit('${p.id}')">
                <h4>${p.name}</h4>
                <p>${p.category || ''} ${p.tutor ? '· ' + p.tutor : ''}</p>
                <div class="kanban-card-meta">
                    <span class="priority" style="color:${priorityColors[p.priority]||'#94a3b8'};background:${priorityColors[p.priority]||'#94a3b8'}18">${p.priority||'Media'}</span>
                    <span style="color:var(--uts-text-muted)"><i class="fas fa-calendar"></i> ${p.date?.substring(5)||'—'}</span>
                </div>
            </div>`;
        }
    });
    ['pending','in-progress','review','done'].forEach(s => {
        const c = document.getElementById(`kanban-${s}`);
        const n = document.getElementById(`count-${s}`);
        if (c) c.innerHTML = cols[s] || `<div style="text-align:center;padding:20px;color:var(--uts-text-muted);font-size:13px">Sin tarjetas</div>`;
        if (n) n.textContent = counts[s];
    });
}

// ── VIEW TOGGLE ──
function setupViewToggle() {
    document.getElementById('btnViewList')?.addEventListener('click', () => switchView('list'));
    document.getElementById('btnViewKanban')?.addEventListener('click', () => switchView('kanban'));
}
function switchView(v) {
    activeView = v;
    const listEl = document.getElementById('listViewContainer');
    const kanban = document.getElementById('kanbanViewContainer');
    document.getElementById('btnViewList')?.classList.toggle('active', v === 'list');
    document.getElementById('btnViewKanban')?.classList.toggle('active', v === 'kanban');
    if (listEl) listEl.style.display = v === 'list' ? 'block' : 'none';
    if (kanban) kanban.style.display = v === 'kanban' ? 'flex' : 'none';
}

// ── FILTERS ──
function setupFilters() {
    document.querySelectorAll('.p-filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.p-filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            activeFilter = chip.dataset.status;
            renderAll();
        });
    });
}

// ── SEARCH ──
function setupSearch() {
    document.getElementById('projSearch')?.addEventListener('input', e => {
        searchQuery = e.target.value.trim();
        renderAll();
    });
}

// ── MODAL ──
function setupModal() {
    const modal = document.getElementById('projectModal');
    const form  = document.getElementById('projectForm');
    document.getElementById('openModalBtn')?.addEventListener('click', () => openNew());
    document.getElementById('closeModal')?.addEventListener('click', () => closeModal());
    modal?.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    form?.addEventListener('submit', async e => {
        e.preventDefault();
        const data = {
            name:        document.getElementById('projName').value.trim(),
            category:    document.getElementById('projCategory').value,
            tutor:       document.getElementById('projTutor').value.trim(),
            status:      document.getElementById('projStatus').value,
            priority:    document.getElementById('projPriority').value,
            date:        document.getElementById('projDueDate').value,
            description: document.getElementById('projDesc').value.trim()
        };
        try {
            const btn = form.querySelector('[type=submit]');
            btn.disabled = true; btn.textContent = 'Guardando...';
            if (editingId) await apiFetch('PUT', `/projects/${editingId}`, data);
            else await apiFetch('POST', '/projects', data);
            closeModal();
            showToast(editingId ? 'Proyecto actualizado ✓' : 'Proyecto creado ✓', 'success');
            await fetchProjects();
        } catch(err) { showToast(err.message, 'error'); }
        finally { const btn = form.querySelector('[type=submit]'); if(btn){btn.disabled=false;btn.textContent='Guardar Proyecto';} }
    });
}

function openNew() {
    editingId = null;
    document.getElementById('projectForm').reset();
    document.getElementById('modalTitle').textContent = 'Nuevo Proyecto';
    document.getElementById('projectModal').style.display = 'flex';
}

function openEdit(id) {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    editingId = id;
    document.getElementById('modalTitle').textContent = 'Editar Proyecto';
    document.getElementById('projName').value     = p.name;
    document.getElementById('projCategory').value = p.category;
    document.getElementById('projTutor').value    = p.tutor || '';
    document.getElementById('projStatus').value   = p.status || 'pending';
    document.getElementById('projPriority').value = p.priority || 'Media';
    document.getElementById('projDueDate').value  = p.date || '';
    document.getElementById('projDesc').value     = p.description || '';
    document.getElementById('projectModal').style.display = 'flex';
}

function closeModal() { document.getElementById('projectModal').style.display = 'none'; editingId = null; }

async function deleteProject(id) {
    if (!confirm('¿Eliminar este proyecto? Esta acción no se puede deshacer.')) return;
    try {
        await apiFetch('DELETE', `/projects/${id}`);
        showToast('Proyecto eliminado', 'success');
        await fetchProjects();
    } catch(e) { showToast(e.message, 'error'); }
}

// ── UTILS ──
function statusLabel(s) { return { done:'Completado', 'in-progress':'En Progreso', review:'Revisión', pending:'Pendiente' }[s] || 'Pendiente'; }

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle'}"></i> ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('reveal'), 10);
    setTimeout(() => { t.classList.remove('reveal'); setTimeout(() => t.remove(), 500); }, 3000);
}
