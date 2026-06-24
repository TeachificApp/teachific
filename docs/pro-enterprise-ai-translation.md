# Pro and Enterprise AI translation

## Goal

Display Teachific learning content in the end user's preferred language for
organizations on Pro and Enterprise plans. Organization administrators can
enable or disable AI translation, review generated translations, and override
translations manually.

This feature covers two translation layers:

1. **UI chrome**: buttons, navigation, labels, validation messages, and status
   messages such as "Mark Complete", "Next Lesson", "Submit Quiz", and
   "Enroll Now".
2. **Course content**: course titles, descriptions, lesson text, quiz
   questions, landing page blocks, certificates, emails, and other
   organization-authored content.

## Availability

AI translation is a paid feature.

| Plan | AI content translation |
| --- | --- |
| Free | Not available |
| Basic | Not available |
| Pro | Available |
| Enterprise | Available |

## Organization controls

Each organization has a translation settings page visible to organization
administrators.

Required settings:

- **Enable AI translation**: turns the feature on or off for the organization.
- **Allowed languages**: languages learners may receive for course content.
- **Default fallback language**: language used when a requested translation is
  unavailable.
- **Manual review required**: when enabled, generated translations are not shown
  to learners until an admin approves them.
- **Manual overrides**: admins can edit translated text for any supported
  language.

The settings page must be hidden or disabled for organizations that are not on
Pro or Enterprise plans.

## Learner language selection

When AI translation is enabled for the organization:

1. Use the learner's saved language preference when present.
2. Otherwise detect the browser language from `navigator.language`.
3. Match the detected language against the organization's allowed languages.
4. Fall back to the organization's default language when there is no match.

Learners should also be able to manually choose a language from the allowed
languages list. The chosen language becomes their saved preference.

## Translation lifecycle

Course content is translated on demand and cached per organization, content
item, source version, and target language.

Recommended states:

- `pending`: translation has been requested but not completed.
- `machine_translated`: AI-generated translation is available.
- `approved`: translation has been approved for learner display.
- `manually_overridden`: an admin-edited translation is available.
- `failed`: translation failed and should fall back to source language.

Display priority:

1. Manual override for the selected language.
2. Approved AI translation.
3. AI translation when manual review is not required.
4. Source-language content.

When source content changes, existing translations for that content version
should be marked stale and regenerated or re-reviewed before learner display.

## Data model requirements

Add persistent records equivalent to:

### Organization translation settings

- `organization_id`
- `enabled`
- `allowed_languages`
- `default_language`
- `manual_review_required`
- `created_at`
- `updated_at`

### Content translations

- `organization_id`
- `content_type`
- `content_id`
- `source_locale`
- `target_locale`
- `source_version`
- `translated_payload`
- `status`
- `provider`
- `translated_at`
- `approved_at`
- `approved_by`
- `overridden_at`
- `overridden_by`
- `created_at`
- `updated_at`

`translated_payload` should preserve the structure of the source content rather
than flattening rich lesson, quiz, or landing-page data into ad hoc strings.

## Permission requirements

- Organization admins can enable or disable AI translation for eligible plans.
- Organization admins can approve translations and create manual overrides.
- Learners can select only languages allowed by their organization.
- Learners cannot access translation settings, review queues, provider metadata,
  or translation prompts.

## AI provider requirements

- Do not send organization secrets or learner private data to the translation
  provider.
- Keep source formatting and placeholder tokens intact.
- Return structured JSON for structured course content.
- Record provider failures without blocking access to source-language content.
- Cache completed translations to avoid repeatedly translating the same content.

## UI requirements

### Admin settings

- Show plan-gated controls on organization settings.
- Explain that AI translation is available on Pro and Enterprise plans.
- Allow admins to enable or disable translation for their organization.
- Allow admins to configure allowed languages and fallback language.
- Allow admins to require manual review before translated content is visible.

### Admin review

- List pending and stale translations.
- Show source content and translated content side by side.
- Allow approve, reject/regenerate, and manual edit actions.

### Learner experience

- Detect browser language automatically on first visit.
- Show a language picker when more than one allowed language exists.
- Display translated course pages, lessons, quizzes, certificates, and emails
  when translations are available.
- Fall back gracefully to source language when translation is unavailable.

## Acceptance criteria

- Free and Basic organizations cannot enable AI content translation.
- Pro and Enterprise organization admins can enable or disable AI translation.
- Admins can choose the organization's allowed learner languages.
- Learners receive content in their saved or browser-detected language when the
  organization enables AI translation and the language is allowed.
- AI-generated translations are cached per content version and target language.
- Admin manual overrides take precedence over generated translations.
- Manual review mode prevents unapproved machine translations from appearing to
  learners.
- Source-language content remains available if translation generation fails.
- Source content updates invalidate stale translations.
- Tests cover plan gating, language resolution, translation fallback order,
  manual overrides, review-required behavior, and source update invalidation.

## Initial language set

Start with these languages unless the product team narrows the list:

- English
- Spanish
- French
- Portuguese
- German
- Arabic
- Chinese
- Japanese
- Korean
