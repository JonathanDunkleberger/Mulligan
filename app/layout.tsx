import "./globals.css";
import Header from "./_components/Header";
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Mulligan — Media Recs",
  description: "Pick favorites across film, games, anime, TV, and books, then get recommendations."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark">
        <body className="bg-[#0b0b0f] text-white min-h-screen font-sans antialiased">
          <Header />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}

