// src/screens/AttractScreen.tsx
import { IonPage, IonContent } from '@ionic/react';
import AttractScreenContent from '@/modules/kiosk/AttractScreen';

export default function AttractScreen() {
  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <AttractScreenContent />
      </IonContent>
    </IonPage>
  );
}
