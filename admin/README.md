# Administrador de resultados

Este módulo es una aplicación privada de Google Apps Script conectada al mismo Google Sheets que alimenta el sitio público.

## Qué resuelve

- Lista partidos por coordinar, programados y jugados.
- Busca por jugador y filtra por categoría.
- Registra resultados normales y super tie-breaks.
- Calcula ganador, sets, texto público y puntos `3–0` o `2–1`.
- Registra partidos por coordinar, nuevas fechas, suspensiones y W/O.
- Conserva la programación oficial y separa el tipo Oficial, Adelantado, Reprogramado o Recuperación.
- Actualiza la fila existente en vez de crear un duplicado.
- Guarda cada creación o corrección en `Admin Auditoría`.
- Bloquea guardados simultáneos y valida todos los datos en el servidor.
- Abre por defecto la próxima jornada y separa partidos por registrar, por confirmar y ya registrados.
- Ofrece accesos rápidos para resultado, pendiente, reprogramación y W/O sin guardar accidentalmente.
- Muestra una vista previa del resultado, puntos y posición estimada antes de publicar.
- Permite deshacer el último movimiento durante 10 minutos si nadie modificó después esas filas.
- Reúne alertas de fechas vencidas, resultados incompletos, duplicados y rankings desactualizados.
- Confirma por separado el guardado en Sheets, la verificación del ranking y la aparición en la fuente pública.

## Instalación en Google Sheets

1. Haz una copia del archivo de Google Sheets en Drive.
2. Abre **Extensiones → Apps Script** desde ese mismo Sheets.
3. Copia los archivos de `admin/apps-script/` al proyecto, respetando sus nombres y tipos `.gs` o `.html`.
4. Activa la visualización del manifiesto y reemplázalo por `appsscript.json`.
5. En el editor ejecuta una sola vez:

   ```js
   setupAdmin("TU_CORREO_DE_GOOGLE")
   ```

6. Acepta los permisos solicitados. Esa función verifica o crea los encabezados J–O/W, asigna IDs solamente a coincidencias inequívocas, conserva la programación oficial y crea `Admin Auditoría`.
7. Selecciona **Implementar → Nueva implementación → Aplicación web**.
8. Configura **Ejecutar como: usuario que accede a la aplicación web** y **Quién tiene acceso: solo yo**.
9. Abre `https://opentennis.cl/admin/` y usa **Instalar aplicación** para crear la PWA con el ícono propio del administrador. La app instalada abre la aplicación privada de Apps Script y Google sigue exigiendo la cuenta autorizada.

La opción **usuario que accede** es necesaria para que Google entregue el correo y el servidor pueda compararlo con la lista autorizada. La pantalla de instalación pública no contiene resultados ni da acceso al panel: solamente abre la URL privada, cuya autorización sigue controlando Apps Script. Si en el futuro necesitas más de un administrador, agrega primero su correo con `addAdminEmail("CORREO")` y luego amplía el acceso solamente a usuarios que hayan iniciado sesión.

## Prueba local para desarrollo

```sh
npm run preview:admin
```

La vista de prueba usa datos ficticios y nunca escribe en Google Sheets.
