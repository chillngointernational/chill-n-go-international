import { useState, useEffect, useRef } from "react";

const LOBS = [
  { name: "Travel", tagline: "Viajes y experiencias", icon: "✈", color: "#1D9E75", lightColor: "#5DCAA5", bgColor: "rgba(29,158,117,0.08)", desc: "Hoteles, vuelos, tours y paquetes a precios exclusivos con tarifas netas." },
  { name: "Nutrition", tagline: "Salud y bienestar", icon: "🌿", color: "#639922", lightColor: "#C0DD97", bgColor: "rgba(99,153,34,0.08)", desc: "Planes nutricionales, productos de bienestar y servicios de salud." },
  { name: "Real Estate", tagline: "Propiedades e inversión", icon: "🏠", color: "#378ADD", lightColor: "#85B7EB", bgColor: "rgba(55,138,221,0.08)", desc: "Inversiones inmobiliarias, relocation y gestión de propiedades." },
  { name: "Store", tagline: "Productos y comercio", icon: "🛍", color: "#D85A30", lightColor: "#F0997B", bgColor: "rgba(216,90,48,0.08)", desc: "Tienda física y digital con productos exclusivos para miembros." },
  { name: "Online", tagline: "Servicios digitales", icon: "🌐", color: "#7F77DD", lightColor: "#AFA9EC", bgColor: "rgba(127,119,221,0.08)", desc: "Herramientas digitales, cursos, comunidad y servicios e-commerce." },
  { name: "CandyStakes", tagline: "Inversión en franquicias", icon: "🍬", color: "#D4537E", lightColor: "#ED93B1", bgColor: "rgba(212,83,126,0.08)", desc: "El primer marketplace de crowdfunding para franquicias. Invierte y genera rendimientos." },
];

const BENEFITS = [
  { num: "1", title: "Compras, te regresamos", desc: "Cada vez que compras algo en cualquier servicio de Chill N Go, te regresamos la mitad de nuestra ganancia en Chilliums.", visual: "cashback" },
  { num: "2", title: "Invitas amigos, ganas", desc: "Por cada amigo que invites ganas $3.50 en Chilliums al mes + el 35% de la ganancia de todo lo que ellos compren.", visual: "level1" },
  { num: "3", title: "Ellos invitan, tú también ganas", desc: "Si tus amigos invitan a alguien más, ganas $2.00 al mes + el 15% de la ganancia de sus compras. Sin hacer nada.", visual: "level2" },
];

