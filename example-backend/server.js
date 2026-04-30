const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Servir archivos estáticos del frontend desde la raíz del proyecto
app.use(express.static(path.join(__dirname, '..')));

// ───────────────────────────── DATABASE SETUP ─────────────────────────────
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) { console.error('Error abriendo base de datos', err); return; }
    console.log('✅ Conectado a SQLite.');

    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id         TEXT PRIMARY KEY,
            name       TEXT NOT NULL,
            email      TEXT UNIQUE NOT NULL,
            password   TEXT NOT NULL,
            code       TEXT,
            career     TEXT,
            semester   TEXT,
            journey    TEXT,
            createdAt  TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS projects (
            id          TEXT PRIMARY KEY,
            userId      TEXT NOT NULL,
            name        TEXT NOT NULL,
            category    TEXT,
            tutor       TEXT,
            status      TEXT DEFAULT 'pending',
            priority    TEXT DEFAULT 'Media',
            date        TEXT,
            description TEXT,
            createdAt   TEXT,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS sessions (
            token      TEXT PRIMARY KEY,
            userId     TEXT NOT NULL,
            createdAt  TEXT,
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS courses (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            description TEXT,
            category    TEXT,
            level       TEXT DEFAULT 'Intermedio',
            hours       INTEGER DEFAULT 0,
            instructor  TEXT,
            badge       TEXT,
            color       TEXT DEFAULT '#004A87',
            icon        TEXT DEFAULT 'fa-book',
            prerequisites TEXT DEFAULT '',
            syllabus    TEXT DEFAULT '[]',
            technologies TEXT DEFAULT '[]',
            objectives  TEXT DEFAULT '[]',
            createdAt   TEXT
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS enrollments (
            id         TEXT PRIMARY KEY,
            userId     TEXT NOT NULL,
            courseId   TEXT NOT NULL,
            progress   INTEGER DEFAULT 0,
            status     TEXT DEFAULT 'in-progress',
            startedAt  TEXT,
            finishedAt TEXT,
            unitsDone  TEXT DEFAULT '[]',
            UNIQUE(userId, courseId),
            FOREIGN KEY (userId)   REFERENCES users(id)   ON DELETE CASCADE,
            FOREIGN KEY (courseId) REFERENCES courses(id) ON DELETE CASCADE
        )`, () => seedCourses());
    });
});

function seedCourses() {
    db.get('SELECT COUNT(*) as c FROM courses', [], (err, row) => {
        if (err || row.c > 0) return;
        const courses = [
            {
                id: 'c1', title: 'Desarrollo Web Full Stack', category: 'Programación', level: 'Intermedio',
                hours: 60, instructor: 'Ing. Carlos Mendoza', badge: 'NUEVO', color: '#004A87', icon: 'fa-code',
                description: 'Domina el ecosistema completo de desarrollo web moderno. Desde HTML semántico hasta APIs RESTful con Node.js y despliegue en la nube.',
                prerequisites: 'Conocimientos básicos de programación', technologies: JSON.stringify(['HTML5','CSS3','JavaScript ES6+','Node.js','Express','React','MongoDB','Git']),
                objectives: JSON.stringify(['Construir SPAs con React','Diseñar APIs REST con Node.js','Gestionar bases de datos NoSQL','Desplegar en Heroku/Vercel']),
                syllabus: JSON.stringify([
                    {unit:1, title:'Fundamentos Web Modernos', topics:['HTML5 semántico','CSS Grid & Flexbox','JavaScript ES6+'], hours:10},
                    {unit:2, title:'Backend con Node.js', topics:['Express.js','REST API design','Autenticación JWT'], hours:15},
                    {unit:3, title:'React & Estado Global', topics:['Hooks','Context API','React Router'], hours:15},
                    {unit:4, title:'Bases de Datos', topics:['MongoDB Atlas','Mongoose ODM','SQL vs NoSQL'], hours:10},
                    {unit:5, title:'DevOps & Despliegue', topics:['Docker','CI/CD','Cloud hosting'], hours:10}
                ])
            },
            {
                id: 'c2', title: 'Ciberseguridad Ofensiva', category: 'Seguridad', level: 'Avanzado',
                hours: 45, instructor: 'Esp. Laura Vargas', badge: '', color: '#10b981', icon: 'fa-shield-alt',
                description: 'Aprende las técnicas reales que usan los hackers éticos: análisis de vulnerabilidades, pentesting de redes y aplicaciones web.',
                prerequisites: 'Redes TCP/IP, Linux básico', technologies: JSON.stringify(['Kali Linux','Metasploit','Nmap','Burp Suite','Wireshark','Python']),
                objectives: JSON.stringify(['Realizar auditorías de seguridad','Explotar vulnerabilidades OWASP Top 10','Configurar entornos de pentesting','Redactar informes de vulnerabilidades']),
                syllabus: JSON.stringify([
                    {unit:1, title:'Fundamentos de Seguridad', topics:['CIA Triad','Superficie de ataque','Taxonomía de ataques'], hours:8},
                    {unit:2, title:'Reconocimiento & OSINT', topics:['Footprinting','Shodan','Recon-ng'], hours:8},
                    {unit:3, title:'Pentesting de Redes', topics:['Nmap avanzado','Metasploit Framework','Post-explotación'], hours:12},
                    {unit:4, title:'Seguridad Web (OWASP)', topics:['SQL Injection','XSS','CSRF','SSRF'], hours:12},
                    {unit:5, title:'Reporte & Remediación', topics:['CVSS scoring','Escritura de informes','Hardening'], hours:5}
                ])
            },
            {
                id: 'c3', title: 'Inteligencia Artificial Aplicada', category: 'IA / ML', level: 'Avanzado',
                hours: 80, instructor: 'PhD. Andrés Rojas', badge: 'HOT', color: '#8b5cf6', icon: 'fa-brain',
                description: 'Machine Learning, Deep Learning y LLMs aplicados a problemas reales de industria. Implementación con Python y TensorFlow.',
                prerequisites: 'Python intermedio, Álgebra lineal', technologies: JSON.stringify(['Python','TensorFlow','Keras','Scikit-learn','Pandas','NumPy','Jupyter','HuggingFace']),
                objectives: JSON.stringify(['Construir modelos de clasificación y regresión','Entrenar redes neuronales','Fine-tuning de LLMs','Desplegar modelos con FastAPI']),
                syllabus: JSON.stringify([
                    {unit:1, title:'Matemáticas para ML', topics:['Álgebra lineal','Cálculo diferencial','Probabilidad'], hours:12},
                    {unit:2, title:'Machine Learning Clásico', topics:['Regresión','Árboles de decisión','SVM','k-NN'], hours:18},
                    {unit:3, title:'Deep Learning', topics:['Redes neuronales','CNN','RNN','Transformers'], hours:20},
                    {unit:4, title:'NLP & LLMs', topics:['Tokenización','BERT','GPT fine-tuning','LangChain'], hours:18},
                    {unit:5, title:'MLOps & Producción', topics:['MLflow','Docker para ML','API con FastAPI'], hours:12}
                ])
            },
            {
                id: 'c4', title: 'Gestión Ágil de Proyectos', category: 'Management', level: 'Principiante',
                hours: 40, instructor: 'Mg. Patricia Suárez', badge: '', color: '#f59e0b', icon: 'fa-tasks',
                description: 'Metodologías ágiles para liderar equipos de desarrollo: Scrum, Kanban y OKRs para entregar software de calidad a tiempo.',
                prerequisites: 'Ninguno', technologies: JSON.stringify(['Jira','Confluence','Miro','Trello','Slack','GitHub Projects']),
                objectives: JSON.stringify(['Gestionar sprints con Scrum','Visualizar flujos con Kanban','Definir OKRs efectivos','Facilitar ceremonias ágiles']),
                syllabus: JSON.stringify([
                    {unit:1, title:'Manifiesto Ágil', topics:['Historia del Agile','12 principios','Waterfall vs Agile'], hours:5},
                    {unit:2, title:'Scrum Framework', topics:['Roles','Eventos','Artefactos','Sprint planning'], hours:12},
                    {unit:3, title:'Kanban & Lean', topics:['WIP limits','Tablero Kanban','Métricas de flujo'], hours:10},
                    {unit:4, title:'Herramientas & Métricas', topics:['Jira avanzado','Velocity','Burndown charts'], hours:8},
                    {unit:5, title:'OKRs & Estrategia', topics:['Definir OKRs','Alinear equipos','Revisiones trimestrales'], hours:5}
                ])
            },
            {
                id: 'c5', title: 'Arquitectura Cloud AWS', category: 'Cloud', level: 'Avanzado',
                hours: 65, instructor: 'Arq. Felipe Castro', badge: 'PRO', color: '#004A87', icon: 'fa-cloud',
                description: 'Diseña infraestructuras escalables y tolerantes a fallos en AWS. Prepárate para la certificación AWS Solutions Architect.',
                prerequisites: 'Linux, Redes, Docker', technologies: JSON.stringify(['AWS EC2','S3','Lambda','RDS','VPC','CloudFormation','Terraform','Kubernetes']),
                objectives: JSON.stringify(['Diseñar arquitecturas multi-tier','Implementar serverless con Lambda','Orquestar contenedores con EKS','Automatizar con Terraform']),
                syllabus: JSON.stringify([
                    {unit:1, title:'Fundamentos AWS', topics:['Regiones & AZs','IAM','EC2 & S3','Pricing'], hours:10},
                    {unit:2, title:'Networking & Seguridad', topics:['VPC design','Security Groups','WAF','CloudFront'], hours:15},
                    {unit:3, title:'Serverless & Microservicios', topics:['Lambda','API Gateway','SQS','SNS'], hours:15},
                    {unit:4, title:'Contenedores en AWS', topics:['ECS','EKS','Fargate','ECR'], hours:15},
                    {unit:5, title:'IaC & DevOps', topics:['Terraform','CloudFormation','CodePipeline'], hours:10}
                ])
            },
            {
                id: 'c6', title: 'Diseño de Interfaces UI/UX', category: 'Diseño', level: 'Principiante',
                hours: 50, instructor: 'Dis. María Ortega', badge: '', color: '#ec4899', icon: 'fa-pen-nib',
                description: 'Diseña productos digitales centrados en el usuario: investigación, wireframing, prototipado en Figma y pruebas de usabilidad.',
                prerequisites: 'Ninguno', technologies: JSON.stringify(['Figma','Adobe XD','Maze','Hotjar','Storybook','Zeplin']),
                objectives: JSON.stringify(['Realizar investigación UX','Crear wireframes y prototipos','Aplicar Design Systems','Ejecutar pruebas de usabilidad']),
                syllabus: JSON.stringify([
                    {unit:1, title:'Fundamentos UX', topics:['Design thinking','User research','Personas & Journey maps'], hours:10},
                    {unit:2, title:'UI Design Principles', topics:['Tipografía','Color theory','Gestalt','Accesibilidad'], hours:10},
                    {unit:3, title:'Figma Avanzado', topics:['Auto layout','Variables','Componentes','Prototyping'], hours:15},
                    {unit:4, title:'Design Systems', topics:['Atomic design','Tokens','Documentación con Storybook'], hours:10},
                    {unit:5, title:'Testing & Handoff', topics:['Pruebas de usabilidad','A/B testing','Zeplin/Inspect'], hours:5}
                ])
            }
        ];
        const stmt = db.prepare(`INSERT OR IGNORE INTO courses (id,title,description,category,level,hours,instructor,badge,color,icon,prerequisites,syllabus,technologies,objectives,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
        courses.forEach(c => stmt.run(c.id,c.title,c.description,c.category,c.level,c.hours,c.instructor,c.badge,c.color,c.icon,c.prerequisites,c.syllabus,c.technologies,c.objectives,new Date().toISOString()));
        stmt.finalize();
        console.log('✅ Cursos de ejemplo insertados.');
    });
}

// ───────────────────────────── HELPERS ─────────────────────────────
function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateId() {
    return crypto.randomBytes(16).toString('hex');
}

function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}

