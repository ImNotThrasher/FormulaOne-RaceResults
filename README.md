# F1 Race Results

Sitio estático para consultar la próxima carrera y los resultados de la última fecha del Campeonato Mundial de Fórmula 1.

## Uso

Abrí `index.html` en un navegador moderno o publicá el repositorio en un servicio de hosting estático, como Netlify. No requiere instalar dependencias ni compilar.

La página carga los datos al abrirse, permite actualizarlos manualmente y vuelve a consultarlos cada cinco minutos. Necesita conexión a internet para obtener información de la API.

## Datos

Los datos se consultan desde [Jolpica F1](https://github.com/jolpica/jolpica-f1), una API comunitaria compatible con la API de Ergast:

- Próxima carrera: `https://api.jolpi.ca/ergast/f1/current/next.json`
- Últimos resultados: `https://api.jolpi.ca/ergast/f1/current/last/results.json`

La disponibilidad y actualización de los datos dependen del servicio de Jolpica F1.

## Tecnologías

- HTML5
- CSS3
- JavaScript moderno (sin dependencias)
