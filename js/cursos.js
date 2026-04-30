/* ===================== CURSOS.JS — UTS Enterprise ===================== */
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

// ── STATE ──
let allCourses = [], myEnrollments = [], activeTab = 'catalog', activeCourse = null;

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
    const user = JSON.parse(localStorage.getItem('uts_user'));
    if (!user || !localStorage.getItem('uts_token')) return window.location.href = 'login.html';

    // Update UI
    ['userName','welcomeName'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = id==='welcomeName' ? user.name.split(' ')[0] : user.name; });
    ['userCareer'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = user.career || ''; });
    ['userInitial','confInitial'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = (user.name||'U')[0]; });

    const savedTheme = localStorage.getItem('uts_theme');
    if (savedTheme === 'dark') document.body.classList.add('dark-theme');

    // Logout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.onclick = async e => { e.preventDefault(); localStorage.clear(); window.location.href = 'login.html'; };

    await loadData();
    setupTabs();
    setupFilters();
    setupSearch();
    setupModal();
});

async function loadData() {
    try {
        [allCourses, myEnrollments] = await Promise.all([
            apiFetch('GET', '/courses'),
            apiFetch('GET', '/enrollments')
        ]);
    } catch(e) { showToast('Error cargando datos', 'error'); }
    renderCatalog(allCourses);
    renderMyEnrollments();
    renderStats();
}

// ── TABS ──
function setupTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeTab = btn.dataset.tab;
            document.getElementById('catalogView').style.display = activeTab === 'catalog' ? 'block' : 'none';
            document.getElementById('myCoursesView').style.display = activeTab === 'my' ? 'block' : 'none';
        });
    });
}

// ── FILTERS ──
function setupFilters() {
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            const cat = chip.dataset.filter;
            renderCatalog(cat === 'all' ? allCourses : allCourses.filter(c => c.category === cat));
        });
    });
    document.getElementById('levelFilter')?.addEventListener('change', e => {
        const v = e.target.value;
        renderCatalog(v ? allCourses.filter(c => c.level === v) : allCourses);
    });
}

// ── SEARCH ──
function setupSearch() {
    document.getElementById('courseSearch')?.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        renderCatalog(allCourses.filter(c => c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q) || c.category.toLowerCase().includes(q)));
    });
}

// ── RENDER CATALOG ──
function renderCatalog(courses) {
    const grid = document.getElementById('coursesGrid');
    if (!grid) return;
    if (!courses.length) { grid.innerHTML = '<div class="empty-courses"><i class="fas fa-search"></i><p>Sin resultados</p></div>'; return; }
    grid.innerHTML = courses.map(c => {
        const enrolled = myEnrollments.find(e => e.courseId === c.id);
        const techArr = safeJSON(c.technologies, []);
        return `
        <div class="course-card-v2" style="--card-color:${c.color}" onclick="openCourseModal('${c.id}')">
            ${c.badge ? `<div class="course-badge-v2">${c.badge}</div>` : ''}
            <div class="course-card-header">
                <div class="course-icon-wrap" style="background:${c.color}22"><i class="fas ${c.icon}" style="color:${c.color}"></i></div>
                <div class="course-card-meta-top">
                    <span class="level-tag level-${c.level.toLowerCase().replace(' ','-')}">${c.level}</span>
                    <span class="hours-tag"><i class="fas fa-clock"></i> ${c.hours}h</span>
                </div>
            </div>
            <h3 class="course-card-title">${c.title}</h3>
            <p class="course-card-desc">${c.description.substring(0, 90)}...</p>
            <div class="tech-stack">${techArr.slice(0,4).map(t => `<span class="tech-chip">${t}</span>`).join('')}</div>
            <div class="course-card-footer">
                <span class="instructor-tag"><i class="fas fa-chalkboard-teacher"></i> ${c.instructor}</span>
                ${enrolled
                    ? `<div class="enrolled-badge"><i class="fas fa-check-circle"></i> ${enrolled.progress}%</div>`
                    : `<button class="btn-enroll" onclick="event.stopPropagation();enroll('${c.id}')">Inscribirme</button>`}
            </div>
            ${enrolled ? `<div class="mini-progress-bar"><div class="mini-progress-fill" style="width:${enrolled.progress}%;background:${c.color}"></div></div>` : ''}
        </div>`;
    }).join('');
}

