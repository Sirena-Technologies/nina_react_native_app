import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { NetworkDiscovery, DiscoveredDevice } from '@/utils/NetworkDiscovery';

export default function DeviceListScreen() {
  const router = useRouter();
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [isScanning, setIsScanning] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const discovery = new NetworkDiscovery();

  const scanForDevices = useCallback(async () => {
    setIsScanning(true);
    setError(null);
    try {
      const discoveredDevices = await discovery.discoverDevices(2000);
      setDevices(discoveredDevices);
      if (discoveredDevices.length === 0) {
        setError('No devices found. Make sure UDP native module is properly linked.');
      }
    } catch (error: any) {
      console.error('Error scanning for devices:', error);
      setError(error?.message || 'Failed to scan for devices. UDP library may not be available.');
    } finally {
      setIsScanning(false);
    }
  }, []);

  useEffect(() => {
    scanForDevices();
    return () => {
      discovery.stopDiscovery();
    };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await scanForDevices();
    setRefreshing(false);
  }, [scanForDevices]);

  const handleDevicePress = (device: DiscoveredDevice) => {
    router.push({
      pathname: '/remote',
      params: { ip: device.ip, name: device.name },
    });
  };

  const handleManualConnect = () => {
    if (manualIp.trim()) {
      router.push({
        pathname: '/remote',
        params: { ip: manualIp.trim(), name: 'Manual Device' },
      });
      setShowManualEntry(false);
      setManualIp('');
    } else {
      Alert.alert('Invalid IP', 'Please enter a valid IP address');
    }
  };

  const handleBackPress = () => {
    Alert.alert('Leave Application?', 'Are you sure you want to leave the application?', [
      { text: 'No', style: 'cancel' },
      { text: 'Yes', onPress: () => router.back() },
    ]);
  };

  const renderDeviceItem = ({ item }: { item: DiscoveredDevice }) => (
    <TouchableOpacity
      style={styles.deviceItem}
      onPress={() => handleDevicePress(item)}
    >
      <Text style={styles.deviceName}>{item.name}</Text>
      <Text style={styles.deviceIp}>IP: {item.ip}</Text>
      <Text style={styles.deviceMac}>
        MAC: {item.macAddress || 'N/A'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.title}>
          {isScanning ? 'Scanning for devices...' : devices.length > 0 ? 'Available Devices' : 'No Devices Found'}
        </Text>
      </View>

      {isScanning ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#fff" />
          <Text style={styles.scanningText}>Scanning for devices...</Text>
        </View>
      ) : (
        <>
          {error && (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{error}</Text>
              <Text style={styles.errorSubtext}>
                Note: UDP discovery requires native modules. Run 'npx expo prebuild' if using Expo.
              </Text>
            </View>
          )}
          <FlatList
            data={devices}
            renderItem={renderDeviceItem}
            keyExtractor={(item) => item.ip}
            contentContainerStyle={styles.listContainer}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>No devices found</Text>
                <Text style={styles.emptySubtext}>Pull down to refresh</Text>
                {error && (
                  <Text style={styles.emptySubtext}>
                    {error}
                  </Text>
                )}
              </View>
            }
          />
          {/* Manual IP Entry Button */}
          <TouchableOpacity
            style={styles.manualButton}
            onPress={() => setShowManualEntry(true)}
          >
            <Text style={styles.manualButtonText}>Enter IP Manually</Text>
          </TouchableOpacity>
        </>
      )}

      {/* Manual IP Entry Modal */}
      <Modal
        visible={showManualEntry}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowManualEntry(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Enter Device IP</Text>
            <TextInput
              style={styles.ipInput}
              placeholder="192.168.1.100"
              placeholderTextColor="#999"
              value={manualIp}
              onChangeText={setManualIp}
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowManualEntry(false);
                  setManualIp('');
                }}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.connectButton]}
                onPress={handleManualConnect}
              >
                <Text style={styles.modalButtonText}>Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanningText: {
    marginTop: 20,
    color: '#fff',
    fontSize: 16,
  },
  listContainer: {
    padding: 10,
  },
  deviceItem: {
    backgroundColor: '#2a2a2a',
    padding: 20,
    marginVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#333',
  },
  deviceName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 5,
  },
  deviceIp: {
    fontSize: 14,
    color: '#aaa',
    marginTop: 2,
  },
  deviceMac: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 10,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#aaa',
  },
  errorContainer: {
    backgroundColor: '#ff4444',
    padding: 15,
    margin: 10,
    borderRadius: 10,
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  errorSubtext: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
  },
  manualButton: {
    backgroundColor: '#4a9eff',
    padding: 15,
    margin: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  manualButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  modalContent: {
    backgroundColor: '#2a2a2a',
    padding: 20,
    borderRadius: 10,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  ipInput: {
    backgroundColor: '#1a1a1a',
    color: '#fff',
    padding: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#333',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: '#666',
  },
  connectButton: {
    backgroundColor: '#4a9eff',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
