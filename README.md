🚀 Project Template – Auth + Layout + Proxy + DB Setup

Base project template including:
✅ Better Auth

✅ Prisma ORM

✅ PostgreSQL (Neon)

✅ Auth Layout + Navigation

✅ Proxy configuration

✅ Ready for social providers

✅ Production-ready structure

📦 Installation Clone the repository:

```bash
git clone <your-repo-url> new name
cd your-project-name
````

Install dependencies using pnpm:
```bash
pnpm install
```

🔐 Environment Variables 
Create your .env file:

cp .env.example .env

If .env.example does not exist, create a .env file manually and add:

# Database
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require"

# Better Auth
BETTER_AUTH_SECRET="your-random-secret"

BETTER_AUTH_URL="http://localhost:3000"

# Optional - Google Provider
GOOGLE_CLIENT_ID=""

GOOGLE_CLIENT_SECRET=""

# Optional - Microsoft Provider
MICROSOFT_CLIENT_ID=""

MICROSOFT_CLIENT_SECRET=""

🗄 Database Setup (Neon PostgreSQL)

1️⃣ Create a Neon account

Go to: [https://neon.tech](https://neon.tech)

Create a new project.

2️⃣ Get your PostgreSQL connection string

Inside Neon dashboard:

Go to your project

Click Dashboard

Copy the Connection String

It looks like: `postgresql://user:password@ep-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require`

Paste that inside in your .env.:

DATABASE_URL=

🧠 Prisma Setup
After setting DATABASE_URL, run:

```bash
npx prisma generate
```

You should run this:
✅ After installing dependencies (first time)

✅ After modifying schema.prisma

✅ After pulling schema changes

If this is the first time setting up the DB:

```bash
npx prisma db push
```

Or if you're using migrations:
```bash
npx prisma migrate dev
```

🔑 Better Auth Setup

This project uses: [https://www.better-auth.com/docs/installation](https://www.better-auth.com/docs/installation)

If you need to reconfigure auth, refer to their official documentation.

Make sure:

BETTER_AUTH_SECRET is a long random string

BETTER_AUTH_URL matches your local or production URL

You can generate a secret using: openssl rand -base64 32

🌍 Social Providers (Optional)

Google Provider

Go to:[https://console.cloud.google.com/](https://console.cloud.google.com/)

Create a project

Go to APIs & Services → Credentials

Create OAuth 2.0 Client ID

Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`

Copy:

GOOGLE_CLIENT_ID=

GOOGLE_CLIENT_SECRET=

Microsoft Provider

Go to:[https://portal.azure.com/](https://portal.azure.com/)

Azure Active Directory → App registrations

New registration

Add redirect URI: `http://localhost:3000/api/auth/callback/microsoft`

Copy:

MICROSOFT_CLIENT_ID=

MICROSOFT_CLIENT_SECRET=

▶️ Run the Project

After everything is configured:

```bash
pnpm dev
```

App should be running at: `http://localhost:3000`

📁 Recommended Workflow for New Projects

Clone this template

Rename project in package.json

Update .env

Run:

```bash
pnpm install
npx prisma generate
pnpm dev
```

🧱 Production Checklist
 Set production DATABASE_URL
 
 Set production BETTER_AUTH_SECRET
 
 Update BETTER_AUTH_URL
 
 Configure OAuth redirect URLs for production domain
 
 Run prisma migrate deploy in production
