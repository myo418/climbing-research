import type { ReactNode } from 'react';
import styles from './Tategumi.module.css';

export function Tategumi({ children }: { children: ReactNode }) {
  return <section className={styles.tategumi}>{children}</section>;
}
