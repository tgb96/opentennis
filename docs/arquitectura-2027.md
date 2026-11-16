# Arquitectura y forma de trabajo 2027

## División de responsabilidades

### Administración semanal de Tomás

- Registrar y corregir resultados.
- Cambiar la fecha real, cancha, turno o estado de un partido.
- Dejar encuentros por coordinar.
- Aplazar desde un sábado todas las fechas siguientes por lluvia.
- Revisar la publicación y las alertas operativas.

El administrador abre por defecto en **Uso semanal** y muestra solamente esas tareas.

### Configuración estructural asistida

Se prepara a partir de la información que entregue la organización y de los criterios ya aprobados:

- altas, bajas, nombres oficiales y alias de jugadores;
- creación de temporadas, escalerillas, categorías y torneos;
- inscripción y distribución de participantes;
- sorteo equilibrado de la programación;
- cuadros de eliminación directa e interclubes;
- reglas, excepciones y abandonos definitivos;
- archivo histórico y continuidad del Cara a Cara.

Estas herramientas quedan disponibles en **Estructura avanzada**, separadas de la operación habitual.

## Modelo de datos

La temporada 2027 deja de depender de la forma visual del Excel 2026. La fuente operativa sigue siendo Google Sheets, porque se integra directamente con el administrador y la app, pero funciona como una base normalizada con tablas relacionadas:

1. `OT Jugadores`: identidad permanente, nombre oficial, alias, sexo y estado.
2. `OT Competiciones`: escalerillas, torneos e interclubes por temporada y edición.
3. `OT Categorías`: categorías y formato de cada escalerilla.
4. `OT Inscripciones`: relación entre competición, categoría y jugador.
5. `OT Partidos`: programación oficial, fecha real, participantes, resultado y efectos deportivos.
6. `OT Auditoría 2027`: historial de cada movimiento administrativo.
7. `OT Respaldos 2027`: instantáneas por partes antes de cambios masivos.

Los vínculos se hacen con identificadores estables, nunca con la posición de una fila ni con el texto exacto del nombre. Así un cambio de categoría o una abreviación no rompe el historial.

## Protecciones

- Cada escritura toma un bloqueo para impedir que dos operaciones se pisen.
- Resultados y reprogramaciones quedan auditados sin crear una copia completa, para mantener una respuesta rápida.
- Sorteos, inscripciones masivas, aplazamientos, abandonos e inicializaciones crean un respaldo antes de modificar datos.
- Los byes y partidos anulados declaran expresamente si cuentan para tabla y Cara a Cara.
- La fecha oficial y la fecha real del partido se guardan por separado.
- Un resultado corregido en un torneo advierte si afecta rondas posteriores.

## Flujo para una nueva escalerilla

1. Crear la competición y sus categorías.
2. Confirmar o crear jugadores; cada alta recibe un identificador permanente único.
3. Asignar inscritos a cada categoría.
4. Definir primer sábado, canchas y turnos.
5. Generar y revisar la programación equilibrada.
6. Publicar en la app.
7. Operar semana a semana desde la vista simple.

El sorteo distribuye las rondas de todas las categorías durante un periodo común, evita dos partidos de una misma persona en un día y conserva la posibilidad de mover desde una fecha toda la programación siete días hacia adelante.
