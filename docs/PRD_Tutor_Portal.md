# PRD 3: Tutor Portal

## 1. Purpose

The tutor portal helps tutors manage lessons, students, attendance, homework, feedback, and progress.

The tutor portal should make teaching easier, not create extra work.

It should answer:

- "Who am I teaching today?"
- "What does this student need help with?"
- "What homework do I need to mark?"
- "What feedback do I need to leave?"

## 2. Target Users

**Primary users:**
- tutors
- teachers
- teaching assistants

**Secondary users:**
- admins
- students
- parents

## 3. Main Problems This Section Solves

| Problem | Solution |
|---------|----------|
| Tutors forget student details | Student profiles |
| Tutors do not have lesson history | Past lesson notes |
| Tutors manually track attendance | Attendance marking tool |
| Tutors forget homework follow-up | Homework dashboard |
| Feedback is inconsistent | Lesson note templates |
| Admin has to chase tutor updates | Required post-lesson forms |

## 4. Tutor Dashboard

### Feature Description
Tutors should see their teaching tasks for the day.

### Dashboard Should Display
- today's classes
- student list
- room/location/link
- pending homework to mark
- unread messages
- lesson plans
- incomplete lesson notes
- upcoming assessments

### Reason for Implementation
Tutors need fast access to the information that helps them teach. The dashboard should reduce preparation time.

### Priority
**P0 - Must have**

## 5. Schedule and Class List

### Feature Description
Tutors can view their assigned classes.

### Functional Requirements
Tutors can see:
- date and time
- subject
- class type
- student names
- location
- online link
- make-up students
- class notes

### Reason for Implementation
This keeps tutors organised and helps them prepare before each session.

### Priority
**P0 - Must have**

## 6. Student Profiles

### Feature Description
Tutors can view student information relevant to teaching.

### Student Profile Should Include
- student name
- year level
- school
- subject
- learning goals
- strengths
- weaknesses
- attendance history
- homework history
- quiz results
- past lesson notes
- parent concerns, if relevant

### Reason for Implementation
Tutors often teach many students. Student profiles help tutors personalise lessons and avoid starting from scratch every time.

### Priority
**P0 - Must have**

## 7. Attendance Marking

### Feature Description
Tutors can mark attendance for each lesson.

### Functional Requirements
Tutors can mark students as:
- present
- absent
- late
- left early
- attended make-up class

### Reason for Implementation
Attendance is needed for parent transparency, admin records, and make-up class management.

### Priority
**P0 - Must have**

## 8. Lesson Note Templates

### Feature Description
Tutors fill in a short lesson summary after class.

### Lesson Note Fields
- topic covered
- student performance
- what the student did well
- what the student struggled with
- homework assigned
- next lesson focus
- internal tutor note
- parent-visible comment

### Important Distinction
There should be two types of notes:

| Note type | Visible to |
|-----------|------------|
| Parent-visible comment | Parent and student |
| Internal tutor note | Tutor/admin only |

### Reason for Implementation
Not all notes should be visible to parents. Tutors may need internal notes about behaviour, learning difficulties, or future teaching strategy.

### Priority
**P0 - Must have**

## 9. Homework Assignment and Marking

### Feature Description
Tutors can assign and mark homework.

### Functional Requirements
Tutors can:
- upload homework
- choose due date
- assign to one student or whole class
- view submissions
- mark work
- leave feedback
- request resubmission
- notify parent/student

### Reason for Implementation
This completes the homework loop and creates accountability.

### Priority
**P0 - Must have**

## 10. Resource Management

### Feature Description
Tutors can access or upload learning resources.

### Functional Requirements
Tutors can:
- browse resources
- upload worksheets
- upload answer sheets
- tag resources by topic/year/subject
- assign resources to students
- save favourite resources

### Admin Approval
Depending on business rules, admin may need to approve uploaded resources before students can see them.

### Reason for Implementation
A shared resource library improves teaching quality and consistency across tutors.

### Priority
**P1 - Important after MVP**

## 11. Tutor Messaging

### Feature Description
Tutors can communicate with students and parents in a controlled way.

### Functional Requirements
Tutors can:
- reply to student questions
- message parents about learning issues
- use message templates
- flag admin if needed

### Reason for Implementation
This keeps learning communication inside the portal rather than scattered across SMS, email, or personal accounts.

### Priority
**P1 - Important after MVP**

## 12. Tutor Availability and Timesheets

### Feature Description
Tutors can manage availability and work records.

### Functional Requirements
Tutors can:
- update availability
- request leave
- view assigned shifts
- submit hours
- view approved hours
- see payroll summary, if allowed

### Reason for Implementation
This helps the business manage staff scheduling and payroll.

### Priority
**P2 - Later version**

## 13. Tutor Progress View

Tutors should see, per student:
- weak topics
- previous notes
- quiz performance
- homework trends
- recommended lesson focus

## 14. Notifications (Tutor-relevant)

Tutors receive in-app and email notifications for:
- class cancelled
- new homework submissions to mark
- make-up class approved/assigned
- parent/student messages
- incomplete lesson notes reminders
- relevant announcements

## 15. Security and Permissions

| Feature | Tutor |
|---------|-------|
| View own homework | Assigned students only |
| Submit homework | No |
| View tutor feedback | Assigned students only |
| Mark attendance | Yes |
| Create homework | Yes |
| View payments | No |
| Manage users | No |
| Manage classes | Limited |
| Send announcements | Limited |

### Additional Security Requirements
- restricted tutor access to only assigned students
- secure login with role-based permissions
- audit logs for sensitive actions

## 16. Success Metrics

- Tutor note completion rate
- Homework marking turnaround time
- Attendance marking compliance
- Student progress trends per tutor
- Reduced admin chasing
