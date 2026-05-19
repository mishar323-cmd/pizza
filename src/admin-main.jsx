import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/styles.css';
import './styles/admin.css';
import AdminApp from './admin/AdminApp.jsx';

createRoot(document.getElementById('root')).render(<AdminApp/>);
