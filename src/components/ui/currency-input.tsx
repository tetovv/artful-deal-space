import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface CurrencyInputProps {
  value: string;
  onChange: (raw: string) => void;
  placeholder?: string;
  className?: string;
  min?: number;
  max?: number;
  suffix?: string;
  disabled?: boolean;
}

/**
 * Controlled numeric input that:
 * - Accepts only digits while typing
 * - Allows paste of formatted numbers ("15 000" → "15000")
 * - Formats with thousand separators on blur
 * - Shows inline validation errors for min/max
 * - Stores raw integer string (no separators)
 */
export function CurrencyInput({
  value,
  onChange,
  placeholder,
  className,
  min,
  max,
  suffix = "₽",
  disabled,
}: CurrencyInputProps) {
  const [displayValue, setDisplayValue] = React.useState(() => formatDisplay(value));
  const [focused, setFocused] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Sync display when value changes externally and not focused
  React.useEffect(() => {
    if (!focused) {
      setDisplayValue(formatDisplay(value));
    }
  }, [value, focused]);

  const validate = (raw: string) => {
    if (!raw) { setError(null); return; }
    const num = parseInt(raw, 10);
    if (min !== undefined && num < min) {
      setError(`Минимум ${min.toLocaleString("ru-RU")}`);
    } else if (max !== undefined && num > max) {
      setError(`Максимум ${max.toLocaleString("ru-RU")}`);
    } else {
      setError(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "");
    setDisplayValue(raw);
    onChange(raw);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/[^0-9]/g, "");
    setDisplayValue(pasted);
    onChange(pasted);
  };

  const handleFocus = () => {
    setFocused(true);
    // Show raw value for editing
    setDisplayValue(value);
  };

  const handleBlur = () => {
    setFocused(false);
    setDisplayValue(formatDisplay(value));
    validate(value);
  };

  return (
    <div className="space-y-1">
      <div className="relative">
        <Input
          inputMode="numeric"
          value={displayValue}
          onChange={handleChange}
          onPaste={handlePaste}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(suffix && "pr-8", className)}
          disabled={disabled}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground pointer-events-none">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p className="text-[11px] text-destructive">{error}</p>
      )}
    </div>
  );
}

function formatDisplay(raw: string): string {
  if (!raw) return "";
  const num = parseInt(raw, 10);
  if (isNaN(num)) return raw;
  return num.toLocaleString("ru-RU");
}
