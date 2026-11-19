import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Text, TextInput } from 'react-native-paper';
import { auth, db } from '../servicos/firebaseConfig';
import { cores } from '../theme';

export default function TelaLogin() {
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [estaCarregando, setEstaCarregando] = useState(false);
    const [mostrarSenha, setMostrarSenha] = useState(false);

    const identificarLogin = async () => {
        if (!email || !senha) {
            
            return;
        }
        setEstaCarregando(true);
        try {
            const credencialUsuario = await signInWithEmailAndPassword(auth, email, senha);
            const documentoUsuario = await getDoc(doc(db, 'usuarios', credencialUsuario.user.uid));

            if (!documentoUsuario.exists()) {
                
                await auth.signOut();
                setEstaCarregando(false);
                return;
            }
            
            const dadosUsuario = documentoUsuario.data();
            
            if (dadosUsuario.status === 'pendente') {
                
                await auth.signOut();
                setEstaCarregando(false);
                return;
            }
            
            if (dadosUsuario.status === 'rejeitado') {
                
                await auth.signOut();
                setEstaCarregando(false);
                return;
            }
            
            if (!dadosUsuario.ativo) {
                
                await auth.signOut();
                setEstaCarregando(false);
                return;
            }
            
            if (dadosUsuario.cargo === 'superadmin') {
                router.replace('/telas/superadmin');
            } else {
                router.replace('/telas');
            }
        } catch (erro: any) {
            if (erro.code === 'auth/invalid-credential') {
                
            } else if (erro.code === 'auth/user-not-found') {
                
            } else if (erro.code === 'auth/wrong-password') {
                
            } else {
                
            }
        } finally {
            setEstaCarregando(false);
        }
    };

    return (
        <View style={estilos.container}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={estilos.conteudo}>
                <ScrollView
                    contentContainerStyle={estilos.conteudoRolagem}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                <View style={estilos.containerLogo}>
                    <View style={estilos.circuloLogo}>
                        <Image
                            source={require('../../assets/images/trafego-logo-icon.png')}
                            style={estilos.logoImagem}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={estilos.titulo}>TrafeGO</Text>
                    <Text style={estilos.subtitulo}>Sistema de Gestão Operacional</Text>
                </View>

                <View style={estilos.formulario}>
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

                    <View style={estilos.containerDigitacao}>
                        <Ionicons name="lock-closed-outline" size={20} color={cores.grey} />
                        <TextInput
                            mode="flat"
                            placeholder="Senha"
                            value={senha}
                            onChangeText={setSenha}
                            secureTextEntry={!mostrarSenha}
                            style={estilos.campo}
                            underlineColor="transparent"
                            activeUnderlineColor={cores.charcoal}
                            textColor={cores.charcoal}
                            placeholderTextColor={cores.silver}
                        />
                        <TouchableOpacity onPress={() => setMostrarSenha(!mostrarSenha)}>
                            <Ionicons name={mostrarSenha ? "eye-off-outline" : "eye-outline"} size={20} color={cores.grey} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={estilos.botao}
                        onPress={identificarLogin}
                        disabled={estaCarregando}
                    >
                        <LinearGradient colors={[cores.charcoal, cores.grey]} style={estilos.fundoBotao}>
                            {estaCarregando ? <ActivityIndicator color={cores.white} /> : <Text style={estilos.textoBotao}>ENTRAR</Text>}
                        </LinearGradient>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => router.push('/telasLogin/esqueci-senha')}>
                        <Text style={estilos.linkEsqueci}>Esqueci minha senha</Text>
                    </TouchableOpacity>

                    <View style={estilos.containerCadastro}>
                        <TouchableOpacity onPress={() => router.push('/telasLogin/cadastro')}>
                            <Text style={estilos.linkCadastro}>Solicitar Cadastro</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                </ScrollView>
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
    },
    conteudoRolagem: {
        flexGrow: 1,
        justifyContent: 'center',
        padding: 24,
    },
    containerLogo: {
        alignItems: 'center',
        marginBottom: 36,
    },
    circuloLogo: {
        width: 128,
        height: 128,
        borderRadius: 64,
        backgroundColor: cores.white,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: cores.dustGrey,
        shadowColor: cores.black,
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
    },
    logoImagem: {
        width: 84,
        height: 90,
    },
    titulo: {
        fontSize: 43,
        fontWeight: 'bold',
        color: cores.charcoal,
        letterSpacing: 1,
        marginBottom: 4,
    },
    subtitulo: {
        fontSize: 18,
        color: cores.grey,
        letterSpacing: 0.5,
    },
    formulario: {
        backgroundColor: cores.white,
        borderRadius: 24,
        padding: 24,
        elevation: 8,
    },
    containerDigitacao: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: cores.platinum,
        borderRadius: 12,
        marginBottom: 16,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: cores.dustGrey,
    },
    campo: {
        flex: 1,
        backgroundColor: 'transparent',
        fontSize: 22,
        marginLeft: 12,
        height: 50,
    },
    botao: {
        marginTop: 8,
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
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
    linkEsqueci: {
        textAlign: 'center',
        color: cores.grey,
        fontSize: 19,
        marginBottom: 24,
    },
    containerCadastro: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    },
    linkCadastro: {
        fontSize: 19,
        color: cores.charcoal,
        fontWeight: '600',
    },
});