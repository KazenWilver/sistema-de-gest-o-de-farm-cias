// Verifica que não há segredos no bundle (dist/) nem nos ficheiros versionados.
// Procura: JWT com role service_role, chaves secretas do Supabase (sb_secret_), chaves privadas,
// e variáveis de segredo preenchidas. Sai com código 1 se encontrar algo.
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const findings = [];

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function decodeJwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload.role;
  } catch {
    return undefined;
  }
}

function scan(file, text) {
  for (const m of text.matchAll(/eyJ[\w-]{10,}\.eyJ[\w-]{10,}\.[\w-]{10,}/g)) {
    if (decodeJwtRole(m[0]) === 'service_role') findings.push(`${file}: JWT com role service_role`);
  }
  if (/sb_secret_[A-Za-z0-9_-]{10,}/.test(text))
    findings.push(`${file}: chave secreta do Supabase (sb_secret_)`);
  if (/-----BEGIN (RSA |EC |OPENSSH |)PRIVATE KEY-----/.test(text)) findings.push(`${file}: chave privada`);
  if (/AGE-SECRET-KEY-1[0-9A-Z]{20,}/.test(text)) findings.push(`${file}: chave privada age`);
  for (const m of text.matchAll(
    /^(SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL|R2_SECRET_ACCESS_KEY|SUPABASE_ACCESS_TOKEN)=(.+)$/gm,
  )) {
    // Ignora placeholders e a base local do Supabase CLI (credenciais públicas por defeito).
    if (!/REPLACE_ME|^\s*$|@(127\.0\.0\.1|localhost):/.test(m[2]))
      findings.push(`${file}: ${m[1]} preenchida`);
  }
  if (/VITE_[A-Z_]*(SERVICE|SECRET)/.test(text) && !file.endsWith('check-secrets.mjs')) {
    findings.push(`${file}: variável VITE_ com nome de segredo`);
  }
}

// 1) Bundle
if (existsSync('dist')) {
  for (const f of walk('dist'))
    if (/\.(js|html|json|webmanifest|css)$/.test(f)) scan(f, readFileSync(f, 'utf8'));
  for (const f of walk('dist')) {
    if (/service_role/i.test(readFileSync(f, 'utf8')) && f.endsWith('.js'))
      findings.push(`${f}: menciona service_role`);
  }
} else {
  console.warn('dist/ não existe: corra "npm run build" para verificar também o bundle.');
}

// 2) Ficheiros versionados (ou a versionar)
let files = [];
try {
  files = execSync('git ls-files --cached --others --exclude-standard', { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
} catch {
  console.warn('git indisponível: só o bundle foi verificado.');
}
for (const f of files) {
  if (/\.(png|ico|lock)$/.test(f) || f === 'package-lock.json' || !existsSync(f)) continue;
  if (/^\.env(\.|$)/.test(f) && f !== '.env.example')
    findings.push(`${f}: ficheiro .env não deve ser versionado`);
  scan(f, readFileSync(f, 'utf8'));
}

if (findings.length) {
  console.error('Possíveis segredos encontrados:\n' + findings.map((f) => ` - ${f}`).join('\n'));
  process.exit(1);
}
console.warn(
  `Sem segredos detectados (${files.length} ficheiros do repositório${existsSync('dist') ? ' + dist/' : ''}).`,
);
