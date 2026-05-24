# PRD 1: Student Portal

## 1. Purpose

The student portal helps students stay organised, complete homework, access resources, review lesson content, and track their own learning progress.

The student side should be simple and not overloaded. Students should immediately understand:

- "What class do I have next?"
- "What homework do I need to do?"
- "What did I learn?"
- "What should I revise?"

## 2. Target Users

**Primary users:**
- primary school students
- high school students
- VCE students
- online tutoring students
- in-person tutoring students

**Secondary users:**
- tutors who monitor student activity
- parents who view student progress

## 3. Main Problems This Section Solves

| Problem | Solution |
|---------|----------|
| Students forget homework | Homework page with due dates and submission status |
| Students forget lesson content | Lesson notes and summaries after each class |
| Students do not know what to revise | Progress tracker and recommended resources |
| Students lose worksheets | Digital resource library |
| Students are unsure about class times | Timetable and upcoming lesson dashboard |
| Students need help outside class | Ask-a-tutor or homework help feature |

## 4. Student Dashboard

### Feature Description
When students log in, they should land on a dashboard showing the most important information.

### Dashboard Should Display
- student name
- next class
- subject
- tutor name
- class time
- class location or online link
- homework due
- recent lesson recap
- unread tutor messages
- progress snapshot
- recommended next task

### Example Dashboard Layout
```
Welcome back, Sarah
Next class: Year 9 Maths
Time: Saturday 10:00am
Tutor: Mr Lee
Homework due: Algebra Worksheet 3
Current focus: Linear equations
Progress: 72% topic mastery
Next task: Complete Quiz 2 before Friday
```

### Reason for Implementation
The dashboard reduces confusion and gives the student a clear action plan. Students should not need to search around the portal to know what to do next.

### Priority
**P0 — Must have**

## 5. Timetable / Schedule

### Feature Description
Students can view upcoming and past lessons.

### Functional Requirements
Students should be able to see:
- lesson date
- start and end time
- subject
- tutor
- location
- online meeting link
- lesson status
- make-up class details, if applicable

### Lesson Statuses
- upcoming
- completed
- cancelled
- missed
- rescheduled
- make-up class

### Reason for Implementation
This reduces the need for students or parents to message admin asking about lesson times or locations.

### Priority
**P0 — Must have**

## 6. Homework System

### Feature Description
Students can view, download, complete, and submit homework.

### Functional Requirements
Students should be able to:
- view assigned homework
- see due dates
- download worksheets
- upload completed work
- type answers directly, if applicable
- see submission status
- receive tutor feedback
- resubmit if allowed

### Homework Statuses
- not started
- viewed
- submitted
- late
- marked
- returned
- resubmission requested

### Reason for Implementation
Homework is one of the main ways tutoring continues outside the lesson. A digital homework system creates accountability and gives parents visibility.

### Priority
**P0 — Must have**

## 7. Lesson Notes and Recaps

### Feature Description
Students can access a summary after each lesson.

### Functional Requirements
Each lesson recap should include:
- topic covered
- key concepts
- worked examples
- common mistakes
- homework assigned
- what to revise
- tutor comment

### Reason for Implementation
Students often forget what they learned after tutoring. Lesson recaps give them something to revise and make each lesson feel structured.

### Priority
**P0 — Must have**

## 8. Resource Library

### Feature Description
Students can access learning materials by subject, year level, and topic.

### Resource Types
- worksheets
- answer sheets
- notes
- videos
- quizzes
- past papers
- formula sheets
- writing templates
- exam guides

### Filters
Students should be able to filter by:
- subject
- year level
- topic
- difficulty
- resource type

### Reason for Implementation
This gives students support outside class and makes the tutoring company feel more complete, like a proper learning platform.

### Priority
**P1 — Important after MVP**

## 9. Practice Quizzes

### Feature Description
Students can complete short quizzes for different topics.

### Functional Requirements
Students should be able to:
- start a quiz
- answer questions
- submit quiz
- see score
- review incorrect answers
- view worked solutions
- receive recommended resources

### Quiz Data Stored
- quiz score
- time taken
- number of attempts
- correct/incorrect answers
- topic mastery percentage

### Reason for Implementation
Quizzes help identify weak areas and provide useful learning data for tutors and parents.

### Priority
**P1 — Important after MVP**

## 10. Progress Tracker

### Feature Description
Students can see their learning progress across subjects and topics.

### Example Progress Table

| Topic | Status |
|-------|--------|
| Fractions | Strong |
| Algebra | Improving |
| Linear equations | Needs work |
| Geometry | Not started |

### Functional Requirements
Progress should be based on:
- tutor ratings
- quiz results
- homework completion
- attendance
- manual tutor updates

### Reason for Implementation
Students need to see improvement to stay motivated. It also helps them understand what to focus on next.

### Priority
**P1 — Important after MVP**

## 11. Ask-a-Tutor / Homework Help

### Feature Description
Students can ask questions outside class.

### Functional Requirements
Students can:
- type a question
- upload an image/PDF
- select subject/topic
- send question to tutor
- receive reply
- view question history

### Limits
To avoid tutor overload:
- limit questions per week
- admin can monitor questions
- tutors can mark questions as answered
- response time expectations should be clear

### Reason for Implementation
This gives extra support outside the lesson and increases perceived value.

### Priority
**P2 — Later version**

## 12. Notifications (Student-relevant)

Students receive in-app and email notifications for:
- homework assigned
- homework due soon
- homework marked
- lesson reminder
- class cancelled
- relevant announcements

## 13. Security and Permissions

| Feature | Student |
|---------|---------|
| View own homework | Yes |
| Submit homework | Yes |
| View tutor feedback | Yes |
| Mark attendance | No |
| Create homework | No |
| View payments | No |
| Manage users | No |
| Manage classes | No |
| Send announcements | No |

Students access only their own data via secure login with role-based permissions.

## 14. Success Metrics

- Student login rate
- Homework submission rate
- Attendance rate
- Quiz completion rate
- Topic mastery improvement over time
