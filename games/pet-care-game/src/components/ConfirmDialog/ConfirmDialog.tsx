import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
  icon: string;
  title: string;
  message?: string;
  yesLabel: string;
  noLabel?: string;
  onYes: () => void;
  onNo: () => void;
}

/** Big in-game yes / no card (replaces window.confirm, which kids can't read). */
export function ConfirmDialog({ icon, title, message, yesLabel, noLabel = 'No', onYes, onNo }: ConfirmDialogProps) {
  return (
    <div className={styles.backdrop} onClick={onNo} role="presentation">
      <div className={styles.card} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className={styles.icon} aria-hidden="true">{icon}</div>
        <h3 className={styles.title}>{title}</h3>
        {message && <p className={styles.message}>{message}</p>}
        <div className={styles.buttons}>
          <button type="button" className={styles.noBtn} onClick={onNo}>
            ✖ {noLabel}
          </button>
          <button type="button" className={styles.yesBtn} onClick={onYes}>
            ✔ {yesLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
