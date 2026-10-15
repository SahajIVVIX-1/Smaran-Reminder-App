import { Fragment, useMemo, type ReactNode } from 'react';
import { parseRich, type RichNode } from '@shared/richText';

function render(nodes: RichNode[]): ReactNode[] {
  return nodes.map((node, i) => {
    if (typeof node === 'string') return <Fragment key={i}>{node}</Fragment>;
    const children = render(node.children);
    switch (node.mark) {
      case 'bold':
        return (
          <strong key={i} className="font-bold">
            {children}
          </strong>
        );
      case 'italic':
        return (
          <em key={i} className="italic">
            {children}
          </em>
        );
      case 'underline':
        return (
          <span key={i} className="underline underline-offset-2">
            {children}
          </span>
        );
      case 'strike':
        return (
          <span key={i} className="line-through">
            {children}
          </span>
        );
    }
  });
}

/** A reminder note or line with its **bold**, *italic*, __underline__ and ~~strike~~ shown. */
export function RichText({ text }: { text: string }) {
  const nodes = useMemo(() => render(parseRich(text)), [text]);
  return <>{nodes}</>;
}
