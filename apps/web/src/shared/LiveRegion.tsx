// <output> carries role="status" implicitly.
export function LiveRegion({ message }: { message: string }) {
  return (
    <output aria-live="polite" className="visually-hidden">
      {message}
    </output>
  );
}
