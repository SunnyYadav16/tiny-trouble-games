import { useEffect, useRef, type ReactNode } from 'react';
import { CLEAR, Icon } from './icons';
import './Dialog.css';

interface Props {
  /** The dialog's own layout class, beside `dialog`. */
  className: string;
  /** Id of the heading that names the dialog. */
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A native modal: the page behind goes inert and Tab stays inside. It closes from its Close button, Escape,
 * or a click on the backdrop; the parent unmounts it then, and focus goes back to whatever opened it.
 */
export function Dialog({ className, labelledBy, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const pressedOnBackdrop = useRef(false);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current!;
    dialog.showModal();
    return () => {
      dialog.close();
      opener?.focus();
    };
  }, []);

  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- a click on the backdrop is a mouse shortcut; Escape and Close are the keyboard routes
    <dialog
      ref={ref}
      className={`dialog ${className}`}
      aria-modal="true"
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault(); // Escape: closing is the parent's call, which unmounts this
        onClose();
      }}
      // Only the backdrop is the <dialog> itself (the panel inside fills it). A drag that began in the content and ended on the backdrop is not a backdrop click.
      onMouseDown={(e) => (pressedOnBackdrop.current = e.target === e.currentTarget)}
      onClick={(e) => e.target === e.currentTarget && pressedOnBackdrop.current && onClose()}
    >
      <div className="panel">
        <button type="button" className="iconbtn x" aria-label="Close" onClick={onClose}>
          <Icon d={CLEAR} />
        </button>
        {children}
      </div>
    </dialog>
  );
}
