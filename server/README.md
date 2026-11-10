# Servicio de contacto (Node.js + Zoho Mail)

Recibe el formulario de contacto del sitio y lo envía por correo a `fernando.escobar@exxasoft.com` con la API de Zoho Mail (v2). También maneja el restablecimiento de contraseña de Eco.

- `POST /api/contacto`: recibe `name`, `email`, `service`, `message` (y el campo trampa `website`).
- `POST /api/reset/solicitar`: recibe `email`; si existe una cuenta Eco con ese correo, genera un código de 8 caracteres (válido 15 minutos) y lo envía por correo. Responde `{ ok: true }` siempre, exista o no la cuenta.
- `GET /api/reset/estado?email=...`: responde `{ pending: true|false }` según si hay un código sin usar y sin vencer para ese correo.
- `POST /api/reset/confirmar`: recibe `email`, `code`, `newPassword`, `newPasswordConfirm`; valida el código y fija la contraseña nueva en Supabase (Eco).
- `GET /api/salud`: comprobación de que el servicio está activo.

No tiene dependencias externas. Requiere **Node.js 20.6 o superior**.

Protecciones incluidas:
- valida los campos;
- descarta los envíos de bots mediante un campo oculto (campo trampa);
- acepta como máximo 5 mensajes por IP cada 10 minutos;
- limita el tamaño del mensaje;
- solo acepta peticiones de los dominios de `ALLOWED_ORIGINS`.

## 1. Credenciales de Zoho (una sola vez)

1. Entra a la consola de API de Zoho de tu región. Por ejemplo, https://api-console.zoho.com para cuentas en zoho.com.
2. **Add Client → Self Client → Create**. Copia el **Client ID** y el **Client Secret**.
3. En la pestaña **Generate Code**:
   - Scope: `ZohoMail.messages.CREATE,ZohoMail.accounts.READ`
   - Time duration: 10 minutos
   - Pulsa **Create** y copia el código.
4. En la carpeta `server/`, copia `.env.example` como `.env` y completa `ZOHO_CLIENT_ID` y `ZOHO_CLIENT_SECRET`. Si tu cuenta no está en zoho.com, ajusta también `ZOHO_ACCOUNTS_DOMAIN` y `ZOHO_MAIL_DOMAIN`.
5. Canjea el código, antes de que expire:

   ```bash
   npm run setup -- CODIGO
   ```

   El comando muestra el `ZOHO_REFRESH_TOKEN` y la lista de cuentas con su ID. Copia ambos a `.env`; el ID de la cuenta que enviará los correos va en `ZOHO_ACCOUNT_ID`.

`.env` contiene secretos y está en `.gitignore`: nunca lo subas a GitHub.

## 1.1 Reseteo de contraseña (Eco)

1. Ejecuta una vez `server/sql/password_resets.sql` en el editor SQL del proyecto Supabase de Eco.
2. En Supabase: **Project Settings → API**, copia la **service_role key** (no la anon/publishable) y pégala en `.env` como `SUPABASE_SERVICE_ROLE_KEY`. Es secreta: nunca va en el navegador ni se sube a GitHub.
3. Confirma que `SUPABASE_URL` en `.env` apunte al mismo proyecto que usa `js/modals.js` (`ECO_SUPABASE_URL`).

## 2. Probar en local

```bash
npm test
npm run dev
```

`npm test` corre las pruebas con un Zoho simulado. `npm run dev` levanta el servicio con las credenciales reales de `.env` en `http://localhost:8080`.

Para que el sitio local use el servicio, agrega su origen (por ejemplo `http://localhost:8123`) a `ALLOWED_ORIGINS` en `.env`. Luego cambia temporalmente el atributo `data-endpoint` del formulario en `index.html` a `http://localhost:8080/api/contacto`.

## 3. Desplegar en DigitalOcean

### Opción A: App Platform

En la misma app del sitio, agrega un componente **Service**:

| Campo | Valor |
|---|---|
| Source directory | `server` |
| Run command | `npm start` |
| HTTP port | `8080` |
| HTTP route | `/api` con **Preserve path prefix** activado |
| Health check | `/api/salud` |

Sin **Preserve path prefix**, App Platform quita `/api` de la ruta y el servicio responde 404.

Variables de entorno del componente: carga las de `.env.example` y marca como **Encrypt** las de Zoho.

El formulario usa `/api/contacto` (mismo dominio), así que no hay que cambiar nada en el sitio.

Equivalente en la especificación de la app (`App → Settings → App Spec`):

```yaml
services:
  - name: contacto
    github:
      repo: angelfernando176/exxasoft
      branch: main
      deploy_on_push: true
    source_dir: server
    environment_slug: node-js
    run_command: npm start
    http_port: 8080
    instance_size_slug: apps-s-1vcpu-0.5gb
    instance_count: 1
    health_check:
      http_path: /api/salud
ingress:
  rules:
    - component:
        name: contacto
        preserve_path_prefix: true
      match:
        path:
          prefix: /api
    - component:
        name: <nombre-del-componente-del-sitio>
      match:
        path:
          prefix: /
```

Las variables de entorno con secretos cárgalas desde el panel (no en el YAML), para que queden cifradas.

### Opción B: Droplet con Nginx

1. Instala Node.js 20 o superior. Copia la carpeta `server/` al servidor, por ejemplo en `/opt/exxasoft/server`, y crea ahí el `.env` con permisos `600`.
2. Crea el servicio en `/etc/systemd/system/exxasoft-contacto.service`:

   ```ini
   [Unit]
   Description=ExxaSoft - servicio de contacto
   After=network.target

   [Service]
   WorkingDirectory=/opt/exxasoft/server
   EnvironmentFile=/opt/exxasoft/server/.env
   ExecStart=/usr/bin/node index.js
   Restart=on-failure
   User=www-data

   [Install]
   WantedBy=multi-user.target
   ```

   Actívalo:

   ```bash
   sudo systemctl enable --now exxasoft-contacto
   ```

3. En el bloque `server` de Nginx del sitio, agrega:

   ```nginx
   location /api/ {
       proxy_pass http://127.0.0.1:8080;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $remote_addr;
   }
   ```

   Luego recarga Nginx:

   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```

   `X-Forwarded-For` se fija con `$remote_addr`, en vez de añadirse a la cabecera que manda el visitante. Así nadie puede falsear su IP para saltarse el límite de envíos.

## Si algo falla

Los errores se escriben en el registro del servicio: en App Platform, la pestaña **Runtime Logs**; en un Droplet, `journalctl -u exxasoft-contacto`.

| Mensaje en el registro | Qué revisar |
|---|---|
| `No se pudo renovar el token: invalid_client` | El Client ID o el Client Secret, o que los dominios sean los de tu región. |
| `No se pudo renovar el token: invalid_code` | El refresh token: vuelve a generarlo con `npm run setup`. |
| `Zoho rechazó el envío (...)` | Que `ZOHO_ACCOUNT_ID` corresponda a la cuenta de `MAIL_FROM` y que el permiso `ZohoMail.messages.CREATE` esté incluido. |
| `Faltan variables de entorno` | Las variables de Zoho no llegaron al servicio. |
