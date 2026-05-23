type PropKey = string | symbol;
type DomainProps = Record<PropKey, unknown>;

function resolvePropKey(propertyKey: PropKey, propKey?: PropKey): PropKey {
  return propKey ?? propertyKey;
}

function getDomainProps(instance: object, propertyKey: PropKey): DomainProps {
  const source = instance as { etc?: unknown; props?: unknown };
  const props = source.etc ?? source.props;

  if (!props || typeof props !== 'object') {
    throw new Error(`DomainAccessorPropsNotFound:${String(propertyKey)}`);
  }

  return props as DomainProps;
}

function defineDomainAccessor(params: {
  target: object;
  propertyKey: PropKey;
  propKey?: PropKey;
  getter?: boolean;
  setter?: boolean;
}): void {
  const { target, propertyKey, getter = false, setter = false } = params;
  const propKey = resolvePropKey(propertyKey, params.propKey);
  const current = Object.getOwnPropertyDescriptor(target, propertyKey);

  Object.defineProperty(target, propertyKey, {
    configurable: true,
    enumerable: true,
    get: getter
      ? function (this: object): unknown {
          return getDomainProps(this, propertyKey)[propKey];
        }
      : current?.get,
    set: setter
      ? function (this: object, value: unknown): void {
          getDomainProps(this, propertyKey)[propKey] = value;
        }
      : current?.set,
  });
}

export function Getter(propKey?: PropKey): PropertyDecorator {
  return (target, propertyKey) => {
    defineDomainAccessor({
      target,
      propertyKey,
      propKey,
      getter: true,
    });
  };
}

export function Setter(propKey?: PropKey): PropertyDecorator {
  return (target, propertyKey) => {
    defineDomainAccessor({
      target,
      propertyKey,
      propKey,
      setter: true,
    });
  };
}
