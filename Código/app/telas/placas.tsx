import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, Timestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    Modal,
    TextInput as RNTextInput,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    ActivityIndicator,
    Avatar,
    Button,
    Card,
    Divider,
    Text,
    TextInput,
} from 'react-native-paper';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { auth, db } from '../servicos/firebaseConfig';
import { cores } from '../theme';

interface Cavalo {
    id: string;
    placa: string;
    modelo: string;
    ano: string;
    motoristaId: string;
    motoristaNome: string;
    motoristaEmail: string;
    ativa: boolean;
    conjuntoId?: string;
    conjuntoPlaca?: string;
    vidaUtilPneu: string;
    ultimaTrocaOleo: string;
    proximaTrocaOleo: string;
    ultimaAtualizacaoRastreador: string;
    proximaAtualizacaoRastreador: string;
    observacoes: string;
    criadoEm: Timestamp;
    atualizadoEm: Timestamp;
}

interface Conjunto {
    id: string;
    placa: string;
    placa2?: string;
    tipo: 'carreta_simples' | 'bitrem';
    modelo: string;
    modelo2?: string;
    ano: string;
    cavaloId?: string;
    cavaloPlaca?: string;
    ativo: boolean;
    observacoes: string;
    criadoEm: Timestamp;
    atualizadoEm: Timestamp;
}

interface MotoristaInfo {
    uid: string;
    nome: string;
    email: string;
    cavalo?: Cavalo;
    conjunto?: Conjunto;
}

