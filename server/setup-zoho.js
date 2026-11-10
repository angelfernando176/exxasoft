/* =========================================================
   ExxaSoft — Configuración inicial de Zoho Mail (se usa una vez)
   Canjea el código del "Self Client" por el refresh token y
   muestra el ID de la cuenta de correo.

   Uso:  node --env-file=.env setup-zoho.js CODIGO
   (.env debe tener ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET y, si la
   cuenta no está en zoho.com, ZOHO_ACCOUNTS_DOMAIN y ZOHO_MAIL_DOMAIN)
   ========================================================= */
"use strict";

async function main() {
  const code = process.argv[2];
  const env = process.env;
  if (!code || !env.ZOHO_CLIENT_ID || !env.ZOHO_CLIENT_SECRET) {
    console.error("Uso: node --env-file=.env setup-zoho.js CODIGO\n" +
      "Faltan el código o ZOHO_CLIENT_ID / ZOHO_CLIENT_SECRET en .env");
    process.exit(1);
  }
  const accounts = (env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com").replace(/\/$/, "");
  const mail = (env.ZOHO_MAIL_DOMAIN || "https://mail.zoho.com").replace(/\/$/, "");

  const params = new URLSearchParams({
    code: code,
    client_id: env.ZOHO_CLIENT_ID,
    client_secret: env.ZOHO_CLIENT_SECRET,
    grant_type: "authorization_code"
  });
  const tokenRes = await fetch(accounts + "/oauth/v2/token?" + params, { method: "POST" });
  const token = await tokenRes.json();
  if (!token.refresh_token) {
    console.error("Zoho no entregó el refresh token: " + JSON.stringify(token) +
      "\nEl código dura pocos minutos y sirve una sola vez; genera otro si expiró.");
    process.exit(1);
  }

  const accRes = await fetch(mail + "/api/accounts", {
    headers: { "Authorization": "Zoho-oauthtoken " + token.access_token }
  });
  const acc = await accRes.json();
  const list = (acc.data || []).map((a) => "  " + a.accountId + "  " + a.primaryEmailAddress);

  console.log("\nAgrega estos valores a .env (y como variables cifradas en DigitalOcean):\n");
  console.log("ZOHO_REFRESH_TOKEN=" + token.refresh_token);
  if (list.length) {
    console.log("ZOHO_ACCOUNT_ID=<el de la cuenta que enviará los correos>\n\nCuentas encontradas:\n" + list.join("\n"));
  } else {
    console.log("\nNo se pudieron listar las cuentas: " + JSON.stringify(acc) +
      "\nRevisa que el Self Client tenga el permiso ZohoMail.accounts.READ.");
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
