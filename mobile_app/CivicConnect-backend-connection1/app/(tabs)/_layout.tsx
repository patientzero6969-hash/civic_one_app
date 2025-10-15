// CAN ASSIGN IMAGE FOR BUTTONS AT BOTTOM BAR
import { HapticTab } from '@/components/HapticTab';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, useColorScheme } from 'react-native';

export default function Layout() {
  const scheme = useColorScheme(); // 'light' or 'dark'

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors[scheme!].background,
          borderTopWidth: 0,
          elevation: 0,
          height: 70,
          paddingBottom: Platform.OS === 'ios' ? 20 : 10,
        },
        tabBarActiveTintColor: Colors[scheme!].tint,
        tabBarInactiveTintColor: Colors[scheme!].icon,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: 'Home',
          tabBarButton: (props) => <HapticTab {...props} />,
          tabBarIcon: ({ color }) => <IconSymbol name="house" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="camera-report"
        options={{
          tabBarLabel: 'Camera',
          tabBarButton: (props) => <HapticTab {...props} />,
          tabBarIcon: ({ color }) => <IconSymbol name="camera" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarLabel: 'Map',
          tabBarButton: (props) => <HapticTab {...props} />,
          tabBarIcon: ({ color }) => <IconSymbol name="map" color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="my-reports"
        options={{
          tabBarLabel: 'My Reports',
          tabBarButton: (props) => <HapticTab {...props} />,
          tabBarIcon: ({ color }) => <IconSymbol name="doc.text" color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}