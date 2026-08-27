import { useCallback, useRef, type ReactElement } from 'react'

/**
 * A hidden `<input type="file">` you render once and trigger imperatively.
 * More reliable than a detached input, and drivable in automated tests.
 */
export function useFilePicker(
  onFiles: (files: File[]) => void,
  multiple = false,
): { open: () => void; input: ReactElement } {
  const ref = useRef<HTMLInputElement>(null)
  const open = useCallback(() => ref.current?.click(), [])
  const input = (
    <input
      ref={ref}
      type="file"
      accept="image/*"
      multiple={multiple}
      style={{ display: 'none' }}
      onChange={(e) => {
        const files = e.target.files ? Array.from(e.target.files) : []
        e.target.value = ''
        if (files.length) onFiles(files)
      }}
    />
  )
  return { open, input }
}
