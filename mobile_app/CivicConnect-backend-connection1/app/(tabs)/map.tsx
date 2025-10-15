import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/input';
import { StorageService } from '../../utils/storage';
import { apiClient, API_CONFIG } from '../../utils/api';

const API_BASE_URL = 'http://10.191.176.176:8000/api'; // Update with your IP

interface IssueMarker {
  id: string;
  title: string;
  category: string;
  location: string;
  distance?: number;
  upvotes: number;
  status: 'pending' | 'in_progress' | 'resolved';
  timestamp: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  description?: string;
  citizen_name?: string;
  image_url?: string;
}

const categoryColors: { [key: string]: string } = {
  'potholes': '#fca5a5',
  'DamagedElectricalPoles': '#93c5fd',
  'Garbage': '#fde68a',
  'WaterLogging': '#86efac',
  'FallenTrees': '#fdba74'
};

const categoryLabels: { [key: string]: string } = {
  'potholes': 'Road Department',
  'WaterLogging': 'Public Service',
  'DamagedElectricalPoles': 'Electricity Department',
  'Garbage': 'Sanitary Department',
  'FallenTrees': 'Public Service'
};

const statusColors: { [key: string]: string } = {
  'pending': '#FF9500',
  'in_progress': '#007AFF',
  'resolved': '#34C759'
};

const categories = Object.keys(categoryColors);

