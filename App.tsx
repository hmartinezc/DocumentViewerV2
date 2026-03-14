import type { FunctionComponent } from 'preact';
import ShippingDocViewer from './components/ShippingDocViewer';
import { mockShipmentData } from './utils/mockData';

const App: FunctionComponent = () => {
  return (
    <ShippingDocViewer data={mockShipmentData} />
  );
};

export default App;