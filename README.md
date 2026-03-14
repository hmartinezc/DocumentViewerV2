<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Shipping Document Viewer (Web Component)

This project builds a **single-file JavaScript Web Component** using **Preact**, with **Shadow DOM** isolation so it will not affect (or be affected by) your Razor Pages site styles.

## Local Development

**Prerequisites:** Node.js

1. Install dependencies:
    `npm install`
2. Run the dev server:
    `npm run dev`
3. Open the dev URL printed by Vite (default: http://localhost:3000).

## Build Output

Run:
`npm run build`

The build creates a **single** JS file:
- dist/shipping-doc-viewer.js

## Embed in Razor Pages

Include the JS file and the custom element in your Razor page:

```html
<script src="/path/to/shipping-doc-viewer.js"></script>
<shipping-doc-viewer id="docViewer"></shipping-doc-viewer>
```

Then pass your backend JSON to the component:

```html
<script>
   const data = /* JSON from backend */;
   document.getElementById('docViewer').data = data;
</script>
```

You can also pass JSON as a string attribute:

```html
<shipping-doc-viewer data='{"mawb":"020-...", ... }'></shipping-doc-viewer>
```

## JSON Format (from Backend)

This is the same shape as the current demo, with optional friendly labels:

```ts
interface Document {
   id: string;
   name: string;          // File name (original file)
   displayName?: string;  // Friendly name (Invoice, Export List, etc.)
   category?: string;     // Optional category label
   type: 'pdf' | 'xls' | 'xlsx' | 'jpg' | 'png' | 'doc' | 'docx';
   size: string;
   date: string;
   url: string;           // Signed Azure Blob URL
}

interface HAWB {
   id: string;
   number: string;
   shipper: string;
   consignee: string;
   documents: Document[];
}

interface ShipmentData {
   mawb: string;
   clientName: string;
   origin: string;
   destination: string;
   status: 'In Transit' | 'Cleared' | 'Delivered' | 'Exception';
   agencyLogo?: string;      // URL to agency logo (shown in footer)
   expirationDays?: number;  // Days until link expires (shown in footer, default 15)
   masterDocuments: Document[];
   hawbs: HAWB[];
}
```

Notes:
- If `displayName` is provided, the UI shows it instead of the long filename.
- If `hawbs` is empty, the UI shows a friendly "No HAWBs available" message.
- Each `url` is used directly for download (works with signed Azure Blob URLs).
- `expirationDays` controls the message in the footer (e.g., "This link will expire in 10 days").
