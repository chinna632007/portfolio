# Resume To Portfolio Generator

A complete, single-page web app that turns any resume (PDF / DOCX / TXT) into a beautiful, professional portfolio website — **preserving every section title, every line, and the original order** of the uploaded resume. Nothing is invented, summarized, renamed or dropped.

The portfolio is not a text dump. The same words are laid out in a fixed, structured order: hero → numbered sections in resume order → and inside every section `title → subtitle → date/score badges → highlights → description`, with real category cards for technical skills and compact card grids for one-line sections.

## How to run

**Option A — one click (requires Node.js):**`
Double-click `start.bat`. It starts the built-in zero-dependency server and opens `http://localhost:8000`.

**Option B — command line (requires Node.js):**
```bash
node server.js
# or
npm start
```
Then open `http://localhost:8000`.

**Option C — any static file server:**
```bash
python -m http.server 8000
```
or just open `index.html` directly — PDF/DOCX/TXT parsing is now fully local (libraries are vendored under `lib/`), so even `file://` works in most browsers.

> No internet access is required. PDF.js, its worker, and Mammoth.js are bundled locally (same-origin), which also fixes the "Setting up fake worker failed" / "cannot extract PDF" problems that happen when a CDN is blocked, offline, or under strict CORS.

## Project structure
```
resume-to-portfolio/
├── index.html            # single-page app (upload → analyze → preview)
├── css/style.css
├── lib/                  # vendored libraries (no CDN needed)
│   ├── pdf.min.js                 # PDF.js 3.11.174
│   ├── pdf.worker.min.js          # PDF.js worker (same-origin)
│   └── mammoth.browser.min.js     # DOCX → text
├── js/
│   ├── app.js            # shared helpers, storage, toast, view router
│   ├── upload.js         # drag & drop, validation, extraction pipeline
│   ├── pdfParser.js      # PDF.js wrapper (local worker + main-thread fallback)
│   ├── docxParser.js     # Mammoth.js wrapper
│   ├── resumeAnalyzer.js # dynamic section detection + data preservation
│   ├── portfolioGenerator.js
│   └── animations.js     # reveal, scroll-spy, counters, reading-progress, reduced-motion
├── server.js             # zero-dependency static server (node server.js)
├── start.bat             # Windows one-click launcher
└── tests/ (samples + headless verification suite)
```

## How the generated portfolio is structured

| Resume section | How it is presented |
| --- | --- |
| Technical Skills / Skills | **Category cards.** A line like `Languages: Java, Python, Go` becomes a titled card showing a value count and one chip per skill, so the section reads as an ordered grid instead of one long chip cloud. An unlabelled skills list becomes a tidy chip matrix. Commas inside brackets stay together, so `AWS (EC2, S3, Lambda)` is one chip, not three. |
| Projects | **Responsive project cards** with numbered headings, full descriptions, bullet highlights, explicit technology labels/chips, and clickable source URLs. Blank separators help identify project boundaries. Short descriptions are never treated as company subtitles. |
| Experience / Internships / Education | **Timeline cards in resume order**, with titles, subtitles (company / institute), date & score badges, highlights, and descriptions. Wrapped resume lines are rejoined for comfortable reading. |
| Certifications / Achievements / Extra-curricular / Social links | **Compact card grid** — one line per card with a tick badge. |
| Summary / Profile / Career Objective | Real paragraphs (wrapped lines rejoined) instead of one paragraph per source line. |
| Languages / Hobbies / Contact / any unrecognised heading | Chip rows; the original heading is always kept verbatim. |
| Everything else | Generic card section with its original title and text. |

Every skill card also carries `data-source-line="<original resume line>"`, so the exact source text behind a category is always available even though the label and the values are displayed separately.

Want category cards for an unlabelled skills list? Open **Edit Extracted Text** and write the categories, e.g.
`Frontend: HTML5, CSS3, React` / `Backend: Node.js, Express.js` — each becomes a titled category card.

## Data integrity
- Section titles are kept **exactly** as they appear in the resume (e.g. "TECHNICAL SKILLS", "ACADEMIC QUALIFICATIONS").
- Sections stay in the **original order**.
- Skill categories come from the resume itself (`Languages: Java, Python`); no category names are invented. The label becomes the card title, every value becomes a chip, and the source line is kept in `data-source-line`.
- Inside a card the order is always title → subtitle → badges → highlights → description, and the highlights keep the resume order.
- A bare comma-separated line is never used as the applicant's city — only a labelled line (`Location: …`) or a real address segment is. (Earlier versions could show a skills row such as "REST APIs, Firebase, Tailwind CSS" as the location; that is fixed and covered by tests.)
- Unrecognised sections are never removed — they render as a generic section with their original title + text.
- The user can edit extracted text, change theme / color / layout, and show or hide sections.
- "Export HTML" downloads a fully standalone portfolio file (same design system, scroll reveal, reading-progress bar, working navigation).

## Testing
Run the headless verification suite (no browser needed):

```
node tests/run.js
```

It loads the real app scripts into a Node VM (in the exact order `index.html` uses) and pushes **three different sample resumes** (`tests/samples/resumeA.txt`, `resumeB.txt`, `resumeC.txt` — a student, an experienced engineer, and a designer with unusual sections) through the full pipeline: analyze → validate → render → export.

It asserts: exact original section titles, original order, **100% of resume lines preserved**, no invented/renamed content, dynamic navigation, show/hide customization, the **structured layout** (skill category groups with their labels in resume order, ordered entry cards, highlight lists, compact grids, exactly 17/14/12 skill chips per sample), correct contact/location extraction (never a skills row as the city), and a complete standalone export whose bundled CSS/JS is valid. Current status: **319 passed, 0 failed**.

## Troubleshooting

- **"The PDF could not be opened / contains no selectable text"** → your PDF is scanned/image-only (no text layer). Export it as a text-based PDF from Word/Google Docs (not a scanner) and re-upload, or use DOCX/TXT.
- **Nothing happens after pressing "Generate Portfolio"** → hard-refresh once (`Ctrl+Shift+R`) so the browser picks up the new `?v=20260916` versions of the scripts and stylesheet.
- **"Please check that lib/pdf.worker.min.js exists"** → make sure the whole folder (including `lib/`) is kept together; do not only copy `index.html`.
- **Portfolio looks unstyled if opened as `file://`** → fine to still use `node server.js` or `python -m http.server` for the best experience.
