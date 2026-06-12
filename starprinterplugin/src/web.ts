import { WebPlugin } from '@capacitor/core';

import type { StarPrinterReceiptPlugin, DeviceStatusPlugin } from './definitions';

export class StarPrinterReceiptWeb extends WebPlugin implements StarPrinterReceiptPlugin {

  async echo(options: { printerName :string; printerAddress: string; constructedObj: string }): Promise<{ printerName :string; printerAddress: string; constructedObj: string }> {
    console.log('customCall', options);

    // Log received array for debugging
    console.log('Received Printer Name:', options.printerName);
    console.log('Received Printer Address:', options.printerAddress);
    console.log('Received Data Array:', options.constructedObj);

    // Return the received data for verification
    return {
      printerName: options.printerName,
      printerAddress: options.printerAddress,
      constructedObj: options.constructedObj,
    };
  }
  async getConnectionToken(options: { Token: string}): Promise<{ Token: string}> {
    console.log('customCall', options);

    // Log received array for debugging
    console.log('Received Token:', options.Token);

    // Return the received data for verification
    return {
      Token: options.Token,
    };
  }
  async getReaderDetails(options: { Reader: string; ReaderName: string}): Promise<{ Reader: string; ReaderName: string}> {
    console.log('customCall', options);

    // Log received array for debugging
    // console.log('Received Token:', options.Reader);
    // console.log('Received Token:', options.Reader);

    // Return the received data for verification
    return {
      Reader: options.Reader,
      ReaderName: options.ReaderName,
    };
  }
  
  async scanner(options: { printerAddress: string; constructedObj: {} }): Promise<{ printerAddress: string; constructedObj: {} }> {
    console.log('customCall', options);

    // Log received array for debugging
    console.log('Received Printer Address:', options.printerAddress);
    console.log('Received Data Array:', options.constructedObj);

    // Return the received data for verification
    return {
      printerAddress: options.printerAddress,
      constructedObj: options.constructedObj,
    };
  }
  async createAndProcessPayment(options: { deviceName:string; deviceAddress: string;  constructedObj: {} }): Promise<{ deviceName:string; deviceAddress: string;   constructedObj: {} }> {
    console.log('customCall', options);

    // Log received array for debugging
    console.log('Received Printer Address:', options.deviceName);
    console.log('Received Printer Address:', options.deviceAddress);
    console.log('Received Data Array:', options.constructedObj);

    // Return the received data for verification
    return {
      deviceName: options.deviceName,
      deviceAddress: options.deviceAddress,
      constructedObj: options.constructedObj,
    };
  }
  async openCashDrawer(options: { printerName :string; printerAddress: string }): Promise<{ printerName :string; printerAddress: string }> {
    console.log('openCashDrawer customCall', options);

    // Log received array for debugging
    console.log('Received Printer Name:', options.printerName);
    console.log('Received Printer Address:', options.printerAddress);

    // Return the received data for verification
    return {
      printerName: options.printerName,
      printerAddress: options.printerAddress,
    };
  }
  async getMacAddress(): Promise<void> {
    return;
  }
  async searchDevice(options:  {deviceName: string; deviceAddress: string; deviceMake:string }): Promise<{deviceName: string; deviceAddress: string; deviceMake:string }> {
    console.log('Device customCall', options);

    // Log received array for debugging
    console.log('Received Device Name:', options.deviceName);
    console.log('Received Device Address:', options.deviceAddress);
    console.log('Received Device Make:', options.deviceMake);

    // Return the received data for verification
    return {
      deviceName : options.deviceName,
      deviceAddress: options.deviceAddress,
      deviceMake:options.deviceMake,
    };
  }
  async startScan(): Promise<void> {
    console.warn('Bluetooth scanning is not supported on the web.');
  }
  async fetchConnectedDevices(): Promise<{ devices: {name: string; address: string }[] }> {
    console.warn('fetchPairedDevices() is not supported on the web.');
    return{ devices: [] };
  }

  async fetchPairedDevices(): Promise<{ devices: { name: string; address: string }[] }> {
    console.warn('fetchConnectedDevices() is not supported on the web.');
    return { devices: [] }; // Return an empty list as a fallback
  }
   
  async requestBluetoothPermissions(): Promise<void> {
    console.warn('Bluetooth scanning is not supported on the web.');
  }
  // async getPairedDevices(): Promise<{ devices: { name: string; address: string }[] }> {
  //   console.warn('getPairedDevices is not supported on the web.');
  //   return { devices: [] };
  // }

  async pairDevice(_options: { address: string }): Promise<{ status: string }> {
    console.warn("pairDevice is not supported on the web.");
    return { status: "unsupported" };
  }
  async unpairDevice(_options: { address: string }): Promise<{ status: string }> {
    console.warn("Unpairing device is not supported on the web.");
    return { status: "unsupported" };
  }

  async samplePrint(_options: { printImage: string }): Promise<{ status: string }> {
    console.warn("pairDevice is not supported on the web.");
    return { status: "unsupported" };
  }
   async allowPermissions(): Promise<{ bluetooth: boolean; location: boolean; }> {
    const bluetooth = true; // Replace with actual value
    const location = true; // Replace with actual value
    return Promise.resolve({ bluetooth, location });
  }
  getM2ReaderInfo(): Promise<any> {
    return Promise.resolve({});
  }
    async printText(options: { ip: string; port?: number; textdata:string; data: string; model:string;count:number}): Promise<{ status: string; message: string }> {
    console.log('Web fallback print:', options);
    return { status: 'success', message: 'Simulated print (web)' };
  }
  
}
export class DeviceStatusPluginWeb extends WebPlugin implements DeviceStatusPlugin { 

  async allowPermissions(): Promise<{ bluetooth: boolean; location: boolean; }> {
    const bluetooth = true; // Replace with actual value
    const location = true; // Replace with actual value
    return Promise.resolve({ bluetooth, location });
  }
  async getPrinterDetails(options: { printerName :string; printerAddress: string }): Promise<any> {
    console.log('customCall', options);

    // Log received array for debugging
    console.log('Received Printer Name:', options.printerName);
    console.log('Received Printer Address:', options.printerAddress);
    return Promise.resolve({});
  }
  


} 





