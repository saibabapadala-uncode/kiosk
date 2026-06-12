export interface StarPrinterReceiptPlugin {
  echo(options: { printerName:string; printerAddress: string; constructedObj: string }): Promise<{
    printerName: string;
    printerAddress: string;
    constructedObj: string;
  }>;
  // for Token 
  getConnectionToken(options: { Token: string }): Promise<{
    Token: string;
  }>;

  // for Token 
  getReaderDetails(options: { Reader: string; ReaderName: string }): Promise<{
    Reader: string; ReaderName: string;
  }>;
  // for payment device intgartion
  createAndProcessPayment(options: {deviceName:string; deviceAddress: string; constructedObj: {} }): Promise<{
    deviceName:string; 
    deviceAddress: string; 
    constructedObj: {};
  }>;
   // for open Cash Drawer
   openCashDrawer(options: { printerName:string; printerAddress: string }): Promise<{
    printerName: string;
    printerAddress: string;
  }>;

  
  // for open Cash Drawer
  getMacAddress(): Promise<void>;

  // 
  searchDevice(options: { deviceName:string; deviceAddress: string; deviceMake:string}): Promise<{
    deviceName: string;
    deviceAddress: string;
    deviceMake:string
  }>;
  
  // for barcode scanner device intgartion

  scanner(options: { printerAddress: string; constructedObj: {} }): Promise<{
    printerAddress: string;
    constructedObj: {};
  }>;
  startScan(): Promise<void>;
  requestBluetoothPermissions(): Promise<void>;
  pairDevice(options: { address: string }): Promise<{ status: string }>;
  unpairDevice(options: { address: string }): Promise<{ status: string }>;

  // getPairedDevices(): Promise<{ devices: { name: string; address: string }[] }>;



  addListener(eventName: 'bluetoothStateChange', listenerFunc: (data: { isEnabled: boolean }) => void): void;
  addListener(eventName: "bluetoothDeviceFound", listenerFunc: (data: { devices: { name: string; address: string }[] }) => void): void;
  addListener(eventName: 'bluetoothPairingStatus', listenerFunc: (data: { name: string; address: string; status: string }) => void): void;

  fetchPairedDevices(): Promise<{ devices: { name: string; address: string }[] }>;

  fetchConnectedDevices(): Promise<{ devices: { name: string; address: string }[] }>;
  samplePrint(options: { printImage: string }): Promise<{ status: string }>;
    allowPermissions(): Promise<{
    bluetooth: boolean;
    location: boolean;
  }>;
  getM2ReaderInfo(): Promise<any>;
  printText(options: { ip: string; port?: number; textdata:string; data: string;model:string;count:number}): Promise<{ status: string; message: string;}>;
  
}
export interface DeviceStatusPlugin {
  allowPermissions(): Promise<{
    bluetooth: boolean;
    location: boolean;
  }>;
  getPrinterDetails(options: { printerName:string; printerAddress: string;}): Promise<any>;
  addListener(eventName: 'bluetoothStatusChanged', listenerFunc: (data: { isEnabled: boolean }) => void): void;
  addListener(eventName: 'locationStatusChanged', listenerFunc: (data: { isEnabled: boolean }) => void): void;


}