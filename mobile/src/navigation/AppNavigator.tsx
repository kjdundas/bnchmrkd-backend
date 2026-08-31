// ═══════════════════════════════════════════════════════════════════════════
// APP NAVIGATOR — Auth-gated, role-based navigation with theme support
// Logged out  → Login screen
// Athlete     → (+) Log on the left · Home / Programs / Trajectory in a
//               floating pill on the right   (Profile via header avatar)
// Coach       → Roster, Results, Analyse, Profile
// ═══════════════════════════════════════════════════════════════════════════

import React, { useMemo } from 'react'
import { Platform, View, Text, Pressable } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { Ionicons } from '@expo/vector-icons'
import { useAuth } from '../contexts/AuthContext'
import { useTheme } from '../contexts/ThemeContext'
import { spacing } from '../lib/theme'
import { tapFeedback } from '../lib/haptics'
import FloatingTabBar from './FloatingTabBar'

// Athlete screens
import LoginScreen from '../screens/LoginScreen'
import HomeScreen from '../screens/HomeScreen'
import LogScreen from '../screens/LogScreen'
import TrajectoryScreen from '../screens/TrajectoryScreen'
import ProfileScreen from '../screens/ProfileScreen'
import ProgramsScreen from '../screens/ProgramsScreen'
import SplashScreen from '../components/SplashScreen'

// Coach screens
import CoachHomeScreen from '../screens/CoachHomeScreen'
import CoachRosterScreen from '../screens/CoachRosterScreen'
import CoachResultsScreen from '../screens/CoachResultsScreen'
import CoachAnalyseScreen from '../screens/CoachAnalyseScreen'
import AthleteDetailScreen from '../screens/AthleteDetailScreen'

const Tab = createBottomTabNavigator()
const Stack = createNativeStackNavigator()

// ── Athlete Tab Navigator ───────────────────────────────────────────────────
// Matches the web bottom nav: HOME · PROGRAMS · (+) LOG · TRAJECTORY.
// Profile is deliberately NOT a tab — it lives behind the header avatar, the
// same as on web, which is what frees the fourth slot for Programs.

function AthleteTabs() {
  return (
    <Tab.Navigator
      // A custom bar, so none of the tabBarStyle / tint options apply — the
      // component owns its own appearance. `tabBarLabel` is still read, for
      // the pill's labels and for VoiceOver.
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'HOME' }} />
      <Tab.Screen name="Programs" component={ProgramsScreen} options={{ tabBarLabel: 'PROGRAMS' }} />
      <Tab.Screen name="Log" component={LogScreen} options={{ tabBarLabel: 'LOG' }} />
      <Tab.Screen name="Trajectory" component={TrajectoryScreen} options={{ tabBarLabel: 'TRAJECTORY' }} />
    </Tab.Navigator>
  )
}

// ── Coach Tab Navigator ─────────────────────────────────────────────────────
function CoachTabs() {
  const { colors } = useTheme()
  const tabBarOptions = useMemo(() => ({
    headerShown: false,
    tabBarStyle: {
      backgroundColor: colors.tabBar.bg,
      borderTopColor: colors.tabBar.border,
      borderTopWidth: 1,
      height: Platform.OS === 'ios' ? 85 : 70,
      paddingBottom: Platform.OS === 'ios' ? 24 : 10,
      paddingTop: 8,
      elevation: 0,
    },
    tabBarActiveTintColor: colors.tabBar.active,
    tabBarInactiveTintColor: colors.tabBar.inactive,
    tabBarLabelStyle: {
      fontSize: 10,
      letterSpacing: 0.5,
      fontWeight: '600' as const,
      marginTop: 2,
    },
  }), [colors])

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...tabBarOptions,
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: string = 'home-outline'
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline'
          else if (route.name === 'Squad') iconName = focused ? 'people' : 'people-outline'
          else if (route.name === 'Analyse') iconName = focused ? 'flash' : 'flash-outline'
          else if (route.name === 'CoachProfile') iconName = focused ? 'person' : 'person-outline'
          return <Ionicons name={iconName as any} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Home" component={CoachHomeScreen} />
      <Tab.Screen name="Squad" component={CoachRosterScreen} />
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
  const { colors, isDark } = useTheme()

  const navTheme = useMemo(() => ({
    dark: isDark,
    colors: {
      primary: colors.orange[500],
      background: colors.bg.primary,
      card: colors.bg.secondary,
      text: colors.text.primary,
      border: colors.glass.border,
      notification: colors.orange[500],
    },
    fonts: {
      regular: { fontFamily: 'System', fontWeight: '400' as const },
      medium: { fontFamily: 'System', fontWeight: '500' as const },
      bold: { fontFamily: 'System', fontWeight: '700' as const },
      heavy: { fontFamily: 'System', fontWeight: '900' as const },
    },
  }), [colors, isDark])

  if (loading) {
    return <SplashScreen />
  }

  const isCoach = profile?.role === 'coach' || (profile as any)?.account_type === 'coach'

  return (
    <NavigationContainer theme={navTheme}>
      {session ? (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen
            name="MainTabs"
            component={isCoach ? CoachTabs : AthleteTabs}
          />
          {/* Shared push screens */}
          <Stack.Screen name="Profile" component={ProfileScreen} />
          <Stack.Screen name="AthleteDetail" component={AthleteDetailScreen} />
          <Stack.Screen name="CoachResults" component={CoachResultsScreen} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  )
}
