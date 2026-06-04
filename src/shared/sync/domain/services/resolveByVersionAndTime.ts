type VersionedEntity = {
  version: number;
  updatedAt: Date | string;
};

function toTimestamp(value: Date | string): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  return new Date(value).getTime();
}

export function resolveByVersionAndTime<T extends VersionedEntity>(local: T, remote: T): T {
  if (remote.version > local.version) {
    return remote;
  }

  if (local.version > remote.version) {
    return local;
  }

  return toTimestamp(remote.updatedAt) >= toTimestamp(local.updatedAt) ? remote : local;
}
