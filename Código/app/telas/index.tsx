import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { Image, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { Text } from 'react-native-paper';
import { auth, db } from '../servicos/firebaseConfig';
import { cores } from '../theme';

export default function TelaInicio() {
    const [nomeUsuario, setNomeUsuario] = useState('');
    const [cargoUsuario, setCargoUsuario] = useState('');
    const [carregando, setCarregando] = useState(true);

    useEffect(() => {
        const buscarDadosUsuario = async () => {
            const usuarioAtual = auth.currentUser;
            if (!usuarioAtual) {
                setCarregando(false);
                return;
            }

            try {
                const consulta = query(
                    collection(db, 'usuarios'),
                    where('email', '==', usuarioAtual.email)
                );
                const resultado = await getDocs(consulta);
                
                if (!resultado.empty) {
                    resultado.forEach((doc) => {
                        const dados = doc.data();
                        setNomeUsuario(dados.nome?.split(' ')[0] || usuarioAtual.email?.split('@')[0] || 'Usuário');
                        setCargoUsuario(dados.cargo || '');
                    });
                } else {
                    setNomeUsuario(usuarioAtual.email?.split('@')[0] || 'Usuário');
                    setCargoUsuario('');
                }
            } catch (erro) {
                setNomeUsuario(usuarioAtual.email?.split('@')[0] || 'Usuário');
            } finally {
                setCarregando(false);
            }
        };
        
        buscarDadosUsuario();
    }, []);

    const fazerLogout = () => {

    signOut(auth).then(() => {
        router.replace('/telasLogin/login');
    });
};

    const podeVerNotas = cargoUsuario === 'motorista' || cargoUsuario === 'gerente' || cargoUsuario === 'superadmin';
    const podeVerRelatorios = cargoUsuario === 'gerente' || cargoUsuario === 'superadmin';

    const obterTextoCargo = () => {
        switch (cargoUsuario) {
            case 'motorista': return 'Motorista';
            case 'funcionario': return 'Funcionário';
            case 'gerente': return 'Gerente';
            case 'superadmin': return 'Administrador';
            default: return '';
        }
    };

    if (carregando) {
        return (
            <View style={styles.container}>
                <View style={styles.cabecalho}>
                    <Text style={styles.textoCarregamento}>Carregando...</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.cabecalho}>
                    <View style={styles.cabecalhoTopo}>
                        <TouchableOpacity onPress={fazerLogout} style={styles.botaoVoltar}>
                            <Ionicons name="arrow-back" size={24} color={cores.white} />
                        </TouchableOpacity>
                        <View style={styles.infoUsuario}>
                            <Text style={styles.saudacao}>Olá,</Text>
                            <Text style={styles.nomeUsuario}>{nomeUsuario}</Text>
                            <View style={styles.badgeCargo}>
                                <Text style={styles.textoBadge}>{obterTextoCargo()}</Text>
                            </View>
                        </View>
                        <View style={styles.circuloLogo}>
                            <Image
                                source={require('../../assets/images/trafego-logo-icon.png')}
                                style={styles.logoCabecalho}
                                resizeMode="contain"
                            />
                        </View>
                    </View>
                </View>
                <View style={styles.grid}>
                    {podeVerNotas && (
                        <TouchableOpacity style={styles.cartao} onPress={() => router.push('/telas/notas')}>
                            <View style={styles.iconeFundo}>
                                <Ionicons name="receipt" size={28} color="#FFFFFF" />
                            </View>
                            <Text style={styles.tituloCard}>Notas Fiscais</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity style={styles.cartao} onPress={() => router.push('/telas/despesas')}>
                        <View style={styles.iconeFundo}>
                            <Ionicons name="cash" size={28} color="#FFFFFF" />
                        </View>
                        <Text style={styles.tituloCard}>Despesas</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.cartao} onPress={() => router.push('/telas/devolucao')}>
                        <View style={styles.iconeFundo}>
                            <Ionicons name="return-up-back" size={28} color="#FFFFFF" />
                        </View>
                        <Text style={styles.tituloCard}>Devoluções</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.cartao} onPress={() => router.push('/telas/placas')}>
                        <View style={styles.iconeFundo}>
                            <Ionicons name="car" size={28} color="#FFFFFF" />
                        </View>
                        <Text style={styles.tituloCard}>Placas</Text>
                    </TouchableOpacity>

                    {podeVerRelatorios && (
                        <TouchableOpacity style={styles.cartao} onPress={() => router.push('/telas/relatorios')}>
                            <View style={styles.iconeFundo}>
                                <Ionicons name="document" size={28} color="#FFFFFF" />
                            </View>
                            <Text style={styles.tituloCard}>Relatórios</Text>
                        </TouchableOpacity>
                    )}

                    {cargoUsuario === 'superadmin' && (
                        <TouchableOpacity style={styles.cartao} onPress={() => router.push('/telas/superadmin')}>
                            <View style={styles.iconeFundo}>
                                <Ionicons name="shield-checkmark" size={28} color="#FFFFFF" />
                            </View>
                            <Text style={styles.tituloCard}>Aprovações</Text>
                        </TouchableOpacity>
                    )}
                </View>
                
                <View style={styles.rodape}>
                    <Image
                        source={require('../../assets/images/trafego-logo-icon.png')}
                        style={styles.logoRodape}
                        resizeMode="contain"
                    />
                    <Text style={styles.textoRodape}>TrafeGO</Text>
                    
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: cores.platinum,
    },
    cabecalho: {
        backgroundColor: '#FFFFFF',
        paddingTop: 48,
        paddingBottom: 32,
        paddingHorizontal: 20,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
        marginBottom: 24,
    },
    cabecalhoTopo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    botaoVoltar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: cores.charcoal,
        alignItems: 'center',
        justifyContent: 'center',
    },
    infoUsuario: {
        flex: 1,
        alignItems: 'center',
    },
    circuloLogo: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: cores.platinum,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logoCabecalho: {
        width: 30,
        height: 32,
    },
    logoRodape: {
        width: 32,
        height: 34,
        opacity: 0.5,
        marginBottom: 6,
    },
    saudacao: {
        fontSize: 19,
        color: cores.grey,
        marginBottom: 4,
    },
    nomeUsuario: {
        fontSize: 32,
        fontWeight: 'bold',
        color: cores.charcoal,
        marginBottom: 8,
    },
    badgeCargo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: cores.platinum,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        alignSelf: 'center',
    },
    textoBadge: {
        fontSize: 16,
        color: cores.grey,
    },
    textoCarregamento: {
        textAlign: 'center',
        marginTop: 40,
        color: cores.grey,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: 8,
        paddingBottom: 8,
    },
    cartao: {
        width: '48%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        alignItems: 'center',
        marginBottom: 16,
    },
    iconeFundo: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: cores.charcoal,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    tituloCard: {
        fontSize: 22,
        fontWeight: '600',
        color: cores.charcoal,
    },
    rodape: {
        alignItems: 'center',
        paddingVertical: 24,
        paddingBottom: 32,
    },
    textoRodape: {
        fontSize: 16,
        color: cores.silver,
        marginBottom: 4,
    },
});