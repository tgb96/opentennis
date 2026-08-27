# Fase 1: administrador privado de resultados

## Entregado

- Aplicación web móvil en Google Apps Script.
- Acceso cerrado al correo configurado.
- Resumen de partidos por coordinar, programados y jugados.
- Búsqueda por jugador y filtro por categoría.
- Formulario para resultado, por coordinar, nueva fecha acordada, suspendido y W/O.
- Motor centralizado de validación y puntaje.
- Escritura compatible con las 23 columnas del registro.
- ID estable por partido con compatibilidad para filas legadas.
- Migración automática de IDs por pareja y, cuando se repiten rivales, por pareja + fecha.
- Actualización de filas existentes y rechazo de coincidencias ambiguas.
- Bloqueo de escritura para evitar guardados simultáneos.
- Hoja privada de auditoría con valor anterior y nuevo.

## Reglas comprobadas

| Resultado | Puntos ganador | Puntos perdedor |
| --- | ---: | ---: |
| Dos sets | 3 | 0 |
| Super tie-break | 2 | 1 |
| W/O de un jugador | 3 | 0 |
| W/O de ambos | 0 | 0 |

El super tie-break se solicita solamente cuando cada jugador ganó un set. El texto `Resultado web` se genera desde la perspectiva del ganador, igual que en los datos actuales.

## Protección de datos

- El navegador nunca decide el ganador ni los puntos; el servidor vuelve a calcularlos.
- Un mismo ID de partido no puede apuntar a más de una fila.
- Si dos filas legadas coinciden con la misma pareja, el guardado se detiene y muestra las filas conflictivas.
- Las segundas rondas de la categoría D reciben un ID distinto y nunca reemplazan el cruce anterior.
- Cada cambio queda registrado en `Admin Auditoría`.
- Si la auditoría no puede escribirse, el registro se restaura al valor anterior.
- La instalación recomendada se ejecuta como el usuario que accede y permite acceso solamente al propietario; así Google entrega una identidad verificable al servidor.

## Verificación

- Casos automatizados para dos sets, super tie-break, W/O, fechas y estructura de 23 columnas.
- Validación del respaldo de fixture, registro y rankings.
- Comprobación de sintaxis de la aplicación pública y del administrador.
