/**
 * app/(tabs)/index.tsx — Pantalla principal de MIKELOCATIONS
 *
 * Muestra un mapa con la ubicación actual y un botón para iniciar/detener
 * el rastreo en tiempo real. Cuando está activo, cada 10 metros de
 * desplazamiento envía la posición a un webhook de n8n.
 *
 * Dependencias: expo-location, expo-task-manager, react-native-maps
 */

import * as Location from "expo-location";
import * as TaskManager from "expo-task-manager";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

// Nombre interno con el que se registra la tarea en segundo plano.
const LOCATION_TRACKING_TASK = "LOCATION_TRACKING_TASK";

/** URL del webhook de n8n donde se enviarán los datos de ubicación. */
const N8N_WEBHOOK_URL =
  "https://mike-cardona-170526.mikecardona076.com/webhook/0fe99c00-9754-476d-8119-bdec18fa3199";

/**
 * Tarea que Expo ejecuta en segundo plano cada vez que el GPS reporta
 * una nueva ubicación (según distanceInterval/timeInterval).
 *
 * Recibe un array de ubicaciones y envía la más reciente a n8n.
 */
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Error en la tarea de ubicación:", error);
    return;
  }
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    const location = locations[0];
    if (location) {
      const { latitude, longitude } = location.coords;
      console.log(`Nueva ubicación detectada: ${latitude}, ${longitude}`);
      await sendLocationToN8n(latitude, longitude, location.coords);
    }
  }
});

/**
 * Envía un POST al webhook de n8n con la ubicación actual y metadatos
 * (precisión, altitud, velocidad, rumbo, timestamp).
 */
const sendLocationToN8n = async (
  lat: number,
  lon: number,
  coords: Location.LocationObjectCoords,
) => {
  try {
    const payload = {
      latitude: lat,
      longitude: lon,
      timestamp: new Date().toISOString(),
      accuracy: coords.accuracy,
      altitude: coords.altitude,
      speed: coords.speed,
      heading: coords.heading,
      deviceId: "mi-celular-001",
    };

    console.log("Enviando datos a n8n...", payload);

    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(
        `Error en la red: ${response.status} ${response.statusText}`,
      );
    }

    const result = await response.json();
    console.log("n8n respondió:", result);
  } catch (error) {
    console.error("Error enviando a n8n:", error);
  }
};

/**
 * Pantalla principal.
 *
 * 1. Pide permisos de ubicación (primer y segundo plano).
 * 2. Obtiene la ubicación actual y la centra en el mapa.
 * 3. Muestra un botón para iniciar/detener el rastreo.
 *
 * Cuando el rastreo está activo, expo-location ejecuta la tarea
 * LOCATION_TRACKING_TASK cada 10 metros (distanceInterval: 10).
 */
export default function Index() {
  // Indica si el rastreo está activo en este momento.
  const [isTracking, setIsTracking] = useState(false);

  // Mientras se cargan permisos y ubicación inicial.
  const [isLoading, setIsLoading] = useState(true);

  // Coordenadas de la última ubicación obtenida.
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObjectCoords | null>(null);

  // Región visible del mapa (centro y zoom).
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });

  // Inicialización al montar el componente.
  useEffect(() => {
    (async () => {
      // 1. Permiso de ubicación en primer plano (obligatorio).
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso denegado",
          "Por favor, permite el acceso a la ubicación para usar la app.",
        );
        setIsLoading(false);
        return;
      }

      // 2. Permiso de ubicación en segundo plano (opcional, pero recomendado).
      let bgStatus = await Location.requestBackgroundPermissionsAsync();
      if (bgStatus.status !== "granted") {
        console.log(
          "Permiso de segundo plano denegado. Solo funcionará en primer plano.",
        );
      }

      // 3. Obtener ubicación actual para centrar el mapa.
      let currentLoc = await Location.getCurrentPositionAsync({});
      setCurrentLocation(currentLoc.coords);
      setMapRegion({
        latitude: currentLoc.coords.latitude,
        longitude: currentLoc.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });

      // 4. Verificar si ya hay una tarea de rastreo registrada (ej. porque la
      //    app se reabrió sin haber detenido el rastreo explícitamente).
      const hasStarted = await TaskManager.isTaskRegisteredAsync(
        LOCATION_TRACKING_TASK,
      );
      setIsTracking(hasStarted);
      setIsLoading(false);
    })();
  }, []);

  /** Inicia el rastreo continuo. Se dispara cada 10 m de desplazamiento. */
  const startTracking = async () => {
    try {
      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
        accuracy: Location.Accuracy.High,
        timeInterval: 10000,
        distanceInterval: 10,
        showsBackgroundLocationIndicator: true,
        deferredUpdatesInterval: 10000,
      });
      setIsTracking(true);
      Alert.alert(
        "Rastreando",
        "Tu ubicación se está compartiendo cada 10 metros.",
      );
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "No se pudo iniciar el rastreo.");
    }
  };

  /** Detiene el rastreo y libera los recursos del GPS. */
  const stopTracking = async () => {
    try {
      await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      setIsTracking(false);
      Alert.alert("Detenido", "Has dejado de compartir tu ubicación.");
    } catch (err) {
      console.error(err);
    }
  };

  // Pantalla de carga mientras se obtienen permisos y ubicación.
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6C63FF" />
        <Text style={styles.loadingText}>Obteniendo tu ubicación...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Mapa de la ubicación actual */}
      <MapView
        style={styles.map}
        region={mapRegion}
        provider={PROVIDER_DEFAULT}
        showsUserLocation={true}
        showsMyLocationButton={true}
      >
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title="Estás aquí"
            description="Tu ubicación actual"
          />
        )}
      </MapView>

      {/* Panel de control superpuesto en la parte inferior */}
      <View style={styles.controlPanel}>
        {/* Indicador de estado (verde = rastreando, rojo = detenido) */}
        <View style={styles.statusContainer}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: isTracking ? "#4CAF50" : "#F44336" },
            ]}
          />
          <Text style={styles.statusText}>
            {isTracking ? "Compartiendo ubicación" : "Ubicación detenida"}
          </Text>
        </View>

        {/* Coordenadas actuales en formato legible */}
        {currentLocation && (
          <Text style={styles.coordsText}>
            Lat: {currentLocation.latitude.toFixed(4)} | Lon:{" "}
            {currentLocation.longitude.toFixed(4)}
          </Text>
        )}

        {/* Botón principal: inicia o detiene el rastreo */}
        <TouchableOpacity
          style={[
            styles.button,
            isTracking ? styles.stopButton : styles.startButton,
          ]}
          onPress={isTracking ? stopTracking : startTracking}
        >
          <Text style={styles.buttonText}>
            {isTracking ? "Detener Rastreo" : "Iniciar Rastreo"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * Estilos de la pantalla.
 * Tema oscuro con panel de control semitransparente al fondo.
 */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: {
    color: "#fff",
    marginTop: 15,
    fontSize: 16,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  controlPanel: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "rgba(30, 30, 30, 0.9)",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  statusText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  coordsText: {
    color: "#aaa",
    fontSize: 14,
    marginBottom: 20,
    fontFamily: "monospace",
  },
  button: {
    width: "100%",
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  startButton: {
    backgroundColor: "#6C63FF",
  },
  stopButton: {
    backgroundColor: "#FF4B4B",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
});
