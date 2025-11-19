/**
 * Monolit Planner - Clean calculator shell
 */

import { AppProvider } from './context/AppContext';
import MainApp from './components/MainApp';
import './styles/components.css';

function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}

export default App;
