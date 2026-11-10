# ExxaSoft — Sitio web corporativo

Sitio de ExxaSoft, empresa de desarrollo de software a medida bajo la filosofía **What You Need, What You Wish**.

## Estructura

```
exxasoft/
├── index.html            Página principal (inicio, servicios, productos, nosotros, contacto)
├── css/
│   ├── styles.css        Estilos principales y paleta
│   └── responsive.css    Adaptación a tabletas y móviles
├── js/
│   ├── main.js           Menú, submenús, menú móvil, año del pie
│   ├── hexgrid.js        Malla hexagonal animada del fondo del inicio
│   ├── services.js       Panal interactivo de servicios (onda, borde animado)
│   ├── modals.js         Ventanas modales, pestañas Misión/Visión, ingreso "Mi cuenta"
│   └── contact.js        Validación y envío del formulario de contacto
├── server/               Servicio Node.js que envía el formulario por Zoho Mail
├── pages/
│   ├── faq.html
│   ├── privacidad.html
│   └── terminos.html
└── img/
    └── logo.svg          Logo provisional (hexágono con X)
```

HTML5 semántico, sin estilos ni scripts mezclados en el HTML, y sin dependencias externas salvo las fuentes de Google Fonts (Sora y Source Sans 3).

## Ver el sitio

Abre `index.html` en cualquier navegador. No requiere instalación.

## Pendientes antes de publicar

- **Redes sociales:** reemplaza los enlaces de Facebook, X y LinkedIn en el pie (`index.html` y `pages/*.html`) por las URL reales de la empresa.
- **Mi cuenta:** el formulario valida los datos, pero el inicio de sesión real necesita un servidor. Conéctalo en la función `authenticate()` de `js/modals.js`.
- **Formulario de contacto:** se envía al servicio de `server/` (Node.js + Zoho Mail). Sigue `server/README.md` para obtener las credenciales de Zoho y desplegarlo en DigitalOcean.
- **Textos legales:** son una base de referencia. Revísalos con un asesor legal.
- **Logo:** `img/logo.svg` es provisional; reemplázalo cuando tengas el definitivo.

## Subir a Git

La carpeta ya incluye un repositorio git con el primer commit. Crea un repositorio vacío en GitHub (o GitLab) y ejecuta:

```bash
cd C:\data\data\exxasoft
git remote add origin https://github.com/USUARIO/exxasoft.git
git push -u origin main
```

Si prefieres empezar el repositorio desde cero, borra la carpeta oculta `.git` y usa `git init`, `git add .` y `git commit`.

Para publicarlo gratis: en GitHub ve a **Settings → Pages**, elige la rama `main` y la carpeta raíz.

© ExxaSoft 2026. Todos los derechos reservados.
