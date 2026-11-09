import { ImageResponse } from "next/og";

import { site } from "@/lib/site";

/** Default share image (WhatsApp, Instagram, Facebook): text only, no Volvo logo or marks. */
export const alt = `${site.name}: Volvo seminovos e usados no Brasil`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  const host = new URL(site.url).host;
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "72px 80px",
        background: "#f4f5f7",
        color: "#14161a",
      }}
    >
      <div style={{ display: "flex", fontSize: 40, fontWeight: 600, color: "#2f4a6d" }}>
        {site.name}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, lineHeight: 1.05 }}>
          Encontre seu próximo Volvo.
        </div>
        <div style={{ display: "flex", fontSize: 36, color: "#4b5563" }}>
          Seminovos e usados de lojas e particulares do Brasil inteiro.
        </div>
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#6b7280" }}
      >
        <span>{host}</span>
        <span>{site.brandDisclaimer}</span>
      </div>
    </div>,
    size,
  );
}
