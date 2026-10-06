const express = require('express');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json());

const dbConfig = {
    host: process.env.DB_HOST || 'db',
    user: process.env.DB_USER || 'ticket_user',
    password: process.env.DB_PASSWORD || 'ticketpassword',
    database: process.env.DB_NAME || 'ticket_db'
};

app.get('/health', (req, res) => res.status(200).send('OK'));

app.get('/tickets', async (req, res) => {
    try {
        const conn = await mysql.createConnection(dbConfig);
        const [rows] = await conn.execute('SELECT * FROM tickets ORDER BY id DESC');
        await conn.end();
        res.json(rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/tickets', async (req, res) => {
    try {
        const { title } = req.body;
        const conn = await mysql.createConnection(dbConfig);
        await conn.execute('INSERT INTO tickets (title) VALUES (?)', [title]);
        await conn.end();
        res.status(201).json({ message: 'Ticket created' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(3000, () => console.log('API listening on port 3000'));
