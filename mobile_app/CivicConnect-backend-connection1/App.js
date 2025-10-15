// App.js
import { Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import * as Location from 'expo-location';
import { useEffect, useState } from 'react';
import { Alert } from 'react-native';


// Import screens
import HeatMapScreen from './src/screens/HeatMapScreen';
import HomeScreen from './src/screens/HomeScreen';
import MyReportsScreen from './src/screens/MyReportsScreen';
import ReportDetailScreen from './src/screens/ReportDetailScreen';
import ReportIssueScreen from './src/screens/ReportIssueScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack Navigator for Reports
function ReportsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="MyReports" 
        component={MyReportsScreen}
        options={{ title: 'My Reports' }}
      />
      <Stack.Screen 
        name="ReportDetail" 
        component={ReportDetailScreen}
        options={{ title: 'Report Details' }}
      />
    </Stack.Navigator>
  );
}

export default function App() {
  const [location, setLocation] = useState(null);

  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Location permission is required for this app to work properly.');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();
  }, []);

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            let iconName;
            
            if (route.name === 'Home') {
              iconName = focused ? 'home' : 'home-outline';
            } else if (route.name === 'Report') {
              iconName = focused ? 'add-circle' : 'add-circle-outline';
            } else if (route.name === 'Reports') {
              iconName = focused ? 'list' : 'list-outline';
            } else if (route.name === 'HeatMap') {
              iconName = focused ? 'map' : 'map-outline';
            }

            return <Ionicons name={iconName} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: 'gray',
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Report" component={ReportIssueScreen} />
        <Tab.Screen name="Reports" component={ReportsStack} options={{ headerShown: false }} />
        <Tab.Screen name="HeatMap" component={HeatMapScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}