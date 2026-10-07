export function EditionMark({
  index,
  folio,
  note,
}: {
  index?: number | null
  folio: string
  note?: string
}) {
  return (
    <p className="ed-mark">
      {typeof index === 'number' ? <strong>ED. {String(index + 1).padStart(2, '0')}</strong> : null}
      <span className="folio">{folio}</span>
      {note ? <span className={note.includes('SELECT') ? 'is-select-note' : 'folio'}>{note}</span> : null}
    </p>
  )
}
