export const metadata = {
  title: "Terms of Service | Sumz Market",
  description: "Read the Sumz Market purchase, warranty, and refund terms.",
};

const terms = [
  {
    title: "Account warranties",
    text: [
      "NFA (Not Full Access) accounts come with a 6-hour warranty.",
      "FA (Full Access) accounts come with a 2-week warranty.",
    ],
  },
  {
    title: "After the warranty period",
    text: [
      "Once the warranty period has expired, I will not provide replacements or refunds for any reason.",
    ],
  },
  {
    title: "Final sales",
    text: [
      "All sales are final.",
    ],
  },
  {
    title: "Before purchasing",
    text: [
      "If you do not agree with these Terms of Service, please do not purchase from me.",
      "I always do my best to provide the highest-quality accounts possible.",
    ],
  },
];

export default function TermsOfServicePage() {
  return (
    <main style={{ minHeight: "100vh", padding: "32px 20px 70px" }}>
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: 9, color: "#d8a8ff", fontWeight: 800, marginBottom: 34 }}>
          <span style={{ fontSize: 22 }}>♛</span> SUMZ MARKET
        </a>

        <section style={{
          border: "1px solid #3c2256",
          borderRadius: 22,
          padding: "clamp(24px, 5vw, 48px)",
          background: "radial-gradient(ellipse at 90% 0%, rgba(126,34,206,.2), transparent 42%), linear-gradient(145deg,#171020,#0d0913)",
          boxShadow: "0 24px 70px rgba(0,0,0,.28)",
        }}>
          <div style={{ color: "#c084fc", fontSize: 11, fontWeight: 900, letterSpacing: 3 }}>CUSTOMER INFORMATION</div>
          <h1 style={{ margin: "10px 0 12px", fontSize: "clamp(32px, 6vw, 48px)", letterSpacing: -1.5 }}>Terms of Service</h1>
          <p style={{ color: "#b7aabe", fontSize: 15, lineHeight: 1.75, margin: 0 }}>
            By purchasing from me, you agree to the following terms:
          </p>

          <div style={{ display: "grid", gap: 22, marginTop: 34 }}>
            {terms.map((section, index) => (
              <section key={section.title} style={{ paddingTop: 20, borderTop: "1px solid #30213f" }}>
                <h2 style={{ margin: "0 0 12px", fontSize: 17, color: "#f2e9fa" }}>
                  {String(index + 1).padStart(2, "0")} · {section.title}
                </h2>
                <div style={{ display: "grid", gap: 9 }}>
                  {section.text.map(line => (
                    <p key={line} style={{ color: "#b9aec4", fontSize: 14, lineHeight: 1.75, margin: 0 }}>
                      {line}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <p style={{ margin: "30px 0 0", paddingTop: 22, borderTop: "1px solid #30213f", color: "#d8a8ff", fontSize: 14, lineHeight: 1.7, fontWeight: 700 }}>
            Thank you for your understanding and support.
          </p>
        </section>

        <footer style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginTop: 22, color: "#81768d", fontSize: 11 }}>
          <span>© {new Date().getFullYear()} SUMZ MARKET · VERIFIED SINCE 2021</span>
          <span style={{ display: "flex", gap: 16 }}>
            <a href="/" style={{ color: "#b9aec4" }}>Storefront</a>
            <a href="/account" style={{ color: "#b9aec4" }}>My Account</a>
            <a href="https://discord.com/invite/sumz" target="_blank" rel="noopener noreferrer" style={{ color: "#b9aec4" }}>Discord ↗</a>
          </span>
        </footer>
      </div>
    </main>
  );
}
