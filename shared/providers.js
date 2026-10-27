// Ready-made settings for the common email accounts. "Other" is any SMTP server: a company mail
// server, or a sending service such as Brevo, Mailgun, SendGrid, Postmark or Amazon SES.
export const PROVIDERS = {
  gmail: {
    name: 'Gmail',
    host: 'smtp.gmail.com',
    port: 465,
    security: 'ssl',
    help: 'Use an App Password, not your Google password. Turn on 2-Step Verification for the account, then create one at myaccount.google.com/apppasswords. Gmail sends up to about 500 emails a day (2,000 with Google Workspace).',
  },
  icloud: {
    name: 'iCloud Mail',
    host: 'smtp.mail.me.com',
    port: 587,
    security: 'starttls',
    help: 'Use an app-specific password, created at account.apple.com under Sign-In and Security. The username is your full iCloud email address.',
  },
  yahoo: {
    name: 'Yahoo Mail',
    host: 'smtp.mail.yahoo.com',
    port: 465,
    security: 'ssl',
    help: 'Use an app password, created in your Yahoo account under Account Security.',
  },
  other: {
    name: 'Other SMTP server',
    host: '',
    port: 587,
    security: 'starttls',
    help: 'Your mail provider or sending service lists its SMTP server, port and security. Port 465 is usually SSL/TLS; 587 is usually STARTTLS.',
  },
};

export const SECURITY = {
  ssl: 'SSL/TLS',
  starttls: 'STARTTLS',
  none: 'None (local testing only)',
};
