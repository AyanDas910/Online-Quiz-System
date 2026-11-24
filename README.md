# Online Quiz System

A structured, server-timed quiz application using HTML, CSS, JavaScript, Node.js, Express and MySQL.

## Features
- Student registration/login with bcrypt password hashing and JWT authentication
- Role-based admin/student access
- Admin quiz, question and answer management
- Server-controlled quiz deadlines (client timer is display-only)
- Questions are served without correct answers
- Server-side scoring and persistent attempts/results
- MySQL foreign keys, unique constraints, indexes and normalized tables
- Input validation, centralized errors, rate limiting, Helmet and parameterized SQL

## Requirements
- Node.js 18+
- MySQL 8+

## Setup
1. Extract the ZIP and open this folder in VS Code.
2. Copy `.env.example` to `.env` and set your database credentials and a long JWT secret.
3. Create the database and tables:
   ```bash
   mysql -u root -p < database/schema.sql
   ```
4. Install dependencies:
   ```bash
   npm install
   ```
5. Create the first admin account:
   ```bash
   npm run create-admin
   ```
   Follow the prompts.
6. Start the server:
   ```bash
   npm run dev
   ```
7. Open `http://localhost:3000`.

## Default workflow
- Register a student account from the UI.
- Sign in as admin using the account created with `npm run create-admin`.
- Create a quiz, add questions and options, then publish it.
- Sign in as a student, start the quiz and submit before the server deadline.

## API overview
| Method | Endpoint | Access |
|---|---|---|
| POST | `/api/auth/register` | Public |
| POST | `/api/auth/login` | Public |
| GET | `/api/quizzes` | Student/Admin |
| GET | `/api/quizzes/:id` | Student/Admin |
| POST | `/api/quizzes` | Admin |
| PATCH | `/api/quizzes/:id` | Admin |
| POST | `/api/quizzes/:id/questions` | Admin |
| POST | `/api/quizzes/:id/publish` | Admin |
| POST | `/api/quizzes/:id/start` | Student |
| POST | `/api/attempts/:id/submit` | Student |
| GET | `/api/attempts/:id` | Owner/Admin |
| GET | `/api/results/me` | Student |
| GET | `/api/admin/results` | Admin |

## Important security notes
- Never expose answer keys in quiz-taking API responses.
- The authoritative deadline is stored in MySQL and checked on the server.
- The client countdown is only a convenience; changing browser time does not extend an attempt.
- Use HTTPS, a production secret manager, backups, and a managed MySQL instance in production.
- For production, add email verification, password reset, audit logs, CSRF protection if using cookies, and automated tests.
