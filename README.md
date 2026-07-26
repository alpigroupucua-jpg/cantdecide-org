# CantDecide.org — Version 1

CantDecide.org is a lightweight static website that gives visitors one random
YES or NO on each homepage load, then points them toward thoughtful,
responsible decision-making.

## Architecture

The site uses only HTML5, CSS3, and vanilla JavaScript. There is no package
manager, framework, build step, database, cookie, or third-party runtime
dependency.

- `index.html` contains the single-screen random decision experience.
- The remaining HTML files contain the mission, education, responsible-use,
  contact, privacy, terms, and 404 pages.
- `assets/css/styles.css` contains the shared responsive design system and the
  YES/NO themes.
- `assets/js/decision.js` chooses exactly once per homepage load. It uses
  `crypto.getRandomValues()` when available and falls back to `Math.random()`.
- `assets/js/main.js` renders the chosen answer and the current copyright year.

The educational page deliberately contains no invented research claims,
statistics, or quotations. Its source labels are placeholders for later,
verified editorial work.

## Local preview

Open `index.html` directly in a browser, or run any basic static file server in
the project directory.

## Cloudflare Pages deployment

Create a Cloudflare Pages project and select this repository. Use:

- Framework preset: `None`
- Build command: leave blank
- Build output directory: `/`

Because every production file lives at the repository root, deployment requires
no build command.

## Before public launch

1. Replace the founder mission placeholder with the founder’s own statement.
2. Confirm the contact email.
3. Add researched educational articles and authoritative source citations.
4. Finalize the privacy policy and terms for the owner, hosting setup,
   jurisdiction, and any analytics or advertising services.
5. Connect the `cantdecide.org` custom domain and confirm canonical URLs.