// ── RENDER MY COURSES ──
function renderMyEnrollments() {
    const list = document.getElementById('myCoursesList');
    if (!list) return;
    if (!myEnrollments.length) {
        list.innerHTML = '<div class="empty-courses"><i class="fas fa-book-open"></i><p>No estás inscrito en ningún curso aún.</p></div>';
        return;
    }
    list.innerHTML = myEnrollments.map(e => {
        const units = safeJSON(e.syllabus, []);
        const done = safeJSON(e.unitsDone, []);
        return `
        <div class="my-course-row" onclick="openCourseModal('${e.courseId}')">
            <div class="my-course-icon" style="background:${e.color}22"><i class="fas ${e.icon}" style="color:${e.color}"></i></div>
            <div class="my-course-info">
                <h4>${e.title}</h4>
                <span>${e.category} · ${e.level} · ${e.hours}h</span>
                <div class="progress-bar-wrap">
                    <div class="progress-bar-track">
                        <div class="progress-bar-fill-v2" style="width:${e.progress}%;background:${e.color}"></div>
                    </div>
                    <span class="progress-pct">${e.progress}%</span>
                </div>
                <div class="units-mini">${units.map((u,i) => `<span class="unit-dot ${done.includes(i)?'done':''}" title="Unidad ${i+1}: ${u.title}"></span>`).join('')}</div>
            </div>
            <div class="my-course-status">
                <span class="status-pill status-${e.status}">${e.status==='completed'?'✅ Completado':'🔄 En progreso'}</span>
                <button class="btn-unenroll" onclick="event.stopPropagation();unenroll('${e.courseId}')"><i class="fas fa-times"></i></button>
            </div>
        </div>`;
    }).join('');
}

// ── STATS ──
function renderStats() {
    const completed = myEnrollments.filter(e => e.status === 'completed').length;
    const inProgress = myEnrollments.filter(e => e.status === 'in-progress').length;
    const totalHours = myEnrollments.reduce((s, e) => s + (e.hours * e.progress / 100), 0);
    document.getElementById('statEnrolled')  && (document.getElementById('statEnrolled').textContent = myEnrollments.length);
    document.getElementById('statCompleted2') && (document.getElementById('statCompleted2').textContent = completed);
    document.getElementById('statInProgress') && (document.getElementById('statInProgress').textContent = inProgress);
    document.getElementById('statHours')     && (document.getElementById('statHours').textContent = Math.round(totalHours) + 'h');
}

// ── MODAL ──
function setupModal() {
    document.getElementById('courseModalOverlay')?.addEventListener('click', e => {
        if (e.target.id === 'courseModalOverlay') closeCourseModal();
    });
    document.getElementById('closeModalBtn')?.addEventListener('click', closeCourseModal);
}

