import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { sendPasswordResetEmail } from 'firebase/auth';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text, TextInput } from 'react-native-paper';
import { auth } from '..//servicos/firebaseConfig';
import { cores } from '../theme';

export default function TelaEsqueciSenha() {
    const [email, setEmail] = useState('');
    const [estaCarregando, setEstaCarregando] = useState(false);

    const resetarSenha = async () => {
        if (!email) {
            
            return;
        }

        setEstaCarregando(true);
        try {
            await sendPasswordResetEmail(auth, email);
            router.replace('/telasLogin/login');
        } finally {
            setEstaCarregando(false);
        }
    };

    return (
        <View style={estilos.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={estilos.conteudo}>
                <TouchableOpacity onPress={() => router.back()} style={estilos.botaoVoltar}>
                    <Ionicons name="arrow-back" size={24} color={cores.charcoal} />
                </TouchableOpacity>

                <View style={estilos.formulario}>
                    <Ionicons name="mail" size={48} color={cores.grey} style={estilos.icone} />
                    <Text style={estilos.titulo}>Recuperar Senha</Text>

                    <View style={estilos.containerDigitacao}>
                        <Ionicons name="mail-outline" size={20} color={cores.grey} />
                        <TextInput
                            mode="flat"
                            placeholder="E-mail"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            style={estilos.campo}
                            underlineColor="transparent"
                            activeUnderlineColor={cores.charcoal}
                            textColor={cores.charcoal}
                            placeholderTextColor={cores.silver}
                        />
                    </View>

                    <TouchableOpacity
                        style={estilos.botao}
                        onPress={resetarSenha}
                        disabled={estaCarregando}
                    >
                        <LinearGradient
                            colors={[cores.charcoal, cores.grey]}
                            style={estilos.fundoBotao}
                        >
                            {estaCarregando ? (
                                <ActivityIndicator color={cores.white} />
                            ) : (
                                <Text style={estilos.textoBotao}>ENVIAR LINK</Text>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push('/telasLogin/login')}>
                        <Text style={estilos.link}>Voltar para Login</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </View>
    );
}

const estilos = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: cores.platinum,
    },
    conteudo: {
        flex: 1,
        justifyContent: 'center',
        padding: 24,
    },
    botaoVoltar: {
        position: 'absolute',
        top: 48,
        left: 24,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: cores.white,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        shadowColor: cores.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    formulario: {
        backgroundColor: cores.white,
        borderRadius: 24,
        padding: 24,
        alignItems: 'center',
        shadowColor: cores.black,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 8,
    },
    icone: {
        marginBottom: 16,
    },
    titulo: {
        fontSize: 32,
        fontWeight: 'bold',
        color: cores.charcoal,
        marginBottom: 8,
    },
    subtitulo: {
        fontSize: 19,
        color: cores.grey,
        textAlign: 'center',
        marginBottom: 24,
    },
    containerDigitacao: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: cores.platinum,
        borderRadius: 12,
        marginBottom: 24,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: cores.dustGrey,
        width: '100%',
    },
    campo: {
        flex: 1,
        backgroundColor: 'transparent',
        fontSize: 22,
        marginLeft: 12,
        height: 50,
    },
    botao: {
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
        width: '100%',
    },
    fundoBotao: {
        paddingVertical: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    textoBotao: {
        color: cores.white,
        fontSize: 22,
        fontWeight: '600',
    },
    link: {
        textAlign: 'center',
        color: cores.grey,
        fontSize: 19,
        textDecorationLine: 'underline',
    },
});