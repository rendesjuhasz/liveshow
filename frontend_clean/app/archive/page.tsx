import React from "react";

export default function ArchivePage() {
    return (
        <div style={{ padding: 40 }}>
            <h1>Archívum</h1>

            <p>Itt lesznek a korábbi műsorok felvételei.</p>

            <div
                style={{
                    width: "100%",
                    height: 300,
                    backgroundColor: "#222",
                    color: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 20,
                }}
            >
                Archív videók listája (hamarosan)
            </div>
        </div>
    );
}
