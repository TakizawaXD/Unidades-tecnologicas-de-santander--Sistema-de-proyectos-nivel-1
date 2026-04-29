require('dotenv').config({ path: '../.env' });
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Iniciar base de datos SQLite en un archivo local
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) console.error('Error abriendo base de datos', err);
    else {
        console.log('Conectado a la base de datos SQLite.');
        db.serialize(() => {
            // Eliminar tabla anterior para actualizar esquema
            db.run(`DROP TABLE IF EXISTS projects`);
            
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                name TEXT,
                email TEXT,
                code TEXT,
                career TEXT,
                semester TEXT,
                journey TEXT,
                createdAt TEXT
            )`);

            db.run(`CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                userId TEXT,
                name TEXT,
                category TEXT,
                tutor TEXT,
                status TEXT,
                priority TEXT,
                date TEXT,
                description TEXT,
                createdAt TEXT
            )`);
        });
    }
});

// GET: Obtener proyectos por usuario
app.get('/api/projects', (req, res) => {
    const { userId } = req.query;
    db.all('SELECT * FROM projects WHERE userId = ?', [userId], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// POST: Crear proyecto
app.post('/api/projects', (req, res) => {
    const { id, userId, name, category, tutor, status, priority, date, description, createdAt } = req.body;
    
    db.run(
        `INSERT INTO projects (id, userId, name, category, tutor, status, priority, date, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, userId, name, category, tutor, status, priority, date, description, createdAt],
        function (err) {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ id: id || this.lastID, message: "Proyecto creado exitosamente" });
        }
    );
});

// DELETE: Eliminar proyecto
app.delete('/api/projects/:id', (req, res) => {
    db.run('DELETE FROM projects WHERE id = ?', [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "Proyecto eliminado" });
    });
});

// POST: Sincronizar todos los datos (Supabase -> SQLite)
app.post('/api/sync', (req, res) => {
    const { user, projects } = req.body;
    
    db.serialize(() => {
        if (user) {
            db.run(
                `INSERT OR REPLACE INTO users (id, name, email, code, career, semester, journey, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [user.id, user.name, user.email, user.code, user.career, user.semester, user.journey, user.createdAt || new Date().toISOString()]
            );
        }
        if (projects && Array.isArray(projects)) {
            const stmt = db.prepare(`INSERT OR REPLACE INTO projects (id, userId, name, category, tutor, status, priority, date, description, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
            for (const p of projects) {
                stmt.run([p.id, p.userId, p.name, p.category, p.tutor, p.status, p.priority, p.date, p.description, p.createdAt]);
            }
            stmt.finalize();
        }
    });

    res.json({ message: "Sincronización completada exitosamente" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor Backend de Ejemplo corriendo en http://localhost:${PORT}`);
});
