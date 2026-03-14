export type FileType = 'pdf' | 'xls' | 'xlsx' | 'jpg' | 'png' | 'doc' | 'docx';

export interface Document {
  id: string;
  name: string;
  displayName?: string; // Friendly name from backend (e.g., Invoice, Export List)
  category?: string;    // Optional category label from backend
  type: FileType;
  size: string;
  date: string;
  url: string; // Mock URL
  sortOrder?: number;   // Display order from backend (lower = first). If omitted, array order is used.
}

export interface HAWB {
  id: string;
  number: string;
  shipper: string;   // Exporter
  consignee: string; // Importer
  sortOrder?: number; // Display order from backend (lower = first)
  documents: Document[];
}

export interface ShipmentData {
  mawb: string;
  clientName: string; // The main client/importer for the Master
  origin: string;
  destination: string;
  status: 'In Transit' | 'Cleared' | 'Delivered' | 'Exception';
  agencyLogo?: string; // URL to agency logo image
  agencyName?: string; // Agency/tenant display name
  expirationDays?: number; // Days until link expires (default 15)
  masterDocuments: Document[];
  hawbs: HAWB[];
}