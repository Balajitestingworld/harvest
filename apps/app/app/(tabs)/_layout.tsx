import { Tabs } from 'expo-router';
import { Text } from 'react-native';

const label = (text: string) =>
  function TabLabel({ focused }: { focused: boolean }) {
    return (
      <Text
        style={{
          fontFamily: focused ? 'BricolageGrotesque_600SemiBold' : 'BricolageGrotesque_500Medium',
          color: focused ? '#1F2559' : '#5B6177',
          fontSize: 14,
        }}
      >
        {text}
      </Text>
    );
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarStyle: { backgroundColor: '#FFFFFF', borderTopColor: '#DADDEA', height: 64 },
        tabBarItemStyle: { justifyContent: 'center' },
        sceneStyle: { backgroundColor: '#F5F6FA' },
      }}
    >
      <Tabs.Screen name="search" options={{ title: 'Search', tabBarLabel: label('Search') }} />
      <Tabs.Screen name="watch" options={{ title: 'Watch', tabBarLabel: label('Watch') }} />
      <Tabs.Screen name="cards" options={{ title: 'My cards', tabBarLabel: label('My cards') }} />
    </Tabs>
  );
}
