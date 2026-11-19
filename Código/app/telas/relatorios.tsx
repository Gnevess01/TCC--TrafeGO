import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { collection, getDocs, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
    TextInput as RNTextInput,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import {
    ActivityIndicator,
    Avatar,
    Card,
    Divider,
    Text,
} from 'react-native-paper';
import { BotaoVoltar } from '../components/BotaoVoltar';
import { FiltroData, PeriodoType } from '../components/FiltroData';
import { auth, db } from '../servicos/firebaseConfig';
import { cores } from '../theme';

interface Despesa {
    id: string;
    tipo: string;
    valor: number;
    data: string;
    placa: string;
    motoristaNome: string;
    motoristaId?: string;
    descricao: string;
    status: string;
}

interface NotaFiscal {
    id: string;
    valorFrete: number;
    dataViagem: string;
    destino: string;
    motoristaNome: string;
    motoristaId?: string;
    status: string;
}

interface MotoristaRelatorio {
    id: string;
    nome: string;
    email: string;
    totalDespesas: number;
    totalFretes: number;
    quantidadeDespesas: number;
    quantidadeNotas: number;
}

export default function TelaRelatorios() {
    const [usuario, setUsuario] = useState<any>(null);
    const [estaCarregando, setEstaCarregando] = useState(true);
    const [despesas, setDespesas] = useState<Despesa[]>([]);
    const [notas, setNotas] = useState<NotaFiscal[]>([]);
    const [motoristasAtivos, setMotoristasAtivos] = useState<{ id: string; nome: string; email: string }[]>([]);
    const [motoristaSelecionado, setMotoristaSelecionado] = useState<MotoristaRelatorio | null>(null);
    const [despesasMotorista, setDespesasMotorista] = useState<Despesa[]>([]);
    const [notasMotorista, setNotasMotorista] = useState<NotaFiscal[]>([]);
    const [buscaMotorista, setBuscaMotorista] = useState('');
    const [tipoRelatorio, setTipoRelatorio] = useState<'geral' | 'despesas' | 'fretes'>('geral');

    
    const [filtroPeriodo, setFiltroPeriodo] = useState<PeriodoType>('esteMes');
    const [dataInicio, setDataInicio] = useState<Date | null>(null);
    const [dataFim, setDataFim] = useState<Date | null>(null);

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
            });
        };
        buscarUsuario();
    }, []);

    useEffect(() => {
        if (usuario && (usuario.cargo === 'gerente' || usuario.cargo === 'superadmin')) {
            buscarDados();
        }
    }, [usuario]);

    const buscarDados = async () => {
        setEstaCarregando(true);
        try {
            const despesasQuery = query(collection(db, 'despesas'), where('status', '==', 'Aprovado'));
            const despesasSnap = await getDocs(despesasQuery);
            const despesasLista: Despesa[] = [];
            despesasSnap.forEach((doc) => {
                const data = doc.data();
                despesasLista.push({ 
                    id: doc.id, 
                    tipo: data.tipo,
                    valor: data.valor,
                    data: data.data,
                    placa: data.placa,
                    motoristaNome: data.motoristaNome,
                    motoristaId: data.motoristaId,
                    descricao: data.descricao,
                    status: data.status
                });
            });
            setDespesas(despesasLista);

            const notasQuery = query(collection(db, 'viagens'));
            const notasSnap = await getDocs(notasQuery);
            const notasLista: NotaFiscal[] = [];
            notasSnap.forEach((doc) => {
                const data = doc.data();
                if (data.notasVinculadas && data.notasVinculadas.length > 0) {
                    data.notasVinculadas.forEach((nota: any) => {
                        if (nota.status !== 'Aprovado') return;
                        notasLista.push({
                            id: doc.id,
                            valorFrete: nota.valorFrete || 0,
                            dataViagem: data.dataViagem,
                            destino: data.destino,
                            motoristaNome: data.motoristaNome,
                            motoristaId: data.motoristaId,
                            status: nota.status,
                        });
                    });
                }
            });
            setNotas(notasLista);

            const usuariosQuery = query(collection(db, 'usuarios'), where('cargo', '==', 'motorista'), where('ativo', '==', true));
            const usuariosSnap = await getDocs(usuariosQuery);
            const motoristasLista: { id: string; nome: string; email: string }[] = [];
            usuariosSnap.forEach((doc) => {
                const data = doc.data();
                motoristasLista.push({ id: doc.id, nome: data.nome, email: data.email });
            });
            setMotoristasAtivos(motoristasLista);

        } catch (error) {
        } finally {
            setEstaCarregando(false);
        }
    };

    
    const obterIntervaloPeriodo = (): { inicio: Date; fim: Date } | null => {
        if (filtroPeriodo === 'todas') return null;
        const hoje = new Date();
        hoje.setHours(0, 0, 0, 0);
        const fimHoje = new Date();
        fimHoje.setHours(23, 59, 59, 999);

        switch (filtroPeriodo) {
            case 'hoje':
                return { inicio: hoje, fim: fimHoje };
            case 'estaSemana': {
                const inicioSemana = new Date(hoje);
                const diaSemana = hoje.getDay();
                const diff = diaSemana === 0 ? 6 : diaSemana - 1;
                inicioSemana.setDate(hoje.getDate() - diff);
                inicioSemana.setHours(0, 0, 0, 0);
                const fimSemana = new Date(inicioSemana);
                fimSemana.setDate(inicioSemana.getDate() + 6);
                fimSemana.setHours(23, 59, 59, 999);
                return { inicio: inicioSemana, fim: fimSemana };
            }
            case 'esteMes': {
                const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
                const fimMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0);
                fimMes.setHours(23, 59, 59, 999);
                return { inicio: inicioMes, fim: fimMes };
            }
            case 'mesPassado': {
                const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
                const fimMes = new Date(hoje.getFullYear(), hoje.getMonth(), 0);
                fimMes.setHours(23, 59, 59, 999);
                return { inicio: inicioMes, fim: fimMes };
            }
            case 'ultimos3Meses': {
                const inicioIntervalo = new Date(hoje);
                inicioIntervalo.setMonth(hoje.getMonth() - 3);
                inicioIntervalo.setHours(0, 0, 0, 0);
                return { inicio: inicioIntervalo, fim: fimHoje };
            }
            case 'anoAtual': {
                const inicioAno = new Date(hoje.getFullYear(), 0, 1);
                const fimAno = new Date(hoje.getFullYear(), 11, 31);
                fimAno.setHours(23, 59, 59, 999);
                return { inicio: inicioAno, fim: fimAno };
            }
            case 'personalizado': {
                if (!dataInicio || !dataFim) return null;
                const inicioPersonalizado = new Date(dataInicio);
                inicioPersonalizado.setHours(0, 0, 0, 0);
                const fimPersonalizado = new Date(dataFim);
                fimPersonalizado.setHours(23, 59, 59, 999);
                return { inicio: inicioPersonalizado, fim: fimPersonalizado };
            }
            default:
                return null;
        }
    };

    
    const converterDataBr = (dataStr: string): Date | null => {
        if (!dataStr) return null;
        const partes = dataStr.split('/');
        if (partes.length !== 3) return null;
        const dia = parseInt(partes[0]);
        const mes = parseInt(partes[1]) - 1;
        const ano = parseInt(partes[2]);
        const dataItem = new Date(ano, mes, dia);
        dataItem.setHours(12, 0, 0, 0);
        return dataItem;
    };

    const filtrarDespesasPorPeriodo = (itens: Despesa[]): Despesa[] => {
        const intervalo = obterIntervaloPeriodo();
        if (!intervalo) return itens;
        return itens.filter(item => {
            const dataItem = converterDataBr(item.data);
            if (!dataItem) return false;
            return dataItem >= intervalo.inicio && dataItem <= intervalo.fim;
        });
    };

    const filtrarNotasPorPeriodo = (itens: NotaFiscal[]): NotaFiscal[] => {
        const intervalo = obterIntervaloPeriodo();
        if (!intervalo) return itens;
        return itens.filter(item => {
            const dataItem = converterDataBr(item.dataViagem);
            if (!dataItem) return false;
            return dataItem >= intervalo.inicio && dataItem <= intervalo.fim;
        });
    };

    const despesasFiltradas = React.useMemo(
        () => filtrarDespesasPorPeriodo(despesas),
        [despesas, filtroPeriodo, dataInicio, dataFim]
    );

    const notasFiltradas = React.useMemo(
        () => filtrarNotasPorPeriodo(notas),
        [notas, filtroPeriodo, dataInicio, dataFim]
    );

    // Agrega despesas e fretes filtrados por motorista
    const resumoMotoristas = React.useMemo(() => {
        const resumoMap = new Map<string, MotoristaRelatorio>();

        motoristasAtivos.forEach((motorista) => {
            resumoMap.set(motorista.id, {
                id: motorista.id,
                nome: motorista.nome,
                email: motorista.email,
                totalDespesas: 0,
                totalFretes: 0,
                quantidadeDespesas: 0,
                quantidadeNotas: 0,
            });
        });

        despesasFiltradas.forEach((despesa) => {
            const idMotorista = despesa.motoristaId;
            if (idMotorista && resumoMap.has(idMotorista)) {
                const resumo = resumoMap.get(idMotorista)!;
                resumo.totalDespesas += despesa.valor;
                resumo.quantidadeDespesas++;
            } else if (despesa.motoristaNome) {
                let encontrou = false;
                for (const [, value] of resumoMap) {
                    if (value.nome === despesa.motoristaNome) {
                        value.totalDespesas += despesa.valor;
                        value.quantidadeDespesas++;
                        encontrou = true;
                        break;
                    }
                }
                if (!encontrou) {
                    const novoId = `temp_${Date.now()}_${Math.random()}`;
                    resumoMap.set(novoId, {
                        id: novoId,
                        nome: despesa.motoristaNome,
                        email: '',
                        totalDespesas: despesa.valor,
                        totalFretes: 0,
                        quantidadeDespesas: 1,
                        quantidadeNotas: 0,
                    });
                }
            }
        });

        notasFiltradas.forEach((nota) => {
            const idMotorista = nota.motoristaId;
            if (idMotorista && resumoMap.has(idMotorista)) {
                const resumo = resumoMap.get(idMotorista)!;
                resumo.totalFretes += nota.valorFrete;
                resumo.quantidadeNotas++;
            } else if (nota.motoristaNome) {
                let encontrou = false;
                for (const [, value] of resumoMap) {
                    if (value.nome === nota.motoristaNome) {
                        value.totalFretes += nota.valorFrete;
                        value.quantidadeNotas++;
                        encontrou = true;
                        break;
                    }
                }
                if (!encontrou) {
                    const novoId = `temp_${Date.now()}_${Math.random()}`;
                    resumoMap.set(novoId, {
                        id: novoId,
                        nome: nota.motoristaNome,
                        email: '',
                        totalDespesas: 0,
                        totalFretes: nota.valorFrete,
                        quantidadeDespesas: 0,
                        quantidadeNotas: 1,
                    });
                }
            }
        });

        const listaFinal = Array.from(resumoMap.values());
        listaFinal.sort((a, b) => a.nome.localeCompare(b.nome));
        return listaFinal;
    }, [despesasFiltradas, notasFiltradas, motoristasAtivos]);

    const selecionarMotorista = (motorista: MotoristaRelatorio) => {
        const despesasDoMotorista = despesasFiltradas.filter(d =>
            d.motoristaId === motorista.id || d.motoristaNome === motorista.nome
        );
        const notasDoMotorista = notasFiltradas.filter(n =>
            n.motoristaId === motorista.id || n.motoristaNome === motorista.nome
        );

        setDespesasMotorista(despesasDoMotorista);
        setNotasMotorista(notasDoMotorista);
        setMotoristaSelecionado(motorista);
    };

    const voltarParaLista = () => {
        setMotoristaSelecionado(null);
        setDespesasMotorista([]);
        setNotasMotorista([]);
    };

    const formatarMoeda = (valor: number) => {
        return valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    };

    const formatarData = (dataStr: string) => {
        if (!dataStr) return 'Data não informada';
        return dataStr;
    };

    const calcularTotalDespesas = () => {
        return despesasFiltradas.reduce((sum, d) => sum + d.valor, 0);
    };

    const calcularTotalFretes = () => {
        return notasFiltradas.reduce((sum, n) => sum + n.valorFrete, 0);
    };

    const calcularSaldo = () => {
        return calcularTotalFretes() - calcularTotalDespesas();
    };

    const motoristasFiltrados = resumoMotoristas.filter(m =>
        m.nome.toLowerCase().includes(buscaMotorista.toLowerCase()) ||
        m.email.toLowerCase().includes(buscaMotorista.toLowerCase())
    );

    const podeVerRelatorios = () => {
        return usuario?.cargo === 'gerente' || usuario?.cargo === 'superadmin';
    };

    if (estaCarregando) {
        return (
            <View style={estilos.containerCarregamento}>
                <ActivityIndicator size="large" color={cores.charcoal} />
                <Text style={estilos.textoCarregamento}>Carregando...</Text>
            </View>
        );
    }

    if (!podeVerRelatorios()) {
        return (
            <View style={estilos.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                    <View style={estilos.linhaCabecalho}>
                        <BotaoVoltar />
                        <View style={estilos.centroCabecalho}>
                            <Ionicons name="bar-chart" size={28} color={cores.charcoal} />
                            <Text style={estilos.tituloCabecalho}>Relatórios</Text>
                        </View>
                        <View style={{ width: 44 }} />
                    </View>
                </LinearGradient>
                <View style={estilos.containerAcessoNegado}>
                    <Ionicons name="lock-closed" size={64} color={cores.error} />
                    <Text style={estilos.tituloAcessoNegado}>Acesso Restrito</Text>
                    <Text style={estilos.textoAcessoNegado}>
                        Apenas gerentes podem acessar relatórios.
                    </Text>
                </View>
            </View>
        );
    }

    if (motoristaSelecionado) {
        const totalDespesasMotorista = despesasMotorista.reduce((sum, d) => sum + d.valor, 0);
        const totalFretesMotorista = notasMotorista.reduce((sum, n) => sum + n.valorFrete, 0);
        const saldoMotorista = totalFretesMotorista - totalDespesasMotorista;

        return (
            <View style={estilos.container}>
                <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                    <View style={estilos.linhaCabecalho}>
                        <TouchableOpacity onPress={voltarParaLista} style={estilos.botaoVoltarCabecalho}>
                            <Ionicons name="arrow-back" size={24} color={cores.charcoal} />
                        </TouchableOpacity>
                        <View style={estilos.centroCabecalho}>
                            <Text style={estilos.tituloCabecalho}>{motoristaSelecionado.nome}</Text>
                        </View>
                        <View style={{ width: 44 }} />
                    </View>
                </LinearGradient>

                <View style={estilos.containerEstatisticas}>
                    <View style={estilos.cartaoEstatistica}>
                        <Ionicons name="cash-outline" size={20} color={cores.warning} />
                        <Text style={estilos.numeroEstatistica}>{formatarMoeda(totalDespesasMotorista)}</Text>
                        <Text style={estilos.rotuloEstatistica}>Despesas</Text>
                        <Text style={estilos.quantidadePequena}>{despesasMotorista.length} {despesasMotorista.length === 1 ? 'registro' : 'registros'}</Text>
                    </View>
                    <View style={estilos.cartaoEstatistica}>
                        <Ionicons name="trending-up" size={20} color={cores.success} />
                        <Text style={estilos.numeroEstatistica}>{formatarMoeda(totalFretesMotorista)}</Text>
                        <Text style={estilos.rotuloEstatistica}>Fretes</Text>
                        <Text style={estilos.quantidadePequena}>{notasMotorista.length} {notasMotorista.length === 1 ? 'registro' : 'registros'}</Text>
                    </View>
                    <View style={estilos.cartaoEstatistica}>
                        <Ionicons name="calculator" size={20} color={cores.primary} />
                        <Text style={[estilos.numeroEstatistica, { color: saldoMotorista >= 0 ? cores.success : cores.error }]}>
                            {formatarMoeda(saldoMotorista)}
                        </Text>
                        <Text style={estilos.rotuloEstatistica}>Saldo</Text>
                    </View>
                </View>

                <View style={estilos.containerTipoRelatorio}>
                    <TouchableOpacity
                        style={[estilos.botaoTipo, tipoRelatorio === 'geral' && estilos.botaoTipoAtivo]}
                        onPress={() => setTipoRelatorio('geral')}
                    >
                        <Text style={[estilos.textoTipo, tipoRelatorio === 'geral' && estilos.textoTipoAtivo]}>Resumo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[estilos.botaoTipo, tipoRelatorio === 'despesas' && estilos.botaoTipoAtivo]}
                        onPress={() => setTipoRelatorio('despesas')}
                    >
                        <Text style={[estilos.textoTipo, tipoRelatorio === 'despesas' && estilos.textoTipoAtivo]}>Despesas</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[estilos.botaoTipo, tipoRelatorio === 'fretes' && estilos.botaoTipoAtivo]}
                        onPress={() => setTipoRelatorio('fretes')}
                    >
                        <Text style={[estilos.textoTipo, tipoRelatorio === 'fretes' && estilos.textoTipoAtivo]}>Fretes</Text>
                    </TouchableOpacity>
                </View>

                <ScrollView style={estilos.listaContainer}>
                    {tipoRelatorio === 'geral' && (
                        <Card style={estilos.cartao}>
                            <Card.Content>
                                <Text style={estilos.textoResumoGeral}>Resumo do Período</Text>
                                <Divider style={estilos.divisor} />
                                <View style={estilos.linhaResumoGeral}>
                                    <View style={estilos.itemResumoGeral}>
                                        <Text style={estilos.rotuloResumoGeral}>Despesas</Text>
                                        <Text style={estilos.valorResumoNegativo}>{formatarMoeda(totalDespesasMotorista)}</Text>
                                        <Text style={estilos.quantidadeResumo}>{despesasMotorista.length} {despesasMotorista.length === 1 ? 'registro' : 'registros'}</Text>
                                    </View>
                                    <View style={estilos.itemResumoGeral}>
                                        <Text style={estilos.rotuloResumoGeral}>Fretes</Text>
                                        <Text style={estilos.valorResumoPositivo}>{formatarMoeda(totalFretesMotorista)}</Text>
                                        <Text style={estilos.quantidadeResumo}>{notasMotorista.length} {notasMotorista.length === 1 ? 'registro' : 'registros'}</Text>
                                    </View>
                                    <View style={estilos.itemResumoGeral}>
                                        <Text style={estilos.rotuloResumoGeral}>Saldo</Text>
                                        <Text style={[estilos.valorResumo, { color: saldoMotorista >= 0 ? cores.success : cores.error }]}>
                                            {formatarMoeda(saldoMotorista)}
                                        </Text>
                                    </View>
                                </View>
                            </Card.Content>
                        </Card>
                    )}

                    {tipoRelatorio === 'despesas' && (
                        <>
                            <Text style={estilos.tituloSecao}>Despesas de {motoristaSelecionado.nome}</Text>
                            {despesasMotorista.length === 0 ? (
                                <View style={estilos.containerVazioPequeno}>
                                    <Text style={estilos.textoSemDados}>Nenhuma despesa encontrada para este motorista</Text>
                                </View>
                            ) : (
                                despesasMotorista.map((despesa, index) => (
                                    <View key={despesa.id || index} style={estilos.itemResumo}>
                                        <View style={estilos.itemResumoLinha}>
                                            <View style={estilos.itemResumoIcone}>
                                                <Ionicons name="cash" size={18} color={cores.error} />
                                            </View>
                                            <View style={estilos.itemResumoConteudo}>
                                                <Text style={estilos.itemResumoTipo}>{despesa.tipo}</Text>
                                                <Text style={estilos.itemResumoInfo}>Placa: {despesa.placa} | Data: {formatarData(despesa.data)}</Text>
                                                {despesa.descricao && (
                                                    <Text style={estilos.itemResumoDescricao}>{despesa.descricao}</Text>
                                                )}
                                            </View>
                                            <Text style={estilos.itemResumoValorNegativo}>{formatarMoeda(despesa.valor)}</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </>
                    )}

                    {tipoRelatorio === 'fretes' && (
                        <>
                            <Text style={estilos.tituloSecao}>Fretes de {motoristaSelecionado.nome}</Text>
                            {notasMotorista.length === 0 ? (
                                <View style={estilos.containerVazioPequeno}>
                                    <Text style={estilos.textoSemDados}>Nenhum frete encontrado para este motorista</Text>
                                </View>
                            ) : (
                                notasMotorista.map((nota, index) => (
                                    <View key={nota.id || index} style={estilos.itemResumo}>
                                        <View style={estilos.itemResumoLinha}>
                                            <View style={estilos.itemResumoIcone}>
                                                <Ionicons name="location" size={18} color={cores.success} />
                                            </View>
                                            <View style={estilos.itemResumoConteudo}>
                                                <Text style={estilos.itemResumoTipo}>{nota.destino || 'Viagem'}</Text>
                                                <Text style={estilos.itemResumoInfo}>Data: {formatarData(nota.dataViagem)}</Text>
                                            </View>
                                            <Text style={estilos.itemResumoValorPositivo}>{formatarMoeda(nota.valorFrete)}</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </>
                    )}
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={estilos.container}>
            <LinearGradient colors={[cores.white, cores.platinum]} style={estilos.cabecalho}>
                <View style={estilos.linhaCabecalho}>
                    <BotaoVoltar />
                    <View style={estilos.centroCabecalho}>
                        <Ionicons name="bar-chart" size={28} color={cores.charcoal} />
                        <Text style={estilos.tituloCabecalho}>Relatórios</Text>
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

            <FiltroData
                periodo={filtroPeriodo}
                setPeriodo={setFiltroPeriodo}
                dataInicio={dataInicio}
                setDataInicio={setDataInicio}
                dataFim={dataFim}
                setDataFim={setDataFim}
            />

            <View style={estilos.containerEstatisticasGeral}>
                <View style={estilos.cartaoEstatistica}>
                    <Ionicons name="cash-outline" size={20} color={cores.warning} />
                    <Text style={estilos.numeroEstatistica}>{formatarMoeda(calcularTotalDespesas())}</Text>
                    <Text style={estilos.rotuloEstatistica}>Total Despesas</Text>
                    <Text style={estilos.quantidadePequena}>{despesasFiltradas.length} {despesasFiltradas.length === 1 ? 'registro' : 'registros'}</Text>
                </View>
                <View style={estilos.cartaoEstatistica}>
                    <Ionicons name="trending-up" size={20} color={cores.success} />
                    <Text style={estilos.numeroEstatistica}>{formatarMoeda(calcularTotalFretes())}</Text>
                    <Text style={estilos.rotuloEstatistica}>Total Fretes</Text>
                    <Text style={estilos.quantidadePequena}>{notasFiltradas.length} {notasFiltradas.length === 1 ? 'registro' : 'registros'}</Text>
                </View>
                <View style={estilos.cartaoEstatistica}>
                    <Ionicons name="calculator" size={20} color={cores.primary} />
                    <Text style={[estilos.numeroEstatistica, { color: calcularSaldo() >= 0 ? cores.success : cores.error }]}>
                        {formatarMoeda(calcularSaldo())}
                    </Text>
                    <Text style={estilos.rotuloEstatistica}>Saldo Total</Text>
                </View>
            </View>

            <ScrollView style={estilos.listaContainer}>
                {motoristasFiltrados.length === 0 ? (
                    <View style={estilos.containerVazio}>
                        <Ionicons name="people-outline" size={64} color={cores.dustGrey} />
                        <Text style={estilos.tituloVazio}>Nenhum motorista encontrado</Text>
                        <Text style={estilos.textoVazio}>
                            {buscaMotorista ? 'Tente outro termo de busca' : 'Nenhum motorista cadastrado no sistema'}
                        </Text>
                    </View>
                ) : (
                    motoristasFiltrados.map((motorista) => (
                        <TouchableOpacity
                            key={motorista.id}
                            style={estilos.cartaoMotorista}
                            onPress={() => selecionarMotorista(motorista)}
                        >
                            <Avatar.Text size={50} label={motorista.nome.substring(0, 2).toUpperCase()} style={estilos.avatar} />
                            <View style={estilos.infoMotorista}>
                                <Text style={estilos.nomeMotorista}>{motorista.nome}</Text>
                                <Text style={estilos.emailMotorista}>{motorista.email}</Text>
                                <View style={estilos.statusMotorista}>
                                    <View style={estilos.statPill}>
                                        <Ionicons name="cash-outline" size={13} color={cores.grey} />
                                        <Text style={estilos.statPillText}>
                                            {motorista.quantidadeDespesas} {motorista.quantidadeDespesas === 1 ? 'despesa' : 'despesas'} ({formatarMoeda(motorista.totalDespesas)})
                                        </Text>
                                    </View>
                                    <View style={estilos.statPill}>
                                        <Ionicons name="trending-up" size={13} color={cores.grey} />
                                        <Text style={estilos.statPillText}>
                                            {motorista.quantidadeNotas} {motorista.quantidadeNotas === 1 ? 'frete' : 'fretes'} ({formatarMoeda(motorista.totalFretes)})
                                        </Text>
                                    </View>
                                </View>
                            </View>
                            <View style={estilos.badgeSaldo}>
                                <Text style={[estilos.numeroSaldo, { color: (motorista.totalFretes - motorista.totalDespesas) >= 0 ? cores.success : cores.error }]}>
                                    {formatarMoeda(motorista.totalFretes - motorista.totalDespesas)}
                                </Text>
                                <Text style={estilos.rotuloSaldo}>saldo</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={24} color={cores.silver} />
                        </TouchableOpacity>
                    ))
                )}
            </ScrollView>
        </View>
    );
}

const estilos = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: cores.platinum,
    },
    containerCarregamento: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: cores.platinum,
    },
    textoCarregamento: {
        marginTop: 16,
        color: cores.grey,
    },
    cabecalho: {
        paddingHorizontal: 20,
        paddingTop: 48,
        paddingBottom: 24,
        borderBottomLeftRadius: 30,
        borderBottomRightRadius: 30,
    },
    linhaCabecalho: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    centroCabecalho: {
        alignItems: 'center',
    },
    tituloCabecalho: {
        fontSize: 27,
        fontWeight: 'bold',
        color: cores.charcoal,
        marginTop: 4,
    },
    subtituloCabecalho: {
        fontSize: 16,
        color: cores.grey,
        textAlign: 'center',
        marginTop: 8,
    },
    botaoVoltarCabecalho: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: cores.white,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
    },
    containerBusca: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: cores.white,
        marginHorizontal: 16,
        marginTop: 16,
        marginBottom: 16,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: cores.dustGrey,
    },
    inputBusca: {
        flex: 1,
        paddingVertical: 12,
        marginLeft: 8,
        fontSize: 22,
        color: cores.charcoal,
    },
    containerEstatisticas: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 8,
    },
    containerEstatisticasGeral: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 8,
    },
    cartaoEstatistica: {
        flex: 1,
        backgroundColor: cores.white,
        borderRadius: 16,
        padding: 12,
        alignItems: 'center',
        elevation: 2,
    },
    numeroEstatistica: {
        fontSize: 22,
        fontWeight: 'bold',
        color: cores.charcoal,
        marginTop: 4,
    },
    rotuloEstatistica: {
        fontSize: 14,
        color: cores.grey,
        marginTop: 2,
    },
    quantidadePequena: {
        fontSize: 12,
        color: cores.silver,
        marginTop: 2,
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
    containerVazioPequeno: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
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
    textoSemDados: {
        fontSize: 19,
        color: cores.grey,
        textAlign: 'center',
        paddingVertical: 20,
    },
    cartaoMotorista: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: cores.white,
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        elevation: 3,
    },
    avatar: {
        backgroundColor: cores.primary,
    },
    infoMotorista: {
        flex: 1,
        marginLeft: 16,
    },
    nomeMotorista: {
        fontSize: 22,
        fontWeight: '600',
        color: cores.charcoal,
    },
    emailMotorista: {
        fontSize: 16,
        color: cores.grey,
        marginTop: 2,
    },
    statusMotorista: {
        flexDirection: 'row',
        marginTop: 8,
        gap: 8,
        flexWrap: 'wrap',
    },
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
    badgeSaldo: {
        backgroundColor: cores.platinum,
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignItems: 'center',
        marginRight: 8,
        minWidth: 100,
    },
    numeroSaldo: {
        fontSize: 19,
        fontWeight: 'bold',
        textAlign: 'center',
    },
    rotuloSaldo: {
        fontSize: 14,
        color: cores.grey,
        textAlign: 'center',
    },
    cartao: {
        marginBottom: 12,
        borderRadius: 20,
        backgroundColor: cores.white,
        elevation: 3,
        overflow: 'hidden',
    },
    divisor: {
        marginVertical: 12,
        backgroundColor: cores.dustGrey,
    },
    tituloSecao: {
        fontSize: 24,
        fontWeight: 'bold',
        color: cores.charcoal,
        marginBottom: 16,
        marginTop: 8,
    },
    textoResumoGeral: {
        fontSize: 22,
        fontWeight: 'bold',
        color: cores.charcoal,
        marginBottom: 8,
    },
    linhaResumoGeral: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
    },
    itemResumoGeral: {
        flex: 1,
        alignItems: 'center',
    },
    rotuloResumoGeral: {
        fontSize: 16,
        color: cores.grey,
        marginBottom: 4,
    },
    valorResumo: {
        fontSize: 19,
        fontWeight: 'bold',
    },
    valorResumoPositivo: {
        fontSize: 19,
        fontWeight: 'bold',
        color: cores.success,
    },
    valorResumoNegativo: {
        fontSize: 19,
        fontWeight: 'bold',
        color: cores.error,
    },
    quantidadeResumo: {
        fontSize: 14,
        color: cores.silver,
        marginTop: 2,
    },
    containerTipoRelatorio: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 12,
    },
    botaoTipo: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: cores.white,
        borderWidth: 1,
        borderColor: cores.dustGrey,
        alignItems: 'center',
    },
    botaoTipoAtivo: {
        backgroundColor: cores.primary,
        borderColor: cores.primary,
    },
    textoTipo: {
        fontSize: 16,
        color: cores.grey,
    },
    textoTipoAtivo: {
        color: cores.white,
        fontWeight: '600',
    },
    containerAcessoNegado: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    tituloAcessoNegado: {
        fontSize: 27,
        fontWeight: 'bold',
        color: cores.error,
        marginTop: 16,
    },
    textoAcessoNegado: {
        fontSize: 19,
        color: cores.grey,
        textAlign: 'center',
        marginTop: 8,
    },
    itemResumo: {
        backgroundColor: cores.white,
        borderRadius: 12,
        marginBottom: 8,
        padding: 12,
        elevation: 1,
    },
    itemResumoLinha: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    itemResumoIcone: {
        width: 36,
        alignItems: 'center',
    },
    itemResumoConteudo: {
        flex: 1,
    },
    itemResumoTipo: {
        fontSize: 19,
        fontWeight: '600',
        color: cores.charcoal,
    },
    itemResumoInfo: {
        fontSize: 15,
        color: cores.grey,
        marginTop: 2,
    },
    itemResumoDescricao: {
        fontSize: 15,
        color: cores.silver,
        marginTop: 2,
        fontStyle: 'italic',
    },
    itemResumoValorNegativo: {
        fontSize: 19,
        fontWeight: 'bold',
        color: cores.error,
    },
    itemResumoValorPositivo: {
        fontSize: 19,
        fontWeight: 'bold',
        color: cores.success,
    },
});