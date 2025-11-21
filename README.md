# Social Chat App

A real-time chat application with WebSocket support, image sharing, and multi-user capabilities.

## Features

- 💬 Real-time messaging with WebSocket
- 📷 Image sharing
- 👥 Multi-user support
- 🔄 Automatic message synchronization
- 💾 SQLite database storage
- 🎨 Beautiful WhatsApp-inspired UI

## Setup & Installation

### Local Development

1. **Install dependencies:**
```bash
cd server
npm install
```

2. **Start the server:**
```bash
npm start
```

3. **Open your browser:**
```
http://localhost:3000
```

### Usage

1. Enter your name to sign in
2. Click the `+` button to add contacts
3. Select a contact to start chatting
4. Use the 📎 button to send images
5. Click on your avatar to switch accounts

## Deployment

### Deploy to Render.com (Free)

1. **Push to GitHub:**
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin YOUR_GITHUB_REPO_URL
git push -u origin main
```

2. **Deploy on Render:**
   - Go to [render.com](https://render.com)
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Configure:
     - **Name:** social-chat-app
     - **Root Directory:** `server`
     - **Build Command:** `npm install`
     - **Start Command:** `npm start`
   - Click "Create Web Service"

3. **Access your app:**
   - Your app will be available at: `https://your-app-name.onrender.com`

### Deploy to Railway.app (Free)

1. **Push to GitHub** (if not already done)

2. **Deploy on Railway:**
   - Go to [railway.app](https://railway.app)
   - Click "New Project" → "Deploy from GitHub repo"
   - Select your repository
   - Railway will auto-detect Node.js
   - Your app will be deployed automatically

3. **Access your app:**
   - Railway will provide a URL like: `https://your-app.up.railway.app`

### Deploy to Replit (Free)

1. Go to [replit.com](https://replit.com)
2. Click "Create Repl"
3. Import from GitHub
4. Select your repository
5. Click "Run" - Replit will auto-detect and run the server

## Project Structure

```
social/
├── server/
│   ├── server.js       # Express & WebSocket server
│   ├── package.json    # Dependencies
│   └── chat.db         # SQLite database (auto-created)
├── index.html          # Main chat interface (server-connected)
├── chats.html          # Offline version (localStorage)
└── camera.html         # Camera capture page
```

## API Endpoints

- `POST /api/auth/login` - Sign in / create user
- `GET /api/contacts/:username` - Get user contacts
- `POST /api/contacts` - Add new contact
- `GET /api/messages/:username/:contactUsername` - Get conversation messages
- `POST /api/messages` - Send message

## WebSocket Events

- `register` - Register user for real-time updates
- `unregister` - Unregister user
- `new_message` - Receive new message notification

## Technologies

- **Backend:** Node.js, Express, WebSocket (ws), SQLite
- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Real-time:** WebSocket for instant message delivery
- **Database:** SQLite for simplicity and portability

## Environment Variables

- `PORT` - Server port (default: 3000)

## License

MIT
