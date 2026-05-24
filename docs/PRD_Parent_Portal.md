# PRD 2: Parent Portal

## 1. Purpose

The parent portal helps parents understand their child's tutoring progress, attendance, homework completion, payments, and tutor feedback.

Parents are usually the paying customers, so this section needs to build trust.

The parent portal should answer:

- "Is my child attending?"
- "Are they doing homework?"
- "Are they improving?"
- "What am I paying for?"

## 2. Target Users

**Primary users:**
- parents
- guardians

**Secondary users:**
- admins
- tutors

## 3. Main Problems This Section Solves

| Problem | Solution |
|---------|----------|
| Parents do not know what happens in class | Lesson feedback and tutor comments |
| Parents do not know if child is improving | Progress reports and topic tracker |
| Parents forget payment dates | Invoice and payment dashboard |
| Parents need to reschedule classes | Make-up class request system |
| Parents message different people for help | Centralised communication system |

## 4. Parent Dashboard

### Feature Description
Parents should have a simple overview of their child's tutoring activity.

### Dashboard Should Display
- child name
- upcoming lesson
- attendance summary
- homework completion
- recent tutor feedback
- current learning focus
- progress snapshot
- payment status
- announcements

### If Parent Has Multiple Children
The parent should be able to switch between child profiles.

Example:
- Sarah — Year 8 Maths
- Daniel — Year 10 English
- Chloe — VCE Chemistry

### Reason for Implementation
Parents want fast and clear updates. They should not have to dig through multiple pages to understand how their child is going.

### Priority
**P0 — Must have**

## 5. Attendance Tracking

### Feature Description
Parents can view their child's attendance history.

### Functional Requirements
Parents can see:
- lesson date
- subject
- tutor
- attendance status
- late arrival
- absence reason, if recorded
- make-up class usage

### Attendance Statuses
- present
- absent
- late
- cancelled
- make-up completed

### Reason for Implementation
Attendance tracking creates accountability and prevents confusion around missed classes.

### Priority
**P0 — Must have**

## 6. Homework Completion Tracking

### Feature Description
Parents can see whether their child has completed homework.

### Functional Requirements
Parents can view:
- homework title
- subject
- due date
- submission status
- tutor feedback
- marked result, if applicable

### Reason for Implementation
Parents often want to know whether their child is putting in effort outside tutoring. This makes progress more transparent.

### Priority
**P0 — Must have**

## 7. Tutor Feedback

### Feature Description
After each lesson, parents receive a short tutor comment.

### Tutor Feedback Should Include
- topic covered
- student performance
- what the student did well
- what the student struggled with
- homework assigned
- next lesson focus

### Example
> "Today we covered linear equations. Sarah understood the basic steps well but needs more practice with negative numbers. I have assigned a worksheet to strengthen this before next lesson."

### Reason for Implementation
This is one of the strongest trust-building features. Parents can see that the tutor is paying attention and that the lesson has clear value.

### Priority
**P0 — Must have**

## 8. Progress Reports

### Feature Description
Parents can view monthly or termly student progress reports.

### Report Should Include
- attendance rate
- homework completion rate
- quiz results
- topics covered
- strengths
- weaknesses
- tutor comments
- recommended next steps

### Parent View Summary
Parents should see:
- easy summary
- strengths
- weaknesses
- attendance
- homework completion
- tutor recommendations

Parents do not need too much detail. They need a clear explanation of how their child is going.

### Reason for Implementation
Progress reports help parents understand whether tutoring is working. This can improve parent satisfaction and student retention.

### Priority
**P1 — Important after MVP**

## 9. Payments and Invoices

### Feature Description
Parents can view and manage payments.

### Functional Requirements
Parents should be able to:
- view invoices
- see payment due dates
- pay online
- download receipts
- view payment history
- see overdue balances
- update payment method
- receive payment reminders

### Payment Statuses
- unpaid
- paid
- overdue
- partially paid
- refunded
- cancelled

### Reason for Implementation
This reduces manual admin work and makes the payment process easier for parents.

### Priority
**P0 — Must have**

## 10. Booking and Make-Up Classes

### Feature Description
Parents can request reschedules or make-up classes.

### Functional Requirements
Parents can:
- request a make-up class
- see available sessions
- cancel a lesson, if allowed
- view cancellation policy
- book extra lessons
- join waitlists

### Admin Controls
Admin can:
- approve requests
- reject requests
- assign available class
- enforce make-up limits
- track unused make-up credits

### Reason for Implementation
Scheduling changes are one of the biggest admin burdens for tutoring companies. This system reduces manual back-and-forth.

### Priority
**P1 — Important after MVP**

## 11. Parent Messaging

### Feature Description
Parents can message the correct person depending on the issue.

### Message Categories

| Message type | Goes to |
|--------------|---------|
| Learning concern | Tutor |
| Payment issue | Admin |
| Reschedule request | Admin/system |
| General question | Admin |
| Feedback/complaint | Admin |

### Reason for Implementation
This keeps communication organised and prevents tutors from being overloaded with admin questions.

### Priority
**P1 — Important after MVP**

## 12. Notifications (Parent-relevant)

Parents receive in-app and email notifications for:
- homework assigned to child
- homework due soon
- homework marked
- lesson reminder
- class cancelled
- tutor feedback posted
- payment due
- payment overdue
- make-up class approved
- relevant announcements

## 13. Security and Permissions

| Feature | Parent |
|---------|--------|
| View own child's homework | Yes (child only) |
| Submit homework | No |
| View tutor feedback | Yes (child only) |
| Mark attendance | No |
| Create homework | No |
| View payments | Yes |
| Manage users | No |
| Manage classes | No |
| Send announcements | No |

### Additional Security Requirements
- secure login
- password reset
- parent-child account linking
- data privacy controls
- restricted to own children's data

## 14. Success Metrics

- Parent login rate
- Payment overdue rate
- Make-up request processing time
- Reduced admin messages
- Retention rate
