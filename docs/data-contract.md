# Contrato de datos de Open Tennis

Este documento registra las dependencias entre Google Sheets y la aplicación. Las columnas existentes no se modifican en la fase 0.

## Fuentes

Las tres URLs publicadas se definen solamente en `assets/js/config.js`:

- Fixture: programación, cancha, turno y participantes.
- Registro: resultados, pendientes, observaciones y puntos.
- Rankings: posiciones por categoría.

## Fixture

| Columna | Nombre | Uso |
| --- | --- | --- |
| A | Semana | Número o etiqueta de semana |
| B | Cancha | Cancha programada |
| C | Turno | Horario o número de turno |
| D | Categoría | A, B, C o D |
| E | Jugador 1 | Nombre oficial |
| F | Jugador 2 | Nombre oficial |
| G | Fecha | Formato `dd/mm/aaaa` |
| H | Estado | Opcional; estado administrativo |
| I | Observaciones | Opcional |
| J | ID partido | Nuevo y opcional durante la migración |
| K | Fecha oficial | Fecha originalmente enviada en la programación semanal |
| L | Cancha oficial | Cancha original, nunca se reemplaza |
| M | Turno oficial | Bloque original, nunca se reemplaza |
| N | Tipo programación | `oficial`, `adelantado`, `reprogramado` o `recuperacion` |
| O | Ronda | `Única`, `Ida` o `Vuelta` |

## Registro

La aplicación actual consume las columnas A–S y V. Se conserva su orden.

| Columna | Nombre | Uso principal |
| --- | --- | --- |
| A | Fecha | Fecha efectiva del partido |
| B–C | Jugador 1 / Jugador 2 | Participantes |
| D | Pendiente | Indicador legado |
| E | Observaciones | Adelantado, reprogramado u otra nota |
| F–K | Marcadores | Sets y super tie-break |
| L–M | Sets ganados | Totales por jugador |
| N–O | Ganador / Perdedor | Resultado calculado |
| P–Q | Tipo / Resultado web | Presentación en la app |
| R–U | Puntos | Puntuación calculada |
| V | Clave interna | Clave legada basada en la pareja |
| W | ID partido | Nuevo y opcional durante la migración |

## Identificador estable

Formato generado:

`temporada-semana-categoria-jugador-a-jugador-b`

Ejemplo:

`2026-s9-categoria-a-diego-fossa-jose-astete`

Los jugadores se ordenan alfabéticamente dentro del ID. Por eso el identificador no cambia si el resultado llega con Jugador 1 y Jugador 2 invertidos.

Durante la migración:

1. Si existe un ID explícito en las columnas J/W, se utiliza ese valor.
2. Si no existe, la app genera el ID desde el fixture.
3. Para registros antiguos se mantiene el cruce por nombres.
4. El administrador de la fase siguiente escribirá siempre el ID explícito.

## Estados oficiales

| Código | Etiqueta visible |
| --- | --- |
| `programado` | Programado |
| `jugado` | Jugado |
| `por_coordinar` | Por coordinar |
| `wo_j1` | W/O Jugador 1 |
| `wo_j2` | W/O Jugador 2 |
| `wo_ambos` | W/O ambos |
| `suspendido` | Suspendido |

`Reprogramado` ya no es un estado: es un tipo de programación que exige una nueva fecha. El módulo `assets/js/data-model.js` convierte variantes antiguas como "pendiente" y "postergado" en `por_coordinar` para mantener compatibilidad.

## Reglas estadísticas confirmadas

Estas reglas son oficiales y deben aplicarse de la misma forma en el administrador, el registro, las tablas y los detalles de cada jugador:

- Un partido ganado por W/O se registra como `6-0, 6-0`. Aporta `2-0` en sets, `12-0` en games y `3-0` en puntos.
- El super tie-break decide el ganador y mantiene el reparto de `2-1` en puntos, pero no cuenta como un set. Un partido definido por super tie-break aporta `1-1` en sets.
- Los puntos del super tie-break no se suman como games. Los games corresponden solamente a los dos sets regulares.
- Un retiro antes de comenzar el primer punto se trata como W/O.
- Si el partido ya comenzó, se conserva todo el marcador efectivamente jugado y se adjudican al jugador que no se retiró todos los games restantes necesarios para completar el partido.
- Si el jugador retirado ya había ganado un set regular, los puntos se reparten `2-1`. El set en curso se completa a favor del ganador y el super tie-break pendiente se registra `10-0`.
- Si el jugador retirado no había ganado ningún set regular, los puntos se reparten `3-0` y se completan a favor del ganador los sets y games que falten.
- Si el retiro ocurre con el super tie-break iniciado, se conservan los puntos disputados y se adjudican al ganador los puntos restantes hasta alcanzar un marcador válido. Si todavía no había comenzado, queda `10-0`.
- El super tie-break de un retiro tampoco cuenta como set ni como game.

## Zona horaria

Toda decisión sobre la fecha actual debe utilizar `America/Santiago`. No se debe fijar manualmente GMT-3 o GMT-4.
