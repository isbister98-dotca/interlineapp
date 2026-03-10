export const metadata = {
  title: 'InterlineApp',
  description: 'GO Transit, MiApp, and UP Express GTFS transit database',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0, background: '#f5f5f5' }}>
        {children}
      </body>
    </html>
  )
}
