const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = 'uts_secret_key_2024';

// Use CORS properly
app.use(cors({
    origin: '*', // Allow all for local development
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());
app.use(express.static(__dirname)); // Serve the root directory to find images and pages

// --- AUTH ROUTES ---

app.post('/api/register', (req, res) => {
    const { student_code, name, email, password, career, semester } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);

    const sql = `INSERT INTO usuarios (student_code, name, email, password, career, semester) VALUES (?, ?, ?, ?, ?, ?)`;
    db.run(sql, [student_code, name, email, hashedPassword, career, semester], function(err) {
        if (err) return res.status(400).json({ error: err.message });
        
        // Initialize progress
        db.run(`INSERT INTO progreso_academico (user_id) VALUES (?)`, [this.lastID]);
        
        res.json({ message: 'Usuario registrado con éxito', id: this.lastID });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    const sql = `SELECT * FROM usuarios WHERE email = ?`;
    db.get(sql, [email], (err, user) => {
        if (err || !user) return res.status(404).json({ error: 'Usuario no encontrado' });

        const isValid = bcrypt.compareSync(password, user.password);
        if (!isValid) return res.status(401).json({ error: 'Contraseña incorrecta' });

        const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '24h' });
        res.json({ token, user: { id: user.id, name: user.name, role: user.role, career: user.career } });
    });
});

// --- PROJECT ROUTES ---

app.get('/api/projects', (req, res) => {
    const userId = req.query.userId;
    const sql = `SELECT * FROM proyectos WHERE user_id = ? ORDER BY created_at DESC`;
    db.all(sql, [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/projects', (req, res) => {
    const { user_id, name, description, category, due_date } = req.body;
    const sql = `INSERT INTO proyectos (user_id, name, description, category, due_date) VALUES (?, ?, ?, ?, ?)`;
    db.run(sql, [user_id, name, description, category, due_date], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, message: 'Proyecto creado' });
    });
});

app.put('/api/projects/:id', (req, res) => {
    const { name, description, category, due_date, status } = req.body;
    const sql = `UPDATE proyectos SET name = ?, description = ?, category = ?, due_date = ?, status = ? WHERE id = ?`;
    db.run(sql, [name, description, category, due_date, status, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Proyecto actualizado' });
    });
});

app.delete('/api/projects/:id', (req, res) => {
    db.run(`DELETE FROM proyectos WHERE id = ?`, [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Proyecto eliminado' });
    });
});

// --- COURSE ROUTES ---

app.get('/api/courses', (req, res) => {
    db.all(`SELECT * FROM cursos`, [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/courses/enroll', (req, res) => {
    const { user_id, course_id } = req.body;
    db.run(`INSERT INTO inscripciones (user_id, course_id) VALUES (?, ?)`, [user_id, course_id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Inscrito con éxito' });
    });
});

// --- STATS ROUTES ---

app.get('/api/stats/:userId', (req, res) => {
    const userId = req.params.userId;
    const sql = `
        SELECT 
            (SELECT COUNT(*) FROM proyectos WHERE user_id = ? AND status = 'done') as completed,
            (SELECT COUNT(*) FROM proyectos WHERE user_id = ? AND status = 'progress') as in_progress,
            (SELECT COUNT(*) FROM proyectos WHERE user_id = ? AND (status = 'pending' OR status IS NULL)) as pending,
            (SELECT COUNT(*) FROM inscripciones WHERE user_id = ?) as active_courses
    `;
    db.get(sql, [userId, userId, userId, userId], (err, stats) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const total_required = 52;
        const percentage = ((stats.completed / total_required) * 100).toFixed(1);
        
        res.json({ ...stats, total_required, percentage });
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
