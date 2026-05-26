import type { ImgHTMLAttributes } from 'react';

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
  src: string;
  width?: number;
  height?: number;
  priority?: boolean;
};

export default function Image({ src, priority: _priority, ...props }: ImageProps) {
  const normalizedSrc = src.startsWith('http') || src.startsWith('data:')
    ? src
    : src.startsWith('/')
      ? `.${src}`
      : `./${src}`;

  return <img src={normalizedSrc} {...props} />;
}
