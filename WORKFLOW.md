# Course360 Build Workflow Rules

## Request Handling — STRICT ORDER

1. **Every user request gets logged to todo.md FIRST** before any code is written.
2. **Complete the current task fully** before starting the next one.
3. **The ONLY exception** is if the user explicitly marks a request as URGENT — in that case, pause current work, note the interruption in todo.md, complete the urgent task, then return to the previous task.
4. **When a new request arrives mid-task:** note it, add it to todo.md as a pending item, finish the current task and deliver results, then move to the new request in order.

## todo.md Sync Rules

- Mark items `[x]` **immediately** when the code is written and verified — not at checkpoint time.
- Never leave completed code with unchecked `[ ]` items.
- Read todo.md before every checkpoint to confirm all completed items are marked.
- Sections are completed in the order they appear in todo.md.

## Quality Rules (Efficiency)

- **Plan before coding:** Read all relevant existing files before writing new code to avoid conflicts.
- **No partial implementations:** Do not deliver a feature until it builds cleanly (0 TypeScript errors) and the UI renders correctly.
- **Test the happy path in browser** before marking an item done.
- **Reuse existing components** — check what already exists before building from scratch.
- **One checkpoint per completed feature** — not per file change.

## Priority Queue (as of Apr 3, 2026)

1. [ ] Group Manager System
2. [ ] Course Pre-Start Page
3. [ ] Policies System
4. [ ] WYSIWYG Section Library Modal
5. [ ] Platform Admin: Impersonation & Granular Editing
6. [ ] Course Reordering
7. [ ] Community Enhancements
8. [ ] Video Player Branding & Watermark
9. [ ] Record Tool (Loom-style) — deferred until all above complete
10. [ ] AI Course Generation Wizard — deferred until all above complete
