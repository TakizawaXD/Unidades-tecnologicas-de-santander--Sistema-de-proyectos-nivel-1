// UTS Platform - Firebase Integrated Logic
import { db, auth } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "firebase/auth";
import { 
    collection, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    onSnapshot, 
    query, 
    where, 
    orderBy 
} from "firebase/firestore";

document.addEventListener('DOMContentLoaded', () => {
    let currentUser = JSON.parse(localStorage.getItem('uts_user'));

    // --- AUTH OBSERVER ---
    onAuthStateChanged(auth, (user) => {
        if (user) {
            console.log("Firebase Auth: Usuario autenticado", user.email);
        } else {
            // Solo mostrar mensaje si no hay una sesión demo activa
            if (!localStorage.getItem('uts_user')) {
                console.log("Firebase Auth: No hay usuario autenticado en la nube.");
            }
        }
    });

    // --- MOBILE MENU ---
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.querySelector('.sidebar');
    if (mobileMenuBtn) {
        mobileMenuBtn.onclick = () => sidebar.classList.toggle('open');
    }

    // --- LOGIN PAGE LOGIC ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // ADMIN DEMO BYPASS
            if ((email === 'admin' || email === 'admin@uts.edu.co') && password === 'admin123') {
                const mockAdmin = { id: 'admin123_demo', name: 'Administrador UTS', career: 'Modo Prueba' };
                localStorage.setItem('uts_user', JSON.stringify(mockAdmin));
                window.location.href = 'dashboard.html';
                return;
            }

            setLoading(true);
            try {
                const userCredential = await signInWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                const userData = {
                    id: user.uid,
                    name: user.displayName || 'Estudiante UTS',
                    email: user.email,
                    career: 'Ingeniería de Sistemas'
                };
                
                localStorage.setItem('uts_user', JSON.stringify(userData));
                window.location.href = 'dashboard.html';
            } catch (err) {
                console.error("Firebase Login Error:", err.code);
                // Fallback for Demo (Keep existing)
                if (email.includes('uts.edu.co')) {
                    const mockUser = { id: 'mock123', name: 'Estudiante UTS', career: 'Ingeniería de Sistemas' };
                    localStorage.setItem('uts_user', JSON.stringify(mockUser));
                    window.location.href = 'dashboard.html';
                } else {
                    alert("Error de autenticación: Verifica usuario y contraseña.");
                }
            } finally {
                setLoading(false);
            }
        };
    }

    // --- LOGOUT ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.onclick = async (e) => {
            e.preventDefault();
            await signOut(auth);
            localStorage.clear();
            window.location.href = 'login.html';
        };
    }

    // --- DASHBOARD PAGES CORE ---
    const isDashboardPage = ['dashboard.html', 'inicio.html', 'proyectos.html', 'cursos.html', 'reportes.html', 'configuracion.html']
        .some(page => window.location.pathname.includes(page) || window.location.pathname.endsWith('/'));

    if (isDashboardPage) {
        if (!currentUser) {
            window.location.href = 'login.html';
            return;
        }

        updateUI(currentUser);
        
        // Both dashboard.html and proyectos.html need to listen to projects for stats/activity
        if (window.location.pathname.includes('dashboard.html') || window.location.pathname.endsWith('/')) {
            listenToProjects(currentUser.id);
        }
        
        if (window.location.pathname.includes('proyectos.html')) {
            initProjectCRUD();
            listenToProjects(currentUser.id);
        }
        
        if (window.location.pathname.includes('configuracion.html')) {
            initConfigPage(currentUser);
        }
    }

    function initConfigPage(user) {
        const confName = document.getElementById('confName');
        const confEmail = document.getElementById('confEmail');
        const configForm = document.getElementById('configForm');

        if (confName) confName.value = user.name || '';
        if (confEmail) confEmail.value = user.email || user.id || 'admin@uts.edu.co';

        if (configForm) {
            configForm.onsubmit = (e) => {
                e.preventDefault();
                const newName = confName.value.trim();
                
                if (newName) {
                    // Update current user object
                    user.name = newName;
                    
                    // Save to local storage to persist across reloads
                    localStorage.setItem('uts_user', JSON.stringify(user));
                    
                    // Update the UI immediately
                    updateUI(user);
                    
                    alert('Preferencias guardadas exitosamente.');
                }
            };
        }
    }

    function updateUI(user) {
        setText('userName', user.name);
        setText('welcomeUser', `Hola, ${user.name.split(' ')[0]}`);
        setText('userCareer', user.career);
        const initialEl = document.getElementById('userInitial');
        if (initialEl) initialEl.textContent = user.name.charAt(0);
    }

    // --- FIRESTORE REAL-TIME PROJECTS ---
    function listenToProjects(userId) {
        // Simplificamos la consulta para evitar el error de índice (Index Error)
        // Eliminamos el orderBy de la consulta y ordenamos en JavaScript
        const q = query(
            collection(db, "projects"), 
            where("userId", "==", userId)
        );

        onSnapshot(q, (snapshot) => {
            const projects = [];
            snapshot.forEach((doc) => {
                projects.push({ id: doc.id, ...doc.data() });
            });
            
            // Ordenamos manualmente por fecha descendente
            projects.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Guardamos globalmente para que las modales puedan acceder a los datos
            window.currentLoadedProjects = projects;
            
            renderProjectsTable(projects);
            updateStatsFromProjects(projects);
        }, (error) => {
            console.warn("Firestore listener failed (likely missing index or permissions):", error);
            // Fallback to local storage if firestore fails
            renderProjectsTable(getLocalProjects(userId));
        });
    }

    function renderProjectsTable(projects) {
        const tableBody = document.getElementById('projectsTableBody');
        if (!tableBody) return;

        if (projects.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 40px;">No hay proyectos registrados.</td></tr>';
            return;
        }

        tableBody.innerHTML = projects.map(p => `
            <tr style="animation: fadeIn 0.5s ease forwards;">
                <td><strong>${p.name}</strong></td>
                <td><span class="category-pill">${p.category}</span></td>
                <td>${p.date}</td>
                <td><span class="status-badge status-${p.status || 'pending'}">${(p.status || 'pending').toUpperCase()}</span></td>
                <td>
                    <div class="action-buttons">
                        <button onclick="editProject('${p.id}')" class="btn-icon edit"><i class="fas fa-edit"></i></button>
                        <button onclick="deleteProject('${p.id}')" class="btn-icon delete"><i class="fas fa-trash"></i></button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    // --- CRUD OPS ---
    async function initProjectCRUD() {
        const modal = document.getElementById('projectModal');
        const openBtn = document.getElementById('openModalBtn');
        const closeBtn = document.getElementById('closeModal');
        const projectForm = document.getElementById('projectForm');

        if (openBtn) openBtn.onclick = () => {
            document.getElementById('modalTitle').textContent = 'Nuevo Proyecto';
            projectForm.reset();
            document.getElementById('projectId').value = '';
            modal.style.display = 'flex';
        };

        if (closeBtn) closeBtn.onclick = () => modal.style.display = 'none';

        projectForm.onsubmit = async (e) => {
            e.preventDefault();
            const id = document.getElementById('projectId').value;
            const projectData = {
                userId: currentUser.id,
                name: document.getElementById('projName').value,
                category: document.getElementById('projCategory').value,
                tutor: document.getElementById('projTutor') ? document.getElementById('projTutor').value : '',
                status: document.getElementById('projStatus') ? document.getElementById('projStatus').value : 'pending',
                priority: document.getElementById('projPriority') ? document.getElementById('projPriority').value : 'Media',
                hours: document.getElementById('projHours') ? parseInt(document.getElementById('projHours').value) : 0,
                date: document.getElementById('projDueDate').value,
                description: document.getElementById('projDesc').value,
                createdAt: new Date().toISOString()
            };

            try {
                if (id) {
                    await updateDoc(doc(db, "projects", id), projectData);
                } else {
                    await addDoc(collection(db, "projects"), projectData);
                }
                modal.style.display = 'none';
            } catch (err) {
                console.error("Firestore Save Error:", err);
                // Local Fallback
                saveLocalProject(projectData, id);
                modal.style.display = 'none';
                renderProjectsTable(getLocalProjects(currentUser.id));
            }
        };
    }

    window.editProject = async (id) => {
        // Obtenemos los proyectos cargados (en un entorno real se buscaría en Firestore si no está en memoria)
        const projects = window.currentLoadedProjects || getLocalProjects(currentUser.id); 
        const p = projects.find(proj => proj.id == id);
        if (p) {
            document.getElementById('modalTitle').textContent = 'Editar Proyecto';
            document.getElementById('projectId').value = id;
            document.getElementById('projName').value = p.name;
            document.getElementById('projCategory').value = p.category;
            
            if(document.getElementById('projTutor')) document.getElementById('projTutor').value = p.tutor || '';
            if(document.getElementById('projStatus')) document.getElementById('projStatus').value = p.status || 'pending';
            if(document.getElementById('projPriority')) document.getElementById('projPriority').value = p.priority || 'Media';
            if(document.getElementById('projHours')) document.getElementById('projHours').value = p.hours || '';
            
            document.getElementById('projDueDate').value = p.date;
            document.getElementById('projDesc').value = p.description || '';
            document.getElementById('projectModal').style.display = 'flex';
        }
    };

    window.deleteProject = async (id) => {
        if (confirm('¿Eliminar proyecto?')) {
            try {
                await deleteDoc(doc(db, "projects", id));
            } catch (err) {
                console.error("Delete error:", err);
                // Local delete fallback
            }
        }
    };

    // --- UTILS ---
    function setText(id, text) {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    }

    function setLoading(isLoading) {
        const btn = document.querySelector('.btn-uts');
        if (btn) {
            btn.disabled = isLoading;
            btn.innerHTML = isLoading ? '<i class="fas fa-spinner fa-spin"></i>' : 'Entrar';
        }
    }

    function loadStats(userId) {
        const projects = getLocalProjects(userId);
        updateStatsFromProjects(projects);
    }

    function updateStatsFromProjects(projects) {
        const completed = projects.filter(p => p.status === 'done').length;
        const total = 52;
        const pct = ((completed / total) * 100).toFixed(1);
        
        setText('statCompleted', completed);
        setText('statPending', total - completed);
        
        // Circular Progress Update
        const circle = document.getElementById('progressCircle');
        if (circle) {
            circle.style.strokeDasharray = `${pct}, 100`;
        }
        setText('progressPctText', `${pct}%`);
        
        const bar = document.getElementById('progressBar');
        if (bar) bar.style.width = `${pct}%`;

        // Render Recent Activity on Dashboard
        renderRecentDashboardList(projects.slice(0, 4));
    }

    function renderRecentDashboardList(projects) {
        const list = document.getElementById('recentProjectsList');
        if (!list) return;

        if (projects.length === 0) {
            list.innerHTML = '<p class="loading-text">No hay actividad reciente.</p>';
            return;
        }

        list.innerHTML = projects.map(p => {
            const statusClass = p.status === 'done' ? 'green' : (p.status === 'in-progress' ? 'blue' : 'yellow');
            const statusText = p.status === 'done' ? 'Completado' : (p.status === 'in-progress' ? 'En Progreso' : 'Pendiente');
            
            return `
            <div class="bento-list-item" style="cursor: pointer;" onclick="viewProjectDetails('${p.id}')">
                <div class="status-dot ${p.status === 'done' ? 'done' : 'pending'}"></div>
                <div class="bento-list-content">
                    <h4>${p.name}</h4>
                    <p>${p.category} | Prioridad: ${p.priority || 'Media'}</p>
                </div>
                <div class="bento-list-date">${p.date}</div>
            </div>
            `;
        }).join('');
    }

    // Dynamic Modal for Viewing Project Details
    window.viewProjectDetails = (id) => {
        const projects = window.currentLoadedProjects || getLocalProjects(currentUser.id);
        const p = projects.find(proj => proj.id === id);
        
        if (!p) return;

        // Create modal if it doesn't exist
        let modal = document.getElementById('detailsModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'detailsModal';
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-card" style="max-width: 500px;">
                    <div class="modal-header">
                        <h2 id="detTitle" style="font-size: 20px;">Detalles</h2>
                        <button onclick="document.getElementById('detailsModal').style.display='none'" class="close-btn">&times;</button>
                    </div>
                    <div class="project-details-body">
                        <p><strong>Categoría:</strong> <span id="detCat"></span></p>
                        <p><strong>Estado:</strong> <span id="detStatus"></span></p>
                        <p><strong>Tutor:</strong> <span id="detTutor"></span></p>
                        <p><strong>Prioridad:</strong> <span id="detPrio"></span></p>
                        <p><strong>Horas:</strong> <span id="detHours"></span> hrs</p>
                        <p><strong>Entrega:</strong> <span id="detDate"></span></p>
                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;">
                        <p><strong>Descripción:</strong></p>
                        <p id="detDesc" style="color: #64748b; font-size: 14px; line-height: 1.6;"></p>
                    </div>
                    <div class="modal-footer">
                        <button onclick="document.getElementById('detailsModal').style.display='none'" class="btn-primary-glow" style="width: 100%;">Cerrar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }

        // Map status to readable text
        const statusMap = {
            'pending': 'Pendiente',
            'in-progress': 'En Progreso',
            'review': 'En Revisión',
            'done': 'Completado'
        };

        // Populate Data
        document.getElementById('detTitle').textContent = p.name;
        document.getElementById('detCat').textContent = p.category;
        document.getElementById('detStatus').innerHTML = `<span class="status-badge status-${p.status || 'pending'}">${statusMap[p.status || 'pending'].toUpperCase()}</span>`;
        document.getElementById('detTutor').textContent = p.tutor || 'No asignado';
        document.getElementById('detPrio').textContent = p.priority || 'Media';
        document.getElementById('detHours').textContent = p.hours || 'No estimado';
        document.getElementById('detDate').textContent = p.date;
        document.getElementById('detDesc').textContent = p.description || 'Sin descripción detallada.';

        modal.style.display = 'flex';
    };

    function getLocalProjects(userId) {
        return JSON.parse(localStorage.getItem(`uts_projects_${userId}`)) || [];
    }

    function saveLocalProject(data, id) {
        let projects = getLocalProjects(currentUser.id);
        if (id) {
            const idx = projects.findIndex(p => p.id == id);
            if (idx > -1) projects[idx] = data;
        } else {
            data.id = 'local_' + Date.now();
            projects.unshift(data);
        }
        localStorage.setItem(`uts_projects_${currentUser.id}`, JSON.stringify(projects));
    }

    function initHeroCarousel() {
        const slides = document.querySelectorAll('.hero-slide');
        if (!slides.length) return;
        let current = 0;
        setInterval(() => {
            slides[current].classList.remove('active');
            current = (current + 1) % slides.length;
            slides[current].classList.add('active');
        }, 5000);
    }
});
