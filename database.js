const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'uts_platform.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        initializeTables();
    }
});

function initializeTables() {
    db.serialize(() => {
        // Usuarios
        db.run(`CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_code TEXT UNIQUE,
            name TEXT,
            email TEXT UNIQUE,
            password TEXT,
            career TEXT,
            semester INTEGER,
            role TEXT DEFAULT 'estudiante',
            photo TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Proyectos
        db.run(`CREATE TABLE IF NOT EXISTS proyectos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            name TEXT,
            description TEXT,
            category TEXT,
            course_id INTEGER,
            start_date TEXT,
            due_date TEXT,
            status TEXT DEFAULT 'pending',
            grade INTEGER,
            evidence TEXT,
            tutor TEXT,
            observations TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES usuarios (id)
        )`);

        // Cursos
        db.run(`CREATE TABLE IF NOT EXISTS cursos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            area TEXT,
            description TEXT,
            slots INTEGER,
            instructor TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Inscripciones
        db.run(`CREATE TABLE IF NOT EXISTS inscripciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            course_id INTEGER,
            enrolled_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES usuarios (id),
            FOREIGN KEY (course_id) REFERENCES cursos (id)
        )`);

        // Progreso Académico (Cache/Summary)
        db.run(`CREATE TABLE IF NOT EXISTS progreso_academico (
            user_id INTEGER PRIMARY KEY,
            total_required INTEGER DEFAULT 52,
            completed_projects INTEGER DEFAULT 0,
            graduation_percentage REAL DEFAULT 0.0,
            FOREIGN KEY (user_id) REFERENCES usuarios (id)
        )`);

        console.log('Tables initialized successfully.');
    });
}

module.exports = db;
