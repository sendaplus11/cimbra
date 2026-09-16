# Cimbra — sitio v1

Landing page de una sola página con la herramienta de análisis de presupuestos (Cost Analysis, Cost Drivers, Construction Schedule, Cash Flow, Procurement Priorities, Critical Activities, Executive Report) embebida directamente. Todo el procesamiento ocurre en el navegador del usuario; el presupuesto que suba nunca se envía a ningún servidor.

Stack: Vite + React + Tailwind CSS. Sin backend, sin base de datos, sin autenticación.

## Desarrollo local

```
npm install
npm run dev
```

## Build de producción (para Vercel/Netlify)

```
npm run build
```

Esto genera la carpeta `dist/` lista para desplegar. En Vercel o Netlify, conecta el repositorio de GitHub y usa:

- Build command: `npm run build`
- Output directory: `dist`

No hace falta configurar variables de entorno ni backend.

## Estructura

- `src/App.jsx` — composición de la landing page (hero, secciones de posicionamiento, caso de referencia, la herramienta).
- `src/AnalisisPareto.jsx` — el componente de la herramienta (Cost Drivers, cronograma, flujo de caja, etc.).
- `src/assets/` — logos de Cimbra en SVG.
- Colores de marca: azul oscuro `#1C2B39`, ámbar `#C9922B` (definidos en `tailwind.config.js` como `cimbra.dark` y `cimbra.amber`).

## Nota sobre el botón "Descargar reporte completo (Excel)"

El componente detecta si corre dentro de una página de Claude (Artifact) y, en ese caso, usa la capacidad de descargas del visor en lugar de la descarga directa del navegador. Al desplegar este proyecto de forma independiente (Vercel, Netlify, etc.) esa detección no aplica y el botón usa la descarga normal del navegador (`XLSX.writeFile`), sin cambios necesarios.
