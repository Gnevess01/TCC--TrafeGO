import { Redirect } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { auth, db } from './servicos/firebaseConfig';
import { cores } from './theme';

export default function Index() {
    const [verificando, setVerificando] = useState(true);
    const [destino, setDestino] = useState('/telasLogin/login');

    useEffect(() => {
        const verificarUsuario = async () => {
            const usuario = auth.currentUser;

            if (!usuario) {
                setVerificando(false);
                return;
            }

            try {
                const documentoUsuario = await getDoc(doc(db, 'usuarios', usuario.uid));

                if (!documentoUsuario.exists()) {
                    setVerificando(false);
                    return;
                }

                const dadosUsuario = documentoUsuario.data();

                if (dadosUsuario.status !== 'aprovado' || !dadosUsuario.ativo) {
                    await auth.signOut();
                    setVerificando(false);
                    return;
                }

                setDestino(dadosUsuario.cargo === 'superadmin' ? '/telas/superadmin' : '/telas');
            } catch (erro) {
                
                
            } finally {
                setVerificando(false);
            }
        };

        verificarUsuario();
    }, []);

    if (verificando) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: cores.platinum }}>
                <ActivityIndicator size="large" color={cores.charcoal} />
            </View>
        );
    }

    return <Redirect href={destino as any} />;
}