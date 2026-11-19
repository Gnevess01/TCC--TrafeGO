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
    where,
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
    View
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

interface DevolucaoRegistro {
    id: string;
    imagemBase64: string;
    imagem?: string;
    placa: string;
    dataViagem: string;
    motivo: string;
    nomeCliente: string;
    status: 'Pendente' | 'Aprovado' | 'Rejeitado';
    statusEntrega?: 'Pendente' | 'Entregue';
    motoristaEmail: string;
    motoristaNome: string;
    motoristaId: string;
    documentoRecebedor?: string;
    motivoRejeicao?: string;
    aprovadoPor?: string;
    aprovadoPorNome?: string;
    aprovadoEm?: Timestamp;
    criadoEm: Timestamp;
}

interface Cavalo {
    id: string;
    placa: string;
    modelo: string;
    ativa: boolean;
    motoristaEmail: string;
}

interface MotoristaInfo {
    uid: string;
    nome: string;
    email: string;
    totalDevolucoes: number;
    totalPendentes: number;
}

export default function TelaDevolucao() {
    const [usuario, setUsuario] = useState<any>(null);
    const [cargo, setCargo] = useState<string>('');
    const [registros, setRegistros] = useState<DevolucaoRegistro[]>([]);
    const [estaCarregando, setEstaCarregando] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [editando, setEditando] = useState<DevolucaoRegistro | null>(null);
    const [imagemBase64, setImagemBase64] = useState<string | null>(null);
    const [cavalosDisponiveis, setCavalosDisponiveis] = useState<Cavalo[]>([]);
    const [placaSelecionada, setPlacaSelecionada] = useState('');
    const [dataViagem, setDataViagem] = useState('');
    const [motivo, setMotivo] = useState('');
    const [nomeCliente, setNomeCliente] = useState('');
    const [documentoRecebedor, setDocumentoRecebedor] = useState('');
    const [estaSalvando, setEstaSalvando] = useState(false);
    const [comprimindoImagem, setComprimindoImagem] = useState(false);

    const [buscaDescricao, setBuscaDescricao] = useState('');
    const [filtroStatus, setFiltroStatus] = useState<'todas' | 'pendentes' | 'aprovadas' | 'rejeitadas'>('todas');
    const [filtroEntrega, setFiltroEntrega] = useState<'todas' | 'naoEntregues' | 'entregues'>('todas');
    const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoType>('todas');
    const [dataInicio, setDataInicio] = useState<Date | null>(null);
    const [dataFim, setDataFim] = useState<Date | null>(null);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);

    const [motoristas, setMotoristas] = useState<MotoristaInfo[]>([]);
    const [motoristaSelecionado, setMotoristaSelecionado] = useState<MotoristaInfo | null>(null);
    const [devolucoesMotorista, setDevolucoesMotorista] = useState<DevolucaoRegistro[]>([]);
    const [buscaMotorista, setBuscaMotorista] = useState('');
    const [filtroPeriodoAdmin, setFiltroPeriodoAdmin] = useState<PeriodoType>('todas');
    const [dataInicioAdmin, setDataInicioAdmin] = useState<Date | null>(null);
    const [dataFimAdmin, setDataFimAdmin] = useState<Date | null>(null);

    const [justificativaModalVisivel, setJustificativaModalVisivel] = useState(false);
    const [devolucaoParaRejeitar, setDevolucaoParaRejeitar] = useState<DevolucaoRegistro | null>(null);
    const [modalEntregaVisivel, setModalEntregaVisivel] = useState(false);
    const [devolucaoParaAprovar, setDevolucaoParaAprovar] = useState<DevolucaoRegistro | null>(null);
    const [motivoRejeicao, setMotivoRejeicao] = useState('');

    const isAdmin = cargo === 'gerente' || cargo === 'superadmin';
    const isFuncionario = cargo === 'funcionario';
    const isMotorista = cargo === 'motorista';
    const podeAprovar = isAdmin;
    const podeCadastrar = isMotorista;
    const podeVerListaMotoristas = isAdmin || isFuncionario;

    const abrirImagemNovaAba = (base64: string) => {
        if (base64 && Platform.OS === 'web') {
            const win = window.open();
            win?.document.write(`
                <html>
                    <head>
                        <title>Visualizar Comprovante de Devolucao</title>
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

    const converterDataItem = (dataStr: string): Date | null => {
        if (!dataStr || dataStr.length < 10) return null;
        const partes = dataStr.split('/');
        if (partes.length !== 3) return null;
        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1;
        const ano = parseInt(partes[2], 10);
        if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
        const data = new Date(ano, mes, dia);
        data.setHours(12, 0, 0, 0);
        return data;
    };

    const filtrarPorPeriodo = (itens: DevolucaoRegistro[], periodo: PeriodoType): DevolucaoRegistro[] => {
        if (periodo === 'todas') return itens;

        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const fimHoje = new Date();
        fimHoje.setHours(23, 59, 59, 999);

        let dataInicioComparacao: Date | null = null;
        let dataFimComparacao: Date | null = null;

        switch (periodo) {
            case 'hoje':
                dataInicioComparacao = hoje;
                dataFimComparacao = fimHoje;
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
                dataInicioComparacao = inicioSemana;
                dataFimComparacao = fimSemana;
                break;
            }
            case 'esteMes': {
                dataInicioComparacao = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                dataFimComparacao = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
                dataFimComparacao.setHours(23, 59, 59, 999);
                break;
            }
            case 'mesPassado': {
                dataInicioComparacao = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                dataFimComparacao = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                dataFimComparacao.setHours(23, 59, 59, 999);
                break;
            }
            case 'ultimos3Meses': {
                dataInicioComparacao = new Date(hoje);
                dataInicioComparacao.setMonth(hoje.getMonth() - 3);
                dataInicioComparacao.setHours(0, 0, 0, 0);
                dataFimComparacao = fimHoje;
                break;
            }
            case 'anoAtual': {
                dataInicioComparacao = new Date(hoje.getFullYear(), 0, 1);
                dataFimComparacao = new Date(hoje.getFullYear(), 11, 31);
                dataFimComparacao.setHours(23, 59, 59, 999);
                break;
            }
            case 'personalizado':
                return itens;
            default:
                return itens;
        }

        return itens.filter(item => {
            if (!item.dataViagem) return false;
            const dataItem = converterDataItem(item.dataViagem);
            if (!dataItem) return false;
            if (dataInicioComparacao && dataFimComparacao) {
                return dataItem >= dataInicioComparacao && dataItem <= dataFimComparacao;
            }
            return true;
        });
    };

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

    const buscarCavalosDoUsuario = async () => {
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
                    id: doc.id,
                    placa: data.placa,
                    modelo: data.modelo,
                    ativa: data.ativa,
                    motoristaEmail: data.motoristaEmail,
                });
            });
            setCavalosDisponiveis(lista);
            if (lista.length > 0) {
                setPlacaSelecionada(lista[0].placa);
            }
        } catch (error) {
        }
    };

    const buscarTodosCavalos = async () => {
        try {
            const q = query(collection(db, 'cavalos'), where('ativa', '==', true));
            const querySnapshot = await getDocs(q);
            const lista: Cavalo[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                lista.push({
                    id: doc.id,
                    placa: data.placa,
                    modelo: data.modelo,
                    ativa: data.ativa,
                    motoristaEmail: data.motoristaEmail,
                });
            });
            setCavalosDisponiveis(lista);
            if (lista.length > 0) {
                setPlacaSelecionada(lista[0].placa);
            }
        } catch (error) {
        }
    };

    useEffect(() => {
        if (cargo) {
            if (isMotorista && usuario) {
                buscarCavalosDoUsuario();
                buscarMinhasDevolucoes();
            } else if (isAdmin) {
                buscarTodosCavalos();
                buscarMotoristasComEstatisticas();
            } else if (isFuncionario) {
                buscarMotoristasComEstatisticas();
            }
            setDataViagem(new Date().toLocaleDateString('pt-BR'));
        }
    }, [cargo, usuario]);

    const ordenarPorDataDesc = (lista: DevolucaoRegistro[]) =>
        [...lista].sort((a, b) => (b.criadoEm?.toMillis?.() ?? 0) - (a.criadoEm?.toMillis?.() ?? 0));

    const buscarMinhasDevolucoes = async () => {
        setEstaCarregando(true);
        try {
            if (!usuario?.email) {
                setEstaCarregando(false);
                return;
            }
            const q = query(
                collection(db, 'devolucoes'),
                where('motoristaEmail', '==', usuario.email)
            );
            const querySnapshot = await getDocs(q);
            const lista: DevolucaoRegistro[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                lista.push({ id: doc.id, ...data } as DevolucaoRegistro);
            });
            setRegistros(ordenarPorDataDesc(lista));
        } catch (error) {
            console.error('Erro ao buscar devoluções:', error);
        } finally {
            setEstaCarregando(false);
        }
    };

    const buscarMotoristasComEstatisticas = async () => {
        setEstaCarregando(true);
        try {
            const q = query(collection(db, 'usuarios'), where('cargo', '==', 'motorista'), where('ativo', '==', true));
            const querySnapshot = await getDocs(q);
            const lista: MotoristaInfo[] = [];

            for (const doc of querySnapshot.docs) {
                const data = doc.data();
                const devolucoesQuery = query(collection(db, 'devolucoes'), where('motoristaEmail', '==', data.email));
                const devolucoesSnap = await getDocs(devolucoesQuery);

                let totalPendentes = 0;
                devolucoesSnap.forEach((d) => {
                    if (d.data().status === 'Pendente') totalPendentes++;
                });

                lista.push({
                    uid: doc.id,
                    nome: data.nome,
                    email: data.email,
                    totalDevolucoes: devolucoesSnap.size,
                    totalPendentes: totalPendentes,
                });
            }
            setMotoristas(lista);
        } catch (error) {
        } finally {
            setEstaCarregando(false);
        }
    };

    const buscarDevolucoesDoMotorista = async (motorista: MotoristaInfo) => {
        setEstaCarregando(true);
        try {
            const q = query(
                collection(db, 'devolucoes'),
                where('motoristaEmail', '==', motorista.email)
            );
            const querySnapshot = await getDocs(q);
            const lista: DevolucaoRegistro[] = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                lista.push({ id: doc.id, ...data } as DevolucaoRegistro);
            });
            setDevolucoesMotorista(ordenarPorDataDesc(lista));
            setMotoristaSelecionado(motorista);
        } catch (error) {
            console.error('Erro ao buscar devoluções do motorista:', error);
        } finally {
            setEstaCarregando(false);
        }
    };

    const voltarParaListaMotoristas = () => {
        setMotoristaSelecionado(null);
        setDevolucoesMotorista([]);
        setBuscaMotorista('');
        setFiltroPeriodoAdmin('todas');
        setDataInicioAdmin(null);
        setDataFimAdmin(null);
        setBuscaDescricao('');
        setFiltroStatus('todas');
        setMostrarFiltros(false);
    };

    const limparFiltrosAdmin = () => {
        setBuscaDescricao('');
        setFiltroStatus('todas');
        setFiltroEntrega('todas');
        setFiltroPeriodoAdmin('todas');
        setDataInicioAdmin(null);
        setDataFimAdmin(null);
    };

    const processarImagemCapturada = async (uri: string, base64Original?: string) => {
        setComprimindoImagem(true);
        try {
            const imagemComprimida = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 800 } }],
                { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG, base64: true }
            );
            if (imagemComprimida.base64) {
                setImagemBase64(`data:image/jpeg;base64,${imagemComprimida.base64}`);
            } else if (base64Original) {
                setImagemBase64(`data:image/jpeg;base64,${base64Original}`);
            }
        } catch (erro) {
            if (base64Original) setImagemBase64(`data:image/jpeg;base64,${base64Original}`);
        } finally {
            setComprimindoImagem(false);
        }
    };

    const tirarFoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled && result.assets[0] && result.assets[0].base64) {
            await processarImagemCapturada(result.assets[0].uri, result.assets[0].base64);
        } else if (!result.canceled) {
        }
    };

    const escolherDaGaleria = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            quality: 0.7,
            base64: true,
        });

        if (!result.canceled && result.assets[0] && result.assets[0].base64) {
            await processarImagemCapturada(result.assets[0].uri, result.assets[0].base64);
        }
    };

    const salvarRegistro = async () => {
        if (!isMotorista) {
            return;
        }
        if (!imagemBase64) {
            return;
        }
        if (!placaSelecionada) {
            return;
        }
        if (!dataViagem) {
            return;
        }
        if (!motivo.trim()) {
            return;
        }
        if (!nomeCliente.trim()) {
            return;
        }

        setEstaSalvando(true);
        try {
            const dadosRegistro = {
                imagemBase64: imagemBase64,
                placa: placaSelecionada.toUpperCase(),
                dataViagem,
                motivo: motivo.trim(),
                nomeCliente: nomeCliente.trim(),
                status: 'Pendente',
                motoristaEmail: usuario.email,
                motoristaNome: usuario.nome,
                motoristaId: usuario.uid,
                documentoRecebedor: documentoRecebedor.trim() || null,
                criadoEm: serverTimestamp(),
            };

            if (editando) {
                await updateDoc(doc(db, 'devolucoes', editando.id), dadosRegistro);
            } else {
                await addDoc(collection(db, 'devolucoes'), dadosRegistro);
            }

            setModalVisible(false);
            setEditando(null);
            limparFormulario();
            buscarMinhasDevolucoes();
        } catch (error) {
        } finally {
            setEstaSalvando(false);
        }
    };

    const aprovarDevolucao = async (devolucao: DevolucaoRegistro, statusEntrega: 'Pendente' | 'Entregue') => {
        if (!podeAprovar) return;
        try {
            await updateDoc(doc(db, 'devolucoes', devolucao.id), {
                status: 'Aprovado',
                statusEntrega,
                aprovadoPor: usuario?.uid,
                aprovadoPorNome: usuario?.nome,
                aprovadoEm: serverTimestamp(),
            });
            setModalEntregaVisivel(false);
            setDevolucaoParaAprovar(null);

            if (motoristaSelecionado) {
                await buscarDevolucoesDoMotorista(motoristaSelecionado);
                await buscarMotoristasComEstatisticas();
            } else if (podeVerListaMotoristas) {
                await buscarMotoristasComEstatisticas();
            } else if (isMotorista) {
                buscarMinhasDevolucoes();
            }
        } catch (error) {
        }
    };

    const marcarComoEntregue = async (devolucao: DevolucaoRegistro) => {
        if (!podeAprovar) return;
        try {
            await updateDoc(doc(db, 'devolucoes', devolucao.id), {
                statusEntrega: 'Entregue',
            });

            if (motoristaSelecionado) {
                await buscarDevolucoesDoMotorista(motoristaSelecionado);
            } else if (podeVerListaMotoristas) {
                await buscarMotoristasComEstatisticas();
            }
        } catch (error) {
        }
    };

    const rejeitarDevolucao = async () => {
        if (!podeAprovar) return;
        if (!motivoRejeicao.trim()) {
            return;
        }
        if (!devolucaoParaRejeitar) return;

        try {
            await updateDoc(doc(db, 'devolucoes', devolucaoParaRejeitar.id), {
                status: 'Rejeitado',
                motivoRejeicao: motivoRejeicao.trim(),
                aprovadoPor: usuario?.uid,
                aprovadoPorNome: usuario?.nome,
                aprovadoEm: serverTimestamp(),
            });
            setJustificativaModalVisivel(false);
            setDevolucaoParaRejeitar(null);
            setMotivoRejeicao('');

            if (motoristaSelecionado) {
                await buscarDevolucoesDoMotorista(motoristaSelecionado);
                await buscarMotoristasComEstatisticas();
            } else if (podeVerListaMotoristas) {
                await buscarMotoristasComEstatisticas();
            } else if (isMotorista) {
                buscarMinhasDevolucoes();
            }
        } catch (error) {
        }
    };

    const excluirRegistro = async (id: string) => {
        try {
            setEstaCarregando(true);
            await deleteDoc(doc(db, 'devolucoes', id));
            if (motoristaSelecionado) {
                await buscarDevolucoesDoMotorista(motoristaSelecionado);
                await buscarMotoristasComEstatisticas();
            } else if (isMotorista) {
                buscarMinhasDevolucoes();
            } else if (podeVerListaMotoristas) {
                await buscarMotoristasComEstatisticas();
            }
        } catch (error) {
        } finally {
            setEstaCarregando(false);
        }
    };

    const editarRegistro = (registro: DevolucaoRegistro) => {
        setEditando(registro);
        setImagemBase64(registro.imagemBase64 || registro.imagem || '');
        setPlacaSelecionada(registro.placa);
        setDataViagem(registro.dataViagem);
        setMotivo(registro.motivo);
        setNomeCliente(registro.nomeCliente);
        setDocumentoRecebedor(registro.documentoRecebedor || '');
        setModalVisible(true);
    };

    const limparFormulario = () => {
        setEditando(null);
        setImagemBase64(null);
        setPlacaSelecionada(cavalosDisponiveis.length > 0 ? cavalosDisponiveis[0].placa : '');
        setDataViagem(new Date().toLocaleDateString('pt-BR'));
        setMotivo('');
        setNomeCliente('');
        setDocumentoRecebedor('');
    };

    const formatarData = (timestamp: Timestamp) => {
        if (!timestamp) return '';
        return timestamp.toDate().toLocaleDateString('pt-BR');
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Aprovado': return cores.success;
            case 'Rejeitado': return cores.error;
            default: return cores.warning;
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'Aprovado': return 'Aprovado';
            case 'Rejeitado': return 'Rejeitado';
            default: return 'Pendente';
        }
    };

    const registrosFiltrados = () => {
        let filtrados = motoristaSelecionado ? devolucoesMotorista : registros;

        if (buscaDescricao.trim() !== '') {
            const buscaLower = buscaDescricao.toLowerCase();
            filtrados = filtrados.filter(r =>
                r.placa.toLowerCase().includes(buscaLower) ||
                r.motoristaNome.toLowerCase().includes(buscaLower) ||
                r.nomeCliente.toLowerCase().includes(buscaLower) ||
                r.motivo.toLowerCase().includes(buscaLower)
            );
        }

        if (filtroStatus !== 'todas') {
            filtrados = filtrados.filter(r => {
                if (filtroStatus === 'pendentes') return r.status === 'Pendente';
                if (filtroStatus === 'aprovadas') return r.status === 'Aprovado';
                if (filtroStatus === 'rejeitadas') return r.status === 'Rejeitado';
                return true;
            });
        }

        if (filtroEntrega !== 'todas') {
            filtrados = filtrados.filter(r => {
                if (filtroEntrega === 'entregues') return r.statusEntrega === 'Entregue';
                if (filtroEntrega === 'naoEntregues') return r.status === 'Aprovado' && r.statusEntrega !== 'Entregue';
                return true;
            });
        }

        if (motoristaSelecionado) {
            filtrados = filtrarPorPeriodo(filtrados, filtroPeriodoAdmin);
        } else {
            filtrados = filtrarPorPeriodo(filtrados, filtroPeriodo);
        }

        return filtrados;
    };

    const motoristasFiltrados = motoristas.filter(m =>
        m.nome.toLowerCase().includes(buscaMotorista.toLowerCase()) ||
        m.email.toLowerCase().includes(buscaMotorista.toLowerCase())
    );

    const estatisticas = () => {
        const lista = registrosFiltrados();
        const pendentes = lista.filter(r => r.status === 'Pendente').length;
        const aprovadas = lista.filter(r => r.status === 'Aprovado').length;
        const rejeitadas = lista.filter(r => r.status === 'Rejeitado').length;
        return { total: lista.length, pendentes, aprovadas, rejeitadas };
    };

    if (estaCarregando) {
        return (
            <View style={estilos.containerCarregamento}>
                <ActivityIndicator size="large" color={cores.charcoal} />
                <Text style={estilos.textoCarregamento}>Carregando...</Text>
            </View>
        );
    }

    if (podeVerListaMotoristas && !motoristaSelecionado) {
        const totalPendentes = motoristas.reduce((sum, m) => sum + m.totalPendentes, 0);
        const totalDevolucoes = motoristas.reduce((sum, m) => sum + m.totalDevolucoes, 0);

        return (
            <View style={estilos.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                    <View style={estilos.linhaCabecalho}>
                        <BotaoVoltar />
                        <View style={estilos.centroCabecalho}>
                            <Ionicons name="return-up-back" size={28} color={cores.charcoal} />
                            <Text style={estilos.tituloCabecalho}>Gestão de Devoluções</Text>
                        </View>
                        <View style={{ width: 44 }} />
                    </View>
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
                        <Text style={[estilos.numeroEstatistica, { color: cores.warning }]}>{totalPendentes}</Text>
                        <Text style={estilos.rotuloEstatistica}>Pendentes</Text>
                    </View>
                    <View style={estilos.cartaoEstatistica}>
                        <Text style={estilos.numeroEstatistica}>{totalDevolucoes}</Text>
                        <Text style={estilos.rotuloEstatistica}>Total Devoluções</Text>
                    </View>
                </View>

                <ScrollView style={estilos.listaContainer}>
                    {motoristasFiltrados.length === 0 ? (
                        <View style={estilos.containerVazio}>
                            <Ionicons name="people-outline" size={64} color={cores.dustGrey} />
                            <Text style={estilos.tituloVazio}>Nenhum motorista encontrado</Text>
                            <Text style={estilos.textoVazio}>
                                {buscaMotorista ? 'Tente outro termo de busca' : 'Não há motoristas cadastrados no sistema'}
                            </Text>
                        </View>
                    ) : (
                        motoristasFiltrados.map((motorista) => (
                            <TouchableOpacity
                                key={motorista.uid}
                                style={estilos.cartaoMotorista}
                                onPress={() => buscarDevolucoesDoMotorista(motorista)}
                            >
                                <Avatar.Text size={50} label={motorista.nome.substring(0, 2).toUpperCase()} style={estilos.avatar} />
                                <View style={estilos.infoMotorista}>
                                    <Text style={estilos.nomeMotorista}>{motorista.nome}</Text>
                                    <Text style={estilos.emailMotorista}>{motorista.email}</Text>
                                    <View style={estilos.statusMotorista}>
                                        <View style={estilos.statPill}>
                                            <Ionicons name="return-up-back-outline" size={13} color={cores.grey} />
                                            <Text style={estilos.statPillText}>
                                                {motorista.totalDevolucoes} {motorista.totalDevolucoes === 1 ? 'devolução' : 'devoluções'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={estilos.badgePendentes}>
                                    <Text style={estilos.numeroPendentes}>{motorista.totalPendentes}</Text>
                                    <Text style={estilos.rotuloPendentes}>pendentes</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color={cores.silver} />
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            </View>
        );
    }

    if (podeVerListaMotoristas && motoristaSelecionado) {
        const stats = estatisticas();

        return (
            <View style={estilos.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                    <View style={estilos.linhaCabecalho}>
                        <TouchableOpacity onPress={voltarParaListaMotoristas} style={estilos.botaoVoltarCabecalho}>
                            <Ionicons name="arrow-back" size={24} color={cores.charcoal} />
                        </TouchableOpacity>
                        <View style={estilos.centroCabecalho}>
                            <Text style={estilos.tituloCabecalho}>{motoristaSelecionado.nome}</Text>
                        </View>
                        <TouchableOpacity onPress={() => setMostrarFiltros(!mostrarFiltros)} style={estilos.botaoFiltroCabecalho}>
                            <Ionicons name="options-outline" size={20} color={cores.charcoal} />
                            <Text style={estilos.textoFiltroCabecalho}>Filtro</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                <View style={estilos.containerEstatisticas}>
                    <View style={estilos.cartaoEstatistica}>
                        <Text style={estilos.numeroEstatistica}>{stats.total}</Text>
                        <Text style={estilos.rotuloEstatistica}>Total</Text>
                    </View>
                    <View style={estilos.cartaoEstatistica}>
                        <Text style={[estilos.numeroEstatistica, { color: cores.warning }]}>{stats.pendentes}</Text>
                        <Text style={estilos.rotuloEstatistica}>Pendentes</Text>
                    </View>
                    <View style={estilos.cartaoEstatistica}>
                        <Text style={[estilos.numeroEstatistica, { color: cores.success }]}>{stats.aprovadas}</Text>
                        <Text style={estilos.rotuloEstatistica}>Aprovadas</Text>
                    </View>
                    <View style={estilos.cartaoEstatistica}>
                        <Text style={[estilos.numeroEstatistica, { color: cores.error }]}>{stats.rejeitadas}</Text>
                        <Text style={estilos.rotuloEstatistica}>Rejeitadas</Text>
                    </View>
                </View>

                {mostrarFiltros && (
                    <View style={estilos.painelFiltros}>
                        <ScrollView style={estilos.scrollFiltros}>
                            <Text style={estilos.tituloFiltros}>Filtrar devoluções</Text>

                            <View style={estilos.campoFiltro}>
                                <Ionicons name="search" size={20} color={cores.grey} />
                                <TextInput mode="flat" placeholder="Placa, cliente ou motorista" value={buscaDescricao} onChangeText={setBuscaDescricao} style={estilos.inputFiltro} />
                                {buscaDescricao !== '' && (<TouchableOpacity onPress={() => setBuscaDescricao('')}><Ionicons name="close" size={18} color={cores.silver} /></TouchableOpacity>)}
                            </View>

                            <Text style={estilos.rotuloFiltro}>Status</Text>
                            <View style={estilos.linhaFiltro}>
                                <TouchableOpacity
                                    style={[estilos.botaoFiltro, filtroStatus === 'todas' && estilos.botaoFiltroAtivo]}
                                    onPress={() => setFiltroStatus('todas')}
                                >
                                    <Text style={[estilos.textoFiltro, filtroStatus === 'todas' && estilos.textoFiltroAtivo]}>Todas</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[estilos.botaoFiltro, filtroStatus === 'pendentes' && estilos.botaoFiltroAtivo]}
                                    onPress={() => setFiltroStatus('pendentes')}
                                >
                                    <Text style={[estilos.textoFiltro, filtroStatus === 'pendentes' && estilos.textoFiltroAtivo]}>Pendentes</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[estilos.botaoFiltro, filtroStatus === 'aprovadas' && estilos.botaoFiltroAtivo]}
                                    onPress={() => setFiltroStatus('aprovadas')}
                                >
                                    <Text style={[estilos.textoFiltro, filtroStatus === 'aprovadas' && estilos.textoFiltroAtivo]}>Aprovadas</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[estilos.botaoFiltro, filtroStatus === 'rejeitadas' && estilos.botaoFiltroAtivo]}
                                    onPress={() => setFiltroStatus('rejeitadas')}
                                >
                                    <Text style={[estilos.textoFiltro, filtroStatus === 'rejeitadas' && estilos.textoFiltroAtivo]}>Rejeitadas</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={estilos.rotuloFiltro}>Entrega</Text>
                            <View style={estilos.linhaFiltro}>
                                <TouchableOpacity
                                    style={[estilos.botaoFiltro, filtroEntrega === 'todas' && estilos.botaoFiltroAtivo]}
                                    onPress={() => setFiltroEntrega('todas')}
                                >
                                    <Text style={[estilos.textoFiltro, filtroEntrega === 'todas' && estilos.textoFiltroAtivo]}>Todas</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[estilos.botaoFiltro, filtroEntrega === 'naoEntregues' && estilos.botaoFiltroAtivo]}
                                    onPress={() => setFiltroEntrega('naoEntregues')}
                                >
                                    <Text style={[estilos.textoFiltro, filtroEntrega === 'naoEntregues' && estilos.textoFiltroAtivo]}>Não entregue</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[estilos.botaoFiltro, filtroEntrega === 'entregues' && estilos.botaoFiltroAtivo]}
                                    onPress={() => setFiltroEntrega('entregues')}
                                >
                                    <Text style={[estilos.textoFiltro, filtroEntrega === 'entregues' && estilos.textoFiltroAtivo]}>Entregue</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity style={estilos.botaoLimparFiltros} onPress={limparFiltrosAdmin}>
                                <Ionicons name="refresh" size={18} color={cores.white} />
                                <Text style={estilos.textoLimparFiltros}>Limpar filtros</Text>
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

                <ScrollView style={estilos.listaContainer}>
                    {registrosFiltrados().length === 0 ? (
                        <View style={estilos.containerVazio}>
                            <Ionicons name="return-up-back-outline" size={64} color={cores.dustGrey} />
                            <Text style={estilos.tituloVazio}>Nenhum registro encontrado</Text>
                            <Text style={estilos.textoVazio}>
                                {buscaDescricao || filtroStatus !== 'todas' ? 'Tente outros filtros' : 'Este motorista não possui devoluções'}
                            </Text>
                        </View>
                    ) : (
                        registrosFiltrados().map((item) => (
                            <Card key={item.id} style={estilos.cartao}>
                                {(item.imagemBase64 || item.imagem) && (
                                    <TouchableOpacity onPress={() => abrirImagemNovaAba(item.imagemBase64 || item.imagem!)} activeOpacity={0.9}>
                                        <Image source={{ uri: item.imagemBase64 || item.imagem }} style={estilos.imagemCartao} resizeMode="cover" />
                                    </TouchableOpacity>
                                )}
                                <Card.Content>
                                    <View style={estilos.cabecalhoCartao}>
                                        <View style={[estilos.badgeStatus, { backgroundColor: getStatusColor(item.status) }]}>
                                            <Text style={estilos.textoStatus}>{getStatusText(item.status)}</Text>
                                        </View>
                                        <Text style={estilos.dataCartao}>{formatarData(item.criadoEm)}</Text>
                                        <View style={estilos.acoesCartao}>
                                            {isAdmin && item.status === 'Pendente' && (
                                                <TouchableOpacity onPress={() => editarRegistro(item)}>
                                                    <Ionicons name="pencil" size={20} color={cores.primary} />
                                                </TouchableOpacity>
                                            )}
                                            {isAdmin && item.status !== 'Aprovado' && (
                                                <TouchableOpacity onPress={() => excluirRegistro(item.id)}>
                                                    <Ionicons name="trash" size={20} color={cores.error} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                    <Divider style={estilos.divisor} />
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="car" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Placa: {item.placa}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="calendar" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Data: {item.dataViagem}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="person" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Cliente: {item.nomeCliente}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="alert-circle" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Motivo: {item.motivo}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="person-circle" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Motorista: {item.motoristaNome}</Text>
                                    </View>
                                    {item.documentoRecebedor && (
                                        <View style={estilos.linhaCard}>
                                            <Ionicons name="document" size={18} color={cores.grey} />
                                            <Text style={estilos.infoCartao}>Documento: {item.documentoRecebedor}</Text>
                                        </View>
                                    )}
                                    {item.status === 'Rejeitado' && item.motivoRejeicao && (
                                        <View style={estilos.containerMotivoRejeicao}>
                                            <Ionicons name="alert-circle" size={18} color={cores.error} />
                                            <View style={estilos.conteudoMotivoRejeicao}>
                                                <Text style={estilos.rotuloMotivoRejeicao}>Motivo:</Text>
                                                <Text style={estilos.textoMotivoRejeicao}>{item.motivoRejeicao}</Text>
                                            </View>
                                        </View>
                                    )}
                                    {podeAprovar && item.status === 'Aprovado' && (
                                        <View style={estilos.linhaStatusEntrega}>
                                            <View style={[estilos.badgeStatusEntrega, { backgroundColor: item.statusEntrega === 'Entregue' ? cores.charcoal : cores.dustGrey }]}>
                                                <Ionicons name={item.statusEntrega === 'Entregue' ? 'checkmark-circle' : 'time-outline'} size={14} color={item.statusEntrega === 'Entregue' ? cores.white : cores.grey} />
                                                <Text style={[estilos.textoBadgeStatusEntrega, { color: item.statusEntrega === 'Entregue' ? cores.white : cores.grey }]}>
                                                    {item.statusEntrega === 'Entregue' ? 'Entregue' : 'Pendente de entrega'}
                                                </Text>
                                            </View>
                                            {item.statusEntrega !== 'Entregue' && (
                                                <TouchableOpacity onPress={() => marcarComoEntregue(item)} style={estilos.botaoMarcarEntregue}>
                                                    <Text style={estilos.textoBotaoMarcarEntregue}>Marcar como entregue</Text>
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    )}
                                    {podeAprovar && item.status === 'Pendente' && (
                                        <View style={estilos.botoesAprovacao}>
                                            <TouchableOpacity
                                                style={[estilos.botaoAprovar, { backgroundColor: cores.success }]}
                                                onPress={() => {
                                                    setDevolucaoParaAprovar(item);
                                                    setModalEntregaVisivel(true);
                                                }}
                                            >
                                                <Ionicons name="checkmark" size={20} color={cores.white} />
                                                <Text style={estilos.textoBotaoAprovar}>Aprovar</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[estilos.botaoAprovar, { backgroundColor: cores.error }]}
                                                onPress={() => {
                                                    setDevolucaoParaRejeitar(item);
                                                    setMotivoRejeicao('');
                                                    setJustificativaModalVisivel(true);
                                                }}
                                            >
                                                <Ionicons name="close" size={20} color={cores.white} />
                                                <Text style={estilos.textoBotaoAprovar}>Rejeitar</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    {isFuncionario && item.status === 'Pendente' && (
                                        <View style={estilos.statusPendenteInfo}>
                                            <Ionicons name="time-outline" size={16} color={cores.warning} />
                                            <Text style={estilos.statusPendenteTexto}>Aguardando aprovação do responsável</Text>
                                        </View>
                                    )}
                                </Card.Content>
                            </Card>
                        ))
                    )}
                </ScrollView>

                <Modal visible={justificativaModalVisivel} transparent animationType="fade">
                    <View style={estilos.overlayModal}>
                        <View style={estilos.conteudoModalRejeicao}>
                            <View style={estilos.cabecalhoModalRejeicao}>
                                <Ionicons name="close-circle" size={40} color={cores.error} />
                                <Text style={estilos.tituloModalRejeicao}>Rejeitar Devolucao</Text>
                                <Text style={estilos.subtituloModalRejeicao}>Motorista: {devolucaoParaRejeitar?.motoristaNome}</Text>
                            </View>
                            <TextInput
                                mode="outlined"
                                label="Motivo da rejeição"
                                value={motivoRejeicao}
                                onChangeText={setMotivoRejeicao}
                                multiline
                                numberOfLines={4}
                                style={estilos.inputModalRejeicao}
                                outlineColor={cores.dustGrey}
                                activeOutlineColor={cores.error}
                                placeholder="Descreva o motivo da rejeição..."
                            />
                            <View style={estilos.botoesModalRejeicao}>
                                <TouchableOpacity
                                    style={estilos.botaoCancelarModalRejeicao}
                                    onPress={() => {
                                        setJustificativaModalVisivel(false);
                                        setDevolucaoParaRejeitar(null);
                                        setMotivoRejeicao('');
                                    }}
                                >
                                    <Text style={estilos.textoCancelarModalRejeicao}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={estilos.botaoConfirmarModalRejeicao}
                                    onPress={rejeitarDevolucao}
                                >
                                    <Ionicons name="close" size={20} color={cores.white} />
                                    <Text style={estilos.textoConfirmarModalRejeicao}>Rejeitar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <Modal visible={modalEntregaVisivel} transparent animationType="fade">
                    <View style={estilos.overlayModal}>
                        <View style={estilos.conteudoModalRejeicao}>
                            <View style={estilos.cabecalhoModalEntrega}>
                                <Ionicons name="cube" size={40} color={cores.charcoal} />
                                <Text style={estilos.tituloModalEntrega}>Status da Entrega</Text>
                                <Text style={estilos.subtituloModalRejeicao}>A mercadoria já foi entregue?</Text>
                            </View>
                            <View style={estilos.botoesModalEntrega}>
                                <TouchableOpacity
                                    style={estilos.botaoPendenteModalEntrega}
                                    onPress={() => devolucaoParaAprovar && aprovarDevolucao(devolucaoParaAprovar, 'Pendente')}
                                >
                                    <Ionicons name="time-outline" size={20} color={cores.grey} />
                                    <Text style={estilos.textoPendenteModalEntrega}>Pendente</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={estilos.botaoEntregueModalEntrega}
                                    onPress={() => devolucaoParaAprovar && aprovarDevolucao(devolucaoParaAprovar, 'Entregue')}
                                >
                                    <Ionicons name="checkmark-circle" size={20} color={cores.white} />
                                    <Text style={estilos.textoEntregueModalEntrega}>Entregue</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <Modal visible={modalVisible} animationType="slide" transparent>
                    <View style={estilos.containerModal}>
                        <View style={estilos.conteudoModal}>
                            <View style={estilos.cabecalhoModal}>
                                <Text style={estilos.tituloModal}>{editando ? 'Editar Registro' : 'Novo Comprovante'}</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={cores.grey} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                {(comprimindoImagem || imagemBase64) && (
                                    <View style={estilos.botaoCameraModal}>
                                        {comprimindoImagem ? (
                                            <View style={estilos.placeholderCameraModal}>
                                                <ActivityIndicator size="large" color={cores.primary} />
                                                <Text style={estilos.textoCameraModal}>Processando imagem...</Text>
                                            </View>
                                        ) : (
                                            <Image source={{ uri: imagemBase64 || undefined }} style={estilos.previsualizacaoModal} />
                                        )}
                                    </View>
                                )}
                                <View style={estilos.linhaBotoesFoto}>
                                    <TouchableOpacity style={estilos.botaoFotoOpcao} onPress={tirarFoto} disabled={comprimindoImagem}>
                                        <Ionicons name="camera" size={22} color={cores.primary} />
                                        <Text style={estilos.botaoFotoOpcaoTexto}>Tirar foto</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={estilos.botaoFotoOpcao} onPress={escolherDaGaleria} disabled={comprimindoImagem}>
                                        <Ionicons name="images" size={22} color={cores.primary} />
                                        <Text style={estilos.botaoFotoOpcaoTexto}>Galeria</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={estilos.rotuloModal}>Placa do Cavalo *</Text>
                                {cavalosDisponiveis.length === 0 ? (
                                    <Text style={estilos.semPlacaText}>Nenhum cavalo cadastrado. Contate o administrador.</Text>
                                ) : (
                                    <ScrollView horizontal style={estilos.scrollPlacas}>
                                        {cavalosDisponiveis.map((c) => (
                                            <TouchableOpacity
                                                key={c.id}
                                                style={[estilos.botaoPlacaModal, placaSelecionada === c.placa && estilos.botaoPlacaModalAtivo]}
                                                onPress={() => setPlacaSelecionada(c.placa)}
                                            >
                                                <Text style={[estilos.textoPlacaModal, placaSelecionada === c.placa && estilos.textoPlacaModalAtivo]}>
                                                    {c.placa}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}

                                <TextInput
                                    mode="outlined"
                                    label="Data da Viagem (DD/MM/AAAA)"
                                    value={dataViagem}
                                    onChangeText={setDataViagem}
                                    style={estilos.inputModal}
                                    outlineColor={cores.dustGrey}
                                    activeOutlineColor={cores.primary}
                                />

                                <TextInput
                                    mode="outlined"
                                    label="Motivo da Devolucao *"
                                    value={motivo}
                                    onChangeText={setMotivo}
                                    multiline
                                    numberOfLines={3}
                                    style={[estilos.inputModal, estilos.textAreaModal]}
                                    outlineColor={cores.dustGrey}
                                    activeOutlineColor={cores.primary}
                                    placeholder="Ex: Produto com defeito, Cliente desistiu, etc..."
                                />

                                <TextInput
                                    mode="outlined"
                                    label="Nome do Cliente *"
                                    value={nomeCliente}
                                    onChangeText={setNomeCliente}
                                    style={estilos.inputModal}
                                    outlineColor={cores.dustGrey}
                                    activeOutlineColor={cores.primary}
                                />

                                <Text style={estilos.rotuloModal}>Dados do Recebedor (opcional)</Text>
                                <TextInput
                                    mode="outlined"
                                    label="Documento (CPF/RG)"
                                    value={documentoRecebedor}
                                    onChangeText={setDocumentoRecebedor}
                                    style={estilos.inputModal}
                                    outlineColor={cores.dustGrey}
                                    activeOutlineColor={cores.primary}
                                />

                                <View style={estilos.botoesModal}>
                                    <Button
                                        mode="outlined"
                                        onPress={() => setModalVisible(false)}
                                        style={estilos.botaoCancelarModal}
                                        labelStyle={estilos.rotuloCancelarModal}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        mode="contained"
                                        onPress={salvarRegistro}
                                        loading={estaSalvando}
                                        disabled={estaSalvando || comprimindoImagem}
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
            </View>
        );
    }

    if (isMotorista) {
        if (cavalosDisponiveis.length === 0) {
            return (
                <View style={estilos.container}>
                    <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                        <View style={estilos.linhaCabecalho}>
                            <BotaoVoltar />
                            <View style={estilos.centroCabecalho}>
                                <Ionicons name="return-up-back" size={28} color={cores.charcoal} />
                                <Text style={estilos.tituloCabecalho}>Minhas Devoluções</Text>
                            </View>
                            <View style={{ width: 44 }} />
                        </View>
                    </LinearGradient>

                    <View style={estilos.containerVazio}>
                        <Ionicons name="car-outline" size={64} color={cores.dustGrey} />
                        <Text style={estilos.tituloVazio}>Nenhum cavalo vinculado</Text>
                        <Text style={estilos.textoVazio}>
                            Você precisa ter um cavalo vinculado para registrar devoluções.
                        </Text>
                        <Text style={estilos.textoVazio}>
                            Entre em contato com o administrador para vincular um cavalo ao seu cadastro.
                        </Text>
                    </View>
                </View>
            );
        }

        const stats = estatisticas();

        return (
            <View style={estilos.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                    <View style={estilos.linhaCabecalho}>
                        <BotaoVoltar />
                        <View style={estilos.centroCabecalho}>
                            <Ionicons name="return-up-back" size={28} color={cores.charcoal} />
                            <Text style={estilos.tituloCabecalho}>Minhas Devoluções</Text>
                        </View>
                        <View style={{ width: 44 }} />
                    </View>
                </LinearGradient>

                <View style={estilos.containerEstatisticas}>
                    <View style={estilos.cartaoEstatistica}>
                        <Text style={estilos.numeroEstatistica}>{stats.total}</Text>
                        <Text style={estilos.rotuloEstatistica}>Total</Text>
                    </View>
                    <View style={estilos.cartaoEstatistica}>
                        <Text style={[estilos.numeroEstatistica, { color: cores.warning }]}>{stats.pendentes}</Text>
                        <Text style={estilos.rotuloEstatistica}>Pendentes</Text>
                    </View>
                    <View style={estilos.cartaoEstatistica}>
                        <Text style={[estilos.numeroEstatistica, { color: cores.success }]}>{stats.aprovadas}</Text>
                        <Text style={estilos.rotuloEstatistica}>Aprovadas</Text>
                    </View>
                    <View style={estilos.cartaoEstatistica}>
                        <Text style={[estilos.numeroEstatistica, { color: cores.error }]}>{stats.rejeitadas}</Text>
                        <Text style={estilos.rotuloEstatistica}>Rejeitadas</Text>
                    </View>
                </View>

                <TouchableOpacity
                    style={estilos.botaoAdicionar}
                    onPress={() => {
                        limparFormulario();
                        setModalVisible(true);
                    }}
                >
                    <LinearGradient colors={[cores.charcoal, cores.grey]} style={estilos.gradienteAdicionar}>
                        <Ionicons name="camera" size={24} color={cores.white} />
                        <Text style={estilos.textoBotaoAdicionar}>NOVO COMPROVANTE</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <ScrollView style={estilos.listaContainer}>
                    {registrosFiltrados().length === 0 ? (
                        <View style={estilos.containerVazio}>
                            <Ionicons name="return-up-back-outline" size={64} color={cores.dustGrey} />
                            <Text style={estilos.tituloVazio}>Nenhuma devolucao</Text>
                            <Text style={estilos.textoVazio}>Clique em "NOVO COMPROVANTE" para começar</Text>
                        </View>
                    ) : (
                        registrosFiltrados().map((item) => (
                            <Card key={item.id} style={estilos.cartao}>
                                {(item.imagemBase64 || item.imagem) && (
                                    <TouchableOpacity onPress={() => abrirImagemNovaAba(item.imagemBase64 || item.imagem!)} activeOpacity={0.9}>
                                        <Image source={{ uri: item.imagemBase64 || item.imagem }} style={estilos.imagemCartao} resizeMode="cover" />
                                    </TouchableOpacity>
                                )}
                                <Card.Content>
                                    <View style={estilos.cabecalhoCartao}>
                                        <View style={[estilos.badgeStatus, { backgroundColor: getStatusColor(item.status) }]}>
                                            <Text style={estilos.textoStatus}>{getStatusText(item.status)}</Text>
                                        </View>
                                        <Text style={estilos.dataCartao}>{formatarData(item.criadoEm)}</Text>
                                        <View style={estilos.acoesCartao}>
                                            {(item.status === 'Pendente' || item.status === 'Rejeitado') && (
                                                <TouchableOpacity onPress={() => editarRegistro(item)}>
                                                    <Ionicons name="pencil" size={20} color={cores.primary} />
                                                </TouchableOpacity>
                                            )}
                                            {(item.status === 'Pendente' || item.status === 'Rejeitado') && (
                                                <TouchableOpacity onPress={() => excluirRegistro(item.id)}>
                                                    <Ionicons name="trash" size={20} color={cores.error} />
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                    <Divider style={estilos.divisor} />
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="car" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Placa: {item.placa}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="calendar" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Data: {item.dataViagem}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="person" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Cliente: {item.nomeCliente}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="alert-circle" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Motivo: {item.motivo}</Text>
                                    </View>
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="person-circle" size={18} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Motorista: {item.motoristaNome}</Text>
                                    </View>
                                    {item.documentoRecebedor && (
                                        <View style={estilos.linhaCard}>
                                            <Ionicons name="document" size={18} color={cores.grey} />
                                            <Text style={estilos.infoCartao}>Documento: {item.documentoRecebedor}</Text>
                                        </View>
                                    )}
                                    {item.status === 'Rejeitado' && item.motivoRejeicao && (
                                        <View style={estilos.containerMotivoRejeicao}>
                                            <Ionicons name="alert-circle" size={18} color={cores.error} />
                                            <View style={estilos.conteudoMotivoRejeicao}>
                                                <Text style={estilos.rotuloMotivoRejeicao}>Motivo:</Text>
                                                <Text style={estilos.textoMotivoRejeicao}>{item.motivoRejeicao}</Text>
                                            </View>
                                        </View>
                                    )}
                                    {item.status === 'Pendente' && (
                                        <View style={estilos.statusPendenteInfo}>
                                            <Ionicons name="time-outline" size={16} color={cores.warning} />
                                            <Text style={estilos.statusPendenteTexto}>Aguardando aprovação</Text>
                                        </View>
                                    )}
                                </Card.Content>
                            </Card>
                        ))
                    )}
                </ScrollView>

                <Modal visible={justificativaModalVisivel} transparent animationType="fade">
                    <View style={estilos.overlayModal}>
                        <View style={estilos.conteudoModalRejeicao}>
                            <View style={estilos.cabecalhoModalRejeicao}>
                                <Ionicons name="close-circle" size={40} color={cores.error} />
                                <Text style={estilos.tituloModalRejeicao}>Rejeitar Devolucao</Text>
                                <Text style={estilos.subtituloModalRejeicao}>Motorista: {devolucaoParaRejeitar?.motoristaNome}</Text>
                            </View>
                            <TextInput
                                mode="outlined"
                                label="Motivo da rejeição"
                                value={motivoRejeicao}
                                onChangeText={setMotivoRejeicao}
                                multiline
                                numberOfLines={4}
                                style={estilos.inputModalRejeicao}
                                outlineColor={cores.dustGrey}
                                activeOutlineColor={cores.error}
                                placeholder="Descreva o motivo da rejeicao..."
                            />
                            <View style={estilos.botoesModalRejeicao}>
                                <TouchableOpacity
                                    style={estilos.botaoCancelarModalRejeicao}
                                    onPress={() => {
                                        setJustificativaModalVisivel(false);
                                        setDevolucaoParaRejeitar(null);
                                        setMotivoRejeicao('');
                                    }}
                                >
                                    <Text style={estilos.textoCancelarModalRejeicao}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={estilos.botaoConfirmarModalRejeicao}
                                    onPress={rejeitarDevolucao}
                                >
                                    <Ionicons name="close" size={20} color={cores.white} />
                                    <Text style={estilos.textoConfirmarModalRejeicao}>Rejeitar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>

                <Modal visible={modalVisible} animationType="slide" transparent>
                    <View style={estilos.containerModal}>
                        <View style={estilos.conteudoModal}>
                            <View style={estilos.cabecalhoModal}>
                                <Text style={estilos.tituloModal}>{editando ? 'Editar Registro' : 'Novo Comprovante'}</Text>
                                <TouchableOpacity onPress={() => setModalVisible(false)}>
                                    <Ionicons name="close" size={24} color={cores.grey} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView showsVerticalScrollIndicator={false}>
                                {(comprimindoImagem || imagemBase64) && (
                                    <View style={estilos.botaoCameraModal}>
                                        {comprimindoImagem ? (
                                            <View style={estilos.placeholderCameraModal}>
                                                <ActivityIndicator size="large" color={cores.primary} />
                                                <Text style={estilos.textoCameraModal}>Processando imagem...</Text>
                                            </View>
                                        ) : (
                                            <Image source={{ uri: imagemBase64 || undefined }} style={estilos.previsualizacaoModal} />
                                        )}
                                    </View>
                                )}
                                <View style={estilos.linhaBotoesFoto}>
                                    <TouchableOpacity style={estilos.botaoFotoOpcao} onPress={tirarFoto} disabled={comprimindoImagem}>
                                        <Ionicons name="camera" size={22} color={cores.primary} />
                                        <Text style={estilos.botaoFotoOpcaoTexto}>Tirar foto</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={estilos.botaoFotoOpcao} onPress={escolherDaGaleria} disabled={comprimindoImagem}>
                                        <Ionicons name="images" size={22} color={cores.primary} />
                                        <Text style={estilos.botaoFotoOpcaoTexto}>Galeria</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={estilos.rotuloModal}>Placa do Cavalo *</Text>
                                {cavalosDisponiveis.length === 0 ? (
                                    <Text style={estilos.semPlacaText}>Nenhum cavalo cadastrado. Contate o administrador.</Text>
                                ) : (
                                    <ScrollView horizontal style={estilos.scrollPlacas}>
                                        {cavalosDisponiveis.map((c) => (
                                            <TouchableOpacity
                                                key={c.id}
                                                style={[estilos.botaoPlacaModal, placaSelecionada === c.placa && estilos.botaoPlacaModalAtivo]}
                                                onPress={() => setPlacaSelecionada(c.placa)}
                                            >
                                                <Text style={[estilos.textoPlacaModal, placaSelecionada === c.placa && estilos.textoPlacaModalAtivo]}>
                                                    {c.placa}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                )}

                                <TextInput
                                    mode="outlined"
                                    label="Data da Viagem (DD/MM/AAAA)"
                                    value={dataViagem}
                                    onChangeText={setDataViagem}
                                    style={estilos.inputModal}
                                    outlineColor={cores.dustGrey}
                                    activeOutlineColor={cores.primary}
                                />

                                <TextInput
                                    mode="outlined"
                                    label="Motivo da Devolução *"
                                    value={motivo}
                                    onChangeText={setMotivo}
                                    multiline
                                    numberOfLines={3}
                                    style={[estilos.inputModal, estilos.textAreaModal]}
                                    outlineColor={cores.dustGrey}
                                    activeOutlineColor={cores.primary}
                                    placeholder="Ex: Produto com defeito, Cliente desistiu, etc..."
                                />

                                <TextInput
                                    mode="outlined"
                                    label="Nome do Cliente *"
                                    value={nomeCliente}
                                    onChangeText={setNomeCliente}
                                    style={estilos.inputModal}
                                    outlineColor={cores.dustGrey}
                                    activeOutlineColor={cores.primary}
                                    
                                />

                                <Text style={estilos.rotuloModal}>Dados do Recebedor (opcional)</Text>
                                <TextInput
                                    mode="outlined"
                                    label="Documento (CPF/RG)"
                                    value={documentoRecebedor}
                                    onChangeText={setDocumentoRecebedor}
                                    style={estilos.inputModal}
                                    outlineColor={cores.dustGrey}
                                    activeOutlineColor={cores.primary}
                                />

                                <View style={estilos.botoesModal}>
                                    <Button
                                        mode="outlined"
                                        onPress={() => setModalVisible(false)}
                                        style={estilos.botaoCancelarModal}
                                        labelStyle={estilos.rotuloCancelarModal}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        mode="contained"
                                        onPress={salvarRegistro}
                                        loading={estaSalvando}
                                        disabled={estaSalvando || comprimindoImagem}
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
            </View>
        );
    }

    return (
        <View style={estilos.container}>
            <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                <View style={estilos.linhaCabecalho}>
                    <BotaoVoltar />
                    <View style={estilos.centroCabecalho}>
                        <Ionicons name="return-up-back" size={28} color={cores.charcoal} />
                        <Text style={estilos.tituloCabecalho}>Devoluções</Text>
                    </View>
                    <View style={{ width: 44 }} />
                </View>
            </LinearGradient>
            <View style={estilos.containerAcessoNegado}>
                <Ionicons name="lock-closed" size={64} color={cores.error} />
                <Text style={estilos.tituloAcessoNegado}>Acesso Restrito</Text>
                <Text style={estilos.textoAcessoNegado}>
                    Apenas gerentes, funcionarios e motoristas podem acessar esta tela.
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
    botaoFiltroCabecalho: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.white, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
    textoFiltroCabecalho: { fontSize: 16, color: cores.charcoal, fontWeight: '500' },
    botaoVoltarCabecalho: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.white, alignItems: 'center', justifyContent: 'center', elevation: 2 },

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

    cartaoMotorista: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.white, borderRadius: 20, padding: 16, marginBottom: 12, elevation: 3 },
    avatar: { backgroundColor: cores.primary },
    infoMotorista: { flex: 1, marginLeft: 16 },
    nomeMotorista: { fontSize: 22, fontWeight: '600', color: cores.charcoal },
    emailMotorista: { fontSize: 16, color: cores.grey, marginTop: 2 },
    statusMotorista: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 8 },
    statPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: cores.platinum,
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 5,
        gap: 5,
    },
    statPillText: { fontSize: 16, color: cores.grey, fontWeight: '500', includeFontPadding: false, textAlignVertical: 'center' },
    badgePendentes: { backgroundColor: cores.warning, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, alignItems: 'center', marginRight: 8, minWidth: 60 },
    numeroPendentes: { color: cores.white, fontSize: 22, fontWeight: 'bold', textAlign: 'center' },
    rotuloPendentes: { color: cores.white, fontSize: 14, textAlign: 'center' },

    cartao: { marginBottom: 12, borderRadius: 20, backgroundColor: cores.white, elevation: 3, overflow: 'hidden' },
    imagemCartao: { width: '100%', height: 200, resizeMode: 'cover' },
    cabecalhoCartao: { flexDirection: 'row', alignItems: 'center', marginTop: 12, marginBottom: 12, flexWrap: 'wrap', gap: 8 },
    badgeStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    textoStatus: { color: cores.white, fontSize: 14, fontWeight: 'bold' },
    dataCartao: { fontSize: 16, color: cores.silver, marginLeft: 'auto' },
    acoesCartao: { flexDirection: 'row', gap: 8 },
    divisor: { marginVertical: 12, backgroundColor: cores.dustGrey },
    linhaCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
    infoCartao: { fontSize: 19, color: cores.grey, flex: 1 },
    statusPendenteInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', padding: 10, borderRadius: 12, marginTop: 12, gap: 8 },
    statusPendenteTexto: { fontSize: 16, color: cores.warning, fontWeight: '500', flex: 1 },

    containerMotivoRejeicao: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: '#FFEBEE', padding: 12, borderRadius: 12, marginTop: 12, gap: 10 },
    conteudoMotivoRejeicao: { flex: 1 },
    rotuloMotivoRejeicao: { fontSize: 15, color: cores.error, fontWeight: '600', marginBottom: 4 },
    textoMotivoRejeicao: { fontSize: 18, color: cores.error, lineHeight: 24 },

    botoesAprovacao: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: cores.dustGrey },
    botaoAprovar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
    textoBotaoAprovar: { color: cores.white, fontSize: 16, fontWeight: '600' },

    painelFiltros: { backgroundColor: cores.white, margin: 16, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: cores.dustGrey, maxHeight: '80%' },
    scrollFiltros: { maxHeight: '100%' },
    tituloFiltros: { fontSize: 24, fontWeight: 'bold', color: cores.charcoal, marginBottom: 16, textAlign: 'center' },
    campoFiltro: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.platinum, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: cores.dustGrey },
    inputFiltro: { flex: 1, paddingVertical: 0, height: 48, fontSize: 19, color: cores.charcoal, backgroundColor: 'transparent' },
    rotuloFiltro: { fontSize: 19, fontWeight: '600', color: cores.charcoal, marginBottom: 8, marginTop: 8 },
    linhaFiltro: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
    botaoFiltro: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: cores.platinum, borderWidth: 1, borderColor: cores.dustGrey },
    botaoFiltroAtivo: { backgroundColor: cores.primary, borderColor: cores.primary },
    textoFiltro: { fontSize: 18, color: cores.grey },
    textoFiltroAtivo: { color: cores.white, fontWeight: '600' },
    botaoLimparFiltros: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: cores.error, paddingVertical: 12, borderRadius: 12, gap: 8, marginTop: 8 },
    textoLimparFiltros: { color: cores.white, fontSize: 19, fontWeight: '600' },

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
    scrollPlacas: { flexDirection: 'row', marginBottom: 16 },
    botaoPlacaModal: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: cores.platinum, borderRadius: 12, marginRight: 12, borderWidth: 1, borderColor: cores.dustGrey },
    botaoPlacaModalAtivo: { backgroundColor: cores.primary, borderColor: cores.primary },
    textoPlacaModal: { fontSize: 19, color: cores.grey },
    textoPlacaModalAtivo: { color: cores.white, fontWeight: '600' },
    semPlacaText: { fontSize: 19, color: cores.error, textAlign: 'center', marginBottom: 16, padding: 12, backgroundColor: '#FFEBEE', borderRadius: 8 },
    inputModal: { marginBottom: 16, backgroundColor: cores.white },
    textAreaModal: { minHeight: 80 },
    botoesModal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 12, marginBottom: 20 },
    botaoCancelarModal: { flex: 1, borderColor: cores.error, borderRadius: 12, backgroundColor: 'transparent' },
    rotuloCancelarModal: { color: cores.error, fontSize: 19, fontWeight: '600' },
    botaoSalvarModal: { flex: 1, backgroundColor: cores.primary, borderRadius: 12 },
    rotuloSalvarModal: { fontSize: 19, fontWeight: '600', color: cores.white },

    overlayModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    conteudoModalRejeicao: { backgroundColor: cores.white, borderRadius: 28, padding: 24, width: '90%', maxWidth: 400 },
    cabecalhoModalRejeicao: { alignItems: 'center', marginBottom: 20 },
    tituloModalRejeicao: { fontSize: 30, fontWeight: 'bold', color: cores.error, marginTop: 12 },
    subtituloModalRejeicao: { fontSize: 19, color: cores.grey, marginTop: 4 },
    linhaStatusEntrega: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: cores.dustGrey, flexWrap: 'wrap', gap: 8 },
    badgeStatusEntrega: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
    textoBadgeStatusEntrega: { fontSize: 15, fontWeight: 'bold' },
    botaoMarcarEntregue: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: cores.charcoal },
    textoBotaoMarcarEntregue: { fontSize: 16, color: cores.charcoal, fontWeight: '600' },
    cabecalhoModalEntrega: { alignItems: 'center', marginBottom: 20 },
    tituloModalEntrega: { fontSize: 30, fontWeight: 'bold', color: cores.charcoal, marginTop: 12 },
    botoesModalEntrega: { flexDirection: 'row', gap: 12, marginTop: 8 },
    botaoPendenteModalEntrega: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: cores.dustGrey, gap: 8 },
    textoPendenteModalEntrega: { color: cores.grey, fontWeight: '600', fontSize: 19 },
    botaoEntregueModalEntrega: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, backgroundColor: cores.charcoal, gap: 8 },
    textoEntregueModalEntrega: { color: cores.white, fontWeight: '600', fontSize: 19 },
    inputModalRejeicao: { marginBottom: 24, backgroundColor: cores.white, minHeight: 100 },
    botoesModalRejeicao: { flexDirection: 'row', gap: 12 },
    botaoCancelarModalRejeicao: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: cores.error, alignItems: 'center', backgroundColor: 'transparent' },
    textoCancelarModalRejeicao: { color: cores.error, fontWeight: '600', fontSize: 19 },
    botaoConfirmarModalRejeicao: { flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 12, backgroundColor: cores.error, alignItems: 'center', justifyContent: 'center', gap: 8 },
    textoConfirmarModalRejeicao: { color: cores.white, fontWeight: '600', fontSize: 19 },

    containerAcessoNegado: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    tituloAcessoNegado: { fontSize: 27, fontWeight: 'bold', color: cores.error, marginTop: 16 },
    textoAcessoNegado: { fontSize: 19, color: cores.grey, textAlign: 'center', marginTop: 8 },
});