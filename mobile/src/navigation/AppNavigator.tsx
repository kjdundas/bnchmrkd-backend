// ═══════════════════════════════════════════════════════════════════════════
// APP NAVIGATOR — Auth-gated, role-based navigation with theme support
// Logged out  → Login screen
// Athlete     → Home, Programs, [+ Log FAB], Trajectory  (Profile via header avatar)
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

/** The raised centre action button. Overhangs the bar like the web FAB. */
function LogTabButton({ onPress, accessibilityState }: any) {
  const { colors } = useTheme()
  const focused = !!accessibilityState?.selected
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-start' }}>
      <Pressable
        onPress={(e) => { tapFeedback(); onPress?.(e) }}
        accessibilityRole="button"
        accessibilityLabel="Log a result or test"
        style={{
          width: 56, height: 56, borderRadius: 28, marginTop: -20,
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.accent[500],
          shadowColor: colors.accent[500],
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.35, shadowRadius: 12, elevation: 8,
          opacity: focused ? 0.9 : 1,
        }}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </Pressable>
      <Text style={{
        fontSize: 10, letterSpacing: 1.5, fontWeight: '600', marginTop: 6,
        color: focused ? colors.tabBar.active : colors.tabBar.inactive,
      }}>LOG</Text>
    </View>
  )
}

function AthleteTabs() {
  const { colors } = useTheme()
  const tabBarOptions = useMemo(() => ({
    headerShown: false,
    tabBarStyle: {
      backgroundColor: colors.tabBar.bg,
      borderTopColor: colors.tabBar.border,
      borderTopWidth: 1,
      height: Platform.OS === 'ios' ? 88 : 74,
      paddingBottom: Platform.OS === 'ios' ? 26 : 12,
      paddingTop: 10,
      elevation: 0,
    },
    tabBarActiveTintColor: colors.tabBar.active,
    tabBarInactiveTintColor: colors.tabBar.inactive,
    tabBarLabelStyle: {
      fontSize: 10,
      letterSpacing: 1.5,
      fontWeight: '600' as const,
      marginTop: 4,
    },
  }), [colors])

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...tabBarOptions,
        tabBarIcon: ({ color, size, focused }) => {
          let iconName: string = 'home-outline'
          if (route.name === 'Home') iconName = focused ? 'home' : 'home-outline'
          else if (route.name === 'Programs') iconName = focused ? 'barbell' : 'barbell-outline'
          else if (route.name === 'Trajectory') iconName = focused ? 'trending-up' : 'trending-up-outline'
          return <Ionicons name={iconName as any} size={size} color={color} />
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'HOME' }} />
      <Tab.Screen name="Programs" component={ProgramsScreen} options={{ tabBarLabel: 'PROGRAMS' }} />
      <Tab.Screen
        name="Log"
        component={LogScreen}
        options={{ tabBarButton: (props) => <LogTabButton {...props} /> }}
      />
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
