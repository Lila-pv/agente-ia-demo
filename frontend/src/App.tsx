import AgentComponent from './AgentComponent';
import TestComponent from './TestComponent';
import './App.css'; 

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 gap-4">
      <TestComponent />
      <AgentComponent />
    </div>
  );
}

export default App;