function PersonSVG({ x, y, scale = 1, color = "#5DCAA5" }) {
  const s = scale;
  return (
    <g transform={`translate(${x},${y}) scale(${s})`}>
      <circle cx="0" cy="-20" r="10" fill={color} />
      <line x1="0" y1="-10" x2="0" y2="15" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="-14" y1="0" x2="14" y2="0" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="0" y1="15" x2="-10" y2="30" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="0" y1="15" x2="10" y2="30" stroke={color} strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

function SmallPersonSVG({ x, y, color = "#AFA9EC" }) {
  return (
    <g transform={`translate(${x},${y}) scale(0.6)`}>
      <circle cx="0" cy="-14" r="7" fill={color} />
      <line x1="0" y1="-7" x2="0" y2="8" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="-10" y1="0" x2="10" y2="0" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="0" y1="8" x2="-7" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <line x1="0" y1="8" x2="7" y2="20" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </g>
  );
}

function CoinSVG({ x, y, scale = 1 }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      <ellipse cx="0" cy="4" rx="14" ry="5" fill="#BA7517" />
      <ellipse cx="0" cy="0" rx="14" ry="5" fill="#EF9F27" stroke="#854F0B" strokeWidth="0.5" />
      <text x="0" y="3" textAnchor="middle" fontSize="8" fontWeight="bold" fill="#633806">C</text>
    </g>
  );
}

function CashbackVisual() {
  return (
    <svg viewBox="0 0 320 100" style={{ width: "100%", maxWidth: 320, height: "auto" }}>
      <PersonSVG x={50} y={55} scale={0.8} color="#5DCAA5" />
      <text x={50} y={92} textAnchor="middle" fontSize="9" fill="#5DCAA5" fontWeight="500">Tú</text>
      <line x1={75} y1={50} x2={115} y2={50} stroke="#1D9E75" strokeWidth="1.5" markerEnd="url(#arrowT)" />
      <defs><marker id="arrowT" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#1D9E75" strokeWidth="1.5" strokeLinecap="round" /></marker></defs>
      <rect x={120} y={30} width={45} height={40} rx="4" fill="rgba(29,158,117,0.15)" stroke="#1D9E75" strokeWidth="0.5" />
      <rect x={127} y={36} width={10} height={8} rx="1" fill="rgba(239,159,39,0.4)" />
      <rect x={140} y={36} width={10} height={8} rx="1" fill="rgba(239,159,39,0.4)" />
      <rect x={127} y={48} width={10} height={8} rx="1" fill="rgba(239,159,39,0.4)" />
      <rect x={140} y={48} width={10} height={8} rx="1" fill="rgba(239,159,39,0.4)" />
      <rect x={153} y={36} width={10} height={8} rx="1" fill="rgba(239,159,39,0.4)" />
      <rect x={153} y={48} width={10} height={8} rx="1" fill="rgba(239,159,39,0.4)" />
      <text x={142} y={85} textAnchor="middle" fontSize="8" fill="#888">Compra</text>
      <line x1={170} y1={50} x2={205} y2={50} stroke="#EF9F27" strokeWidth="1.5" markerEnd="url(#arrowG)" />
      <defs><marker id="arrowG" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#EF9F27" strokeWidth="1.5" strokeLinecap="round" /></marker></defs>
      <CoinSVG x={220} y={42} scale={1} />
      <CoinSVG x={220} y={50} scale={1} />
      <CoinSVG x={220} y={58} scale={1} />
      <text x={270} y={46} fontSize="11" fontWeight="bold" fill="#FAC775">50%</text>
      <text x={270} y={60} fontSize="8" fill="#888">de la ganancia</text>
      <text x={270} y={72} fontSize="8" fill="#888">en Chilliums</text>
    </svg>
  );
}

function Level1Visual() {
  return (
    <svg viewBox="0 0 320 120" style={{ width: "100%", maxWidth: 320, height: "auto" }}>
      <defs><marker id="arrowP" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#AFA9EC" strokeWidth="1.5" strokeLinecap="round" /></marker></defs>
      <PersonSVG x={160} y={30} scale={0.7} color="#AFA9EC" />
      <text x={160} y={62} textAnchor="middle" fontSize="9" fill="#AFA9EC" fontWeight="500">Tú</text>
      {[60, 110, 160, 210, 260].map((fx, i) => (
        <g key={i}>
          <line x1={160} y1={55} x2={fx} y2={75} stroke="#AFA9EC" strokeWidth="0.8" strokeDasharray="3 2" markerEnd="url(#arrowP)" />
          <SmallPersonSVG x={fx} y={90} color="#7F77DD" />
        </g>
      ))}
      <text x={160} y={115} textAnchor="middle" fontSize="8" fill="#888">Tus amigos — nivel 1</text>
    </svg>
  );
}

function Level2Visual() {
  return (
    <svg viewBox="0 0 320 130" style={{ width: "100%", maxWidth: 320, height: "auto" }}>
      <defs><marker id="arrowC" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M2 1L8 5L2 9" fill="none" stroke="#F0997B" strokeWidth="1.5" strokeLinecap="round" /></marker></defs>
      <SmallPersonSVG x={160} y={20} color="#AFA9EC" />
      <text x={160} y={40} textAnchor="middle" fontSize="8" fill="#888">Tu amigo</text>
      {[60, 110, 160, 210, 260].map((fx, i) => (
        <g key={i}>
          <line x1={160} y1={38} x2={fx} y2={58} stroke="#F0997B" strokeWidth="0.7" strokeDasharray="3 2" markerEnd="url(#arrowC)" />
          <circle cx={fx} cy={68} r={5} fill="#D85A30" opacity={0.6} />
        </g>
      ))}
      <text x={160} y={90} textAnchor="middle" fontSize="8" fill="#888">Amigos de tus amigos — nivel 2</text>
      <path d="M275 70 Q 300 40, 300 10 Q 300 -20, 200 -10" fill="none" stroke="#D85A30" strokeWidth="1" strokeDasharray="4 3" />
      <text x={280} y={100} fontSize="8" fill="#D85A30" fontWeight="500">Tú ganas</text>
      <text x={280} y={112} fontSize="8" fill="#D85A30">sin hacer nada</text>
    </svg>
  );
}

const visuals = { cashback: CashbackVisual, level1: Level1Visual, level2: Level2Visual };

function useInView(ref) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.15 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [ref]);
  return visible;
}

