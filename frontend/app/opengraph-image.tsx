import { ImageResponse } from "next/og";

export const alt = "LiveShow";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: 80,
                    background: "#121212",
                    color: "#f5f5f5",
                    fontFamily: "sans-serif",
                }}
            >
                <div style={{ fontSize: 28, letterSpacing: 6, color: "#facc15", fontWeight: 700 }}>
                    LIVESHOW
                </div>
                <div style={{ fontSize: 64, fontWeight: 800, marginTop: 16, lineHeight: 1.1 }}>
                    Élő események és archívum
                </div>
                <div style={{ fontSize: 28, color: "#a1a1aa", marginTop: 24 }}>
                    Nézés ingyen · jegy az interaktív funkciókhoz
                </div>
            </div>
        ),
        { ...size },
    );
}
