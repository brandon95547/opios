// For a forgotten password: npm run reset-password
// Sets a new password for the login (and can rename it), and signs out every browser.
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
const users = db.prepare('SELECT id, username FROM users ORDER BY id').all();
if (!users.length) {
  console.log('There is no login yet. Start Opios and open it in a browser to create one.');
  process.exit(0);
}
const user = users[0];
const username = (await ask(`Username [${user.username}]: `)).trim() || user.username;
const password = await ask('New password: ', true);
const again = await ask('New password again: ', true);
rl.close();
if (password.length < 8) {
  console.error('Use a password of at least 8 characters. Nothing was changed.');
  process.exit(1);
}
if (password !== again) {
  console.error('The two passwords don’t match. Nothing was changed.');
  process.exit(1);
}
db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(username, await hashPassword(password), user.id);
db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
console.log(`The password for ${username} is changed. Sign in with it now.`);
