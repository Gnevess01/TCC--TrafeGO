import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import React, { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    Button,
    Text,
    TextInput
} from 'react-native-paper';
import { auth, db } from '../servicos/firebaseConfig';
import { cores } from '../theme';

export default function TelaCadastro() { 
    const [nomeCompleto, setNomeCompleto] = useState(''); 
    const [cpf, setCpf] = useState('');
    const [email, setEmail] = useState('');
    const [senha, setSenha] = useState('');
    const [confirmarSenha, setConfirmarSenha] = useState('');
    const [estaCarregando, setEstaCarregando] = useState(false);
    const [mostrarSenha, setMostrarSenha] = useState(false);
    const [mostrarConfirmarSenha, setMostrarConfirmarSenha] = useState(false);
    const [cadastroEnviado, setCadastroEnviado] = useState(false);

    const formatarCPF = (texto: string) => {
        let cpfNumeros = texto.replace(/\D/g, '');
        if (cpfNumeros.length > 11) {
            cpfNumeros = cpfNumeros.slice(0, 11);
        }
        
        let cpfFormatado = cpfNumeros;
        if (cpfNumeros.length > 3 && cpfNumeros.length <= 6) {
            cpfFormatado = `${cpfNumeros.slice(0, 3)}.${cpfNumeros.slice(3)}`;
        } else if (cpfNumeros.length > 6 && cpfNumeros.length <= 9) {
            cpfFormatado = `${cpfNumeros.slice(0, 3)}.${cpfNumeros.slice(3, 6)}.${cpfNumeros.slice(6)}`;
        } else if (cpfNumeros.length > 9) {
            cpfFormatado = `${cpfNumeros.slice(0, 3)}.${cpfNumeros.slice(3, 6)}.${cpfNumeros.slice(6, 9)}-${cpfNumeros.slice(9, 11)}`;
        }
        
        return cpfFormatado;
    };

    const validarCPF = (cpf: string): boolean => {
        const cpfNumeros = cpf.replace(/\D/g, '');
        
        if (cpfNumeros.length !== 11) return false;
        
        if (/^(\d)\1{10}$/.test(cpfNumeros)) return false;
        
        let soma = 0;
        for (let i = 0; i < 9; i++) {
            soma += parseInt(cpfNumeros.charAt(i)) * (10 - i);
        }
        let resto = (soma * 10) % 11;
        if (resto === 10) resto = 0;
        if (resto !== parseInt(cpfNumeros.charAt(9))) return false;
        
        soma = 0;
        for (let i = 0; i < 10; i++) {
            soma += parseInt(cpfNumeros.charAt(i)) * (11 - i);
        }
        resto = (soma * 10) % 11;
        if (resto === 10) resto = 0;
        if (resto !== parseInt(cpfNumeros.charAt(10))) return false;
        
        return true;
    };

    const validarCadastro = async () => {
        if (!nomeCompleto.trim()) {
            
            return;
        }
        if (!cpf.trim()) {
            
            return;
        }
        if (!validarCPF(cpf)) {
            
            return;
        }
        if (!email.trim()) {
            
            return;
        }
        if (!senha) {
            
            return;
        }
        if (senha !== confirmarSenha) {
            
            return;
        }
        if (senha.length < 6) {
            
            return;
        }

        setEstaCarregando(true);
        try {
            const credencialUsuario = await createUserWithEmailAndPassword(auth, email, senha);
            const usuario = credencialUsuario.user;

            await setDoc(doc(db, 'usuarios', usuario.uid), {
                uid: usuario.uid,
                nome: nomeCompleto.trim(),
                cpf: cpf.replace(/\D/g, ''),
                email: email.trim(),
                status: 'pendente',
                ativo: false,
                criadoEm: new Date(),
                solicitadoEm: new Date(),
            });

            await auth.signOut();

            setCadastroEnviado(true);
            router.replace('/telasLogin/login');
        } catch (erro: any) {
            let mensagem = 'Não foi possível realizar o cadastro';
            if (erro.code === 'auth/email-already-in-use') {
                mensagem = 'Este e-mail já está cadastrado ou aguardando aprovação.';
            } else if (erro.code === 'auth/invalid-email') {
                mensagem = 'E-mail inválido';
            } else if (erro.code === 'auth/weak-password') {
                mensagem = 'Senha muito fraca';
            }
            
        } finally {
            setEstaCarregando(false);
        }
    };

    if (cadastroEnviado) {
        return (
            <View style={estilos.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                    <TouchableOpacity onPress={() => router.back()} style={estilos.botaoVoltar}>
                        <Ionicons name="arrow-back" size={24} color={cores.charcoal} />
                    </TouchableOpacity>
                    <View style={estilos.centroCabecalho}>
                        <View style={estilos.circuloLogo}>
                            <Ionicons name="time" size={32} color={cores.white} />
                        </View>
                        <Text style={estilos.tituloCabecalho}>Cadastro em Análise</Text>
                        <Text style={estilos.subtituloCabecalho}>Aguarde a aprovação do administrador</Text>
                    </View>
                    <View style={{ width: 44 }} />
                </LinearGradient>

                <View style={estilos.containerAnalise}>
                    <Ionicons name="hourglass-outline" size={80} color={cores.warning} />
                    <Text style={estilos.tituloAnalise}>Solicitação Enviada!</Text>
                    <Text style={estilos.textoAnalise}>
                        Seu cadastro foi enviado para análise do administrador.
                    </Text>
                    <Text style={estilos.textoAnalise}>
                        Volte mais tarde e tente entrar para verificar a aprovação.
                    </Text>
                    <TouchableOpacity 
                        style={estilos.botaoVoltarLogin}
                        onPress={() => router.replace('/telasLogin/login')}
                    >
                        <Text style={estilos.textoBotaoVoltarLogin}>Voltar para o Login</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
            style={estilos.container}
        >
            <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                <TouchableOpacity onPress={() => router.back()} style={estilos.botaoVoltar}>
                    <Ionicons name="arrow-back" size={24} color={cores.charcoal} />
                </TouchableOpacity>
                <View style={estilos.centroCabecalho}>
                    <View style={estilos.circuloLogo}>
                        <Ionicons name="person-add" size={32} color={cores.white} />
                    </View>
                    <Text style={estilos.tituloCabecalho}>Solicitar Cadastro</Text>
                    <Text style={estilos.subtituloCabecalho}>Preencha os dados para solicitar acesso</Text>
                </View>
                <View style={{ width: 44 }} />
            </LinearGradient>

            <ScrollView style={estilos.conteudo} showsVerticalScrollIndicator={false}>
                <View style={estilos.containerFormulario}>
                    

                    <TextInput
                        mode="outlined"
                        label="Nome Completo"
                        value={nomeCompleto}
                        onChangeText={setNomeCompleto}
                        style={estilos.campoInput}
                        outlineColor={cores.dustGrey}
                        activeOutlineColor={cores.primary}
                        left={<TextInput.Icon icon="account" />}
                    />

                    <TextInput
                        mode="outlined"
                        label="CPF"
                        value={cpf}
                        onChangeText={(texto) => setCpf(formatarCPF(texto))}
                        style={estilos.campoInput}
                        keyboardType="numeric"
                        maxLength={14}
                        outlineColor={cores.dustGrey}
                        activeOutlineColor={cores.primary}
                        left={<TextInput.Icon icon="account-card" />}
                    />

                    <TextInput
                        mode="outlined"
                        label="E-mail"
                        value={email}
                        onChangeText={setEmail}
                        style={estilos.campoInput}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        outlineColor={cores.dustGrey}
                        activeOutlineColor={cores.primary}
                        left={<TextInput.Icon icon="email" />}
                    />

                    <TextInput
                        mode="outlined"
                        label="Senha"
                        value={senha}
                        onChangeText={setSenha}
                        style={estilos.campoInput}
                        secureTextEntry={!mostrarSenha}
                        outlineColor={cores.dustGrey}
                        activeOutlineColor={cores.primary}
                        left={<TextInput.Icon icon="lock" />}
                        right={
                            <TextInput.Icon 
                                icon={mostrarSenha ? "eye-off" : "eye"} 
                                onPress={() => setMostrarSenha(!mostrarSenha)}
                            />
                        }
                    />

                    <TextInput
                        mode="outlined"
                        label="Confirmar Senha"
                        value={confirmarSenha}
                        onChangeText={setConfirmarSenha}
                        style={estilos.campoInput}
                        secureTextEntry={!mostrarConfirmarSenha}
                        outlineColor={cores.dustGrey}
                        activeOutlineColor={cores.primary}
                        left={<TextInput.Icon icon="lock-check" />}
                        right={
                            <TextInput.Icon 
                                icon={mostrarConfirmarSenha ? "eye-off" : "eye"} 
                                onPress={() => setMostrarConfirmarSenha(!mostrarConfirmarSenha)}
                            />
                        }
                    />

                    <Button
                        mode="contained"
                        onPress={validarCadastro}
                        loading={estaCarregando}
                        disabled={estaCarregando}
                        style={estilos.botaoCadastro}
                        labelStyle={estilos.rotuloBotaoCadastro}
                    >
                        Solicitar Cadastro
                    </Button>

                    <View style={estilos.containerLogin}>
                        <Text style={estilos.textoLogin}>Já tem uma conta? </Text>
                        <TouchableOpacity onPress={() => router.back()}>
                            <Text style={estilos.linkLogin}>Faça login</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const estilos = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: cores.platinum,
    },
    cabecalho: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 48,
        paddingBottom: 24,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    botaoVoltar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: cores.white,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
    },
    centroCabecalho: {
        alignItems: 'center',
    },
    circuloLogo: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: cores.primary,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    tituloCabecalho: {
        fontSize: 32,
        fontWeight: 'bold',
        color: cores.charcoal,
    },
    subtituloCabecalho: {
        fontSize: 16,
        color: cores.grey,
        marginTop: 4,
    },
    conteudo: {
        flex: 1,
    },
    containerFormulario: {
        padding: 20,
    },
    campoInput: {
        marginBottom: 16,
        backgroundColor: cores.white,
    },
    botaoCadastro: {
        marginTop: 8,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: cores.primary,
    },
    rotuloBotaoCadastro: {
        fontSize: 22,
        fontWeight: '600',
        color: cores.white,
    },
    containerLogin: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
        marginBottom: 40,
    },
    textoLogin: {
        fontSize: 19,
        color: cores.grey,
    },
    linkLogin: {
        fontSize: 19,
        color: cores.primary,
        fontWeight: '600',
    },
    containerAnalise: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    tituloAnalise: {
        fontSize: 30,
        fontWeight: 'bold',
        color: cores.warning,
        marginTop: 24,
        marginBottom: 16,
    },
    textoAnalise: {
        fontSize: 19,
        color: cores.grey,
        textAlign: 'center',
        marginBottom: 8,
    },
    botaoVoltarLogin: {
        marginTop: 32,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: cores.primary,
        borderRadius: 12,
    },
    textoBotaoVoltarLogin: {
        color: cores.white,
        fontWeight: '600',
        fontSize: 22,
    },
});