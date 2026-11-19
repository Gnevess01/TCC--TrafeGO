import { Stack } from 'expo-router';
//codacy acorde pelo amor de Deus
export default function TelasLoginLayout() {
    return (
        <Stack>
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="cadastro" options={{ headerShown: false }} />
            <Stack.Screen name="esqueci-senha" options={{ headerShown: false }} />
        </Stack>
    );
}
