// ═══════════════════════════════════════════════════════════════════════
// APP NAVIGATOR — Auth-gated navigation with bottom tabs
// Logged out → Login screen
// Logged in  → Main tabs (Home, Log, Trajectory, Profile)
// Coach role → Extra "Squad" tab (future)
// ═══════════════════════════════════════════════════════════════════════

import React from 'react'
import { Platform } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { colors, spacing } from '../lib/theme'

// Screens
import LoginScreen from '../screens/LoginScreen'
import HomeScreen from '../screens/HomeScreen'
import LogScreen from '../screens/LogScreen'
import TrajectoryScreen from '../screens/TrajectoryScreen'
import ProfileScreen from '../screens/ProfileScreen'
import SplashScreen from '../components/SplashScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

// Dark theme for NavigationContainer
const DarkTheme = {
  dark: true,
  colors: {
    primary: colors.orange[500],
    background: colors.bg.primary,
    card: colors.bg.secondary,
    text: colors.text.primary,
    border: 'rgba(255,255,255,0.06)',
    notification: colors.orange[500],
  },
  fonts: {
    regular: { fontFamily: 'System', fontWeight: '400' as const },
    medium: { fontFamily: 'System', fontWeight: '500' as const },
    bold: { fontFamily: 'System', fontWeight: '700' as const },
    heavy: { fontFamily: 'System', fontWeight: '900' as const },
  },
}

function MainTabs() {
  const { profile } = useAuth()

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg.secondary,
          borderTopColor: 'rgba(255,255,255,0.06)',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 85 : 70,
          paddingBottom: Platform.OS === 'ios' ? 24 : 10,
          paddingTop: 8,
          elevation: 0,
        },
        tabBarActiveTintColor: colors.orange[500],
        tabBarInactiveTintColor: colors.text.dimmed,
        tabBarLabelStyle: {
          fontSize: 10,
          letterSpacing: 0.5,
          fontWeight: '600',
          marginTop: 2,
        },
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: string = 'home-outline'
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline'
          else if (route.name === 'Log') iconName = focused ? 'add-circle' : 'add-circle-outline'
          else if (route.name === 'Trajectory') iconName = focused ? 'trending-up' : 'trending-up-outline'
          else if (route.name === 'Profile') iconName = focused ? 'person' : 'person-outline'
          return <Ionicons name={iconName as any} size={route.name === 'Log' ? size + 4 : size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Log"
        component={LogScreen}
        options={{ tabBarLabel: 'Log' }}
      />
      <Tab.Screen name="Trajectory" component={TrajectoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

export default function AppNavigator() {
  const { session, loading } = useAuth()

  if (loading) {
    return <SplashScreen />
  }

  return (
    <NavigationContainer theme={DarkTheme}>
      {session ? (
        <MainTabs />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  )
}
