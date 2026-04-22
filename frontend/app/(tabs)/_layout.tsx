import { Tabs } from 'expo-router';
import { Platform, Text, View, StyleSheet } from 'react-native';

function TabIcon({ emoji, label, focused }: { emoji: string; label: string; focused: boolean }) {
  return (
    <View style={tabIconStyles.container}>
      <Text style={tabIconStyles.emoji}>{emoji}</Text>
    </View>
  );
}

const tabIconStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20 },
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#7C62FF',
        tabBarInactiveTintColor: 'rgba(73,74,100,0.5)',
        tabBarStyle: Platform.OS === 'web'
          ? ({
              backgroundColor: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderTopColor: 'rgba(200,200,220,0.3)',
              borderTopWidth: 1,
              height: 56,
            } as any)
          : {
              backgroundColor: '#fff',
              borderTopColor: 'rgba(200,200,220,0.3)',
              height: 56,
            },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 4,
        },
        headerStyle: Platform.OS === 'web'
          ? ({
              backgroundColor: 'rgba(255,255,255,0.85)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 1px 0 rgba(200,200,220,0.3)',
            } as any)
          : { backgroundColor: '#fff' },
        headerTintColor: '#494A64',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          color: '#494A64',
        },
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="chat"
        options={{
          title: 'Chat',
          tabBarIcon: ({ focused }) => <TabIcon emoji="💬" label="Chat" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: 'App Gallery',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🗂️" label="Gallery" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
