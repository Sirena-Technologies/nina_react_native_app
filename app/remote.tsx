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
  { title: 'Action 1', message: 'action1', toast: 'Executing action1' },
  { title: 'Action 2', message: 'action2', toast: 'Executing action2' },
  { title: 'Action 3', message: 'action3', toast: 'Executing action3' },
  { title: 'Action 4', message: 'action4', toast: 'Executing action4' },
  { title: 'Action 5', message: 'action5', toast: 'Executing action5' },
  { title: 'Action 6', message: 'action6', toast: 'Executing action6' },
  { title: 'Action 7', message: 'action7', toast: 'Executing action7' },
];

export default function RemoteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const ip = params.ip as string;
  const deviceName = params.name as string;

  const [robot] = useState(new RobotCom());
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoStatus, setVideoStatus] = useState<string>('Connecting...');
  const [isVideoStreaming, setIsVideoStreaming] = useState<boolean>(false);
  const [tcpConnected, setTcpConnected] = useState<boolean>(false);
  const videoStreamRef = useRef<VideoStream | null>(null);
  const isConnectingRef = useRef<boolean>(false);
  const connectionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef<number>(0);
  const maxRetries = 3;
  const asyncCommandSentRef = useRef<boolean>(false); // Prevent multiple async command sends

  const connectToRobot = (retryAttempt: number = 0): void => {
    if (!ip) return;
    
    try {
      console.log(`[TCP] Attempting connection to ${ip} (attempt ${retryAttempt + 1}/${maxRetries + 1})...`);
      setVideoStatus(retryAttempt > 0 ? `Reconnecting... (${retryAttempt}/${maxRetries})` : 'Connecting...');
      setTcpConnected(false);
      asyncCommandSentRef.current = false; // Reset flag for new connection attempt
      
      // Close existing connection if any
      if (robot.mTcpClient) {
        robot.mTcpClient.stopClient();
      }
      
      robot.openTcp(ip);
      
      if (robot.mTcpClient) {
        // Wait for connection to be established
        connectionCheckIntervalRef.current = setInterval(() => {
          if (robot.mTcpClient && robot.mTcpClient.getIsConnected()) {
            // Connection successful!
            if (connectionCheckIntervalRef.current) {
              clearInterval(connectionCheckIntervalRef.current);
              connectionCheckIntervalRef.current = null;
            }
            if (connectionTimeoutRef.current) {
              clearTimeout(connectionTimeoutRef.current);
              connectionTimeoutRef.current = null;
            }
            
            // Only send async command once per connection
            if (!asyncCommandSentRef.current) {
              console.log('[TCP] ✓ Connection established successfully');
              setTcpConnected(true);
              setVideoStatus('Connected');
              retryCountRef.current = 0; // Reset retry count on success
              asyncCommandSentRef.current = true; // Mark as sent
              
              // Send async command registration when connection is established
              setTimeout(() => {
                robot.sendAsynchronousCommand();
              }, 200);
              
              // Request video connection after TCP is established
              setTimeout(() => {
                startVideoStream();
              }, 500);
            }
          }
        }, 200);

        // Timeout after 10 seconds (increased from 5)
        connectionTimeoutRef.current = setTimeout(() => {
          if (connectionCheckIntervalRef.current) {
            clearInterval(connectionCheckIntervalRef.current);
            connectionCheckIntervalRef.current = null;
          }
          
          if (robot.mTcpClient && !robot.mTcpClient.getIsConnected()) {
            console.warn(`[TCP] Connection timeout (attempt ${retryAttempt + 1})`);
            
            if (retryAttempt < maxRetries) {
              // Retry with exponential backoff
              const delay = Math.min(1000 * Math.pow(2, retryAttempt), 5000); // Max 5 seconds
              console.log(`[TCP] Retrying in ${delay}ms...`);
              setVideoStatus(`Connection timeout. Retrying in ${Math.round(delay / 1000)}s...`);
              
              setTimeout(() => {
                connectToRobot(retryAttempt + 1);
              }, delay);
            } else {
              // Max retries reached
              console.error('[TCP] Max retries reached. Connection failed.');
              setVideoStatus('Connection failed. Tap to retry.');
              setTcpConnected(false);
            }
          }
        }, 10000); // 10 second timeout
      } else {
        console.warn('[TCP] TCP client not initialized. Native module may not be linked.');
        setVideoStatus('TCP not available');
        setTcpConnected(false);
      }
    } catch (error) {
      console.error('[TCP] Error opening TCP connection:', error);
      setVideoStatus('Connection error. Tap to retry.');
      setTcpConnected(false);
      
      // Retry if we haven't exceeded max retries
      if (retryAttempt < maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryAttempt), 5000);
        setTimeout(() => {
          connectToRobot(retryAttempt + 1);
        }, delay);
      }
    }
  };

  useEffect(() => {
    if (ip) {
      connectToRobot(0);
    }

    return () => {
      // Cleanup on unmount
      if (connectionCheckIntervalRef.current) {
        clearInterval(connectionCheckIntervalRef.current);
        connectionCheckIntervalRef.current = null;
      }
      if (connectionTimeoutRef.current) {
        clearTimeout(connectionTimeoutRef.current);
        connectionTimeoutRef.current = null;
      }
      if (videoStreamRef.current) {
        videoStreamRef.current.stopStreaming();
        videoStreamRef.current = null;
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
        setIsVideoStreaming(true);
      });

      setVideoStatus('Streaming');
      setIsVideoStreaming(true);
    } catch (error) {
      console.error('Error starting video stream:', error);
      setVideoStatus('Stream error - check console');
    } finally {
      isConnectingRef.current = false;
    }
  };

  const handleActionPress = (index: number) => {
    const action = ACTION_ITEMS[index];
    
    console.log(`[ACTION] User pressed: ${action.title} (${action.message})`);

    // Check if TCP client is available and connected
    if (!robot.mTcpClient) {
      console.error('[ACTION] TCP client not available');
      Alert.alert(
        'Connection Error',
        'TCP client not available. Cannot send command.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry Connection', onPress: () => connectToRobot(0) }
        ]
      );
      return;
    }

    const isConnected = robot.mTcpClient.getIsConnected();
    const connectionReady = robot.mTcpClient.getIsConnected() && tcpConnected;
    
    console.log(`[ACTION] TCP connection state check:`);
    console.log(`[ACTION]   - mTcpClient exists: ${!!robot.mTcpClient}`);
    console.log(`[ACTION]   - getIsConnected(): ${isConnected}`);
    console.log(`[ACTION]   - tcpConnected state: ${tcpConnected}`);
    console.log(`[ACTION]   - connectionReady: ${connectionReady}`);

    if (!isConnected) {
      console.error('[ACTION] ✗ TCP connection not ready (getIsConnected() returned false)');
      Alert.alert(
        'Connection Not Ready',
        'TCP connection is not ready. Would you like to retry the connection?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Retry', onPress: () => connectToRobot(0) }
        ]
      );
      return;
    }

    if (!tcpConnected) {
      console.warn('[ACTION] ⚠ tcpConnected state is false, but getIsConnected() is true. Proceeding anyway...');
      // Don't block - connection might be ready even if state isn't updated
    }

    // Send LUCI command 245 with action message
    // Robot logs show CommandType=2 is expected (not 0): "CommandType =2 Command=245"
    // sendAsynchronousCommand() is already called inside sendLUCICommand() before sending the command
    console.log(`[ACTION] ✓ Connection verified. Sending command 245 for action: "${action.message}"`);
    
    try {
      // Send command immediately - don't block with Alert
      // Use mode=2 (CommandType=2) as shown in robot logs
      robot.sendLUCICommand(245, action.message, 2);
      console.log(`[ACTION] ✓ sendLUCICommand() called successfully`);
      
      // Show toast message after sending (non-blocking)
      setTimeout(() => {
        Alert.alert('Action', action.toast, [{ text: 'OK' }]);
      }, 100);
    } catch (error) {
      console.error('[ACTION] ✗ Error calling sendLUCICommand():', error);
      Alert.alert('Error', `Failed to send command: ${error instanceof Error ? error.message : String(error)}`);
    }
  };


  const stopVideoStream = () => {
    if (videoStreamRef.current) {
      videoStreamRef.current.stopStreaming();
      videoStreamRef.current = null;
      setVideoUri(null);
      setIsVideoStreaming(false);
      setVideoStatus('Disconnected');
      console.log('Video stream stopped');
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect', 'Are you sure you want to disconnect?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        onPress: () => {
          // Stop video stream first
          stopVideoStream();
          
          // Then disconnect TCP
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
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>{deviceName || 'Robot Control'}</Text>
          <View style={[styles.connectionIndicator, tcpConnected ? styles.connected : styles.disconnected]}>
            <Text style={styles.connectionIndicatorText}>
              {tcpConnected ? '●' : '○'}
            </Text>
          </View>
        </View>
        <Text style={styles.headerSubtitle}>IP: {ip} {tcpConnected ? '• Connected' : '• Connecting...'}</Text>
      </View>
      
      {/* Video Display Area */}
      <View style={styles.videoContainer}>
        {videoUri ? (
          <View style={styles.videoWrapper}>
            <Image 
              source={{ uri: videoUri }} 
              style={styles.video} 
              contentFit="contain"
              transition={100}
            />
            {isVideoStreaming && (
              <TouchableOpacity 
                style={styles.videoDisconnectButton}
                onPress={stopVideoStream}
              >
                <Text style={styles.videoDisconnectButtonText}>Stop Video</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <View style={styles.videoPlaceholder}>
            <Text style={styles.videoPlaceholderText}>{videoStatus}</Text>
            <Text style={styles.videoPlaceholderSubtext}>
              {videoStatus === 'Connecting...' || videoStatus.startsWith('Reconnecting') 
                ? 'Please wait...' 
                : videoStatus.includes('timeout') || videoStatus.includes('failed') || videoStatus.includes('error')
                ? 'Tap to retry connection'
                : 'Video stream will appear here'}
            </Text>
            {(videoStatus === 'Disconnected' || 
              videoStatus.includes('timeout') || 
              videoStatus.includes('failed') || 
              videoStatus.includes('error') ||
              videoStatus.includes('Tap to retry')) && (
              <TouchableOpacity 
                style={styles.reconnectVideoButton}
                onPress={() => {
                  if (videoStatus.includes('TCP') || videoStatus.includes('Connection')) {
                    connectToRobot(0);
                  } else {
                    startVideoStream();
                  }
                }}
              >
                <Text style={styles.reconnectVideoButtonText}>
                  {videoStatus.includes('TCP') || videoStatus.includes('Connection') 
                    ? 'Retry Connection' 
                    : 'Reconnect Video'}
                </Text>
              </TouchableOpacity>
            )}
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
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
  },
  connectionIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connected: {
    backgroundColor: '#4caf50',
  },
  disconnected: {
    backgroundColor: '#ff9800',
  },
  connectionIndicatorText: {
    fontSize: 8,
    color: '#fff',
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
  videoWrapper: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  videoDisconnectButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(255, 68, 68, 0.8)',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    zIndex: 10,
  },
  videoDisconnectButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  reconnectVideoButton: {
    marginTop: 15,
    backgroundColor: '#4a9eff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  reconnectVideoButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
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
