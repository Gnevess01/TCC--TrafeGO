import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    query,
    serverTimestamp,
    Timestamp,
    updateDoc,
    where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Modal,
    Platform,
    TextInput as RNTextInput,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    Avatar,
    Button,
    Card,
    Divider,
    Text,
    TextInput,
} from 'react-native-paper';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { FiltroData, PeriodoType } from '../components/FiltroData';
import { auth, db } from '../servicos/firebaseConfig';
import { cores } from '../theme';

const TIPOS_DESPESA = [
    { nome: 'Combustível', icon: 'flame' as const, color: cores.charcoal },
    { nome: 'Manutenção', icon: 'construct' as const, color: cores.grey },
    { nome: 'Alimentação', icon: 'restaurant' as const, color: cores.warning },
    { nome: 'Outros', icon: 'ellipsis-horizontal' as const, color: cores.dustGrey },
];

interface Despesa {
    id: string;
    tipo: string;
    valor: number;
    descricao: string;
    data: string;
    placa: string;
    motoristaEmail: string;
    motoristaNome: string;
    motoristaId: string;
    status: 'Pendente' | 'Aprovado' | 'Rejeitado';
    imagemBase64?: string;
    motivoRejeicao?: string;
    criadoEm: Timestamp;
    aprovadoPor?: string;
    aprovadoPorNome?: string;
    aprovadoEm?: Timestamp;
}

interface Cavalo {
    placa: string;
    modelo: string;
    ativa: boolean;
    motoristaEmail: string;
}

interface Motorista {
    uid: string;
    nome: string;
    email: string;
    totalDespesas: number;
    totalValor: number;
    totalPendentes: number;
}

