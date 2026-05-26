import React, { Suspense } from 'react';

type Loader<TProps> = () => Promise<{ default: React.ComponentType<TProps> }>;

export default function dynamic<TProps>(
  loader: Loader<TProps>,
  _options?: { ssr?: boolean; loading?: React.ComponentType }
) {
  const LazyComponent = React.lazy(loader) as React.ComponentType<TProps>;

  return function DynamicComponent(props: TProps) {
    return (
      <Suspense fallback={null}>
        <LazyComponent {...(props as TProps & React.JSX.IntrinsicAttributes)} />
      </Suspense>
    );
  };
}
