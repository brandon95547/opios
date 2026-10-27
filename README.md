# Opios

A simple newsletter system. Keep your contacts, design a template, write a message, and send it through your own Gmail or any SMTP account.

- **Contacts**: import a CSV file (or rows pasted from a spreadsheet), or add people one by one. File them in lists, search, export, and unsubscribe or delete several at once. An import never resubscribes someone who unsubscribed.
- **Templates**: three starters (Classic, Minimal, Announcement), edited as HTML beside a live preview. A message goes where the template says `{{content}}`.
- **Messages**: a formatted editor with headings, lists, links and pictures. Choose the recipients: everyone, some lists, or people you pick. Drafts save as you type. Send yourself a test, then send.
- **Sending**: in the background, one email at a time, at the speed you set. Each email is personalized, has a plain-text version and an unsubscribe link, and carries the List-Unsubscribe headers that put an Unsubscribe button in Gmail and Apple Mail.
  - The report shows who got it and what failed.
  - A wrong password or a full daily quota pauses sending, with the reason. Fix it, then resume.
  - Failed emails can be sent again.
- **Personal touches**: `{{first_name}}`, `{{last_name}}`, `{{email}}` and the rest, in the subject, the message or the template. A fallback covers empty names: `{{first_name|there}}`.
- **One login**: created on the first visit. Your email password is stored encrypted.

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

```bash
npm run build
npm start
```

This serves the built app and the API on one port (5340 by default). Put a proxy in front for HTTPS (nginx or Caddy), and pass the `Host` header through. Then set the public web address in Settings.

Settings can go in a `.env` file. See `.env.example` for:

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `5340` | The port to listen on |
| `HOST` | `127.0.0.1` | The address to listen on (`0.0.0.0` for the whole network) |
| `OPIOS_DATA_DIR` | `./data` | Where the database and the key are kept |
| `OPIOS_SECRET` | (a key in the data folder) | The key that encrypts the saved email password |

**Back up the data folder.** It holds the database (`opios.sqlite3`) and `secret.key`. Without the key, Opios can't read the saved email password, and you enter it again in Settings.

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
