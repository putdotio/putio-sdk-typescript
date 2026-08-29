import { access, chmod, writeFile } from "node:fs/promises";

export const liveTokenCacheUrl = new URL("../.env.live-tokens", import.meta.url);

export const hasLiveTokenCache = async (url: URL = liveTokenCacheUrl): Promise<boolean> => {
  try {
    await access(url);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
};

export const writeLiveTokenCache = async (
  tokens: {
    readonly firstPartyToken: string;
    readonly thirdPartyToken: string;
  },
  url: URL = liveTokenCacheUrl,
): Promise<void> => {
  const contents = [
    `PUTIO_TOKEN_FIRST_PARTY=${JSON.stringify(tokens.firstPartyToken)}`,
    `PUTIO_TOKEN_THIRD_PARTY=${JSON.stringify(tokens.thirdPartyToken)}`,
    "",
  ].join("\n");

  await writeFile(url, contents, { mode: 0o600 });
  await chmod(url, 0o600);
};
