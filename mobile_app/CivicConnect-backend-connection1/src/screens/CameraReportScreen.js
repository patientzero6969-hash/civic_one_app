// src/screens/CameraReportScreen.js
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { StorageService } from '../../utils/storage';

const API_BASE_URL = 'http://10.191.176.176:8000'; // Replace with your backend URL

export default function CameraReportScreen() {
  const router = useRouter();
  const [facing, setFacing] = useState('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [capturedImage, setCapturedImage] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cameraRef = useRef(null);

  useEffect(() => {
    // Get location permissions and current location
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        let locationResult = await Location.getCurrentPositionAsync({});
        setCurrentLocation(locationResult);
        // Set a default location string (you'll replace this with reverse geocoding later)
        setLocation(`${locationResult.coords.latitude.toFixed(6)}, ${locationResult.coords.longitude.toFixed(6)}`);
      }
    })();
  }, []);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Text style={styles.permissionText}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  function toggleCameraFacing() {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  }

  async function takePicture() {
    if (cameraRef.current) {
      try {
        const photo = await cameraRef.current.takePictureAsync();
        setCapturedImage(photo.uri);
        console.log('📷 Photo taken:', photo.uri);
      } catch (error) {
        console.error('Error taking picture:', error);
        Alert.alert('Error', 'Failed to take picture. Please try again.');
      }
    }
  }

  function retakePicture() {
    setCapturedImage(null);
  }

  // Placeholder function for future audio recording
  function recordAudio() {
    Alert.alert(
      'Audio Recording',
      'Audio recording feature will be implemented here. This will allow users to add voice notes to provide additional context.',
      [{ text: 'OK' }]
    );
  }

  // Placeholder function for GPS location fetching
  function useCurrentLocation() {
    if (currentLocation) {
      Alert.alert(
        'Use GPS Location',
        'GPS location integration will be implemented here. This will automatically fetch and format your current address.',
        [
          {
            text: 'Use Coordinates',
            onPress: () => {
              setLocation(`${currentLocation.coords.latitude.toFixed(6)}, ${currentLocation.coords.longitude.toFixed(6)}`);
            }
          },
          { text: 'Cancel' }
        ]
      );
    } else {
      Alert.alert('GPS Not Available', 'Location services are not available.');
    }
  }

