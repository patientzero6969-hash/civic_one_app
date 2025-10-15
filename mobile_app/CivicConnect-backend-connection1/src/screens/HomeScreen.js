// src/screens/HomeScreen.js
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';

const screenWidth = Dimensions.get('window').width;

export default function HomeScreen() {
  const router = useRouter();

  const [stats, setStats] = useState({
    totalReports: 47,
    resolved: 32,
    inProgress: 12,
    pending: 3,
  });

  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [12, 8, 15, 23, 18, 9, 14],
        color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
        strokeWidth: 2,
      },
    ],
  };

  const StatCard = ({ title, value, color, icon }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Ionicons name={icon} size={24} color={color} />
        <Text style={styles.statValue}>{value}</Text>
      </View>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Civic Reporter</Text>
        <Text style={styles.headerSubtitle}>
          Making our community better, together
        </Text>
      </View>

      <View style={styles.statsContainer}>
        <StatCard
          title="Total Reports"
          value={stats.totalReports}
          color="#007AFF"
          icon="document-text"
        />
        <StatCard
          title="Resolved"
          value={stats.resolved}
          color="#34C759"
          icon="checkmark-circle"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress}
          color="#FF9500"
          icon="time"
        />
        <StatCard
          title="Pending"
          value={stats.pending}
          color="#FF3B30"
          icon="alert-circle"
        />
      </View>

      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Weekly Report Activity</Text>
        <LineChart
          data={chartData}
          width={screenWidth - 40}
          height={200}
          yAxisLabel=""
          yAxisSuffix=""
          yAxisInterval={1}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: {
              borderRadius: 16,
            },
            propsForDots: {
              r: '4',
              strokeWidth: '2',
              stroke: '#007AFF',
            },
          }}
          bezier
          style={styles.chart}
        />
      </View>

      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        {/* NEW REPORT BUTTON - Added here */}
        <TouchableOpacity
          style={[styles.actionButton, styles.primaryActionButton]}
          onPress={() => router.push('/camera-report')}
        >
          <Ionicons name="camera" size={24} color="white" />
          <Text style={[styles.actionButtonText, styles.primaryActionText]}>New Report</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/reports')}
        >
          <Ionicons name="add-circle" size={24} color="#007AFF" />
          <Text style={styles.actionButtonText}>Report New Issue</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => router.push('/explore')}
        >
          <Ionicons name="map" size={24} color="#007AFF" />
          <Text style={styles.actionButtonText}>View Heat Map</Text>
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
    backgroundColor: '#007AFF',
    padding: 20,
    paddingTop: 40,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 20,
    justifyContent: 'space-between',
  },
  statCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 12,
    width: '48%',
    marginBottom: 15,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  statTitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 5,
  },
  chartContainer: {
    backgroundColor: 'white',
    margin: 20,
    borderRadius: 12,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  chartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  quickActions: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 15,
  },
  actionButton: {
    backgroundColor: 'white',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  actionButtonText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 10,
    fontWeight: '500',
  },
  // NEW STYLES for the primary "New Report" button
  primaryActionButton: {
    backgroundColor: '#007AFF',
    borderWidth: 0,
  },
  primaryActionText: {
    color: 'white',
    fontWeight: '600',
  },
});