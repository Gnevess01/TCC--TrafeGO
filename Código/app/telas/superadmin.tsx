import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { signOut } from 'firebase/auth';
import { collection, doc, getDocs, query, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { ActivityIndicator, Avatar, Card, Divider, Text } from 'react-native-paper';
import { auth, db } from '../servicos/firebaseConfig';
import { cores } from '../theme';

interface SolicitacaoUsuario {
    id: string;
    uid: string;
    nome: string;
    email: string;
    cargo: string;
    status: string;
    solicitadoEm: any;
}

export default function TelaSuperAdmin() {
    const [solicitacoes, setSolicitacoes] = useState<SolicitacaoUsuario[]>([]);
    const [estaCarregando, setEstaCarregando] = useState(true);
    const [cargoSelecionado, setCargoSelecionado] = useState<Record<string, string>>({});

    const buscarSolicitacoes = async () => {
        setEstaCarregando(true);
        try {
            const q = query(collection(db, 'usuarios'), where('status', '==', 'pendente'));
            const querySnapshot = await getDocs(q);
            const lista: SolicitacaoUsuario[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                lista.push({
                    id: doc.id,
                    uid: data.uid,
                    nome: data.nome,
                    email: data.email,
                    cargo: data.cargo || 'motorista',
                    status: data.status,
                    solicitadoEm: data.solicitadoEm,
                });
            });
            setSolicitacoes(lista);
        } catch (error) {
            
        } finally {
            setEstaCarregando(false);
        }
    };

    useEffect(() => {
        buscarSolicitacoes();
    }, []);

    const aprovarUsuario = async (solicitacao: SolicitacaoUsuario) => {
        const cargo = cargoSelecionado[solicitacao.id] || 'motorista';
        try {
            await updateDoc(doc(db, 'usuarios', solicitacao.id), {
                status: 'aprovado',
                ativo: true,
                cargo: cargo,
                aprovadoEm: new Date(),
            });
            
            buscarSolicitacoes();
        } catch (error: any) {
            
        }
    };

    const rejeitarUsuario = (solicitacao: SolicitacaoUsuario) => {
        const confirmar = window.confirm(`Tem certeza que deseja REJEITAR o cadastro de ${solicitacao.nome}?`);
        
        if (confirmar) {
            (async () => {
                try {
                    await updateDoc(doc(db, 'usuarios', solicitacao.id), {
                        status: 'rejeitado',
                        ativo: false,
                        rejeitadoEm: new Date(),
                    });
                    
                    buscarSolicitacoes();
                } catch (error: any) {
                    
                }
            })();
        }
    };

    const fazerLogout = async () => {
        await signOut(auth);
        router.replace('/telasLogin/login');
    };

    const formatarData = (timestamp: any) => {
        if (!timestamp) return 'Data não informada';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('pt-BR');
    };

    if (estaCarregando) {
        return (
            <View style={estilos.containerCarregamento}>
                <ActivityIndicator size="large" color={cores.primary} />
                <Text style={estilos.textoCarregamento}>Carregando solicitações...</Text>
            </View>
        );
    }

    return (
        <View style={estilos.container}>
            <LinearGradient colors={[cores.primary, cores.grey]} style={estilos.cabecalho}>
                <View style={estilos.conteudoCabecalho}>
                    <TouchableOpacity onPress={fazerLogout} style={estilos.botaoLogout}>
                        <Ionicons name="exit-outline" size={24} color={cores.white} />
                    </TouchableOpacity>
                    <View style={estilos.containerIcone}>
                        <Ionicons name="shield-checkmark" size={40} color={cores.white} />
                    </View>
                    <Text style={estilos.tituloCabecalho}>Painel do Administrador</Text>
                </View>
            </LinearGradient>

            <View style={estilos.containerEstatisticas}>
                <View style={estilos.cardEstatistica}>
                    <Text style={estilos.numeroEstatistica}>{solicitacoes.length}</Text>
                    <Text style={estilos.rotuloEstatistica}>Solicitações Pendentes</Text>
                </View>
            </View>

            <ScrollView style={estilos.listaContainer} showsVerticalScrollIndicator={false}>
                {solicitacoes.length === 0 ? (
                    <View style={estilos.containerVazio}>
                        <Ionicons name="checkmark-done-circle" size={80} color={cores.success} />
                        <Text style={estilos.tituloVazio}>Nenhuma solicitação pendente</Text>
                        <Text style={estilos.textoVazio}>Todos os cadastros foram processados.</Text>
                    </View>
                ) : (
                    solicitacoes.map((solicitacao) => (
                        <Card key={solicitacao.id} style={estilos.cartao}>
                            <Card.Content>
                                <View style={estilos.cabecalhoCard}>
                                    <Avatar.Text 
                                        size={50} 
                                        label={solicitacao.nome.substring(0, 2).toUpperCase()} 
                                        style={estilos.avatar} 
                                    />
                                    <View style={estilos.infoUsuario}>
                                        <Text style={estilos.nomeUsuario}>{solicitacao.nome}</Text>
                                        <Text style={estilos.emailUsuario}>{solicitacao.email}</Text>
                                        <Text style={estilos.dataSolicitacao}>Solicitado: {formatarData(solicitacao.solicitadoEm)}</Text>
                                    </View>
                                </View>

                                <Divider style={estilos.divisor} />

                                <Text style={estilos.rotuloCargo}>Definir cargo do usuário:</Text>
                                <View style={estilos.containerCargos}>
                                    {[
                                        { valor: 'motorista', label: 'Motorista' },
                                        { valor: 'funcionario', label: 'Funcionário' },
                                        { valor: 'gerente', label: 'Gerente' },
                                    ].map((cargo) => (
                                        <TouchableOpacity
                                            key={cargo.valor}
                                            style={[
                                                estilos.botaoCargo,
                                                (cargoSelecionado[solicitacao.id] || 'motorista') === cargo.valor && estilos.botaoCargoAtivo
                                            ]}
                                            onPress={() => setCargoSelecionado(prev => ({ ...prev, [solicitacao.id]: cargo.valor }))}
                                        >
                                            <Text style={(cargoSelecionado[solicitacao.id] || 'motorista') === cargo.valor ? estilos.textoCargoAtivo : estilos.textoCargo}>
                                                {cargo.label}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <View style={estilos.containerBotoes}>
                                    <TouchableOpacity style={estilos.botaoAprovar} onPress={() => aprovarUsuario(solicitacao)}>
                                        <Ionicons name="checkmark" size={20} color={cores.white} />
                                        <Text style={estilos.textoBotao}>APROVAR</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={estilos.botaoRejeitar} onPress={() => rejeitarUsuario(solicitacao)}>
                                        <Ionicons name="close" size={20} color={cores.white} />
                                        <Text style={estilos.textoBotao}>REJEITAR</Text>
                                    </TouchableOpacity>
                                </View>
                            </Card.Content>
                        </Card>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const estilos = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F5F5F5',
    },
    containerCarregamento: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F5F5F5',
    },
    textoCarregamento: {
        marginTop: 16,
        color: cores.grey,
        fontSize: 19,
    },
    cabecalho: {
        paddingTop: 50,
        paddingBottom: 30,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    conteudoCabecalho: {
        alignItems: 'center',
        position: 'relative',
    },
    botaoLogout: {
        position: 'absolute',
        left: 20,
        top: -10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    containerIcone: {
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    tituloCabecalho: {
        fontSize: 30,
        fontWeight: 'bold',
        color: cores.white,
        marginBottom: 4,
    },
    subtituloCabecalho: {
        fontSize: 18,
        color: 'rgba(255,255,255,0.8)',
    },
    containerEstatisticas: {
        paddingHorizontal: 16,
        marginTop: -20,
        marginBottom: 16,
    },
    cardEstatistica: {
        backgroundColor: cores.white,
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
    },
    numeroEstatistica: {
        fontSize: 43,
        fontWeight: 'bold',
        color: cores.warning,
    },
    rotuloEstatistica: {
        fontSize: 16,
        color: cores.grey,
        marginTop: 4,
    },
    listaContainer: {
        flex: 1,
        paddingHorizontal: 16,
    },
    containerVazio: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    tituloVazio: {
        fontSize: 24,
        fontWeight: '600',
        color: cores.charcoal,
        marginTop: 16,
    },
    textoVazio: {
        fontSize: 19,
        color: cores.grey,
        marginTop: 8,
        textAlign: 'center',
    },
    cartao: {
        marginBottom: 16,
        borderRadius: 20,
        backgroundColor: cores.white,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
    },
    cabecalhoCard: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    avatar: {
        backgroundColor: cores.primary,
    },
    infoUsuario: {
        marginLeft: 16,
        flex: 1,
    },
    nomeUsuario: {
        fontSize: 22,
        fontWeight: 'bold',
        color: cores.charcoal,
    },
    emailUsuario: {
        fontSize: 18,
        color: cores.grey,
        marginTop: 2,
    },
    dataSolicitacao: {
        fontSize: 15,
        color: cores.silver,
        marginTop: 4,
    },
    divisor: {
        marginVertical: 12,
        backgroundColor: '#EEEEEE',
    },
    rotuloCargo: {
        fontSize: 19,
        fontWeight: '600',
        color: cores.charcoal,
        marginBottom: 10,
    },
    containerCargos: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        marginBottom: 20,
    },
    botaoCargo: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 25,
        backgroundColor: '#F0F0F0',
        borderWidth: 1,
        borderColor: '#E0E0E0',
    },
    botaoCargoAtivo: {
        backgroundColor: cores.primary,
        borderColor: cores.primary,
    },
    textoCargo: {
        fontSize: 18,
        color: cores.grey,
    },
    textoCargoAtivo: {
        fontSize: 18,
        color: cores.white,
        fontWeight: '600',
    },
    containerBotoes: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    botaoAprovar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: cores.success,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    botaoRejeitar: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: cores.error,
        paddingVertical: 12,
        borderRadius: 12,
        gap: 8,
    },
    textoBotao: {
        color: cores.white,
        fontSize: 19,
        fontWeight: '600',
    },
});