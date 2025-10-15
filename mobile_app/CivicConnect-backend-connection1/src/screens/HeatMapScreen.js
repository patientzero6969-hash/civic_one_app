// src/screens/HeatMapScreen.js
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import {
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import MapView, { Heatmap, Marker } from 'react-native-maps';

const { width, height } = Dimensions.get('window');

export default function HeatMapScreen() {
  const [region, setRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [heatmapData, setHeatmapData] = useState([]);
  const [markers, setMarkers] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [mapType, setMapType] = useState('standard');

  const categories = [
    { label: 'All Issues', value: 'all', color: '#007AFF' },
    { label: 'Potholes', value: 'pothole', color: '#FF3B30' },
    { label: 'Street Lights', value: 'streetlight', color: '#FF9500' },
    { label: 'Garbage', value: 'garbage', color: '#34C759' },
    { label: 'Water Supply', value: 'water', color: '#00C7BE' },
    { label: 'Traffic', value: 'traffic', color: '#5856D6' },
  ];

  useEffect(() => {
    // Get current location
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let location = await Location.getCurrentPositionAsync({});
        setRegion({
          ...region,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();

    // Generate sample data
    generateSampleData();
  }, []);

  const generateSampleData = () => {
    const sampleReports = [
      { latitude: 37.78825, longitude: -122.4324, category: 'pothole', weight: 3 },
      { latitude: 37.789, longitude: -122.431, category: 'streetlight', weight: 2 },
      { latitude: 37.787, longitude: -122.433, category: 'garbage', weight: 4 },
      { latitude: 37.786, longitude: -122.435, category: 'water', weight: 1 },
      { latitude: 37.790, longitude: -122.430, category: 'traffic', weight: 5 },
      { latitude: 37.785, longitude: -122.428, category: 'pothole', weight: 2 },
      { latitude: 37.791, longitude: -122.434, category: 'garbage', weight: 3 },
      { latitude: 37.784, longitude: -122.431, category: 'streetlight', weight: 1 },
    ];

    const filteredData = selectedCategory === 'all' 
      ? sampleReports 
      : sampleReports.filter(item => item.category === selectedCategory);

    setHeatmapData(filteredData);
    setMarkers(filteredData);
  };

  useEffect(() => {
    generateSampleData();
  }, [selectedCategory]);

  const getCategoryColor = (category) => {
    const cat = categories.find(c => c.value === category);
    return cat ? cat.color : '#007AFF';
  };

  const FilterModal = () => (
    <Modal
      animationType="slide"
      transparent={true}
      visible={showFilters}
      onRequestClose={() => setShowFilters(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Options</Text>
            <TouchableOpacity onPress={() => setShowFilters(false)}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.filterOptions}>
            <Text style={styles.filterSectionTitle}>Category</Text>
            {categories.map((category) => (
              <TouchableOpacity
                key={category.value}
                style={[
                  styles.filterOption,
                  selectedCategory === category.value && styles.filterOptionSelected,
                ]}
                onPress={() => setSelectedCategory(category.value)}
              >
                <View style={[styles.categoryDot, { backgroundColor: category.color }]} />
                <Text style={styles.filterOptionText}>{category.label}</Text>
                {selectedCategory === category.value && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}

            <Text style={styles.filterSectionTitle}>Map Type</Text>
            {['standard', 'satellite', 'hybrid'].map((type) => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.filterOption,
                  mapType === type && styles.filterOptionSelected,
                ]}
                onPress={() => setMapType(type)}
              >
                <Text style={styles.filterOptionText}>
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                </Text>
                {mapType === type && (
                  <Ionicons name="checkmark" size={20} color="#007AFF" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        region={region}
        mapType={mapType}
        showsUserLocation
        showsMyLocationButton
      >
        {heatmapData.length > 0 && (
          <Heatmap
            points={heatmapData}
            radius={50}
            opacity={0.7}
            gradient={{
              colors: ['green', 'yellow', 'red'],
              startPoints: [0.2, 0.5, 1.0],
              colorMapSize: 256,
            }}
          />
        )}
        
        {markers.map((marker, index) => (
          <Marker
            key={index}
            coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
            pinColor={getCategoryColor(marker.category)}
          >
            <View style={[styles.customMarker, { backgroundColor: getCategoryColor(marker.category) }]}>
              <Text style={styles.markerText}>{marker.weight}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => setShowFilters(true)}
        >
          <Ionicons name="options" size={20} color="#007AFF" />
          <Text style={styles.controlButtonText}>Filters</Text>
        </TouchableOpacity>
        
        <View style={styles.legend}>
          <Text style={styles.legendTitle}>Heat Intensity</Text>
          <View style={styles.legendGradient}>
            <Text style={styles.legendLabel}>Low</Text>
            <View style={styles.gradientBar} />
            <Text style={styles.legendLabel}>High</Text>
          </View>
        </View>
      </View>

      <FilterModal />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    width,
    height,
  },
  controls: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
  },
  controlButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    alignSelf: 'flex-start',
  },
  controlButtonText: {
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  legend: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  legendTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  legendGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  gradientBar: {
    flex: 1,
    height: 10,
    marginHorizontal: 10,
    borderRadius: 5,
    backgroundColor: '#ddd',
    backgroundImage: 'linear-gradient(to right, green, yellow, red)',
  },
  legendLabel: {
    fontSize: 12,
    color: '#666',
  },
  customMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'white',
  },
  markerText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  filterOptions: {
    padding: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 20,
    marginBottom: 10,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },
  filterOptionSelected: {
    backgroundColor: '#f0f8ff',
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  filterOptionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
});