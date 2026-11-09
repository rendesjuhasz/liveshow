import { fieldControlClass } from "@/components/FormFieldError";
import { VIDEO_CATEGORIES } from "@/lib/video-categories";

export default function VideoCategorySelect({
    value,
    onChange,
    required = true,
    id,
    invalid,
}: {
    value: string;
    onChange: (value: string) => void;
    required?: boolean;
    id?: string;
    invalid?: boolean;
}) {
    return (
        <select
            id={id}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid && id ? `${id}-error` : undefined}
            className={fieldControlClass(invalid, "min-h-12 w-full rounded-xl p-3 text-base text-black")}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
        >
            <option value="" disabled>
                Válassz kategóriát
            </option>
            {VIDEO_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                    {item.label}
                </option>
            ))}
        </select>
    );
}
