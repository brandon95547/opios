// The templates a new Opios starts with. Each is a whole email: tables for layout (the one thing
// every mail app lays out the same) and a style sheet that is copied onto each tag when sent.
// {{content}} is where a message goes.

const PREHEADER = '<div data-preheader style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">{{preheader}}</div>';

const contentStyles = ({ text, heading, link, rule, headingFont }) => `
  .content { font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.6; color: ${text}; }
  .content h1 { font-family: ${headingFont}; font-size: 28px; line-height: 1.25; color: ${heading}; margin: 24px 0 12px; }
  .content h2 { font-family: ${headingFont}; font-size: 22px; line-height: 1.3; color: ${heading}; margin: 24px 0 10px; }
  .content h3 { font-family: ${headingFont}; font-size: 18px; line-height: 1.35; color: ${heading}; margin: 20px 0 8px; }
  .content p { margin: 0 0 16px; }
  .content a { color: ${link}; }
  .content img { max-width: 100%; height: auto; border: 0; }
  .content blockquote { margin: 0 0 16px; padding: 4px 0 4px 16px; border-left: 3px solid ${rule}; color: ${text}; font-style: italic; }
  .content ul, .content ol { margin: 0 0 16px; padding-left: 24px; }
  .content li { margin: 0 0 6px; }
  .content li p { margin: 0; }
  .content hr { border: 0; border-top: 1px solid ${rule}; margin: 24px 0; }`;

const page = (css, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>{{subject}}</title>
<style>${css}
</style>
</head>
<body>
${PREHEADER}
${body}
</body>
</html>
`;

const classic = page(`
  body { margin: 0; padding: 0; background: #f2f4f7; }
  .wrap { background: #f2f4f7; }
  .card { max-width: 600px; background: #ffffff; border-radius: 8px; }
  .header { padding: 32px 40px 4px; font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: bold; color: #1d2939; }
  .content { padding: 8px 40px 32px; }
  .footer { padding: 24px 40px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #667085; text-align: center; }
  .footer a { color: #667085; }${contentStyles({ text: '#344054', heading: '#101828', link: '#2f6fed', rule: '#d0d5dd', headingFont: "Georgia, 'Times New Roman', serif" })}
  @media (max-width: 620px) { .header, .content, .footer { padding-left: 20px !important; padding-right: 20px !important; } }`,
`<table role="presentation" class="wrap" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding: 24px 12px;">
      <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td class="header">{{org_name|Newsletter}}</td></tr>
        <tr><td class="content">{{content}}</td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
        <tr>
          <td class="footer">
            You’re receiving this email because you signed up for {{org_name|our newsletter}}.<br>
            {{address}}<br>
            <a href="{{unsubscribe_url}}">Unsubscribe</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`);

const minimal = page(`
  body { margin: 0; padding: 0; background: #ffffff; }
  .column { max-width: 560px; }
  .content { padding: 32px 24px 8px; }
  .footer { padding: 16px 24px 40px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #6b7280; border-top: 1px solid #e5e7eb; }
  .footer a { color: #6b7280; }${contentStyles({ text: '#1f2937', heading: '#111827', link: '#1d4ed8', rule: '#e5e7eb', headingFont: 'Arial, Helvetica, sans-serif' })}`,
`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center">
      <table role="presentation" class="column" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td class="content">{{content}}</td></tr>
        <tr>
          <td class="footer">
            {{org_name}}<br>
            {{address}}<br>
            <a href="{{unsubscribe_url}}">Unsubscribe</a> from these emails.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`);

const announcement = page(`
  body { margin: 0; padding: 0; background: #eef2fb; }
  .wrap { background: #eef2fb; }
  .card { max-width: 600px; background: #ffffff; border-radius: 10px; overflow: hidden; }
  .band { padding: 36px 40px; background: #2f6fed; font-family: Arial, Helvetica, sans-serif; font-size: 24px; font-weight: bold; color: #ffffff; text-align: center; letter-spacing: 0.5px; }
  .content { padding: 32px 40px; }
  .footer { padding: 24px 40px; font-family: Arial, Helvetica, sans-serif; font-size: 13px; line-height: 1.6; color: #5b6478; text-align: center; }
  .footer a { color: #5b6478; }${contentStyles({ text: '#2b3445', heading: '#13203d', link: '#2f6fed', rule: '#c9d6f5', headingFont: 'Arial, Helvetica, sans-serif' })}
  @media (max-width: 620px) { .band, .content, .footer { padding-left: 20px !important; padding-right: 20px !important; } }`,
`<table role="presentation" class="wrap" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding: 28px 12px;">
      <table role="presentation" class="card" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td class="band">{{org_name|Big news}}</td></tr>
        <tr><td class="content">{{content}}</td></tr>
      </table>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px;">
        <tr>
          <td class="footer">
            {{address}}<br>
            <a href="{{unsubscribe_url}}">Unsubscribe</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`);

export const STARTER_TEMPLATES = [
  { key: 'classic', name: 'Classic', html: classic },
  { key: 'minimal', name: 'Minimal', html: minimal },
  { key: 'announcement', name: 'Announcement', html: announcement },
];
