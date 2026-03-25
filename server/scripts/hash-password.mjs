import bcrypt from 'bcryptjs'

const pwd = process.argv[2]
if (!pwd) {
  console.error('Uso: node scripts/hash-password.mjs <senha>')
  process.exit(1)
}
const hash = await bcrypt.hash(pwd, 12)
console.log(hash)
