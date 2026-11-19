import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    updateDoc,
    where
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
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
    ActivityIndicator,
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

interface Viagem {
    id: string;
    destino: string;
    motoristaId: string;
    motoristaNome: string;
    motoristaEmail: string;
    dataViagem: string;
    notasVinculadas: NotaVinculada[];
    status: 'Pendente' | 'Aprovada' | 'Rejeitada';
    criadoEm: any;
    criadoPor: string;
    criadoPorNome: string;
}

interface NotaVinculada {
    id: string;
    numeroNota: string;
    imagemBase64?: string;
    valorFrete: number;
    status: 'Pendente' | 'Aprovado' | 'Rejeitado';
    motivoRejeicao?: string;
    aprovadoPor?: string;
    aprovadoPorNome?: string;
    aprovadoEm?: Date;
    observacao?: string;
}

interface MotoristaInfo {
    uid: string;
    nome: string;
    email: string;
    totalViagens?: number;
    totalPendentes?: number;
}

export default function TelaNotas() {
    const [usuario, setUsuario] = useState<any>(null);
    const [cargo, setCargo] = useState<string>('');
    const [estaCarregando, setEstaCarregando] = useState(true);
    
    const [motoristas, setMotoristas] = useState<MotoristaInfo[]>([]);
    const [buscaMotorista, setBuscaMotorista] = useState('');
    const [motoristaSelecionado, setMotoristaSelecionado] = useState<MotoristaInfo | null>(null);
    const [viagens, setViagens] = useState<Viagem[]>([]);
    const [viagensFiltradas, setViagensFiltradas] = useState<Viagem[]>([]);
    
    const [filtroStatus, setFiltroStatus] = useState<string>('todas');
    const [buscaNumeroNota, setBuscaNumeroNota] = useState('');
    const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoType>('todas');
    const [dataInicio, setDataInicio] = useState<Date | null>(null);
    const [dataFim, setDataFim] = useState<Date | null>(null);
    const [mostrarFiltros, setMostrarFiltros] = useState(false);
    
    const [modalViagemVisivel, setModalViagemVisivel] = useState(false);
    const [editandoViagem, setEditandoViagem] = useState<Viagem | null>(null);
    const [estaSalvando, setEstaSalvando] = useState(false);
    
    const [destino, setDestino] = useState('');
    const [dataViagem, setDataViagem] = useState('');
    const [notasVinculadas, setNotasVinculadas] = useState<NotaVinculada[]>([]);
    const [freteCalculado, setFreteCalculado] = useState(0);
    
    const [modalNotaVisivel, setModalNotaVisivel] = useState(false);
    const [notaEditando, setNotaEditando] = useState<{ viagemId: string; notaId: string; notaIndex: number } | null>(null);
    const [imagemNota, setImagemNota] = useState<string | undefined>(undefined);
    const [observacaoNota, setObservacaoNota] = useState('');
    const [comprimindoImagem, setComprimindoImagem] = useState(false);
    
    const [justificativaModalVisivel, setJustificativaModalVisivel] = useState(false);
    const [notaParaRejeitar, setNotaParaRejeitar] = useState<{ viagemId: string; notaIndex: number } | null>(null);
    const [motivoRejeicao, setMotivoRejeicao] = useState('');

    const podeGerenciar = cargo === 'gerente' || cargo === 'superadmin';
    const podeAnexar = cargo === 'motorista';

    useEffect(() => {
        const buscarUsuario = async () => {
            if (!auth.currentUser) {
                setEstaCarregando(false);
                return;
            }

            try {
                const consulta = query(collection(db, 'usuarios'), where('email', '==', auth.currentUser.email));
                const resultado = await getDocs(consulta);
                
                if (!resultado.empty) {
                    resultado.forEach((doc) => {
                        const dados = doc.data();
                        setUsuario({ uid: doc.id, ...dados });
                        setCargo(dados.cargo);
                    });
                }
                setEstaCarregando(false);
            } catch (erro) {
                setEstaCarregando(false);
            }
        };
        buscarUsuario();
    }, []);

    useEffect(() => {
        if (cargo) {
            if (podeGerenciar) {
                buscarMotoristas();
            } else if (podeAnexar && usuario) {
                buscarMinhasViagens();
            }
            setDataViagem(new Date().toLocaleDateString('pt-BR'));
        }
    }, [cargo, usuario]);

    useEffect(() => {
        aplicarFiltros();
    }, [viagens, filtroStatus, buscaNumeroNota, filtroPeriodo, dataInicio, dataFim]);

    const filtrarPorPeriodo = (itens: Viagem[], periodo: PeriodoType, inicio?: Date | null, fim?: Date | null) => {
        if (periodo === 'todas') return itens;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const fimHoje = new Date();
        fimHoje.setHours(23, 59, 59, 999);
        let dataInicioPeriodo: Date, dataFimPeriodo: Date;
        switch (periodo) {
            case 'hoje':
                dataInicioPeriodo = hoje;
                dataFimPeriodo = fimHoje;
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
                dataInicioPeriodo = inicioSemana;
                dataFimPeriodo = fimSemana;
                break;
            }
            case 'esteMes': {
                dataInicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                dataFimPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
                dataFimPeriodo.setHours(23, 59, 59, 999);
                break;
            }
            case 'mesPassado': {
                dataInicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                dataFimPeriodo = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                dataFimPeriodo.setHours(23, 59, 59, 999);
                break;
            }
            case 'ultimos3Meses': {
                dataInicioPeriodo = new Date(hoje);
                dataInicioPeriodo.setMonth(hoje.getMonth() - 3);
                dataInicioPeriodo.setHours(0, 0, 0, 0);
                dataFimPeriodo = fimHoje;
                break;
            }
            case 'anoAtual': {
                dataInicioPeriodo = new Date(hoje.getFullYear(), 0, 1);
                dataFimPeriodo = new Date(hoje.getFullYear(), 11, 31);
                dataFimPeriodo.setHours(23, 59, 59, 999);
                break;
            }
            case 'personalizado':
                if (!inicio || !fim) return itens;
                dataInicioPeriodo = new Date(inicio);
                dataInicioPeriodo.setHours(0, 0, 0, 0);
                dataFimPeriodo = new Date(fim);
                dataFimPeriodo.setHours(23, 59, 59, 999);
                break;
            default:
                return itens;
        }
        return itens.filter(item => {
            if (!item.dataViagem) return false;
            const partes = item.dataViagem.split('/');
            if (partes.length !== 3) return false;
            const dia = parseInt(partes[0]);
            const mes = parseInt(partes[1]) - 1;
            const ano = parseInt(partes[2]);
            const dataItem = new Date(ano, mes, dia);
            dataItem.setHours(12, 0, 0, 0);
            return dataItem >= dataInicioPeriodo && dataItem <= dataFimPeriodo;
        });
    };

    const aplicarFiltros = () => {
        if (!viagens.length) {
            setViagensFiltradas([]);
            return;
        }
        
        let filtradas = [...viagens];
        
        if (filtroStatus !== 'todas') {
            filtradas = filtradas.filter(v => v.status === filtroStatus);
        }
        
        if (buscaNumeroNota.trim() !== '') {
            const buscaLower = buscaNumeroNota.trim().toLowerCase();
            filtradas = filtradas.filter(v =>
                v.notasVinculadas.some(n => n.numeroNota.toLowerCase().includes(buscaLower))
            );
        }
        
        filtradas = filtrarPorPeriodo(filtradas, filtroPeriodo, dataInicio, dataFim);
        
        setViagensFiltradas(filtradas);
    };

    const limparFiltros = () => {
        setFiltroStatus('todas');
        setBuscaNumeroNota('');
        setFiltroPeriodo('todas');
        setDataInicio(null);
        setDataFim(null);
    };

    const buscarMotoristas = async () => {
        setEstaCarregando(true);
        try {
            
            const q = query(collection(db, 'usuarios'), where('cargo', '==', 'motorista'), where('ativo', '==', true));
            const querySnapshot = await getDocs(q);
            const lista: MotoristaInfo[] = [];
            for (const docMotorista of querySnapshot.docs) {
                const data = docMotorista.data();
                const viagensQuery = query(collection(db, 'viagens'), where('motoristaId', '==', docMotorista.id));
                const viagensSnap = await getDocs(viagensQuery);

                // Nota pendente = já tem foto anexada e aguarda aprovação do gerente
                let totalPendentes = 0;
                viagensSnap.forEach((v) => {
                    const notasDaViagem: NotaVinculada[] = v.data().notasVinculadas || [];
                    notasDaViagem.forEach((n) => {
                        if (n.status === 'Pendente' && n.imagemBase64) totalPendentes++;
                    });
                });

                lista.push({
                    uid: docMotorista.id,
                    nome: data.nome,
                    email: data.email,
                    totalViagens: viagensSnap.size,
                    totalPendentes: totalPendentes,
                });
            }
            setMotoristas(lista);
            
            if (lista.length === 0) {
                
            }
        } catch (error) {
            
        } finally {
            setEstaCarregando(false);
        }
    };

    const buscarViagensDoMotorista = async (motorista: MotoristaInfo) => {
        setEstaCarregando(true);
        try {
            const q = query(collection(db, 'viagens'), where('motoristaId', '==', motorista.uid));
            const resultado = await getDocs(q);
            const lista: Viagem[] = [];
            resultado.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() } as Viagem);
            });
            lista.sort((a, b) => {
                const dateA = a.criadoEm?.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm);
                const dateB = b.criadoEm?.toDate ? b.criadoEm.toDate() : new Date(b.criadoEm);
                return dateB.getTime() - dateA.getTime();
            });
            setViagens(lista);
            setMotoristaSelecionado(motorista);
            aplicarFiltros();
        } catch (erro) {
            
        } finally {
            setEstaCarregando(false);
        }
    };

    const buscarMinhasViagens = async () => {
        setEstaCarregando(true);
        try {
            if (!usuario?.uid) return;
            const q = query(collection(db, 'viagens'), where('motoristaId', '==', usuario.uid));
            const resultado = await getDocs(q);
            const lista: Viagem[] = [];
            resultado.forEach((doc) => {
                lista.push({ id: doc.id, ...doc.data() } as Viagem);
            });
            lista.sort((a, b) => {
                const dateA = a.criadoEm?.toDate ? a.criadoEm.toDate() : new Date(a.criadoEm);
                const dateB = b.criadoEm?.toDate ? b.criadoEm.toDate() : new Date(b.criadoEm);
                return dateB.getTime() - dateA.getTime();
            });
            setViagens(lista);
        } catch (erro) {
            
        } finally {
            setEstaCarregando(false);
        }
    };

    const atualizarStatusViagem = async (viagemId: string) => {
        try {
            const viagemRef = doc(db, 'viagens', viagemId);
            const viagemDoc = await getDoc(viagemRef);
            
            if (!viagemDoc.exists()) {
                return;
            }
            
            const viagemData = viagemDoc.data() as Viagem;
            const notas = viagemData.notasVinculadas;
            
            if (!notas || notas.length === 0) {
                await updateDoc(viagemRef, { status: 'Pendente' });
                return;
            }
            
            let todasAprovadas = true;
            let algumaRejeitada = false;
            
            for (const nota of notas) {
                if (nota.status !== 'Aprovado') {
                    todasAprovadas = false;
                }
                if (nota.status === 'Rejeitado') {
                    algumaRejeitada = true;
                }
            }
            
            let novoStatus: 'Pendente' | 'Aprovada' | 'Rejeitada';
            
            if (todasAprovadas) {
                novoStatus = 'Aprovada';
            } else if (algumaRejeitada) {
                novoStatus = 'Rejeitada';
            } else {
                novoStatus = 'Pendente';
            }
            
            if (novoStatus !== viagemData.status) {
                await updateDoc(viagemRef, { status: novoStatus });
            }
        } catch (error) {
        }
    };

    const calcularFretePorDestino = (textoDestino: string): number => {
        const destinos: Record<string, number> = {
            'SAO PAULO': 5000, 'SÃO PAULO': 5000, 'CAJAMAR': 5000,
            'RIO DE JANEIRO': 7000, 'NITEROI': 7000,
            'VITORIA': 3000, 'VITÓRIA': 3000,
            'CURITIBA': 4500, 'PORTO ALEGRE': 5500,
            'BELO HORIZONTE': 4000, 'BRASILIA': 6000,
            'SALVADOR': 6500, 'RECIFE': 7500, 'FORTALEZA': 8000,
        };
        const destinoMaiusculo = textoDestino.toUpperCase();
        for (const [cidade, valor] of Object.entries(destinos)) {
            if (destinoMaiusculo.includes(cidade)) return valor;
        }
        return 100;
    };

    useEffect(() => {
        if (destino.trim() && podeGerenciar) {
            setFreteCalculado(calcularFretePorDestino(destino));
        } else {
            setFreteCalculado(0);
        }
    }, [destino, podeGerenciar]);

    const adicionarNotaVinculada = () => {
        const novaNota: NotaVinculada = {
            id: Date.now().toString(),
            numeroNota: '',
            valorFrete: freteCalculado,
            status: 'Pendente',
        };
        setNotasVinculadas([...notasVinculadas, novaNota]);
    };

    const removerNotaVinculada = (index: number) => {
        const novasNotas = [...notasVinculadas];
        novasNotas.splice(index, 1);
        setNotasVinculadas(novasNotas);
    };

    const atualizarNumeroNota = (index: number, numero: string) => {
        const novasNotas = [...notasVinculadas];
        novasNotas[index].numeroNota = numero.toUpperCase();
        setNotasVinculadas(novasNotas);
    };

    const salvarViagem = async () => {
        if (!destino.trim()) {
            
            return;
        }
        if (!dataViagem) {
            
            return;
        }
        if (notasVinculadas.length === 0) {
            
            return;
        }
        
        for (let i = 0; i < notasVinculadas.length; i++) {
            if (!notasVinculadas[i].numeroNota.trim()) {
                
                return;
            }
        }

        setEstaSalvando(true);
        try {
            const viagemData = {
                destino: destino.trim(),
                motoristaId: motoristaSelecionado!.uid,
                motoristaNome: motoristaSelecionado!.nome,
                motoristaEmail: motoristaSelecionado!.email,
                dataViagem: dataViagem,
                notasVinculadas: notasVinculadas.map(nota => ({
                    ...nota,
                    valorFrete: freteCalculado,
                })),
                status: editandoViagem ? editandoViagem.status : 'Pendente',
                criadoEm: editandoViagem ? editandoViagem.criadoEm : new Date(),
                criadoPor: editandoViagem ? editandoViagem.criadoPor : usuario?.uid,
                criadoPorNome: editandoViagem ? editandoViagem.criadoPorNome : usuario?.nome,
            };

            if (editandoViagem) {
                await updateDoc(doc(db, 'viagens', editandoViagem.id), viagemData);
                
            } else {
                await addDoc(collection(db, 'viagens'), viagemData);
                
            }

            setModalViagemVisivel(false);
            setEditandoViagem(null);
            limparFormularioViagem();
            await buscarViagensDoMotorista(motoristaSelecionado!);
        } catch (erro) {
            
        } finally {
            setEstaSalvando(false);
        }
    };

    const limparFormularioViagem = () => {
        setDestino('');
        setDataViagem(new Date().toLocaleDateString('pt-BR'));
        setNotasVinculadas([]);
        setFreteCalculado(0);
    };

    const abrirEdicaoViagem = (viagem: Viagem) => {
        setEditandoViagem(viagem);
        setDestino(viagem.destino);
        setDataViagem(viagem.dataViagem);
        setNotasVinculadas(viagem.notasVinculadas.map(n => ({ ...n })));
        setModalViagemVisivel(true);
    };

    const voltarParaListaMotoristas = () => {
        setMotoristaSelecionado(null);
        buscarMotoristas();
        setViagens([]);
        setViagensFiltradas([]);
        setBuscaMotorista('');
        limparFiltros();
        setMostrarFiltros(false);
    };

    const abrirModalNota = (viagemId: string, notaIndex: number, nota: NotaVinculada) => {
        setNotaEditando({ viagemId, notaId: nota.id, notaIndex });
        setImagemNota(nota.imagemBase64 || undefined);
        setObservacaoNota(nota.observacao || '');
        setModalNotaVisivel(true);
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
                setImagemNota(`data:image/jpeg;base64,${imagemComprimida.base64}`);
            } else if (base64Original) {
                setImagemNota(`data:image/jpeg;base64,${base64Original}`);
            }
        } catch (erro) {
            if (base64Original) setImagemNota(`data:image/jpeg;base64,${base64Original}`);
        } finally {
            setComprimindoImagem(false);
        }
    };

    const tirarFotoNota = async () => {
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

    const salvarAnexoNota = async () => {
        if (!imagemNota) {
            
            return;
        }

        setEstaSalvando(true);
        try {
            const viagemRef = doc(db, 'viagens', notaEditando!.viagemId);
            const viagemDoc = await getDoc(viagemRef);
            const viagemData = viagemDoc.data() as Viagem;
            
            const novasNotas = [...viagemData.notasVinculadas];
            novasNotas[notaEditando!.notaIndex] = {
                ...novasNotas[notaEditando!.notaIndex],
                imagemBase64: imagemNota,
                observacao: observacaoNota,
                status: 'Pendente',
            };
            
            await updateDoc(viagemRef, { notasVinculadas: novasNotas });
            
            await atualizarStatusViagem(notaEditando!.viagemId);
            
            
            setModalNotaVisivel(false);
            setImagemNota(undefined);
            setObservacaoNota('');
            
            if (podeAnexar) {
                buscarMinhasViagens();
            } else if (motoristaSelecionado) {
                buscarViagensDoMotorista(motoristaSelecionado);
            }
        } catch (error) {
            
        } finally {
            setEstaSalvando(false);
        }
    };

    const aprovarNota = async (viagemId: string, notaIndex: number) => {
        try {
            const viagemRef = doc(db, 'viagens', viagemId);
            const viagemDoc = await getDoc(viagemRef);
            const viagemData = viagemDoc.data() as Viagem;
            
            const novasNotas = [...viagemData.notasVinculadas];
            novasNotas[notaIndex] = {
                ...novasNotas[notaIndex],
                status: 'Aprovado',
                aprovadoPor: usuario?.uid,
                aprovadoPorNome: usuario?.nome,
                aprovadoEm: new Date(),
            };
            
            await updateDoc(viagemRef, { notasVinculadas: novasNotas });
            
            await atualizarStatusViagem(viagemId);
            
            
            
            if (podeAnexar) {
                buscarMinhasViagens();
            } else if (motoristaSelecionado) {
                buscarViagensDoMotorista(motoristaSelecionado);
            }
        } catch (error) {
            
        }
    };

    const excluirNota = async (viagemId: string) => {
        try {
            await deleteDoc(doc(db, 'viagens', viagemId));

            if (podeAnexar) {
                buscarMinhasViagens();
            } else if (motoristaSelecionado) {
                buscarViagensDoMotorista(motoristaSelecionado);
            }
        } catch (error) {
        }
    };

    const rejeitarNota = async () => {
        if (!motivoRejeicao.trim()) {
            
            return;
        }
        if (!notaParaRejeitar) return;

        try {
            const viagemRef = doc(db, 'viagens', notaParaRejeitar.viagemId);
            const viagemDoc = await getDoc(viagemRef);
            const viagemData = viagemDoc.data() as Viagem;
            
            const novasNotas = [...viagemData.notasVinculadas];
            novasNotas[notaParaRejeitar.notaIndex] = {
                ...novasNotas[notaParaRejeitar.notaIndex],
                status: 'Rejeitado',
                motivoRejeicao: motivoRejeicao.trim(),
                aprovadoPor: usuario?.uid,
                aprovadoPorNome: usuario?.nome,
                aprovadoEm: new Date(),
            };
            
            await updateDoc(viagemRef, { notasVinculadas: novasNotas });
            
            await atualizarStatusViagem(notaParaRejeitar.viagemId);
            
            
            setJustificativaModalVisivel(false);
            setNotaParaRejeitar(null);
            setMotivoRejeicao('');
            
            if (podeAnexar) {
                buscarMinhasViagens();
            } else if (motoristaSelecionado) {
                buscarViagensDoMotorista(motoristaSelecionado);
            }
        } catch (error) {
            
        }
    };

    const formatarMoeda = (valor: number) => {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const obterCorStatusViagem = (status: string) => {
        switch (status) {
            case 'Aprovada': return cores.success;
            case 'Rejeitada': return cores.error;
            default: return cores.warning;
        }
    };

    const obterTextoStatusViagem = (status: string) => {
        switch (status) {
            case 'Aprovada': return 'Aprovada';
            case 'Rejeitada': return 'Rejeitada';
            default: return 'Pendente';
        }
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

    if (!podeGerenciar && !podeAnexar) {
        return (
            <View style={estilos.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                    <View style={estilos.linhaCabecalho}>
                        <BotaoVoltar />
                        <View style={estilos.centroCabecalho}>
                            <Ionicons name="receipt" size={28} color={cores.charcoal} />
                            <Text style={estilos.tituloCabecalho}>Notas Fiscais</Text>
                        </View>
                        <View style={{ width: 44 }} />
                    </View>
                </LinearGradient>
                <View style={estilos.containerAcessoNegado}>
                    <Ionicons name="lock-closed" size={64} color={cores.error} />
                    <Text style={estilos.tituloAcessoNegado}>Acesso Restrito</Text>
                    <Text style={estilos.textoAcessoNegado}>
                        Apenas gerentes e motoristas podem acessar esta tela.
                    </Text>
                </View>
            </View>
        );
    }

    if (podeAnexar) {
        return (
            <View style={estilos.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                    <View style={estilos.linhaCabecalho}>
                        <BotaoVoltar />
                        <View style={estilos.centroCabecalho}>
                            <Ionicons name="receipt" size={28} color={cores.charcoal} />
                            <Text style={estilos.tituloCabecalho}>Minhas Viagens</Text>
                        </View>
                        <View style={{ width: 44 }} />
                    </View>
                </LinearGradient>

                <ScrollView style={estilos.listaContainer}>
                    {viagens.length === 0 ? (
                        <View style={estilos.containerVazio}>
                            <Ionicons name="receipt-outline" size={64} color={cores.dustGrey} />
                            <Text style={estilos.tituloVazio}>Nenhuma viagem encontrada</Text>
                            <Text style={estilos.textoVazio}>Aguarde novas viagens serem atribuídas a você</Text>
                        </View>
                    ) : (
                        viagens.map((viagem) => (
                            <Card key={viagem.id} style={estilos.cartao}>
                                <Card.Content>
                                    <View style={estilos.cabecalhoCartao}>
                                        <Text style={estilos.tituloViagem}>{viagem.destino}</Text>
                                        <View style={estilos.botoesCabecalhoDireita}>
                                            {viagem.status === 'Rejeitada' && (
                                                <TouchableOpacity onPress={() => excluirNota(viagem.id)}>
                                                    <Ionicons name="trash" size={20} color={cores.error} />
                                                </TouchableOpacity>
                                            )}
                                            <View style={[estilos.badgeStatusViagem, { backgroundColor: obterCorStatusViagem(viagem.status) }]}>
                                                <Text style={estilos.textoStatusViagem}>{obterTextoStatusViagem(viagem.status)}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    
                                    <Divider style={estilos.divisor} />
                                    
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="calendar" size={16} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Data: {viagem.dataViagem}</Text>
                                    </View>
                                    
                                    <Text style={estilos.subtituloNotas}>Notas Fiscais da Viagem:</Text>
                                    
                                    {viagem.notasVinculadas.map((nota, idx) => (
                                        <View key={nota.id} style={estilos.cartaoNota}>
                                            <View style={estilos.cabecalhoNota}>
                                                <Text style={estilos.numeroNota}>Nota: {nota.numeroNota}</Text>
                                            </View>
                                            
                                            {nota.imagemBase64 ? (
                                                <TouchableOpacity onPress={() => {
                                                    if (Platform.OS === 'web') {
                                                        const win = window.open();
                                                        win?.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a1a;"><img src="${nota.imagemBase64}" style="max-width:100%;max-height:100vh"/><button onclick="window.close()" style="position:fixed;top:20px;right:20px;padding:10px 20px;background:#ff4444;color:white;border:none;border-radius:8px;cursor:pointer">Fechar</button></body></html>`);
                                                    }
                                                }}>
                                                    <Image source={{ uri: nota.imagemBase64 }} style={estilos.previsualizacaoNota} resizeMode="cover" />
                                                </TouchableOpacity>
                                            ) : (
                                                <View style={estilos.placeholderNota}>
                                                    <Ionicons name="image-outline" size={32} color={cores.silver} />
                                                    <Text style={estilos.textoPlaceholder}>Aguardando foto</Text>
                                                </View>
                                            )}
                                            
                                            {nota.status === 'Pendente' && !nota.imagemBase64 && (
                                                <TouchableOpacity style={estilos.botaoAnexar} onPress={() => abrirModalNota(viagem.id, idx, nota)}>
                                                    <Ionicons name="camera" size={20} color={cores.white} />
                                                    <Text style={estilos.textoBotaoAnexar}>ANEXAR FOTO DA NOTA</Text>
                                                </TouchableOpacity>
                                            )}
                                            {nota.status === 'Pendente' && nota.imagemBase64 && (
                                                <View style={estilos.statusPendenteInfo}>
                                                    <Ionicons name="time-outline" size={16} color={cores.warning} />
                                                    <Text style={estilos.statusPendenteTexto}>Aguardando aprovação</Text>
                                                </View>
                                            )}
                                            
                                            {nota.status === 'Rejeitado' && nota.motivoRejeicao && (
                                                <View style={estilos.containerMotivoRejeicao}>
                                                    <Ionicons name="alert-circle" size={16} color={cores.error} />
                                                    <Text style={estilos.textoMotivoRejeicao}>Motivo: {nota.motivoRejeicao}</Text>
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </Card.Content>
                            </Card>
                        ))
                    )}
                </ScrollView>

                <Modal visible={modalNotaVisivel} animationType="slide" transparent>
                    <View style={estilos.containerModal}>
                        <View style={estilos.conteudoModal}>
                            <View style={estilos.cabecalhoModal}>
                                <Text style={estilos.tituloModal}>Anexar Nota Fiscal</Text>
                                <TouchableOpacity onPress={() => setModalNotaVisivel(false)}>
                                    <Ionicons name="close" size={24} color={cores.grey} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView>
                                {(comprimindoImagem || imagemNota) && (
                                    <View style={estilos.botaoCameraModal}>
                                        {comprimindoImagem ? (
                                            <View style={estilos.placeholderCamera}>
                                                <ActivityIndicator size="large" color={cores.primary} />
                                                <Text style={estilos.textoCamera}>Processando...</Text>
                                            </View>
                                        ) : (
                                            <Image source={{ uri: imagemNota }} style={estilos.previsualizacaoModal} />
                                        )}
                                    </View>
                                )}
                                <View style={estilos.linhaBotoesFoto}>
                                    <TouchableOpacity style={estilos.botaoFotoOpcao} onPress={tirarFotoNota} disabled={comprimindoImagem}>
                                        <Ionicons name="camera" size={22} color={cores.primary} />
                                        <Text style={estilos.botaoFotoOpcaoTexto}>Tirar foto</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={estilos.botaoFotoOpcao} onPress={escolherDaGaleria} disabled={comprimindoImagem}>
                                        <Ionicons name="images" size={22} color={cores.primary} />
                                        <Text style={estilos.botaoFotoOpcaoTexto}>Galeria</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={estilos.rotuloModal}>Informações Adicionais (opcional)</Text>
                                <TextInput
                                    mode="outlined"
                                    value={observacaoNota}
                                    onChangeText={setObservacaoNota}
                                    placeholder="Ex: Nota danificada, observações sobre a entrega..."
                                    multiline
                                    numberOfLines={4}
                                    style={estilos.inputModal}
                                    outlineColor={cores.dustGrey}
                                    activeOutlineColor={cores.primary}
                                />

                                <View style={estilos.botoesModal}>
                                    <Button mode="outlined" onPress={() => setModalNotaVisivel(false)} style={estilos.botaoCancelarModal} labelStyle={estilos.rotuloCancelarModal}>Cancelar</Button>
                                    <Button mode="contained" onPress={salvarAnexoNota} loading={estaSalvando} disabled={estaSalvando || comprimindoImagem} style={estilos.botaoSalvarModal} labelStyle={estilos.rotuloSalvarModal}>Salvar</Button>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    if (podeGerenciar && !motoristaSelecionado) {
        const totalPendentes = motoristas.reduce((soma, m) => soma + (m.totalPendentes ?? 0), 0);
        const totalViagens = motoristas.reduce((soma, m) => soma + (m.totalViagens ?? 0), 0);
        return (
            <View style={estilos.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                    <View style={estilos.linhaCabecalho}>
                        <BotaoVoltar />
                        <View style={estilos.centroCabecalho}>
                            <Ionicons name="receipt" size={28} color={cores.charcoal} />
                            <Text style={estilos.tituloCabecalho}>Gestão de Notas Fiscais</Text>
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
                        <Text style={estilos.rotuloEstatistica}>Notas pendentes</Text>
                    </View>
                    <View style={estilos.cartaoEstatistica}>
                        <Text style={estilos.numeroEstatistica}>{totalViagens}</Text>
                        <Text style={estilos.rotuloEstatistica}>Viagens</Text>
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
                                onPress={() => buscarViagensDoMotorista(motorista)}
                            >
                                <Avatar.Text size={50} label={motorista.nome.substring(0, 2).toUpperCase()} style={estilos.avatar} />
                                <View style={estilos.infoMotorista}>
                                    <Text style={estilos.nomeMotorista}>{motorista.nome}</Text>
                                    <Text style={estilos.emailMotorista}>{motorista.email}</Text>
                                    <View style={estilos.motoristaStats}>
                                        <View style={estilos.pilulaEstatistica}>
                                            <Ionicons name="map-outline" size={13} color={cores.grey} />
                                            <Text style={estilos.textoPilulaEstatistica}>
                                                {motorista.totalViagens ?? 0} {(motorista.totalViagens ?? 0) === 1 ? 'viagem' : 'viagens'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <View style={estilos.pendentesBadge}>
                                    <Text style={estilos.pendentesNumero}>{motorista.totalPendentes ?? 0}</Text>
                                    <Text style={estilos.pendentesLabel}>pendentes</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={24} color={cores.silver} />
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            </View>
        );
    }

    if (podeGerenciar && motoristaSelecionado) {
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
                        <View style={estilos.botoesCabecalhoDireita}>
                            <TouchableOpacity 
                                style={estilos.botaoFiltroCabecalho} 
                                onPress={() => setMostrarFiltros(!mostrarFiltros)}
                            >
                                <Ionicons name="options-outline" size={20} color={cores.charcoal} />
                                <Text style={estilos.textoFiltroCabecalho}>Filtro</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={estilos.botaoAdicionarCabecalho} 
                                onPress={() => { 
                                    limparFormularioViagem(); 
                                    setEditandoViagem(null);
                                    setModalViagemVisivel(true); 
                                }}
                            >
                                <Ionicons name="add" size={24} color={cores.white} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </LinearGradient>

                {mostrarFiltros && (
                    <View style={estilos.painelFiltros}>
                        <Text style={estilos.tituloFiltros}>Filtrar viagens</Text>

                        <View style={estilos.campoFiltro}>
                            <Ionicons name="receipt" size={20} color={cores.grey} />
                            <TextInput
                                mode="flat"
                                placeholder="Número da nota"
                                value={buscaNumeroNota}
                                onChangeText={setBuscaNumeroNota}
                                style={estilos.inputFiltro}
                                underlineColor="transparent"
                            />
                            {buscaNumeroNota !== '' && (
                                <TouchableOpacity onPress={() => setBuscaNumeroNota('')}>
                                    <Ionicons name="close" size={18} color={cores.silver} />
                                </TouchableOpacity>
                            )}
                        </View>
                        
                        <Text style={estilos.rotuloFiltro}>Status</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={estilos.scrollFiltroStatus}>
                            <TouchableOpacity style={[estilos.botaoFiltroStatus, filtroStatus === 'todas' && estilos.botaoFiltroStatusAtivo]} onPress={() => setFiltroStatus('todas')}>
                                <Text style={[estilos.textoFiltroStatus, filtroStatus === 'todas' && estilos.textoFiltroStatusAtivo]}>Todas</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[estilos.botaoFiltroStatus, filtroStatus === 'Pendente' && estilos.botaoFiltroStatusAtivo]} onPress={() => setFiltroStatus('Pendente')}>
                                <Text style={[estilos.textoFiltroStatus, filtroStatus === 'Pendente' && estilos.textoFiltroStatusAtivo]}>Pendente</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[estilos.botaoFiltroStatus, filtroStatus === 'Aprovada' && estilos.botaoFiltroStatusAtivo]} onPress={() => setFiltroStatus('Aprovada')}>
                                <Text style={[estilos.textoFiltroStatus, filtroStatus === 'Aprovada' && estilos.textoFiltroStatusAtivo]}>Aprovada</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[estilos.botaoFiltroStatus, filtroStatus === 'Rejeitada' && estilos.botaoFiltroStatusAtivo]} onPress={() => setFiltroStatus('Rejeitada')}>
                                <Text style={[estilos.textoFiltroStatus, filtroStatus === 'Rejeitada' && estilos.textoFiltroStatusAtivo]}>Rejeitada</Text>
                            </TouchableOpacity>
                        </ScrollView>

                        <TouchableOpacity style={estilos.botaoLimparFiltros} onPress={limparFiltros}>
                            <Ionicons name="refresh" size={18} color={cores.white} />
                            <Text style={estilos.textoLimparFiltros}>Limpar filtros</Text>
                        </TouchableOpacity>
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

                <ScrollView style={estilos.listaContainer}>
                    {viagensFiltradas.length === 0 ? (
                        <View style={estilos.containerVazio}>
                            <Ionicons name="receipt-outline" size={64} color={cores.dustGrey} />
                            <Text style={estilos.tituloVazio}>Nenhuma viagem encontrada</Text>
                            <Text style={estilos.textoVazio}>
                                {filtroStatus !== 'todas' || buscaNumeroNota !== '' || filtroPeriodo !== 'todas' 
                                    ? 'Tente outros filtros' 
                                    : 'Clique no botão "+" para cadastrar uma viagem'}
                            </Text>
                        </View>
                    ) : (
                        viagensFiltradas.map((viagem) => (
                            <Card key={viagem.id} style={estilos.cartao}>
                                <Card.Content>
                                    <View style={estilos.cabecalhoCartao}>
                                        <Text style={estilos.tituloViagem}>{viagem.destino}</Text>
                                        <View style={estilos.botoesCabecalhoDireita}>
                                            {!viagem.notasVinculadas.some(n => n.status === 'Aprovado') && (
                                                <TouchableOpacity onPress={() => abrirEdicaoViagem(viagem)}>
                                                    <Ionicons name="pencil" size={20} color={cores.primary} />
                                                </TouchableOpacity>
                                            )}
                                            <View style={[estilos.badgeStatusViagem, { backgroundColor: obterCorStatusViagem(viagem.status) }]}>
                                                <Text style={estilos.textoStatusViagem}>{obterTextoStatusViagem(viagem.status)}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    
                                    <Divider style={estilos.divisor} />
                                    
                                    <View style={estilos.linhaCard}>
                                        <Ionicons name="calendar" size={16} color={cores.grey} />
                                        <Text style={estilos.infoCartao}>Data: {viagem.dataViagem}</Text>
                                    </View>
                                    
                                    <Text style={estilos.subtituloNotas}>Notas Fiscais da Viagem:</Text>
                                    
                                    {viagem.notasVinculadas.map((nota, idx) => (
                                        <View key={nota.id} style={estilos.cartaoNota}>
                                            <View style={estilos.cabecalhoNota}>
                                                <Text style={estilos.numeroNota}>Nota: {nota.numeroNota}</Text>
                                            </View>
                                            <View style={estilos.linhaValorNota}>
                                                <Ionicons name="cash-outline" size={16} color={cores.success} />
                                                <Text style={estilos.valorNota}>{formatarMoeda(nota.valorFrete)}</Text>
                                            </View>
                                            
                                            {nota.imagemBase64 ? (
                                                <TouchableOpacity onPress={() => {
                                                    if (Platform.OS === 'web') {
                                                        const win = window.open();
                                                        win?.document.write(`<html><body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1a1a1a;"><img src="${nota.imagemBase64}" style="max-width:100%;max-height:100vh"/><button onclick="window.close()" style="position:fixed;top:20px;right:20px;padding:10px 20px;background:#ff4444;color:white;border:none;border-radius:8px;cursor:pointer">Fechar</button></body></html>`);
                                                    }
                                                }}>
                                                    <Image source={{ uri: nota.imagemBase64 }} style={estilos.previsualizacaoNota} resizeMode="cover" />
                                                </TouchableOpacity>
                                            ) : (
                                                <View style={estilos.placeholderNota}>
                                                    <Ionicons name="image-outline" size={32} color={cores.silver} />
                                                    <Text style={estilos.textoPlaceholder}>Aguardando foto</Text>
                                                </View>
                                            )}
                                            
                                            {nota.status === 'Pendente' && nota.imagemBase64 && (
                                                <View style={estilos.botoesAprovacao}>
                                                    <TouchableOpacity style={[estilos.botaoAprovar, { backgroundColor: cores.success }]} onPress={() => aprovarNota(viagem.id, idx)}>
                                                        <Ionicons name="checkmark" size={20} color={cores.white} />
                                                        <Text style={estilos.textoBotaoAprovar}>Aprovar</Text>
                                                    </TouchableOpacity>
                                                    <TouchableOpacity style={[estilos.botaoAprovar, { backgroundColor: cores.error }]} onPress={() => {
                                                        setNotaParaRejeitar({ viagemId: viagem.id, notaIndex: idx });
                                                        setMotivoRejeicao('');
                                                        setJustificativaModalVisivel(true);
                                                    }}>
                                                        <Ionicons name="close" size={20} color={cores.white} />
                                                        <Text style={estilos.textoBotaoAprovar}>Rejeitar</Text>
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                            
                                            {nota.status === 'Rejeitado' && nota.motivoRejeicao && (
                                                <View style={estilos.containerMotivoRejeicao}>
                                                    <Ionicons name="alert-circle" size={16} color={cores.error} />
                                                    <Text style={estilos.textoMotivoRejeicao}>Motivo: {nota.motivoRejeicao}</Text>
                                                </View>
                                            )}
                                            
                                            {nota.observacao && (
                                                <View style={estilos.linhaObservacao}>
                                                    <Ionicons name="document-text-outline" size={13} color={cores.grey} />
                                                    <Text style={estilos.textoObservacao}>{nota.observacao}</Text>
                                                </View>
                                            )}
                                        </View>
                                    ))}
                                </Card.Content>
                            </Card>
                        ))
                    )}
                </ScrollView>

                <Modal visible={modalViagemVisivel} animationType="slide" transparent>
                    <View style={estilos.containerModal}>
                        <View style={estilos.conteudoModal}>
                            <View style={estilos.cabecalhoModal}>
                                <Text style={estilos.tituloModal}>{editandoViagem ? 'Editar Viagem' : 'Nova Viagem'}</Text>
                                <TouchableOpacity onPress={() => setModalViagemVisivel(false)}>
                                    <Ionicons name="close" size={24} color={cores.grey} />
                                </TouchableOpacity>
                            </View>
                            <ScrollView>
                                <Text style={estilos.rotuloModal}>Destino </Text>
                                <TextInput
                                    mode="outlined"
                                    value={destino}
                                    onChangeText={setDestino}
                                    placeholder="Ex: São Paulo, Curitiba, Rio de Janeiro"
                                    style={estilos.inputModal}
                                    outlineColor={cores.dustGrey}
                                    activeOutlineColor={cores.primary}
                                />
                                {freteCalculado > 0 && (
                                    <View style={estilos.containerFreteCalculado}>
                                        <Text style={estilos.textoFreteCalculado}>
                                            Frete calculado: {formatarMoeda(freteCalculado)}
                                        </Text>
                                    </View>
                                )}

                                <Text style={estilos.rotuloModal}>Data da Viagem *</Text>
                                <TextInput
                                    mode="outlined"
                                    value={dataViagem}
                                    onChangeText={setDataViagem}
                                    placeholder="DD/MM/AAAA"
                                    style={estilos.inputModal}
                                    outlineColor={cores.dustGrey}
                                    activeOutlineColor={cores.primary}
                                    keyboardType="numeric"
                                />

                                <Text style={estilos.rotuloModal}>Notas Fiscais *</Text>
                                {notasVinculadas.map((nota, idx) => (
                                    <View key={nota.id} style={estilos.itemNota}>
                                        <TextInput
                                            mode="outlined"
                                            label={`Número da Nota ${idx + 1}`}
                                            value={nota.numeroNota}
                                            onChangeText={(text) => atualizarNumeroNota(idx, text)}
                                            style={estilos.inputNota}
                                            outlineColor={cores.dustGrey}
                                            activeOutlineColor={cores.primary}
                                        />
                                        <TouchableOpacity onPress={() => removerNotaVinculada(idx)} style={estilos.botaoRemoverNota}>
                                            <Ionicons name="trash" size={20} color={cores.error} />
                                        </TouchableOpacity>
                                    </View>
                                ))}
                                
                                <TouchableOpacity style={estilos.botaoAdicionarNota} onPress={adicionarNotaVinculada}>
                                    <Ionicons name="add" size={20} color={cores.white} />
                                    <Text style={estilos.textoAdicionarNota}>Adicionar Nota</Text>
                                </TouchableOpacity>

                                <View style={estilos.botoesModal}>
                                    <Button mode="outlined" onPress={() => setModalViagemVisivel(false)} style={estilos.botaoCancelarModal} labelStyle={estilos.rotuloCancelarModal}>Cancelar</Button>
                                    <Button mode="contained" onPress={salvarViagem} loading={estaSalvando} disabled={estaSalvando} style={estilos.botaoSalvarModal} labelStyle={estilos.rotuloSalvarModal}>Salvar</Button>
                                </View>
                            </ScrollView>
                        </View>
                    </View>
                </Modal>

                <Modal visible={justificativaModalVisivel} transparent animationType="fade">
                    <View style={estilos.overlayModal}>
                        <View style={estilos.conteudoModalRejeicao}>
                            <View style={estilos.cabecalhoModalRejeicao}>
                                <Ionicons name="close-circle" size={40} color={cores.error} />
                                <Text style={estilos.tituloModalRejeicao}>Rejeitar Nota Fiscal</Text>
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
                                <TouchableOpacity style={estilos.botaoCancelarRejeicao} onPress={() => { setJustificativaModalVisivel(false); setNotaParaRejeitar(null); setMotivoRejeicao(''); }}>
                                    <Text style={estilos.textoCancelarRejeicao}>Cancelar</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={estilos.botaoConfirmarRejeicao} onPress={rejeitarNota}>
                                    <Ionicons name="close" size={20} color={cores.white} />
                                    <Text style={estilos.textoConfirmarRejeicao}>Rejeitar</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        );
    }

    return null;
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
    botaoAdicionarCabecalho: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.primary, alignItems: 'center', justifyContent: 'center', elevation: 2 },
    botaoVoltarCabecalho: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.white, alignItems: 'center', justifyContent: 'center', elevation: 2 },
    botaoFiltroCabecalho: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.white, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, gap: 4 },
    textoFiltroCabecalho: { fontSize: 16, color: cores.charcoal, fontWeight: '500' },
    botoesCabecalhoDireita: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    
    containerBusca: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.white, marginHorizontal: 16, marginTop: 16, marginBottom: 16, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: cores.dustGrey },
    inputBusca: { flex: 1, paddingVertical: 12, marginLeft: 8, fontSize: 22, color: cores.charcoal },
    
    listaContainer: { flex: 1, paddingHorizontal: 16 },
    containerVazio: { alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
    tituloVazio: { fontSize: 24, fontWeight: '600', color: cores.charcoal, marginTop: 16 },
    textoVazio: { fontSize: 19, color: cores.grey, marginTop: 8, textAlign: 'center' },
    
    cartaoMotorista: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.white, borderRadius: 20, padding: 16, marginBottom: 12, elevation: 3 },
    avatar: { backgroundColor: cores.primary },
    infoMotorista: { flex: 1, marginLeft: 16 },
    nomeMotorista: { fontSize: 22, fontWeight: '600', color: cores.charcoal },
    emailMotorista: { fontSize: 16, color: cores.grey, marginTop: 2 },
    containerEstatisticas: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 16, gap: 8 },
    cartaoEstatistica: { flex: 1, backgroundColor: cores.white, borderRadius: 16, padding: 12, alignItems: 'center', elevation: 2 },
    numeroEstatistica: { fontSize: 24, fontWeight: 'bold', color: cores.charcoal },
    rotuloEstatistica: { fontSize: 14, color: cores.grey, marginTop: 4 },
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
    
    painelFiltros: { backgroundColor: cores.white, margin: 16, padding: 16, borderRadius: 20, elevation: 2 },
    tituloFiltros: { fontSize: 22, fontWeight: 'bold', color: cores.charcoal, marginBottom: 16, textAlign: 'center' },
    campoFiltro: { flexDirection: 'row', alignItems: 'center', backgroundColor: cores.platinum, borderRadius: 12, paddingHorizontal: 12, marginBottom: 12, borderWidth: 1, borderColor: cores.dustGrey },
    inputFiltro: { flex: 1, paddingVertical: 0, height: 48, fontSize: 19, color: cores.charcoal, backgroundColor: 'transparent' },
    rotuloFiltro: { fontSize: 19, fontWeight: '500', color: cores.charcoal, marginBottom: 8, marginTop: 8 },
    scrollFiltroStatus: { flexDirection: 'row', marginBottom: 8 },
    botaoFiltroStatus: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: cores.platinum, marginRight: 8, borderWidth: 1, borderColor: cores.dustGrey },
    botaoFiltroStatusAtivo: { backgroundColor: cores.primary, borderColor: cores.primary },
    textoFiltroStatus: { fontSize: 18, color: cores.grey },
    textoFiltroStatusAtivo: { color: cores.white, fontWeight: '600' },
    botaoLimparFiltros: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: cores.error, paddingVertical: 12, borderRadius: 12, gap: 8, marginTop: 16 },
    textoLimparFiltros: { color: cores.white, fontSize: 19, fontWeight: '600' },
    
    cartao: { marginBottom: 16, borderRadius: 20, backgroundColor: cores.white, elevation: 3, overflow: 'hidden' },
    cabecalhoCartao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 },
    tituloViagem: { fontSize: 24, fontWeight: 'bold', color: cores.charcoal },
    badgeStatusViagem: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    textoStatusViagem: { color: cores.white, fontSize: 15, fontWeight: 'bold' },
    divisor: { marginVertical: 12, backgroundColor: cores.dustGrey },
    linhaCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
    infoCartao: { fontSize: 19, color: cores.grey, flex: 1 },
    subtituloNotas: { fontSize: 19, fontWeight: '600', color: cores.charcoal, marginTop: 12, marginBottom: 8 },
    linhaObservacao: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 8 },
    textoObservacao: { flex: 1, fontSize: 16, color: cores.grey, fontStyle: 'italic' },
    
    cartaoNota: { backgroundColor: cores.platinum, borderRadius: 12, padding: 12, marginBottom: 8 },
    cabecalhoNota: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 },
    numeroNota: { fontSize: 19, fontWeight: '600', color: cores.charcoal },
    badgeStatus: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
    textoStatus: { color: cores.white, fontSize: 14, fontWeight: 'bold' },
    linhaValorNota: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    valorNota: { fontSize: 22, fontWeight: 'bold', color: cores.success },
    previsualizacaoNota: { width: '100%', height: 150, borderRadius: 12, marginBottom: 8 },
    placeholderNota: { width: '100%', height: 150, borderRadius: 12, backgroundColor: cores.white, alignItems: 'center', justifyContent: 'center', marginBottom: 8, borderWidth: 1, borderColor: cores.dustGrey, borderStyle: 'dashed' },
    textoPlaceholder: { marginTop: 8, color: cores.silver },
    statusPendenteInfo: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', padding: 10, borderRadius: 12, marginTop: 12, gap: 8 },
    statusPendenteTexto: { fontSize: 16, color: cores.warning, fontWeight: '500', flex: 1 },
    
    botaoAnexar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: cores.primary, paddingVertical: 10, borderRadius: 12, gap: 8 },
    textoBotaoAnexar: { color: cores.white, fontSize: 19, fontWeight: '600' },
    botoesAprovacao: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 },
    botaoAprovar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, gap: 6 },
    textoBotaoAprovar: { color: cores.white, fontSize: 16, fontWeight: '600' },
    
    containerMotivoRejeicao: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFEBEE', padding: 8, borderRadius: 8, marginTop: 8, gap: 8 },
    textoMotivoRejeicao: { fontSize: 16, color: cores.error, flex: 1 },
    
    containerModal: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
    conteudoModal: { backgroundColor: cores.white, margin: 20, borderRadius: 24, padding: 20, maxHeight: '90%' },
    cabecalhoModal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    tituloModal: { fontSize: 30, fontWeight: 'bold', color: cores.charcoal },
    
    rotuloModal: { fontSize: 19, fontWeight: '500', color: cores.charcoal, marginBottom: 8, marginTop: 12 },
    inputModal: { marginBottom: 16, backgroundColor: cores.white },
    containerFreteCalculado: { backgroundColor: '#E8F5E9', padding: 12, borderRadius: 12, marginBottom: 16 },
    textoFreteCalculado: { fontSize: 19, color: cores.success, fontWeight: '600', textAlign: 'center' },
    
    itemNota: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    inputNota: { flex: 1, backgroundColor: cores.white },
    botaoRemoverNota: { padding: 8, backgroundColor: '#FFEBEE', borderRadius: 8 },
    botaoAdicionarNota: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: cores.primary, paddingVertical: 10, borderRadius: 12, gap: 8, marginBottom: 16 },
    textoAdicionarNota: { color: cores.white, fontSize: 19, fontWeight: '600' },
    
    botaoCameraModal: { backgroundColor: cores.platinum, borderRadius: 16, marginBottom: 12, overflow: 'hidden' },
    linhaBotoesFoto: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    botaoFotoOpcao: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: cores.platinum, borderWidth: 1, borderColor: cores.dustGrey, borderStyle: 'dashed', borderRadius: 16, paddingVertical: 16 },
    botaoFotoOpcaoTexto: { color: cores.primary, fontWeight: '600', fontSize: 18 },
    placeholderCamera: { height: 160, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: cores.dustGrey, borderStyle: 'dashed', borderRadius: 16, margin: 1, gap: 8 },
    textoCamera: { marginTop: 12, color: cores.grey },
    previsualizacaoModal: { width: '100%', height: 160, borderRadius: 16 },
    
    botoesModal: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 16, gap: 12, marginBottom: 20 },
    botaoCancelarModal: { flex: 1, borderColor: cores.error, borderRadius: 12, backgroundColor: 'transparent' },
    rotuloCancelarModal: { color: cores.error, fontSize: 19, fontWeight: '600' },
    botaoSalvarModal: { flex: 1, backgroundColor: cores.primary, borderRadius: 12 },
    rotuloSalvarModal: { fontSize: 19, fontWeight: '600', color: cores.white },
    
    overlayModal: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
    conteudoModalRejeicao: { backgroundColor: cores.white, borderRadius: 28, padding: 24, width: '90%', maxWidth: 400 },
    cabecalhoModalRejeicao: { alignItems: 'center', marginBottom: 20 },
    tituloModalRejeicao: { fontSize: 30, fontWeight: 'bold', color: cores.error, marginTop: 12 },
    inputModalRejeicao: { marginBottom: 24, backgroundColor: cores.white, minHeight: 100 },
    botoesModalRejeicao: { flexDirection: 'row', gap: 12 },
    botaoCancelarRejeicao: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: cores.error, alignItems: 'center', backgroundColor: 'transparent' },
    textoCancelarRejeicao: { color: cores.error, fontWeight: '600', fontSize: 19 },
    botaoConfirmarRejeicao: { flex: 1, flexDirection: 'row', paddingVertical: 12, borderRadius: 12, backgroundColor: cores.error, alignItems: 'center', justifyContent: 'center', gap: 8 },
    textoConfirmarRejeicao: { color: cores.white, fontWeight: '600', fontSize: 19 },
    
    containerAcessoNegado: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
    tituloAcessoNegado: { fontSize: 27, fontWeight: 'bold', color: cores.error, marginTop: 16 },
    textoAcessoNegado: { fontSize: 19, color: cores.grey, textAlign: 'center', marginTop: 8 },
});