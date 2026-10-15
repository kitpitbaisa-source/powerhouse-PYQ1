# Project Rules & Agent Instructions

## Database Synchronization
- All questions are primarily stored in `src/questions.ts` as `mcqData`.
- The backend (`server.ts`) is configured to automatically sync `mcqData` to Firestore whenever the total count in Firestore is less than the count in `src/questions.ts`.
- **Constraint**: Whenever the user provides a new question, you MUST add it to `src/questions.ts` with a unique, incrementing `id`. 
- After adding questions to `src/questions.ts`, the deployment/restart process will automatically push them to the live database.

## Subscription Access
- Users not in the `users` Firestore collection or marked as `not_subscribed` are limited to questions from the latest two years.
- Other questions will show a "Premium Question" lock template with instructions to contact the admin.

## Concept Extraction and Highlight Evidence
- Extract `highlight_evidence` alongside concepts for every new question profile, including agent-authored imports. Do not defer highlight extraction until similarity matching.
- Review the question stem, every option, and the supplied explanation for important phrases that name or describe each materially tested primary or supporting concept. Include materially relevant contrasts and distractors, not incidental words or answer-selection codes.
- Link each excerpt to its assigned `concept_id` and source `field`; option excerpts also require a zero-based `option_index`. Copy `exact_text` verbatim, preserving spelling, case, punctuation, and spacing. Keep excerpts short and renderable without spanning HTML tags.
- Reuse the same canonical concept ID across questions only when meaning and scope match. Preserve each question's own exact wording for highlights; do not force identical highlight text into differently worded questions.
- Include important source evidence even when a concept is not shared with another question. Do not restrict evidence to the correct option, a shared concept, or a canonical-name match.
- Before saving, check each assigned concept for available literal evidence and validate every excerpt against its source field. If a concept is implicit and no suitable literal phrase exists, leave it unhighlighted and explain the gap in `provenance.review_notes`; never invent evidence.
- Leave generic statement-code options unhighlighted when they contain no substantive concept phrase. Highlighting indicates a concept mention, not that an option is true or correct.

## Concept Granularity and Cross-Question Consistency
- Extract each independently tested fact, association, mechanism, or principle at a consistent, reusable scope. A statement or matching question must retain the concepts of its individual items; a broad topic or umbrella concept must not replace them.
- Check the canonical registry and related existing profiles before proposing a new ID. Reuse the same ID when a tested association appears as a standalone question, one matching pair, or one statement. For example, Senguttuvan's Chera affiliation must use the same concept in an identity question and a multi-ruler matching question.
- Preserve distinct associations within compound questions, including correctly matched pairs and incorrect claims evaluated using the supplied explanation. Keep claimed and source-supported relationships separate; sharing a concept does not endorse a false claim.
- Keep a useful umbrella concept as supporting context where appropriate, alongside the specific tested concepts. Do not merge broad and narrow concepts as aliases or assume a parent link automatically produces a shared-concept label: matching currently uses exact assigned `concept_id` overlap.
- Do not add a concept merely to increase similarity. Reuse requires materially tested meaning and scope, not just a shared entity, incidental explanation detail, or high embedding similarity.
- Bind each claim and highlight to its specific assigned concepts. Before saving, verify that repeated facts use consistent IDs, all materially tested items remain represented, and each highlight is an exact excerpt from its own question, option, or explanation.
- When changing concept assignments, validate the complete source-bound extraction and regenerate the affected embedding through the import pipeline. Do not patch only a displayed label, canonical name, or stored vector.
