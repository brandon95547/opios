// For a forgotten password: npm run reset-password
// Sets a new password for the login (and can rename it), and signs out every browser. When there
// is no login yet, it creates one: the way to make it on a server where the setup page is closed.
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { openDb } from './db.js';
import { hashPassword } from './auth.js';
import { DATA_DIR } from './config.js';

let muted = false;
const output = new Writable({
  write(chunk, encoding, done) {
    if (!muted) process.stdout.write(chunk, encoding);
    done();
  },
});
const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
const ask = (question, hidden = false) => new Promise((resolve) => {
  process.stdout.write(question);
  muted = hidden;
  rl.question('', (answer) => {
    muted = false;
    if (hidden) process.stdout.write('\n');
    resolve(answer);
  });
});

const db = openDb(DATA_DIR);
const user = db.prepare('SELECT id, username FROM users ORDER BY id').get();
const username = (await ask(user ? `Username [${user.username}]: ` : 'Username for the new login: ')).trim() || user?.username;
const password = await ask('New password: ', true);
const again = await ask('New password again: ', true);
rl.close();
if (!username || /\s/.test(username)) {
  console.error('Choose a username with no spaces. Nothing was changed.');
  process.exit(1);
}
if (password.length < 8) {
  console.error('Use a password of at least 8 characters. Nothing was changed.');
  process.exit(1);
}
if (password !== again) {
  console.error('The two passwords don’t match. Nothing was changed.');
  process.exit(1);
}
const hash = await hashPassword(password);
if (user) {
  db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(username, hash, user.id);
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  console.log(`The password for ${username} is changed. Sign in with it now.`);
} else {
  db.prepare('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)').run(username, hash, new Date().toISOString());
  console.log(`The login ${username} is created. Sign in with it now.`);
}
