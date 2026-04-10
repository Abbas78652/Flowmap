// src/index.js
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import DM Sans font from Google Fonts
const link = document.createElement('link');
link.rel  = 'stylesheet';
link.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap';
document.head.appendChild(link);

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
