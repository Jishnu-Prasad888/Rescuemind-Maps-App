import axios from "axios";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";
const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY;

if (!ORS_API_KEY) {
  console.error(
    "❌ OpenRouteService API key is missing. Check your .env file.",
  );
}

type ORSStep = {
  instruction: string;
  distance: number;
};

type Coordinate = {
  latitude: number;
  longitude: number;
};

const destination = {
  latitude: 12.9716,
  longitude: 77.5946,
};
export default function TabTwoScreen() {
  const [region, setRegion] = useState<Region | null>(null);
  const [routeCoords, setRouteCoords] = useState<Coordinate[]>([]);
  const [steps, setSteps] = useState<ORSStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.error("Location permission not granted");
        return;
      }

      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 5,
        },
        (location) => {
          const { latitude, longitude } = location.coords;

          setRegion({
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });

          fetchRoute(latitude, longitude);
        },
      );
    })();
  }, []);

  const fetchRoute = async (lat: number, lng: number) => {
    try {
      const response = await axios.post(
        "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
        {
          coordinates: [
            [lng, lat],
            [destination.longitude, destination.latitude],
          ],
        },
        {
          headers: {
            Authorization: ORS_API_KEY,
            "Content-Type": "application/json",
          },
        },
      );

      const coords = response.data.features[0].geometry.coordinates.map(
        (c: number[]) => ({
          latitude: c[1],
          longitude: c[0],
        }),
      );

      const routeSteps = response.data.features[0].properties.segments[0].steps;

      setRouteCoords(coords);
      setSteps(routeSteps);
    } catch (err) {
      console.log(err);
    }
  };

  const getNextTurnDistance = () => {
    if (!steps[currentStepIndex]) return null;
    return Math.round(steps[currentStepIndex].distance);
  };

  return (
    <View style={styles.container}>
      {region && (
        <MapView style={styles.map} region={region} showsUserLocation>
          <Marker coordinate={destination} />
          <Polyline coordinates={routeCoords} strokeWidth={4} />
        </MapView>
      )}

      <View style={styles.infoBox}>
        {steps[currentStepIndex] && (
          <>
            <Text style={styles.instruction}>
              {steps[currentStepIndex].instruction}
            </Text>
            <Text style={styles.distance}>{getNextTurnDistance()} meters</Text>
          </>
        )}
      </View>

      <FlatList
        data={steps}
        keyExtractor={(_, i) => i.toString()}
        renderItem={({ item }) => (
          <Text style={styles.stepItem}>
            {item.instruction} ({Math.round(item.distance)} m)
          </Text>
        )}
        style={styles.list}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  infoBox: {
    position: "absolute",
    top: 50,
    left: 10,
    right: 10,
    backgroundColor: "white",
    padding: 10,
    borderRadius: 10,
  },
  instruction: { fontSize: 16, fontWeight: "bold" },
  distance: { fontSize: 14, color: "gray" },
  list: {
    position: "absolute",
    bottom: 0,
    backgroundColor: "white",
    maxHeight: 200,
  },
  stepItem: { padding: 8, fontSize: 14 },
});
