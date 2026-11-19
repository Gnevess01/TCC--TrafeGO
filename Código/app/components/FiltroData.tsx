import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { Text } from 'react-native-paper';
import { cores } from '../theme';


export type PeriodoType = 'todas' | 'hoje' | 'estaSemana' | 'esteMes' | 'mesPassado' | 'ultimos3Meses' | 'anoAtual' | 'personalizado';


interface FiltroDataProps {
    periodo: PeriodoType;
    setPeriodo: (periodo: PeriodoType) => void;
    dataInicio?: Date | null;
    setDataInicio?: (date: Date | null) => void;
    dataFim?: Date | null;
    setDataFim?: (date: Date | null) => void;
    showPersonalizado?: boolean;
}


export const FiltroData = ({
    periodo,
    setPeriodo,
    dataInicio,
    setDataInicio,
    dataFim,
    setDataFim,
    showPersonalizado = true,
}: FiltroDataProps) => {
    const [modalVisible, setModalVisible] = useState(false);
    const [tempInicio, setTempInicio] = useState('');
    const [tempFim, setTempFim] = useState('');


    const opcoesPeriodo: { value: PeriodoType; label: string; icon: string }[] = [
        { value: 'todas', label: 'Todas', icon: 'calendar-outline' },
        { value: 'hoje', label: 'Hoje', icon: 'today-outline' },
        { value: 'estaSemana', label: 'Semana', icon: 'calendar-outline' },
        { value: 'esteMes', label: 'Mês', icon: 'calendar-outline' },
        { value: 'mesPassado', label: 'Mês Passado', icon: 'chevron-back-outline' },
        { value: 'ultimos3Meses', label: '3 Meses', icon: 'calendar-outline' },
        { value: 'anoAtual', label: 'Ano', icon: 'calendar-outline' },
    ];


    if (showPersonalizado) {
        opcoesPeriodo.push({ value: 'personalizado', label: 'Período', icon: 'calendar' });
    }


    const formatarDataParaInput = (date: Date | null): string => {
        if (!date) return '';
        const dia = date.getDate().toString().padStart(2, '0');
        const mes = (date.getMonth() + 1).toString().padStart(2, '0');
        const ano = date.getFullYear();
        return `${dia}/${mes}/${ano}`;
    };


    const parseData = (dataStr: string): Date | null => {
        const partes = dataStr.split('/');
        if (partes.length !== 3) return null;
        const dia = parseInt(partes[0]);
        const mes = parseInt(partes[1]) - 1;
        const ano = parseInt(partes[2]);
        if (isNaN(dia) || isNaN(mes) || isNaN(ano)) return null;
        return new Date(ano, mes, dia);
    };


    const aplicarPersonalizado = () => {
        const inicio = parseData(tempInicio);
        const fim = parseData(tempFim);
        if (inicio && fim && setDataInicio && setDataFim) {
            setDataInicio(inicio);
            setDataFim(fim);
            setModalVisible(false);
        }
    };


    const obterTextoPeriodo = (): string => {
        if (periodo === 'personalizado' && dataInicio && dataFim) {
            return `${formatarDataParaInput(dataInicio)} a ${formatarDataParaInput(dataFim)}`;
        }
        const opcao = opcoesPeriodo.find(o => o.value === periodo);
        return opcao?.label || 'Todas';
    };


    return (
        <View style={styles.container}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollContainer}>
                {opcoesPeriodo.map(op => (
                    <TouchableOpacity
                        key={op.value}
                        style={[
                            styles.opcaoButton,
                            periodo === op.value && styles.opcaoButtonActive
                        ]}
                        onPress={() => {
                            if (op.value === 'personalizado' && showPersonalizado) {
                                setTempInicio(dataInicio ? formatarDataParaInput(dataInicio) : '');
                                setTempFim(dataFim ? formatarDataParaInput(dataFim) : '');
                                setModalVisible(true);
                            } else {
                                setPeriodo(op.value);
                                if (setDataInicio && setDataFim && op.value !== 'personalizado') {
                                    setDataInicio(null);
                                    setDataFim(null);
                                }
                            }
                        }}
                    >
                        <Ionicons
                            name={op.icon as any}
                            size={14}
                            color={periodo === op.value ? cores.white : cores.grey}
                        />
                        <Text style={[
                            styles.opcaoText,
                            periodo === op.value && styles.opcaoTextActive
                        ]}>
                            {op.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>


            <Text style={styles.resumoPeriodo}>
                Período: {obterTextoPeriodo()}
            </Text>


            {/* Modal para período personalizado (funciona na Web) */}
            <Modal visible={modalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Selecionar Período</Text>


                        <Text style={styles.modalLabel}>Data Inicial</Text>
                        <TextInput
                            style={styles.dateInput}
                            placeholder="DD/MM/AAAA"
                            value={tempInicio}
                            onChangeText={setTempInicio}
                            keyboardType="numeric"
                        />


                        <Text style={styles.modalLabel}>Data Final</Text>
                        <TextInput
                            style={styles.dateInput}
                            placeholder="DD/MM/AAAA"
                            value={tempFim}
                            onChangeText={setTempFim}
                            keyboardType="numeric"
                        />


                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => setModalVisible(false)}
                            >
                                <Text style={styles.cancelButtonText}>Cancelar</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.applyButton]}
                                onPress={aplicarPersonalizado}
                            >
                                <Text style={styles.applyButtonText}>Aplicar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};


const styles = StyleSheet.create({
    container: {
        backgroundColor: cores.white,
        marginHorizontal: 16,
        marginBottom: 16,
        padding: 12,
        borderRadius: 16,
        shadowColor: cores.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    scrollContainer: {
        flexDirection: 'row',
    },
    opcaoButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: cores.platinum,
        marginRight: 8,
        gap: 6,
        borderWidth: 1,
        borderColor: cores.dustGrey,
    },
    opcaoButtonActive: {
        backgroundColor: cores.primary,
        borderColor: cores.primary,
    },
    opcaoText: {
        fontSize: 16,
        color: cores.grey,
    },
    opcaoTextActive: {
        color: cores.white,
        fontWeight: '600',
    },
    resumoPeriodo: {
        fontSize: 16,
        color: cores.primary,
        marginTop: 10,
        textAlign: 'center',
        fontWeight: '500',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: cores.white,
        borderRadius: 24,
        padding: 20,
        width: '85%',
    },
    modalTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: cores.charcoal,
        marginBottom: 16,
        textAlign: 'center',
    },
    modalLabel: {
        fontSize: 19,
        fontWeight: '500',
        color: cores.charcoal,
        marginBottom: 8,
        marginTop: 8,
    },
    dateInput: {
        borderWidth: 1,
        borderColor: cores.dustGrey,
        borderRadius: 12,
        padding: 12,
        fontSize: 22,
        color: cores.charcoal,
        backgroundColor: cores.white,
    },
    modalButtons: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 20,
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: cores.platinum,
        borderWidth: 1,
        borderColor: cores.error,
    },
    cancelButtonText: {
        color: cores.error,
        fontWeight: '600',
    },
    applyButton: {
        backgroundColor: cores.primary,
    },
    applyButtonText: {
        color: cores.white,
        fontWeight: '600',
    },
});