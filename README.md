# Open Tennis Huechuraba · V6

Aplicación pública personalizada para GitHub Pages y administrador privado de resultados en Google Apps Script.

## Fases 2 y 3

- `Mi Open Tennis`: jugador guardado en el teléfono, posición, puntos, próximo partido y pendientes.
- Vistas rápidas de calendario personal, próxima fecha, por coordinar y resultados.
- Agregar partidos al calendario, compartir y abrir el marcador precargado.
- Modelo claro de estado (`Por coordinar`) y tipo de programación (`Oficial`, `Adelantado`, `Reprogramado`, `Recuperación`).
- Última copia de los datos disponible sin conexión.

Detalles: `docs/phase-2.md` y `docs/phase-3.md`.

## Fase 1: administrador

La fase 1 agrega un panel pensado para el celular que escribe directamente en el mismo Google Sheets, calcula puntos y deja auditoría de cada cambio.

- Instalación: `admin/README.md`.
- Resumen técnico y reglas: `docs/phase-1.md`.
- Código de Apps Script: `admin/apps-script/`.
- Verificación: `npm test`, `npm run validate:data` y `npm run check:scripts`.

## Fase 0 de preparación

La configuración de datos quedó centralizada y documentada antes de construir el administrador de resultados.

- Contrato de datos: `docs/data-contract.md`.
- Resumen y restauración: `docs/phase-0.md`.
- Respaldos fechados: `data/backups/`.
- Validación: `npm test` y `npm run validate:data`.

## Cambios V5

- Pantalla de inicio simplificada: solo banner principal + banner para agregar la app al inicio.
- Se eliminó el popup de instalación.
- Menú principal corregido como barra inferior fija en todas las páginas.
- Ajustes de móvil para evitar scroll horizontal y mantener la experiencia tipo app.
- Tema visual elegante inspirado en tenis sobre arcilla: verde profundo, terracota y crema.
- Reglamento en texto HTML, sin imágenes.
- Mejor adaptación de escritorio con ancho máximo, tarjetas y espaciado consistente.
- Cache PWA actualizado a `open-tennis-v12-shell`.

## Archivos principales

- `index.html`: inicio compacto.
- `partidos.html`: programación y resultados desde Google Sheets.
- `tablas.html`: tablas de posiciones desde Google Sheets.
- `reglas.html`: reglamento en texto.
- `marcador.html`: marcador interactivo.
- `assets/css/v5.css`: ajustes principales de la V5.
- `assets/js/pwa-install.js`: instalación sin popup.
- `manifest.webmanifest` y `sw.js`: soporte PWA.

## Recomendación al subir a GitHub

Reemplaza todos los archivos del repositorio por los de este ZIP.
Luego abre la URL con `?v=5` para evitar caché temporal, por ejemplo:

```txt
https://tgb96.github.io/oth4/?v=5
```

Si el celular todavía muestra una versión anterior, borra los datos del sitio o abre en incógnito para limpiar el service worker antiguo.


## Resultados históricos 2025

- Página: `resultados-2025.html`
- Datos locales: `data/resultados-2025.json`
- Contiene las categorías A, B, C y D con sus partidos, posiciones finales, estadísticas, historiales y observaciones de cierre de temporada.
