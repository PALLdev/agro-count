# AgroCount 🌿

AgroCount es una aplicación web responsiva y segura diseñada para automatizar el ingreso de datos de conteos de campo directamente a planillas Excel. Está optimizada para trabajar 100% offline en zonas agrícolas con conectividad limitada.

## 🚀 Características Principales

*   **Funcionamiento 100% Offline (Local-First):** Toda la lógica y el almacenamiento se ejecutan localmente en el dispositivo. No se requieren servidores externos ni conexión a internet para realizar el registro del conteo diario.
*   **Captura de Coordenadas GPS:** Botón dedicado para autodetectar la ubicación geográfica del cuartel mediante la API de Geolocalización del navegador, con soporte para ingreso o copia manual desde enlaces de WhatsApp.
*   **Ingreso Eficiente por Planta:** Formulario unificado para registrar simultáneamente los 4 ejes cardinales de una planta (Norte, Sur, Este y Oeste) con sus respectivos contadores táctiles (botones `+` y `-`).
*   **Autocompletado Inteligente:** Historial local que recuerda nombres de supervisores, campos, cuarteles y trabajadores para acelerar la entrada y evitar errores de digitación en terreno.
*   **Respaldo Automático de Borradores:** Prevención de pérdida de datos; si la batería se agota o el navegador se cierra, se recupera el avance de la planta en curso al reiniciar.
*   **Exportación Directa a Excel (CSV):** Descarga instantánea de un reporte CSV delimitado por punto y coma (`;`) y provisto de una marca de orden de bytes (BOM UTF-8) que garantiza que Microsoft Excel en español separe las celdas automáticamente y lea correctamente caracteres especiales (tildes, letra Ñ).

## 🔒 Seguridad e Integridad de Datos

1.  **Privacidad Total:** Los datos de tu producción nunca viajan por internet.
2.  **Sanitización de Entradas:** Protección activa contra inyecciones XSS y CSV.
3.  **Confirmaciones de Seguridad:** Alertas antes de ejecutar acciones destructivas como vaciar el historial.
4.  **Cabeceras de Producción:** Configuración optimizada de `vercel.json` con políticas de seguridad (CSP, X-Frame-Options) para blindar la web una vez desplegada.

## 🛠️ Tecnologías

*   HTML5
*   CSS3 moderno (con variables, grids responsivos y diseño optimizado para luz solar)
*   Vanilla Javascript (ES6)

## 📦 Despliegue en Vercel

Esta aplicación se puede subir directamente a **Vercel** sin necesidad de compilar o configurar nada. Solo debes:

1.  Ir a [vercel.com/new](https://vercel.com/new).
2.  Arrastrar y soltar la carpeta del proyecto.
3.  ¡Tu aplicación estará en línea y segura en segundos!
