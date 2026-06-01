// src/screens/TipScreen.tsx
import { IonPage, IonContent } from '@ionic/react';
import TipScreenContent from '@/modules/payment/TipScreen';

export default function TipScreen() {
  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <TipScreenContent />
      </IonContent>
    </IonPage>
  );
}
