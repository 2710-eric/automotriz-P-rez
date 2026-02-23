
// Definición de tipos para la gestión de inventario y personal del taller
export enum ProductType {
  ACEITE = 'Aceite',
  REFRIGERANTE = 'Refrigerante',
  DESENGRASANTE = 'Desengrasante'
}

export interface Product {
  id: string;
  type: ProductType;
  brand: string;
  liters: string;
  quantity: number;
  location: string;
  notes?: string;
  lastUpdated?: number;
}

export interface User {
  id: string;
  name: string;
  lastActive: number;
}

export interface Mechanic {
  id: string;
  name: string;
}

export interface ShopSettings {
  phone: string;
}

export interface UsageLog {
  id: string;
  usedBy: string;
  brand: string;
  type: ProductType;
  liters: string;
  timestamp: number;
  action: 'CONSUMO' | 'INGRESO' | 'EDICION';
  quantity: number;
}