export default function TelaPlacas() {
    const [usuario, setUsuario] = useState<any>(null);
    const [cargo, setCargo] = useState<string>('');
    const [estaCarregando, setEstaCarregando] = useState(true);
   
    const [motoristas, setMotoristas] = useState<MotoristaInfo[]>([]);
    const [buscaMotorista, setBuscaMotorista] = useState('');
    const [motoristaSelecionado, setMotoristaSelecionado] = useState<MotoristaInfo | null>(null);
   
    const [modalCavaloVisivel, setModalCavaloVisivel] = useState(false);
    const [modalConjuntoVisivel, setModalConjuntoVisivel] = useState(false);
    const [editandoCavalo, setEditandoCavalo] = useState<Cavalo | null>(null);
    const [editandoConjunto, setEditandoConjunto] = useState<Conjunto | null>(null);
    const [estaSalvando, setEstaSalvando] = useState(false);
   
    const [placaTexto, setPlacaTexto] = useState('');
    const [placa2Texto, setPlaca2Texto] = useState('');
    const [modelo, setModelo] = useState('');
    const [modelo2, setModelo2] = useState('');
    const [ano, setAno] = useState('');
    const [tipoConjunto, setTipoConjunto] = useState<'carreta_simples' | 'bitrem'>('carreta_simples');
    const [vidaUtilPneu, setVidaUtilPneu] = useState('');
    const [ultimaTrocaOleo, setUltimaTrocaOleo] = useState('');
    const [proximaTrocaOleo, setProximaTrocaOleo] = useState('');
    const [ultimaAtualizacaoRastreador, setUltimaAtualizacaoRastreador] = useState('');
    const [proximaAtualizacaoRastreador, setProximaAtualizacaoRastreador] = useState('');
    const [observacoes, setObservacoes] = useState('');
   
    const [conjuntosDisponiveis, setConjuntosDisponiveis] = useState<Conjunto[]>([]);
    const [conjuntoSelecionadoId, setConjuntoSelecionadoId] = useState('');
    const [conjuntoSelecionadoPlaca, setConjuntoSelecionadoPlaca] = useState('');
    const [mostrarListaConjuntos, setMostrarListaConjuntos] = useState(false);
    const [buscaConjunto, setBuscaConjunto] = useState('');

    const isFuncionario = cargo === 'funcionario';
    const isAdmin = cargo === 'gerente' || cargo === 'superadmin';
    const isMotorista = cargo === 'motorista';
    const podeCadastrar = isFuncionario;
    const podeVisualizarListaMotoristas = isFuncionario || isAdmin;
    const podeVisualizarDetalhesMotorista = isFuncionario || isAdmin;
    const podeVisualizarProprioVeiculo = isMotorista;

    useEffect(() => {
        const buscarUsuario = async () => {
            if (!auth.currentUser) return;
           
            const q = query(
                collection(db, 'usuarios'),
                where('email', '==', auth.currentUser.email)
            );
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                setUsuario({
                    uid: doc.id,
                    nome: data.nome,
                    email: data.email,
                    cargo: data.cargo,
                });
                setCargo(data.cargo);
            });
        };
        buscarUsuario();
    }, []);

    useEffect(() => {
        if (cargo) {
            if (podeVisualizarProprioVeiculo && usuario) {
                buscarMeuCavalo();
            } else if (podeVisualizarListaMotoristas) {
                carregarMotoristasComVeiculos();
                if (podeCadastrar) {
                    buscarConjuntosDisponiveis();
                }
            }
        }
    }, [cargo, usuario]);

    const carregarMotoristasComVeiculos = async () => {
        setEstaCarregando(true);
        try {
            const motoristasQuery = query(
                collection(db, 'usuarios'),
                where('cargo', '==', 'motorista'),
                where('ativo', '==', true)
            );
            const motoristasSnap = await getDocs(motoristasQuery);
           
            const listaMotoristas: MotoristaInfo[] = [];
           
            for (const docMotorista of motoristasSnap.docs) {
                const data = docMotorista.data();
               
                const cavalosQuery = query(
                    collection(db, 'cavalos'),
                    where('motoristaId', '==', docMotorista.id)
                );
                const cavalosSnap = await getDocs(cavalosQuery);
                let cavalo: Cavalo | undefined;
                cavalosSnap.forEach((cavaloDoc) => {
                    cavalo = { id: cavaloDoc.id, ...cavaloDoc.data() } as Cavalo;
                });
               
                let conjunto: Conjunto | undefined;
                if (cavalo?.conjuntoId) {
                    const conjuntoDoc = await getDoc(doc(db, 'conjuntos', cavalo.conjuntoId));
                    if (conjuntoDoc.exists()) {
                        conjunto = { id: conjuntoDoc.id, ...conjuntoDoc.data() } as Conjunto;
                    }
                }
               
                listaMotoristas.push({
                    uid: docMotorista.id,
                    nome: data.nome,
                    email: data.email,
                    cavalo: cavalo,
                    conjunto: conjunto,
                });
            }
           
            setMotoristas(listaMotoristas);
        } catch (error) {
            
        } finally {
            setEstaCarregando(false);
        }
    };

    const buscarMeuCavalo = async () => {
        if (!usuario) return;
        setEstaCarregando(true);
        try {
            const q = query(
                collection(db, 'cavalos'),
                where('motoristaId', '==', usuario.uid)
            );
            const querySnapshot = await getDocs(q);
            let cavalo: Cavalo | undefined;
            querySnapshot.forEach((doc) => {
                cavalo = { id: doc.id, ...doc.data() } as Cavalo;
            });
           
            let conjunto: Conjunto | undefined;
            if (cavalo?.conjuntoId) {
                const conjuntoDoc = await getDoc(doc(db, 'conjuntos', cavalo.conjuntoId));
                if (conjuntoDoc.exists()) {
                    conjunto = { id: conjuntoDoc.id, ...conjuntoDoc.data() } as Conjunto;
                }
            }
           
            setMotoristaSelecionado({
                uid: usuario.uid,
                nome: usuario.nome,
                email: usuario.email,
                cavalo: cavalo,
                conjunto: conjunto,
            });
        } catch (error) {
            
        } finally {
            setEstaCarregando(false);
        }
    };

    const buscarConjuntosDisponiveis = async () => {
        try {
            const q = query(collection(db, 'conjuntos'), where('ativo', '==', true));
            const querySnapshot = await getDocs(q);
            const lista: Conjunto[] = [];
            querySnapshot.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() } as Conjunto);
            });
            setConjuntosDisponiveis(lista);
        } catch (error) {
        }
    };

    const excluirCavalo = async (cavalo: Cavalo) => {
        const confirmado = window.confirm(`Tem certeza que deseja excluir o cavalo ${cavalo.placa}?`);
        if (!confirmado) return;
        
        try {
            setEstaCarregando(true);
            
            await deleteDoc(doc(db, 'cavalos', cavalo.id));
            
            await carregarMotoristasComVeiculos();
            
            if (motoristaSelecionado && motoristaSelecionado.uid === cavalo.motoristaId) {
                setMotoristaSelecionado({
                    ...motoristaSelecionado,
                    cavalo: undefined,
                    conjunto: undefined
                });
            }
            
            alert('Cavalo excluído com sucesso!');
            
        } catch (error: any) {
            alert('Erro ao excluir: ' + (error?.message || 'Tente novamente'));
        } finally {
            setEstaCarregando(false);
        }
    };

    const excluirConjunto = async (conjunto: Conjunto) => {
        const confirmado = window.confirm(`Tem certeza que deseja excluir o conjunto ${conjunto.placa}?`);
        if (!confirmado) return;
        
        try {
            setEstaCarregando(true);
            
            const cavaloVinculado = motoristas.find(m => m.cavalo?.conjuntoId === conjunto.id);
            
            if (cavaloVinculado && cavaloVinculado.cavalo) {
                await updateDoc(doc(db, 'cavalos', cavaloVinculado.cavalo.id), {
                    conjuntoId: null,
                    conjuntoPlaca: null,
                    atualizadoEm: new Date(),
                });
            }
            
            await deleteDoc(doc(db, 'conjuntos', conjunto.id));
            
            await carregarMotoristasComVeiculos();
            
            if (motoristaSelecionado && motoristaSelecionado.cavalo && motoristaSelecionado.cavalo.conjuntoId === conjunto.id) {
                setMotoristaSelecionado({
                    ...motoristaSelecionado,
                    cavalo: { ...motoristaSelecionado.cavalo, conjuntoId: undefined, conjuntoPlaca: undefined },
                });
            }
            
            alert('Conjunto excluído com sucesso!');
            
        } catch (error: any) {
            alert('Erro ao excluir: ' + (error?.message || 'Tente novamente'));
        } finally {
            setEstaCarregando(false);
        }
    };

    const salvarCavalo = async () => {
    if (!podeCadastrar) {
        
        return;
    }
    if (!placaTexto.trim()) {
        
        return;
    }
    if (!modelo.trim()) {
        
        return;
    }
    if (!motoristaSelecionado?.uid) {
        
        return;
    }

    if (conjuntoSelecionadoId) {
        const q = query(collection(db, 'cavalos'), where('conjuntoId', '==', conjuntoSelecionadoId));
        const cavalosComConjunto = await getDocs(q);
        if (!cavalosComConjunto.empty && (!editandoCavalo || cavalosComConjunto.docs[0].id !== editandoCavalo.id)) {
            
            return;
        }
    }

    setEstaSalvando(true);
    try {
        const cavaloData = {
            placa: placaTexto.toUpperCase(),
            modelo: modelo.trim(),
            ano: ano.trim(),
            motoristaId: motoristaSelecionado.uid,
            motoristaNome: motoristaSelecionado.nome,
            motoristaEmail: motoristaSelecionado.email,
            ativa: true,
            conjuntoId: conjuntoSelecionadoId || null,
            conjuntoPlaca: conjuntoSelecionadoPlaca || null,
            vidaUtilPneu: vidaUtilPneu.trim() || 'Não informado',
            ultimaTrocaOleo: ultimaTrocaOleo.trim() || 'Não informado',
            proximaTrocaOleo: proximaTrocaOleo.trim() || 'Não informado',
            ultimaAtualizacaoRastreador: ultimaAtualizacaoRastreador.trim() || 'Não informado',
            proximaAtualizacaoRastreador: proximaAtualizacaoRastreador.trim() || 'Não informado',
            observacoes: observacoes.trim(),
            atualizadoEm: new Date(),
        };

        let novoCavaloId = editandoCavalo?.id;
        
        if (editandoCavalo) {
            await updateDoc(doc(db, 'cavalos', editandoCavalo.id), cavaloData);
            
        } else {
            const docRef = await addDoc(collection(db, 'cavalos'), {
                ...cavaloData,
                criadoEm: new Date(),
            });
            novoCavaloId = docRef.id;
            
        }

        setModalCavaloVisivel(false);
        limparFormularioCavalo();
        
        await carregarMotoristasComVeiculos();
        
        if (motoristaSelecionado) {
            const cavaloQuery = query(collection(db, 'cavalos'), where('motoristaId', '==', motoristaSelecionado.uid));
            const cavaloSnap = await getDocs(cavaloQuery);
            let cavaloAtualizado: Cavalo | undefined;
            cavaloSnap.forEach((doc) => {
                cavaloAtualizado = { id: doc.id, ...doc.data() } as Cavalo;
            });
            
            let conjuntoAtualizado: Conjunto | undefined;
            if (cavaloAtualizado?.conjuntoId) {
                const conjuntoDoc = await getDoc(doc(db, 'conjuntos', cavaloAtualizado.conjuntoId));
                if (conjuntoDoc.exists()) {
                    conjuntoAtualizado = { id: conjuntoDoc.id, ...conjuntoDoc.data() } as Conjunto;
                }
            }
            
            setMotoristaSelecionado({
                ...motoristaSelecionado,
                cavalo: cavaloAtualizado,
                conjunto: conjuntoAtualizado,
            });
        }
        
    } catch (error) {
        
    } finally {
        setEstaSalvando(false);
    }
};

    const salvarConjunto = async () => {
    if (!podeCadastrar) {
        
        return;
    }
    if (!placaTexto.trim()) {
        
        return;
    }
    if (!modelo.trim()) {
        
        return;
    }
    if (tipoConjunto === 'bitrem' && !placa2Texto.trim()) {
        
        return;
    }
    if (tipoConjunto === 'bitrem' && !modelo2.trim()) {
        
        return;
    }

    setEstaSalvando(true);
    try {
        const conjuntoData: any = {
            placa: placaTexto.toUpperCase(),
            tipo: tipoConjunto,
            modelo: modelo.trim(),
            ano: ano.trim(),
            ativo: true,
            observacoes: observacoes.trim(),
            atualizadoEm: new Date(),
        };

        if (tipoConjunto === 'bitrem') {
            conjuntoData.placa2 = placa2Texto.toUpperCase();
            conjuntoData.modelo2 = modelo2.trim();
        }

        if (editandoConjunto) {
            await updateDoc(doc(db, 'conjuntos', editandoConjunto.id), conjuntoData);
            
        } else {
            await addDoc(collection(db, 'conjuntos'), {
                ...conjuntoData,
                criadoEm: new Date(),
            });
            
        }

        setModalConjuntoVisivel(false);
        limparFormularioConjunto();
        
        await carregarMotoristasComVeiculos();
        await buscarConjuntosDisponiveis();
        
        if (motoristaSelecionado && motoristaSelecionado.cavalo && motoristaSelecionado.cavalo.conjuntoId === editandoConjunto?.id) {
            const cavaloRef = doc(db, 'cavalos', motoristaSelecionado.cavalo.id);
            await updateDoc(cavaloRef, {
                conjuntoId: null,
                conjuntoPlaca: null,
            });
            
            setMotoristaSelecionado({
                ...motoristaSelecionado,
                cavalo: { ...motoristaSelecionado.cavalo, conjuntoId: undefined, conjuntoPlaca: undefined },
            });
        }
        
        if (motoristaSelecionado && !editandoConjunto) {
            const motoristaAtualizado = motoristas.find(m => m.uid === motoristaSelecionado.uid);
            if (motoristaAtualizado) {
                setMotoristaSelecionado(motoristaAtualizado);
            }
        }
        
    } catch (error) {
        
    } finally {
        setEstaSalvando(false);
    }
};

    const editarCavalo = (cavalo: Cavalo) => {
        if (!podeCadastrar) {
            
            return;
        }
        setEditandoCavalo(cavalo);
        setPlacaTexto(cavalo.placa);
        setModelo(cavalo.modelo);
        setAno(cavalo.ano || '');
        setVidaUtilPneu(cavalo.vidaUtilPneu !== 'Não informado' ? cavalo.vidaUtilPneu : '');
        setUltimaTrocaOleo(cavalo.ultimaTrocaOleo !== 'Não informado' ? cavalo.ultimaTrocaOleo : '');
        setProximaTrocaOleo(cavalo.proximaTrocaOleo !== 'Não informado' ? cavalo.proximaTrocaOleo : '');
        setUltimaAtualizacaoRastreador(cavalo.ultimaAtualizacaoRastreador !== 'Não informado' ? cavalo.ultimaAtualizacaoRastreador : '');
        setProximaAtualizacaoRastreador(cavalo.proximaAtualizacaoRastreador !== 'Não informado' ? cavalo.proximaAtualizacaoRastreador : '');
        setObservacoes(cavalo.observacoes || '');
        setConjuntoSelecionadoId(cavalo.conjuntoId || '');
        setConjuntoSelecionadoPlaca(cavalo.conjuntoPlaca || '');
        setModalCavaloVisivel(true);
    };

    const editarConjunto = (conjunto: Conjunto) => {
        if (!podeCadastrar) {
            
            return;
        }
        setEditandoConjunto(conjunto);
        setPlacaTexto(conjunto.placa);
        setPlaca2Texto(conjunto.placa2 || '');
        setModelo(conjunto.modelo);
        setModelo2(conjunto.modelo2 || '');
        setAno(conjunto.ano || '');
        setTipoConjunto(conjunto.tipo);
        setObservacoes(conjunto.observacoes || '');
        setModalConjuntoVisivel(true);
    };

    const limparFormularioCavalo = () => {
        setEditandoCavalo(null);
        setPlacaTexto('');
        setModelo('');
        setAno('');
        setVidaUtilPneu('');
        setUltimaTrocaOleo('');
        setProximaTrocaOleo('');
        setUltimaAtualizacaoRastreador('');
        setProximaAtualizacaoRastreador('');
        setObservacoes('');
        setConjuntoSelecionadoId('');
        setConjuntoSelecionadoPlaca('');
    };

    const limparFormularioConjunto = () => {
        setEditandoConjunto(null);
        setPlacaTexto('');
        setPlaca2Texto('');
        setModelo('');
        setModelo2('');
        setAno('');
        setTipoConjunto('carreta_simples');
        setObservacoes('');
    };

    const selecionarConjunto = (conjunto: Conjunto) => {
        setConjuntoSelecionadoId(conjunto.id);
        setConjuntoSelecionadoPlaca(conjunto.placa);
        setMostrarListaConjuntos(false);
        setBuscaConjunto('');
    };

    const toggleStatusCavalo = async (cavalo: Cavalo) => {
        if (!podeCadastrar) {
            
            return;
        }
        try {
            await updateDoc(doc(db, 'cavalos', cavalo.id), {
                ativa: !cavalo.ativa,
                atualizadoEm: new Date(),
            });
            
            if (motoristaSelecionado && motoristaSelecionado.cavalo && motoristaSelecionado.cavalo.id === cavalo.id) {
                setMotoristaSelecionado({
                    ...motoristaSelecionado,
                    cavalo: { ...motoristaSelecionado.cavalo, ativa: !cavalo.ativa }
                });
            }
            
            setMotoristas(prev => prev.map(m => {
                if (m.cavalo && m.cavalo.id === cavalo.id) {
                    return { ...m, cavalo: { ...m.cavalo, ativa: !cavalo.ativa } };
                }
                return m;
            }));
            
            
        } catch (error) {
            
        }
    };

    const toggleStatusConjunto = async (conjunto: Conjunto) => {
        if (!podeCadastrar) {
            
            return;
        }
        try {
            await updateDoc(doc(db, 'conjuntos', conjunto.id), {
                ativo: !conjunto.ativo,
                atualizadoEm: new Date(),
            });
            
            if (motoristaSelecionado && motoristaSelecionado.conjunto && motoristaSelecionado.conjunto.id === conjunto.id) {
                setMotoristaSelecionado({
                    ...motoristaSelecionado,
                    conjunto: { ...motoristaSelecionado.conjunto, ativo: !conjunto.ativo }
                });
            }
            
            setMotoristas(prev => prev.map(m => {
                if (m.conjunto && m.conjunto.id === conjunto.id) {
                    return { ...m, conjunto: { ...m.conjunto, ativo: !conjunto.ativo } };
                }
                return m;
            }));
            
            setConjuntosDisponiveis(prev => prev.map(c => {
                if (c.id === conjunto.id) {
                    return { ...c, ativo: !c.ativo };
                }
                return c;
            }));
            
            
        } catch (error) {
            
        }
    };

    const voltarParaListaMotoristas = () => {
        setMotoristaSelecionado(null);
        setBuscaMotorista('');
    };

    const abrirModalNovoCavalo = (motorista: MotoristaInfo) => {
        setMotoristaSelecionado(motorista);
        limparFormularioCavalo();
        setModalCavaloVisivel(true);
    };

    const abrirModalNovoConjunto = () => {
        limparFormularioConjunto();
        setModalConjuntoVisivel(true);
    };

    const conjuntosDisponiveisParaVincular = () => {
        const conjuntosUsados = motoristas
            .map(m => m.cavalo?.conjuntoId)
            .filter(id => id);
        
        let lista = conjuntosDisponiveis.filter(c => !conjuntosUsados.includes(c.id));
        
        if (editandoCavalo && editandoCavalo.conjuntoId) {
            const conjuntoAtual = conjuntosDisponiveis.find(c => c.id === editandoCavalo.conjuntoId);
            if (conjuntoAtual && !lista.some(c => c.id === conjuntoAtual.id)) {
                lista = [conjuntoAtual, ...lista];
            }
        }
        
        return lista.filter(c =>
            c.placa.toLowerCase().includes(buscaConjunto.toLowerCase()) ||
            (c.placa2 && c.placa2.toLowerCase().includes(buscaConjunto.toLowerCase())) ||
            c.modelo.toLowerCase().includes(buscaConjunto.toLowerCase()) ||
            (c.modelo2 && c.modelo2.toLowerCase().includes(buscaConjunto.toLowerCase()))
        );
    };

    const motoristasFiltrados = motoristas.filter(m =>
        m.nome.toLowerCase().includes(buscaMotorista.toLowerCase()) ||
        m.email.toLowerCase().includes(buscaMotorista.toLowerCase())
    );

    if (estaCarregando) {
        return (
            <View style={estilos.containerCarregamento}>
                <ActivityIndicator size="large" color={cores.charcoal} />
                <Text style={estilos.textoCarregamento}>Carregando...</Text>
            </View>
        );
    }

    if (podeVisualizarProprioVeiculo && motoristaSelecionado) {
        return (
            <View style={estilos.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                    <View style={estilos.linhaCabecalho}>
                        <BotaoVoltar />
                        <View style={estilos.centroCabecalho}>
                            <Ionicons name="car" size={28} color={cores.charcoal} />
                            <Text style={estilos.tituloCabecalho}>Meu Veículo</Text>
                        </View>
                        <View style={{ width: 44 }} />
                    </View>
                    <Text style={estilos.subtituloCabecalho}>Cavalo e conjunto vinculados a você</Text>
                </LinearGradient>

                <ScrollView style={estilos.listaContainer}>
                    {!motoristaSelecionado.cavalo ? (
                        <View style={estilos.containerVazio}>
                            <Ionicons name="car-outline" size={64} color={cores.dustGrey} />
                            <Text style={estilos.tituloVazio}>Nenhum cavalo vinculado</Text>
                            <Text style={estilos.textoVazio}>
                                Nenhum veículo foi vinculado à sua conta ainda.
                                Entre em contato com a administração.
                            </Text>
                        </View>
                    ) : (
                        <>
                            <Card style={estilos.cartao}>
                                <Card.Content>
                                    <View style={estilos.cabecalhoCartao}>
                                        <Text style={estilos.placaGrande}>{motoristaSelecionado.cavalo.placa}</Text>
                                        <View style={[estilos.badgeStatusAtivo, { backgroundColor: motoristaSelecionado.cavalo.ativa ? cores.charcoal : cores.dustGrey }]}>
                                                <Ionicons name={motoristaSelecionado.cavalo.ativa ? 'checkmark-circle' : 'close-circle'} size={14} color={motoristaSelecionado.cavalo.ativa ? cores.white : cores.grey} />
                                                <Text style={[estilos.textoBadgeStatusAtivo, { color: motoristaSelecionado.cavalo.ativa ? cores.white : cores.grey }]}>{motoristaSelecionado.cavalo.ativa ? 'Ativo' : 'Inativo'}</Text>
                                            </View>
                                    </View>
                                    <Text style={estilos.subtituloCavalo}>CAVALO</Text>
                                    <Divider style={estilos.divisor} />
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="car-sport" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Modelo: {motoristaSelecionado.cavalo.modelo}</Text>
                                    </View>
                                    {motoristaSelecionado.cavalo.ano && (
                                        <View style={estilos.linhaCard}>
                                            <Ionicons name="calendar" size={18} color={cores.grey} />
                                            <Text style={estilos.infoCartao}>Ano: {motoristaSelecionado.cavalo.ano}</Text>
                                        </View>
                                    )}
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="construct" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Vida útil do pneu: {motoristaSelecionado.cavalo.vidaUtilPneu}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="construct" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Última troca de óleo: {motoristaSelecionado.cavalo.ultimaTrocaOleo}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="alert-circle" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Próxima troca de óleo: {motoristaSelecionado.cavalo.proximaTrocaOleo}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="location" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Última atualização rastreador: {motoristaSelecionado.cavalo.ultimaAtualizacaoRastreador}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="alert-circle" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Próxima atualização rastreador: {motoristaSelecionado.cavalo.proximaAtualizacaoRastreador}</Text>
                                    </View>
                                    {motoristaSelecionado.cavalo.observacoes && (
                                        <Text style={estilos.descricaoCard}>{motoristaSelecionado.cavalo.observacoes}</Text>
                                    )}
                                </Card.Content>
                            </Card>

                            {motoristaSelecionado.conjunto && (
                                <Card style={estilos.cartao}>
                                    <Card.Content>
                                        <View style={estilos.cabecalhoCartao}>
                                            <Text style={estilos.placaGrande}>{motoristaSelecionado.conjunto.placa}</Text>
                                            {motoristaSelecionado.conjunto.placa2 && (
                                                <Text style={estilos.placaPequena}>+ {motoristaSelecionado.conjunto.placa2}</Text>
                                            )}
                                            <View style={[estilos.badgeStatusAtivo, { backgroundColor: motoristaSelecionado.conjunto.ativo ? cores.charcoal : cores.dustGrey }]}>
                                                    <Ionicons name={motoristaSelecionado.conjunto.ativo ? 'checkmark-circle' : 'close-circle'} size={14} color={motoristaSelecionado.conjunto.ativo ? cores.white : cores.grey} />
                                                    <Text style={[estilos.textoBadgeStatusAtivo, { color: motoristaSelecionado.conjunto.ativo ? cores.white : cores.grey }]}>{motoristaSelecionado.conjunto.ativo ? 'Ativo' : 'Inativo'}</Text>
                                                </View>
                                        </View>
                                        <Text style={estilos.subtituloConjunto}>
                                            {motoristaSelecionado.conjunto.tipo === 'bitrem' ? 'BITREM' : 'CARRETA SIMPLES'}
                                        </Text>
                                        <Divider style={estilos.divisor} />
                                        <View style={estilos.linhaCard}>
                                            <Ionicons name="car-sport" size={18} color={cores.grey} />
                                            <Text style={estilos.infoCartao}>Carreta 1: {motoristaSelecionado.conjunto.modelo}</Text>
                                        </View>
                                        {motoristaSelecionado.conjunto.modelo2 && (
                                            <View style={estilos.linhaCard}>
                                                <Ionicons name="car-sport" size={18} color={cores.grey} />
                                                <Text style={estilos.infoCartao}>Carreta 2: {motoristaSelecionado.conjunto.modelo2}</Text>
                                            </View>
                                        )}
                                        {motoristaSelecionado.conjunto.ano && (
                                            <View style={estilos.linhaCard}>
                                                <Ionicons name="calendar" size={18} color={cores.grey} />
                                                <Text style={estilos.infoCartao}>Ano: {motoristaSelecionado.conjunto.ano}</Text>
                                            </View>
                                        )}
                                        {motoristaSelecionado.conjunto.observacoes && (
                                            <Text style={estilos.descricaoCard}>{motoristaSelecionado.conjunto.observacoes}</Text>
                                        )}
                                    </Card.Content>
                                </Card>
                            )}
                        </>
                    )}
                </ScrollView>
            </View>
        );
    }

    if (podeVisualizarListaMotoristas && !motoristaSelecionado) {
        const totalCavalos = motoristas.filter(m => m.cavalo).length;

        return (
            <View style={estilos.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                    <View style={estilos.linhaCabecalho}>
                        <BotaoVoltar />
                        <View style={estilos.centroCabecalho}>
                            <Ionicons name="car" size={28} color={cores.charcoal} />
                            <Text style={estilos.tituloCabecalho}>Gestão de Veículos</Text>
                        </View>
                        {podeCadastrar && (
                            <View style={estilos.botoesCabecalhoDireita}>
                                <TouchableOpacity style={estilos.botaoAdicionarCabecalho} onPress={abrirModalNovoConjunto}>
                                    <Ionicons name="cube-outline" size={20} color={cores.white} />
                                </TouchableOpacity>
                            </View>
                        )}
                        {!podeCadastrar && <View style={{ width: 44 }} />}
                    </View>
                    <Text style={estilos.subtituloCabecalho}>
                        {podeCadastrar ? 'Cadastre conjuntos e vincule aos motoristas' : 'Visualize os veículos vinculados a cada motorista'}
                    </Text>
                </LinearGradient>

                <View style={estilos.containerBusca}>
                    <Ionicons name="search" size={20} color={cores.silver} />
                    <RNTextInput
                        style={estilos.inputBusca}
                        placeholder="Buscar motorista..."
                        value={buscaMotorista}
                        onChangeText={setBuscaMotorista}
                        placeholderTextColor={cores.silver}
                    />
                    {buscaMotorista !== '' && (
                        <TouchableOpacity onPress={() => setBuscaMotorista('')}>
                            <Ionicons name="close" size={20} color={cores.silver} />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={estilos.containerEstatisticas}>
                    <View style={estilos.cartaoEstatistica}>
                        <Text style={estilos.numeroEstatistica}>{motoristas.length}</Text>
                        <Text style={estilos.rotuloEstatistica}>Motoristas</Text>
                    </View>
                    <View style={estilos.cartaoEstatistica}>
                        <Text style={estilos.numeroEstatistica}>{totalCavalos}</Text>
                        <Text style={estilos.rotuloEstatistica}>Cavalos</Text>
                    </View>
                    {podeCadastrar && (
                        <View style={estilos.cartaoEstatistica}>
                            <Text style={estilos.numeroEstatistica}>{conjuntosDisponiveis.length}</Text>
                            <Text style={estilos.rotuloEstatistica}>Conjuntos</Text>
                        </View>
                    )}
                </View>

                <ScrollView style={estilos.listaContainer}>
                    {motoristasFiltrados.length === 0 ? (
                        <View style={estilos.containerVazio}>
                            <Ionicons name="people-outline" size={64} color={cores.dustGrey} />
                            <Text style={estilos.tituloVazio}>Nenhum motorista encontrado</Text>
                        </View>
                    ) : (
                        motoristasFiltrados.map((motorista) => (
                            <TouchableOpacity
                                key={motorista.uid}
                                style={estilos.cartaoMotorista}
                                onPress={() => setMotoristaSelecionado(motorista)}
                            >
                                <Avatar.Text size={50} label={motorista.nome.substring(0, 2).toUpperCase()} style={estilos.avatar} />
                                <View style={estilos.infoMotorista}>
                                    <Text style={estilos.nomeMotorista}>{motorista.nome}</Text>
                                    <Text style={estilos.emailMotorista}>{motorista.email}</Text>
                                    <View style={estilos.statusMotorista}>
                                        {motorista.cavalo ? (
                                            <View style={estilos.pillAtributo}>
                                                <Ionicons name="car" size={13} color={cores.grey} />
                                                <Text style={estilos.textoPillAtributo}>Cavalo: {motorista.cavalo.placa}</Text>
                                            </View>
                                        ) : (
                                            <View style={estilos.pillAtributoAlerta}>
                                                <Ionicons name="alert-circle" size={13} color={cores.charcoal} />
                                                <Text style={estilos.textoPillAtributoAlerta}>Sem cavalo</Text>
                                            </View>
                                        )}
                                        {motorista.conjunto && (
                                            <View style={estilos.pillAtributo}>
                                                <Ionicons name="cube-outline" size={13} color={cores.grey} />
                                                <Text style={estilos.textoPillAtributo}>Conjunto: {motorista.conjunto.placa}</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color={cores.silver} />
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>

                {podeCadastrar && (
                    <Modal visible={modalConjuntoVisivel} animationType="slide" transparent>
                        <View style={estilos.containerModal}>
                            <View style={estilos.conteudoModal}>
                                <View style={estilos.cabecalhoModal}>
                                    <Text style={estilos.tituloModal}>{editandoConjunto ? 'Editar Conjunto' : 'Novo Conjunto'}</Text>
                                    <TouchableOpacity onPress={() => setModalConjuntoVisivel(false)}>
                                        <Ionicons name="close" size={24} color={cores.grey} />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView>
                                    <Text style={estilos.rotuloModal}>Tipo do Conjunto *</Text>
                                    <View style={estilos.linhaTipo}>
                                        <TouchableOpacity
                                            style={[estilos.botaoTipo, tipoConjunto === 'carreta_simples' && estilos.botaoTipoAtivo]}
                                            onPress={() => {
                                                setTipoConjunto('carreta_simples');
                                                setPlaca2Texto('');
                                                setModelo2('');
                                            }}
                                        >
                                            <Ionicons name="car-outline" size={20} color={tipoConjunto === 'carreta_simples' ? cores.white : cores.grey} />
                                            <Text style={[estilos.textoTipo, tipoConjunto === 'carreta_simples' && estilos.textoTipoAtivo]}>Carreta Simples</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[estilos.botaoTipo, tipoConjunto === 'bitrem' && estilos.botaoTipoAtivo]}
                                            onPress={() => setTipoConjunto('bitrem')}
                                        >
                                            <Ionicons name="git-branch-outline" size={20} color={tipoConjunto === 'bitrem' ? cores.white : cores.grey} />
                                            <Text style={[estilos.textoTipo, tipoConjunto === 'bitrem' && estilos.textoTipoAtivo]}>Bitrem (2 carretas)</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={estilos.rotuloModal}>Placa da Carreta 1 *</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={placaTexto}
                                        onChangeText={setPlacaTexto}
                                        placeholder="Ex: DEF-5678"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                        autoCapitalize="characters"
                                    />

                                    <Text style={estilos.rotuloModal}>Modelo da Carreta 1 *</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={modelo}
                                        onChangeText={setModelo}
                                        placeholder="Ex: Randon SR 4000"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                    />

                                    {tipoConjunto === 'bitrem' && (
                                        <>
                                            <Text style={estilos.rotuloModal}>Placa da Carreta 2 *</Text>
                                            <TextInput
                                                mode="outlined"
                                                value={placa2Texto}
                                                onChangeText={setPlaca2Texto}
                                                placeholder="Ex: GHI-9012"
                                                style={estilos.inputModal}
                                                outlineColor={cores.dustGrey}
                                                activeOutlineColor={cores.primary}
                                                autoCapitalize="characters"
                                            />

                                            <Text style={estilos.rotuloModal}>Modelo da Carreta 2 *</Text>
                                            <TextInput
                                                mode="outlined"
                                                value={modelo2}
                                                onChangeText={setModelo2}
                                                placeholder="Ex: Randon SR 4500"
                                                style={estilos.inputModal}
                                                outlineColor={cores.dustGrey}
                                                activeOutlineColor={cores.primary}
                                            />
                                        </>
                                    )}

                                    <Text style={estilos.rotuloModal}>Ano</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={ano}
                                        onChangeText={setAno}
                                        placeholder="Ex: 2022"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                        keyboardType="numeric"
                                    />

                                    <Text style={estilos.rotuloModal}>Observações</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={observacoes}
                                        onChangeText={setObservacoes}
                                        placeholder="Informações adicionais..."
                                        multiline
                                        numberOfLines={3}
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                    />

                                    <View style={estilos.botoesModal}>
                                        <Button
                                            mode="outlined"
                                            onPress={() => setModalConjuntoVisivel(false)}
                                            style={estilos.botaoCancelarModal}
                                            labelStyle={estilos.rotuloCancelarModal}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            mode="contained"
                                            onPress={salvarConjunto}
                                            loading={estaSalvando}
                                            disabled={estaSalvando}
                                            style={estilos.botaoSalvarModal}
                                            labelStyle={estilos.rotuloSalvarModal}
                                        >
                                            Salvar
                                        </Button>
                                    </View>
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>
                )}
            </View>
        );
    }

    if (podeVisualizarDetalhesMotorista && motoristaSelecionado) {
        const cavalo = motoristaSelecionado.cavalo;
        const conjunto = motoristaSelecionado.conjunto;

        return (
            <View style={estilos.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                    <View style={estilos.linhaCabecalho}>
                        <TouchableOpacity onPress={voltarParaListaMotoristas} style={estilos.botaoVoltarCabecalho}>
                            <Ionicons name="arrow-back" size={24} color={cores.charcoal} />
                        </TouchableOpacity>
                        <View style={estilos.centroCabecalho}>
                            <Text style={estilos.tituloCabecalho}>{motoristaSelecionado.nome}</Text>
                            <Text style={estilos.subtituloCabecalho}>Veículos do motorista</Text>
                        </View>
                        <View style={estilos.botoesCabecalhoDireita}>
                            {podeCadastrar && (
                                <TouchableOpacity style={estilos.botaoAdicionarCabecalho} onPress={abrirModalNovoConjunto}>
                                    <Ionicons name="cube-outline" size={20} color={cores.white} />
                                </TouchableOpacity>
                            )}
                            {podeCadastrar && !cavalo && (
                                <TouchableOpacity
                                    style={estilos.botaoAdicionarCabecalho}
                                    onPress={() => abrirModalNovoCavalo(motoristaSelecionado)}
                                >
                                    <Ionicons name="add" size={24} color={cores.white} />
                                </TouchableOpacity>
                            )}
                            {!podeCadastrar && <View style={{ width: 44 }} />}
                        </View>
                    </View>
                </LinearGradient>

                <ScrollView style={estilos.listaContainer}>
                    {!cavalo ? (
                        <View style={estilos.containerVazio}>
                            <Ionicons name="car-outline" size={64} color={cores.dustGrey} />
                            <Text style={estilos.tituloVazio}>Nenhum cavalo vinculado</Text>
                            {podeCadastrar && (
                                <TouchableOpacity 
                                    style={estilos.botaoCadastrarCavaloVazio}
                                    onPress={() => abrirModalNovoCavalo(motoristaSelecionado)}
                                >
                                    <Ionicons name="add-circle" size={24} color={cores.white} />
                                    <Text style={estilos.textoBotaoCadastrarCavaloVazio}>CADASTRAR CAVALO</Text>
                                </TouchableOpacity>
                            )}
                            {!podeCadastrar && (
                                <Text style={estilos.textoVazio}>
                                    Este motorista ainda não possui um cavalo vinculado
                                </Text>
                            )}
                        </View>
                    ) : (
                        <>
                            <Card style={estilos.cartao}>
                                <Card.Content>
                                    <View style={estilos.cabecalhoCartao}>
                                        <Text style={estilos.placaGrande}>{cavalo.placa}</Text>
                                        <View style={[estilos.badgeStatusAtivo, { backgroundColor: cavalo.ativa ? cores.charcoal : cores.dustGrey }]}>
                                                <Ionicons name={cavalo.ativa ? 'checkmark-circle' : 'close-circle'} size={14} color={cavalo.ativa ? cores.white : cores.grey} />
                                                <Text style={[estilos.textoBadgeStatusAtivo, { color: cavalo.ativa ? cores.white : cores.grey }]}>{cavalo.ativa ? 'Ativo' : 'Inativo'}</Text>
                                            </View>
                                    </View>
                                    <Text style={estilos.subtituloCavalo}>CAVALO</Text>
                                    <Divider style={estilos.divisor} />
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="car-sport" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Modelo: {cavalo.modelo}</Text>
                                    </View>
                                    {cavalo.ano && (
                                        <View style={estilos.linhaCard}>
                                            <Ionicons name="calendar" size={18} color={cores.grey} />
                                            <Text style={estilos.infoCartao}>Ano: {cavalo.ano}</Text>
                                        </View>
                                    )}
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="construct" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Vida útil do pneu: {cavalo.vidaUtilPneu}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="construct" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Última troca de óleo: {cavalo.ultimaTrocaOleo}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="alert-circle" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Próxima troca de óleo: {cavalo.proximaTrocaOleo}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="location" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Última atualização rastreador: {cavalo.ultimaAtualizacaoRastreador}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="alert-circle" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Próxima atualização rastreador: {cavalo.proximaAtualizacaoRastreador}</Text>
                                    </View>
                                    {cavalo.observacoes && (
                                        <Text style={estilos.descricaoCard}>{cavalo.observacoes}</Text>
                                    )}
                                    
                                    {podeCadastrar && (
                                        <View style={estilos.acoesCartao}>
                                            <TouchableOpacity
                                                style={[estilos.botaoAcao, estilos.botaoEditar]}
                                                onPress={() => editarCavalo(cavalo)}
                                            >
                                                <Ionicons name="pencil" size={20} color={cores.white} />
                                                <Text style={estilos.textoBotaoAcao}>Editar Cavalo</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[estilos.botaoAcao, estilos.botaoAlternar]}
                                                onPress={() => toggleStatusCavalo(cavalo)}
                                            >
                                                <Ionicons name={cavalo.ativa ? 'eye-off' : 'eye'} size={20} color={cores.white} />
                                                <Text style={estilos.textoBotaoAcao}>{cavalo.ativa ? 'Desativar' : 'Ativar'}</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[estilos.botaoAcao, estilos.botaoExcluir]}
                                                onPress={() => excluirCavalo(cavalo)}
                                            >
                                                <Ionicons name="trash" size={20} color={cores.white} />
                                                <Text style={estilos.textoBotaoAcao}>Excluir</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </Card.Content>
                            </Card>

                            {conjunto && (
                                <Card style={estilos.cartao}>
                                    <Card.Content>
                                        <View style={estilos.cabecalhoCartao}>
                                            <Text style={estilos.placaGrande}>{conjunto.placa}</Text>
                                            {conjunto.placa2 && (
                                                <Text style={estilos.placaPequena}>+ {conjunto.placa2}</Text>
                                            )}
                                            <View style={[estilos.badgeStatusAtivo, { backgroundColor: conjunto.ativo ? cores.charcoal : cores.dustGrey }]}>
                                                    <Ionicons name={conjunto.ativo ? 'checkmark-circle' : 'close-circle'} size={14} color={conjunto.ativo ? cores.white : cores.grey} />
                                                    <Text style={[estilos.textoBadgeStatusAtivo, { color: conjunto.ativo ? cores.white : cores.grey }]}>{conjunto.ativo ? 'Ativo' : 'Inativo'}</Text>
                                                </View>
                                        </View>
                                        <Text style={estilos.subtituloConjunto}>
                                            {conjunto.tipo === 'bitrem' ? 'BITREM' : 'CARRETA SIMPLES'}
                                        </Text>
                                        <Divider style={estilos.divisor} />
                                        <View style={estilos.linhaCard}>
                                            <Ionicons name="car-sport" size={18} color={cores.grey} />
                                            <Text style={estilos.infoCartao}>Carreta 1: {conjunto.modelo}</Text>
                                        </View>
                                        {conjunto.modelo2 && (
                                            <View style={estilos.linhaCard}>
                                                <Ionicons name="car-sport" size={18} color={cores.grey} />
                                                <Text style={estilos.infoCartao}>Carreta 2: {conjunto.modelo2}</Text>
                                            </View>
                                        )}
                                        {conjunto.ano && (
                                            <View style={estilos.linhaCard}>
                                                <Ionicons name="calendar" size={18} color={cores.grey} />
                                                <Text style={estilos.infoCartao}>Ano: {conjunto.ano}</Text>
                                            </View>
                                        )}
                                        {conjunto.observacoes && (
                                            <Text style={estilos.descricaoCard}>{conjunto.observacoes}</Text>
                                        )}
                                        
                                        {podeCadastrar && (
                                            <View style={estilos.acoesCartao}>
                                                <TouchableOpacity
                                                    style={[estilos.botaoAcao, estilos.botaoEditar]}
                                                    onPress={() => editarConjunto(conjunto)}
                                                >
                                                    <Ionicons name="pencil" size={20} color={cores.white} />
                                                    <Text style={estilos.textoBotaoAcao}>Editar Conjunto</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[estilos.botaoAcao, estilos.botaoAlternar]}
                                                    onPress={() => toggleStatusConjunto(conjunto)}
                                                >
                                                    <Ionicons name={conjunto.ativo ? 'eye-off' : 'eye'} size={20} color={cores.white} />
                                                    <Text style={estilos.textoBotaoAcao}>{conjunto.ativo ? 'Desativar' : 'Ativar'}</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    style={[estilos.botaoAcao, estilos.botaoExcluir]}
                                                    onPress={() => excluirConjunto(conjunto)}
                                                >
                                                    <Ionicons name="trash" size={20} color={cores.white} />
                                                    <Text style={estilos.textoBotaoAcao}>Excluir</Text>
                                                </TouchableOpacity>
                                            </View>
                                        )}
                                    </Card.Content>
                                </Card>
                            )}
                        </>
                    )}
                </ScrollView>

                {podeCadastrar && (
                    <Modal visible={modalCavaloVisivel} animationType="slide" transparent>
                        <View style={estilos.containerModal}>
                            <View style={estilos.conteudoModal}>
                                <View style={estilos.cabecalhoModal}>
                                    <Text style={estilos.tituloModal}>{editandoCavalo ? 'Editar Cavalo' : 'Novo Cavalo'}</Text>
                                    <TouchableOpacity onPress={() => setModalCavaloVisivel(false)}>
                                        <Ionicons name="close" size={24} color={cores.grey} />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView>
                                    <Text style={estilos.rotuloModal}>Placa do Cavalo *</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={placaTexto}
                                        onChangeText={setPlacaTexto}
                                        placeholder="Ex: ABC-1234"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                        autoCapitalize="characters"
                                    />

                                    <Text style={estilos.rotuloModal}>Modelo *</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={modelo}
                                        onChangeText={setModelo}
                                        placeholder="Ex: Volvo FH 540"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                    />

                                    <Text style={estilos.rotuloModal}>Ano</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={ano}
                                        onChangeText={setAno}
                                        placeholder="Ex: 2022"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                        keyboardType="numeric"
                                    />

                                    <Text style={estilos.rotuloModal}>Motorista</Text>
                                    <View style={estilos.containerMotoristaInfo}>
                                        <Ionicons name="person" size={20} color={cores.primary} />
                                        <Text style={estilos.textoMotoristaInfo}>{motoristaSelecionado.nome}</Text>
                                    </View>

                                    <Text style={estilos.rotuloModal}>Vincular Conjunto (opcional)</Text>
                                    <TouchableOpacity style={estilos.seletorConjunto} onPress={() => setMostrarListaConjuntos(!mostrarListaConjuntos)}>
                                        <Text style={estilos.textoSeletorConjunto}>
                                            {conjuntoSelecionadoPlaca || 'Selecione um conjunto'}
                                        </Text>
                                        <Ionicons name={mostrarListaConjuntos ? 'chevron-up' : 'chevron-down'} size={20} color={cores.grey} />
                                    </TouchableOpacity>

                                    {mostrarListaConjuntos && (
                                        <View style={estilos.listaConjuntos}>
                                            <RNTextInput
                                                style={estilos.buscaConjunto}
                                                placeholder="Buscar conjunto por placa..."
                                                value={buscaConjunto}
                                                onChangeText={setBuscaConjunto}
                                                placeholderTextColor={cores.silver}
                                            />
                                            {conjuntosDisponiveisParaVincular().length === 0 ? (
                                                <Text style={estilos.textoListaVazia}>Nenhum conjunto disponível</Text>
                                            ) : (
                                                conjuntosDisponiveisParaVincular().map((c) => (
                                                    <TouchableOpacity
                                                        key={c.id}
                                                        style={estilos.itemConjunto}
                                                        onPress={() => selecionarConjunto(c)}
                                                    >
                                                        <View style={estilos.infoItemConjunto}>
                                                            <Text style={estilos.placaItemConjunto}>{c.placa}</Text>
                                                            {c.placa2 && (
                                                                <Text style={estilos.placaItemConjuntoPequeno}>+ {c.placa2}</Text>
                                                            )}
                                                            <Text style={estilos.modeloItemConjunto}>{c.modelo}</Text>
                                                        </View>
                                                        {conjuntoSelecionadoId === c.id && (
                                                            <Ionicons name="checkmark-circle" size={24} color={cores.charcoal} />
                                                        )}
                                                    </TouchableOpacity>
                                                ))
                                            )}
                                        </View>
                                    )}

                                    <Text style={estilos.rotuloModal}>Vida útil do pneu</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={vidaUtilPneu}
                                        onChangeText={setVidaUtilPneu}
                                        placeholder="Ex: 50.000 km"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                    />

                                    <Text style={estilos.rotuloModal}>Última troca de óleo</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={ultimaTrocaOleo}
                                        onChangeText={setUltimaTrocaOleo}
                                        placeholder="DD/MM/AAAA"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                    />

                                    <Text style={estilos.rotuloModal}>Próxima troca de óleo</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={proximaTrocaOleo}
                                        onChangeText={setProximaTrocaOleo}
                                        placeholder="DD/MM/AAAA"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                    />

                                    <Text style={estilos.rotuloModal}>Última atualização do rastreador</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={ultimaAtualizacaoRastreador}
                                        onChangeText={setUltimaAtualizacaoRastreador}
                                        placeholder="DD/MM/AAAA"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                    />

                                    <Text style={estilos.rotuloModal}>Próxima atualização do rastreador</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={proximaAtualizacaoRastreador}
                                        onChangeText={setProximaAtualizacaoRastreador}
                                        placeholder="DD/MM/AAAA"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                    />

                                    <Text style={estilos.rotuloModal}>Observações</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={observacoes}
                                        onChangeText={setObservacoes}
                                        placeholder="Informações adicionais..."
                                        multiline
                                        numberOfLines={3}
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                    />

                                    <View style={estilos.botoesModal}>
                                        <Button
                                            mode="outlined"
                                            onPress={() => setModalCavaloVisivel(false)}
                                            style={estilos.botaoCancelarModal}
                                            labelStyle={estilos.rotuloCancelarModal}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            mode="contained"
                                            onPress={salvarCavalo}
                                            loading={estaSalvando}
                                            disabled={estaSalvando}
                                            style={estilos.botaoSalvarModal}
                                            labelStyle={estilos.rotuloSalvarModal}
                                        >
                                            Salvar
                                        </Button>
                                    </View>
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>
                )}

                {podeCadastrar && (
                    <Modal visible={modalConjuntoVisivel} animationType="slide" transparent>
                        <View style={estilos.containerModal}>
                            <View style={estilos.conteudoModal}>
                                <View style={estilos.cabecalhoModal}>
                                    <Text style={estilos.tituloModal}>{editandoConjunto ? 'Editar Conjunto' : 'Novo Conjunto'}</Text>
                                    <TouchableOpacity onPress={() => setModalConjuntoVisivel(false)}>
                                        <Ionicons name="close" size={24} color={cores.grey} />
                                    </TouchableOpacity>
                                </View>
                                <ScrollView>
                                    <Text style={estilos.rotuloModal}>Tipo do Conjunto *</Text>
                                    <View style={estilos.linhaTipo}>
                                        <TouchableOpacity
                                            style={[estilos.botaoTipo, tipoConjunto === 'carreta_simples' && estilos.botaoTipoAtivo]}
                                            onPress={() => {
                                                setTipoConjunto('carreta_simples');
                                                setPlaca2Texto('');
                                                setModelo2('');
                                            }}
                                        >
                                            <Ionicons name="car-outline" size={20} color={tipoConjunto === 'carreta_simples' ? cores.white : cores.grey} />
                                            <Text style={[estilos.textoTipo, tipoConjunto === 'carreta_simples' && estilos.textoTipoAtivo]}>Carreta Simples</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[estilos.botaoTipo, tipoConjunto === 'bitrem' && estilos.botaoTipoAtivo]}
                                            onPress={() => setTipoConjunto('bitrem')}
                                        >
                                            <Ionicons name="git-branch-outline" size={20} color={tipoConjunto === 'bitrem' ? cores.white : cores.grey} />
                                            <Text style={[estilos.textoTipo, tipoConjunto === 'bitrem' && estilos.textoTipoAtivo]}>Bitrem (2 carretas)</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={estilos.rotuloModal}>Placa da Carreta 1 *</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={placaTexto}
                                        onChangeText={setPlacaTexto}
                                        placeholder="Ex: DEF-5678"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                        autoCapitalize="characters"
                                    />

                                    <Text style={estilos.rotuloModal}>Modelo da Carreta 1 *</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={modelo}
                                        onChangeText={setModelo}
                                        placeholder="Ex: Randon SR 4000"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                    />

                                    {tipoConjunto === 'bitrem' && (
                                        <>
                                            <Text style={estilos.rotuloModal}>Placa da Carreta 2 *</Text>
                                            <TextInput
                                                mode="outlined"
                                                value={placa2Texto}
                                                onChangeText={setPlaca2Texto}
                                                placeholder="Ex: GHI-9012"
                                                style={estilos.inputModal}
                                                outlineColor={cores.dustGrey}
                                                activeOutlineColor={cores.primary}
                                                autoCapitalize="characters"
                                            />

                                            <Text style={estilos.rotuloModal}>Modelo da Carreta 2 *</Text>
                                            <TextInput
                                                mode="outlined"
                                                value={modelo2}
                                                onChangeText={setModelo2}
                                                placeholder="Ex: Randon SR 4500"
                                                style={estilos.inputModal}
                                                outlineColor={cores.dustGrey}
                                                activeOutlineColor={cores.primary}
                                            />
                                        </>
                                    )}

                                    <Text style={estilos.rotuloModal}>Ano</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={ano}
                                        onChangeText={setAno}
                                        placeholder="Ex: 2022"
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                        keyboardType="numeric"
                                    />

                                    <Text style={estilos.rotuloModal}>Observações</Text>
                                    <TextInput
                                        mode="outlined"
                                        value={observacoes}
                                        onChangeText={setObservacoes}
                                        placeholder="Informações adicionais..."
                                        multiline
                                        numberOfLines={3}
                                        style={estilos.inputModal}
                                        outlineColor={cores.dustGrey}
                                        activeOutlineColor={cores.primary}
                                    />

                                    <View style={estilos.botoesModal}>
                                        <Button
                                            mode="outlined"
                                            onPress={() => setModalConjuntoVisivel(false)}
                                            style={estilos.botaoCancelarModal}
                                            labelStyle={estilos.rotuloCancelarModal}
                                        >
                                            Cancelar
                                        </Button>
                                        <Button
                                            mode="contained"
                                            onPress={salvarConjunto}
                                            loading={estaSalvando}
                                            disabled={estaSalvando}
                                            style={estilos.botaoSalvarModal}
                                            labelStyle={estilos.rotuloSalvarModal}
                                        >
                                            Salvar
                                        </Button>
                                    </View>
                                </ScrollView>
                            </View>
                        </View>
                    </Modal>
                )}
            </View>
        );
    }

    return (
        <View style={estilos.container}>
            <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                <View style={estilos.linhaCabecalho}>
                    <BotaoVoltar />
                    <View style={estilos.centroCabecalho}>
                        <Ionicons name="car" size={28} color={cores.charcoal} />
                        <Text style={estilos.tituloCabecalho}>Placas</Text>
                    </View>
                    <View style={{ width: 44 }} />
                </View>
                <Text style={estilos.subtituloCabecalho}>Acesso restrito</Text>
            </LinearGradient>
            <View style={estilos.containerAcessoNegado}>
                <Ionicons name="lock-closed" size={64} color={cores.error} />
                <Text style={estilos.tituloAcessoNegado}>Acesso Restrito</Text>
                <Text style={estilos.textoAcessoNegado}>
                    Apenas funcionários, gerentes e motoristas podem acessar esta tela.
                </Text>
            </View>
        </View>
    );
}

const estilos = StyleSheet.create({
    container: { flex: 1, backgroundColor: cores.platinum },
    containerCarregamento: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: cores.platinum },
    textoCarregamento: { marginTop: 16, color: cores.grey },
    
    cabecalho: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 24, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    linhaCabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    centroCabecalho: { alignItems: 'center' },
    tituloCabecalho: { fontSize: 27, fontWeight: 'bold', color: cores.charcoal, marginTop: 4 },
    subtituloCabecalho: { fontSize: 16, color: cores.grey, textAlign: 'center', marginTop: 8 },
    botaoVoltarCabecalho: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.white, alignItems: 'center', justifyContent: 'center', elevation: 2 },
    botaoAdicionarCabecalho: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.primary, alignItems: 'center', justifyContent: 'center', elevation: 2, marginLeft: 8 },
    botoesCabecalhoDireita: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    
    containerBusca: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.white, marginHorizontal: 16, marginTop: 16, marginBottom: 16, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: cores.dustGrey },
    inputBusca: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 22, color: cores.charcoal },
    
    containerEstatisticas: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
    cartaoEstatistica: { flex: 1, backgroundColor: cores.white, borderRadius: 16, padding: 12, alignItems: 'center', elevation: 2 },
    numeroEstatistica: { fontSize: 24, fontWeight: 'bold', color: cores.charcoal },
    rotuloEstatistica: { fontSize: 14, color: cores.grey, marginTop: 4 },
    
    listaContainer: { flex: 1, paddingHorizontal: 16 },
    containerVazio: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    tituloVazio: { fontSize: 24, fontWeight: '600', color: cores.charcoal, marginTop: 16 },
    textoVazio: { fontSize: 19, color: cores.grey, marginTop: 8, textAlign: 'center' },
    
    cartaoMotorista: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.white, borderRadius: 20, padding: 16, marginBottom: 12, elevation: 3 },
    avatar: { backgroundColor: cores.primary },
    infoMotorista: { flex: 1, marginLeft: 16 },
    nomeMotorista: { fontSize: 22, fontWeight: '600', color: cores.charcoal },
    emailMotorista: { fontSize: 16, color: cores.grey, marginTop: 2 },
    statusMotorista: { flexDirection: 'row', marginTop: 8, gap: 8, flexWrap: 'wrap' },
    pillAtributo: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.platinum, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, gap: 5 },
    textoPillAtributo: { fontSize: 16, color: cores.grey, fontWeight: '500' },
    pillAtributoAlerta: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.dustGrey, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, gap: 5 },
    textoPillAtributoAlerta: { fontSize: 16, color: cores.charcoal, fontWeight: '500' },
    
    cartao: { marginBottom: 16, borderRadius: 20, backgroundColor: cores.white, elevation: 3, overflow: 'hidden' },
    cabecalhoCartao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 },
    placaGrande: { fontSize: 32, fontWeight: 'bold', color: cores.charcoal, letterSpacing: 2 },
    placaPequena: { fontSize: 22, fontWeight: '500', color: cores.grey, marginLeft: 8 },
    badgeStatusAtivo: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
    textoBadgeStatusAtivo: { color: cores.white, fontSize: 15, fontWeight: 'bold' },
    subtituloCavalo: { fontSize: 16, color: cores.grey, marginTop: 4, fontWeight: '600' },
    subtituloConjunto: { fontSize: 16, color: cores.grey, marginTop: 4, fontWeight: '600' },
    divisor: { marginVertical: 12, backgroundColor: cores.dustGrey },
    linhaCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
    infoCartao: { fontSize: 19, color: cores.grey, flex: 1 },
    descricaoCard: { fontSize: 19, color: cores.charcoal, marginTop: 8, lineHeight: 27 },
    
    acoesCartao: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 12, flexWrap: 'wrap' },
    botaoAcao: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, gap: 6, minWidth: 100 },
    botaoEditar: { backgroundColor: cores.primary },
    botaoExcluir: { backgroundColor: cores.error },
    botaoAlternar: { backgroundColor: cores.warning },
    textoBotaoAcao: { color: cores.white, fontSize: 16, fontWeight: '600' },
    
    containerModal: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    conteudoModal: { backgroundColor: cores.white, margin: 20, borderRadius: 24, padding: 20, maxHeight: '90%' },
    cabecalhoModal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    tituloModal: { fontSize: 30, fontWeight: 'bold', color: cores.charcoal },
    rotuloModal: { fontSize: 19, fontWeight: '500', color: cores.charcoal, marginBottom: 8, marginTop: 12 },
    inputModal: { marginBottom: 16, backgroundColor: cores.white },
    containerMotoristaInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.platinum, borderRadius: 12, padding: 12, marginBottom: 16, gap: 8, borderWidth: 1, borderColor: cores.dustGrey },
    textoMotoristaInfo: { fontSize: 19, color: cores.charcoal, flex: 1 },
    
    linhaTipo: { flexDirection: 'row', gap: 12, marginBottom: 16 },
    botaoTipo: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 12, backgroundColor: cores.platinum, gap: 8, borderWidth: 1, borderColor: cores.dustGrey },
    botaoTipoAtivo: { backgroundColor: cores.primary, borderColor: cores.primary },
    textoTipo: { fontSize: 19, color: cores.grey },
    textoTipoAtivo: { color: cores.white, fontWeight: '600' },
    
    seletorConjunto: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: cores.platinum, borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: cores.dustGrey },
    textoSeletorConjunto: { fontSize: 19, color: cores.charcoal },
    listaConjuntos: { backgroundColor: cores.white, borderRadius: 12, borderWidth: 1, borderColor: cores.dustGrey, marginBottom: 16, maxHeight: 200 },
    buscaConjunto: { padding: 12, borderBottomWidth: 1, borderBottomColor: cores.dustGrey, fontSize: 19, color: cores.charcoal },
    textoListaVazia: { padding: 16, textAlign: 'center', color: cores.grey },
    itemConjunto: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: cores.dustGrey, justifyContent: 'space-between' },
    infoItemConjunto: { flex: 1 },
    placaItemConjunto: { fontSize: 22, fontWeight: 'bold', color: cores.charcoal },
    placaItemConjuntoPequeno: { fontSize: 16, color: cores.grey, marginTop: 2 },
    modeloItemConjunto: { fontSize: 16, color: cores.grey, marginTop: 2 },
    
    botoesModal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 12, marginBottom: 20 },
    botaoCancelarModal: { flex: 1, borderColor: cores.error, borderRadius: 12, backgroundColor: 'transparent' },
    rotuloCancelarModal: { color: cores.error, fontSize: 19, fontWeight: '600' },
    botaoSalvarModal: { flex: 1, backgroundColor: cores.primary, borderRadius: 12 },
    rotuloSalvarModal: { fontSize: 19, fontWeight: '600', color: cores.white },
    
    containerAcessoNegado: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    tituloAcessoNegado: { fontSize: 27, fontWeight: 'bold', color: cores.error, marginTop: 16 },
    textoAcessoNegado: { fontSize: 19, color: cores.grey, textAlign: 'center', marginTop: 8 },
    
    botaoCadastrarCavaloVazio: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: cores.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
        marginTop: 20,
        gap: 8,
    },
    textoBotaoCadastrarCavaloVazio: {
        color: cores.white,
        fontSize: 19,
        fontWeight: '600',
    },
});