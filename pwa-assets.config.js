import { defineConfig } from '@vite-pwa/assets-generator/config'

const fundo = '#ffffff'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: { sizes: [192, 512], favicons: [], padding: 0.1, resizeOptions: { background: fundo, fit: 'contain' } },
    maskable: { sizes: [512], padding: 0.3, resizeOptions: { background: fundo, fit: 'contain' } },
    apple: { sizes: [180], padding: 0.1, resizeOptions: { background: fundo, fit: 'contain' } },
  },
  images: ['public/pwa-icone-fonte.svg'],
})
