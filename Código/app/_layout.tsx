import { Stack } from 'expo-router';
import { onAuthStateChanged } from 'firebase/auth';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';
import { auth } from './servicos/firebaseConfig';
import { cores, theme } from './theme';

export default function RootLayout() {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, () => {
            setIsReady(true);
        });

        return () => unsubscribe();
    }, []);

    if (!isReady) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: cores.platinum }}>
                <ActivityIndicator size="large" color={cores.charcoal} />
            </View>
        );
    }

    return (
        <PaperProvider theme={theme}>
            <Stack>
                <Stack.Screen name="telasLogin" options={{ headerShown: false }} />
                <Stack.Screen name="telas" options={{ headerShown: false }} />
                <Stack.Screen name="index" options={{ headerShown: false }} />
            </Stack>
        </PaperProvider>
    );
}