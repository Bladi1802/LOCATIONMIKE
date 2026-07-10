import * as Battery from "expo-battery";
import * as Device from "expo-device";
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

const LOCATION_TRACKING_TASK = "LOCATION_TRACKING_TASK";
const STUDENT_NAME = "Bladimir Mejia Hernandez";
const N8N_WEBHOOK_URL =
  "http://localhost:5678/webhook-test/0fe99c00-9754-476d-8119-bdec18fa3199";

type LocationTaskData = { locations: Location.LocationObject[] };

const getDeviceName = () => {
  const parts = [Device.brand, Device.modelName].filter(
    (part, index, values): part is string =>
      Boolean(part) && values.indexOf(part) === index,
  );
  return parts.join(" ") || Device.deviceName || "Dispositivo desconocido";
};

/** Construye y envía el payload extendido exigido por la actividad. */
const sendLocationToN8n = async (location: Location.LocationObject) => {
  try {
    const batteryLevel = await Battery.getBatteryLevelAsync();
    const { latitude, longitude, altitude, accuracy, speed } = location.coords;
    const payload = {
      usuario: STUDENT_NAME,
      dispositivo: {
        nombre: getDeviceName(),
        version:
          [Device.osName, Device.osVersion].filter(Boolean).join(" ") ||
          "Versión desconocida",
      },
      ubicacion: {
        lat: latitude,
        lon: longitude,
        altitud: altitude,
        precision: accuracy,
      },
      movimiento: {
        velocidad: speed,
        marca_tiempo: new Date(location.timestamp).toISOString(),
      },
      estado: { bateria: batteryLevel >= 0 ? batteryLevel : null },
    };

    console.log("Enviando telemetría a n8n:", JSON.stringify(payload, null, 2));
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(
        `n8n respondió ${response.status}: ${body || response.statusText}`,
      );
    }
    console.log("Telemetría recibida por n8n:", body || "sin contenido");
  } catch (error) {
    console.error("No se pudo enviar la telemetría a n8n:", error);
  }
};

// Expo requiere definir las tareas de segundo plano en el ámbito global.
TaskManager.defineTask(LOCATION_TRACKING_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Error en la tarea de ubicación:", error.message);
    return;
  }
  const locations = (data as LocationTaskData | undefined)?.locations;
  const newestLocation = locations?.at(-1);
  if (newestLocation) await sendLocationToN8n(newestLocation);
});

const requestBackgroundPermission = () =>
  new Promise<boolean>((resolve) => {
    Alert.alert(
      "Ubicación en segundo plano",
      "Para registrar cada tramo de 10 metros aunque minimices la app, selecciona Permitir siempre.",
      [
        { text: "Cancelar", style: "cancel", onPress: () => resolve(false) },
        {
          text: "Continuar",
          onPress: async () => {
            const permission =
              await Location.requestBackgroundPermissionsAsync();
            resolve(permission.status === "granted");
          },
        },
      ],
      { cancelable: false },
    );
  });

export default function Index() {
  const [isTracking, setIsTracking] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObjectCoords | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const updateMapLocation = (location: Location.LocationObject) => {
    const { latitude, longitude } = location.coords;
    setCurrentLocation(location.coords);
    setMapRegion((region) => ({ ...region, latitude, longitude }));
  };

  useEffect(() => {
    let mounted = true;
    let mapSubscription: Location.LocationSubscription | undefined;
    const initialize = async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== "granted") {
          Alert.alert(
            "Permiso denegado",
            "Permite el acceso a la ubicación para usar el rastreador.",
          );
          return;
        }
        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (!mounted) return;
        updateMapLocation(initialLocation);

        // Actualiza el mapa; el POST se hace en la tarea background para no duplicarlo.
        mapSubscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, distanceInterval: 10 },
          (location) => {
            if (mounted) updateMapLocation(location);
          },
        );
        const started = await Location.hasStartedLocationUpdatesAsync(
          LOCATION_TRACKING_TASK,
        );
        if (mounted) setIsTracking(started);
      } catch (error) {
        console.error("No se pudo inicializar la ubicación:", error);
        Alert.alert("Error", "No fue posible obtener la ubicación actual.");
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    initialize();
    return () => {
      mounted = false;
      mapSubscription?.remove();
    };
  }, []);

  const startTracking = async () => {
    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      if (foreground.status !== "granted") {
        Alert.alert("Permiso requerido", "Activa el permiso de ubicación.");
        return;
      }
      let background = await Location.getBackgroundPermissionsAsync();
      if (background.status !== "granted") {
        const granted = await requestBackgroundPermission();
        if (!granted) {
          Alert.alert(
            "Permiso requerido",
            "El rastreo en segundo plano necesita Permitir siempre.",
          );
          return;
        }
        background = await Location.getBackgroundPermissionsAsync();
      }
      if (background.status !== "granted") return;

      await Location.startLocationUpdatesAsync(LOCATION_TRACKING_TASK, {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10,
        activityType: Location.ActivityType.Fitness,
        pausesUpdatesAutomatically: false,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "MIKELOCATIONS está rastreando",
          notificationBody: "Se enviará telemetría cada 10 metros.",
          notificationColor: "#6C63FF",
        },
      });
      setIsTracking(true);
      Alert.alert(
        "Rastreo activo",
        "La telemetría se enviará automáticamente cada 10 metros.",
      );
    } catch (error) {
      console.error("No se pudo iniciar el rastreo:", error);
      Alert.alert("Error", "No se pudo iniciar el rastreo.");
    }
  };

  const stopTracking = async () => {
    try {
      const started = await Location.hasStartedLocationUpdatesAsync(
        LOCATION_TRACKING_TASK,
      );
      if (started)
        await Location.stopLocationUpdatesAsync(LOCATION_TRACKING_TASK);
      setIsTracking(false);
      Alert.alert("Rastreo detenido", "Se detuvo el envío de telemetría.");
    } catch (error) {
      console.error("No se pudo detener el rastreo:", error);
      Alert.alert("Error", "No se pudo detener el rastreo.");
    }
  };

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
      <MapView
        style={styles.map}
        region={mapRegion}
        provider={PROVIDER_DEFAULT}
        showsUserLocation
        showsMyLocationButton
      >
        {currentLocation && (
          <Marker
            coordinate={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            }}
            title="Estás aquí"
            description="Última ubicación registrada"
          />
        )}
      </MapView>
      <View style={styles.controlPanel}>
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
        {currentLocation && (
          <Text style={styles.coordsText}>
            Lat: {currentLocation.latitude.toFixed(5)} | Lon:{" "}
            {currentLocation.longitude.toFixed(5)}
          </Text>
        )}
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

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },
  loadingText: { color: "#fff", marginTop: 15, fontSize: 16 },
  map: { width: "100%", height: "100%" },
  controlPanel: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
    backgroundColor: "rgba(30, 30, 30, 0.92)",
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
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
  statusText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
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
  startButton: { backgroundColor: "#6C63FF" },
  stopButton: { backgroundColor: "#FF4B4B" },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});
