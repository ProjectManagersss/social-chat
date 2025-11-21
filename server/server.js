const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, '..')));

// Database setup
const db = new sqlite3.Database('./chat.db', (err) => {
    if (err) {
        console.error('Error opening database:', err);
    } else {
        console.log('Connected to SQLite database');
        initDatabase();
    }
});

// Initialize database tables
function initDatabase() {
    db.serialize(() => {
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            initials TEXT NOT NULL,
            color TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS contacts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            contact_username TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            UNIQUE(user_id, contact_username)
        )`);

        db.run(`CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            conversation_id TEXT NOT NULL,
            sender TEXT NOT NULL,
            text TEXT,
            image TEXT,
            timestamp INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        db.run(`CREATE INDEX IF NOT EXISTS idx_conversation
                ON messages(conversation_id, timestamp)`, (err) => {
            if (err) {
                console.error('Error creating index:', err);
            } else {
                console.log('Database initialized successfully');
            }
        });
    });
}

// Utility functions
function getInitials(name) {
    return name
        .split(' ')
        .map(word => word[0])
        .join('')
        .toUpperCase()
        .substring(0, 2);
}

function getAvatarColor(name) {
    const colors = [
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
        'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
        'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
}

function getConversationId(user1, user2) {
    return [user1, user2].sort().join('__');
}

// WebSocket connections
const clients = new Map(); // username -> WebSocket

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            if (data.type === 'register') {
                clients.set(data.username, ws);
                console.log(`User ${data.username} registered`);
            } else if (data.type === 'unregister') {
                clients.delete(data.username);
                console.log(`User ${data.username} unregistered`);
            }
        } catch (error) {
            console.error('Error handling WebSocket message:', error);
        }
    });

    ws.on('close', () => {
        // Remove disconnected client
        for (const [username, client] of clients.entries()) {
            if (client === ws) {
                clients.delete(username);
                console.log(`User ${username} disconnected`);
                break;
            }
        }
    });
});

// Broadcast message to specific user
function notifyUser(username, data) {
    const client = clients.get(username);
    if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
    }
}

// API Routes

// Get or create user
app.post('/api/auth/login', (req, res) => {
    const { username } = req.body;

    if (!username || !username.trim()) {
        return res.status(400).json({ error: 'Username is required' });
    }

    const trimmedUsername = username.trim();

    db.get('SELECT * FROM users WHERE username = ?', [trimmedUsername], (err, user) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        if (user) {
            return res.json(user);
        }

        // Create new user
        const initials = getInitials(trimmedUsername);
        const color = getAvatarColor(trimmedUsername);

        db.run(
            'INSERT INTO users (username, initials, color) VALUES (?, ?, ?)',
            [trimmedUsername, initials, color],
            function(err) {
                if (err) {
                    return res.status(500).json({ error: 'Error creating user' });
                }

                res.json({
                    id: this.lastID,
                    username: trimmedUsername,
                    initials,
                    color
                });
            }
        );
    });
});

// Get user contacts
app.get('/api/contacts/:username', (req, res) => {
    const { username } = req.params;

    db.all(
        `SELECT c.contact_username, u.initials, u.color
         FROM contacts c
         LEFT JOIN users u ON c.contact_username = u.username
         WHERE c.user_id = (SELECT id FROM users WHERE username = ?)`,
        [username],
        (err, contacts) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(contacts || []);
        }
    );
});

// Add contact
app.post('/api/contacts', (req, res) => {
    const { username, contactUsername } = req.body;

    if (username === contactUsername) {
        return res.status(400).json({ error: "Can't add yourself as a contact" });
    }

    // Get or create contact user first
    db.get('SELECT * FROM users WHERE username = ?', [contactUsername], (err, contactUser) => {
        if (err) {
            return res.status(500).json({ error: 'Database error' });
        }

        const ensureContactUser = () => {
            return new Promise((resolve, reject) => {
                if (contactUser) {
                    resolve(contactUser);
                } else {
                    const initials = getInitials(contactUsername);
                    const color = getAvatarColor(contactUsername);

                    db.run(
                        'INSERT INTO users (username, initials, color) VALUES (?, ?, ?)',
                        [contactUsername, initials, color],
                        function(err) {
                            if (err) reject(err);
                            else resolve({ id: this.lastID, username: contactUsername, initials, color });
                        }
                    );
                }
            });
        };

        ensureContactUser().then(() => {
            // Add contact for current user
            db.get('SELECT id FROM users WHERE username = ?', [username], (err, user) => {
                if (err || !user) {
                    return res.status(500).json({ error: 'User not found' });
                }

                db.run(
                    'INSERT OR IGNORE INTO contacts (user_id, contact_username) VALUES (?, ?)',
                    [user.id, contactUsername],
                    (err) => {
                        if (err) {
                            return res.status(500).json({ error: 'Error adding contact' });
                        }

                        // Add reverse contact
                        db.get('SELECT id FROM users WHERE username = ?', [contactUsername], (err, contactUser) => {
                            if (contactUser) {
                                db.run(
                                    'INSERT OR IGNORE INTO contacts (user_id, contact_username) VALUES (?, ?)',
                                    [contactUser.id, username]
                                );
                            }
                        });

                        // Get contact info
                        db.get('SELECT username, initials, color FROM users WHERE username = ?',
                            [contactUsername],
                            (err, contact) => {
                                res.json(contact);
                            }
                        );
                    }
                );
            });
        }).catch(err => {
            res.status(500).json({ error: 'Error creating contact user' });
        });
    });
});

// Get messages for a conversation
app.get('/api/messages/:username/:contactUsername', (req, res) => {
    const { username, contactUsername } = req.params;
    const conversationId = getConversationId(username, contactUsername);

    db.all(
        'SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC',
        [conversationId],
        (err, messages) => {
            if (err) {
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(messages || []);
        }
    );
});

// Send message
app.post('/api/messages', (req, res) => {
    const { sender, recipient, text, image, timestamp } = req.body;
    const conversationId = getConversationId(sender, recipient);

    db.run(
        'INSERT INTO messages (conversation_id, sender, text, image, timestamp) VALUES (?, ?, ?, ?, ?)',
        [conversationId, sender, text, image, timestamp],
        function(err) {
            if (err) {
                return res.status(500).json({ error: 'Error sending message' });
            }

            const message = {
                id: this.lastID,
                conversation_id: conversationId,
                sender,
                text,
                image,
                timestamp
            };

            // Notify recipient via WebSocket
            notifyUser(recipient, {
                type: 'new_message',
                message,
                from: sender
            });

            res.json(message);
        }
    );
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});

// Serve frontend
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'chats.html'));
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('Shutting down gracefully...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
        }
        process.exit(0);
    });
});
