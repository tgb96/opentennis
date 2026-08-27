# Fase 3: acciones útiles y continuidad móvil

## Entregado

- Apertura del marcador con categoría y jugadores precargados desde cualquier partido.
- Archivo de calendario `.ics` con zona horaria `America/Santiago`.
- Compartir un partido mediante el menú del teléfono o WhatsApp como alternativa.
- Última copia de fixture, registro y rankings disponible sin conexión mediante el service worker.
- Caché de la nueva experiencia personal y sus estilos.

## Protección

- Las acciones públicas son de lectura y no escriben resultados.
- El administrador continúa siendo la única vía oficial de escritura.
- Abrir el marcador desde la programación no inicia el partido automáticamente; el jugador todavía debe confirmarlo.
