````markdown
# 🎬 YouTube Collaboration Platform

A web application that connects **Youtubers** and **Editors** for efficient collaboration.  
Built with **React (Vite + TypeScript)** for the frontend, **Node.js + Express** for the backend, and **PostgreSQL (via Neon + Prisma)** as the primary database.

---

## 🚀 Features

- **User Roles**

  - Youtuber – Create and manage projects, upload files, give feedback.
  - Editor – Work on assigned projects, upload revisions, communicate with Youtubers.

- **Authentication**

  - JWT-based authentication with access & refresh tokens.
  - Google Sign-In integration (planned).

- **Project Management**

  - Create projects, assign editors, manage revisions.
  - Milestones and deadlines to track progress.

- **Messaging System (Socket.IO)**

  - Real-time chat between Youtubers and Editors.
  - Message checklists, pinned notes, and notifications.

- **File Management**

  - Upload and manage raw files, revisions, and final outputs.
  - (Storage provider to be finalized – S3, Cloudflare R2, etc.)

- **Notifications**
  - In-app notifications for new messages, file uploads, and deadlines.

---

## 🛠️ Tech Stack

### Frontend

- React (Vite + TypeScript)
- TailwindCSS (UI styling)
- ShadCN UI components

### Backend

- Node.js + Express
- Prisma ORM
- JWT Authentication
- Socket.IO (real-time communication)

### Database

- PostgreSQL (hosted on Neon)

### Others (Planned/Optional)

- Redis (for caching sessions, notifications, and chat messages)
- Cloudflare R2 / AWS S3 (file storage)
- Nodemailer / Twilio / SendGrid (for OTP verification)

---

## 📂 Database Schema (ERD Snapshot)

Entities include:

- **Users** (roles: Youtuber, Editor)
- **Projects**
- **Files & Revisions**
- **Messages**
- **Milestones**
- **Notifications**
- **EditorPermissions**
- **Pinned Notes**
- **Checklists**

(ER diagram managed in [Eraser](https://app.eraser.io/))

---

## ⚡ Installation & Setup

### Prerequisites

- Node.js (>= 18)
- PostgreSQL (Neon or local instance)
- npm / yarn / pnpm

### Clone Repository

```bash
git clone https://github.com/<your-username>/yt-collab-platform.git
cd yt-collab-platform
```
````

### Backend Setup

```bash
cd backend
npm install

# Setup environment
cp .env.example .env

# Run migrations
npx prisma migrate dev

# Start backend
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install

# Setup environment
cp .env.example .env

# Start frontend
npm run dev
```

---

## 🔑 Environment Variables

### Backend (`/backend/.env`)

```env
DATABASE_URL="postgresql://<user>:<password>@<host>/<db>?schema=public"
JWT_SECRET="<your-secret>"
REFRESH_SECRET="<your-refresh-secret>"
CLOUD_STORAGE_KEY="<optional-storage-key>"
```

### Frontend (`/frontend/.env`)

```env
VITE_API_URL="http://localhost:5000"
```

---

## 📌 Roadmap

- [x] JWT Authentication
- [x] User Roles (Youtuber, Editor)
- [x] Basic Project Management
- [ ] File Storage Integration
- [ ] OTP-based Email/Phone Verification
- [ ] Advanced Notifications
- [ ] Google Sign-In
- [ ] Deployment with Docker

---

## 🧪 Testing

- Use **Postman** for API testing.
- Authenticated endpoints require **accessToken** in the `Authorization: Bearer <token>` header.
- Socket.IO can be tested with [Socket.IO Client](https://socket.io/docs/v4/client-api/).

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!
Feel free to check the [issues page](../../issues).

---

## 📜 License

This project is licensed under the MIT License – see the [LICENSE](./LICENSE) file for details.
