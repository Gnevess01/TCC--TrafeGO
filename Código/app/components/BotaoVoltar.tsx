import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import React from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { auth } from '../servicos/firebaseConfig';
import { cores } from '../theme';

interface BotaoVoltarProps {
    cor?: string;
    tamanho?: number;
    aoPressionar?: () => void;
}

export const BotaoVoltar = ({ cor = cores.white, tamanho = 24, aoPressionar }: BotaoVoltarProps) => {
    const handlePress = async () => {
        if (aoPressionar) {
            aoPressionar();
        } else {
            try {
                if (router.canGoBack()) {
                    router.back();
                } else { 
                    await signOut(auth);
                    router.replace('/telasLogin/login');
                }
            } catch (e) {                
                await signOut(auth);
                router.replace('/telasLogin/login');
            }
        }
    };
    return (
        <TouchableOpacity onPress={handlePress} style={styles.botao}>
            <Ionicons name="chevron-back" size={tamanho} color={cor} />
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    botao: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
});

export default BotaoVoltar;