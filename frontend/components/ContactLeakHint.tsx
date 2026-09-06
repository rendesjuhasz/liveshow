export default function ContactLeakHint({ warning }: { warning: string }) {
    if (!warning) return null;
    return (
        <p className="text-sm text-amber-300" role="alert">
            {warning}
        </p>
    );
}
