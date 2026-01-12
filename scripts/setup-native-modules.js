#!/usr/bin/env node

/**
 * Setup script for native modules (UDP and TCP)
 * This script runs expo prebuild to generate native code for react-native-udp and react-native-tcp-socket
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up native modules for UDP and TCP...\n');

try {
  // Check if we're in an Expo project
  if (!fs.existsSync(path.join(process.cwd(), 'app.json')) && !fs.existsSync(path.join(process.cwd(), 'app.config.js'))) {
    console.error('❌ Error: This does not appear to be an Expo project.');
    process.exit(1);
  }

  console.log('📦 Running expo prebuild to generate native code...\n');
  
  // Run expo prebuild with clean flag to regenerate native code
  execSync('npx expo prebuild --clean', {
    stdio: 'inherit',
    cwd: process.cwd()
  });

  console.log('\n✅ Native modules setup complete!');
  console.log('\n📝 Next steps:');
  console.log('   1. For Android: npm run android');
  console.log('   2. For iOS: npm run ios');
  console.log('   3. Make sure you have Android Studio / Xcode installed');
  console.log('\n⚠️  Note: You cannot use Expo Go with native modules.');
  console.log('   You must use a development build or production build.\n');

} catch (error) {
  console.error('\n❌ Error setting up native modules:', error.message);
  console.log('\n💡 Manual setup:');
  console.log('   1. Run: npx expo prebuild --clean');
  console.log('   2. Then: npm run android (or npm run ios)');
  process.exit(1);
}
