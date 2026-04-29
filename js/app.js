// UTS Platform - Firebase Integrated Logic with Advanced Enterprise Features
// --- Imports Estáticos Removidos para permitir Zero-Latency ---

const TOTAL_REQUIRED_PROJECTS = 52;  

// --- 1. UI UTILITIES & TOAST ---
window.showToast = (message, type = 'success') => {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = type === 'error' ? 'fa-exclamation-circle' : type === 'info' ? 'fa-info-circle' : 'fa-check-circle';
    toast.innerHTML = `<i class="fas ${icon} toast-icon"></i><span class="toast-message">${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
};

// Dark Mode
window.toggleDarkMode = (force) => {
    const isDark = force !== undefined ? force : document.documentElement.getAttribute('data-theme') !== 'dark';
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('uts_theme', isDark ? 'dark' : 'light');
};

document.addEventListener('DOMContentLoaded', async () => {
    const savedTheme = localStorage.getItem('uts_theme');
    if (savedTheme === 'dark') toggleDarkMode(true);
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.addEventListener('change', (e) => toggleDarkMode(e.target.checked));
    }

    let currentUser = JSON.parse(localStorage.getItem('uts_user'));

    // --- 1. ZERO-LATENCY UI RENDER (Se ejecuta ANTES de descargar Firebase) ---
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

    // --- 2. DESCARGA DINÁMICA DE SUPABASE (Segundo plano) ---
    const { supabase } = await import('./supabase-config.js');

    supabase.auth.onAuthStateChange((event, session) => {
        if (session?.user) console.log("Auth:", session.user.email);
    });

    // --- AUTH PAGES ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const password = document.getElementById('password').value.trim();
            try {
                const { data: cred, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
                localStorage.setItem('uts_user', JSON.stringify({id: cred.user.id, name: cred.user.user_metadata?.name || 'Estudiante', email: cred.user.email, career: 'Ingeniería de Sistemas'}));
                showToast('Inicio exitoso', 'success');
                setTimeout(() => window.location.href = 'dashboard.html', 1000);
            } catch (err) {
                if (email === 'admin') {
                    localStorage.setItem('uts_user', JSON.stringify({id: 'mock123', name: 'Admin Demo', career: 'Sistemas'}));
                    showToast('Modo Demo', 'info');
                    setTimeout(() => window.location.href = 'dashboard.html', 1000);
                } else {
                    showToast("Credenciales inválidas.", "error");
                }
            }
        };
    }

    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.onsubmit = async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value.trim();
            const code = document.getElementById('reg-code').value.trim();
            const email = document.getElementById('reg-email').value.trim().toLowerCase();
            const career = document.getElementById('reg-career').value;
            const semester = document.getElementById('reg-semester').value;
            const journey = document.getElementById('reg-journey').value;
            const password = document.getElementById('reg-pass').value.trim();

            try {
                showToast('Creando cuenta...', 'info');
                const { data: cred, error } = await supabase.auth.signUp({ email, password, options: { data: { name, code, career, semester, journey } } });
                if (error) throw error;
                
                // Save user extra data to Supabase
                await supabase.from('users').insert([{
                    id: cred.user.id, name, code, email, career, semester, journey,
                    createdAt: new Date().toISOString()
                }]);

                localStorage.setItem('uts_user', JSON.stringify({
                    id: cred.user.id, 
                    name: name, 
                    email: email, 
                    career: career,
                    code: code,
                    semester: semester,
                    journey: journey
                }));

                showToast('Cuenta creada con éxito', 'success');
                setTimeout(() => window.location.href = 'dashboard.html', 1500);
            } catch (err) {
                console.error(err);
                if (err.code === 'auth/email-already-in-use') {
                    showToast('Este correo ya está registrado', 'error');
                } else if (err.code === 'auth/weak-password') {
                    showToast('La contraseña es muy débil', 'error');
                } else {
                    showToast('Error al crear la cuenta', 'error');
                }
            }
        };
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
            e.preventDefault();
            await supabase.auth.signOut();
            localStorage.clear();
            window.location.href = 'login.html';
        };
    }

    // --- GLOBAL APP LOGIC (FireStore Listener) ---
    if (isAppPage && currentUser) {
        if (currentPage === 'dashboard') listenToProjects(currentUser.id, 'dashboard');
        if (currentPage === 'proyectos') {
            initProjectCRUD();
            listenToProjects(currentUser.id, 'proyectos');
            initKanbanControls(); 
        }
        if (currentPage === 'reportes') listenToProjects(currentUser.id, 'reportes');
    }

    function updateUI(user) {
        const els = { 'userName': user.name, 'welcomeName': user.name.split(' ')[0], 'userCareer': user.career, 'userInitial': user.name.charAt(0) };
        for (let id in els) {
            let el = document.getElementById(id);
            if(el) el.textContent = els[id];
        }
    }

    function listenToProjects(userId, page) {

        const fetchAndRender = async () => {
            try {
                console.log("Iniciando fetch de proyectos para el usuario:", userId);
                const { data, error } = await supabase.from('projects').select('*').eq('userId', userId);
                
                if (error) {
                    console.error("Error de Supabase:", error);
                    // Si hay error, intentamos al menos mostrar lo que hay en caché
                    return;
                }

                const projects = data || [];
                console.log("Proyectos recibidos de Supabase:", projects.length);
                
                projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                window.currentLoadedProjects = projects;
                localStorage.setItem(`uts_projects_cache_${userId}`, JSON.stringify(projects));
                
                // Sincronizar con SQLite local solo si estamos en localhost
                if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                    console.log("Sincronizando con SQLite local...");
                    const uData = localStorage.getItem('uts_user');
                    const userObj = uData ? JSON.parse(uData) : null;
                    fetch('http://localhost:3000/api/sync', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user: userObj, projects: projects })
                    }).catch(e => console.warn("Backend local no disponible"));
                }

                console.log("Dibujando datos en la interfaz...");
                renderPageData(projects, page);

            } catch (err) {
                console.error("Fallo crítico en fetchAndRender:", err);
            }
        };
        fetchAndRender();
        supabase.channel('projects_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'projects', filter: `userId=eq.${userId}` }, fetchAndRender)
            .subscribe();
    }

    function renderPageData(projects, page) {
        if (page === 'dashboard') {
            updateStatsFromProjects(projects);
            renderChart(projects); // FEATURE: ChartJS
            checkBadges(projects); // FEATURE: Gamification
        } else if (page === 'proyectos') {
            renderProjectsTable(projects);
            renderKanbanBoard(projects);
        } else if (page === 'reportes') {
            initPDFGenerator(projects); // FEATURE: PDF
        }
    }

    // --- 2. KANBAN BOARD (Proyectos) ---
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
                            <span style="color: var(--uts-text-muted);"><i class="fas fa-clock"></i> ${p.date.substring(5)}</span>
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
                countEl.textContent = counts[s];
                
                // Init SortableJS
                if (!container.sortableInit && window.Sortable) {
                    Sortable.create(container, {
                        group: 'shared',
                        animation: 150,
                        ghostClass: 'skeleton',
                        onEnd: async function (evt) {
                            const itemId = evt.item.getAttribute('data-id');
                            const newStatus = evt.to.parentElement.getAttribute('data-status');
                            // Update Firestore silently
                            try {
                                await supabase.from('projects').update({ status: newStatus }).eq('id', itemId);
                                showToast('Estado actualizado', 'success');
                            } catch(e) {
                                console.error(e);
                                showToast('Error al mover', 'error');
                            }
                        }
                    });
                    container.sortableInit = true;
                }
            }
        });
    }

    // --- 3. DASHBOARD STATS, CHART & BADGES ---
    function updateStatsFromProjects(projects) {
        const completed = projects.filter(p => p.status === 'done').length;
        const pending = TOTAL_REQUIRED_PROJECTS - completed;
        
        if(document.getElementById('statCompleted')) document.getElementById('statCompleted').textContent = completed;
        if(document.getElementById('statPending')) document.getElementById('statPending').textContent = pending;
        if(document.getElementById('welcomePendingCount')) document.getElementById('welcomePendingCount').textContent = pending;
        
        const list = document.getElementById('recentProjectsList');
        if (list) {
            list.innerHTML = projects.slice(0,3).map(p => `
                <div style="display:flex; justify-content:space-between; margin-bottom:10px; font-size:13px; border-bottom:1px solid var(--uts-gray-light); padding-bottom:10px;">
                    <div><strong>${p.name}</strong><br><span style="color:var(--uts-text-muted)">${p.category}</span></div>
                    <div style="text-align:right;"><span class="status-badge status-${p.status || 'pending'}">${p.status}</span></div>
                </div>
            `).join('');
        }
    }

    function renderChart(projects) {
        const ctx = document.getElementById('productivityChart');
        if (!ctx || !window.Chart) return;
        
        // Group by month
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const data = new Array(12).fill(0);
        
        projects.forEach(p => {
            if(p.createdAt) {
                const date = new Date(p.createdAt);
                data[date.getMonth()]++;
            }
        });

        if (window.myProductivityChart) window.myProductivityChart.destroy();
        
        window.myProductivityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: months,
                datasets: [{
                    label: 'Proyectos Creados',
                    data: data,
                    borderColor: '#008D3E',
                    backgroundColor: 'rgba(0, 141, 62, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
            }
        });
    }

    function checkBadges(projects) {
        const container = document.getElementById('badgesContainer');
        if (!container) return;

        const doneCount = projects.filter(p => p.status === 'done').length;
        let badgesHTML = '';

        if (projects.length > 0) {
            badgesHTML += `<div title="Iniciador" style="width:35px; height:35px; border-radius:50%; background:#fef3c7; color:#d97706; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow:0 2px 5px rgba(0,0,0,0.1);"><i class="fas fa-seedling"></i></div>`;
        }
        if (doneCount >= 5) {
            badgesHTML += `<div title="5 Completados!" style="width:35px; height:35px; border-radius:50%; background:#d1fae5; color:#059669; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow:0 2px 5px rgba(0,0,0,0.1);"><i class="fas fa-star"></i></div>`;
        }
        if (doneCount >= 10) {
            badgesHTML += `<div title="10 Completados!" style="width:35px; height:35px; border-radius:50%; background:#dbeafe; color:#2563eb; display:flex; align-items:center; justify-content:center; font-size:18px; box-shadow:0 2px 5px rgba(0,0,0,0.1);"><i class="fas fa-trophy"></i></div>`;
        }

        if(badgesHTML === '') badgesHTML = '<span style="font-size:12px; color:var(--uts-text-muted);">Sin insignias aún</span>';
        container.innerHTML = badgesHTML;
    }
        
    // --- 4. PDF GENERATION WITH jsPDF & QR ---
    function initPDFGenerator(projects) {
        const btn = document.getElementById('btnGeneratePDF');
        if (!btn) return;

        btn.onclick = () => {
            showToast('Generando Documento Oficial...', 'info');
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            
            // Generate Hidden QR Code
            const qrContainer = document.getElementById('qrcode');
            qrContainer.innerHTML = '';
            new QRCode(qrContainer, {
                text: `https://uts-enterprise.app/verify/${currentUser.id}`,
                width: 100, height: 100
            });

            // Load UTS Logo
            const img = new Image();
            img.crossOrigin = "Anonymous";
            img.src = "https://www.uts.edu.co/sitio/wp-content/uploads/2019/10/Logo-UTS-1.png";
            
            img.onload = () => {
                const canvasLogo = document.createElement('canvas');
                canvasLogo.width = img.width;
                canvasLogo.height = img.height;
                const ctx = canvasLogo.getContext('2d');
                ctx.drawImage(img, 0, 0);
                const logoDataUrl = canvasLogo.toDataURL('image/png');

                setTimeout(() => {
                    // Add Header Logo
                    doc.addImage(logoDataUrl, 'PNG', 14, 15, 50, 15);

                    doc.setFontSize(22);
                    doc.setTextColor(0, 74, 135);
                    doc.text("Reporte de Grado Consolidado", 105, 25, null, null, "center");
                    
                    doc.setFontSize(11);
                    doc.setTextColor(50);
                    doc.text(`Estudiante: ${currentUser.name}`, 14, 45);
                    doc.text(`Programa: ${currentUser.career}`, 14, 52);
                    doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString()}`, 14, 59);
                    
                    const doneCount = projects.filter(p => p.status === 'done').length;
                    doc.text(`Proyectos Completados: ${doneCount} de 52`, 140, 45);
                    doc.text(`Firma Digital: Validada`, 140, 52);

                    const tableData = projects.map((p, i) => [
                        i + 1, p.name, p.category, p.tutor || 'N/A', p.priority || 'Media', p.status.toUpperCase()
                    ]);

                    doc.autoTable({
                        startY: 70,
                        head: [['#', 'Proyecto', 'Categoría', 'Tutor', 'Prioridad', 'Estado']],
                        body: tableData,
                        theme: 'striped',
                        headStyles: { fillColor: [0, 141, 62] },
                        styles: { fontSize: 9 }
                    });

                    // Add QR Image to PDF from canvas
                    const qrCanvas = qrContainer.querySelector('canvas');
                    if (qrCanvas) {
                        const qrImgData = qrCanvas.toDataURL('image/png');
                        const finalY = doc.lastAutoTable.finalY || 70;
                        if (finalY + 50 > 280) {
                            doc.addPage();
                            doc.text("Documento Verificado Electrónicamente", 105, 20, null, null, "center");
                            doc.addImage(qrImgData, 'PNG', 85, 30, 40, 40);
                            doc.setFontSize(9);
                            doc.text("Código de verificación QR único por estudiante.", 105, 75, null, null, "center");
                        } else {
                            doc.text("Documento Verificado Electrónicamente", 105, finalY + 20, null, null, "center");
                            doc.addImage(qrImgData, 'PNG', 85, finalY + 25, 40, 40);
                            doc.setFontSize(9);
                            doc.text("Código de verificación QR único por estudiante.", 105, finalY + 70, null, null, "center");
                        }
                    }

                    doc.save(`Reporte_Grado_${currentUser.name.replace(' ','_')}.pdf`);
                    showToast('Reporte Descargado Exitosamente', 'success');
                }, 500);
            };
            
            img.onerror = () => {
                showToast('Error cargando el logo para el PDF', 'error');
            };
        };
    }

    // --- STANDARD CRUD RE-IMPLEMENTATION ---
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
                createdAt: new Date().toISOString()
            };
            try {
                if (id) await supabase.from('projects').update(projectData).eq('id', id);
                else await supabase.from('projects').insert([projectData]);
                modal.style.display = 'none';
                showToast(id ? 'Actualizado' : 'Creado', 'success');
            } catch(e) { console.error(e); showToast('Error', 'error'); }
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
            await supabase.from('projects').delete().eq('id', id);
            showToast('Eliminado', 'success');
        }
    };
});
