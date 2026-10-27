// Compiling visual templates on the server, where saving one turns its design into HTML.
import mjml from 'mjml';
import { designToMjml } from '../shared/design.js';

export async function compileDesign(design, brand) {
  const { html } = await mjml(designToMjml(design, { brand }), { validationLevel: 'soft' });
  return html;
}
