// src/screens/OrderConfirmation.tsx
import { IonPage, IonContent } from '@ionic/react';
import ReceiptScreen from '@/modules/payment/ReceiptScreen';

export default function OrderConfirmation() {
  return (
    <IonPage>
      <IonContent fullscreen scrollY={false}>
        <ReceiptScreen />
      </IonContent>
    </IonPage>
  );
}
