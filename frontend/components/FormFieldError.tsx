export function FormFieldError({ fieldId, message }: { fieldId: string; message?: string }) {
    if (!message) return null;
    return (
        <p id={`${fieldId}-error`} className="text-sm text-red-400" role="alert">
            {message}
        </p>
    );
}

export function fieldControlClass(invalid?: boolean, extra = "") {
    return [
        extra,
        invalid ? "outline outline-2 outline-red-500" : "",
    ]
        .filter(Boolean)
        .join(" ");
}
