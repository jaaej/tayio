# PRD 4: Admin Portal

## 1. Purpose

The admin portal allows the tutoring company to manage users, classes, enrolments, payments, resources, schedules, announcements, and reports.

The admin section is the control centre of the platform.

It should answer:

- "Who is enrolled?"
- "Who is teaching?"
- "Who has paid?"
- "Which classes are full?"
- "Which students are falling behind?"

## 2. Target Users

**Primary users:**
- business owner
- admin staff
- operations team
- centre manager

**Secondary users:**
- tutors
- finance staff

## 3. Main Problems This Section Solves

| Problem | Solution |
|---------|----------|
| Manual enrolment tracking | Digital enrolment management |
| Class schedule confusion | Central class management |
| Payment chasing | Invoice/payment system |
| Parent messages scattered | Admin inbox |
| No visibility over student progress | Reporting dashboard |
| Tutors not submitting notes | Admin task tracking |

## 4. Admin Dashboard

### Feature Description
Admins should see the health of the tutoring business.

### Dashboard Should Display
- total active students
- new enrolments
- upcoming classes
- pending make-up requests
- overdue payments
- attendance issues
- tutor notes not submitted
- parent messages
- class capacity
- revenue snapshot

### Reason for Implementation
Admins need a high-level overview to manage daily operations efficiently.

### Priority
**P0 — Must have**

## 5. User Management

### Feature Description
Admins can create and manage all accounts.

### Functional Requirements
Admins can manage:
- student accounts
- parent accounts
- tutor accounts
- admin accounts
- family links
- role permissions
- login access
- password resets

### Reason for Implementation
Role-based access is essential because each user type should only see information relevant to them.

### Priority
**P0 — Must have**

## 6. Class and Schedule Management

### Feature Description
Admins can create and manage classes.

### Functional Requirements
Admins can:
- create classes
- set subject/year level
- assign tutor
- set class capacity
- choose location/online link
- add/remove students
- reschedule classes
- cancel classes
- create recurring lessons

### Reason for Implementation
Tutoring companies often have many classes across different subjects, tutors, and locations. A central scheduling system reduces confusion.

### Priority
**P0 — Must have**

## 7. Enrolment Management

### Feature Description
Admins can manage student enrolments.

### Functional Requirements
Admins can:
- enrol students
- move students between classes
- withdraw students
- manage trial lessons
- approve parent requests
- manage waitlists
- change subjects or year levels

### Reason for Implementation
Enrolments are one of the core business operations. This needs to be smooth and easy to update.

### Priority
**P0 — Must have**

## 8. Payment and Invoice Management

### Feature Description
Admins can manage billing.

### Functional Requirements
Admins can:
- create invoices
- track paid/unpaid invoices
- send reminders
- process refunds
- apply discounts
- view payment history
- export payment reports
- mark manual payments

### Payment Statuses
- unpaid
- paid
- overdue
- partially paid
- refunded
- cancelled

### Reason for Implementation
Payments are a major admin task. Automating this saves time and reduces missed payments.

### Priority
**P0 — Must have**

## 9. Announcement System

### Feature Description
Admins can send updates to specific users or groups.

### Announcement Audiences
- all students
- all parents
- all tutors
- specific class
- specific year level
- specific subject
- specific campus

### Announcement Types
- general update
- class cancellation
- payment reminder
- holiday program announcement
- exam reminder
- event notice
- policy update

### Reason for Implementation
This reduces scattered communication and makes sure important updates are sent to the correct people.

### Priority
**P0 — Must have**

## 10. Make-Up Class Management

### Feature Description
Admins can manage make-up and reschedule requests.

### Functional Requirements
Admins can:
- view requests
- approve/reject requests
- assign make-up class
- track make-up credits
- enforce cancellation policy
- prevent overbooking

### Reason for Implementation
Make-up classes can become messy if handled manually. This system makes rescheduling clearer and more organised.

### Priority
**P1 — Important after MVP**

## 11. Reporting Dashboard

### Feature Description
Admins can view performance reports.

### Reports Should Include
- attendance rate
- homework completion rate
- tutor note completion
- student progress
- revenue
- overdue payments
- class capacity
- student retention
- churn risk
- tutor workload

### Admin Progress View
Admins should see:
- students at risk
- classes with low homework completion
- tutors who have not submitted notes
- subjects with poor results
- retention risk

### Reason for Implementation
Reports help the business make better decisions and identify problems early.

### Priority
**P1 — Important after MVP**

## 12. Resource Approval and Management

### Feature Description
Admins can manage the learning resource library.

### Functional Requirements
Admins can:
- upload resources
- approve tutor-uploaded resources
- organise resources by subject/topic/year
- remove outdated resources
- mark resources as public/private
- assign resources to classes

### Reason for Implementation
This keeps content quality consistent and prevents students from seeing incorrect or unfinished resources.

### Priority
**P1 — Important after MVP**

## 13. Communication and Notifications (Admin View)

Admins control:
- in-app notifications
- email notifications
- (later) SMS, push notifications, calendar sync

### Notification Types Admins Manage or Receive

| Notification | Sent to |
|--------------|---------|
| Homework assigned | Student, parent |
| Homework due soon | Student, parent |
| Homework marked | Student, parent |
| Lesson reminder | Student, parent |
| Class cancelled | Student, parent, tutor |
| Tutor feedback posted | Parent |
| Payment due | Parent |
| Payment overdue | Parent |
| Make-up class approved | Parent, student, tutor |
| Announcement posted | Relevant users |

## 14. Security and Permissions

| Feature | Admin |
|---------|-------|
| View own homework | All |
| Submit homework | Admin override |
| View tutor feedback | All |
| Mark attendance | Yes |
| Create homework | Yes |
| View payments | Yes |
| Manage users | Yes |
| Manage classes | Yes |
| Send announcements | Yes |

### Security Requirements
The portal should include:
- secure login
- password reset
- role-based permissions
- parent-child account linking
- data privacy controls
- audit logs for admin actions
- restricted tutor access to only assigned students

### Priority
**P0 — Must have**

## 15. Suggested MVP Build Order (Admin-driven Rollout)

**Phase 1: Core portal foundation**
- login system
- role-based accounts
- student/parent/tutor/admin dashboards
- class schedule
- user management

**Phase 2: Learning workflow**
- homework assignment/submission
- lesson notes
- tutor feedback
- attendance marking
- parent visibility

**Phase 3: Admin operations**
- enrolments
- class management
- announcements
- basic invoices
- make-up class requests

**Phase 4: Value-added learning features**
- resource library
- quizzes
- progress tracker
- reports
- study recommendations

**Phase 5: Advanced features**
- AI summaries
- automated reports
- mobile app
- SMS reminders
- tutor payroll
- study streaks/badges
- parent workshops/events
- calendar sync

## 16. Success Metrics

| Metric | Why it matters |
|--------|----------------|
| Student login rate | Shows if students actually use the portal |
| Homework submission rate | Shows learning engagement |
| Parent login rate | Shows parent involvement |
| Tutor note completion rate | Shows tutor adoption |
| Payment overdue rate | Shows admin/payment efficiency |
| Reduced admin messages | Shows portal is saving time |
| Attendance rate | Shows student consistency |
| Retention rate | Shows whether families stay longer |
| Make-up request processing time | Shows operational efficiency |

## 17. Overall Goals (Admin Perspective)

The portal should be designed around four main goals:

1. Help students stay organised and improve
2. Help parents clearly see value
3. Help tutors teach and track students properly
4. Help admins reduce manual work and manage the business

The portal should not just store information. It should create a better tutoring experience by making learning, communication, progress, and admin easier for everyone.