function requireAuth(req, res, next) {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No autorizado' });

    db.get('SELECT userId FROM sessions WHERE token = ?', [token], (err, row) => {
        if (err || !row) return res.status(401).json({ error: 'Sesión inválida o expirada' });
        req.userId = row.userId;
        next();
    });
}

// ───────────────────────────── AUTH ROUTES ─────────────────────────────

// POST /api/auth/register
app.post('/api/auth/register', (req, res) => {
    const { name, email, password, code, career, semester, journey } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'Campos obligatorios faltantes' });

    const id = generateId();
    const hashed = hashPassword(password);
    const createdAt = new Date().toISOString();

    db.run(
        `INSERT INTO users (id, name, email, password, code, career, semester, journey, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, name, email.toLowerCase(), hashed, code || '', career || '', semester || '', journey || '', createdAt],
        function (err) {
            if (err) {
                if (err.message.includes('UNIQUE')) return res.status(409).json({ error: 'El correo ya está registrado' });
                return res.status(500).json({ error: err.message });
            }
            const token = generateToken();
            db.run(`INSERT INTO sessions (token, userId, createdAt) VALUES (?, ?, ?)`,
                [token, id, new Date().toISOString()]);

            res.status(201).json({
                token,
                user: { id, name, email: email.toLowerCase(), code, career, semester, journey, createdAt }
            });
        }
    );
});

// POST /api/auth/login
app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Correo y contraseña requeridos' });

    const hashed = hashPassword(password);
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email.toLowerCase(), hashed], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Correo o contraseña incorrectos' });

        const token = generateToken();
        db.run(`INSERT INTO sessions (token, userId, createdAt) VALUES (?, ?, ?)`,
            [token, user.id, new Date().toISOString()]);

        const { password: _, ...safeUser } = user;
        res.json({ token, user: safeUser });
    });
});

// POST /api/auth/logout
app.post('/api/auth/logout', requireAuth, (req, res) => {
    const token = req.headers['authorization']?.replace('Bearer ', '');
    db.run('DELETE FROM sessions WHERE token = ?', [token], () => {
        res.json({ message: 'Sesión cerrada' });
    });
});

// ───────────────────────────── USER ROUTES ─────────────────────────────

// GET /api/users/me
app.get('/api/users/me', requireAuth, (req, res) => {
    db.get(`SELECT id, name, email, code, career, semester, journey, createdAt FROM users WHERE id = ?`,
        [req.userId], (err, user) => {
            if (err) return res.status(500).json({ error: err.message });
            if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
            res.json(user);
        });
});

// PUT /api/users/me
app.put('/api/users/me', requireAuth, (req, res) => {
    const { name, code, career, semester, journey } = req.body;
    db.run(
        `UPDATE users SET name=COALESCE(?,name), code=COALESCE(?,code), career=COALESCE(?,career), semester=COALESCE(?,semester), journey=COALESCE(?,journey) WHERE id=?`,
        [name, code, career, semester, journey, req.userId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            db.get(`SELECT id, name, email, code, career, semester, journey, createdAt FROM users WHERE id=?`,
                [req.userId], (err2, user) => res.json(user));
        }
    );
});

// PUT /api/users/me/password
app.put('/api/users/me/password', requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Faltan campos' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'Mínimo 8 caracteres' });
    const hashedCurrent = hashPassword(currentPassword);
    db.get('SELECT * FROM users WHERE id=? AND password=?', [req.userId, hashedCurrent], (err, user) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!user) return res.status(401).json({ error: 'Contraseña actual incorrecta' });
        db.run('UPDATE users SET password=? WHERE id=?', [hashPassword(newPassword), req.userId], (e) => {
            if (e) return res.status(500).json({ error: e.message });
            res.json({ message: 'Contraseña actualizada' });
        });
    });
});

// ───────────────────────────── PROJECT ROUTES ─────────────────────────────


// GET /api/projects
app.get('/api/projects', requireAuth, (req, res) => {
    db.all(`SELECT * FROM projects WHERE userId = ? ORDER BY createdAt DESC`, [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/projects
app.post('/api/projects', requireAuth, (req, res) => {
    const { name, category, tutor, status, priority, date, description } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre del proyecto es obligatorio' });

    const id = generateId();
    const createdAt = new Date().toISOString();

    db.run(
        `INSERT INTO projects (id, userId, name, category, tutor, status, priority, date, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, req.userId, name, category || '', tutor || '', status || 'pending', priority || 'Media', date || '', description || '', createdAt],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.status(201).json({ id, userId: req.userId, name, category, tutor, status, priority, date, description, createdAt });
        }
    );
});