async function openCourseModal(id) {
    activeCourse = await apiFetch('GET', `/courses/${id}`);
    renderModal(activeCourse);
    document.getElementById('courseModalOverlay').style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closeCourseModal() {
    document.getElementById('courseModalOverlay').style.display = 'none';
    document.body.style.overflow = '';
    activeCourse = null;
}

function renderModal(c) {
    const enroll = c.enrollment;
    const syllabus = safeJSON(c.syllabus, []);
    const tech = safeJSON(c.technologies, []);
    const objectives = safeJSON(c.objectives, []);
    const unitsDone = enroll ? safeJSON(enroll.unitsDone, []) : [];

    document.getElementById('modalTitle').textContent = c.title;
    document.getElementById('modalBody').innerHTML = `
        <div class="modal-course-hero" style="background:linear-gradient(135deg,${c.color},${c.color}99)">
            <i class="fas ${c.icon} modal-hero-icon"></i>
            <div class="modal-hero-info">
                <div class="modal-meta-chips">
                    <span class="mchip"><i class="fas fa-layer-group"></i> ${c.category}</span>
                    <span class="mchip"><i class="fas fa-signal"></i> ${c.level}</span>
                    <span class="mchip"><i class="fas fa-clock"></i> ${c.hours} horas</span>
                    <span class="mchip"><i class="fas fa-chalkboard-teacher"></i> ${c.instructor}</span>
                </div>
                ${enroll ? `<div class="modal-progress-hero"><span>${enroll.progress}% completado</span><div class="modal-progress-track"><div style="width:${enroll.progress}%;height:6px;background:white;border-radius:3px;transition:width 0.5s"></div></div></div>` : ''}
            </div>
        </div>
        <div class="modal-tabs">
            <button class="modal-tab active" onclick="switchModalTab('overview',this)">Descripción</button>
            <button class="modal-tab" onclick="switchModalTab('syllabus',this)">Temario</button>
            <button class="modal-tab" onclick="switchModalTab('tech',this)">Tecnologías</button>
            ${enroll ? `<button class="modal-tab" onclick="switchModalTab('progress',this)">Mi Progreso</button>` : ''}
        </div>

        <div id="mtab-overview" class="modal-tab-content active">
            <p style="color:var(--uts-text-muted);line-height:1.8;margin-bottom:20px">${c.description}</p>
            <h4 style="margin-bottom:12px;color:var(--uts-blue)">🎯 Lo que aprenderás</h4>
            <ul class="objectives-list">${objectives.map(o => `<li><i class="fas fa-check" style="color:#10b981"></i> ${o}</li>`).join('')}</ul>
            ${c.prerequisites ? `<div class="prereq-box"><i class="fas fa-info-circle"></i> <strong>Prerrequisitos:</strong> ${c.prerequisites}</div>` : ''}
        </div>

        <div id="mtab-syllabus" class="modal-tab-content" style="display:none">
            <p style="color:var(--uts-text-muted);font-size:13px;margin-bottom:20px">${syllabus.length} unidades · ${c.hours} horas totales</p>
            <div class="syllabus-list">${syllabus.map((u, i) => `
                <div class="syllabus-unit ${unitsDone.includes(i) ? 'done' : ''}">
                    <div class="unit-header" onclick="toggleUnit(${i})">
                        <div class="unit-num-wrap">
                            <span class="unit-num" style="background:${c.color}">${i+1}</span>
                            <div>
                                <strong>${u.title}</strong>
                                <span style="font-size:12px;color:var(--uts-text-muted)">${u.hours}h · ${u.topics.length} temas</span>
                            </div>
                        </div>
                        <div style="display:flex;align-items:center;gap:10px">
                            ${enroll ? `<button class="unit-check-btn ${unitsDone.includes(i)?'checked':''}" onclick="event.stopPropagation();markUnit(${i},${syllabus.length},'${c.id}')">${unitsDone.includes(i)?'✅ Hecho':'Marcar'}</button>` : ''}
                            <i class="fas fa-chevron-down unit-chevron"></i>
                        </div>
                    </div>
                    <div class="unit-topics" id="unit-${i}" style="display:none">
                        ${u.topics.map(t => `<div class="topic-item"><i class="fas fa-circle-dot" style="color:${c.color}"></i> ${t}</div>`).join('')}
                    </div>
                </div>`).join('')}
            </div>
        </div>

        <div id="mtab-tech" class="modal-tab-content" style="display:none">
            <div class="tech-grid">${tech.map(t => `<div class="tech-card"><i class="fas fa-cube"></i><span>${t}</span></div>`).join('')}</div>
        </div>

        ${enroll ? `
        <div id="mtab-progress" class="modal-tab-content" style="display:none">
            <div class="progress-dashboard">
                <div class="prog-stat"><span class="prog-num">${enroll.progress}%</span><span>Completado</span></div>
                <div class="prog-stat"><span class="prog-num">${unitsDone.length}/${syllabus.length}</span><span>Unidades</span></div>
                <div class="prog-stat"><span class="prog-num">${Math.round(c.hours * enroll.progress/100)}h</span><span>Invertidas</span></div>
            </div>
            <div class="big-progress-track"><div class="big-progress-fill" style="width:${enroll.progress}%;background:${c.color}"></div></div>
            <p style="text-align:center;color:var(--uts-text-muted);font-size:13px;margin-top:8px">Inicio: ${enroll.startedAt ? new Date(enroll.startedAt).toLocaleDateString('es-CO') : '—'}</p>
        </div>` : ''}

        <div class="modal-action-footer">
            ${enroll
                ? `<button class="btn-unenroll-modal" onclick="unenroll('${c.id}');closeCourseModal()"><i class="fas fa-door-open"></i> Abandonar curso</button>
                   <span class="enrolled-status-modal"><i class="fas fa-check-circle"></i> Inscrito · ${enroll.status==='completed'?'Completado':'En progreso'}</span>`
                : `<button class="btn-enroll-modal" onclick="enroll('${c.id}');closeCourseModal()"><i class="fas fa-rocket"></i> Inscribirme gratis</button>`}
        </div>`;
}

function switchModalTab(tab, btn) {
    document.querySelectorAll('.modal-tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.modal-tab-content').forEach(c => c.style.display = 'none');
    btn.classList.add('active');
    document.getElementById(`mtab-${tab}`).style.display = 'block';
}

function toggleUnit(i) {
    const el = document.getElementById(`unit-${i}`);
    if (!el) return;
    const chev = el.previousElementSibling?.querySelector('.unit-chevron');
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
    if (chev) chev.style.transform = el.style.display === 'block' ? 'rotate(180deg)' : '';
}

// ── ENROLL / UNENROLL ──
async function enroll(courseId) {
    try {
        await apiFetch('POST', '/enrollments', { courseId });
        showToast('✅ Inscrito exitosamente', 'success');
        await loadData();
    } catch(e) { showToast(e.message, 'error'); }
}

async function unenroll(courseId) {
    if (!confirm('¿Abandonar este curso? Se perderá tu progreso.')) return;
    try {
        await apiFetch('DELETE', `/enrollments/${courseId}`);
        showToast('Desmatriculado', 'info');
        await loadData();
    } catch(e) { showToast(e.message, 'error'); }
}

async function markUnit(unitIndex, totalUnits, courseId) {
    try {
        const result = await apiFetch('PUT', `/enrollments/${courseId}/progress`, { unitIndex, totalUnits });
        showToast(result.status === 'completed' ? '🎉 ¡Curso completado!' : `Unidad marcada · ${result.progress}%`, 'success');
        await loadData();
        if (activeCourse) openCourseModal(courseId);
    } catch(e) { showToast(e.message, 'error'); }
}

// ── UTILS ──
function safeJSON(str, fallback) {
    try { return typeof str === 'string' ? JSON.parse(str) : (str || fallback); } catch { return fallback; }
}

function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<i class="fas fa-${type==='success'?'check-circle':type==='error'?'exclamation-circle':'info-circle'}"></i> ${msg}`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('reveal'), 10);
    setTimeout(() => { t.classList.remove('reveal'); setTimeout(() => t.remove(), 500); }, 3000);
}
