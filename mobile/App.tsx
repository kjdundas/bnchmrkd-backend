import React from 'react'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider } from './src/contexts/AuthContext'
import { ThemeProvider, useTheme } from './src/contexts/ThemeContext'
import AppNavigator from './src/navigation/AppNavigator'

function ThemedApp() {
  const { colors } = useTheme()
  return (
    <>
      <StatusBar style={colors.statusBar === 'light' ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  )
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <ThemedApp />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  )
}
