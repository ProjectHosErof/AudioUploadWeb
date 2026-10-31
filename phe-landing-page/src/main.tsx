import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
// Fonts are self-hosted (bundled from @fontsource) rather than loaded from
// Google Fonts, so visitors' browsers never contact Google just to view the
// site. Latin subsets, only the weights the design uses.
// Cormorant Garamond 300 (the hero heading) is served from public/fonts and
// preloaded in index.html; its @font-face is in index.css.
import '@fontsource/cormorant-garamond/latin-300-italic.css'
import '@fontsource/cormorant-garamond/latin-400.css'
import '@fontsource/cormorant-garamond/latin-400-italic.css'
import '@fontsource/cormorant-garamond/latin-500.css'
import '@fontsource/jost/latin-300.css'
import '@fontsource/jost/latin-400.css'
import '@fontsource/jost/latin-500.css'
import '@fontsource/jost/latin-600.css'
// Coptic script for the hero's ϩⲱⲥ ⲉⲣⲟϥ — the site's fonts have no Coptic glyphs.
import '@fontsource/noto-sans-coptic/coptic-400.css'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './auth/AuthProvider'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
