import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function FirstTimeScreen() {
  const router = useRouter();

  const handleGotIt = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.content}>
        <Text style={styles.title}>Welcome!</Text>
        <Text style={styles.message}>
          This is your first time using the app. Here are some tips to get started:
        </Text>
        <View style={styles.tipsContainer}>
          <Text style={styles.tip}>• Scan for devices to find your robot</Text>
          <Text style={styles.tip}>• Tap on a device to connect</Text>
          <Text style={styles.tip}>• Use the controls to move your robot</Text>
          <Text style={styles.tip}>• Adjust speed with the slider</Text>
        </View>
        <TouchableOpacity style={styles.button} onPress={handleGotIt}>
          <Text style={styles.buttonText}>Got it!</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  message: {
    fontSize: 16,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 30,
  },
  tipsContainer: {
    width: '100%',
    marginBottom: 40,
  },
  tip: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 15,
    paddingLeft: 10,
  },
  button: {
    backgroundColor: '#4a9eff',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 25,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
