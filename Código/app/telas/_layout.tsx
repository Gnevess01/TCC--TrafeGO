import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { auth, db } from '../servicos/firebaseConfig';
import { cores } from '../theme';

export default function TelasLayout() {
    const [loading, setLoading] = useState(true);
    const [cargo, setCargo] = useState<string>('');

    useEffect(() => {
        const checkUser = async () => {
            const user = auth.currentUser;
            if (!user) {
                setLoading(false);
                return;
            }

            const userDoc = await getDoc(doc(db, 'usuarios', user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setCargo(userData.cargo || '');
            }
            setLoading(false);
        };

        checkUser();
    }, []);

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: cores.platinum }}>
                <ActivityIndicator size="large" color={cores.charcoal} />
            </View>
        );
    }

    
    const isSuperAdmin = cargo === 'superadmin';
    const podeVerNotas = cargo === 'motorista' || cargo === 'gerente' || cargo === 'superadmin';
    const podeVerRelatorios = cargo === 'gerente' || cargo === 'superadmin'; 

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: cores.charcoal,
                tabBarInactiveTintColor: cores.silver,
                tabBarStyle: {
                    backgroundColor: cores.white,
                    borderTopWidth: 0,
                    elevation: 8,
                    height: 60,
                    paddingBottom: 8,
                },
                tabBarLabelStyle: {
                    fontSize: 15,
                    fontWeight: '500',
                },
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Início',
                    tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />
                }}
            />
            <Tabs.Screen
                name="notas"
                options={{
                    title: 'Notas',
                    href: podeVerNotas ? undefined : null,
                    tabBarIcon: ({ color, size }) => <Ionicons name="receipt" size={size} color={color} />
                }}
            />
            <Tabs.Screen
                name="despesas"
                options={{
                    title: 'Despesas',
                    tabBarIcon: ({ color, size }) => <Ionicons name="cash" size={size} color={color} />
                }}
            />
            <Tabs.Screen
                name="devolucao"
                options={{
                    title: 'Devoluções',
                    tabBarIcon: ({ color, size }) => <Ionicons name="return-up-back" size={size} color={color} />
                }}
            />
            <Tabs.Screen
                name="placas"
                options={{
                    title: 'Placas',
                    tabBarIcon: ({ color, size }) => <Ionicons name="car" size={size} color={color} />
                }}
            />
            <Tabs.Screen
                name="relatorios"
                options={{
                    title: 'Relatórios',
                    href: podeVerRelatorios ? undefined : null,
                    tabBarIcon: ({ color, size }) => <Ionicons name="document" size={size} color={color} />
                }}
            />
            <Tabs.Screen
                name="sobre"
                options={{
                    title: 'Sobre',
                    href: null,
                    tabBarIcon: ({ color, size }) => <Ionicons name="information-circle" size={size} color={color} />
                }}
            />
            <Tabs.Screen
                name="superadmin"
                options={{
                    title: 'Aprovações',
                    href: isSuperAdmin ? undefined : null,
                    tabBarIcon: ({ color, size }) => <Ionicons name="shield-checkmark" size={size} color={color} />
                }}
            />
        </Tabs>
    );
}