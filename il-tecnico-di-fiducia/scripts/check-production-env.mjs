const required = [
  "NEXT_PUBLIC_SITE_URL",

  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",

  "RATE_LIMIT_SALT",
  "GUEST_SUPPORT_TOKEN_SECRET",

  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRO_MONTHLY_PRICE_ID",
  "STRIPE_PRO_ANNUAL_PRICE_ID",
  "STRIPE_PROFESSION_SUGGESTION_PRICE_ID",

  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_SECURE",
  "SMTP_USER",
  "SMTP_PASS",
  "EMAIL_FROM",
  "EMAIL_REPLY_TO",
  "SUPPORT_ADMIN_EMAIL",
];

const optional = [
  "STRIPE_RECONCILE_SECRET",
  "INITIAL_ADMIN_EMAIL",
  "INITIAL_ADMIN_TEMP_PASSWORD",
];

const missing = [];
const malformed = [];

function value(name) {
  const raw = process.env[name];

  if (typeof raw !== "string") return "";
  return raw.trim();
}

for (const name of required) {
  if (!value(name)) {
    missing.push(name);
  }
}

function validateUrl(name, { httpsOnly = false } = {}) {
  const raw = value(name);

  if (!raw) return;

  try {
    const parsed = new URL(raw);

    if (httpsOnly) {
      if (parsed.protocol !== "https:") {
        malformed.push(name);
      }

      return;
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      malformed.push(name);
    }
  } catch {
    malformed.push(name);
  }
}

validateUrl("NEXT_PUBLIC_SITE_URL");
validateUrl("NEXT_PUBLIC_SUPABASE_URL", { httpsOnly: true });

const smtpPort = value("SMTP_PORT");

if (
  smtpPort &&
  (!Number.isInteger(Number(smtpPort)) ||
    Number(smtpPort) <= 0 ||
    Number(smtpPort) > 65535)
) {
  malformed.push("SMTP_PORT");
}

const smtpSecure = value("SMTP_SECURE");

if (
  smtpSecure &&
  !["true", "false", "1", "0"].includes(smtpSecure.toLowerCase())
) {
  malformed.push("SMTP_SECURE");
}

const uniqueMalformed = [...new Set(malformed)];

console.log("Production environment contract");
console.log("--------------------------------");

console.log();
console.log("REQUIRED");

for (const name of required) {
  const present = Boolean(value(name));

  console.log(`${present ? "✅" : "❌"} ${name}`);
}

console.log();
console.log("OPTIONAL");

for (const name of optional) {
  const present = Boolean(value(name));

  console.log(`${present ? "✅ configurata" : "ℹ️ non configurata"} ${name}`);
}

if (uniqueMalformed.length > 0) {
  console.log();
  console.log("FORMATO NON VALIDO");

  for (const name of uniqueMalformed) {
    console.log(`❌ ${name}`);
  }
}

console.log();

if (missing.length === 0 && uniqueMalformed.length === 0) {
  console.log("✅ Configurazione production completa e formalmente valida.");

  process.exitCode = 0;
} else {
  if (missing.length > 0) {
    console.log(
      `❌ Mancano ${missing.length} variabili obbligatorie per la production.`,
    );
  }

  if (uniqueMalformed.length > 0) {
    console.log(
      `❌ ${uniqueMalformed.length} variabili hanno formato non valido.`,
    );
  }

  process.exitCode = 1;
}
