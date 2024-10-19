import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { Amplify } from 'aws-amplify';
import outputs from "../amplify_outputs.json"

Amplify.configure(outputs)

console.log('Main.jsx is running');

try {
  const root = createRoot(document.getElementById('root'));
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
  console.log('Root rendered successfully');
} catch (error) {
  console.error('Error rendering the app:', error);
}