function FadeIn({ children, delay = 0, className = "" }) {
  const ref = useRef(null);
  const visible = useInView(ref);
  return (
    <div ref={ref} className={className} style={{
      opacity: visible ? 1 : 0,
      transform: visible ? "translateY(0)" : "translateY(30px)",
      transition: `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`,
    }}>
      {children}
    </div>
  );
}

export default function App() {
  const [hoveredLob, setHoveredLob] = useState(null);

  return (
    <div style={{ background: "#0D1117", color: "#e6e4dc", minHeight: "100vh", fontFamily: "'DM Sans', system-ui, sans-serif", overflowX: "hidden" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;0,700&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet" />

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        ::selection { background: rgba(29,158,117,0.3); }
        @keyframes float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 1; } }
        @keyframes shimmer { 0% { background-position: -200% center; } 100% { background-position: 200% center; } }
        .grain { position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9999; opacity: 0.03; background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E"); }
        .hero-glow { position: absolute; top: -200px; left: 50%; transform: translateX(-50%); width: 800px; height: 800px; background: radial-gradient(circle, rgba(29,158,117,0.08) 0%, transparent 70%); pointer-events: none; }
        .lob-card { transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1); cursor: default; }
        .lob-card:hover { transform: translateY(-4px); }
        .benefit-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 32px; transition: all 0.3s ease; }
        .benefit-card:hover { border-color: rgba(29,158,117,0.3); background: rgba(29,158,117,0.03); }
        .section-label { font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #1D9E75; font-weight: 500; }
        .glow-line { height: 1px; background: linear-gradient(90deg, transparent, rgba(29,158,117,0.4), transparent); margin: 0 auto; }
      `}</style>

      <div className="grain" />

      {/* NAV */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(13,17,23,0.8)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #1D9E75, #5DCAA5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#0D1117" }}>C</div>
          <span style={{ fontFamily: "'DM Sans'", fontWeight: 700, fontSize: 16, letterSpacing: 1 }}>CHILL N GO</span>
          <span style={{ fontSize: 10, color: "#888", letterSpacing: 2, marginTop: 2 }}>INTL.</span>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 13, color: "#888" }}>
          <a href="#ecosystem" style={{ color: "inherit", textDecoration: "none", transition: "color 0.2s" }}>Ecosistema</a>
          <a href="#cng-plus" style={{ color: "inherit", textDecoration: "none" }}>CNG+</a>
          <a href="#chilliums" style={{ color: "inherit", textDecoration: "none" }}>Chilliums</a>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ position: "relative", minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "120px 24px 80px", overflow: "hidden" }}>
        <div className="hero-glow" />

        <FadeIn>
          <div className="section-label" style={{ marginBottom: 24 }}>Chill N Go International LLC</div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(36px, 6vw, 64px)", fontWeight: 600, lineHeight: 1.1, maxWidth: 700, marginBottom: 20, color: "#f1efe8" }}>
            Un ecosistema.{" "}
            <span style={{ color: "#1D9E75" }}>Seis industrias.</span>{" "}
            Infinitas posibilidades.
          </h1>
        </FadeIn>

        <FadeIn delay={0.2}>
          <p style={{ fontSize: 17, color: "#888", maxWidth: 500, lineHeight: 1.7, marginBottom: 40 }}>
            Viajes, nutrición, bienes raíces, comercio y servicios digitales conectados en una sola plataforma. Hazte miembro y gana con cada interacción.
          </p>
        </FadeIn>

        <FadeIn delay={0.3}>
          <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", justifyContent: "center" }}>
            <div style={{ padding: "14px 32px", borderRadius: 50, background: "linear-gradient(135deg, #1D9E75, #0F6E56)", color: "white", fontWeight: 600, fontSize: 15, letterSpacing: 0.5 }}>
              CNG+ — $7 USD/mes
            </div>
            <span style={{ fontSize: 13, color: "#666" }}>Solo por invitación</span>
          </div>
        </FadeIn>

        {/* Floating coins decoration */}
        <div style={{ position: "absolute", bottom: 60, left: "10%", animation: "float 4s ease-in-out infinite" }}>
          <svg width="30" height="30" viewBox="0 0 30 30">
            <ellipse cx="15" cy="17" rx="12" ry="5" fill="#BA7517" opacity="0.3" />
            <ellipse cx="15" cy="13" rx="12" ry="5" fill="#EF9F27" opacity="0.4" />
            <text x="15" y="16" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#854F0B">C</text>
          </svg>
        </div>
        <div style={{ position: "absolute", bottom: 120, right: "12%", animation: "float 5s ease-in-out infinite 1s" }}>
          <svg width="24" height="24" viewBox="0 0 30 30">
            <ellipse cx="15" cy="15" rx="12" ry="5" fill="#EF9F27" opacity="0.3" />
            <text x="15" y="18" textAnchor="middle" fontSize="7" fontWeight="bold" fill="#854F0B">C</text>
          </svg>
        </div>

        {/* Scroll indicator */}
        <div style={{ position: "absolute", bottom: 24, animation: "pulse 2s ease infinite" }}>
          <svg width="20" height="30" viewBox="0 0 20 30" fill="none">
            <rect x="1" y="1" width="18" height="28" rx="9" stroke="#444" strokeWidth="1" />
            <circle cx="10" cy="10" r="3" fill="#1D9E75" />
          </svg>
        </div>
      </section>

      <div className="glow-line" style={{ width: "60%" }} />

      {/* ECOSYSTEM */}
      <section id="ecosystem" style={{ padding: "100px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>Ecosistema</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 500, marginBottom: 16 }}>
              Seis líneas de negocio, <span style={{ color: "#1D9E75" }}>un solo ecosistema</span>
            </h2>
            <p style={{ color: "#888", fontSize: 15, maxWidth: 500, margin: "0 auto" }}>
              Todo lo que compras, en cualquier línea, te genera Chilliums que puedes usar en las demás.
            </p>
          </div>
        </FadeIn>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16 }}>
          {LOBS.map((lob, i) => (
            <FadeIn key={lob.name} delay={i * 0.08}>
              <div
                className="lob-card"
                onMouseEnter={() => setHoveredLob(i)}
                onMouseLeave={() => setHoveredLob(null)}
                style={{
                  background: hoveredLob === i ? lob.bgColor : "rgba(255,255,255,0.02)",
                  border: `1px solid ${hoveredLob === i ? lob.color + "40" : "rgba(255,255,255,0.05)"}`,
                  borderRadius: 16,
                  padding: 24,
                  textAlign: "center",
                  minHeight: 200,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 4 }}>{lob.icon}</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: lob.lightColor }}>{lob.name}</div>
                <div style={{ fontSize: 11, color: lob.color, letterSpacing: 1, textTransform: "uppercase" }}>{lob.tagline}</div>
                <div style={{ fontSize: 12, color: "#666", lineHeight: 1.5, marginTop: 4 }}>{lob.desc}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <div className="glow-line" style={{ width: "40%" }} />

      {/* CNG+ PITCH */}
      <section id="cng-plus" style={{ padding: "100px 24px", maxWidth: 900, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>Membresía</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px, 4vw, 42px)", fontWeight: 500, marginBottom: 8 }}>
              CNG+ — <span style={{ color: "#EF9F27" }}>$7 USD/mes</span>
            </h2>
            <p style={{ color: "#888", fontSize: 15, maxWidth: 480, margin: "0 auto" }}>
              Tres formas de ganar Chilliums. Así de simple.
            </p>
          </div>
        </FadeIn>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {BENEFITS.map((b, i) => {
            const Visual = visuals[b.visual];
            return (
              <FadeIn key={i} delay={i * 0.1}>
                <div className="benefit-card">
                  <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
                    <div style={{ flex: "1 1 280px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(29,158,117,0.15)", border: "1px solid rgba(29,158,117,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#5DCAA5" }}>{b.num}</div>
                        <h3 style={{ fontSize: 18, fontWeight: 600 }}>{b.title}</h3>
                      </div>
                      <p style={{ fontSize: 14, color: "#999", lineHeight: 1.7 }}>{b.desc}</p>
                    </div>
                    <div style={{ flex: "1 1 280px", display: "flex", justifyContent: "center", alignItems: "center" }}>
                      <Visual />
                    </div>
                  </div>
                </div>
              </FadeIn>
            );
          })}
        </div>
      </section>

      <div className="glow-line" style={{ width: "50%" }} />

      {/* EXAMPLE */}
      <section style={{ padding: "100px 24px", maxWidth: 900, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div className="section-label" style={{ marginBottom: 12 }}>Ejemplo real</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 500, marginBottom: 8 }}>
              Invitas a 10 amigos, cada uno invita a 5
            </h2>
          </div>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 16, padding: 32 }}>
            {/* Visual tree */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, flexWrap: "wrap", marginBottom: 32 }}>
              <div style={{ textAlign: "center" }}>
                <svg width="40" height="55" viewBox="0 0 40 55">
                  <PersonSVG x={20} y={25} scale={0.6} color="#85B7EB" />
                </svg>
                <div style={{ fontSize: 11, color: "#85B7EB", fontWeight: 500 }}>Tú</div>
              </div>
              <div style={{ color: "#444", fontSize: 20 }}>→</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", background: "#7F77DD", opacity: 0.7 }} />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "#AFA9EC", marginTop: 6 }}>10 amigos</div>
              </div>
              <div style={{ color: "#444", fontSize: 20 }}>→</div>
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3, justifyContent: "center", maxWidth: 100 }}>
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#D85A30", opacity: 0.4 }} />
                  ))}
                </div>
                <div style={{ fontSize: 11, color: "#F0997B", marginTop: 6 }}>50 personas</div>
              </div>
              <div style={{ color: "#444", fontSize: 20 }}>=</div>
              <div style={{ background: "rgba(239,159,39,0.1)", border: "1px solid rgba(239,159,39,0.3)", borderRadius: 12, padding: "16px 24px", textAlign: "center" }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: "#FAC775" }}>$265+</div>
                <div style={{ fontSize: 11, color: "#EF9F27" }}>Chilliums/mes</div>
              </div>
            </div>

            {/* Breakdown */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                ["Membresías nivel 1 (10 × $3.50)", "$35"],
                ["Compras nivel 1 (10 amigos)", "$35+"],
                ["Membresías nivel 2 (50 × $2.00)", "$100"],
                ["Compras nivel 2 (50 personas)", "$75+"],
                ["Tu propio cashback", "$20+"],
              ].map(([label, val], i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", fontSize: 13 }}>
                  <span style={{ color: "#888" }}>{label}</span>
                  <span style={{ color: "#FAC775", fontWeight: 500 }}>{val}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", fontSize: 14 }}>
                <span style={{ fontWeight: 600 }}>Total mensual</span>
                <span style={{ color: "#5DCAA5", fontWeight: 700, fontSize: 18 }}>$265+ Chilliums</span>
              </div>
              <div style={{ textAlign: "center", fontSize: 12, color: "#666", marginTop: 4 }}>Pagando solo $7/mes</div>
            </div>
          </div>
        </FadeIn>
      </section>

      <div className="glow-line" style={{ width: "30%" }} />

      {/* CHILLIUMS */}
      <section id="chilliums" style={{ padding: "100px 24px", maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
        <FadeIn>
          <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 24 }}>
            <svg width="50" height="40" viewBox="0 0 50 40" style={{ animation: "float 3s ease-in-out infinite" }}>
              <ellipse cx="25" cy="28" rx="20" ry="7" fill="#BA7517" opacity="0.4" />
              <ellipse cx="25" cy="22" rx="20" ry="7" fill="#EF9F27" opacity="0.5" />
              <ellipse cx="25" cy="16" rx="20" ry="7" fill="#FAC775" opacity="0.7" stroke="#854F0B" strokeWidth="0.5" />
              <text x="25" y="20" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#633806">C</text>
            </svg>
          </div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 32, fontWeight: 500, marginBottom: 12 }}>
            1 Chillium = <span style={{ color: "#EF9F27" }}>1 USD</span>
          </h2>
          <p style={{ fontSize: 15, color: "#888", maxWidth: 450, margin: "0 auto", lineHeight: 1.7 }}>
            Los Chilliums son tu moneda dentro del ecosistema Chill N Go. Gánalos con tus compras y con tu red de referidos. Úsalos como dinero real en viajes, productos, servicios y más.
          </p>
        </FadeIn>

        <FadeIn delay={0.15}>
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 40, flexWrap: "wrap" }}>
            {LOBS.map((lob) => (
              <div key={lob.name} style={{ padding: "8px 16px", borderRadius: 50, background: lob.bgColor, border: `1px solid ${lob.color}30`, fontSize: 12, color: lob.lightColor, fontWeight: 500 }}>
                {lob.icon} {lob.name}
              </div>
            ))}
          </div>
        </FadeIn>
      </section>

      <div className="glow-line" style={{ width: "60%" }} />

      {/* INVITE ONLY */}
      <section style={{ padding: "100px 24px 60px", textAlign: "center" }}>
        <FadeIn>
          <div style={{ maxWidth: 500, margin: "0 auto" }}>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 16, letterSpacing: 1 }}>ACCESO POR INVITACIÓN</div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: "clamp(24px, 3.5vw, 36px)", fontWeight: 500, marginBottom: 16 }}>
              CNG+ es <span style={{ color: "#1D9E75" }}>exclusivo</span>
            </h2>
            <p style={{ fontSize: 14, color: "#888", lineHeight: 1.7, marginBottom: 32 }}>
              Solo puedes unirte a través del link de un miembro activo. Si llegaste aquí, es porque alguien de tu confianza te invitó a ser parte del ecosistema.
            </p>
            <div style={{ padding: "16px 40px", borderRadius: 50, border: "1px solid rgba(29,158,117,0.3)", background: "rgba(29,158,117,0.05)", display: "inline-block", color: "#5DCAA5", fontSize: 14, fontWeight: 500 }}>
              Pide tu invitación a quien te compartió este enlace
            </div>
          </div>
        </FadeIn>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: "40px 24px 32px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
          <div style={{ width: 20, height: 20, borderRadius: 4, background: "linear-gradient(135deg, #1D9E75, #5DCAA5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#0D1117" }}>C</div>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: 1 }}>CHILL N GO INTERNATIONAL LLC</span>
        </div>
        <p style={{ fontSize: 11, color: "#444" }}>Florida, USA — Todos los derechos reservados</p>
      </footer>
    </div>
  );
}