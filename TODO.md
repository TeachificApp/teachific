# TODO

## Pro and Enterprise AI translation

Implement the feature described in
[`docs/pro-enterprise-ai-translation.md`](docs/pro-enterprise-ai-translation.md)
once application code is added to the repository.

### Backend

- Add plan gating so AI content translation is available only to Pro and
  Enterprise organizations.
- Add organization translation settings persistence.
- Add content translation persistence keyed by organization, content item,
  source version, and target language.
- Add language resolution from saved learner preference, browser language, and
  organization fallback language.
- Add AI translation generation with structured payload support.
- Add caching and stale-translation invalidation when source content changes.
- Add admin APIs for enabling/disabling translation, selecting languages,
  approving translations, regenerating translations, and saving manual
  overrides.

### Frontend

- Add organization admin translation settings.
- Add admin translation review and manual override screens.
- Add learner language picker.
- Render translated course pages, lessons, quizzes, certificates, and emails
  when available.
- Fall back to source-language content when translation is unavailable.

### Tests

- Cover plan gating for Free, Basic, Pro, and Enterprise plans.
- Cover organization enable/disable behavior.
- Cover saved-language, browser-language, and fallback-language resolution.
- Cover translation display priority: manual override, approved AI translation,
  unreviewed AI translation when review is disabled, and source content.
- Cover manual review required behavior.
- Cover stale translation invalidation after source content changes.
- Cover AI provider failure fallback.
