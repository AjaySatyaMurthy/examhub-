# ExamHub - Online Examination Management System

## About the Project

ExamHub is a web-based examination management system built for educational institutions. It handles the entire exam workflow from creating exams and adding questions to letting students take MCQ exams online with automatic grading and result generation. There are three user roles - Admin, Faculty, and Student - each with their own dashboard and set of features.

## What It Does

### Admin Panel
- Manage faculty and student accounts
- Create and manage departments, subjects, and exams
- Add MCQ questions to exams
- Generate hall tickets in bulk for eligible students
- View results and analytics (exam-wise and department-wise performance)

### Faculty Panel
- Add and edit MCQ questions for exams
- Enter marks for students manually
- View results for their exams

### Student Panel
- Register and log in
- Browse available exams based on department and semester
- Take exams with a countdown timer (answers auto-save via AJAX)
- Get instant results after submission with answer review
- View and download hall tickets

## Tech Stack

- **Backend:** Node.js with Express.js
- **Database:** MySQL (using mysql2 driver with connection pooling)
- **Frontend:** EJS templates (server-side rendering), vanilla JavaScript, custom CSS
- **Authentication:** express-session for session management, bcryptjs for password hashing
- **Other Libraries:** multer (file uploads), dotenv (env config), jsonwebtoken (configured but not actively used)

## Project Structure

```
app.js                     - Main entry point, sets up Express server and middleware
config/db.js               - MySQL connection pool configuration
middleware/auth.js          - Auth and role-based access control middleware
routes/
  auth.js                  - Login, registration, and logout
  admin.js                 - All admin routes (users, exams, questions, hall tickets, etc.)
  faculty.js               - Faculty routes (questions, marks entry, results)
  student.js               - Student routes (exams, take exam, results, hall tickets)
database/schema.sql        - MySQL schema with all tables and seed data
views/
  login.ejs, register.ejs  - Auth pages
  admin/                   - Admin dashboard and management pages
  faculty/                 - Faculty dashboard and pages
  student/                 - Student dashboard and exam pages
  partials/                - Shared header, sidebar, footer
public/
  css/style.css            - Stylesheet
  js/app.js                - Client-side JS for timer, answer saving, etc.
```

## Database Tables

The app uses 12 MySQL tables:

- **users** - Stores all user accounts (admin, faculty, student) with hashed passwords
- **departments** - Department list (CSE, ECE, MECH, CIVIL, IT)
- **students** - Student details like roll number, department, and semester
- **subjects** - Subjects mapped to departments and semesters
- **faculty_subjects** - Links faculty members to the subjects they teach
- **exams** - Exam details including date, time, duration, total/passing marks, status
- **questions** - MCQ questions with 4 options and the correct answer
- **exam_attempts** - Tracks whether a student's attempt is in progress or submitted
- **student_answers** - Stores each answer a student picks during an exam
- **hall_tickets** - Generated hall tickets with unique ticket numbers
- **marks** - Manual marks entered by faculty
- **results** - Final results with marks obtained, percentage, grade, and pass/fail status

### Grading System
- 90%+ = A+, 80%+ = A, 70%+ = B+, 60%+ = B, 50%+ = C, 40%+ = D, Below 40% = F, Absent = AB

## How Authentication Works

- Uses session-based auth (not token-based)
- When a user logs in, their info (id, name, email, role) gets stored in the session
- Passwords are hashed using bcryptjs with 10 salt rounds
- Sessions last 24 hours with httpOnly cookies
- Middleware functions check the user's role before allowing access to routes

## How to Run

1. Set up a MySQL database and import the schema:
   ```
   mysql -u root -p < database/schema.sql
   ```

2. Create a `.env` file with your database credentials:
   ```
   PORT=3000
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=yourpassword
   DB_NAME=exam_management
   SESSION_SECRET=your_secret_key
   ```

3. Install dependencies and start the server:
   ```
   npm install
   npm run dev
   ```

4. Open `http://localhost:3000` in your browser. Default admin login is `admin@exam.com` / `admin123`.

## How the Exam Flow Works

1. Admin creates an exam and assigns it to a subject/department
2. Admin or faculty adds MCQ questions to the exam
3. Admin generates hall tickets for eligible students
4. Student logs in and sees available exams for their department/semester
5. Student starts the exam - a timer begins counting down
6. As the student selects answers, they get saved to the server via AJAX calls
7. When the student submits (or time runs out), the system auto-grades the MCQs
8. A result record is created with marks, percentage, and grade
9. Student can immediately view their result along with correct/incorrect answers
