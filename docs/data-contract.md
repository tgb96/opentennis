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
| `pendiente` | Pendiente |
| `reprogramado` | Reprogramado |
| `wo_j1` | W/O Jugador 1 |
| `wo_j2` | W/O Jugador 2 |
| `wo_ambos` | W/O ambos |
| `suspendido` | Suspendido |

El módulo `assets/js/data-model.js` normaliza variantes antiguas como "postergado" o "partido jugado".

## Zona horaria

Toda decisión sobre la fecha actual debe utilizar `America/Santiago`. No se debe fijar manualmente GMT-3 o GMT-4.
