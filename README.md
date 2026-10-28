# Opios

A simple newsletter system. Keep your contacts, design a template, write a message, and send it through your own Gmail or any SMTP account.

- **Brands**: one per newsletter, such as Phansora and Skylanex. Each has its own heading ("Phansora Updates"), color, logo, From name, products and subscribers. Someone who unsubscribes from one brand keeps getting the other.
- **Updates**: what's new, improved or fixed in each product, with its date. A brand's newsletter carries the newest updates it hasn't sent yet, or the ones you choose, in the order you choose. Scripts can add updates too, with an API key (see below).
- **Contacts**: import a CSV file (or rows pasted from a spreadsheet), or add people one by one. File them in lists, choose the brands they're subscribed to, search, export, and change several at once. An import never resubscribes someone who unsubscribed.
- **Templates**: visual ones, built from blocks: masthead, header, section heading, text, picture, button, two columns, cards, callout, divider, the message, the updates, the products and the footer. The Classic starter is a magazine-style issue: masthead, latest updates (the newest featured), products, coming soon, a callout and a footer of links. You see the real email beside the editor, click a block to change it, and set the colors and font. Visual templates are compiled to email HTML with [MJML](https://mjml.io), so Outlook and Gmail show them right. HTML templates, written by hand, work too. A message goes where the template says `{{content}}`, the updates where it says `{{updates}}`, and the brand's products (with the version, description and picture set for each in Settings › Brands) where it says `{{products}}`. Every template is a 600-pixel layout of tables with styles on each tag and the extra markup Outlook for Windows needs; a test checks the Classic one against those rules (pictures with sizes and descriptions, links that work from an inbox, under Gmail's 102 KB clipping limit).
- **Messages**: a formatting editor with headings, lists, links and pictures (uploaded or by web address). Choose the brand and the recipients: everyone subscribed to the brand, some lists, or people you pick. Drafts save as you type. Send yourself a test, then send.
- **Sending**: in the background, one email at a time, at the speed you set. Each email is personalized, has a plain-text version and an unsubscribe link, and carries the List-Unsubscribe headers that put an Unsubscribe button in Gmail and Apple Mail.
  - The report shows who got it and what failed.
  - A wrong password or a full daily quota pauses sending, with the reason. Fix it, then resume.
  - Failed emails can be sent again.
- **Personal touches**: `{{first_name}}`, `{{last_name}}`, `{{email}}`, `{{brand_heading}}` and the rest, in the subject, the message or the template. A fallback covers empty names: `{{first_name|there}}`.
- **Your data**: download every contact as a CSV, or the whole database as one file, from Settings.
- **One login**: created on the first visit. Your email password is stored encrypted.

## Adding updates from scripts

Create a key in **Settings › Adding updates from elsewhere**, then post updates to it. Brands are named. A product that doesn't exist yet is added to the brand. `kind` is `new`, `improved` or `fixed`. Add `"status": "draft"` to keep an update out of newsletters for now.

```bash
curl -X POST https://www.example.com/opios/api/v1/updates \
  -H "Authorization: Bearer opk_…" \
  -H "Content-Type: application/json" \
  -d '{"brand": "Phansora", "product": "Talari", "title": "Spine templates", "body": "Five layouts for every frame.", "link": "https://phansora.com/talari", "kind": "new"}'
```

`GET /api/v1/updates?brand=Phansora&limit=20` lists the published ones.

## Running it

Opios needs Node.js 22.13 or later.

```bash
npm install
npm run dev
```

Then open http://127.0.0.1:5340. The first visit asks you to create the login.

`npm test` runs the tests. They include sending through a real SMTP server running on this computer.

## Connecting Gmail

1. Turn on 2-Step Verification for the Google account.
2. Create an App Password at https://myaccount.google.com/apppasswords.
3. In Opios, go to **Settings › Email account**, choose **Gmail**, and enter the Gmail address and the 16-letter App Password. Do not use your Google password.
4. Use **Check connection**, then **Send me a test email**.

A regular Gmail account sends about 500 emails a day (Google Workspace, 2,000). Keep the sending speed at about 20 a minute. For larger lists, use a sending service (Brevo, Mailgun, Postmark, Amazon SES and others) as an **Other SMTP server**.

## Before sending to real people

- **Mailing address.** Laws such as CAN-SPAM ask for a postal address in every newsletter. Set it in **Settings › Newsletter details**. The templates show it where they say `{{address}}`.
- **Unsubscribe links.** These need Opios at a public web address, such as https://news.example.com, set in the same place. Until then, unsubscribe links open an email to you, and you unsubscribe the person by hand in Contacts.
- **Consent.** Only import people who agreed to get your emails.

## Putting it online

With Docker, on the server:

```bash
git clone https://github.com/brandon95547/opios.git /var/www/opios
cd /var/www/opios
cp .env.example .env              # set OPIOS_BASE_PATH and OPIOS_SETUP_CODE in it
mkdir -p data && chown 1000:1000 data
docker compose -f docker-compose.prod.yml up -d --build
```

This runs one container on 127.0.0.1:5340 (`docker-compose.prod.yml`). Docker restarts it after a reboot. Put nginx in front for HTTPS: `deploy/nginx-location.conf` serves Opios under a path of an existing site, such as https://www.example.com/opios. Then set that address as the public web address in Settings.

To release a new version, pull and rebuild:

```bash
cd /var/www/opios && git pull && docker compose -f docker-compose.prod.yml up -d --build
```

Without Docker, `npm run build`, then `npm start`.

**The first login on a server.** Whoever opens Opios first creates its login, so on a server it asks for the setup code from `.env` (`OPIOS_SETUP_CODE`). The code does nothing once the login exists. With no code set, the page stays closed; make the login on the server with `npm run reset-password` instead (with Docker, `docker compose -f docker-compose.prod.yml exec app npm run reset-password`).

Settings go in a `.env` file. See `.env.example` for:

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `5340` | The port to listen on |
| `HOST` | `127.0.0.1` | The address to listen on (`0.0.0.0` for the whole network) |
| `OPIOS_BASE_PATH` | (none) | The path Opios is served under, such as `/opios`; built in, so rebuild after changing it |
| `OPIOS_SETUP_CODE` | (none) | Needed to create the login in the browser on a server |
| `OPIOS_DATA_DIR` | `./data` | Where the database and the key are kept |
| `OPIOS_SECRET` | (a key in the data folder) | The key that encrypts the saved email password |
| `OPIOS_TRUST_PROXY` | `loopback, uniquelocal` | Which proxies to believe about the visitor's address and https |

**Keep copies of your data.** Contacts and messages are kept only in the data folder where Opios runs, never in this repository. **Settings › Your data** downloads them:

- **Export contacts**: a CSV of every contact. Import CSV takes it back.
- **Download database**: the whole database as one SQLite file. Sign-in sessions are left out, and the saved email password stays encrypted. Uploaded pictures are files in `data/media`, beside it.

To restore a downloaded database, stop Opios and put the file in the data folder as `opios.sqlite3`, replacing the one there. Then start Opios and enter the email password again in Settings.

The data folder also holds `secret.key`. Without it, Opios can't read the saved email password, and you enter it again in Settings.

Forgot the password? Run `npm run reset-password` in the Opios folder, on the computer it runs on.

## How it's built

- **The app:** React 19, React Router 7 and Vite (`src/`). The editor is TipTap.
- **The server:** Express 5 (`server/`). Data is in SQLite through Node's built-in `node:sqlite`; email goes out through Nodemailer, and juice copies each template's styles onto its tags for Outlook and Gmail.
- **Shared code:** `shared/` is used by both sides, so the preview and the email come from the same code: rendering (`render.js`), CSV (`csv.js`), email-address checks, and the provider presets.

| Folder | What's there |
| --- | --- |
| `server/app.js` | The API routes and the login check |
| `server/sender.js` | The background sender |
| `server/unsubscribe.js` | The public unsubscribe pages |
| `server/starters.js` | The starter templates |
| `src/pages/` | One file per screen |
| `src/components/` | The editor, the preview, the recipient picker |
| `test/` | The tests |
