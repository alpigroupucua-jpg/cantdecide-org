# CantDecide.org — Version 1

CantDecide.org is a lightweight static website that gives visitors one random
YES or NO on each homepage load, then points them toward thoughtful,
responsible decision-making.

## Architecture

The site uses only HTML5, CSS3, and vanilla JavaScript. There is no package
manager, framework, build step, database, cookie, or third-party runtime
dependency.

- `index.html` contains the single-screen random decision experience.
- The remaining HTML files contain the mission, Decision Science,
  responsible-use, contact, privacy, terms, and 404 pages. The Decision Science
  page intentionally keeps its existing `know-yourself.html` filename so
  published links remain stable.
- `assets/css/styles.css` contains the shared responsive design system and the
  YES/NO themes.
- `assets/js/decision.js` chooses exactly once per homepage load. It uses
  `crypto.getRandomValues()` when available and falls back to `Math.random()`.
- `assets/js/main.js` renders the chosen answer and the current copyright year.

The educational page deliberately contains no invented research claims,
statistics, or quotations. Its source labels are placeholders for later,
verified editorial work.

## Browser-based content editing

### CMS choice

The project is prepared for **CloudCannon**, a reputable Git-based content
management system designed for static sites.

CloudCannon was selected because it:

- keeps the public website as static HTML, CSS, and JavaScript;
- authenticates administrators through CloudCannon accounts rather than public
  client-side JavaScript;
- controls access through invited team members and permission groups;
- edits the existing HTML files without requiring a framework migration;
- commits approved changes back to Git; and
- works with Cloudflare Pages automatic Git deployments.

Key page headings, paragraphs, homepage messaging, legal content, and
educational cards include CloudCannon Editable Region metadata. Administrators
can edit those fields in the Visual Editor. Page `<title>` elements, repeated
navigation labels, and footer labels can also be edited in CloudCannon’s
browser-based Source Editor.

The repository includes `cloudcannon.config.yml`, which exposes the existing
HTML pages as a protected Pages collection and prevents editors from adding,
renaming, or deleting pages through the collection interface.

### Required accounts

The site owner needs:

1. A GitHub account and repository containing this project.
2. A CloudCannon organization connected to that GitHub repository.
3. A Cloudflare account with a Pages project connected to the same repository.

Use a private GitHub repository if the source should not be publicly visible.

### Authentication configuration

1. In CloudCannon, create a Site from the GitHub repository and select the
   production branch, normally `main`.
2. Confirm that CloudCannon uses the unified configuration in
   `cloudcannon.config.yml`.
3. Invite each administrator from **Organization settings → Team**.
4. Assign the minimum suitable permission group. Editors should have permission
   to edit and publish the website content, but should not receive organization
   ownership unless required.
5. Require multi-factor authentication on CloudCannon and GitHub accounts.
6. Do not create a public `/admin` password form. CloudCannon handles sign-in,
   sessions, team membership, and permissions outside the public website.

Administrator login URL:

<https://app.cloudcannon.com/>

After the Site is created, bookmark its site-specific CloudCannon dashboard
URL.

### Environment variables and secrets

This static project requires **no environment variables or repository
secrets**.

GitHub access tokens, CloudCannon integration credentials, Cloudflare API
credentials, and session secrets must remain managed by those providers. Never
paste them into this repository, `cloudcannon.config.yml`, a public JavaScript
file, or this README. If a future feature needs a secret, configure it in the
appropriate hosting dashboard and document only the variable name.

### Editing and publishing workflow

1. Sign in to CloudCannon.
2. Open **Website pages** and choose the page to update.
3. Use the Visual Editor for marked headings, paragraphs, homepage messaging,
   the disclaimer, and educational cards.
4. Use the Source Editor for the browser title, repeated menu labels, or
   repeated footer labels. Update repeated navigation/footer text consistently
   in each HTML file.
5. Save the change and review CloudCannon’s preview.
6. Publish using the team’s configured CloudCannon publishing workflow. For
   higher assurance, publish to a review branch and merge an approved pull
   request into `main`.
7. CloudCannon writes the approved edit to Git. Cloudflare Pages then deploys
   the new `main` commit automatically.

CloudCannon and Git preserve the author and history of content changes. Use pull
request review for changes to legal text, the homepage disclaimer, or
scientific claims.

### Cloudflare Pages deployment workflow

Connect the GitHub repository in **Workers & Pages** and use:

- Framework preset: `None`
- Production branch: `main`
- Build command: leave blank
- Build output directory: `/`
- Automatic production deployments: enabled

With Git integration enabled, a published CMS commit to `main` triggers the
Cloudflare Pages deployment. Preview branches can be enabled for editorial
review before production.

## Local preview

Open `index.html` directly in a browser, or run any basic static file server in
the project directory. No CMS account, package installation, environment
variable, or build step is required for local development.

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

The Privacy Policy and Terms of Use are placeholders and are explicitly marked
as requiring qualified professional legal review. They do not guarantee legal
or advertising-platform compliance.
