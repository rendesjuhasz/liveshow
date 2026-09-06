export async function getStreamToken(streamId: string) {
    const res = await fetch(`http://localhost:3200/token/generate?streamId=${streamId}&expires=3600`);
    if (!res.ok) throw new Error("Token request failed");

    return res.json(); // { token, expiresAt }
}
