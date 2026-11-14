export function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="aiswitch">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <i />
    </label>
  );
}