import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { importAnydo } from './seed.ts'

// Any.do からの初回取り込み。一度だけ実行する（フラグで管理）。
const IMPORT_FLAG = 'ippo:imported:anydo-v1'
if (!localStorage.getItem(IMPORT_FLAG)) {
  importAnydo()
  localStorage.setItem(IMPORT_FLAG, new Date().toISOString())
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
