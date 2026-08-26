# CampusConnect

A full-stack college community web application built with React, Vite, Express and SQLite.

## Features

- Student registration/login with JWT authentication
- Dashboard
- Sustainable marketplace
- Announcements
- Clubs
- Events and event registration
- Lost & Found
- In-app notifications
- Item posting
- Lost/found reporting
- Responsive mobile-first UI
- SQLite database with automatic seed data

## Requirements

Install:

1. Node.js 20+ from https://nodejs.org/
2. VS Code

## Run

Open this folder in VS Code.

### 1. Install packages

```bash
npm install
```

### 2. Create environment file

Copy `.env.example` to `.env`.

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Mac/Linux:

```bash
cp .env.example .env
```

### 3. Start the application

```bash
npm run dev
```

Open:

http://localhost:5173

The API runs on:

http://localhost:5000

## Demo account

Email:
demo@campusconnect.edu

Password:
Demo@123

## Database

The SQLite database is created automatically at:

server/data/campusconnect.db

Delete that file if you want to reset the database and recreate the seed data.

## Production build

```bash
npm run build
npm start
```

The Express server serves the built frontend.

## Important

This starter app is suitable for a college project/demo. Before production deployment, add:
- real email verification
- password reset email
- cloud image storage
- stronger rate limiting
- audit logging
- admin role management
- HTTPS
- secure cookies or short-lived access tokens
- content moderation workflow
