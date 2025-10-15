// src/screens/ReportIssueScreen.js
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { Audio, Video } from 'expo-av';
import { Camera, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

export default function ReportIssueScreen() {
  const router = useRouter();
  const [hasPermission, setHasPermission] = useState(null);
  const [type, setType] = useState(CameraType.back);
  const [showCamera, setShowCamera] = useState(false);
  const [image, setImage] = useState(null);
  const [video, setVideo] = useState(null);
  const [recording, setRecording] = useState();
  const [sound, setSound] = useState();
  const [isRecording, setIsRecording] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('pothole');
  const [location, setLocation] = useState(null);

  const cameraRef = useRef();
  
  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      if (locationStatus === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setLocation(loc);
      }
    })();
  }, []);

  const takePicture = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync();
      setImage(photo.uri);
      setShowCamera(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      if (result.assets[0].type === 'video') {
        setVideo(result.assets[0].uri);
      } else {
        setImage(result.assets[0].uri);
      }
    }
  };

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    setRecording(undefined);
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    const uri = recording.getURI();
    console.log('Recording stopped and stored at', uri);
  };

  const submitReport = async () => {
    if (!image && !video) {
      Alert.alert('Error', 'Please add a photo or video to your report');
      return;
    }

    if (!location) {
      Alert.alert('Error', 'Location is required for the report');
      return;
    }

    const reportData = {
      image,
      video,
      description,
      category,
      location: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      timestamp: new Date().toISOString(),
      status: 'pending',
    };

    console.log('Report submitted:', reportData);

    Alert.alert('Success', 'Your report has been submitted successfully!', [
      {
        text: 'OK',
        onPress: () => {
          // Reset form
          setImage(null);
          setVideo(null);
          setDescription('');
          setCategory('pothole');
          router.push('/'); // Navigate back to Home
        },
      },
    ]);
  };

  if (hasPermission === null) return <View />;
  if (hasPermission === false) return <Text>No access to camera</Text>;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Report an Issue</Text>
        <Text style={styles.headerSubtitle}>Help improve your community</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Category</Text>
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={category}
            style={styles.picker}
            onValueChange={(itemValue) => setCategory(itemValue)}
          >
            {categories.map((cat) => (
              <Picker.Item key={cat.value} label={cat.label} value={cat.value} />
            ))}
          </Picker>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Add Photo or Video</Text>
        <View style={styles.mediaButtons}>
          <TouchableOpacity
            style={styles.mediaButton}
            onPress={() => setShowCamera(true)}
          >
            <Ionicons name="camera" size={24} color="#007AFF" />
            <Text style={styles.mediaButtonText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.mediaButton} onPress={pickImage}>
            <Ionicons name="images" size={24} color="#007AFF" />
            <Text style={styles.mediaButtonText}>Choose Media</Text>
          </TouchableOpacity>
        </View>

        {image && (
          <View style={styles.mediaPreview}>
            <Image source={{ uri: image }} style={styles.previewImage} />
            <TouchableOpacity style={styles.removeButton} onPress={() => setImage(null)}>
              <Ionicons name="close-circle" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}

        {video && (
          <View style={styles.mediaPreview}>
            <Video
              source={{ uri: video }}
              style={styles.previewVideo}
              useNativeControls
              resizeMode="contain"
            />
            <TouchableOpacity style={styles.removeButton} onPress={() => setVideo(null)}>
              <Ionicons name="close-circle" size={24} color="#FF3B30" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Voice Note (Optional)</Text>
        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordButtonActive]}
          onPress={isRecording ? stopRecording : startRecording}
        >
          <Ionicons
            name={isRecording ? 'stop-circle' : 'mic'}
            size={24}
            color={isRecording ? '#FF3B30' : '#007AFF'}
          />
          <Text style={styles.recordButtonText}>
            {isRecording ? 'Stop Recording' : 'Record Voice Note'}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Description (Optional)</Text>
        <TextInput
          style={styles.textInput}
          multiline
          numberOfLines={4}
          placeholder="Add additional details about the issue..."
          value={description}
          onChangeText={setDescription}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.locationInfo}>
          <Ionicons name="location" size={20} color="#007AFF" />
          <Text style={styles.locationText}>
            {location
              ? `${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)}`
              : 'Getting location...'}
          </Text>
        </View>
      </View>

      <TouchableOpacity style={styles.submitButton} onPress={submitReport}>
        <Text style={styles.submitButtonText}>Submit Report</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={false}
        visible={showCamera}
        onRequestClose={() => setShowCamera(false)}
      >
        <Camera style={styles.camera} type={type} ref={cameraRef}>
          <View style={styles.cameraButtonContainer}>
            <TouchableOpacity style={styles.cameraButton} onPress={() => setShowCamera(false)}>
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureButtonInner} />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={() => setType(type === CameraType.back ? CameraType.front : CameraType.back)}
            >
              <Ionicons name="camera-reverse" size={30} color="white" />
            </TouchableOpacity>
          </View>
        </Camera>
      </Modal>
    </ScrollView>
  );
}

// Styles remain the same as your original

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
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 5,
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
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  picker: {
    height: 50,
  },
  mediaButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  mediaButtonText: {
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  mediaPreview: {
    marginTop: 15,
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  previewVideo: {
    width: '100%',
    height: 200,
    borderRadius: 8,
  },
  removeButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'white',
    borderRadius: 12,
  },
  recordButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  recordButtonActive: {
    backgroundColor: '#ffe6e6',
    borderColor: '#FF3B30',
  },
  recordButtonText: {
    color: '#007AFF',
    marginLeft: 8,
    fontWeight: '500',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  locationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f8ff',
    padding: 12,
    borderRadius: 8,
  },
  locationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    margin: 20,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  camera: {
    flex: 1,
  },
  cameraButtonContainer: {
    flex: 1,
    backgroundColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    padding: 50,
  },
  cameraButton: {
    alignSelf: 'flex-end',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'white',
  },
});