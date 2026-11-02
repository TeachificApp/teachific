# Course360 Product Requirements Reference

## Screenshots Analysis (iSpring QuizMaker reference)

### QuizMaker Features Observed:
- **Form View + Slide View** toggle
- **Question Groups**: Intro Group, TRUE-FALSE (4 questions), SIC Questions (0/0), Image Questions (9/84)
- **Intro Slide**: Title, Description, audio button
- **User Info Form**: "Enter Your Details" slide
- **Question types**: True/False, Multiple Choice, Image-based questions
- **Shuffle questions** per group (shuffle icon with count)
- **Slide View**: Full PowerPoint-like slide editor with Layout, Columns, Text Styles, Font, Paragraph, Drawing, Shape tools
- **Quiz Properties dialog**: General Properties, Quiz Scoring, Question Properties, Question List, Reporting
  - Title and Size: quiz title, slide size (960x540 16:9), width/height, keep aspect ratio
  - Time Limit: time to complete quiz (mm:ss)
- **Player customization**: Features tab (Progress Info: show question number, show awarded points; Question List: show question list, show results; Quiz Player: font, corner radius), Navigation, Color Scheme, Text
- **Import/Export** player settings
- **Translation** button
- **Properties** button  
- **Player** button
- **Preview** button
- **Publish** button

### iSpring Suite (Course360Creator reference) Features:
- PowerPoint ribbon add-in tab
- Record Audio, Record Video, Edit Narration
- Quiz (QuizMaker built-in)
- Interaction, Role-Play
- Screen Recording
- AI-Generated Image
- YouTube, Web Object
- Slide Templates, Characters, Backgrounds, Objects, Icons
- Preview, Publish

## Confirmed Product Structure

### Course360Creator™ Desktop App - $117/mo
- Standalone Electron app (Windows + Mac)
- Full slide-based course authoring (purpose-built for eLearning)
- Import .pptx files, export to SCORM/HTML5/.pptx
- **Built-in QuizMaker** (full feature set as shown in screenshots)
- **Built-in Course360Studio** (screen recording + video editing)
- Content Library: Characters, Backgrounds, Objects, Icons
- AI Image Generation
- Role-Play / Dialogue builder
- Interactions (Steps, Timeline, Process, Cyclic, Catalog)
- Login-based activation (email/password through Course360)
- 14-day free trial
- Watermark on exports for free/trial users

### Course360 QuizCreator™ Desktop App - $47/mo
- Standalone Electron app (Windows + Mac)
- Full QuizMaker as shown in screenshots:
  - Form View + Slide View
  - Question groups with shuffle
  - Question types: True/False, Multiple Choice, Multiple Response, Fill-in-the-Blank, Matching, Sequence, Hotspot, Image-based
  - Intro slide + User Info Form
  - Quiz Properties: title, size, time limit, scoring, question list, reporting
  - Player customization: features, navigation, color scheme, text, font, corner radius
  - Import questions (Excel/CSV)
  - Translation support
  - Preview + Publish (SCORM, HTML5, .quiz format)
- Login-based activation
- 14-day free trial
- Watermark on exports for free/trial users

### Course360 Studio™ Desktop App - $47/mo
- Standalone Electron app (Windows + Mac)
- Screen recording: Screen only, Camera only, Screen + Camera
- Transcription generation from recordings
- Transcription-based editing (like Loom - delete words to cut video)
- AI-generated 10 highlight clips from full video
- Export as MP4
- Video timeline editor
- Login-based activation
- 14-day free trial
- Watermark on exports for free/trial users

### Course360 Studio™ Lite (Web, in LMS)
- Included with LMS Builder plan and above
- Record only: camera, screen, or both
- NO editing capability
- Upgrade prompts to Course360Studio desktop app
- Saves to LMS media library

## LMS Plan Tiers (existing)
- Free: basic features
- Starter: [existing limits]
- Builder: + Studio Lite (record only)
- Pro: + Studio Lite
- Enterprise: + Studio Lite

## Web Dashboards (retained for all 3 products)
- Each product has its own web dashboard at /creator, /studio, /quiz-creator-app
- Dashboard serves as: download hub for desktop app + media library
- Users can save to product-specific media library OR LMS media library
- Trial countdown badge shown for free/trial users
- Watermark banner shown for free/trial users
- Upgrade modal available

## Pricing Summary
| Product | Price | Billing |
|---|---|---|
| Course360Creator™ | $117/mo | Monthly subscription |
| Course360 Studio™ | $47/mo | Monthly subscription |
| Course360 QuizCreator™ | $47/mo | Monthly subscription |
| LMS Free | $0 | Free |
| LMS Starter | TBD | Monthly |
| LMS Builder | TBD | Monthly |
| LMS Pro | TBD | Monthly |
| LMS Enterprise | TBD | Monthly |
