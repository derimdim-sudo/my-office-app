import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// ตั้งค่า Reset CSS พื้นฐาน
import './index.css' 

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
