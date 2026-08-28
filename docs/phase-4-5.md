# Fases 4 y 5 · experiencia deportiva y marcador público

## Fase 4

La página de tablas incorpora un panel personal conectado a los rankings, el registro de resultados y el fixture existentes.

- Conserva el jugador seleccionado en el teléfono.
- Muestra posición, puntos, récord, rendimiento, racha y próximo partido.
- Indica la distancia de puntos respecto del puesto inmediatamente superior.
- Compara la posición con la última referencia guardada en el mismo dispositivo. La primera visita crea esa referencia; no se presenta como un historial oficial del torneo.
- Permite elegir un rival de la misma categoría y muestra enfrentamientos ganados, último resultado y próximo cruce disponible.
- Resalta al jugador elegido dentro de su tabla.
- Mantiene visibles las zonas oficiales de ascenso, repechaje y descenso ya definidas para el torneo.

La vista `Próxima fecha` de `partidos.html` ahora significa **próximo partido programado del jugador**, no próxima semana global. `Por coordinar` y `Resultados` también conservan siempre el jugador elegido. Solo `Todo` muestra el torneo completo.

## Fase 5

El marcador sigue siendo público mediante `marcador.html`, pero no ocupa un botón en la navegación principal destinada a jugadores.

Al finalizar un partido aparecen tres acciones:

1. Compartir una imagen.
2. Compartir el resultado por WhatsApp.
3. Copiar el resultado.

Compartir no escribe en Google Sheets. El administrador recibe el resultado y lo registra manualmente desde el panel privado, tal como se acordó para esta etapa.

## Optimización

- `assets/css/app.css` reúne las cinco capas históricas de estilos públicos en una sola descarga.
- `assets/css/scoreboard.css` reúne las tres capas compartidas que usa el marcador.
- `npm run build:css` regenera ambos archivos desde las fuentes históricas.
- Las páginas usan `assets/icons/icon-512.png` en lugar de `assets/img/logo-open-tennis.png`, reduciendo la descarga inicial del escudo de aproximadamente 1,46 MB a 256 KB.
- El service worker usa una nueva versión de caché para entregar estos recursos actualizados.

## Verificación realizada

- 22 pruebas automáticas aprobadas.
- Validación de los respaldos de fixture, registro y rankings.
- Verificación de sintaxis de todas las páginas y Apps Script.
- Revisión móvil de inicio, filtros personales, perfil, cara a cara y finalización del marcador.
