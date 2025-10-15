// app/(tabs)/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import AuthService from '../../services/authService';
import { ActivityItem, QuickStats, User } from '../../types';
import { StorageService } from '../../utils/storage';

// Mock data for dashboard - you can replace this with API calls later
const recentActivity: ActivityItem[] = [
  {
    id: '1',
    title: 'Street light repair completed',
    location: 'Main St & 5th Ave',
    type: 'resolved',
    time: '2 hours ago'
  },
  {
    id: '2',
    title: 'New pothole reported',
    location: 'Oak Street',
    type: 'new',
    time: '4 hours ago'
  },
  {
    id: '3',
    title: 'Trash pickup scheduled',
    location: 'Central Park',
    type: 'in-progress',
    time: '6 hours ago'
  }
];

const quickStats: QuickStats = {
  totalIssues: 127,
  resolved: 89,
  inProgress: 23,
  pending: 15,
  userReports: 3,
  communityRank: 'Bronze Contributor'
};

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const userData = await StorageService.getUser();
    if (userData) {
      setUser(userData);
    } else {
      // Check if user is authenticated with the backend
      const isAuthenticated = await AuthService.isAuthenticated();
      if (!isAuthenticated) {
        router.replace('/(auth)/login');
      }
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AuthService.logout();
              await StorageService.clearAllData();
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout error:', error);
              // Even if logout fails, clear local data and redirect
              await StorageService.clearAllData();
              router.replace('/(auth)/login');
            }
          },
        },
      ]
    );
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const firstName = user.name.split(' ')[0];

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'resolved':
        return <Ionicons name="checkmark-circle" size={16} color="#10b981" />;
      case 'new':
        return <Ionicons name="alert-circle" size={16} color="#f59e0b" />;
      case 'in-progress':
        return <Ionicons name="time" size={16} color="#3b82f6" />;
      default:
        return <Ionicons name="information-circle" size={16} color="#6b7280" />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.appIcon}>
            <Ionicons name="location" size={20} color="#ffffff" />
          </View>
          <View>
            <Text style={styles.appName}>CivicConnect</Text>
            <Text style={styles.appTagline}>Making communities better</Text>
          </View>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.notificationButton}>
            <Ionicons name="notifications-outline" size={24} color="#030213" />
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationCount}>2</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.userButton} onPress={handleLogout}>
            <Ionicons name="person-outline" size={24} color="#030213" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Welcome Section */}
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome back, {firstName}!</Text>
          <Text style={styles.welcomeSubtitle}>
            Ready to make your community better today?
          </Text>
          <Button
            title="Report New Issue"
            onPress={() => router.push('/(tabs)/camera-report')}
            style={styles.primaryButton}
            icon={<Ionicons name="add" size={20} color="#ffffff" />}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/map')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#dcfce7' }]}>
              <Ionicons name="location" size={24} color="#10b981" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>View Map</Text>
              <Text style={styles.actionDescription}>
                See issues in your neighborhood
              </Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/my-reports')}
          >
            <View style={[styles.actionIcon, { backgroundColor: '#fed7aa' }]}>
              <Ionicons name="trending-up" size={24} color="#f59e0b" />
            </View>
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Track Progress</Text>
              <Text style={styles.actionDescription}>
                Check status of your reports
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Community Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Community Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.statsGrid}>
              <View style={[styles.statItem, { backgroundColor: '#dbeafe' }]}>
                <Text style={[styles.statNumber, { color: '#3b82f6' }]}>{quickStats.totalIssues}</Text>
                <Text style={styles.statLabel}>Total Issues</Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: '#dcfce7' }]}>
                <Text style={[styles.statNumber, { color: '#10b981' }]}>{quickStats.resolved}</Text>
                <Text style={styles.statLabel}>Resolved</Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: '#fef3c7' }]}>
                <Text style={[styles.statNumber, { color: '#f59e0b' }]}>{quickStats.inProgress}</Text>
                <Text style={styles.statLabel}>In Progress</Text>
              </View>
              <View style={[styles.statItem, { backgroundColor: '#fed7aa' }]}>
                <Text style={[styles.statNumber, { color: '#ea580c' }]}>{quickStats.pending}</Text>
                <Text style={styles.statLabel}>Pending</Text>
              </View>
            </View>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Community Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.activityList}>
              {recentActivity.map((activity) => (
                <View key={activity.id} style={styles.activityItem}>
                  <View style={styles.activityIcon}>
                    {getActivityIcon(activity.type)}
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <View style={styles.activityMeta}>
                      <Ionicons name="location-outline" size={12} color="#6b7280" />
                      <Text style={styles.activityLocation}>{activity.location}</Text>
                      <Text style={styles.activityTime}>• {activity.time}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
            <Button
              title="View All Activity"
              variant="outline"
              onPress={() => router.push('/(tabs)/map')}
              style={styles.viewAllButton}
            />
          </CardContent>
        </Card>

        {/* User Impact */}
        <Card>
          <CardHeader>
            <CardTitle>Your Impact</CardTitle>
          </CardHeader>
          <CardContent>
            <View style={styles.impactContainer}>
              <View style={styles.impactMain}>
                <Text style={styles.impactNumber}>{quickStats.userReports}</Text>
                <Text style={styles.impactLabel}>Issues Reported</Text>
              </View>
              <View style={styles.impactStats}>
                <View style={styles.impactStat}>
                  <Text style={styles.impactStatLabel}>Community Rank:</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{quickStats.communityRank}</Text>
                  </View>
                </View>
                <View style={styles.impactStat}>
                  <Text style={styles.impactStatLabel}>Total Upvotes:</Text>
                  <Text style={styles.impactStatValue}>35</Text>
                </View>
                <View style={styles.impactStat}>
                  <Text style={styles.impactStatLabel}>Issues Resolved:</Text>
                  <Text style={[styles.impactStatValue, { color: '#10b981' }]}>1</Text>
                </View>
              </View>
              <Button
                title="View My Reports"
                variant="outline"
                onPress={() => router.push('/(tabs)/my-reports')}
                style={styles.viewReportsButton}
              />
            </View>
          </CardContent>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  appIcon: {
    width: 32,
    height: 32,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  appName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#030213',
  },
  appTagline: {
    fontSize: 12,
    color: '#6b7280',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#dc2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationCount: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  userButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 16,
  },
  welcomeSection: {
    alignItems: 'center',
    backgroundColor: 'linear-gradient(135deg, #dbeafe 0%, #c7d2fe 100%)',
    padding: 32,
    borderRadius: 12,
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#030213',
    marginBottom: 8,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 24,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
  },
  quickActions: {
    gap: 16,
    marginBottom: 24,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  actionContent: {
    flex: 1,
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#030213',
    marginBottom: 4,
  },
  actionDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  activityIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#030213',
    marginBottom: 4,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  activityLocation: {
    fontSize: 12,
    color: '#6b7280',
  },
  activityTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  viewAllButton: {
    marginTop: 12,
  },
  impactContainer: {
    alignItems: 'center',
  },
  impactMain: {
    alignItems: 'center',
    backgroundColor: '#dbeafe',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    minWidth: 120,
  },
  impactNumber: {
    fontSize: 32,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 4,
  },
  impactLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  impactStats: {
    width: '100%',
    gap: 12,
    marginBottom: 16,
  },
  impactStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  impactStatLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  impactStatValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#030213',
  },
  badge: {
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 12,
    color: '#374151',
  },
  viewReportsButton: {
    width: '100%',
  },
});