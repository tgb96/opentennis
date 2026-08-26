# Fase 0: preparación y protección de datos

## Completado

- Copia fechada de fixture, registro y rankings publicados.
- Hash SHA-256 para verificar que cada respaldo permanezca intacto.
- Fuente única de configuración.
- Contrato de columnas documentado.
- Estados administrativos normalizados.
- ID estable de partido con compatibilidad para filas antiguas.
- Detección de IDs duplicados.
- Validación automatizada del respaldo.
- Zona horaria `America/Santiago` en la detección de próxima fecha.

## Restauración

1. Elegir una carpeta dentro de `data/backups`.
2. Verificar sus hashes con el archivo `README.md` correspondiente.
3. Importar cada CSV en una pestaña temporal del Google Sheets.
4. Comparar cantidad de filas y encabezados antes de reemplazar una hoja publicada.

Nunca se debe sobrescribir la hoja publicada sin conservar primero otra copia dentro de Google Drive.

## Pendiente para el administrador

- Agregar la columna J `ID partido` al fixture.
- Agregar la columna W `ID partido` al registro.
- Completar los IDs mediante el administrador; no es necesario editar manualmente las filas antiguas.
- Incorporar una hoja privada de auditoría para registrar altas y correcciones.
