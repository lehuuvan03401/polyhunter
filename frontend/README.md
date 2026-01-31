# Horus Frontend

Frontend application for the Horus copy trading platform.

## Prerequisites

- Node.js (v20+)
- PostgreSQL (v14+)
- npm

## Setup & Local Development

### 1. Database Setup (PostgreSQL)

This project requires a PostgreSQL database.

**Install via Homebrew (MacOS):**
```bash
brew install postgresql@14
brew services start postgresql@14
```

**Configuration:**
Ensure your `.env` file has the correct connection string. For local development with Homebrew default settings:

```env
# Replace 'your_username' with your system username (whoami)
DATABASE_URL="postgresql://your_username@localhost:5432/poly_hunter_dev?schema=public"
```

**Run Migrations:**
Initialize the database schema:

```bash
npx prisma migrate dev
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Development Server

```bash
npm run dev
```

## Deployment & Operations

### Database Connection
When deploying (e.g., to Vercel, AWS, or similar), you must provide a valid PostgreSQL connection string via the `DATABASE_URL` environment variable.

Format:
`postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public`

**Note:** This project uses `@prisma/adapter-pg` which supports standard PostgreSQL connections. It does NOT require a proxy or specialized edge adapter unless explicitly configured.

### Database Operations

**Apply Migrations (Production):**
Run this command during your build process or release phase:

```bash
npx prisma migrate deploy
```

**Generate Client:**
Ensure the Prisma client is generated during build:
```bash
npx prisma generate
```

**Troubleshooting:**
If you encounter "Database locked" or concurrency errors, ensure your PostgreSQL instance has sufficient `max_connections` configured.
