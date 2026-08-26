import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'

const CashiPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '#eef3ff', 100: '#dbe5ff', 200: '#bdceff', 300: '#94adff',
      400: '#6884ff', 500: '#1f5aff', 600: '#1649d8', 700: '#183dac',
      800: '#1b3788', 900: '#1b326f', 950: '#121d41',
    },
    colorScheme: {
      light: {
        surface: {
          0: '#ffffff', 50: '#fbfaf6', 100: '#f3f0e9', 200: '#e7e3db',
          300: '#d4cfc6', 400: '#aaa49b', 500: '#8c8880', 600: '#6b6864',
          700: '#4c4945', 800: '#302e2b', 900: '#191817', 950: '#0d0c0b',
        },
      },
    },
  },
  borderRadius: {
    none: '0', xs: '4px', sm: '6px', md: '7px', lg: '9px', xl: '12px',
  },
})

export default CashiPreset