export default function DespesasScreen() {
    const [usuario, setUsuario] = useState<any>(null);
    const [cargo, setCargo] = useState<string>('');
    const [loading, setLoading] = useState(true);
    const [minhasDespesas, setMinhasDespesas] = useState<Despesa[]>([]);
    const [cavalos, setCavalos] = useState<Cavalo[]>([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [editando, setEditando] = useState<Despesa | null>(null);
    const [salvando, setSalvando] = useState(false);
    const [comprimindoImagem, setComprimindoImagem] = useState(false);
    
    const [buscaDescricao, setBuscaDescricao] = useState('');
    const [filtroPlaca, setFiltroPlaca] = useState('');
    const [filtroTipo, setFiltroTipo] = useState('');
    const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendentes' | 'aprovadas' | 'rejeitadas'>('todas');
    const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoType>('esteMes');
    const [dataInicio, setDataInicio] = useState<Date | null>(null);
    const [dataFim, setDataFim] = useState<Date | null>(null);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    
    const [formData, setFormData] = useState({
        tipo: '',
        valor: '',
        descricao: '',
        data: '',
        placa: '',
        imagemBase64: undefined as string | undefined,
    });
    
    const [motoristas, setMotoristas] = useState<Motorista[]>([]);
    const [motoristaSelecionado, setMotoristaSelecionado] = useState<Motorista | null>(null);
    const [despesasMotorista, setDespesasMotorista] = useState<Despesa[]>([]);
    const [busca, setBusca] = useState('');
    const [filtroPeriodoAdmin, setFiltroPeriodoAdmin] = useState<PeriodoType>('esteMes');
    const [dataInicioAdmin, setDataInicioAdmin] = useState<Date | null>(null);
    const [dataFimAdmin, setDataFimAdmin] = useState<Date | null>(null);
    
    const [justificativaModalVisivel, setJustificativaModalVisivel] = useState(false);
    const [despesaParaRejeitar, setDespesaParaRejeitar] = useState<Despesa | null>(null);
    const [motivoRejeicao, setMotivoRejeicao] = useState('');

    const isAdmin = cargo === 'gerente' || cargo === 'superadmin';
    const isFuncionario = cargo === 'funcionario';
    const isMotorista = cargo === 'motorista';
    const podeAprovar = isAdmin;
    const podeFiltrar = !isMotorista;
    const podeVerListaMotoristas = isAdmin || isFuncionario;

    const abrirImagemNovaAba = (base64: string) => {
        if (base64 && Platform.OS === 'web') {
            const win = window.open();
            win?.document.write(`
                <html>
                    <head>
                        <title>Visualizar Comprovante</title>
                        <style>
                            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #1a1a1a; }
                            img { max-width: 100%; max-height: 100vh; object-fit: contain; }
                            button { position: fixed; top: 20px; right: 20px; padding: 10px 20px; background: #ff4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 16px; }
                            button:hover { background: #cc0000; }
                        </style>
                    </head>
                    <body>
                        <button onclick="window.close()">Fechar</button>
                        <img src="${base64}" />
                    </body>
                </html>
            `);
        }
    };

    const filtrarPorPeriodo = (itens: Despesa[], periodo: PeriodoType, inicio?: Date | null, fim?: Date | null) => {
        if (periodo === 'todas') return itens;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const fimHoje = new Date();
        fimHoje.setHours(23, 59, 59, 999);
        let dataInicio: Date, dataFim: Date;
        switch (periodo) {
            case 'hoje':
                dataInicio = hoje;
                dataFim = fimHoje;
                break;
            case 'estaSemana': {
                const inicioSemana = new Date(hoje);
                const diaSemana = hoje.getDay();
                const diff = diaSemana === 0 ? 6 : diaSemana - 1;
                inicioSemana.setDate(hoje.getDate() - diff);
                inicioSemana.setHours(0, 0, 0, 0);
                const fimSemana = new Date(inicioSemana);
                fimSemana.setDate(inicioSemana.getDate() + 6);
                fimSemana.setHours(23, 59, 59, 999);
                dataInicio = inicioSemana;
                dataFim = fimSemana;
                break;
            }
            case 'esteMes': {
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                dataFim = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
                dataFim.setHours(23, 59, 59, 999);
                break;
            }
            case 'mesPassado': {
                dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                dataFim = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                dataFim.setHours(23, 59, 59, 999);
                break;
            }
            case 'ultimos3Meses': {
                dataInicio = new Date(hoje);
                dataInicio.setMonth(hoje.getMonth() - 3);
                dataInicio.setHours(0, 0, 0, 0);
                dataFim = fimHoje;
                break;
            }
            case 'anoAtual': {
                dataInicio = new Date(hoje.getFullYear(), 0, 1);
                dataFim = new Date(hoje.getFullYear(), 11, 31);
                dataFim.setHours(23, 59, 59, 999);
                break;
            }
            case 'personalizado':
                if (!inicio || !fim) return itens;
                dataInicio = new Date(inicio);
                dataInicio.setHours(0, 0, 0, 0);
                dataFim = new Date(fim);
                dataFim.setHours(23, 59, 59, 999);
                break;
            default:
                return itens;
        }
        return itens.filter(item => {
            if (!item.data) return false;
            const partes = item.data.split('/');
            if (partes.length !== 3) return false;
            const dia = parseInt(partes[0]);
            const mes = parseInt(partes[1]) - 1;
            const ano = parseInt(partes[2]);
            const dataItem = new Date(ano, mes, dia);
            dataItem.setHours(12, 0, 0, 0);
            return dataItem >= dataInicio && dataItem <= dataFim;
        });
    };

    const fetchMinhasDespesas = async () => {
        if (!usuario) return;
        setLoading(true);
        try {
            const q = query(collection(db, 'despesas'), where('motoristaEmail', '==', usuario.email));
            const querySnapshot = await getDocs(q);
            const lista: Despesa[] = [];
            querySnapshot.forEach((doc) => lista.push({ id: doc.id, ...doc.data() } as Despesa));
            lista.sort((a, b) => (b.criadoEm?.toDate?.() || new Date(0)).getTime() - (a.criadoEm?.toDate?.() || new Date(0)).getTime());
            setMinhasDespesas(lista);
        } catch (error) { } finally { setLoading(false); }
    };

    const fetchMeusCavalos = async () => {
        try {
            const q = query(
                collection(db, 'cavalos'),
                where('motoristaEmail', '==', usuario.email),
                where('ativa', '==', true)
            );
            const querySnapshot = await getDocs(q);
            const lista: Cavalo[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                lista.push({
                    placa: data.placa,
                    modelo: data.modelo,
                    ativa: data.ativa,
                    motoristaEmail: data.motoristaEmail,
                });
            });
            setCavalos(lista);
            if (lista.length > 0) {
                setFormData(prev => ({ ...prev, placa: lista[0].placa }));
            }
        } catch (error) {
        }
    };

    const processarImagemCapturada = async (uri: string, base64Original?: string) => {
        setComprimindoImagem(true);
        try {
            const imagemComprimida = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 800 } }],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );
            let base64String = '';
            if (imagemComprimida.base64) base64String = `data:image/jpeg;base64,${imagemComprimida.base64}`;
            else if (base64Original) base64String = `data:image/jpeg;base64,${base64Original}`;
            if (base64String) setFormData(prev => ({ ...prev, imagemBase64: base64String }));
        } catch (erro) {
            if (base64Original) setFormData(prev => ({ ...prev, imagemBase64: `data:image/jpeg;base64,${base64Original}` }));
        } finally { setComprimindoImagem(false); }
    };

    const tirarFotoEConverterBase64 = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {  return; }
        const resultado = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.5, base64: true });
        if (!resultado.canceled && resultado.assets[0] && resultado.assets[0].base64) {
            await processarImagemCapturada(resultado.assets[0].uri, resultado.assets[0].base64);
        }
    };

    const escolherDaGaleria = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {  return; }
        const resultado = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, quality: 0.5, base64: true });
        if (!resultado.canceled && resultado.assets[0] && resultado.assets[0].base64) {
            await processarImagemCapturada(resultado.assets[0].uri, resultado.assets[0].base64);
        }
    };

    const salvarDespesa = async () => {
        if (!formData.tipo) {  return; }
        const valorNumero = parseFloat(formData.valor);
        if (!formData.valor || isNaN(valorNumero) || valorNumero <= 0) {  return; }
        if (!formData.data) {  return; }
        if (!formData.placa) {  return; }
        if (!formData.imagemBase64) {  return; }
        const tamanhoMB = formData.imagemBase64.length / (1024 * 1024);
        if (tamanhoMB > 0.9) {  return; }
        setSalvando(true);
        try {
            const despesaData = {
                tipo: formData.tipo,
                valor: valorNumero,
                data: formData.data,
                placa: formData.placa.toUpperCase(),
                motoristaEmail: usuario.email,
                motoristaNome: usuario.nome,
                motoristaId: usuario.uid,
                status: 'Pendente',
                imagemBase64: formData.imagemBase64,
                criadoEm: serverTimestamp(),
            };
            if (editando) await updateDoc(doc(db, 'despesas', editando.id), despesaData);
            else await addDoc(collection(db, 'despesas'), despesaData);
            
            setModalVisible(false); setEditando(null); limparFormulario(); fetchMinhasDespesas();
        } catch (error) { } finally { setSalvando(false); }
    };

    const excluirDespesa = async (id: string) => {
        try {
            setLoading(true);
            await deleteDoc(doc(db, 'despesas', id));
            if (motoristaSelecionado) {
                await fetchDespesasDoMotorista(motoristaSelecionado);
                await fetchMotoristas();
            } else if (cargo === 'motorista') {
                await fetchMinhasDespesas();
            } else {
                await fetchMinhasDespesas();
                await fetchMotoristas();
            }
        } catch (error: any) {
        } finally {
            setLoading(false);
        }
    };

    const editarDespesa = (despesa: Despesa) => {
        setEditando(despesa);
        setFormData({
            tipo: despesa.tipo,
            valor: despesa.valor.toString(),
            descricao: despesa.descricao,
            data: despesa.data,
            placa: despesa.placa,
            imagemBase64: despesa.imagemBase64 || undefined,
        });
        setModalVisible(true);
    };

    const limparFormulario = () => {
        const placaInicial = cavalos.length > 0 ? cavalos[0].placa : '';
        setFormData({
            tipo: '',
            valor: '',
            descricao: '',
            data: new Date().toLocaleDateString('pt-BR'),
            placa: placaInicial,
            imagemBase64: undefined,
        });
    };

    const fetchMotoristas = async () => {
        setLoading(true);
        try {
            const q = query(collection(db, 'usuarios'), where('cargo', '==', 'motorista'), where('ativo', '==', true));
            const querySnapshot = await getDocs(q);
            const lista: Motorista[] = [];
            for (const doc of querySnapshot.docs) {
                const data = doc.data();
                const despesasQuery = query(collection(db, 'despesas'), where('motoristaEmail', '==', data.email));
                const despesasSnap = await getDocs(despesasQuery);
                let totalValor = 0, totalPendentes = 0;
                despesasSnap.forEach((d) => { totalValor += d.data().valor; if (d.data().status === 'Pendente') totalPendentes++; });
                lista.push({
                    uid: doc.id,
                    nome: data.nome,
                    email: data.email,
                    totalDespesas: despesasSnap.size,
                    totalValor: totalValor,
                    totalPendentes: totalPendentes,
                });
            }
            setMotoristas(lista);
        } catch (error) { } finally { setLoading(false); }
    };

    const fetchDespesasDoMotorista = async (motorista: Motorista) => {
        setLoading(true);
        try {
            const q = query(collection(db, 'despesas'), where('motoristaEmail', '==', motorista.email));
            const querySnapshot = await getDocs(q);
            const lista: Despesa[] = [];
            querySnapshot.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() } as Despesa);
            });
            lista.sort((a, b) => (b.criadoEm?.toDate?.() || new Date(0)).getTime() - (a.criadoEm?.toDate?.() || new Date(0)).getTime());
            setDespesasMotorista(lista);
            setMotoristaSelecionado(motorista);
        } catch (error) { } finally { setLoading(false); }
    };

    const aprovarDespesa = async (despesa: Despesa) => {
        if (!podeAprovar) return;
        try {
            await updateDoc(doc(db, 'despesas', despesa.id), {
                status: 'Aprovado',
                aprovadoPor: usuario?.uid || auth.currentUser?.uid,
                aprovadoPorNome: usuario?.nome || auth.currentUser?.email?.split('@')[0],
                aprovadoEm: serverTimestamp()
            });
            
            if (motoristaSelecionado) {
                await fetchDespesasDoMotorista(motoristaSelecionado);
            } else {
                await fetchMinhasDespesas();
            }
        } catch (error) {
            
        }
    };

    const rejeitarDespesa = async () => {
        if (!podeAprovar) return;
        if (!motivoRejeicao.trim()) {
            
            return;
        }
        if (!despesaParaRejeitar) return;

        try {
            await updateDoc(doc(db, 'despesas', despesaParaRejeitar.id), {
                status: 'Rejeitado',
                motivoRejeicao: motivoRejeicao.trim(),
                aprovadoPor: usuario?.uid || auth.currentUser?.uid,
                aprovadoPorNome: usuario?.nome || auth.currentUser?.email?.split('@')[0],
                aprovadoEm: serverTimestamp()
            });
            
            setJustificativaModalVisivel(false);
            setDespesaParaRejeitar(null);
            setMotivoRejeicao('');
            if (motoristaSelecionado) {
                await fetchDespesasDoMotorista(motoristaSelecionado);
            } else {
                await fetchMinhasDespesas();
            }
        } catch (error) {
            
        }
    };

    const voltarParaLista = () => {
        setMotoristaSelecionado(null);
        setDespesasMotorista([]);
    };

    const formatarData = (timestamp: Timestamp) => timestamp?.toDate?.().toLocaleDateString('pt-BR') || '';
    const formatarMoeda = (valor: number) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const getStatusColor = (status: string) => status === 'Aprovado' ? cores.success : status === 'Rejeitado' ? cores.error : cores.warning;
    const obterInfoTipo = (nomeTipo: string) => TIPOS_DESPESA.find(t => t.nome === nomeTipo) || TIPOS_DESPESA[TIPOS_DESPESA.length - 1];
    const getStatusText = (status: string) => status === 'Aprovado' ? 'Aprovado' : status === 'Rejeitado' ? 'Rejeitado' : 'Pendente';

    const limparFiltros = () => {
        setBuscaDescricao('');
        setFiltroPlaca('');
        setFiltroTipo('');
        setFiltroStatus('todas');
        setFiltroPeriodo('esteMes');
        setDataInicio(null);
        setDataFim(null);
    };

    const motoristasFiltrados = motoristas.filter(m => 
        m.nome.toLowerCase().includes(busca.toLowerCase()) || 
        m.email.toLowerCase().includes(busca.toLowerCase())
    );
    
    const minhasDespesasFiltradas = () => {
        let filtradas = minhasDespesas;
        
        if (podeFiltrar) {
            if (buscaDescricao) {
                filtradas = filtradas.filter(d =>
                    d.descricao.toLowerCase().includes(buscaDescricao.toLowerCase()) ||
                    d.tipo.toLowerCase().includes(buscaDescricao.toLowerCase())
                );
            }
            if (filtroPlaca) {
                filtradas = filtradas.filter(d =>
                    d.placa.toLowerCase().includes(filtroPlaca.toLowerCase())
                );
            }
            if (filtroTipo) {
                filtradas = filtradas.filter(d =>
                    d.tipo.toLowerCase().includes(filtroTipo.toLowerCase())
                );
            }
            if (filtroStatus !== 'todas') {
                filtradas = filtradas.filter(d => {
                    if (filtroStatus === 'pendentes') return d.status === 'Pendente';
                    if (filtroStatus === 'aprovadas') return d.status === 'Aprovado';
                    if (filtroStatus === 'rejeitadas') return d.status === 'Rejeitado';
                    return true;
                });
            }
        }
        
        filtradas = filtrarPorPeriodo(filtradas, filtroPeriodo, dataInicio, dataFim);
        
        return filtradas;
    };
    
    const despesasMotoristaFiltradas = () => {
        let filtradas = despesasMotorista;
        if (filtroStatus !== 'todas') filtradas = filtradas.filter(d => {
            if (filtroStatus === 'pendentes') return d.status === 'Pendente';
            if (filtroStatus === 'aprovadas') return d.status === 'Aprovado';
            if (filtroStatus === 'rejeitadas') return d.status === 'Rejeitado';
            return true;
        });
        return filtrarPorPeriodo(filtradas, filtroPeriodoAdmin, dataInicioAdmin, dataFimAdmin);
    };

    useEffect(() => {
        const fetchUsuario = async () => {
            if (!auth.currentUser) return;
            const q = query(collection(db, 'usuarios'), where('email', '==', auth.currentUser.email));
            const querySnapshot = await getDocs(q);
            querySnapshot.forEach((doc) => { const data = doc.data(); setUsuario({ uid: doc.id, nome: data.nome, email: data.email, cargo: data.cargo }); setCargo(data.cargo); });
            setLoading(false);
        };
        fetchUsuario();
    }, []);

    useEffect(() => {
        if (cargo === 'motorista' && usuario) {
            fetchMinhasDespesas();
            fetchMeusCavalos();
            setFormData(prev => ({ ...prev, data: new Date().toLocaleDateString('pt-BR') }));
        } else if ((cargo === 'funcionario' || cargo === 'gerente' || cargo === 'superadmin') && usuario) {
            fetchMotoristas();
        }
    }, [cargo, usuario]);

    if (loading) {
        return (
            <View style={styles.containerCarregamento}>
                <ActivityIndicator size="large" color={cores.charcoal} />
                <Text style={styles.textoCarregamento}>Carregando...</Text>
            </View>
        );
    }

    if (podeVerListaMotoristas && !motoristaSelecionado) {
        const totalDespesas = motoristas.reduce((sum, m) => sum + m.totalDespesas, 0);
        const totalPendentes = motoristas.reduce((sum, m) => sum + m.totalPendentes, 0);
        const totalValor = motoristas.reduce((sum, m) => sum + m.totalValor, 0);

        return (
            <View style={styles.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={styles.cabecalho}>
                    <View style={styles.linhaCabecalho}>
                        <BotaoVoltar />
                        <View style={styles.centroCabecalho}>
                            <Ionicons name="cash" size={28} color={cores.charcoal} />
                            <Text style={styles.tituloCabecalho}>Gestão de Despesas</Text>
                        </View>
                        <View style={{ width: 44 }} />
                    </View>
                </LinearGradient>

                <View style={styles.containerBusca}>
                    <Ionicons name="search" size={20} color={cores.silver} />
                    <RNTextInput
                        style={styles.inputBusca}
                        placeholder="Buscar motorista..."
                        value={busca}
                        onChangeText={setBusca}
                        placeholderTextColor={cores.silver}
                    />
                    {busca !== '' && (<TouchableOpacity onPress={() => setBusca('')}><Ionicons name="close" size={20} color={cores.silver} /></TouchableOpacity>)}
                </View>

                <View style={styles.containerEstatisticas}>
                    <View style={styles.cartaoEstatistica}><Text style={styles.numeroEstatistica}>{motoristas.length}</Text><Text style={styles.rotuloEstatistica}>Motoristas</Text></View>
                    <View style={styles.cartaoEstatistica}><Text style={[styles.numeroEstatistica, { color: cores.warning }]}>{totalPendentes}</Text><Text style={styles.rotuloEstatistica}>Pendentes</Text></View>
                    <View style={styles.cartaoEstatistica}><Text style={styles.numeroEstatistica}>{totalDespesas}</Text><Text style={styles.rotuloEstatistica}>Total Despesas</Text></View>
                    <View style={styles.cartaoEstatistica}><Text style={styles.numeroEstatistica}>{formatarMoeda(totalValor)}</Text><Text style={styles.rotuloEstatistica}>Valor Total</Text></View>
                </View>

                <ScrollView style={styles.listaContainer}>
                    {motoristasFiltrados.length === 0 ? (
                        <View style={styles.containerVazio}><Ionicons name="people-outline" size={64} color={cores.dustGrey} /><Text style={styles.tituloVazio}>Nenhum motorista</Text></View>
                    ) : (
                        motoristasFiltrados.map((motorista) => (
                            <TouchableOpacity key={motorista.uid} style={styles.cartaoMotorista} onPress={() => fetchDespesasDoMotorista(motorista)}>
                                <Avatar.Text size={50} label={motorista.nome.substring(0, 2).toUpperCase()} style={styles.avatar} />
                                <View style={styles.motoristaInfo}>
                                    <Text style={styles.motoristaNome}>{motorista.nome}</Text>
                                    <Text style={styles.motoristaEmail}>{motorista.email}</Text>
                                    <View style={styles.motoristaStats}>
                                        <View style={styles.pilulaEstatistica}>
                                            <Ionicons name="receipt-outline" size={13} color={cores.grey} />
                                            <Text style={styles.textoPilulaEstatistica}>{motorista.totalDespesas} {motorista.totalDespesas === 1 ? 'despesa' : 'despesas'}</Text>
                                        </View>
                                        <View style={styles.pilulaEstatistica}>
                                            <Ionicons name="cash-outline" size={13} color={cores.grey} />
                                            <Text style={styles.textoPilulaEstatistica}>{formatarMoeda(motorista.totalValor)}</Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={styles.pendentesBadge}><Text style={styles.pendentesNumero}>{motorista.totalPendentes}</Text><Text style={styles.pendentesLabel}>pendentes</Text></View>
                                <Ionicons name="chevron-forward" size={24} color={cores.silver} />
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            </View>
        );
    }

    if (podeVerListaMotoristas && motoristaSelecionado) {
        const despesasFiltradas = despesasMotoristaFiltradas();
        const pendentes = despesasFiltradas.filter(d => d.status === 'Pendente').length;
        const totalValorAdmin = despesasFiltradas.reduce((sum, d) => sum + d.valor, 0);

        return (
            <View style={styles.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={styles.cabecalho}>
                    <View style={styles.linhaCabecalho}>
                        <TouchableOpacity onPress={voltarParaLista} style={styles.botaoVoltar}><Ionicons name="arrow-back" size={24} color={cores.charcoal} /></TouchableOpacity>
                        <View style={styles.centroCabecalho}><Text style={styles.tituloCabecalho}>{motoristaSelecionado.nome}</Text></View>
                        <TouchableOpacity onPress={() => setMostrarFiltros(!mostrarFiltros)} style={styles.botaoFiltroHeader}>
                            <Ionicons name="options-outline" size={20} color={cores.charcoal} />
                            <Text style={styles.textoFiltroHeader}>Filtro</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                <View style={styles.containerEstatisticas}>
                    <View style={styles.cartaoEstatistica}><Text style={styles.numeroEstatistica}>{despesasFiltradas.length}</Text><Text style={styles.rotuloEstatistica}>Total</Text></View>
                    <View style={styles.cartaoEstatistica}><Text style={[styles.numeroEstatistica, { color: cores.warning }]}>{pendentes}</Text><Text style={styles.rotuloEstatistica}>Pendentes</Text></View>
                    <View style={styles.cartaoEstatistica}><Text style={styles.numeroEstatistica}>{formatarMoeda(totalValorAdmin)}</Text><Text style={styles.rotuloEstatistica}>Valor Total</Text></View>
                </View>

                {mostrarFiltros && (
                    <View style={styles.filtrosContainer}>
                        <ScrollView style={styles.filtrosScroll}>
                            <Text style={styles.filtrosTitle}>Filtrar despesas</Text>
                            
                            <View style={styles.filtroCampo}>
                                <Ionicons name="search" size={20} color={cores.grey} />
                                <TextInput mode="flat" placeholder="Descricão" value={buscaDescricao} onChangeText={setBuscaDescricao} style={styles.filtroInput} />
                                {buscaDescricao !== '' && (<TouchableOpacity onPress={() => setBuscaDescricao('')}><Ionicons name="close" size={18} color={cores.silver} /></TouchableOpacity>)}
                            </View>

                            <View style={styles.filtroCampo}>
                                <Ionicons name="car" size={20} color={cores.grey} />
                                <TextInput mode="flat" placeholder="Placa" value={filtroPlaca} onChangeText={setFiltroPlaca} style={styles.filtroInput} />
                                {filtroPlaca !== '' && (<TouchableOpacity onPress={() => setFiltroPlaca('')}><Ionicons name="close" size={18} color={cores.silver} /></TouchableOpacity>)}
                            </View>

                            <View style={styles.filtroCampo}>
                                <Ionicons name="cash" size={20} color={cores.grey} />
                                <TextInput mode="flat" placeholder="Tipo de despesa" value={filtroTipo} onChangeText={setFiltroTipo} style={styles.filtroInput} />
                                {filtroTipo !== '' && (<TouchableOpacity onPress={() => setFiltroTipo('')}><Ionicons name="close" size={18} color={cores.silver} /></TouchableOpacity>)}
                            </View>

                            <Text style={styles.filtroLabel}>Status</Text>
                            <View style={styles.linhaFiltro}>
                                <TouchableOpacity
                                    style={[styles.chipFiltro, filtroStatus === 'todas' && styles.chipFiltroAtivo]}
                                    onPress={() => setFiltroStatus('todas')}
                                >
                                    <Text style={[styles.textoChipFiltro, filtroStatus === 'todas' && styles.textoChipFiltroAtivo]}>Todas</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.chipFiltro, filtroStatus === 'pendentes' && styles.chipFiltroAtivo]}
                                    onPress={() => setFiltroStatus('pendentes')}
                                >
                                    <Text style={[styles.textoChipFiltro, filtroStatus === 'pendentes' && styles.textoChipFiltroAtivo]}>Pendentes</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.chipFiltro, filtroStatus === 'aprovadas' && styles.chipFiltroAtivo]}
                                    onPress={() => setFiltroStatus('aprovadas')}
                                >
                                    <Text style={[styles.textoChipFiltro, filtroStatus === 'aprovadas' && styles.textoChipFiltroAtivo]}>Aprovadas</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.chipFiltro, filtroStatus === 'rejeitadas' && styles.chipFiltroAtivo]}
                                    onPress={() => setFiltroStatus('rejeitadas')}
                                >
                                    <Text style={[styles.textoChipFiltro, filtroStatus === 'rejeitadas' && styles.textoChipFiltroAtivo]}>Rejeitadas</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={styles.botaoLimparFiltros} onPress={limparFiltros}>
                                <Ionicons name="refresh" size={18} color={cores.white} />
                                <Text style={styles.textoLimparFiltros}>Limpar filtros</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                )}

                <FiltroData 
                    periodo={filtroPeriodoAdmin} 
                    setPeriodo={setFiltroPeriodoAdmin} 
                    dataInicio={dataInicioAdmin} 
                    setDataInicio={setDataInicioAdmin} 
                    dataFim={dataFimAdmin} 
                    setDataFim={setDataFimAdmin} 
                    showPersonalizado={true} 
                />

                <ScrollView style={styles.listaContainer}>
                    {despesasFiltradas.length === 0 ? (
                        <View style={styles.containerVazio}><Ionicons name="cash-outline" size={64} color={cores.dustGrey} /><Text style={styles.tituloVazio}>Nenhuma despesa</Text></View>
                    ) : (
                        despesasFiltradas.map((despesa) => (
                            <Card key={despesa.id} style={styles.cartao}>
                                {despesa.imagemBase64 && (
                                    <TouchableOpacity onPress={() => abrirImagemNovaAba(despesa.imagemBase64!)} activeOpacity={0.9}>
                                        <Image source={{ uri: despesa.imagemBase64 }} style={styles.imagemCartao} resizeMode="cover" />
                                    </TouchableOpacity>
                                )}
                                <Card.Content>
                                    <View style={styles.cabecalhoCartao}>
                                        <View style={styles.chipTipoComIcone}>
                                            <Ionicons name={obterInfoTipo(despesa.tipo).icon} size={14} color={cores.grey} />
                                            <Text style={styles.textoChipTipo}>{despesa.tipo}</Text>
                                        </View>
                                        <View style={[styles.badgeStatus, { backgroundColor: getStatusColor(despesa.status) }]}><Text style={styles.textoStatus}>{getStatusText(despesa.status)}</Text></View>
                                        <Text style={styles.dataCartao}>{formatarData(despesa.criadoEm)}</Text>
                                    </View>
                                    <Divider style={styles.divisor} />
                                    <Text style={styles.valorCartao}>{formatarMoeda(despesa.valor)}</Text>
                                    <View style={styles.linhaCartao}><Ionicons name="calendar" size={18} color={cores.grey} /><Text style={styles.infoCartao}>Data: {despesa.data}</Text></View>
                                    <View style={styles.linhaCartao}><Ionicons name="car" size={18} color={cores.grey} /><Text style={styles.infoCartao}>Placa: {despesa.placa}</Text></View>
                                    {despesa.descricao && <View style={styles.linhaCartao}><Ionicons name="document-text" size={18} color={cores.grey} /><Text style={styles.infoCartao}>{despesa.descricao}</Text></View>}
                                    {despesa.status === 'Rejeitado' && despesa.motivoRejeicao && (
                                        <View style={styles.motivoRejeicaoContainer}>
                                            <Ionicons name="alert-circle" size={18} color={cores.error} />
                                            <View style={styles.motivoRejeicaoContent}>
                                                <Text style={styles.motivoRejeicaoLabel}>Motivo:</Text>
                                                <Text style={styles.motivoRejeicaoText}>{despesa.motivoRejeicao}</Text>
                                            </View>
                                        </View>
                                    )}
                                    
                                    {podeAprovar && despesa.status === 'Pendente' && (
                                        <View style={styles.botoesAprovacao}>
                                            <TouchableOpacity style={[styles.botaoAprovar, { backgroundColor: cores.success }]} onPress={() => aprovarDespesa(despesa)}>
                                                <Ionicons name="checkmark" size={20} color={cores.white} /><Text style={styles.textoAprovar}>Aprovar</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity style={[styles.botaoAprovar, { backgroundColor: cores.error }]} onPress={() => {
                                                setDespesaParaRejeitar(despesa);
                                                setMotivoRejeicao('');
                                                setJustificativaModalVisivel(true);
                                            }}>
                                                <Ionicons name="close" size={20} color={cores.white} /><Text style={styles.textoAprovar}>Rejeitar</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    
                                    {!podeAprovar && despesa.status === 'Pendente' && (
                                        <View style={styles.statusPendenteInfo}>
                                            <Ionicons name="time-outline" size={16} color={cores.warning} />
                                            <Text style={styles.statusPendenteTexto}>Aguardando aprovação</Text>
                                        </View>
                                    )}
                                </Card.Content>
                            </Card>
                        ))
                    )}
                </ScrollView>
                
                <Modal visible={justificativaModalVisivel} transparent animationType="fade" onRequestClose={() => setJustificativaModalVisivel(false)}>
                    <View style={styles.overlayModalRejeicao}>
                        <View style={styles.conteudoModalRejeicao}>
                            <View style={styles.cabecalhoModalRejeicao}>
                                <Ionicons name="close-circle" size={40} color={cores.error} />
                                <Text style={styles.tituloModalRejeicao}>Rejeitar Despesa</Text>
                            </View>
                            <TextInput
                                mode="outlined"
                                label="Motivo da rejeição"
                                value={motivoRejeicao}
                                onChangeText={setMotivoRejeicao}
                                multiline
                                numberOfLines={4}
                                style={styles.inputModalRejeicao}
                                outlineColor={cores.dustGrey}
                                activeOutlineColor={cores.error}
                                placeholder="Descreva o motivo da rejeição..."
                            />
                            <View style={styles.botoesModalRejeicao}>
                                <TouchableOpacity style={styles.botaoCancelarRejeicao} onPress={() => { setJustificativaModalVisivel(false); setDespesaParaRejeitar(null); setMotivoRejeicao(''); }}>
                                    <Text style={styles.textoCancelarRejeicao}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.botaoConfirmarRejeicao} onPress={rejeitarDespesa}>
                                    <Ionicons name="close" size={20} color={cores.white} />
                                    <Text style={styles.textoConfirmarRejeicao}>Rejeitar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    if (cargo === 'motorista') {
        if (cavalos.length === 0) {
            return (
                <View style={styles.container}>
                    <LinearGradient colors={[cores.white, cores.platinum]} style={styles.cabecalho}>
                        <View style={styles.linhaCabecalho}>
                            <BotaoVoltar />
                            <View style={styles.centroCabecalho}>
                                <Ionicons name="cash" size={28} color={cores.charcoal} />
                                <Text style={styles.tituloCabecalho}>Minhas Despesas</Text>
                            </View>
                            <View style={{ width: 44 }} />
                        </View>
                    </LinearGradient>
                    
                    <View style={styles.containerVazio}>
                        <Ionicons name="car-outline" size={64} color={cores.dustGrey} />
                        <Text style={styles.tituloVazio}>Nenhum cavalo vinculado</Text>
                        <Text style={styles.textoVazio}>
                            Voce precisa ter um cavalo vinculado para registrar despesas.
                        </Text>
                        <Text style={styles.subtextoVazio}>
                            Entre em contato com o administrador para vincular um cavalo ao seu cadastro.
                        </Text>
                    </View>
                </View>
            );
        }

        const despesasFiltradasMotorista = minhasDespesasFiltradas();
        const pendentesCount = despesasFiltradasMotorista.filter(d => d.status === 'Pendente').length;
        const aprovadasCount = despesasFiltradasMotorista.filter(d => d.status === 'Aprovado').length;
        const rejeitadasCount = despesasFiltradasMotorista.filter(d => d.status === 'Rejeitado').length;
        const totalValorMotorista = despesasFiltradasMotorista.reduce((sum, d) => sum + d.valor, 0);

        return (
            <View style={styles.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={styles.cabecalho}>
                    <View style={styles.linhaCabecalho}>
                        <BotaoVoltar />
                        <View style={styles.centroCabecalho}>
                            <Ionicons name="cash" size={28} color={cores.charcoal} />
                            <Text style={styles.tituloCabecalho}>Minhas Despesas</Text>
                        </View>
                        <View style={{ width: 44 }} />
                    </View>
                </LinearGradient>

                <View style={styles.containerEstatisticas}>
                    <View style={styles.cartaoEstatistica}><Text style={styles.numeroEstatistica}>{despesasFiltradasMotorista.length}</Text><Text style={styles.rotuloEstatistica}>Total</Text></View>
                    <View style={styles.cartaoEstatistica}><Text style={[styles.numeroEstatistica, { color: cores.warning }]}>{pendentesCount}</Text><Text style={styles.rotuloEstatistica}>Pendentes</Text></View>
                    <View style={styles.cartaoEstatistica}><Text style={[styles.numeroEstatistica, { color: cores.success }]}>{aprovadasCount}</Text><Text style={styles.rotuloEstatistica}>Aprovadas</Text></View>
                    <View style={styles.cartaoEstatistica}><Text style={[styles.numeroEstatistica, { color: cores.error }]}>{rejeitadasCount}</Text><Text style={styles.rotuloEstatistica}>Rejeitadas</Text></View>
                    <View style={styles.cartaoEstatistica}><Text style={styles.numeroEstatistica}>{formatarMoeda(totalValorMotorista)}</Text><Text style={styles.rotuloEstatistica}>Total Gasto</Text></View>
                </View>

                <TouchableOpacity style={styles.botaoAdicionar} onPress={() => { setEditando(null); limparFormulario(); setModalVisible(true); }}>
                    <LinearGradient colors={[cores.charcoal, cores.grey]} style={styles.gradienteAdicionar}>
                        <Ionicons name="add" size={24} color={cores.white} />
                        <Text style={styles.textoBotaoAdicionar}>NOVA DESPESA</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <ScrollView style={styles.listaContainer}>
                    {despesasFiltradasMotorista.length === 0 ? (
                        <View style={styles.containerVazio}>
                            <Ionicons name="cash-outline" size={64} color={cores.dustGrey} />
                            <Text style={styles.tituloVazio}>Nenhuma despesa</Text>
                            <Text style={styles.textoVazio}>Clique em "NOVA DESPESA" para comecar</Text>
                        </View>
                    ) : (
                        despesasFiltradasMotorista.map((despesa) => (
                            <Card key={despesa.id} style={styles.cartao}>
                                {despesa.imagemBase64 && (
                                    <TouchableOpacity onPress={() => abrirImagemNovaAba(despesa.imagemBase64!)} activeOpacity={0.9}>
                                        <Image source={{ uri: despesa.imagemBase64 }} style={styles.imagemCartao} resizeMode="cover" />
                                    </TouchableOpacity>
                                )}
                                <Card.Content>
                                    <View style={styles.cabecalhoCartao}>
                                        <View style={styles.chipTipoComIcone}>
                                            <Ionicons name={obterInfoTipo(despesa.tipo).icon} size={14} color={cores.grey} />
                                            <Text style={styles.textoChipTipo}>{despesa.tipo}</Text>
                                        </View>
                                        <View style={[styles.badgeStatus, { backgroundColor: getStatusColor(despesa.status) }]}><Text style={styles.textoStatus}>{getStatusText(despesa.status)}</Text></View>
                                        <Text style={styles.dataCartao}>{formatarData(despesa.criadoEm)}</Text>
                                        <View style={styles.acoesCartao}>
                                            {(despesa.status === 'Pendente' || despesa.status === 'Rejeitado') && (<TouchableOpacity onPress={() => editarDespesa(despesa)}><Ionicons name="pencil" size={20} color={cores.primary} /></TouchableOpacity>)}
                                            {(despesa.status === 'Pendente' || despesa.status === 'Rejeitado') && (<TouchableOpacity onPress={() => excluirDespesa(despesa.id)}><Ionicons name="trash" size={20} color={cores.error} /></TouchableOpacity>)}
                                        </View>
                                    </View>
                                    <Divider style={styles.divisor} />
                                    <Text style={styles.valorCartao}>{formatarMoeda(despesa.valor)}</Text>
                                    <View style={styles.linhaCartao}><Ionicons name="calendar" size={18} color={cores.grey} /><Text style={styles.infoCartao}>Data: {despesa.data}</Text></View>
                                    <View style={styles.linhaCartao}><Ionicons name="car" size={18} color={cores.grey} /><Text style={styles.infoCartao}>Placa: {despesa.placa}</Text></View>
                                    {despesa.descricao && <View style={styles.linhaCartao}><Ionicons name="document-text" size={18} color={cores.grey} /><Text style={styles.infoCartao}>{despesa.descricao}</Text></View>}
                                    {despesa.status === 'Rejeitado' && despesa.motivoRejeicao && (
                                        <View style={styles.motivoRejeicaoContainer}>
                                            <Ionicons name="alert-circle" size={18} color={cores.error} />
                                            <View style={styles.motivoRejeicaoContent}>
                                                <Text style={styles.motivoRejeicaoLabel}>Motivo:</Text>
                                                <Text style={styles.motivoRejeicaoText}>{despesa.motivoRejeicao}</Text>
                                            </View>
                                        </View>
                                    )}
                                    {despesa.status === 'Pendente' && (
                                        <View style={styles.statusPendenteInfo}>
                                            <Ionicons name="time-outline" size={16} color={cores.warning} />
                                            <Text style={styles.statusPendenteTexto}>Aguardando aprovação</Text>
                                        </View>
                                    )}
                                </Card.Content>
                            </Card>
                        ))
                    )}
                </ScrollView>

                <Modal visible={modalVisible} animationType="slide" transparent>
                    <View style={styles.containerModal}>
                        <View style={styles.conteudoModal}>
                            <View style={styles.cabecalhoModal}>
                                <Text style={styles.tituloModal}>{editando ? 'Editar Despesa' : 'Nova Despesa'}</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}><Ionicons name="close" size={24} color={cores.grey} /></TouchableOpacity>
                            </View>
                            <ScrollView>
                                {(comprimindoImagem || formData.imagemBase64) && (
                                    <View style={styles.botaoCameraModal}>
                                        {comprimindoImagem ? (
                                            <View style={styles.placeholderCameraModal}>
                                                <ActivityIndicator size="large" color={cores.primary} />
                                                <Text style={styles.textoCameraModal}>Processando imagem...</Text>
                                            </View>
                                        ) : (
                                            <Image source={{ uri: formData.imagemBase64 }} style={styles.previsualizacaoModal} />
                                        )}
                                    </View>
                                )}
                                <View style={styles.linhaBotoesFoto}>
                                    <TouchableOpacity style={styles.botaoFotoOpcao} onPress={tirarFotoEConverterBase64} disabled={comprimindoImagem}>
                                        <Ionicons name="camera" size={22} color={cores.primary} />
                                        <Text style={styles.botaoFotoOpcaoTexto}>Tirar foto</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.botaoFotoOpcao} onPress={escolherDaGaleria} disabled={comprimindoImagem}>
                                        <Ionicons name="images" size={22} color={cores.primary} />
                                        <Text style={styles.botaoFotoOpcaoTexto}>Galeria</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.rotuloModal}>Tipo de Despesa</Text>
                                <ScrollView horizontal style={styles.scrollTipos}>
                                    {TIPOS_DESPESA.map(t => (
                                        <TouchableOpacity key={t.nome} style={[styles.cartaoTipo, formData.tipo === t.nome && styles.cartaoTipoAtivo]} onPress={() => setFormData({ ...formData, tipo: t.nome })}>
                                            <View style={[styles.iconeTipo, { backgroundColor: t.color + '20' }]}><Ionicons name={t.icon} size={24} color={t.color} /></View>
                                            <Text style={[styles.nomeTipo, formData.tipo === t.nome && styles.nomeTipoAtivo]}>{t.nome}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <Text style={styles.rotuloModal}>Placa do Cavalo</Text>
                                <ScrollView horizontal>
                                    {cavalos.map(c => (
                                        <TouchableOpacity key={c.placa} style={[styles.botaoPlaca, formData.placa === c.placa && styles.botaoPlacaAtivo]} onPress={() => setFormData({ ...formData, placa: c.placa })}>
                                            <Text style={[styles.textoPlaca, formData.placa === c.placa && styles.textoPlacaAtivo]}>{c.placa}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                                <TextInput mode="outlined" label="Valor (R$)" value={formData.valor} onChangeText={t => setFormData({ ...formData, valor: t })} keyboardType="decimal-pad" style={styles.inputModal} />
                                <TextInput mode="outlined" label="Data (DD/MM/AAAA)" value={formData.data} onChangeText={t => setFormData({ ...formData, data: t })} style={styles.inputModal} />
                                <TextInput mode="outlined" label="Descrição" value={formData.descricao} onChangeText={t => setFormData({ ...formData, descricao: t })} multiline numberOfLines={3} style={styles.inputModal} />
                                <View style={styles.botoesModal}>
                                    <Button mode="outlined" onPress={() => setModalVisible(false)} style={styles.botaoCancelar}>Cancelar</Button>
                                    <Button mode="contained" onPress={salvarDespesa} loading={salvando} disabled={salvando || comprimindoImagem} style={styles.botaoSalvar}>Salvar</Button>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    const despesasFiltradasCargos = minhasDespesasFiltradas();
    const pendentesCount = despesasFiltradasCargos.filter(d => d.status === 'Pendente').length;
    const aprovadasCount = despesasFiltradasCargos.filter(d => d.status === 'Aprovado').length;
    const rejeitadasCount = despesasFiltradasCargos.filter(d => d.status === 'Rejeitado').length;
    const totalValorCargos = despesasFiltradasCargos.reduce((sum, d) => sum + d.valor, 0);

    return (
        <View style={styles.container}>
            <LinearGradient colors={[cores.white, cores.platinum]} style={styles.cabecalho}>
                <View style={styles.linhaCabecalho}>
                    <BotaoVoltar />
                    <View style={styles.centroCabecalho}>
                        <Ionicons name="cash" size={28} color={cores.charcoal} />
                        <Text style={styles.tituloCabecalho}>Todas as Despesas</Text>
                    </View>
                    <TouchableOpacity onPress={() => setMostrarFiltros(!mostrarFiltros)} style={styles.botaoFiltroHeader}>
                        <Ionicons name="options-outline" size={20} color={cores.charcoal} />
                        <Text style={styles.textoFiltroHeader}>Filtro</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <View style={styles.containerEstatisticas}>
                <View style={styles.cartaoEstatistica}><Text style={styles.numeroEstatistica}>{despesasFiltradasCargos.length}</Text><Text style={styles.rotuloEstatistica}>Total</Text></View>
                <View style={styles.cartaoEstatistica}><Text style={[styles.numeroEstatistica, { color: cores.warning }]}>{pendentesCount}</Text><Text style={styles.rotuloEstatistica}>Pendentes</Text></View>
                <View style={styles.cartaoEstatistica}><Text style={[styles.numeroEstatistica, { color: cores.success }]}>{aprovadasCount}</Text><Text style={styles.rotuloEstatistica}>Aprovadas</Text></View>
                <View style={styles.cartaoEstatistica}><Text style={[styles.numeroEstatistica, { color: cores.error }]}>{rejeitadasCount}</Text><Text style={styles.rotuloEstatistica}>Rejeitadas</Text></View>
                <View style={styles.cartaoEstatistica}><Text style={styles.numeroEstatistica}>{formatarMoeda(totalValorCargos)}</Text><Text style={styles.rotuloEstatistica}>Valor Total</Text></View>
            </View>

            {mostrarFiltros && (
                <View style={styles.filtrosContainer}>
                    <ScrollView style={styles.filtrosScroll}>
                        <Text style={styles.filtrosTitle}>Filtrar despesas</Text>
                        
                        <View style={styles.filtroCampo}>
                            <Ionicons name="search" size={20} color={cores.grey} />
                            <TextInput mode="flat" placeholder="Descricao ou tipo" value={buscaDescricao} onChangeText={setBuscaDescricao} style={styles.filtroInput} />
                            {buscaDescricao !== '' && (<TouchableOpacity onPress={() => setBuscaDescricao('')}><Ionicons name="close" size={18} color={cores.silver} /></TouchableOpacity>)}
                        </View>

                        <View style={styles.filtroCampo}>
                            <Ionicons name="car" size={20} color={cores.grey} />
                            <TextInput mode="flat" placeholder="Placa" value={filtroPlaca} onChangeText={setFiltroPlaca} style={styles.filtroInput} />
                            {filtroPlaca !== '' && (<TouchableOpacity onPress={() => setFiltroPlaca('')}><Ionicons name="close" size={18} color={cores.silver} /></TouchableOpacity>)}
                        </View>

                        <View style={styles.filtroCampo}>
                            <Ionicons name="cash" size={20} color={cores.grey} />
                            <TextInput mode="flat" placeholder="Tipo de despesa" value={filtroTipo} onChangeText={setFiltroTipo} style={styles.filtroInput} />
                            {filtroTipo !== '' && (<TouchableOpacity onPress={() => setFiltroTipo('')}><Ionicons name="close" size={18} color={cores.silver} /></TouchableOpacity>)}
                        </View>

                        <Text style={styles.filtroLabel}>Status</Text>
                        <View style={styles.linhaFiltro}>
                            <TouchableOpacity
                                style={[styles.chipFiltro, filtroStatus === 'todas' && styles.chipFiltroAtivo]}
                                onPress={() => setFiltroStatus('todas')}
                            >
                                <Text style={[styles.textoChipFiltro, filtroStatus === 'todas' && styles.textoChipFiltroAtivo]}>Todas</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.chipFiltro, filtroStatus === 'pendentes' && styles.chipFiltroAtivo]}
                                onPress={() => setFiltroStatus('pendentes')}
                            >
                                <Text style={[styles.textoChipFiltro, filtroStatus === 'pendentes' && styles.textoChipFiltroAtivo]}>Pendentes</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.chipFiltro, filtroStatus === 'aprovadas' && styles.chipFiltroAtivo]}
                                onPress={() => setFiltroStatus('aprovadas')}
                            >
                                <Text style={[styles.textoChipFiltro, filtroStatus === 'aprovadas' && styles.textoChipFiltroAtivo]}>Aprovadas</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.chipFiltro, filtroStatus === 'rejeitadas' && styles.chipFiltroAtivo]}
                                onPress={() => setFiltroStatus('rejeitadas')}
                            >
                                <Text style={[styles.textoChipFiltro, filtroStatus === 'rejeitadas' && styles.textoChipFiltroAtivo]}>Rejeitadas</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.botaoLimparFiltros} onPress={limparFiltros}>
                            <Ionicons name="refresh" size={18} color={cores.white} />
                            <Text style={styles.textoLimparFiltros}>Limpar filtros</Text>
                        </TouchableOpacity>
                    </ScrollView>
                </View>
            )}

            <FiltroData 
                periodo={filtroPeriodo} 
                setPeriodo={setFiltroPeriodo} 
                dataInicio={dataInicio} 
                setDataInicio={setDataInicio} 
                dataFim={dataFim} 
                setDataFim={setDataFim} 
                showPersonalizado={true} 
            />

            <ScrollView style={styles.listaContainer}>
                {despesasFiltradasCargos.length === 0 ? (
                    <View style={styles.containerVazio}>
                        <Ionicons name="cash-outline" size={64} color={cores.dustGrey} />
                        <Text style={styles.tituloVazio}>Nenhuma despesa</Text>
                    </View>
                ) : (
                    despesasFiltradasCargos.map((despesa) => (
                        <Card key={despesa.id} style={styles.cartao}>
                            {despesa.imagemBase64 && (
                                <TouchableOpacity onPress={() => abrirImagemNovaAba(despesa.imagemBase64!)} activeOpacity={0.9}>
                                    <Image source={{ uri: despesa.imagemBase64 }} style={styles.imagemCartao} resizeMode="cover" />
                                </TouchableOpacity>
                            )}
                            <Card.Content>
                                <View style={styles.cabecalhoCartao}>
                                    <View style={styles.chipTipoComIcone}>
                                            <Ionicons name={obterInfoTipo(despesa.tipo).icon} size={14} color={cores.grey} />
                                            <Text style={styles.textoChipTipo}>{despesa.tipo}</Text>
                                        </View>
                                    <View style={[styles.badgeStatus, { backgroundColor: getStatusColor(despesa.status) }]}><Text style={styles.textoStatus}>{getStatusText(despesa.status)}</Text></View>
                                    <Text style={styles.dataCartao}>{formatarData(despesa.criadoEm)}</Text>
                                </View>
                                <Divider style={styles.divisor} />
                                <Text style={styles.valorCartao}>{formatarMoeda(despesa.valor)}</Text>
                                <View style={styles.linhaCartao}><Ionicons name="calendar" size={18} color={cores.grey} /><Text style={styles.infoCartao}>Data: {despesa.data}</Text></View>
                                <View style={styles.linhaCartao}><Ionicons name="car" size={18} color={cores.grey} /><Text style={styles.infoCartao}>Placa: {despesa.placa}</Text></View>
                                {despesa.descricao && <View style={styles.linhaCartao}><Ionicons name="document-text" size={18} color={cores.grey} /><Text style={styles.infoCartao}>{despesa.descricao}</Text></View>}
                                {despesa.status === 'Rejeitado' && despesa.motivoRejeicao && (
                                    <View style={styles.motivoRejeicaoContainer}>
                                        <Ionicons name="alert-circle" size={18} color={cores.error} />
                                        <View style={styles.motivoRejeicaoContent}>
                                            <Text style={styles.motivoRejeicaoLabel}>Motivo:</Text>
                                            <Text style={styles.motivoRejeicaoText}>{despesa.motivoRejeicao}</Text>
                                        </View>
                                    </View>
                                )}
                                
                                {podeAprovar && despesa.status === 'Pendente' && (
                                    <View style={styles.botoesAprovacao}>
                                        <TouchableOpacity style={[styles.botaoAprovar, { backgroundColor: cores.success }]} onPress={() => aprovarDespesa(despesa)}>
                                            <Ionicons name="checkmark" size={20} color={cores.white} /><Text style={styles.textoAprovar}>Aprovar</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity style={[styles.botaoAprovar, { backgroundColor: cores.error }]} onPress={() => {
                                            setDespesaParaRejeitar(despesa);
                                            setMotivoRejeicao('');
                                            setJustificativaModalVisivel(true);
                                        }}>
                                            <Ionicons name="close" size={20} color={cores.white} /><Text style={styles.textoAprovar}>Rejeitar</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                {!podeAprovar && despesa.status === 'Pendente' && (
                                    <View style={styles.statusPendenteInfo}>
                                        <Ionicons name="time-outline" size={16} color={cores.warning} />
                                        <Text style={styles.statusPendenteTexto}>Aguardando aprovação</Text>
                                    </View>
                                )}
                            </Card.Content>
                        </Card>
                    ))
                )}
            </ScrollView>

            <Modal visible={justificativaModalVisivel} transparent animationType="fade" onRequestClose={() => setJustificativaModalVisivel(false)}>
                <View style={styles.overlayModalRejeicao}>
                    <View style={styles.conteudoModalRejeicao}>
                        <View style={styles.cabecalhoModalRejeicao}>
                            <Ionicons name="close-circle" size={40} color={cores.error} />
                            <Text style={styles.tituloModalRejeicao}>Rejeitar Despesa</Text>
                        </View>
                        <TextInput
                            mode="outlined"
                            label="Motivo da rejeição"
                            value={motivoRejeicao}
                            onChangeText={setMotivoRejeicao}
                            multiline
                            numberOfLines={4}
                            style={styles.inputModalRejeicao}
                            outlineColor={cores.dustGrey}
                            activeOutlineColor={cores.error}
                            placeholder="Descreva o motivo da rejeicao..."
                        />
                        <View style={styles.botoesModalRejeicao}>
                            <TouchableOpacity style={styles.botaoCancelarRejeicao} onPress={() => { setJustificativaModalVisivel(false); setDespesaParaRejeitar(null); setMotivoRejeicao(''); }}>
                                <Text style={styles.textoCancelarRejeicao}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.botaoConfirmarRejeicao} onPress={rejeitarDespesa}>
                                <Ionicons name="close" size={20} color={cores.white} />
                                <Text style={styles.textoConfirmarRejeicao}>Rejeitar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: cores.platinum },
    containerCarregamento: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: cores.platinum },
    textoCarregamento: { marginTop: 16, color: cores.grey },
    cabecalho: { paddingHorizontal: 20, paddingTop: 48, paddingBottom: 24, borderBottomLeftRadius: 30, borderBottomRightRadius: 30 },
    linhaCabecalho: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
    centroCabecalho: { alignItems: 'center' },
    tituloCabecalho: { fontSize: 27, fontWeight: 'bold', color: cores.charcoal, marginTop: 4 },
    botaoFiltroHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.white, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
    textoFiltroHeader: { fontSize: 16, color: cores.charcoal, fontWeight: '500' },
    botaoVoltar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.white, alignItems: 'center', justifyContent: 'center', elevation: 2 },
    containerBusca: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.white, marginHorizontal: 16, marginTop: 16, marginBottom: 16, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: cores.dustGrey },
    inputBusca: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 22, color: cores.charcoal },
    containerEstatisticas: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
    cartaoEstatistica: { flex: 1, backgroundColor: cores.white, borderRadius: 16, padding: 12, alignItems: 'center', elevation: 2 },
    numeroEstatistica: { fontSize: 24, fontWeight: 'bold', color: cores.charcoal },
    rotuloEstatistica: { fontSize: 14, color: cores.grey, marginTop: 4 },
    botaoAdicionar: { marginHorizontal: 16, marginBottom: 16 },
    gradienteAdicionar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, gap: 8 },
    textoBotaoAdicionar: { color: cores.white, fontSize: 22, fontWeight: '600' },
    listaContainer: { flex: 1, paddingHorizontal: 16 },
    containerVazio: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    tituloVazio: { fontSize: 24, fontWeight: '600', color: cores.charcoal, marginTop: 16 },
    textoVazio: { fontSize: 19, color: cores.grey, marginTop: 8, textAlign: 'center' },
    subtextoVazio: { fontSize: 18, color: cores.silver, marginTop: 4, textAlign: 'center' },
    cartaoMotorista: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.white, borderRadius: 20, padding: 16, marginBottom: 12, elevation: 3 },
    avatar: { backgroundColor: cores.primary },
    motoristaInfo: { flex: 1, marginLeft: 16 },
    motoristaNome: { fontSize: 22, fontWeight: '600', color: cores.charcoal },
    motoristaEmail: { fontSize: 16, color: cores.grey, marginTop: 2 },
    motoristaStats: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 },
    pilulaEstatistica: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: cores.platinum,
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 5,
        gap: 5,
    },
    textoPilulaEstatistica: { fontSize: 16, color: cores.grey, fontWeight: '500', includeFontPadding: false, textAlignVertical: 'center' },
    pendentesBadge: { backgroundColor: cores.warning, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', marginRight: 8, minWidth: 60 },
    pendentesNumero: { color: cores.white, fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
    pendentesLabel: { color: cores.white, fontSize: 14, textAlign: 'center' },
    cartao: { marginBottom: 12, borderRadius: 20, backgroundColor: cores.white, elevation: 3, overflow: 'hidden' },
    imagemCartao: { width: '100%', height: 200, resizeMode: 'cover' },
    cabecalhoCartao: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 12, flexWrap: 'wrap', gap: 8 },
    chipTipoComIcone: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, gap: 6, backgroundColor: cores.platinum },
    textoChipTipo: { fontSize: 16, fontWeight: '600', color: cores.grey },
    badgeStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    textoStatus: { color: cores.white, fontSize: 14, fontWeight: 'bold' },
    dataCartao: { fontSize: 16, color: cores.silver, marginLeft: 'auto' },
    acoesCartao: { flexDirection: 'row', gap: 8 },
    divisor: { marginVertical: 12, backgroundColor: cores.dustGrey },
    linhaCartao: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    valorCartao: { fontSize: 24, fontWeight: 'bold', color: cores.success, marginBottom: 8 },
    infoCartao: { fontSize: 19, color: cores.grey, flex: 1 },
    motivoRejeicaoContainer: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFEBEE', padding: 12, borderRadius: 12, marginTop: 12, gap: 10 },
    motivoRejeicaoContent: { flex: 1 },
    motivoRejeicaoLabel: { fontSize: 15, color: cores.error, fontWeight: '600', marginBottom: 4 },
    motivoRejeicaoText: { fontSize: 18, color: cores.error, lineHeight: 24 },
    statusPendenteInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', padding: 10, borderRadius: 12, marginTop: 12, gap: 8 },
    statusPendenteTexto: { fontSize: 16, color: cores.warning, fontWeight: '500', flex: 1 },
    botoesAprovacao: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: cores.dustGrey },
    botaoAprovar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
    textoAprovar: { color: cores.white, fontSize: 16, fontWeight: '600' },
    containerModal: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    conteudoModal: { backgroundColor: cores.white, margin: 20, borderRadius: 24, padding: 20, maxHeight: '90%' },
    cabecalhoModal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    tituloModal: { fontSize: 30, fontWeight: 'bold', color: cores.charcoal },
    botaoCameraModal: { backgroundColor: cores.platinum, borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
    linhaBotoesFoto: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    botaoFotoOpcao: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: cores.platinum, borderWidth: 1, borderColor: cores.dustGrey, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 16 },
    botaoFotoOpcaoTexto: { color: cores.primary, fontWeight: '600', fontSize: 18 },
    placeholderCameraModal: { height: 160, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: cores.dustGrey, borderStyle: 'dashed', borderRadius: 16, margin: 1, gap: 8 },
    textoCameraModal: { marginTop: 12, color: cores.grey },
    previsualizacaoModal: { width: '100%', height: 160, borderRadius: 16 },
    rotuloModal: { fontSize: 19, fontWeight: '500', color: cores.charcoal, marginBottom: 8, marginTop: 12 },
    scrollTipos: { flexDirection: 'row', marginBottom: 16 },
    cartaoTipo: { alignItems: 'center', padding: 12, marginRight: 12, borderRadius: 16, backgroundColor: cores.platinum, minWidth: 80 },
    cartaoTipoAtivo: { backgroundColor: cores.white, borderWidth: 1, borderColor: cores.primary },
    iconeTipo: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    nomeTipo: { fontSize: 16, color: cores.grey },
    nomeTipoAtivo: { color: cores.primary, fontWeight: '600' },
    botaoPlaca: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: cores.platinum, borderRadius: 12, marginRight: 12, borderWidth: 1, borderColor: cores.dustGrey },
    botaoPlacaAtivo: { backgroundColor: cores.primary, borderColor: cores.primary },
    textoPlaca: { fontSize: 19, color: cores.grey },
    textoPlacaAtivo: { color: cores.white, fontWeight: '600' },
    inputModal: { marginBottom: 16, backgroundColor: cores.white },
    botoesModal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 12 },
    botaoCancelar: { flex: 1, borderColor: cores.error, borderRadius: 12 },
    botaoSalvar: { flex: 1, backgroundColor: cores.primary, borderRadius: 12 },
    overlayModalRejeicao: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    conteudoModalRejeicao: { backgroundColor: cores.white, borderRadius: 28, padding: 24, width: '90%', maxWidth: 400 },
    cabecalhoModalRejeicao: { alignItems: 'center', marginBottom: 20 },
    tituloModalRejeicao: { fontSize: 30, fontWeight: 'bold', color: cores.error, marginTop: 12 },
    inputModalRejeicao: { marginBottom: 24, backgroundColor: cores.white, minHeight: 100 },
    botoesModalRejeicao: { flexDirection: 'row', gap: 12 },
    botaoCancelarRejeicao: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: cores.error, alignItems: 'center', backgroundColor: 'transparent' },
    textoCancelarRejeicao: { color: cores.error, fontWeight: '600', fontSize: 19 },
    botaoConfirmarRejeicao: { flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 12, backgroundColor: cores.error, alignItems: 'center', justifyContent: 'center', gap: 8 },
    textoConfirmarRejeicao: { color: cores.white, fontWeight: '600', fontSize: 19 },
    filtrosContainer: { backgroundColor: cores.white, margin: 16, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: cores.dustGrey, maxHeight: '80%' },
    filtrosScroll: { maxHeight: '100%' },
    filtrosTitle: { fontSize: 24, fontWeight: 'bold', color: cores.charcoal, marginBottom: 16, textAlign: 'center' },
    filtroCampo: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.platinum, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: cores.dustGrey },
    filtroInput: { flex: 1, paddingVertical: 0, height: 48, fontSize: 19, color: cores.charcoal, backgroundColor: 'transparent' },
    filtroLabel: { fontSize: 19, fontWeight: '600', color: cores.charcoal, marginBottom: 8, marginTop: 8 },
    linhaFiltro: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    chipFiltro: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: cores.platinum, borderWidth: 1, borderColor: cores.dustGrey },
    chipFiltroAtivo: { backgroundColor: cores.primary, borderColor: cores.primary },
    textoChipFiltro: { fontSize: 18, color: cores.grey },
    textoChipFiltroAtivo: { color: cores.white, fontWeight: '600' },
    botaoLimparFiltros: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: cores.error, paddingVertical: 12, borderRadius: 12, gap: 8, marginTop: 8 },
    textoLimparFiltros: { color: cores.white, fontSize: 19, fontWeight: '600' },
});