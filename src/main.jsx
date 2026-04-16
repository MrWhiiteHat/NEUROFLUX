import ReactDOM from 'react-dom/client';
import App from './App';
import { InputProvider } from './context/InputContext.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
	<InputProvider>
		<App />
	</InputProvider>
);