async function submitReport() {
  console.log('🔄 Starting report submission with image...');

  if (!capturedImage) {
    Alert.alert('Error', 'Please take a photo before submitting.');
    return;
  }

  if (!title.trim()) {
    Alert.alert('Error', 'Please provide a title for the issue.');
    return;
  }

  if (!description.trim()) {
    Alert.alert('Error', 'Please provide a description of the issue.');
    return;
  }

  setIsSubmitting(true);

  try {
    // Get auth token
    const token = await StorageService.getAuthToken();
    console.log('🔑 Auth token retrieved successfully');

    if (!token) {
      Alert.alert('Error', 'Please log in again.');
      router.replace('/(auth)/login');
      return;
    }

    // Step 1: Upload image
    console.log('📷 Uploading image to Supabase...');
    const formData = new FormData();
    formData.append('file', {
      uri: capturedImage,
      type: 'image/jpeg',
      name: 'issue_image.jpg',
    });
    formData.append('compress', 'true');

    const imageResponse = await fetch(`${API_BASE_URL}/api/files/upload/image`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    console.log('📷 Image upload response status:', imageResponse.status);

    if (!imageResponse.ok) {
      const errorData = await imageResponse.text();
      console.error('Image upload failed:', errorData);
      throw new Error('Failed to upload image');
    }

    const imageData = await imageResponse.json();
    console.log('✅ Image uploaded successfully:', imageData.file_url);

    // Step 2: Get ML prediction from backend
    console.log('🤖 Getting ML prediction from backend...');
    let predictedCategory = 'other'; // Default fallback
    let confidence = 0;

    try {
      const predictionResponse = await fetch(
        `${API_BASE_URL}/api/issues/predict-category-from-url`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            image_url: imageData.file_url
          })
        }
      );

      if (predictionResponse.ok) {
        const predictionData = await predictionResponse.json();
        predictedCategory = predictionData.category;
        confidence = predictionData.confidence;
        console.log(`✅ Predicted: ${predictedCategory} with ${(confidence * 100).toFixed(2)}% confidence`);
      } else {
        console.warn('⚠️ ML prediction failed, using default category');
      }
    } catch (predictionError) {
      console.warn('⚠️ ML prediction error:', predictionError);
      console.log('Using default category: other');
    }

    // Step 3: Create issue with ML-predicted category
    const issueData = {
      title: title.trim(),
      description: description.trim(),
      category: predictedCategory, // Use ML model's prediction or fallback
      image_url: imageData.file_url,
      latitude: currentLocation?.coords.latitude || null,
      longitude: currentLocation?.coords.longitude || null,
      location_description: location.trim() || null,
      priority: 'medium',
      status: 'pending',
      upvotes: 0
    };

    console.log('📝 Creating issue with data:', issueData);

    const issueResponse = await fetch(`${API_BASE_URL}/api/issues/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(issueData),
    });

    console.log('📝 Issue creation response status:', issueResponse.status);

    if (!issueResponse.ok) {
      const errorData = await issueResponse.text();
      console.error('Issue creation failed:', errorData);
      throw new Error('Failed to create issue');
    }

    const createdIssue = await issueResponse.json();
    console.log('✅ Issue created successfully:', createdIssue);

    // Show success message with ML classification result
    const alertTitle = confidence > 0 ? '🎯 Report Submitted!' : '✅ Report Submitted!';
    const alertMessage = confidence > 0 
      ? `Issue classified as: ${predictedCategory}\nConfidence: ${(confidence * 100).toFixed(1)}%\n\nYou will receive updates on its progress.`
      : `Your report has been submitted successfully.\n\nYou will receive updates on its progress.`;

    Alert.alert(
      alertTitle,
      alertMessage,
      [
        {
          text: 'OK',
          onPress: () => {
            // Reset form
            setCapturedImage(null);
            setTitle('');
            setDescription('');
            // Keep location as it might be the same
            router.push('/(tabs)/my-reports'); // Navigate to my reports
          }
        }
      ]
    );

  } catch (error) {
    console.error('❌ Error submitting report:', error);
    Alert.alert('Error', 'Failed to submit report. Please try again.');
  } finally {
    setIsSubmitting(false);
  }
}

  if (capturedImage) {
    return (
      <KeyboardAvoidingView 
        style={styles.container} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.formContainer} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="white" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>New Report</Text>
            <View style={styles.placeholder} />
          </View>

          {/* Captured Image */}
          <View style={styles.imageContainer}>
            <Image source={{ uri: capturedImage }} style={styles.capturedImage} />
            <TouchableOpacity style={styles.retakeButton} onPress={retakePicture}>
              <Ionicons name="camera" size={20} color="white" />
              <Text style={styles.retakeText}>Retake</Text>
            </TouchableOpacity>
          </View>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="information-circle" size={20} color="#007AFF" />
            <Text style={styles.infoBannerText}>
              Our AI will automatically classify your issue based on the image
            </Text>
          </View>

          {/* Form Fields */}
          <View style={styles.formFields}>
            {/* Title */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Issue Title *</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Brief title describing the issue"
                value={title}
                onChangeText={setTitle}
                maxLength={100}
              />
            </View>

            {/* Description Section */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Description *</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.textInput, styles.descriptionInput]}
                  multiline
                  numberOfLines={4}
                  placeholder="Describe the civic issue (e.g., pothole on main road, broken streetlight, overflowing garbage bin...)"
                  value={description}
                  onChangeText={setDescription}
                  textAlignVertical="top"
                />
                <TouchableOpacity style={styles.audioButton} onPress={recordAudio}>
                  <Ionicons name="mic" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.placeholderText}>
                💡 Audio recording feature will be added here for voice descriptions
              </Text>
            </View>

            {/* Location Section */}
            <View style={styles.fieldContainer}>
              <Text style={styles.fieldLabel}>Location *</Text>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.textInput, styles.locationInput]}
                  placeholder="Enter location or address"
                  value={location}
                  onChangeText={setLocation}
                />
                <TouchableOpacity style={styles.gpsButton} onPress={useCurrentLocation}>
                  <Ionicons name="location" size={20} color="#007AFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.placeholderText}>
                📍 GPS location integration will be added here for automatic address detection
              </Text>
            </View>

            {/* Submit Button */}
            <TouchableOpacity 
              style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]} 
              onPress={submitReport}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Text style={styles.submitButtonText}>Submitting...</Text>
              ) : (
                <>
                  <Ionicons name="send" size={20} color="white" />
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  // Camera View
  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={facing} ref={cameraRef}>
        {/* Header with back button */}
        <View style={styles.cameraHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.cameraHeaderTitle}>Take Photo</Text>
          <View style={styles.placeholder} />
        </View>

        {/* Camera Controls */}
        <View style={styles.cameraControls}>
          <View style={styles.controlsRow}>
            <TouchableOpacity style={styles.controlButton} onPress={toggleCameraFacing}>
              <Ionicons name="camera-reverse" size={24} color="white" />
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            
            <View style={styles.placeholder} />
          </View>
          
          <Text style={styles.instructionText}>Position the civic issue in the frame and tap to capture</Text>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f8f9fa',
  },
  permissionText: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  camera: {
    flex: 1,
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#007AFF',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  cameraHeaderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  placeholder: {
    width: 40,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingBottom: 40,
    paddingTop: 20,
  },
  controlsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
  },
  instructionText: {
    color: 'white',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 15,
    paddingHorizontal: 20,
  },
  formContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  imageContainer: {
    position: 'relative',
    marginHorizontal: 20,
    marginVertical: 20,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  capturedImage: {
    width: '100%',
    height: 250,
  },
  retakeButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  retakeText: {
    color: 'white',
    marginLeft: 5,
    fontSize: 14,
    fontWeight: '500',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    marginHorizontal: 20,
    marginBottom: 10,
    padding: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoBannerText: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#1565C0',
    fontWeight: '500',
  },
  formFields: {
    padding: 20,
  },
  fieldContainer: {
    marginBottom: 25,
  },
  fieldLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  descriptionInput: {
    flex: 1,
    height: 100,
    textAlignVertical: 'top',
    marginRight: 10,
  },
  locationInput: {
    flex: 1,
    marginRight: 10,
  },
  audioButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  gpsButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
    paddingHorizontal: 5,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 15,
    borderRadius: 8,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  submitButtonDisabled: {
    backgroundColor: '#999',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 8,
  },
});