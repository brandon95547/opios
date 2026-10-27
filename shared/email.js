// What counts as an email address here. Deliberately plain: no quotes, spaces, angle brackets,
// commas or semicolons, so an address can never be read as more than one recipient.
const EMAIL = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;

export const normalizeEmail = (s) => String(s ?? '').trim().toLowerCase();

export const isEmail = (s) => {
  const e = normalizeEmail(s);
  return e.length <= 254 && EMAIL.test(e) && !e.includes('..');
};
