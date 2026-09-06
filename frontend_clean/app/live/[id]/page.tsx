import Player from "./Player";

export default async function LivePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    return (
        <div style={{ padding: 40 }}>
            <h1>Élő adás</h1>
            <Player streamId={id} />
        </div>
    );
}
