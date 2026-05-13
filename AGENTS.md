# Project Rules & Agent Instructions

## Database Synchronization
- All questions are primarily stored in `src/questions.ts` as `mcqData`.
- The backend (`server.ts`) is configured to automatically sync `mcqData` to Firestore whenever the total count in Firestore is less than the count in `src/questions.ts`.
- **Constraint**: Whenever the user provides a new question, you MUST add it to `src/questions.ts` with a unique, incrementing `id`. 
- After adding questions to `src/questions.ts`, the deployment/restart process will automatically push them to the live database.

## Subscription Access
- Users not in the `users` Firestore collection or marked as `not_subscribed` are limited to questions from the latest two years.
- Other questions will show a "Premium Question" lock template with instructions to contact the admin.
