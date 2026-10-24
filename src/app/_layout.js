import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Toast } from '../../components/ui';
import { NotchProvider, useNotch } from '../../state/notch';
import { BG } from '../../theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <NotchProvider>
        <View style={{ flex: 1, backgroundColor: BG }}>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: BG },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Notch' }} />
            <Stack.Screen name="focus" options={{ animation: 'fade', gestureEnabled: false }} />
            <Stack.Screen name="plan" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="welcome" options={{ animation: 'fade', gestureEnabled: false }} />
          </Stack>
          <AppToast />
        </View>
      </NotchProvider>
    </SafeAreaProvider>
  );
}

function AppToast() {
  const { toast, undo } = useNotch();
  return <Toast toast={toast} onUndo={() => toast?.undo && undo(toast.undo.date, toast.undo.id)} />;
}
