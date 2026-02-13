import axios from "axios";
import * as Location from "expo-location";
import React, { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";

const ORS_API_KEY = process.env.EXPO_PUBLIC_ORS_API_KEY;

type Coordinate = {
  latitude: number;
  longitude: number;
};

export default function Home() {
  const [region, setRegion] = useState<Region | null>(null);
  const [routeCoords, setRouteCoords] = useState<Coordinate[]>([]);
  const requestCountRef = React.useRef(0);
  const lastRequestTimeRef = React.useRef(0);
  const cancelTokenRef = React.useRef<AbortController | null>(null);
  const DAILY_QUOTA = 2000;
  const SAFETY_LIMIT = Math.floor(DAILY_QUOTA * 0.75);
  const [startPoint, setStartPoint] = useState<Coordinate | null>(null);
  const [endPoint, setEndPoint] = useState<Coordinate | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const mapRef = React.useRef<MapView | null>(null);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);

  const DISABLE_QUOTA_GUARD = false; // set true to disable safeguard

  const handleMapPress = (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    if (!startPoint) {
      setStartPoint({ latitude, longitude });
      setRouteCoords([]);
      setDistance(null);
      setDuration(null);
      return;
    }

    if (!endPoint) {
      setEndPoint({ latitude, longitude });
      fetchRouteFromPoints(
        startPoint.latitude,
        startPoint.longitude,
        latitude,
        longitude,
      );
      return;
    }

    // If both exist, reset and start over
    setStartPoint({ latitude, longitude });
    setEndPoint(null);
    setRouteCoords([]);
    setDistance(null);
    setDuration(null);
  };

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        console.error("Location permission not granted");
        return;
      }

      Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 2000,
          distanceInterval: 1,
        },
        (location) => {
          const { latitude, longitude } = location.coords;
          if (location.coords.accuracy && location.coords.accuracy > 30) {
            return; // ignore low accuracy fixes
          }
          setUserLocation({ latitude, longitude });
          setRegion({
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          });
        },
      );
    })();
  }, []);

  const fetchRouteFromPoints = async (
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ) => {
    if (!ORS_API_KEY) {
      console.error("ORS API key missing");
      return;
    }

    // Cancel previous request if still pending
    if (cancelTokenRef.current) {
      cancelTokenRef.current.abort();
    }

    // Check quota limit
    if (!DISABLE_QUOTA_GUARD && requestCountRef.current >= SAFETY_LIMIT) {
      console.warn("75% quota reached. Calls blocked.");
      return;
    }

    // Create new abort controller for this request
    const controller = new AbortController();
    cancelTokenRef.current = controller;

    requestCountRef.current += 1;

    try {
      const response = await axios.post(
        "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
        {
          coordinates: [
            [startLng, startLat],
            [endLng, endLat],
          ],
          preference: "fastest",
          geometry_simplify: false, // Higher resolution polylines
          extra_info: ["waytype", "surface"],
        },
        {
          headers: {
            Authorization: ORS_API_KEY,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        },
      );

      const feature = response.data.features[0];
      const coords = feature.geometry.coordinates.map((c: number[]) => ({
        latitude: c[1],
        longitude: c[0],
      }));

      // Smooth the polyline by interpolating midpoints
      const smoothCoords = coords.flatMap(
        (point: Coordinate, index: number) => {
          if (index === 0) return [point];

          const prev = coords[index - 1];

          return [
            {
              latitude: (prev.latitude + point.latitude) / 2,
              longitude: (prev.longitude + point.longitude) / 2,
            },
            point,
          ];
        },
      );

      const summary = feature.properties.summary;

      setDistance((summary.distance / 1000).toFixed(2) + " km");
      setDuration(Math.round(summary.duration / 60) + " min");

      setRouteCoords(smoothCoords);
      mapRef.current?.fitToCoordinates(smoothCoords, {
        edgePadding: { top: 150, right: 50, bottom: 250, left: 50 },
        animated: true,
      });
    } catch (error: any) {
      // Ignore cancelled requests (user changed route while fetching)
      if (error.name === "CanceledError" || error.code === "ERR_CANCELED") {
        return;
      }
      console.log("Route fetch failed:", error);
    }
  };

  const handleUseMyLocation = () => {
    if (userLocation) {
      setStartPoint(userLocation);
      setEndPoint(null);
      setRouteCoords([]);
      setDistance(null);
      setDuration(null);
    }
  };

  const handleClearAll = () => {
    setStartPoint(null);
    setEndPoint(null);
    setRouteCoords([]);
    setDistance(null);
    setDuration(null);
  };

  const recenterMap = () => {
    if (userLocation) {
      mapRef.current?.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.003, // Tighter zoom
        longitudeDelta: 0.003,
      });
    }
  };

  if (!region) {
    return (
      <View style={styles.center}>
        <Text style={styles.loadingText}>Getting Location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <View style={styles.searchInputWrapper}>
            <View style={styles.dotIndicator} />
            <TextInput
              style={styles.searchInput}
              placeholder="Choose start location"
              placeholderTextColor="#666"
              value={startPoint ? "Start location selected" : ""}
              editable={false}
            />
          </View>
          <View style={styles.searchDivider} />
          <View style={styles.searchInputWrapper}>
            <View style={[styles.dotIndicator, styles.dotIndicatorRed]} />
            <TextInput
              style={styles.searchInput}
              placeholder="Choose destination"
              placeholderTextColor="#666"
              value={endPoint ? "Destination selected" : ""}
              editable={false}
            />
          </View>
        </View>

        {!startPoint && (
          <TouchableOpacity
            style={styles.myLocationButton}
            onPress={handleUseMyLocation}
          >
            <Text style={styles.myLocationText}>📍 Use my location</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Route Details Card */}
      {distance && duration && (
        <View style={styles.routeCard}>
          <View style={styles.routeHeader}>
            <Text style={styles.routeTitle}>Best route</Text>
            <TouchableOpacity onPress={handleClearAll}>
              <Text style={styles.clearText}>Clear</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.routeDetails}>
            <View style={styles.routeTimeContainer}>
              <Text style={styles.routeTime}>{duration}</Text>
              <Text style={styles.routeDistance}>{distance}</Text>
            </View>
          </View>
          <View style={styles.routeViaContainer}>
            <Text style={styles.routeViaText}>Via fastest route</Text>
          </View>
        </View>
      )}

      {/* Floating Action Buttons */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={recenterMap}>
          <Text style={styles.fabIcon}>⊙</Text>
        </TouchableOpacity>
      </View>

      {/* Map */}
      <MapView
        ref={mapRef}
        style={styles.map}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        onPress={handleMapPress}
        onLongPress={handleClearAll}
      >
        {startPoint && (
          <Marker coordinate={startPoint} title="Start" pinColor="green" />
        )}

        {endPoint && (
          <Marker coordinate={endPoint} title="Destination" pinColor="red" />
        )}

        {routeCoords.length > 0 && (
          <Polyline
            coordinates={routeCoords}
            strokeWidth={5}
            strokeColor="#4285F4"
          />
        )}
      </MapView>

      {/* Instructions overlay */}
      {!startPoint && !endPoint && (
        <View style={styles.instructionsOverlay}>
          <Text style={styles.instructionsText}>
            Tap on the map to set your start location
          </Text>
        </View>
      )}
      {startPoint && !endPoint && (
        <View style={styles.instructionsOverlay}>
          <Text style={styles.instructionsText}>
            Tap on the map to set your destination
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
  },

  // Search Container
  searchContainer: {
    position: "absolute",
    top: 60,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchBar: {
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    paddingVertical: 8,
  },
  searchInputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dotIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#34A853",
    marginRight: 16,
  },
  dotIndicatorRed: {
    backgroundColor: "#EA4335",
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#202124",
  },
  searchDivider: {
    height: 1,
    backgroundColor: "#E8EAED",
    marginLeft: 44,
    marginRight: 16,
  },
  myLocationButton: {
    backgroundColor: "#fff",
    borderRadius: 8,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 8,
    alignItems: "center",
  },
  myLocationText: {
    fontSize: 14,
    color: "#1A73E8",
    fontWeight: "500",
  },

  // Route Card
  routeCard: {
    position: "absolute",
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: "#fff",
    borderRadius: 12,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    padding: 16,
    zIndex: 10,
  },
  routeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  routeTitle: {
    fontSize: 14,
    color: "#5F6368",
    fontWeight: "500",
  },
  clearText: {
    fontSize: 14,
    color: "#1A73E8",
    fontWeight: "500",
  },
  routeDetails: {
    marginBottom: 8,
  },
  routeTimeContainer: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  routeTime: {
    fontSize: 28,
    fontWeight: "600",
    color: "#202124",
    marginRight: 12,
  },
  routeDistance: {
    fontSize: 16,
    color: "#5F6368",
  },
  routeViaContainer: {
    backgroundColor: "#F1F3F4",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  routeViaText: {
    fontSize: 12,
    color: "#5F6368",
  },

  // Floating Action Buttons
  fabContainer: {
    position: "absolute",
    right: 16,
    bottom: 200,
    zIndex: 5,
  },
  fab: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  fabIcon: {
    fontSize: 24,
    color: "#5F6368",
  },

  // Instructions Overlay
  instructionsOverlay: {
    position: "absolute",
    top: 220,
    left: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    zIndex: 5,
  },
  instructionsText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
  },
});
