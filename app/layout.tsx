import "./globals.css";
import Header from "./_components/Header";

export const metadata = {
  title: "Mulligan — Media Recs",
  description: "Pick favorites across film, games, anime, TV, and books, then get recommendations."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="topbar">
          <div className="topbarInner">
            <Header />
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
