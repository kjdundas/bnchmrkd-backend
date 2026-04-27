// ═══════════════════════════════════════════════════════════════════════════
// APP NAVIGATOR — Auth-gated, role-based navigation
// Logged out  → Login screen
// Athlete     → Home, Log, Trajectory, Profile
// Coach       → Roster, Results, Analyse, Profile
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react'
import { Platform } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { colors, spacing } from '../lib/theme'

// Athlete screens
import LoginScreen from '../screens/LoginScreen'
import HomeScreen from '../screens/HomeScreen'
import LogScreen from '../screens/LogScreen'
import TrajectoryScreen from '../screens/TrajectoryScreen'
import ProfileScreen from '../screens/ProfileScreen'
import SplashScreen from '../components/SplashScreen'

// Coach screens
import CoachRosterScreen from '../screens/CoachRosterScreen'
import CoachResultsScreen from '../screens/CoachResultsScreen'
import CoachAnalyseScreen from '../screens/CoachAnalyseScreen'
import AthleteDetailScreen from '../screens/AthleteDetailScreen'

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

// Shared tab bar options
const tabBarOptions = {
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
    fontWeight: '600' as const,
    marginTop: 2,
  },
}

// ── Athlete Tab Navigator ───────────────────────────────────────────────────
function AthleteTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...tabBarOptions,
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
      <Tab.Screen name="Log" component={LogScreen} options={{ tabBarLabel: 'Log' }} />
      <Tab.Screen name="Trajectory" component={TrajectoryScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  )
}

// ── Coach Tab Navigator ─────────────────────────────────────────────────────
function CoachTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...tabBarOptions,
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: string = 'people-outline'
          if (route.name === 'Roster') iconName = focused ? 'people' : 'people-outline'
          else if (route.name === 'Results') iconName = focused ? 'document-text' : 'document-text-outline'
          else if (route.name === 'Analyse') iconName = focused ? 'flash' : 'flash-outline'
          else if (route.name === 'CoachProfile') iconName = focused ? 'person' : 'person-outline'
          return <Ionicons name={iconName as any} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Roster" component={CoachRosterScreen} />
      <Tab.Screen name="Results" component={CoachResultsScreen} />
      <Tab.Screen name="Analyse" component={CoachAnalyseScreen} />
      <Tab.Screen
        name="CoachProfile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </Tab.Navigator>
  )
}

// ── Main App Navigator ──────────────────────────────────────────────────────
export default function AppNavigator() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return <SplashScreen />
  }

  const isCoach = profile?.role === 'coach' || (profile as any)?.account_type === 'coach'

  return (
    <NavigationContainer theme={DarkTheme}>
      {session ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="MainTabs"
            component={isCoach ? CoachTabs : AthleteTabs}
          />
          {/* Shared push screens */}
          <Stack.Screen name="AthleteDetail" component={AthleteDetailScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  )
}
