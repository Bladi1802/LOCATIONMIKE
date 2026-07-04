# MIKELOCATIONS

App móvil (iOS/Android) para compartir ubicación en tiempo real. Cada vez que te mueves 10 metros, envía automáticamente tu posición a un webhook de n8n.

## Requisitos

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- Dispositivo físico (iOS/Android) con Expo Go, o emulador

## Instalación

```bash
npm install
```

## Dependencias principales

| Paquete             | Propósito                                      |
| ------------------- | ---------------------------------------------- |
| `expo-location`     | Obtener ubicación GPS (primer y segundo plano) |
| `expo-task-manager` | Ejecutar tareas en segundo plano               |
| `react-native-maps` | Mostrar Mapa con marcador de ubicación         |
| `expo-router`       | Navegación por archivos                        |

## Uso

```bash
npx expo start
```

Escanea el QR con **Expo Go** en tu celular, o presiona `a` para Android / `i` para iOS.

## Cómo funciona

1. Al abrir la app pide permisos de ubicación (en primer y segundo plano).
2. Muestra tu ubicación actual en un mapa.
3. Presiona **"Iniciar Rastreo"** para comenzar a monitorear.
4. Cada **10 metros** de desplazamiento, envía un POST con tu ubicación al webhook de n8n.
5. El rastreo continúa incluso en segundo plano.
6. Presiona **"Detener Rastreo"** para finalizar.

### Payload enviado a n8n

```json
{
  "latitude": 18.1234,
  "longitude": -66.5678,
  "timestamp": "2026-07-04T12:00:00.000Z",
  "accuracy": 5,
  "altitude": 50,
  "speed": 1.2,
  "heading": 180,
  "deviceId": "mi-celular-001"
}
```

## Configuración

Edita la URL del webhook en `app/(tabs)/index.tsx`:

```ts
const N8N_WEBHOOK_URL = "https://tu-dominio.com/webhook/...";
```

## Notas

- Solo funciona en iOS/Android. `react-native-maps` no es compatible con web.
- El rastreo en segundo plano requiere permisos especiales (`ACCESS_BACKGROUND_LOCATION` en Android, `NSLocationAlways` en iOS).
