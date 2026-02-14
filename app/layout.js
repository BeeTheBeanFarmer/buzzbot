import './globals.css'

export const metadata = {
  title: 'BuzzBot - Lightning Fast NFT Minting',
  description: 'Mint faster than humans, faster than bots',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
