export interface Update {
  available: boolean;
  version: string;
  date?: string;
  body?: string;
  download(onProgress?: (event: unknown) => void): Promise<void>;
  install(): Promise<void>;
  downloadAndInstall(onProgress?: (event: any) => void): Promise<void>;
}

export async function check(): Promise<Update | null> {
  return null;
}
