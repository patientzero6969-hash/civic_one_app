// src/screens/MyReportsScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function MyReportsScreen() {
  const router = useRouter();

  const [reports, setReports] = useState([
    {
      id: '1',
      category: 'Pothole',
      description: 'Large pothole on Main Street causing traffic issues',
      status: 'in-progress',
      date: '2024-01-15',
      image: 'https://example.com/pothole.jpg',
      location: 'Main Street, Downtown',
    },
    {
      id: '2',
      category: 'Street Light',
      description: 'Street light not working',
      status: 'resolved',
      date: '2024-01-10',
      image: 'https://example.com/streetlight.jpg',
      location: 'Oak Avenue, Suburb',
    },
    {
      id: '3',
      category: 'Garbage',
      description: 'Overflowing trash bin',
      status: 'pending',
      date: '2024-01-20',
      image: 'https://example.com/garbage.jpg',
      location: 'Park Street, City Center',
    },
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return '#FF9500';
      case 'in-progress':
        return '#007AFF';
      case 'resolved':
        return '#34C759';
      default:
        return '#666';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return 'time';
      case 'in-progress':
        return 'sync';
      case 'resolved':
        return 'checkmark-circle';
      default:
        return 'help-circle';
    }
  };

  const renderReportItem = ({ item }) => (
    <TouchableOpacity
      style={styles.reportCard}
      onPress={() => router.push(`/report-detail?id=${item.id}`)}
    >
      <View style={styles.reportHeader}>
        <View>
          <Text style={styles.reportCategory}>{item.category}</Text>
          <Text style={styles.reportDate}>{item.date}</Text>
        </View>
        <View
          style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}
        >
          <Ionicons name={getStatusIcon(item.status)} size={16} color="white" />
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>

      {item.image && <Image source={{ uri: item.image }} style={styles.reportImage} />}

      <Text style={styles.reportDescription} numberOfLines={2}>
        {item.description}
      </Text>

      <View style={styles.reportFooter}>
        <Ionicons name="location-outline" size={16} color="#666" />
        <Text style={styles.locationText}>{item.location}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={reports}
        renderItem={renderReportItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  listContainer: {
    padding: 15,
  },
  reportCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  reportCategory: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  reportDate: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
  reportImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 10,
  },
  reportDescription: {
    fontSize: 16,
    color: '#333',
    lineHeight: 22,
    marginBottom: 10,
  },
  reportFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 14,
    color: '#666',
    marginLeft: 4,
    flex: 1,
  },
});