// PUT /api/projects/:id
app.put('/api/projects/:id', requireAuth, (req, res) => {
    const { name, category, tutor, status, priority, date, description } = req.body;
    db.run(
        `UPDATE projects SET name=COALESCE(?,name), category=COALESCE(?,category), tutor=COALESCE(?,tutor), status=COALESCE(?,status), priority=COALESCE(?,priority), date=COALESCE(?,date), description=COALESCE(?,description) WHERE id=? AND userId=?`,
        [name, category, tutor, status, priority, date, description, req.params.id, req.userId],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
            db.get(`SELECT * FROM projects WHERE id=?`, [req.params.id], (e, row) => res.json(row));
        }
    );
});

// DELETE /api/projects/:id
app.delete('/api/projects/:id', requireAuth, (req, res) => {
    db.run(`DELETE FROM projects WHERE id=? AND userId=?`, [req.params.id, req.userId], function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Proyecto no encontrado' });
        res.json({ message: 'Proyecto eliminado' });
    });
});

// ───────────────────────────── COURSE ROUTES ─────────────────────────────

// GET /api/courses — catálogo completo
app.get('/api/courses', requireAuth, (req, res) => {
    const { category, level, search } = req.query;
    let sql = 'SELECT * FROM courses WHERE 1=1';
    const params = [];
    if (category) { sql += ' AND category=?'; params.push(category); }
    if (level)    { sql += ' AND level=?';    params.push(level); }
    if (search)   { sql += ' AND (title LIKE ? OR description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
    db.all(sql, params, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// GET /api/courses/:id — detalle de un curso
app.get('/api/courses/:id', requireAuth, (req, res) => {
    db.get('SELECT * FROM courses WHERE id=?', [req.params.id], (err, course) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!course) return res.status(404).json({ error: 'Curso no encontrado' });
        // adjuntar estado de inscripción del usuario
        db.get('SELECT * FROM enrollments WHERE userId=? AND courseId=?', [req.userId, req.params.id], (e, enroll) => {
            res.json({ ...course, enrollment: enroll || null });
        });
    });
});

// GET /api/enrollments — mis inscripciones
app.get('/api/enrollments', requireAuth, (req, res) => {
    const sql = `
        SELECT e.*, c.title, c.category, c.level, c.hours, c.icon, c.color, c.instructor, c.syllabus
        FROM enrollments e JOIN courses c ON e.courseId = c.id
        WHERE e.userId = ? ORDER BY e.startedAt DESC`;
    db.all(sql, [req.userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST /api/enrollments — inscribirse
app.post('/api/enrollments', requireAuth, (req, res) => {
    const { courseId } = req.body;
    if (!courseId) return res.status(400).json({ error: 'courseId requerido' });
    const id = generateId();
    db.run(
        `INSERT OR IGNORE INTO enrollments (id, userId, courseId, progress, status, startedAt, unitsDone) VALUES (?,?,?,0,'in-progress',?,?)`,
        [id, req.userId, courseId, new Date().toISOString(), '[]'],
        function(err) {
            if (err) return res.status(500).json({ error: err.message });
            if (this.changes === 0) return res.status(409).json({ error: 'Ya estás inscrito en este curso' });
            res.status(201).json({ id, courseId, progress: 0, status: 'in-progress', unitsDone: [] });
        }
    );
});

// PUT /api/enrollments/:courseId/progress — marcar unidad completada
app.put('/api/enrollments/:courseId/progress', requireAuth, (req, res) => {
    const { unitIndex, totalUnits } = req.body;
    db.get('SELECT * FROM enrollments WHERE userId=? AND courseId=?', [req.userId, req.params.courseId], (err, enroll) => {
        if (err || !enroll) return res.status(404).json({ error: 'Inscripción no encontrada' });
        let unitsDone = JSON.parse(enroll.unitsDone || '[]');
        if (!unitsDone.includes(unitIndex)) unitsDone.push(unitIndex);
        const progress = Math.round((unitsDone.length / totalUnits) * 100);
        const status = progress >= 100 ? 'completed' : 'in-progress';
        const finishedAt = status === 'completed' ? new Date().toISOString() : null;
        db.run(
            `UPDATE enrollments SET unitsDone=?, progress=?, status=?, finishedAt=COALESCE(?,finishedAt) WHERE userId=? AND courseId=?`,
            [JSON.stringify(unitsDone), progress, status, finishedAt, req.userId, req.params.courseId],
            (e) => {
                if (e) return res.status(500).json({ error: e.message });
                res.json({ progress, status, unitsDone });
            }
        );
    });
});

// DELETE /api/enrollments/:courseId — abandonar curso
app.delete('/api/enrollments/:courseId', requireAuth, (req, res) => {
    db.run('DELETE FROM enrollments WHERE userId=? AND courseId=?', [req.userId, req.params.courseId], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Inscripción no encontrada' });
        res.json({ message: 'Desmatriculado exitosamente' });
    });
});

// ───────────────────────────── SERVER START ─────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Servidor UTS corriendo en http://localhost:${PORT}`);
    console.log(`   Frontend disponible en http://localhost:${PORT}/pages/login.html`);
});
