import { ShipmentData } from '../types';

export const mockShipmentData: ShipmentData = {
  mawb: "020-8901-2345",
  clientName: "JAF FLOWER SA",
  origin: "HKG",
  destination: "LAX",
  status: "In Transit",
  agencyLogo: "https://avcoperflor.blob.core.windows.net/operflorimg/operflorlogo.png",
  agencyName: "AVC Operflor",
  expirationDays: 15,
  masterDocuments: [
    {
      id: "m1",
      name: "MAWB_Original_Copy.pdf",
      displayName: "Master AWB",
      category: "Master",
      type: "pdf",
      size: "1.2 MB",
      date: "2023-10-25",
      url: "#",
      sortOrder: 1
    },
    {
      id: "m2",
      name: "Flight_Manifest_CX880.xlsx",
      displayName: "Flight Manifest",
      category: "Manifest",
      type: "xlsx",
      size: "45 KB",
      date: "2023-10-25",
      url: "#",
      sortOrder: 2
    },
    {
      id: "m3",
      name: "Consolidation_Manifest.pdf",
      displayName: "Consolidation Manifest",
      category: "Manifest",
      type: "pdf",
      size: "850 KB",
      date: "2023-10-24",
      url: "#",
      sortOrder: 3
    }
  ],
  hawbs: [
    {
      id: "h1",
      number: "H-100234",
      shipper: "Bogota Blooms Ltd.",
      consignee: "Tech Solutions Inc.",
      sortOrder: 1,
      documents: [
        {
          id: "h1-d1",
          name: "Commercial_Invoice_INV9901.pdf",
          displayName: "Commercial Invoice",
          category: "Invoice",
          type: "pdf",
          size: "240 KB",
          date: "2023-10-22",
          url: "#"
        },
        {
          id: "h1-d2",
          name: "Packing_List.xlsx",
          displayName: "Packing List",
          category: "Export List",
          type: "xlsx",
          size: "12 KB",
          date: "2023-10-22",
          url: "#",
          sortOrder: 2
        },
        {
          id: "h1-d3",
          name: "Package_Photo_01.jpg",
          displayName: "Package Photo",
          category: "Photos & Evidence",
          type: "jpg",
          size: "3.5 MB",
          date: "2023-10-21",
          url: "#",
          sortOrder: 3
        }
      ]
    },
    {
      id: "h2",
      number: "H-100235",
      shipper: "Quito Floral Export",
      consignee: "Global Retail LLC",
      sortOrder: 2,
      documents: [
        {
          id: "h2-d1",
          name: "Commercial_Invoice_INV9902.pdf",
          displayName: "Commercial Invoice",
          category: "Invoice",
          type: "pdf",
          size: "210 KB",
          date: "2023-10-23",
          url: "#",
          sortOrder: 1
        },
        {
          id: "h2-d2",
          name: "Certificate_of_Origin.pdf",
          displayName: "Certificate of Origin",
          category: "Certificates",
          type: "pdf",
          size: "1.8 MB",
          date: "2023-10-23",
          url: "#",
          sortOrder: 2
        }
      ]
    },
    {
      id: "h3",
      number: "H-100236",
      shipper: "Medellin Orchids",
      consignee: "FastTrack Logistics",
      sortOrder: 3,
      documents: [
        {
          id: "h3-d1",
          name: "Damage_Report.docx",
          displayName: "Damage Report",
          category: "Reports",
          type: "docx",
          size: "450 KB",
          date: "2023-10-26",
          url: "#",
          sortOrder: 1
        },
        {
          id: "h3-d2",
          name: "Warehousing_Receipt.pdf",
          displayName: "Warehouse Receipt",
          category: "Receipts",
          type: "pdf",
          size: "120 KB",
          date: "2023-10-26",
          url: "#",
          sortOrder: 2
        }
      ]
    }
  ]
};