# MIKELOCATIONS

Aplicación móvil con Expo SDK 54 que registra ubicación por distancia y envía telemetría extendida a un webhook de n8n. No utiliza polling periódico: el sistema operativo notifica cambios de posición y la app transmite cuando detecta aproximadamente 10 metros de desplazamiento.

## Requisitos

- Node.js 20.19.x o posterior.
- Dispositivo físico Android o iOS con GPS.
- Workflow de n8n activo y una URL de webhook de producción.
- Development build para rastreo en segundo plano en iOS. Expo Go no soporta esta función en iOS.

## Instalación

```bash
npm install
npx expo start
```

Dependencias principales: `expo-location`, `expo-task-manager`, `expo-device`, `expo-battery` y `react-native-maps`.

## Configuración antes de entregar

En `app/(tabs)/index.tsx`:

1. Cambia `STUDENT_NAME` por tu nombre completo.
2. Confirma que `N8N_WEBHOOK_URL` sea el webhook de producción de tu workflow.
3. Activa el workflow de n8n antes de la prueba.

Si cambias permisos o propiedades del plugin `expo-location` en `app.json`, genera un nuevo development build; esos cambios nativos no se aplican solamente reiniciando Metro.

## Funcionamiento

1. Al abrirse, solicita permiso de ubicación en primer plano y centra el mapa.
2. `watchPositionAsync` actualiza el mapa cada 10 metros mientras la pantalla está abierta.
3. Al presionar **Iniciar Rastreo**, la app explica y solicita el permiso en segundo plano.
4. `startLocationUpdatesAsync` registra una tarea nativa con `distanceInterval: 10`.
5. La tarea global toma la medición más reciente, consulta batería y hardware, y hace un POST a n8n.
6. **Detener Rastreo** cancela las actualizaciones y el envío.

## Payload enviado

```json
{
  "usuario": "Nombre completo",
  "dispositivo": {
    "nombre": "Samsung Galaxy S24",
    "version": "Android 15"
  },
  "ubicacion": {
    "lat": 32.5149,
    "lon": -117.0382,
    "altitud": 112.5,
    "precision": 4.2
  },
  "movimiento": {
    "velocidad": 1.4,
    "marca_tiempo": "2026-07-04T14:58:00.000Z"
  },
  "estado": {
    "bateria": 0.85
  }
}
```

Altitud, velocidad, precisión y batería pueden ser `null` cuando el dispositivo o el proveedor de ubicación no ofrecen la medición. La batería se expresa entre `0` y `1`.

## Prueba de entrega

1. Usa un teléfono físico, habilita ubicación precisa y abre la app.
2. Acepta el permiso de primer plano y toma la captura de la interfaz.
3. Presiona **Iniciar Rastreo** y concede **Permitir siempre**.
4. Camina más de 30 metros para obtener varias ejecuciones.
5. Comprueba en n8n que cada ejecución incluya todos los bloques del JSON.
6. Toma la captura del historial y otra del payload expandido.

## Consideraciones de segundo plano

- Android muestra una notificación persistente durante el rastreo.
- En iOS se necesita un development build y permiso **Always**.
- El sistema puede detener actualizaciones si el usuario fuerza el cierre de la app.
- Algunos fabricantes Android aplican restricciones adicionales de batería.

Consulta `REPORTE_TECNICO.md` para el texto base del entregable.
