// src/screens/SettingsScreen.tsx
import { IonPage, IonContent } from '@ionic/react';
import SettingsScreenContent from '@/modules/settings/SettingsScreen';

export default function SettingsScreen() {
  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <SettingsScreenContent />
      </IonContent>
    </IonPage>
  );
}