export default function IssueMapScreen() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedIssue, setSelectedIssue] = useState<IssueMarker | null>(null);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [issues, setIssues] = useState<IssueMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 12.9716, // Default to Bangalore
    longitude: 77.6413,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  useEffect(() => {
    getCurrentLocation();
    loadAllIssues();
  }, []);

  // Function to convert coordinates to readable location
  const getLocationFromCoords = (latitude: number, longitude: number): string => {
    if (!latitude || !longitude) return 'Location not available';
    
    // Round coordinates to 4 decimal places for display
    const lat = latitude.toFixed(4);
    const lng = longitude.toFixed(4);
    
    // Determine direction indicators
    const latDir = latitude >= 0 ? 'N' : 'S';
    const lngDir = longitude >= 0 ? 'E' : 'W';
    
    return `${Math.abs(parseFloat(lat))}°${latDir}, ${Math.abs(parseFloat(lng))}°${lngDir}`;
  };

  // Function to reverse geocode coordinates (optional enhancement)
  const reverseGeocode = async (latitude: number, longitude: number): Promise<string> => {
    try {
      // Using OpenStreetMap's Nominatim service (free)
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`
      );
      
      if (response.ok) {
        const data = await response.json();
        if (data && data.display_name) {
          // Extract relevant parts of the address
          const address = data.address;
          let locationParts = [];
          
          if (address.road || address.street) locationParts.push(address.road || address.street);
          if (address.suburb || address.neighbourhood) locationParts.push(address.suburb || address.neighbourhood);
          if (address.city || address.town) locationParts.push(address.city || address.town);
          
          return locationParts.length > 0 ? locationParts.join(', ') : data.display_name.split(',').slice(0, 3).join(', ');
        }
      }
    } catch (error) {
      console.warn('Reverse geocoding failed:', error);
    }
    
    // Fallback to coordinates
    return getLocationFromCoords(latitude, longitude);
  };

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required to show your location');
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const userCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };
      
      setUserLocation(userCoords);
      setMapRegion({
        ...userCoords,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });
      
      console.log('📍 User location:', userCoords);
    } catch (error) {
      console.error('❌ Error getting location:', error);
      Alert.alert('Location Error', 'Could not get your current location');
    }
  };

  // Enhanced load function with location processing
  const loadAllIssues = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const token = await StorageService.getAuthToken();
      if (!token) {
        Alert.alert(
          'Session Expired',
          'Please login again to view the map.',
          [{ text: 'OK', onPress: () => router.push('/(auth)/login') }]
        );
        return;
      }

      console.log('🗺️ Loading issues for map...');
      
      // Use the enhanced API client with automatic token refresh
      const response: any = await apiClient.get(`${API_CONFIG.ENDPOINTS.ISSUES.LIST}`);

      console.log('✅ Issues loaded for map:', response.issues?.length || 0);

      // Filter issues that have location data and transform with enhanced location handling
      const issuesWithLocation: IssueMarker[] = await Promise.all(
        (response.issues || [])
          .filter((issue: any) => issue.latitude && issue.longitude)
          .map(async (issue: any) => {
            let location = 'Location not available';
            
            // Priority order for location:
            // 1. location_description (if provided by user)
            // 2. address field (if available)
            // 3. Reverse geocoded address from coordinates
            // 4. Formatted coordinates as fallback
            
            if (issue.location_description) {
              location = issue.location_description;
            } else if (issue.address) {
              location = issue.address;
            } else if (issue.latitude && issue.longitude) {
              // Try to get a human-readable address
              try {
                location = await reverseGeocode(issue.latitude, issue.longitude);
              } catch (error) {
                console.warn('Failed to reverse geocode for map, using coordinates:', error);
                location = getLocationFromCoords(issue.latitude, issue.longitude);
              }
            }

            return {
              id: issue.id.toString(),
              title: issue.title,
              category: issue.category,
              location: location,
              description: issue.description,
              upvotes: issue.upvotes || 0,
              status: issue.status,
              timestamp: issue.created_at,
              coordinates: {
                lat: parseFloat(issue.latitude),
                lng: parseFloat(issue.longitude)
              },
              citizen_name: issue.citizen_name,
              image_url: issue.image_url
            };
          })
      );

      setIssues(issuesWithLocation);
      
      // If we have issues and no user location, center on first issue
      if (issuesWithLocation.length > 0 && !userLocation) {
        const firstIssue = issuesWithLocation[0];
        setMapRegion({
          latitude: firstIssue.coordinates.lat,
          longitude: firstIssue.coordinates.lng,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      }
      
    } catch (err: any) {
      console.error('❌ Error loading issues for map:', err);
      const errorMessage = err.message || 'Failed to load map data';
      
      // Handle session expired error
      if (errorMessage.includes('Session expired') || errorMessage.includes('Please login again')) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please login again.',
          [
            {
              text: 'Login',
              onPress: () => {
                router.push('/(auth)/login');
              }
            }
          ]
        );
        return;
      }
      
      setError(errorMessage);
      
      Alert.alert(
        'Error Loading Map',
        errorMessage,
        [
          { text: 'Retry', onPress: loadAllIssues },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router, userLocation]);

  // Refresh function
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAllIssues();
  }, [loadAllIssues]);

  const handleIssuePress = (issue: IssueMarker) => {
    setSelectedIssue(issue);
    // Center map on selected issue
    setMapRegion({
      latitude: issue.coordinates.lat,
      longitude: issue.coordinates.lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    });
  };

  // Updated to route to My Reports screen
  const handleIssueDetailPress = (issue: IssueMarker) => {
    router.push({
      pathname: '/(tabs)/my-reports',
      params: { 
        reportId: issue.id,
        scrollToReport: 'true'
      }
    });
  };

  // Enhanced location display for selected issue
  const handleLocationPress = (issue: IssueMarker) => {
    Alert.alert(
      'Location Details',
      `${issue.location}\n\nCoordinates:\nLatitude: ${issue.coordinates.lat.toFixed(6)}\nLongitude: ${issue.coordinates.lng.toFixed(6)}`,
      [
        { text: 'OK' },
        { 
          text: 'Center on Map', 
          onPress: () => {
            setMapRegion({
              latitude: issue.coordinates.lat,
              longitude: issue.coordinates.lng,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            });
          }
        }
      ]
    );
  };

  // Filter issues based on search and category
  const filteredIssues = issues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         issue.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         issue.location.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || issue.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get marker color based on status
  const getMarkerColor = (status: string): string => {
    return statusColors[status] || '#999999';
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Render loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading map data...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Render error state
  if (error && issues.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
          <Text style={styles.errorTitle}>Unable to Load Map</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Try Again"
            onPress={loadAllIssues}
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with search and filters */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <Input
            style={styles.searchInput}
            placeholder="Search issues..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowCategoryFilter(!showCategoryFilter)}
          >
            <Ionicons name="filter" size={20} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Category Filter */}
        {showCategoryFilter && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryFilter}>
            <TouchableOpacity
              style={[styles.categoryButton, selectedCategory === 'all' && styles.categoryButtonActive]}
              onPress={() => setSelectedCategory('all')}
            >
              <Text style={[styles.categoryButtonText, selectedCategory === 'all' && styles.categoryButtonTextActive]}>
                All ({issues.length})
              </Text>
            </TouchableOpacity>
            {categories.map(category => (
              <TouchableOpacity
                key={category}
                style={[styles.categoryButton, selectedCategory === category && styles.categoryButtonActive]}
                onPress={() => setSelectedCategory(category)}
              >
                <Text style={[styles.categoryButtonText, selectedCategory === category && styles.categoryButtonTextActive]}>
                  {categoryLabels[category]} ({issues.filter(i => i.category === category).length})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Map */}
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          region={mapRegion}
          onRegionChangeComplete={setMapRegion}
          showsUserLocation={true}
          showsMyLocationButton={true}
          showsCompass={true}
        >
          {filteredIssues.map((issue) => (
            <Marker
              key={issue.id}
              coordinate={{
                latitude: issue.coordinates.lat,
                longitude: issue.coordinates.lng,
              }}
              title={issue.title}
              description={issue.location}
              pinColor={getMarkerColor(issue.status)}
              onPress={() => handleIssuePress(issue)}
            />
          ))}
        </MapView>

        {/* Map Controls */}
        <View style={styles.mapControls}>
          <TouchableOpacity
            style={styles.mapControlButton}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={24} color="#007AFF" />
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.mapControlButton}
            onPress={getCurrentLocation}
          >
            <Ionicons name="locate" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Issue Count */}
        <View style={styles.issueCount}>
          <Text style={styles.issueCountText}>
            {filteredIssues.length} issue{filteredIssues.length !== 1 ? 's' : ''} shown
          </Text>
        </View>
      </View>

      {/* Selected Issue Details - Enhanced with location interaction */}
      {selectedIssue && (
        <View style={styles.selectedIssueContainer}>
          <Card style={styles.selectedIssueCard}>
            <CardHeader>
              <View style={styles.selectedIssueHeader}>
                <Text style={styles.selectedIssueTitle} numberOfLines={2}>
                  {selectedIssue.title}
                </Text>
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={() => setSelectedIssue(null)}
                >
                  <Ionicons name="close" size={20} color="#666" />
                </TouchableOpacity>
              </View>
            </CardHeader>
            <CardContent>
              <Text style={styles.selectedIssueDescription} numberOfLines={3}>
                {selectedIssue.description}
              </Text>
              
              <View style={styles.selectedIssueInfo}>
                <TouchableOpacity 
                  style={styles.selectedIssueInfoRow}
                  onPress={() => handleLocationPress(selectedIssue)}
                >
                  <Ionicons name="location-outline" size={16} color="#666" />
                  <Text style={[styles.selectedIssueInfoText, styles.locationText]} numberOfLines={2}>
                    {selectedIssue.location}
                  </Text>
                  <Ionicons name="information-circle-outline" size={16} color="#007AFF" />
                </TouchableOpacity>
                
                <View style={styles.selectedIssueInfoRow}>
                  <View style={[styles.selectedStatusBadge, { backgroundColor: getMarkerColor(selectedIssue.status) }]}>
                    <Text style={styles.selectedStatusText}>
                      {selectedIssue.status.replace('_', ' ').toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.selectedIssueInfoText}>
                    {formatDate(selectedIssue.timestamp)}
                  </Text>
                </View>
              </View>

              <View style={styles.selectedIssueActions}>
                <Button
                  title="View Details"
                  onPress={() => handleIssueDetailPress(selectedIssue)}
                  style={styles.viewDetailsButton}
                />
              </View>
            </CardContent>
          </Card>
        </View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Status Legend</Text>
        <View style={styles.legendItems}>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: statusColors.pending }]} />
            <Text style={styles.legendText}>Pending</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: statusColors.in_progress }]} />
            <Text style={styles.legendText}>In Progress</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: statusColors.resolved }]} />
            <Text style={styles.legendText}>Resolved</Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF3B30',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  retryButton: {
    backgroundColor: '#FF3B30',
  },
  header: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    position: 'relative',
  },
  searchInput: {
    flex: 1,
    marginRight: 12,
    paddingRight: 40, // Make room for search icon
  },
  searchIcon: {
    position: 'absolute',
    right: 60, // Position relative to filter button
    top: 12,
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
  },
  categoryFilter: {
    marginTop: 8,
  },
  categoryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginRight: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
  },
  categoryButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  categoryButtonTextActive: {
    color: '#fff',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  map: {
    flex: 1,
  },
  mapControls: {
    position: 'absolute',
    top: 16,
    right: 16,
  },
  mapControlButton: {
    backgroundColor: '#fff',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  issueCount: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  issueCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
  },
  selectedIssueContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
  },
  selectedIssueCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  selectedIssueHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  selectedIssueTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    marginRight: 12,
  },
  closeButton: {
    padding: 4,
  },
  selectedIssueDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  selectedIssueInfo: {
    marginBottom: 12,
  },
  selectedIssueInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  selectedIssueInfoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  locationText: {
    color: '#007AFF', // Make location text blue to indicate it's tappable
  },
  selectedStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginRight: 8,
  },
  selectedStatusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '600',
  },
  selectedIssueActions: {
    flexDirection: 'row',
  },
  viewDetailsButton: {
    flex: 1,
    backgroundColor: '#007AFF',
  },
  legend: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  legendTitle: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 6,
  },
  legendItems: {
    flexDirection: 'column',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 6,
  },
  legendText: {
    fontSize: 10,
    color: '#333',
  },
});