// app/(auth)/login.tsx - Fixed TypeScript version
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View, Alert } from 'react-native';

import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/input';
import { useAuth } from '../../contexts/AuthContext';

type TabType = 'login' | 'register';

interface LoginForm {
  email: string;
  password: string;
}

interface RegisterForm {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
}

export default function LoginScreen() {
  const { login, register, networkError, retryConnection } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [loginForm, setLoginForm] = useState<LoginForm>({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState<boolean>(false);

  // Network debugging function
  const testNetworkConnection = async (): Promise<void> => {
    try {
      console.log('🔍 Testing network connection...');
      
      // Test backend health
      const backendUrl = 'http://10.191.176.176:8000';
      const response = await fetch(`${backendUrl}/health`);
      const data = await response.json();
      console.log('✅ Backend connection test:', data);
      
      Alert.alert('✅ Connection Test', 'Backend connection successful!');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Network test failed:', error);
      Alert.alert(
        '❌ Connection Test Failed', 
        `Error: ${errorMessage}\n\nCheck:\n1. Backend is running on port 8000\n2. Your IP address is correct\n3. Firewall settings`,
        [
          { text: 'Retry', onPress: testNetworkConnection },
          { text: 'OK' }
        ]
      );
    }
  };

  const handleLogin = async (): Promise<void> => {
    if (!loginForm.email || !loginForm.password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      await login(loginForm.email, loginForm.password);
      
      Alert.alert('Success', 'Login successful!', [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)')
        }
      ]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      console.error('Login error:', error);
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (): Promise<void> => {
    if (registerForm.password !== registerForm.confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (!registerForm.name || !registerForm.email || !registerForm.password) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (registerForm.password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters long');
      return;
    }
    
    setLoading(true);
    try {
      await register({
        email: registerForm.email,
        password: registerForm.password,
        full_name: registerForm.name,
        phone: registerForm.phone || undefined
      });
      
      Alert.alert('Success', 'Account created successfully!', [
        {
          text: 'OK',
          onPress: () => router.replace('/(tabs)')
        }
      ]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      console.error('Registration error:', error);
      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Network Error Banner */}
        {networkError && (
          <Card style={styles.errorCard}>
            <CardContent>
              <View style={styles.errorContent}>
                <Ionicons name="warning" size={24} color="#ef4444" />
                <Text style={styles.errorText}>
                  Cannot connect to server. Check your internet connection.
                </Text>
                <Button 
                  title="Retry" 
                  onPress={retryConnection}
                  variant="outline"
                  style={styles.retryButton}
                />
              </View>
            </CardContent>
          </Card>
        )}

        {/* App Header */}
        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Ionicons name="location" size={32} color="#ffffff" />
          </View>
          <Text style={styles.appTitle}>CivicReport</Text>
          <Text style={styles.appSubtitle}>Making our communities better, together</Text>
        </View>

        {/* Debug Section */}
        <Card style={styles.debugCard}>
          <CardContent>
            <Text style={styles.debugTitle}>Network Debug</Text>
            <Button 
              title="Test Backend Connection" 
              onPress={testNetworkConnection}
              variant="outline"
              style={styles.debugButton}
            />
            <Text style={styles.debugNote}>
              Backend URL: http://10.191.176.176:8000
            </Text>
          </CardContent>
        </Card>

        {/* Login/Register Card */}
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>
              Sign in to report civic issues in your community
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Tab Selection */}
            <View style={styles.tabContainer}>
              <Button
                title="Sign In"
                onPress={() => setActiveTab('login')}
                variant={activeTab === 'login' ? 'default' : 'outline'}
                style={styles.tab}
              />
              <Button
                title="Sign Up"
                onPress={() => setActiveTab('register')}
                variant={activeTab === 'register' ? 'default' : 'outline'}
                style={styles.tab}
              />
            </View>

            {activeTab === 'login' ? (
              <View style={styles.form}>
                <Input
                  label="Email"
                  value={loginForm.email}
                  onChangeText={(text: string) => setLoginForm({ ...loginForm, email: text })}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  required
                />
                <Input
                  label="Password"
                  value={loginForm.password}
                  onChangeText={(text: string) => setLoginForm({ ...loginForm, password: text })}
                  placeholder="Enter your password"
                  secureTextEntry
                  required
                />
                <Button
                  title={loading ? "Signing In..." : "Sign In"}
                  onPress={handleLogin}
                  disabled={loading || !loginForm.email || !loginForm.password}
                  style={styles.submitButton}
                />
              </View>
            ) : (
              <View style={styles.form}>
                <Input
                  label="Full Name"
                  value={registerForm.name}
                  onChangeText={(text: string) => setRegisterForm({ ...registerForm, name: text })}
                  placeholder="Enter your full name"
                  required
                />
                <Input
                  label="Email"
                  value={registerForm.email}
                  onChangeText={(text: string) => setRegisterForm({ ...registerForm, email: text })}
                  placeholder="Enter your email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  required
                />
                <Input
                  label="Phone Number"
                  value={registerForm.phone}
                  onChangeText={(text: string) => setRegisterForm({ ...registerForm, phone: text })}
                  placeholder="Enter your phone number (optional)"
                  keyboardType="phone-pad"
                />
                <Input
                  label="Password"
                  value={registerForm.password}
                  onChangeText={(text: string) => setRegisterForm({ ...registerForm, password: text })}
                  placeholder="Create a password (min 6 characters)"
                  secureTextEntry
                  required
                />
                <Input
                  label="Confirm Password"
                  value={registerForm.confirmPassword}
                  onChangeText={(text: string) => setRegisterForm({ ...registerForm, confirmPassword: text })}
                  placeholder="Confirm your password"
                  secureTextEntry
                  required
                />
                <Button
                  title={loading ? "Creating Account..." : "Create Account"}
                  onPress={handleRegister}
                  disabled={loading || !registerForm.name || !registerForm.email || !registerForm.password}
                  style={styles.submitButton}
                />
              </View>
            )}
          </CardContent>
        </Card>

        <Text style={styles.footerText}>
          By continuing, you agree to help improve your community
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dbeafe',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 16,
    justifyContent: 'center',
  },
  errorCard: {
    marginBottom: 16,
    backgroundColor: '#fef2f2',
    borderColor: '#ef4444',
    borderWidth: 1,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 14,
  },
  retryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  debugCard: {
    marginBottom: 16,
    backgroundColor: '#f0f9ff',
    borderColor: '#3b82f6',
    borderWidth: 1,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1e40af',
  },
  debugButton: {
    marginBottom: 8,
  },
  debugNote: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconContainer: {
    width: 64,
    height: 64,
    backgroundColor: '#3b82f6',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#030213',
    marginBottom: 8,
  },
  appSubtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 8,
  },
  tab: {
    flex: 1,
  },
  form: {
    gap: 8,
  },
  submitButton: {
    marginTop: 8,
  },
  footerText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#6b7280',
    marginTop: 16,
  },
});