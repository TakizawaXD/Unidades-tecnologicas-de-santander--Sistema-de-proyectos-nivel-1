import { 
    auth, db, 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged,
    collection, query, where, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDoc, setDoc, serverTimestamp, orderBy
} from './firebase-config.js';

const TOTAL_REQUIRED_PROJECTS = 52;

document.addEventListener('DOMContentLoaded', async () => {
    // --- THEME LOGIC ---
    const savedTheme = localStorage.getItem('uts_theme');
    if (savedTheme === 'dark') toggleDarkMode(true);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.addEventListener('change', (e) => toggleDarkMode(e.target.checked));
    }

    let currentUser = JSON.parse(localStorage.getItem('uts_user'));

    // --- 1. ZERO-LATENCY UI RENDER (INSTANTÁNEO) ---
    const isAppPage = ['dashboard.html', 'inicio.html', 'proyectos.html', 'cursos.html', 'reportes.html', 'configuracion.html'].some(p => window.location.pathname.includes(p));
    let currentPage = null;
    if (window.location.pathname.includes('dashboard.html') || window.location.pathname.includes('inicio.html')) currentPage = 'dashboard';
    if (window.location.pathname.includes('proyectos.html')) currentPage = 'proyectos';
    if (window.location.pathname.includes('reportes.html')) currentPage = 'reportes';

    if (isAppPage) {
        if (!currentUser) return window.location.href = 'login.html';
        updateUI(currentUser);
        
        if (currentPage) {
            const localCache = localStorage.getItem(`uts_projects_cache_${currentUser.id}`);
            if (localCache) {
                try {
                    const cachedProjects = JSON.parse(localCache);
                    window.currentLoadedProjects = cachedProjects;
                    renderPageData(cachedProjects, currentPage);
                    if(currentPage === 'proyectos') initKanbanControls();
                } catch (e) { console.error("Cache error", e); }
            }
        }
    }

    // --- 2. FIREBASE AUTH LISTENERS ---
    onAuthStateChanged(auth, (user) => {
        if (user && isAppPage) {
            console.log("Sesión activa:", user.email);
            // Refrescar perfil en caché
            getDoc(doc(db, "users", user.uid)).then(snap => {
                if (snap.exists()) {
                    const data = snap.data();
                    const updatedUser = { id: user.uid, name: data.name, career: data.career, email: user.email };
                    localStorage.setItem('uts_user', JSON.stringify(updatedUser));
                    updateUI(updatedUser);
                }
            });
        }
    });

    // --- 3. LOGIN & REGISTER LOGIC ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value.trim();
            try {
                showToast('Iniciando sesión...', 'info');
                const userCred = await signInWithEmailAndPassword(auth, email, password);
                const user = userCred.user;
                
                // Obtener datos extra de Firestore
                const userDoc = await getDoc(doc(db, "users", user.uid));
                const userData = userDoc.exists() ? userDoc.data() : { name: 'Estudiante UTS', career: 'Ingeniería' };

                localStorage.setItem('uts_user', JSON.stringify({
                    id: user.uid, 
                    name: userData.name, 
                    email: user.email, 
                    career: userData.career
                }));
                
                showToast(`¡Bienvenido, ${userData.name}!`, 'success');
                setTimeout(() => window.location.href = 'dashboard.html', 1000);
            } catch (err) {
                console.error(err);
                showToast("Correo o contraseña incorrectos", "error");
            }
        };
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value.trim();
            const email = document.getElementById('reg-email').value.trim().toLowerCase();
            const password = document.getElementById('reg-pass').value.trim();
            const career = document.getElementById('reg-career').value;
            const code = document.getElementById('reg-code')?.value.trim() || '';
            const semester = document.getElementById('reg-semester')?.value || '';
            const journey = document.getElementById('reg-journey')?.value || '';

            try {
                showToast('Creando cuenta...', 'info');
                const userCred = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCred.user;

                // Guardar perfil completo en Firestore
                const profileData = {
                    name, email, career, code, semester, journey,
                    createdAt: new Date().toISOString()
                };
                await setDoc(doc(db, "users", user.uid), profileData);

                localStorage.setItem('uts_user', JSON.stringify({ id: user.uid, ...profileData }));
                showToast('¡Bienvenido, ' + name + '!', 'success');
                setTimeout(() => window.location.href = 'dashboard.html', 1500);
            } catch (err) {
                console.error(err);
                showToast('Error al crear la cuenta. Revisa los datos.', 'error');
            }
        };
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
            e.preventDefault();
            await signOut(auth);
            localStorage.clear();
            window.location.href = 'login.html';
        };
    }

    // --- 4. REAL-TIME DATA (FIRESTORE) ---
    function listenToProjects(userId, page) {
        let lastDataHash = "";
        // Eliminamos orderBy para evitar el error de índice
        const q = query(collection(db, "projects"), where("userId", "==", userId));

        onSnapshot(q, (snapshot) => {
            let projects = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                projects.push({ id: doc.id, ...data });
            });

            // Ordenar en memoria (cliente) para evitar error de índice
            projects.sort((a, b) => {
                const dateA = a.createdAt?.seconds ? a.createdAt.toDate() : new Date(a.createdAt || 0);
                const dateB = b.createdAt?.seconds ? b.createdAt.toDate() : new Date(b.createdAt || 0);
                return dateB - dateA;
            });

            // Anti-parpadeo logic
            const currentHash = JSON.stringify(projects);
            if (currentHash === lastDataHash) return;
            lastDataHash = currentHash;

            window.currentLoadedProjects = projects;
            localStorage.setItem(`uts_projects_cache_${userId}`, JSON.stringify(projects));
            
            renderPageData(projects, page);
        }, (error) => {
            console.error("Firestore Error:", error);
        });
    }

    if (isAppPage && currentUser) {
        listenToProjects(currentUser.id, currentPage);
        if (currentPage === 'proyectos') {
            initProjectCRUD();
            initKanbanControls();
        }
        if (window.location.pathname.includes('configuracion.html')) initSettingsLogic();
    }

    // --- 5. SETTINGS LOGIC ---
    function initSettingsLogic() {
        const configForm = document.getElementById('configForm');
        if (!configForm) return;

        console.log("Inicializando lógica de ajustes para:", currentUser.name);

        // Pre-cargar datos actuales de forma segura
        const safeName = currentUser.name || '';
        const safeCode = currentUser.code || '';
        const safeCareer = currentUser.career || 'Ingeniería de Sistemas';

        if(document.getElementById('confName')) document.getElementById('confName').value = safeName;
        if(document.getElementById('confEmail')) document.getElementById('confEmail').value = currentUser.email || '';
        if(document.getElementById('confCode')) document.getElementById('confCode').value = safeCode;
        if(document.getElementById('confCareer')) document.getElementById('confCareer').value = safeCareer;
        if(document.getElementById('confInitial')) document.getElementById('confInitial').textContent = safeName.charAt(0) || 'U';

        configForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log("Intentando guardar perfil...");

            const updatedData = {
                name: document.getElementById('confName').value.trim(),
                code: document.getElementById('confCode').value.trim(),
                career: document.getElementById('confCareer').value
            };

            try {
                showToast('Guardando cambios...', 'info');
                // Usamos setDoc con merge:true para que cree el documento si no existe
                await setDoc(doc(db, "users", currentUser.id), updatedData, { merge: true });
                
                // Actualizar caché local y variable global
                const newUserData = { ...currentUser, ...updatedData };
                localStorage.setItem('uts_user', JSON.stringify(newUserData));
                
                // IMPORTANTE: Actualizar el objeto currentUser que usa el resto de la app
                Object.assign(currentUser, newUserData);
                
                updateUI(newUserData);
                if(document.getElementById('confInitial')) document.getElementById('confInitial').textContent = updatedData.name.charAt(0);
                
                showToast('Perfil actualizado con éxito', 'success');
                console.log("Perfil guardado correctamente en Firebase.");
            } catch (err) {
                console.error("Error al guardar en Firebase:", err);
                showToast('Error al conectar con Firebase', 'error');
            }
        });
    }

    // --- 6. RENDER ENGINE ---
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
                <td><span class="category-pill">${p.category}</span></td>
                <td>${p.date}</td>
                <td><span class="status-badge status-${p.status || 'pending'}">${(p.status||'pending').toUpperCase()}</span></td>
                <td style="text-align:center;">
                    <button onclick="editProject('${p.id}')" class="btn-icon edit"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteProject('${p.id}')" class="btn-icon delete"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `).join('');
    }

    // --- 6. PROJECT CRUD (FIRESTORE) ---
    function initProjectCRUD() {
        const modal = document.getElementById('projectModal');
        const openBtn = document.getElementById('openModalBtn');
        const closeBtn = document.getElementById('closeModal');
        const projectForm = document.getElementById('projectForm');

        if(openBtn) openBtn.onclick = () => { projectForm.reset(); document.getElementById('projectId').value = ''; modal.style.display = 'flex'; };
        if(closeBtn) closeBtn.onclick = () => modal.style.display = 'none';

        projectForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('projectId').value;
            const projectData = {
                userId: currentUser.id,
                name: document.getElementById('projName').value,
                category: document.getElementById('projCategory').value,
                tutor: document.getElementById('projTutor').value,
                status: document.getElementById('projStatus').value,
                priority: document.getElementById('projPriority').value,
                date: document.getElementById('projDueDate').value,
                description: document.getElementById('projDesc').value,
                createdAt: serverTimestamp()
            };
            try {
                if (id) await updateDoc(doc(db, "projects", id), projectData);
                else await addDoc(collection(db, "projects"), projectData);
                modal.style.display = 'none';
                showToast(id ? 'Actualizado' : 'Creado', 'success');
            } catch(e) { console.error(e); showToast('Error al guardar', 'error'); }
        };
    }

    window.editProject = (id) => {
        const p = window.currentLoadedProjects.find(x => x.id === id);
        if(p) {
            document.getElementById('projectId').value = id;
            document.getElementById('projName').value = p.name;
            document.getElementById('projCategory').value = p.category;
            document.getElementById('projTutor').value = p.tutor;
            document.getElementById('projStatus').value = p.status;
            document.getElementById('projPriority').value = p.priority;
            document.getElementById('projDueDate').value = p.date;
            document.getElementById('projDesc').value = p.description;
            document.getElementById('projectModal').style.display = 'flex';
        }
    };

    window.deleteProject = async (id) => {
        if(confirm("¿Eliminar proyecto?")) {
            await deleteDoc(doc(db, "projects", id));
            showToast('Eliminado', 'success');
        }
    };

    // UI Helpers (Stats, etc)
    function updateStatsFromProjects(projects) {
        const completed = projects.filter(p => p.status === 'done').length;
        const pending = TOTAL_REQUIRED_PROJECTS - completed;
        if(document.getElementById('statCompleted')) document.getElementById('statCompleted').textContent = completed;
        if(document.getElementById('statPending')) document.getElementById('statPending').textContent = pending;
        if(document.getElementById('welcomePendingCount')) document.getElementById('welcomePendingCount').textContent = pending;
    }

    function updateUI(user) {
        const els = { 'userName': user.name, 'welcomeName': user.name.split(' ')[0], 'userCareer': user.career, 'userInitial': user.name.charAt(0) };
        for (let id in els) {
            let el = document.getElementById(id);
            if(el) el.textContent = els[id];
        }
    }

    // --- KANBAN BOARD ---
    function initKanbanControls() {
        const btnList = document.getElementById('btnViewList');
        const btnKanban = document.getElementById('btnViewKanban');
        const viewList = document.getElementById('listViewContainer');
        const viewKanban = document.getElementById('kanbanViewContainer');
        if(btnList && btnKanban) {
            btnList.onclick = () => {
                btnList.classList.add('active'); btnKanban.classList.remove('active');
                viewList.style.display = 'block'; viewKanban.style.display = 'none';
            };
            btnKanban.onclick = () => {
                btnKanban.classList.add('active'); btnList.classList.remove('active');
                viewKanban.style.display = 'flex'; viewList.style.display = 'none';
            };
        }
    }

    function renderKanbanBoard(projects) {
        const cols = { 'pending': '', 'in-progress': '', 'review': '', 'done': '' };
        const counts = { 'pending': 0, 'in-progress': 0, 'review': 0, 'done': 0 };

        projects.forEach(p => {
            const s = p.status || 'pending';
            if(cols[s] !== undefined) {
                counts[s]++;
                cols[s] += `
                    <div class="kanban-card" data-id="${p.id}">
                        <h4>${p.name}</h4>
                        <p>${p.category}</p>
                        <div class="kanban-card-meta">
                            <span class="priority">${p.priority || 'Media'}</span>
                            <span style="color: var(--uts-text-muted);"><i class="fas fa-clock"></i> ${p.date?.substring(5) || ''}</span>
                        </div>
                    </div>
                `;
            }
        });

        ['pending', 'in-progress', 'review', 'done'].forEach(s => {
            const container = document.getElementById(`kanban-${s}`);
            const countEl = document.getElementById(`count-${s}`);
            if(container) {
                container.innerHTML = cols[s];
                if(countEl) countEl.textContent = counts[s];
            }
        });
    }

    // --- DASHBOARD EXTRAS ---
    function renderChart(projects) {
        const ctx = document.getElementById('productivityChart');
        if (!ctx || !window.Chart) return;
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const data = new Array(12).fill(0);
        projects.forEach(p => {
            if(p.createdAt) {
                const date = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt);
                data[date.getMonth()]++;
            }
        });
        if (window.myProductivityChart) window.myProductivityChart.destroy();
        window.myProductivityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Proyectos',
                    data: data,
                    borderColor: '#008D3E',
                    backgroundColor: 'rgba(0, 141, 62, 0.1)',
                    borderWidth: 3, tension: 0.4, fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    function checkBadges(projects) {
        const container = document.getElementById('badgesContainer');
        if (!container) return;
        const doneCount = projects.filter(p => p.status === 'done').length;
        let badgesHTML = '';
        if (projects.length > 0) badgesHTML += `<div class="badge-icon" title="Iniciador"><i class="fas fa-seedling"></i></div>`;
        if (doneCount >= 5) badgesHTML += `<div class="badge-icon" title="Experto"><i class="fas fa-star"></i></div>`;
        container.innerHTML = badgesHTML || '<span style="font-size:12px; color:var(--uts-text-muted);">Sin insignias aún</span>';
    }

    function initPDFGenerator(projects) {
        const btn = document.getElementById('btnGeneratePDF');
        if (!btn) return;
        btn.onclick = () => {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            doc.text("Reporte de Proyectos - UTS", 14, 20);
            const tableData = projects.map((p, i) => [i + 1, p.name, p.category, p.status]);
            doc.autoTable({ startY: 30, head: [['#', 'Nombre', 'Categoría', 'Estado']], body: tableData });
            doc.save(`Reporte_${currentUser.name}.pdf`);
        };
    }
});

function toggleDarkMode(isDark) {
    document.body.classList.toggle('dark-theme', isDark);
    localStorage.setItem('uts_theme', isDark ? 'dark' : 'light');
}

function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i> ${msg}`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.classList.add('reveal'); }, 10);
    setTimeout(() => { toast.classList.remove('reveal'); setTimeout(() => toast.remove(), 500); }, 3000);
}
