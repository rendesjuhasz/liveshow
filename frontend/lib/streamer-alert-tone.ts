let ctx: AudioContext | null = null;

function audio() {
    if (typeof window === "undefined") return null;
    if (!ctx) {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
}

function beep(freq: number, duration: number, delay = 0) {
    const ac = audio();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ac.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.18, ac.currentTime + delay + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + delay + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(ac.currentTime + delay);
    osc.stop(ac.currentTime + delay + duration + 0.02);
}

export function playStreamerAlert(kind: "net" | "mic" | "question" | "background") {
    if (kind === "background") {
        beep(520, 0.18, 0);
        beep(400, 0.22, 0.2);
        beep(520, 0.28, 0.44);
        return;
    }
    if (kind === "net") {
        beep(340, 0.28, 0);
        beep(280, 0.32, 0.34);
        return;
    }
    if (kind === "mic") {
        beep(480, 0.22, 0);
        beep(480, 0.22, 0.28);
        return;
    }
    beep(880, 0.16, 0);
    beep(1170, 0.18, 0.14);
}
