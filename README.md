# React Native Map Navigation Component

A Google Maps-inspired navigation interface built with React Native and Expo, featuring route planning with OpenRouteService API integration.

## Features

### Core Functionality

- Real-time user location tracking with high accuracy GPS
- Interactive map interface for selecting start and destination points
- Route calculation and visualization with turn-by-turn polyline rendering
- Distance and duration estimates for planned routes
- Automatic map viewport adjustment to fit route boundaries

### User Interface

- Clean search bar with visual indicators for start (green) and destination (red) points
- Quick access "Use my location" button for setting current position as start point
- Route details card showing estimated travel time and distance
- Floating recenter button to return to current location
- Contextual instruction overlays guiding user through selection process
- Clear/reset functionality via button or long-press gesture

### API Rate Limiting and Safeguards

- Daily quota management (2,000 requests per day)
- Automatic throttling at 75% of daily quota (1,500 requests) to prevent overages
- Minimum 15-second interval between API requests
- Request counter and timestamp tracking
- Configurable safeguard override option for development/testing

## Prerequisites

- Node.js and npm/yarn
- Expo CLI
- React Native development environment
- OpenRouteService API key

## Installation

1. Install dependencies:

```bash
npm install axios expo-location react-native-maps
```

2. Set up environment variables:
   Create a `.env` file in your project root:

```
EXPO_PUBLIC_ORS_API_KEY=your_openrouteservice_api_key_here
```

3. Obtain an OpenRouteService API key:

- Visit https://openrouteservice.org/
- Sign up for a free account
- Generate an API key from your dashboard

## Configuration

### Rate Limiting Settings

Located in the component file:

```typescript
const DAILY_QUOTA = 2000; // Total daily API calls allowed
const SAFETY_LIMIT = Math.floor(DAILY_QUOTA * 0.75); // 1,500 calls
const REQUEST_INTERVAL_MS = 15000; // 15 seconds between requests
const DISABLE_QUOTA_GUARD = false; // Set true to bypass safeguards
```

### Location Tracking

```typescript
accuracy: Location.Accuracy.High,
distanceInterval: 10,  // Update every 10 meters
```

## Usage

### Basic Workflow

1. Grant location permissions when prompted
2. Wait for map to center on your current location
3. Tap "Use my location" or tap anywhere on the map to set start point
4. Tap a second location on the map to set destination
5. Route automatically calculates and displays with distance/duration
6. Use "Clear" button or long-press map to reset and start over

### Gestures

- Single tap: Select start point (first tap) or destination (second tap)
- Long press: Clear all selections and reset the interface
- Pan/zoom: Standard map navigation controls

## API Integration

### OpenRouteService Directions API

Endpoint: `https://api.openrouteservice.org/v2/directions/driving-car/geojson`

Request format:

```json
{
  "coordinates": [
    [startLongitude, startLatitude],
    [endLongitude, endLatitude]
  ]
}
```

Response includes:

- GeoJSON geometry with route coordinates
- Distance in meters
- Duration in seconds
- Route summary information

## Permissions

### iOS (Info.plist)

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>This app needs access to your location to show you on the map and calculate routes.</string>
```

### Android (AndroidManifest.xml)

```xml
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
```

## Component Structure

### State Management

- `region`: Current map viewport region
- `routeCoords`: Array of coordinates forming the route polyline
- `startPoint`: Selected starting location
- `endPoint`: Selected destination location
- `distance`: Calculated route distance
- `duration`: Estimated travel time
- `userLocation`: Real-time user position

### Refs

- `mapRef`: Reference to MapView component for programmatic control
- `requestCountRef`: Tracks number of API calls made
- `lastRequestTimeRef`: Timestamp of most recent API request

## Customization

### Styling

All styles are defined in the `StyleSheet.create()` call at the bottom of the component. Key style groups:

- `searchContainer`: Top search bar and location button
- `routeCard`: Bottom route information panel
- `fabContainer`: Floating action buttons
- `instructionsOverlay`: Contextual help messages

### Colors

Google Maps-inspired color palette:

- Primary blue: `#1A73E8`
- Success green: `#34A853`
- Error red: `#EA4335`
- Text primary: `#202124`
- Text secondary: `#5F6368`
- Background: `#F1F3F4`

### Map Settings

```typescript
showsUserLocation={true}
showsMyLocationButton={false}  // Using custom button instead
```

## Error Handling

- Missing API key: Logs error and prevents requests
- Rate limit exceeded: Logs warning and blocks requests until reset
- Location permission denied: Logs error, component shows loading state
- Route fetch failure: Logs error, maintains previous state

## Development Notes

### Testing Rate Limits

To test the application without rate limit restrictions during development:

```typescript
const DISABLE_QUOTA_GUARD = true;
```

Remember to set this back to `false` for production builds.

### Debugging

The component includes console logging for:

- Location permission status
- API key presence
- Route fetch failures
- Quota warnings

## Performance Considerations

- Route calculation only triggers on destination selection, not on every map interaction
- Automatic map fitting uses optimized edge padding to keep UI elements visible
- Location updates throttled to 10-meter intervals to reduce processing overhead
- API calls rate-limited to prevent quota exhaustion and reduce network usage

## Known Limitations

- Route calculation requires two distinct points (start and destination)
- Only driving-car routing profile is currently implemented
- No support for waypoints or multi-stop routes
- Offline functionality not available (requires active internet connection)
- Route recalculation not automatic when user moves

## License

This component is provided as-is for educational and development purposes.

## Support

For issues with:

- OpenRouteService API: https://openrouteservice.org/dev/#/support
- React Native Maps: https://github.com/react-native-maps/react-native-maps
- Expo Location: https://docs.expo.dev/versions/latest/sdk/location/
