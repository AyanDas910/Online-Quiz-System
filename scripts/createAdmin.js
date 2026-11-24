require('dotenv').config();
const readline = require('readline');
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const rl = readline.createInterface({input:process.stdin,output:process.stdout});
const ask = q => new Promise(resolve=>rl.question(q,resolve));
(async()=>{
  try {
    const name=(await ask('Admin name: ')).trim();
    const email=(await ask('Admin email: ')).trim().toLowerCase();
    const password=await ask('Admin password (minimum 12 characters): ');
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length<12)
      throw new Error('Invalid details. Use a valid email and password of at least 12 characters.');
    const hash=await bcrypt.hash(password,12);
    await db.execute("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'admin')",[name,email,hash]);
    console.log('Admin account created.');
  } catch(e) { console.error(e.message); process.exitCode=1; }
  finally { rl.close(); await db.end(); }
})();
