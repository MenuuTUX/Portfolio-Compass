import "./globals.css";

export const metadata = {
  title: "PortfolioCompass",
  description: "Institutional Grade Portfolio Intelligence",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
