// app/(tabs)/my-reports.tsx - Enhanced with navigation from map
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, ScrollView, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { StorageService } from '../../utils/storage';

const API_BASE_URL = 'http://10.191.176.176:8000/api';

// Keep your existing interfaces
interface Report {
  id: string;
  title: string;
  category: string;
  location: string;
  description: string;
  status: 'pending' | 'in_progress' | 'resolved';
  progress: number;
  upvotes: number;
  submittedAt: string;
  lastUpdate: string;
  useGPS: boolean;
  timestamp: string;
  image_url?: string;
  latitude?: number;
  longitude?: number;
  citizen_name?: string;
  days_open?: number;
  departmentAssigned?: string | null;
  updates?: IssueUpdate[];
}

interface IssueUpdate {
  id: number;
  update_text: string;
  created_at: string;
  staff_name?: string;
  staff_department?: string;
}

const statusColors = {
  pending: '#FF9500',
  in_progress: '#007AFF',
  resolved: '#34C759'
};

const categoryDisplayNames = {
  'potholes': 'Road Department',
  'WaterLogging': 'Public Service',
  'DamagedElectricalPoles': 'Electricity Department',
  'Garbage': 'Sanitary Department',
  'FallenTrees': 'Public Service'
};

export default function MyReportsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const scrollViewRef = useRef<ScrollView>(null);
  const cardRefs = useRef<{ [key: string]: View | null }>({});
  
  const [issues, setIssues] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress' | 'resolved'>('all');
  const [highlightedReportId, setHighlightedReportId] = useState<string | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const ITEMS_PER_PAGE = 20;

  // Handle navigation from map
  useEffect(() => {
    if (params.reportId && params.scrollToReport === 'true') {
      const reportId = params.reportId as string;
      console.log('📍 Navigated from map to report:', reportId);
      
      // Highlight the report
      setHighlightedReportId(reportId);
      
      // Scroll to the report after a short delay to ensure rendering
      setTimeout(() => {
        scrollToReport(reportId);
      }, 500);
      
      // Remove highlight after 3 seconds
      setTimeout(() => {
        setHighlightedReportId(null);
      }, 3000);
    }
  }, [params.reportId, params.scrollToReport, issues]);

  // Function to scroll to a specific report
  const scrollToReport = (reportId: string) => {
    const cardRef = cardRefs.current[reportId];
    if (cardRef && scrollViewRef.current) {
      cardRef.measureLayout(
        scrollViewRef.current as any,
        (x, y) => {
          // Scroll to bring the card to the top of the screen
          // Subtract a small offset for better visual appearance
          scrollViewRef.current?.scrollTo({ y: Math.max(0, y - 10), animated: true });
        },
        () => {
          console.log('Failed to measure layout');
        }
      );
    } else {
      console.log('Card ref not found for report:', reportId);
    }
  };

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

  // Enhanced load function with pagination
  const loadIssues = useCallback(async (page: number = 1, isRefresh: boolean = false) => {
    try {
      if (page === 1) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      
      setError(null);
      
      const token = await StorageService.getAuthToken();
      if (!token) {
        Alert.alert(
          'Please Login',
          'You need to login to view your reports.',
          [{ text: 'OK', onPress: () => router.push('/(auth)/login') }]
        );
        return;
      }

      console.log(`📋 Loading issues from API - Page ${page}...`);
      
      // Add pagination parameters to the API call
      const response = await fetch(`${API_BASE_URL}/issues/?page=${page}&limit=${ITEMS_PER_PAGE}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('Response status:', response.status);

      if (response.status === 401) {
        // Token expired, clear it and ask user to login again
        await StorageService.removeAuthToken();
        Alert.alert(
          'Session Expired',
          'Please login again to view your reports.',
          [{ text: 'OK', onPress: () => router.push('/(auth)/login') }]
        );
        return;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', errorText);
        throw new Error(`Failed to load reports: ${response.status}`);
      }

      const data = await response.json();
      console.log(`✅ Issues loaded - Page ${page}:`, data.issues?.length || 0);
      console.log('Total count:', data.total_count || 0);

      // Set total count and check if there are more pages
      const totalCount = data.total_count || data.issues?.length || 0;
      setTotalCount(totalCount);
      setHasMore((page * ITEMS_PER_PAGE) < totalCount);

      // Transform the API data with improved location handling
      const transformedIssues: Report[] = await Promise.all(
        (data.issues || []).map(async (issue: any) => {
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
              console.warn('Failed to reverse geocode, using coordinates:', error);
              location = getLocationFromCoords(issue.latitude, issue.longitude);
            }
          }

          return {
            id: issue.id.toString(),
            title: issue.title,
            category: issue.category,
            location: location,
            description: issue.description,
            status: issue.status,
            progress: issue.status === 'resolved' ? 100 : issue.status === 'in_progress' ? 50 : 10,
            upvotes: issue.upvotes || 0,
            submittedAt: issue.created_at,
            lastUpdate: issue.updated_at,
            useGPS: !!issue.latitude,
            timestamp: issue.created_at,
            image_url: issue.image_url,
            latitude: issue.latitude,
            longitude: issue.longitude,
            citizen_name: issue.citizen_name,
            days_open: Math.floor((new Date().getTime() - new Date(issue.created_at).getTime()) / (1000 * 3600 * 24)),
            departmentAssigned: categoryDisplayNames[issue.category as keyof typeof categoryDisplayNames] || issue.category,
            updates: issue.updates || []
          };
        })
      );

      // Update issues list
      if (page === 1 || isRefresh) {
        setIssues(transformedIssues);
        setCurrentPage(1);
      } else {
        setIssues(prevIssues => [...prevIssues, ...transformedIssues]);
      }
      
      setCurrentPage(page);
      
    } catch (err: any) {
      console.error('❌ Error loading issues:', err);
      const errorMessage = err.message || 'Failed to load reports';
      setError(errorMessage);
      
      if (page === 1) {
        Alert.alert(
          'Error Loading Reports',
          errorMessage,
          [
            { text: 'Retry', onPress: () => loadIssues(1, true) },
            { text: 'Cancel', style: 'cancel' }
          ]
        );
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [router]);

  // Load more function for pagination
  const loadMoreIssues = useCallback(() => {
    if (!loadingMore && hasMore) {
      loadIssues(currentPage + 1);
    }
  }, [currentPage, hasMore, loadingMore, loadIssues]);

  // Refresh function
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setCurrentPage(1);
    setHasMore(true);
    loadIssues(1, true);
  }, [loadIssues]);

  // Focus effect to reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setCurrentPage(1);
      setHasMore(true);
      loadIssues(1, true);
    }, [loadIssues])
  );

  // Filter issues based on status
  const filteredIssues = filter === 'all' ? issues : issues.filter(issue => issue.status === filter);

  // Get status display text
  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Pending Review';
      case 'in_progress': return 'In Progress';
      case 'resolved': return 'Resolved';
      default: return status;
    }
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

  // Handle scroll to detect when to load more
  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const paddingToBottom = 20;
    
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
      loadMoreIssues();
    }
  };

  // Render filter buttons with counts (only for currently loaded issues)
  const renderFilterButtons = () => (
    <View style={styles.filterContainer}>
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ alignItems: 'center' }}
      >
        {(['all', 'pending', 'in_progress', 'resolved'] as const).map((status) => {
          const count = status === 'all' ? issues.length : issues.filter(i => i.status === status).length;
          return (
            <TouchableOpacity
              key={status}
              style={[
                styles.filterButton,
                filter === status && styles.filterButtonActive
              ]}
              onPress={() => setFilter(status)}
            >
              <Text style={[
                styles.filterButtonText,
                filter === status && styles.filterButtonTextActive
              ]}>
                {status === 'all' ? 'All' : getStatusText(status)} ({count})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      
      {/* Show loading indicator and total count */}
      {totalCount > 0 && (
        <View style={styles.paginationInfo}>
          <Text style={styles.paginationText}>
            Showing {issues.length} of {totalCount} reports
          </Text>
        </View>
      )}
    </View>
  );

  // Render issue card with highlight support
  // Render issue card with highlight support
const renderIssueCard = (issue: Report) => {
  const isHighlighted = highlightedReportId === issue.id;
  
  return (
    <View
      key={issue.id}
      ref={(ref) => {
        cardRefs.current[issue.id] = ref;
      }}
      style={[
        styles.issueCardContainer,
        isHighlighted && styles.highlightedCard
      ]}
    >
      {/* Removed TouchableOpacity wrapper - card is now non-clickable */}
      <View style={styles.issueCard}>
        <Card>
          <CardHeader>
            <View style={styles.cardHeader}>
              <Text style={styles.issueTitle} numberOfLines={2}>
                {issue.title}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: statusColors[issue.status] }]}>
                <Text style={styles.statusText}>{getStatusText(issue.status)}</Text>
              </View>
            </View>
          </CardHeader>
          <CardContent>
            <Text style={styles.issueDescription} numberOfLines={3}>
              {issue.description}
            </Text>
            
            <View style={styles.issueInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="location-outline" size={16} color="#666" />
                <Text style={styles.infoText} numberOfLines={2}>
                  {issue.location}
                </Text>
                {issue.latitude && issue.longitude && (
                  <TouchableOpacity
                    style={styles.coordinatesButton}
                    onPress={() => {
                      // Optional: Show coordinates or open in maps
                      Alert.alert(
                        'Coordinates',
                        `Latitude: ${issue.latitude?.toFixed(6)}\nLongitude: ${issue.longitude?.toFixed(6)}`,
                        [
                          { text: 'OK' },
                          { 
                            text: 'Open in Maps', 
                            onPress: () => {
                              // You can implement opening in native maps here
                              console.log('Open maps:', issue.latitude, issue.longitude);
                            }
                          }
                        ]
                      );
                    }}
                  >
                    <Ionicons name="navigate-circle-outline" size={16} color="#007AFF" />
                  </TouchableOpacity>
                )}
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={16} color="#666" />
                <Text style={styles.infoText}>
                  {formatDate(issue.submittedAt)}
                </Text>
              </View>
              
              <View style={styles.infoRow}>
                <Ionicons name="business-outline" size={16} color="#666" />
                <Text style={styles.infoText}>
                  {issue.departmentAssigned}
                </Text>
              </View>
            </View>

            {issue.days_open !== undefined && (
              <View style={styles.daysOpen}>
                <Text style={styles.daysOpenText}>
                  {issue.days_open} day{issue.days_open !== 1 ? 's' : ''} open
                </Text>
              </View>
            )}

            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { 
                  width: `${issue.progress}%`,
                  backgroundColor: statusColors[issue.status]
                }]} />
              </View>
              <Text style={styles.progressText}>{issue.progress}%</Text>
            </View>
          </CardContent>
        </Card>
      </View>
    </View>
  );
};

  // Render load more button/indicator
  const renderLoadMoreButton = () => {
    if (!hasMore) {
      return (
        <View style={styles.endOfListContainer}>
          <Text style={styles.endOfListText}>You've reached the end of your reports</Text>
        </View>
      );
    }

    return (
      <View style={styles.loadMoreContainer}>
        {loadingMore ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <TouchableOpacity style={styles.loadMoreButton} onPress={loadMoreIssues}>
            <Text style={styles.loadMoreText}>Load More Reports</Text>
            <Ionicons name="chevron-down" size={16} color="#007AFF" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render loading state
  if (loading && issues.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading your reports...</Text>
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
          <Text style={styles.errorTitle}>Unable to Load Reports</Text>
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Try Again"
            onPress={() => loadIssues(1, true)}
            style={styles.retryButton}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Reports</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/(tabs)/camera-report')}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {renderFilterButtons()}

      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        {filteredIssues.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#999" />
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'No Reports Yet' : `No ${getStatusText(filter)} Reports`}
            </Text>
            <Text style={styles.emptyText}>
              {filter === 'all' 
                ? 'Start by reporting your first civic issue.'
                : `You don't have any ${getStatusText(filter).toLowerCase()} reports loaded yet.`
              }
            </Text>
            {filter === 'all' && (
              <Button
                title="Report an Issue"
                onPress={() => router.push('/(tabs)/camera-report')}
                style={styles.emptyButton}
              />
            )}
          </View>
        ) : (
          <View style={styles.issuesContainer}>
            {filteredIssues.map(renderIssueCard)}
            {filter === 'all' && renderLoadMoreButton()}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Updated styles with highlight effect
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    flexDirection: 'column',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 18,
    backgroundColor: '#f0f0f0',
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
    shadowColor: '#007AFF',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  filterButtonText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 16,
  },
  filterButtonTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  paginationInfo: {
    marginTop: 8,
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 12,
    color: '#666',
  },
  scrollView: {
    flex: 1,
  },
  issuesContainer: {
    padding: 16,
  },
  issueCardContainer: {
    marginBottom: 16,
  },
  highlightedCard: {
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    padding: 4,
    marginHorizontal: -4,
  },
  issueCard: {
    // No additional styles needed
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  issueTitle: {
    flex: 1,
    marginRight: 12,
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 80,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  issueDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 12,
  },
  issueInfo: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  infoText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  coordinatesButton: {
    marginLeft: 8,
    padding: 4,
  },
  daysOpen: {
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  daysOpenText: {
    fontSize: 12,
    color: '#FF9500',
    fontWeight: '500',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    minWidth: 30,
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  loadMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  loadMoreText: {
    color: '#007AFF',
    fontWeight: '500',
    marginRight: 8,
  },
  endOfListContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  endOfListText: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  emptyButton: {
    backgroundColor: '#007AFF',
  },
});