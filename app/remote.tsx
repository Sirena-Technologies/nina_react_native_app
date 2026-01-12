import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image } from 'expo-image';
import { RobotCom } from '@/utils/RobotCom';
import { VideoStream } from '@/utils/VideoStream';

const { width, height } = Dimensions.get('window');

interface ActionItem {
  title: string;
  message: string;
  toast: string;
}

const ACTION_ITEMS: ActionItem[] = [
  { title: 'Neutral', message: 'Neutral', toast: 'Neutralizing Nino' },
  { title: 'Point Right', message: 'point_right', toast: 'Nino will Point Right' },
  { title: 'Hello', message: 'hello', toast: 'Nino will say Hello' },
  { title: 'Relax', message: 'relax', toast: 'Nino will Relax' },
  { title: 'Namaste', message: 'namaste', toast: 'Nino will do Namaste' },
  { title: 'Point Left', message: 'point_left', toast: 'Nino will Point Left' },
  { title: 'Head Nod', message: 'head_node', toast: 'Nino will Nod Head' },
  { title: 'Custom Action', message: 'custom_action', toast: 'Nino will perform Custom Action' },
];

export default function RemoteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const ip = params.ip as string;
  const deviceName = params.name as string;

  const [robot] = useState(new RobotCom());
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string>('Connecting...');
  const videoStreamRef = useRef<VideoStream | null>(null);
  const isConnectingRef = useRef<boolean>(false);

  useEffect(() => {
    if (ip) {
      try {
        robot.openTcp(ip);
        if (robot.mTcpClient) {
          // Request video connection after TCP is established
          setTimeout(() => {
            startVideoStream();
          }, 1500);
        } else {
          console.warn('TCP client not initialized. Native module may not be linked.');
          setVideoStatus('TCP not available');
        }
      } catch (error) {
        console.error('Error opening TCP connection:', error);
        setVideoStatus('Connection error');
      }
    }

    return () => {
      if (videoStreamRef.current) {
        videoStreamRef.current.stopStreaming();
      }
      if (robot.mTcpClient) {
        robot.mTcpClient.stopClient();
      }
    };
  }, [ip]);

  const startVideoStream = async () => {
    if (isConnectingRef.current || !ip) return;
    
    isConnectingRef.current = true;
    setVideoStatus('Requesting video stream...');

    try {
      const videoStream = new VideoStream();
      videoStreamRef.current = videoStream;

      // Request video link
      const videoConfig = await videoStream.requestVideoLink(ip);
      
      if (!videoConfig) {
        setVideoStatus('Failed to get video config');
        isConnectingRef.current = false;
        return;
      }

      setVideoStatus('Connecting to video stream...');

      // Request video connection via LUCI
      robot.request_video_connection();
      
      // Wait a bit for the connection to be ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Start streaming
      await videoStream.startStreaming(videoConfig, (imageData: string) => {
        setVideoUri(imageData);
        setVideoStatus('Streaming');
      });

      setVideoStatus('Streaming');
    } catch (error) {
      console.error('Error starting video stream:', error);
      setVideoStatus('Stream error - check console');
    } finally {
      isConnectingRef.current = false;
    }
  };

  const handleActionPress = (index: number) => {
    const action = ACTION_ITEMS[index];
    
    // Show toast message
    console.log(action.toast);

    // Send asynchronous command
    if (robot.mTcpClient) {
      // Check if it's custom_action and send motor positions
      if (index === 7) {
        // Custom Action
        sendCustomAction();
      } else {
        // Regular actions - send LUCI command 245 with action message
        robot.sendLUCICommand(245, action.message, 0);
      }
    } else {
      Alert.alert('Error', 'TCP client not available. Cannot send command.');
    }
  };

  const sendCustomAction = () => {
    // Format: "custom_action|frame1_motors|frame2_motors|frame3_motors|frame4_motors|frame5_motors|frame6_motors|velocity|delays"
    // Each frame: comma-separated motor positions (11 motors)
    // Velocity: 60 for all motors
    // Delays: 500,1000,1000,1500,1000,1000 (ms)

    // Frame 1: Initial Neutral (all 2048)
    const frame1 = '2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048';
    
    // Frame 2: Pose 1 (Lift/Preparation)
    const frame2 = '2050,2046,2047,2043,2046,2064,1716,2329,2053,2040,2048';
    
    // Frame 3: Pose 2 (Main Action Start)
    const frame3 = '1319,2764,1114,1059,1273,2775,2121,2045,2826,1273,2048';
    
    // Frame 4: Pose 3 (Main Action Peak)
    const frame4 = '1150,2930,1114,1059,1273,2775,2121,2045,2826,1273,2200';
    
    // Frame 5: Pose 4 (Return/Transition)
    const frame5 = '2050,2046,2047,2043,2046,2064,1716,2329,2053,2040,2048';
    
    // Frame 6: Final Neutral (all 2048)
    const frame6 = '2048,2048,2048,2048,2048,2048,2048,2048,2048,2048,2048';
    
    // Velocity: 60 for all motors
    const velocity = '60,60,60,60,60,60,60,60,60,60,60';
    
    // Format the complete message: custom_action|frame1|frame2|frame3|frame4|frame5|frame6|velocity|delays
    const customActionData = `custom_action|${frame1}|${frame2}|${frame3}|${frame4}|${frame5}|${frame6}|${velocity}|500|1000|1000|1500|1000|1000`;
    
    console.log('Sending custom action:', customActionData);
    robot.sendLUCICommand(245, customActionData, 0);
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect', 'Are you sure you want to disconnect?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        onPress: () => {
          if (robot.mTcpClient) {
            robot.mTcpClient.stopClient();
          }
          router.replace('/device-list');
        },
      },
    ]);
  };

  const renderActionItem = ({ item, index }: { item: ActionItem; index: number }) => (
    <TouchableOpacity
      style={styles.actionButton}
      onPress={() => handleActionPress(index)}
    >
      <Text style={styles.actionButtonText}>{item.title}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{deviceName || 'Robot Control'}</Text>
        <Text style={styles.headerSubtitle}>IP: {ip}</Text>
      </View>
      
      {/* Video Display Area */}
      <View style={styles.videoContainer}>
        {videoUri ? (
          <Image 
            source={{ uri: videoUri }} 
            style={styles.video} 
            contentFit="contain"
            transition={100}
          />
        ) : (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoPlaceholderText}>{videoStatus}</Text>
            <Text style={styles.videoPlaceholderSubtext}>
              {videoStatus === 'Connecting...' ? 'Please wait...' : 'Video stream will appear here'}
            </Text>
          </View>
        )}
      </View>

      {/* Actions List */}
      <View style={styles.actionsContainer}>
        <Text style={styles.actionsTitle}>Nino Actions</Text>
        <FlatList
          data={ACTION_ITEMS}
          renderItem={renderActionItem}
          keyExtractor={(item, index) => index.toString()}
          numColumns={2}
          contentContainerStyle={styles.actionsList}
          scrollEnabled={true}
        />
      </View>

      {/* Disconnect Button */}
      <TouchableOpacity style={styles.disconnectButton} onPress={handleDisconnect}>
        <Text style={styles.disconnectButtonText}>Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#2a2a2a',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#aaa',
  },
  videoContainer: {
    width: '100%',
    height: height * 0.3,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderText: {
    color: '#666',
    fontSize: 18,
    marginBottom: 5,
  },
  videoPlaceholderSubtext: {
    color: '#444',
    fontSize: 12,
  },
  actionsContainer: {
    flex: 1,
    padding: 20,
  },
  actionsTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
  },
  actionsList: {
    paddingBottom: 20,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#4a9eff',
    padding: 20,
    margin: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#3a8eef',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  disconnectButton: {
    backgroundColor: '#ff4444',
    padding: 15,
    margin: 20,
    borderRadius: 10,
    alignItems: 'center',
  },
  disconnectButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
