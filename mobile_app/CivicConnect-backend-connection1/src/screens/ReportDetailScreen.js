// src/screens/ReportDetailScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ReportDetailScreen() {
  const { id } = useSearchParams(); // get report ID from URL
  const [report, setReport] = useState(null);

  // Example/fake data - replace with API call if needed
  const reportsData = [
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
  ];

  useEffect(() => {
    const foundReport = reportsData.find((r) => r.id === id);
    setReport(foundReport);
  }, [id]);

  if (!report) {
    return (
      <View style={styles.container}>
        <Text>Loading report...</Text>
      </View>
    );
  }

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

  const statusUpdates = [
    {
      id: '1',
      status: 'submitted',
      message: 'Report submitted successfully',
      date: '2024-01-15 10:30 AM',
      completed: true,
    },
    {
      id: '2',
      status: 'acknowledged',
      message: 'Report acknowledged by city officials',
      date: '2024-01-16 02:15 PM',
      completed: report.status !== 'pending',
    },
    {
      id: '3',
      status: 'in-progress',
      message: 'Work assigned to maintenance team',
      date: report.status === 'resolved' ? '2024-01-18 09:00 AM' : '',
      completed: report.status === 'resolved',
    },
    {
      id: '4',
      status: 'resolved',
      message: 'Issue has been resolved',
      date: report.status === 'resolved' ? '2024-01-20 04:30 PM' : '',
      completed: report.status === 'resolved',
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.reportId}>Report #{report.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(report.status) }]}>
            <Text style={styles.statusText}>{report.status.toUpperCase()}</Text>
          </View>
        </View>
        <Text style={styles.category}>{report.category}</Text>
        <Text style={styles.date}>Submitted on {report.date}</Text>
      </View>

      {report.image && (
        <Image source={{ uri: report.image }} style={styles.image} />
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.description}>{report.description}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.locationContainer}>
          <Ionicons name="location" size={20} color="#007AFF" />
          <Text style={styles.locationText}>{report.location}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Status Updates</Text>
        {statusUpdates.map((update, index) => (
          <View key={update.id} style={styles.updateItem}>
            <View style={styles.updateIndicator}>
              <View
                style={[
                  styles.updateDot,
                  {
                    backgroundColor: update.completed ? '#34C759' : '#E5E5EA',
                  },
                ]}
              />
              {index < statusUpdates.length - 1 && (
                <View
                  style={[
                    styles.updateLine,
                    {
                      backgroundColor: update.completed ? '#34C759' : '#E5E5EA',
                    },
                  ]}
                />
              )}
            </View>
            <View style={styles.updateContent}>
              <Text
                style={[
                  styles.updateMessage,
                  { color: update.completed ? '#333' : '#999' },
                ]}
              >
                {update.message}
              </Text>
              {update.date && (
                <Text style={styles.updateDate}>{update.date}</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="call" size={20} color="#007AFF" />
          <Text style={styles.actionButtonText}>Contact Support</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="share" size={20} color="#007AFF" />
          <Text style={styles.actionButtonText}>Share Update</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  reportId: {
    fontSize: 16,
    color: '#666',
    fontWeight: '500',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  category: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  date: {
    fontSize: 14,
    color: '#666',
  },
  image: {
    width: '100%',
    height: 250,
  },
  section: {
    backgroundColor: 'white',
    margin: 15,
    padding: 15,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 8,
  },
  updateItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  updateIndicator: {
    alignItems: 'center',
    marginRight: 15,
  },
  updateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  updateLine: {
    width: 2,
    height: 30,
    marginTop: 5,
  },
  updateContent: {
    flex: 1,
  },
  updateMessage: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 5,
  },
  updateDate: {
    fontSize: 14,
    color: '#666',
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionButtonText: {
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
});
